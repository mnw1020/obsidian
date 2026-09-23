#!/usr/bin/env python3
"""
Builds a compact MovieLens neighbor model for Кино/_system/predict_rating.js.

Usage (from anywhere):
  python build_movielens_model.py
  python build_movielens_model.py --movielens D:\\Downloads\\ml-32m.zip

If --movielens is omitted, ml-32m.zip is downloaded from GroupLens.
The resulting JSON stays in the vault and the QuickAdd predictor recalculates
similarity against the CURRENT ratings every time it is run, so films and
ratings added later are picked up automatically.
"""
from __future__ import annotations
import argparse, csv, io, json, math, os, re, shutil, subprocess, sys, urllib.error, urllib.request, zipfile
from pathlib import Path
from heapq import nlargest

URL = "https://files.grouplens.org/datasets/movielens/ml-32m.zip"
CANDIDATES = 1400
MIN_OVERLAP = 7
SHRINK = 16.0

HERE = Path(__file__).resolve().parent
KINO = HERE.parent
OUTDIR = HERE / "Прогноз"
DEFAULT_ZIP = OUTDIR / "ml-32m.zip"
OUT = OUTDIR / "movielens_neighbors.json"


def dequote(s: str) -> str:
    s = s.strip()
    if len(s) >= 2 and s[0] == s[-1] and s[0] in "\"'":
        s = s[1:-1]
    return s.strip()


def frontmatter_text(path: Path) -> str:
    try:
        text = path.read_text("utf-8-sig", errors="replace")
    except OSError:
        return ""
    m = re.match(r"^---\s*\r?\n(.*?)\r?\n---\s*(?:\r?\n|$)", text, re.S)
    return m.group(1) if m else ""


def field(fm: str, key: str) -> str:
    m = re.search(rf"(?m)^{re.escape(key)}\s*:\s*(.*?)\s*$", fm)
    return dequote(m.group(1)) if m else ""


def norm_imdb(v: str) -> str:
    m = re.search(r"tt\s*0*(\d+)", v or "", re.I) or re.search(r"(\d+)", v or "")
    if not m:
        return ""
    return "tt" + str(int(m.group(1))).zfill(7)


def read_user_ratings() -> dict[str, float]:
    out = {}
    for p in KINO.glob("*.md"):
        fm = frontmatter_text(p)
        if not fm:
            continue
        if not re.search(r"(?m)^\s*-\s*(movies|serial)\s*$", fm) and not re.search(r"(?m)^tags\s*:\s*.*\b(movies|serial)\b", fm):
            continue
        iid = norm_imdb(field(fm, "imdb Id"))
        rs = field(fm, "Оценка")
        try:
            r = float(rs.replace(",", "."))
        except Exception:
            continue
        if iid and 1 <= r <= 10:
            out[iid] = r
    return out


def _validate_movielens_zip(path: Path) -> None:
    if not path.exists() or path.stat().st_size < 10_000_000:
        raise RuntimeError("Downloaded file is missing or too small to be MovieLens 32M.")
    try:
        with zipfile.ZipFile(path) as z:
            names = z.namelist()
            if not any(n.endswith("ratings.csv") for n in names) or not any(n.endswith("links.csv") for n in names):
                raise RuntimeError("Downloaded ZIP does not contain ratings.csv and links.csv.")
            bad = z.testzip()
            if bad:
                raise RuntimeError(f"Downloaded ZIP is corrupt (first bad member: {bad}).")
    except zipfile.BadZipFile as e:
        raise RuntimeError("Downloaded file is not a valid ZIP archive.") from e


def _download_urllib(tmp: Path) -> None:
    req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 MovieLensModelBuilder/1.1"})
    with urllib.request.urlopen(req, timeout=60) as r, open(tmp, "wb") as f:
        total = int(r.headers.get("Content-Length") or 0)
        done = 0
        while True:
            chunk = r.read(1024 * 1024)
            if not chunk:
                break
            f.write(chunk)
            done += len(chunk)
            if total:
                print(f"\r{done*100/total:5.1f}%", end="", flush=True)
    if total:
        print()


