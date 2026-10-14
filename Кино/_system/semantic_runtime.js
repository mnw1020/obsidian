/* Local browser inference for Obsidian desktop and Android. This CommonJS
 * module uses only vault adapters + browser APIs; no process or Node dependency.
 */
"use strict";

const MODEL = Object.freeze({
    key: "embeddinggemma",
    label: "EmbeddingGemma 300M",
    id: "onnx-community/embeddinggemma-300m-ONNX",
    revision: "5090578d9565bb06545b4552f76e6bc2c93e4a66",
    dtype: "q8",
    dimensions: 768,
    libraryVersion: "3.8.1",
    onnxVersion: "1.22.0-dev.20250409-89f8206ba4",
    maxTokens: 512,
    prefix: "task: sentence similarity | query: ",
    pooling: "sentence_embedding",
    normalize: true,
});
const MODELS = Object.freeze([MODEL]);
const activeOwners = new WeakMap();

function abortError(message = "Сюжетный расчёт отменён") {
    const error = new Error(message);
    error.name = "AbortError";
    return error;
}

async function create({ app, modelKey = MODEL.key, onProgress, signal, runtimeRoot = "Кино/_system/Прогноз/runtime", workerPath = "Кино/_system/semantic_worker.js", idleMs = 60000 } = {}) {
    if (!app?.vault?.adapter) throw new Error("Нужен адаптер хранилища Obsidian");
    const adapter = app.vault.adapter;
    const selectedModel = MODELS.find(item => item.key === modelKey);
    if (!selectedModel) throw new Error("Неизвестная сюжетная модель: " + modelKey);
    const owner = { stop };
    let worker = null;
    let initializing = null;
    let nextId = 0;
    let serial = Promise.resolve();
    let idleTimer = null;
    let closed = false;
    let generation = 0;
    const pending = new Map();
    const urls = new Set();
    const blobUrl = (source, type = "text/javascript") => {
        const url = URL.createObjectURL(new Blob([source], { type }));
        urls.add(url);
        return url;
    };
    const checkSignal = () => {
        if (closed) throw abortError("Сюжетная модель закрыта");
        if (signal?.aborted) throw abortError();
    };
    const emit = progress => {
        try { onProgress?.(progress); } catch (_) { /* Display callbacks cannot break inference. */ }
    };
    const clearIdle = () => { if (idleTimer) clearTimeout(idleTimer); idleTimer = null; };

    function stop(error = abortError(), permanent = false) {
        generation++;
        clearIdle();
        if (permanent) closed = true;
        worker?.terminate();
        worker = null;
        initializing = null;
        for (const request of pending.values()) {
            clearTimeout(request.timer);
            request.reject(error);
        }
        pending.clear();
        for (const url of urls) URL.revokeObjectURL(url);
        urls.clear();
        if (activeOwners.get(adapter) === owner) activeOwners.delete(adapter);
    }

    function armIdle() {
        clearIdle();
        if (!closed && worker && idleMs > 0) idleTimer = setTimeout(() => stop(abortError("Модель выгружена после простоя")), idleMs);
    }

    function call(action, payload, onCallProgress, shouldCancel) {
        checkSignal();
        const id = ++nextId;
        return new Promise((resolve, reject) => {
            const request = { resolve, reject, timer: null, onCallProgress, shouldCancel };
            request.resetTimeout = () => {
                clearTimeout(request.timer);
                request.timer = setTimeout(() => stop(new Error("Локальная модель не ответила вовремя. Расчёт можно повторить.")), action === "init" ? 180000 : 120000);
            };
            pending.set(id, request);
            request.resetTimeout();
            worker.postMessage({ id, action, payload });
        });
    }

    async function start(options = {}) {
        checkSignal();
        clearIdle();
        if (worker && !initializing) return;
        if (initializing) return initializing;
        initializing = (async () => {
            if (typeof Worker !== "function") throw new Error("В этом Obsidian недоступны Web Workers");
            const previous = activeOwners.get(adapter);
            if (previous && previous !== owner) previous.stop(abortError("Загружается другая сюжетная модель"));
            activeOwners.set(adapter, owner);
            const startingGeneration = generation;
            const checkGeneration = () => {
                checkSignal();
                if (generation !== startingGeneration || activeOwners.get(adapter) !== owner) throw abortError("Загрузка модели прервана");
            };
            emit({ phase: "loading", modelKey, message: "Загрузка локальной модели сюжета: " + selectedModel.label });
            const manifest = JSON.parse(await adapter.read(runtimeRoot + "/manifest.json"));
            checkGeneration();
            const installedModel = manifest.models?.find(item => item.key === modelKey) || (manifest.model?.key === modelKey ? manifest.model : null);
            if (!installedModel || ["id", "revision", "dtype", "dimensions", "libraryVersion", "onnxVersion", "maxTokens", "prefix", "pooling", "normalize"].some(key => installedModel[key] !== selectedModel[key])) throw new Error("Версии локальной модели и библиотек не совпадают: " + selectedModel.label);
            const [source, library, wasmModule] = await Promise.all([
                adapter.read(workerPath),
                adapter.read(runtimeRoot + "/transformers/transformers.min.js"),
                adapter.read(runtimeRoot + "/onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs"),
            ]);
            checkGeneration();
            const libraryUrl = blobUrl(library);
            const wasmModuleUrl = blobUrl(wasmModule);
            const currentWorker = new Worker(blobUrl(source), { type: "module", name: "kino-semantic" });
            worker = currentWorker;
            currentWorker.onerror = event => stop(new Error("Ошибка локальной модели: " + (event.message || "Web Worker")));
            currentWorker.onmessageerror = () => stop(new Error("Не удалось передать данные локальной модели"));
            currentWorker.onmessage = async event => {
                if (worker !== currentWorker) return;
                const message = event.data || {};
                if (message.type === "fatal") { stop(new Error(message.error)); return; }
                if (message.type === "asset") {
                    try {
                        const path = String(message.path || "");
                        if (!path || path.includes("..") || path.startsWith("/") || path.includes("\\") || !manifest.files.some(item => item.path === path)) throw new Error("Файл модели отсутствует в манифесте: " + path);
                        const raw = await adapter.readBinary(runtimeRoot + "/" + path);
                        const buffer = raw instanceof ArrayBuffer ? raw : raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
                        const expected = manifest.files.find(item => item.path === path);
                        if (buffer.byteLength !== expected.bytes) throw new Error("Файл модели повреждён или не синхронизирован: " + path);
                        if (worker === currentWorker) currentWorker.postMessage({ type: "asset-result", id: message.id, buffer }, [buffer]);
                    } catch (error) {
                        emit({ phase: "asset-error", modelKey, path: String(message.path || ""), message: String(error.message || error) });
                        if (worker === currentWorker) currentWorker.postMessage({ type: "asset-result", id: message.id, error: String(error.message || error) });
                    }
                    return;
                }
                const request = pending.get(message.id);
                if (!request) return;
                if (message.type === "progress") {
                    request.resetTimeout();
                    emit(message.progress);
                    try {
                        request.onCallProgress?.(message.progress);
                        if (request.shouldCancel?.()) stop(abortError());
                    } catch (error) { stop(error); }
                } else if (message.type === "result") {
                    pending.delete(message.id);
                    clearTimeout(request.timer);
                    if (message.error) {
                        const error = new Error(message.error.message);
                        error.name = message.error.name;
                        if (message.error.stack) error.stack = message.error.stack;
                        request.reject(error);
                    } else request.resolve(message.result);
                }
            };
            const info = await call("init", { model: selectedModel, libraryUrl, wasmModuleUrl }, options.onProgress, options.shouldCancel);
            emit({ phase: "ready", model: info.model, threads: info.threads, offline: true });
        })();
        try { await initializing; }
        catch (error) { stop(error); throw error; }
        finally { initializing = null; }
    }

    const onAbort = () => stop(abortError(), true);
    signal?.addEventListener("abort", onAbort, { once: true });
    return {
        model: selectedModel,
        async embed(texts, options = {}) {
            if (!Array.isArray(texts)) throw new TypeError("embed ожидает массив описаний");
            const operation = serial.catch(() => {}).then(async () => {
                checkSignal();
                if (options.shouldCancel?.()) throw abortError();
                if (!texts.length) return [];
                await start(options);
                checkSignal();
                if (options.shouldCancel?.()) { stop(abortError()); throw abortError(); }
                try { return await call("embed", { texts }, options.onProgress, options.shouldCancel); }
                catch (error) { stop(error); throw error; }
                finally { armIdle(); }
            });
            serial = operation;
            return operation;
        },
        dispose() {
            signal?.removeEventListener("abort", onAbort);
            stop(abortError("Сюжетная модель закрыта"), true);
        },
    };
}

module.exports = { create, MODEL, MODELS };
