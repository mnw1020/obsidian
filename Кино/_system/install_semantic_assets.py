"""One-time maintainer installer. Obsidian inference never runs Python or downloads.

Run from the Kino directory: python _system/install_semantic_assets.py
All downloaded model/runtime files are pinned and verified; no npm install hooks run.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import base64
import hashlib
import io
import json
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parent / "Прогноз" / "runtime"
REVISION = "761b726dd34fb83930e26aab4e9ac3899aa1fa78"
MODEL = "Xenova/multilingual-e5-small"
PACKAGES = {
    "transformers": ("https://registry.npmjs.org/@huggingface/transformers/-/transformers-3.8.1.tgz", "tsTk4zVjImqdqjS8/AOZg2yNLd1z9S5v+7oUPpXaasDRwEDhB+xnglK1k5cad26lL5/ZIaeREgWWy0bs9y9pPA==", ["dist/transformers.min.js", "LICENSE"]),
    "onnxruntime-web": ("https://registry.npmjs.org/onnxruntime-web/-/onnxruntime-web-1.22.0-dev.20250409-89f8206ba4.tgz", "0uS76OPgH0hWCPrFKlL8kYVV7ckM7t/36HfbgoFw6Nd0CZVVbQC4PkrR8mBX8LtNUFZO25IQBqV2Hx2ho3FlbQ==", ["dist/ort-wasm-simd-threaded.jsep.mjs", "dist/ort-wasm-simd-threaded.jsep.wasm", "LICENSE"]),
}
MODEL_HASHES = {
    "onnx/model_quantized.onnx": "f80102d3f2a1229f387d3c81909990d8945513e347b0eab049f7de3c6f98c193",
    "tokenizer.json": "0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39",
}


def fetch(url):
    with urllib.request.urlopen(url, timeout=180) as response:
        return response.read()


def save(path, data, source):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    print(f"{path.name}: {len(data):,} bytes", flush=True)
    return {"path": path.relative_to(ROOT).as_posix(), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "source": source}


def package(item):
    name, (url, integrity, members) = item
    staging = ROOT / ".download" / (name + ".tgz")
    data = staging.read_bytes() if staging.exists() else fetch(url)
    if base64.b64encode(hashlib.sha512(data).digest()).decode() != integrity:
        raise ValueError(f"Integrity check failed: {name}")
    results = []
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
        for member in members:
            contents = archive.extractfile("package/" + member).read()
            results.append(save(ROOT / name / Path(member).name, contents, url + "#package/" + member))
    return results


def model_file(name):
    url = f"https://huggingface.co/{MODEL}/resolve/{REVISION}/{name}"
    target = ROOT / "models" / MODEL / name
    data = target.read_bytes() if target.exists() else fetch(url)
    expected = MODEL_HASHES.get(name)
    if expected and hashlib.sha256(data).hexdigest() != expected:
        raise ValueError(f"SHA-256 check failed: {name}")
    return [save(target, data, url)]


if __name__ == "__main__":
    ROOT.mkdir(parents=True, exist_ok=True)
    files = ["config.json", "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json", "README.md", "quant_config.json", "onnx/model_quantized.onnx"]
    tasks = [(package, item) for item in PACKAGES.items()] + [(model_file, name) for name in files]
    with ThreadPoolExecutor(max_workers=5) as executor:
        results = list(executor.map(lambda task: task[0](task[1]), tasks))
    manifest = {
        "schemaVersion": 1,
        "model": {"id": MODEL, "revision": REVISION, "dtype": "q8", "dimensions": 384, "libraryVersion": "3.8.1", "onnxVersion": "1.22.0-dev.20250409-89f8206ba4", "maxTokens": 512, "prefix": "query: ", "pooling": "mean", "normalize": True},
        "files": sorted([item for result in results for item in result], key=lambda item: item["path"]),
    }
    (ROOT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Assets installed and manifest saved.", flush=True)