def _download_windows(tmp: Path) -> None:
    # Prefer curl.exe on Windows: it normally uses the Windows certificate store,
    # which avoids Python installations whose CA bundle is incomplete.
    curl = shutil.which("curl.exe") or shutil.which("curl")
    if curl:
        print("Retrying with Windows curl.exe (system certificate store)...")
        cmd = [curl, "-L", "--fail", "--retry", "3", "--retry-delay", "2", "--progress-bar", "-o", str(tmp), URL]
        cp = subprocess.run(cmd)
        if cp.returncode == 0:
            return
        print(f"curl.exe failed with exit code {cp.returncode}.")
        try:
            tmp.unlink(missing_ok=True)
        except Exception:
            pass

    powershell = shutil.which("powershell.exe") or shutil.which("powershell")
    if powershell:
        print("Retrying with Windows PowerShell (system certificate store)...")
        # Literal paths/URL are quoted for PowerShell by doubling apostrophes.
        out = str(tmp).replace("'", "''")
        url = URL.replace("'", "''")
        script = (
            "$ProgressPreference='SilentlyContinue'; "
            f"Invoke-WebRequest -UseBasicParsing -Uri '{url}' -OutFile '{out}'"
        )
        cp = subprocess.run([powershell, "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script])
        if cp.returncode == 0:
            return
        print(f"PowerShell download failed with exit code {cp.returncode}.")
        try:
            tmp.unlink(missing_ok=True)
        except Exception:
            pass

    raise RuntimeError(
        "Automatic download failed. Download ml-32m.zip manually from:\n"
        f"  {URL}\n"
        "and put it here:\n"
        f"  {DEFAULT_ZIP}\n"
        "Then run this builder again."
    )


def ensure_dataset(path: Path) -> Path:
    if path.exists():
        _validate_movielens_zip(path)
        return path

    path.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading MovieLens 32M -> {path}")
    print("This is about 228 MB and is needed only when rebuilding the collaborative model.")
    tmp = path.with_suffix(path.suffix + ".part")
    try:
        tmp.unlink(missing_ok=True)
    except Exception:
        pass

    try:
        _download_urllib(tmp)
    except Exception as e:
        print(f"Python HTTPS download failed: {e}")
        try:
            tmp.unlink(missing_ok=True)
        except Exception:
            pass
        _download_windows(tmp)

    _validate_movielens_zip(tmp)
    tmp.replace(path)
    return path


def zip_member(z: zipfile.ZipFile, suffix: str) -> str:
    for n in z.namelist():
        if n.endswith(suffix):
            return n
    raise RuntimeError(f"{suffix} not found in MovieLens zip")


def imdb_from_numeric(v: str) -> str:
    try:
        return "tt" + str(int(v)).zfill(7)
    except Exception:
        return ""


def pearson_stat(st):
    n,sx,sy,sxx,syy,sxy = st
    if n < MIN_OVERLAP:
        return None
    num = sxy - sx*sy/n
    vx = sxx - sx*sx/n
    vy = syy - sy*sy/n
    if vx <= 1e-12 or vy <= 1e-12:
        return None
    corr = num / math.sqrt(vx*vy)
    adjusted = corr * n/(n+SHRINK)
    return corr, adjusted


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--movielens", type=Path, default=None, help="Path to ml-32m.zip")
    ap.add_argument("--candidates", type=int, default=CANDIDATES)
    args = ap.parse_args()

    ratings = read_user_ratings()
    if len(ratings) < 30:
        raise SystemExit(f"Only {len(ratings)} personal IMDb-linked ratings found; need at least 30.")
    print(f"Personal IMDb-linked ratings: {len(ratings)}")

    zpath = ensure_dataset(args.movielens or DEFAULT_ZIP)
    OUTDIR.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(zpath) as z:
        links_name = zip_member(z, "links.csv")
        ratings_name = zip_member(z, "ratings.csv")

        ml_to_imdb = {}
        imdb_to_ml = {}
        with z.open(links_name) as raw:
            rd = csv.DictReader(io.TextIOWrapper(raw, "utf-8", newline=""))
            for row in rd:
                iid = imdb_from_numeric(row.get("imdbId", ""))
                if not iid:
                    continue
                mid = int(row["movieId"])
                ml_to_imdb[mid] = iid
                imdb_to_ml[iid] = mid

        personal_by_mid = {imdb_to_ml[iid]: r for iid,r in ratings.items() if iid in imdb_to_ml}
        print(f"Matched to MovieLens: {len(personal_by_mid)} / {len(ratings)}")
        if len(personal_by_mid) < 20:
            raise SystemExit("Too few MovieLens matches to build collaborative model.")

        stats = {}
        print("Pass 1/2: finding taste-neighbor candidates...")
        with z.open(ratings_name) as raw:
            rd = csv.reader(io.TextIOWrapper(raw, "utf-8", newline=""))
            next(rd, None)
            for row in rd:
                mid = int(row[1])
                ur10 = personal_by_mid.get(mid)
                if ur10 is None:
                    continue
                uid = int(row[0]); y = float(row[2]); x = ur10/2.0
                st = stats.get(uid)
                if st is None:
                    st = [0,0.0,0.0,0.0,0.0,0.0]; stats[uid]=st
                st[0]+=1; st[1]+=x; st[2]+=y; st[3]+=x*x; st[4]+=y*y; st[5]+=x*y

        ranked=[]
        for uid,st in stats.items():
            ps=pearson_stat(st)
            if ps is None:
                continue
            corr,adjusted=ps
            if adjusted > 0.02:
                ranked.append((adjusted, corr, st[0], uid))
        ranked=nlargest(args.candidates, ranked)
        selected={uid:(adj,corr,n) for adj,corr,n,uid in ranked}
        print(f"Candidate neighbors: {len(selected)}")
        if not selected:
            raise SystemExit("No suitable taste-neighbors found.")

        data={uid:[] for uid in selected}
        sums={uid:[0.0,0] for uid in selected}
        print("Pass 2/2: collecting candidate-neighbor ratings...")
        with z.open(ratings_name) as raw:
            rd = csv.reader(io.TextIOWrapper(raw, "utf-8", newline=""))
            next(rd, None)
            for row in rd:
                uid=int(row[0])
                if uid not in selected:
                    continue
                mid=int(row[1]); iid=ml_to_imdb.get(mid)
                if not iid:
                    continue
                r10=float(row[2])*2.0
                data[uid].append([iid, r10])
                sums[uid][0]+=r10; sums[uid][1]+=1

    users=[]
    for uid,(adj,corr,n) in sorted(selected.items(), key=lambda kv: kv[1][0], reverse=True):
        pairs=data.get(uid,[])
        if not pairs:
            continue
        sm,cnt=sums[uid]
        users.append({
            "id": uid,
            "seed_similarity": round(adj,6),
            "seed_corr": round(corr,6),
            "seed_overlap": n,
            "mean": round(sm/cnt,5),
            "ratings": pairs,
        })

    payload={
        "version": 1,
        "source": "MovieLens 32M",
        "source_url": URL,
        "personal_ratings_at_build": len(ratings),
        "personal_movielens_matches_at_build": len(personal_by_mid),
        "users": users,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), "utf-8")
    mb=OUT.stat().st_size/1024/1024
    print(f"Done: {OUT} ({mb:.1f} MB, {len(users)} candidate users)")
    print("The predictor can now use MovieLens. New vault cards are still scanned automatically on every run.")

if __name__ == "__main__":
    main()
