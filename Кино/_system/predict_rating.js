/*
QuickAdd user script: personal rating forecast for the active movie/series card.
Works with the user's current Kino vault structure and automatically includes cards added later.
*/
module.exports = async (params) => {
    const { app, obsidian } = params;
    const { Notice } = obsidian;

    const ROOT = "Кино";
    const K_LOCAL = 55;
    const MIN_SIM = 0.055;

    const asText = v => {
        if (v === null || v === undefined) return "";
        if (typeof v?.toISODate === "function") return v.toISODate();
        return String(v).trim();
    };
    const list = v => {
        if (v === null || v === undefined || v === "") return [];
        return (Array.isArray(v) ? v : [v]).map(asText).filter(Boolean);
    };
    const num = v => {
        if (v === null || v === undefined || asText(v) === "") return null;
        const m = asText(v).replace(",", ".").match(/-?\d+(?:\.\d+)?/);
        if (!m) return null;
        const n = Number(m[0]);
        return Number.isFinite(n) ? n : null;
    };
    const year = v => {
        const m = asText(v).match(/(?:19|20)\d{2}/);
        return m ? Number(m[0]) : null;
    };
    const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
    const mean = a => a.length ? a.reduce((s,x)=>s+x,0) / a.length : null;
    const normalizeImdb = v => {
        const s = asText(v).toLowerCase();
        const m = s.match(/tt\s*0*(\d+)/i) || s.match(/(\d+)/);
        if (!m) return "";
        const digits = String(Number(m[1]));
        return "tt" + digits.padStart(7, "0");
    };
    const getFm = file => app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    const tags = fm => list(fm?.tags).map(x => x.replace(/^#/, ""));
    const isRootCard = file => file?.extension === "md" && file.path.startsWith(`${ROOT}/`) && !file.path.slice(ROOT.length + 1).includes("/");
    const isMedia = file => {
        if (!isRootCard(file)) return false;
        const t = tags(getFm(file));
        return t.includes("movies") || t.includes("serial");
    };
    const linkTarget = v => {
        const s = asText(v);
        const m = s.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
        return (m ? m[1] : s).replace(/\.md$/i, "");
    };
    const setCos = (a,b) => {
        if (!a.size || !b.size) return 0;
        let inter = 0;
        const small = a.size <= b.size ? a : b;
        const big = a.size <= b.size ? b : a;
        for (const x of small) if (big.has(x)) inter++;
        return inter / Math.sqrt(a.size * b.size);
    };
    const normKey = s => asText(s).toLocaleLowerCase("ru").replace(/ё/g,"е").replace(/[‐‑‒–—―]/g,"-").replace(/[^\p{L}\p{N}]+/gu," ").trim();
    const STOP = new Set(("и в во не что он на я с со как а то все она так его но да ты к у же вы за бы по только ее мне было вот от меня еще нет о из ему теперь когда даже ну вдруг ли если уже или ни быть был него до вас нибудь опять уж вам ведь там потом себя ничего ей может они тут где есть надо ней для мы тебя их чем была сам чтоб без будто чего раз тоже себе под будет ж тогда кто этот того потому этого какой совсем ним здесь этом один почти мой тем чтобы нее сейчас были куда зачем сказать всех никогда сегодня можно при наконец два об другой хоть после над больше тот через эти нас про всего них какая много разве три эту моя впрочем хорошо свою этой перед иногда лучше чуть том нельзя такой им более всегда конечно всю между the and of to a in is it for on with as by this that from an be are was were or at movie film series").split(/\s+/));
    const tokens = text => normKey(text).split(/\s+/).filter(x => x.length >= 3 && !STOP.has(x) && !/^\d+$/.test(x));

    async function roleActors(fm, sourcePath) {
        const target = linkTarget(fm?.["Роли файл"]);
        if (!target) return [];
        let f = null;
        try { f = app.metadataCache.getFirstLinkpathDest(target, sourcePath); } catch (_) {}
        if (!f) f = app.vault.getAbstractFileByPath(target) || app.vault.getAbstractFileByPath(target + ".md");
        if (!f || f.extension !== "md") return [];
        const rfm = getFm(f);
        return list(rfm?.["Актеры"]);
    }

    async function buildFeature(file) {
        const fm = getFm(file);
        const t = tags(fm);
        const actors = await roleActors(fm, file.path);
        const imdb = num(fm?.["Оценка Imdb"]);
        const kp = num(fm?.["Оценка Кинопоиск"]);
        const publicVals = [imdb,kp].filter(x => x !== null && x >= 0 && x <= 10);
        return {
            file, fm,
            rating: num(fm?.["Оценка"]),
            imdbId: normalizeImdb(fm?.["imdb Id"]),
            genres: new Set(list(fm?.["Жанр"]).map(normKey).filter(Boolean)),
            directors: new Set(list(fm?.["Режисер"]).map(normKey).filter(Boolean)),
            actors: new Set(actors.slice(0, 60).map(normKey).filter(Boolean)),
            type: t.includes("serial") ? "serial" : "movies",
            franchise: normKey(linkTarget(fm?.["Франшиза"])),
            releaseYear: year(fm?.["Релиз"]),
            duration: num(fm?.["Время"]),
            imdb, kp,
            publicMean: mean(publicVals),
            votes: (num(fm?.["Количество голосов Imdb"]) || 0) + (num(fm?.["Количество голосов Кинопоиск"]) || 0),
            descTokens: tokens(fm?.["Описание"] || "")
        };
    }

    function fitPublicCalibration(items) {
        const pairs = items.filter(x => x.rating !== null && x.publicMean !== null).map(x => [x.publicMean, x.rating]);
        if (pairs.length < 20) return {a: mean(items.map(x=>x.rating).filter(x=>x!==null)) || 6, b:0};
        const mx = mean(pairs.map(p=>p[0])), my = mean(pairs.map(p=>p[1]));
        let cov=0, vx=0;
        for (const [x,y] of pairs) { cov += (x-mx)*(y-my); vx += (x-mx)*(x-mx); }
        let b = vx > 1e-9 ? cov/vx : 0;
        b = clamp(b, -0.25, 1.35);
        return {a: my-b*mx, b};
    }

    function baseline(item, calibration, globalMean) {
        if (item.publicMean !== null) return clamp(calibration.a + calibration.b*item.publicMean, 1, 10);
        return globalMean;
    }

    function buildIdf(items) {
        const df = new Map();
        for (const item of items) {
            const uniq = new Set(item.descTokens);
            for (const w of uniq) df.set(w, (df.get(w)||0)+1);
        }
        const N = items.length;
        const idf = new Map();
        for (const [w,n] of df) idf.set(w, Math.log((N+1)/(n+1))+1);
        return idf;
    }
    function tfidfMap(item,idf) {
        const tf=new Map();
        for(const w of item.descTokens) tf.set(w,(tf.get(w)||0)+1);
        let norm=0;
        for(const [w,c] of tf){ const v=(1+Math.log(c))*(idf.get(w)||0); tf.set(w,v); norm+=v*v; }
        norm=Math.sqrt(norm)||1;
        for(const [w,v] of tf) tf.set(w,v/norm);
        return tf;
    }
    function sparseCos(a,b){
        if(!a.size||!b.size)return 0;
        const small=a.size<=b.size?a:b,big=a.size<=b.size?b:a;
        let s=0; for(const [k,v] of small){const w=big.get(k); if(w!==undefined)s+=v*w;} return s;
    }

    function metadataSimilarity(a,b,avec,bvec) {
        let score=0, weight=0;
        const add=(w,s)=>{ if(Number.isFinite(s)){ score+=w*clamp(s,0,1); weight+=w; } };
        add(0.19, setCos(a.genres,b.genres));
        add(0.13, setCos(a.directors,b.directors));
        add(0.15, setCos(a.actors,b.actors));
        add(0.25, sparseCos(avec,bvec));
        if (a.releaseYear!==null && b.releaseYear!==null) add(0.05, Math.exp(-Math.abs(a.releaseYear-b.releaseYear)/11));
        if (a.duration!==null && b.duration!==null) add(0.035, Math.exp(-Math.abs(a.duration-b.duration)/45));
        if (a.publicMean!==null && b.publicMean!==null) add(0.10, 1-Math.abs(a.publicMean-b.publicMean)/7);
        add(0.045, a.type===b.type ? 1 : 0);
        if (a.franchise && b.franchise) add(0.08, a.franchise===b.franchise ? 1 : 0);
        return weight ? score/weight : 0;
    }

    async function localPrediction(target, rated) {
        const allForIdf = [...rated, target];
        const idf=buildIdf(allForIdf);
        const targetVec=tfidfMap(target,idf);
        const calibration=fitPublicCalibration(rated);
        const globalMean=mean(rated.map(x=>x.rating)) || 6;
        const targetBase=baseline(target,calibration,globalMean);
        const candidates=[];
        for(const item of rated){
            const sim=metadataSimilarity(target,item,targetVec,tfidfMap(item,idf));
            if(sim<MIN_SIM) continue;
            const itemBase=baseline(item,calibration,globalMean);
            candidates.push({item,sim,resid:item.rating-itemBase});
        }
        candidates.sort((x,y)=>y.sim-x.sim);
        const top=candidates.slice(0,K_LOCAL);
        let sw=0,sr=0;
        for(const x of top){ const w=Math.pow(x.sim,3); sw+=w; sr+=w*x.resid; }
        const correction=sw>1e-9 ? sr/sw : 0;
        const pred=clamp(targetBase+correction,1,10);
        const topMean=top.length ? mean(top.slice(0,10).map(x=>x.sim)) : 0;
        const conf=clamp((top.length/35)*0.5 + topMean*0.7,0,1);
        return {pred,base:targetBase,correction,confidence:conf,neighbors:top};
    }

    function confidenceText(x){ return x>=0.72?"высокая":x>=0.46?"средняя":"низкая"; }

    const active=params?.targetFile || app.workspace.getActiveFile();
    if(!active || !isMedia(active)) {
        if(!params?.suppressNotice) new Notice("Открой основную карточку фильма или сериала в папке Кино.",7000);
        return null;
    }

    const files=app.vault.getMarkdownFiles().filter(isMedia);
    const items=[];
    for(const f of files) items.push(await buildFeature(f));
    const target=items.find(x=>x.file.path===active.path);
    if(!target){
        if(!params?.suppressNotice) new Notice("Не удалось прочитать карточку.",7000);
        return null;
    }
    const rated=items.filter(x=>x.file.path!==active.path && x.rating!==null && x.rating>=1 && x.rating<=10);
    if(rated.length<30){
        if(!params?.suppressNotice) new Notice("Для прогноза пока слишком мало твоих оценок.",7000);
        return null;
    }

    const local=await localPrediction(target,rated);
    const finalPred=Math.round(local.pred*10)/10;

    await app.fileManager.processFrontMatter(active, fm => {
        fm["Прогноз оценки"] = finalPred.toFixed(1);
    });
    if (!params?.suppressNotice) new Notice(`Прогноз: ${finalPred.toFixed(1)}/10.`, 9000);
    return {prediction: finalPred, real: target.rating};
};
