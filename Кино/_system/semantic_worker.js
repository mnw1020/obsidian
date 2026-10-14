/* Dedicated browser worker: no Node APIs and no network model access. */
"use strict";

// Obsidian desktop enables Node integration in workers. Browser distributions
// of Transformers/ORT then misidentify this worker as Node and select a stub
// backend. Keep the dedicated inference worker in browser mode before importing
// either library; the application's main globals are untouched.
globalThis.process = undefined;

let tokenizer;
let nativeModel;
let model;
let assetSequence = 0;
const assetRequests = new Map();
const nativeFetch = globalThis.fetch.bind(globalThis);

// Transformers and ORT may load blobs created by the host. Every other fetch is
// forbidden even if a future library default changes. Model bytes arrive by RPC.
globalThis.fetch = (input, init) => {
    const url = typeof input === "string" ? input : String(input?.url || input);
    if (!url.startsWith("blob:")) return Promise.reject(new Error("Сеть для модели отключена: " + url));
    return nativeFetch(input, init);
};

function asset(path) {
    const id = ++assetSequence;
    return new Promise((resolve, reject) => {
        assetRequests.set(id, { resolve, reject });
        postMessage({ type: "asset", id, path });
    });
}

function modelAssetPath(key) {
    key = String(key?.url || key);
    const localPrefix = "/kino-models/" + model.id + "/";
    const remotePrefix = "https://huggingface.co/" + model.id + "/resolve/" + model.revision + "/";
    const prefix = key.startsWith(localPrefix) ? localPrefix : key.startsWith(remotePrefix) ? remotePrefix : null;
    if (!prefix) return null;
    const name = key.slice(prefix.length);
    if (!name || name.includes("..") || name.includes("?") || name.includes("#") || name.includes("\\")) return null;
    return "models/" + model.id + "/" + name;
}

async function initialize(payload, requestId) {
    model = payload.model;
    const { AutoModel, AutoTokenizer, env } = await import(payload.libraryUrl);
    env.allowLocalModels = true;
    env.allowRemoteModels = false;
    env.localModelPath = "/kino-models/";
    env.useFS = false;
    env.useFSCache = false;
    env.useBrowserCache = false;
    env.useCustomCache = true;
    env.customCache = {
        async match(key) {
            const path = modelAssetPath(key);
            if (!path) return undefined;
            try {
                postMessage({ type: "progress", id: requestId, progress: { phase: "model", status: "initiate", name: model.id, file: path } });
                const buffer = await asset(path);
                // Model bytes have already crossed the host/worker boundary by
                // transfer. Avoid Response's extra full model copy and the
                // library's streamed progress buffer: its pinned cache reader
                // calls arrayBuffer() directly when no progress_callback is set.
                const response = new Response(null, { status: 200, headers: { "Content-Length": String(buffer.byteLength), "Content-Type": path.endsWith(".json") ? "application/json" : "application/octet-stream" } });
                response.arrayBuffer = async () => buffer;
                postMessage({ type: "progress", id: requestId, progress: { phase: "model", status: "done", name: model.id, file: path, loaded: buffer.byteLength, total: buffer.byteLength } });
                return response;
            } catch (error) {
                // A cached 404 is treated as file content by this library. Return
                // no hit so its local-only loader reports a missing file safely.
                return undefined;
            }
        },
        async put() { /* Assets are already persisted by the installer. */ },
    };
    if (!env.backends.onnx?.wasm) throw new Error("Браузерный WebAssembly-модуль модели недоступен");
    env.backends.onnx.wasm.numThreads = 1;
    env.backends.onnx.wasm.proxy = false;
    const wasmBinary = await asset("onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm");
    // Emscripten resolves a wasm URL even with wasmBinary. A Blob module has no
    // relative URL base, so both paths must be explicit (never new URL(relative, blob)).
    const wasmUrl = URL.createObjectURL(new Blob([wasmBinary], { type: "application/wasm" }));
    env.backends.onnx.wasm.wasmPaths = { mjs: payload.wasmModuleUrl, wasm: wasmUrl };
    // Do not set wasmBinary: this ORT revision only installs locateFile when it
    // loads via wasmPaths, which is required for an mjs module imported from Blob.
    try {
        const options = {
            revision: model.revision,
            dtype: model.dtype,
            device: "wasm",
            local_files_only: true,
        };
        // The ONNX graph includes Gemma's trained pooling/projection head.
        // Averaging last_hidden_state would produce a different embedding.
        tokenizer = await AutoTokenizer.from_pretrained(model.id, options);
        nativeModel = await AutoModel.from_pretrained(model.id, options);
    } finally {
        URL.revokeObjectURL(wasmUrl);
    }
    return { model, threads: env.backends.onnx.wasm.numThreads, remoteModels: env.allowRemoteModels };
}

async function embed(texts, requestId) {
    if (!tokenizer || !nativeModel) throw new Error("Локальная модель не загружена");
    const results = [];
    for (let index = 0; index < texts.length; index++) {
        const text = String(texts[index] ?? "").trim();
        if (!text) throw new Error("Описание сюжета пустое");
        const input = model.prefix + text;
        const encoded = await tokenizer(input, { truncation: false, padding: false });
        const tokenCount = encoded.input_ids.data.length;
        const inputs = await tokenizer(input, { truncation: true, max_length: model.maxTokens, padding: false });
        const output = await nativeModel(inputs);
        const embedding = output.sentence_embedding;
        if (!embedding) throw new Error("Модель не вернула sentence_embedding");
        if (embedding.data.length !== model.dimensions) throw new Error("Неправильная размерность сюжетного вектора");
        let vector = Array.from(embedding.data);
        if (!vector.every(Number.isFinite)) throw new Error("Модель вернула некорректный сюжетный вектор");
        const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
        if (!(norm > 0)) throw new Error("Модель вернула пустой сюжетный вектор");
        if (model.normalize) vector = vector.map(value => value / norm);
        results.push({ vector, tokens: tokenCount, usedTokens: Math.min(tokenCount, model.maxTokens), truncated: tokenCount > model.maxTokens });
        postMessage({ type: "progress", id: requestId, progress: { phase: "embedding", modelKey: model.key, completed: index + 1, total: texts.length, tokens: tokenCount, truncated: tokenCount > model.maxTokens } });
    }
    return results;
}

self.onmessage = async event => {
    const message = event.data || {};
    if (message.type === "asset-result") {
        const request = assetRequests.get(message.id);
        if (!request) return;
        assetRequests.delete(message.id);
        if (message.error) request.reject(new Error(message.error));
        else request.resolve(message.buffer);
        return;
    }
    try {
        let result;
        if (message.action === "init") result = await initialize(message.payload, message.id);
        else if (message.action === "embed") result = await embed(message.payload.texts, message.id);
        else throw new Error("Неизвестная команда модели");
        postMessage({ type: "result", id: message.id, result });
    } catch (error) {
        postMessage({ type: "result", id: message.id, error: { message: String(error.message || error), name: error.name || "Error", stack: String(error.stack || "") } });
    }
};

self.addEventListener("unhandledrejection", event => {
    postMessage({ type: "fatal", error: String(event.reason?.message || event.reason || "Ошибка загрузки локальной модели") });
});
