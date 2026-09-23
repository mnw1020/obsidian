/*
QuickAdd user script: bulk personal rating forecast for ALL movie/series cards.
Writes forecast YAML properties to every root card in Кино/.
Does NOT overwrite the user's real field "Оценка".
Automatically includes cards added later: just run this script again.
Optional collaborative layer: Кино/_system/Прогноз/movielens_neighbors.json
*/
module.exports = async (params) => {
    const { app, obsidian } = params;
    const { Notice } = obsidian;

    const ROOT = "Кино";
    const MODEL_PATH = `${ROOT}/_system/Прогноз/movielens_neighbors.json`;
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
        return list(getFm(f)?.["Актеры"]);
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

    // Regression summaries allow exact leave-one-out calibration without rebuilding the whole model for every rated film.
    function calibrationSummary(rated) {
        let n=0,sx=0,sy=0,sxx=0,sxy=0;
        let ratingN=0,ratingSum=0;
        for(const x of rated){
            ratingN++; ratingSum+=x.rating;
            if(x.publicMean===null) continue;
            const px=x.publicMean, py=x.rating;
            n++; sx+=px; sy+=py; sxx+=px*px; sxy+=px*py;
        }
        return {n,sx,sy,sxx,sxy,ratingN,ratingSum};
    }
    function calibrationForTarget(summary,target){
        let {n,sx,sy,sxx,sxy,ratingN,ratingSum}=summary;
        const excludeReal = target.rating!==null && target.rating>=1 && target.rating<=10;
        if(excludeReal){
            ratingN--; ratingSum-=target.rating;
            if(target.publicMean!==null){
                const x=target.publicMean,y=target.rating;
                n--; sx-=x; sy-=y; sxx-=x*x; sxy-=x*y;
            }
        }
        const globalMean=ratingN>0 ? ratingSum/ratingN : 6;
        if(n<20) return {cal:{a:globalMean,b:0},globalMean};
        const mx=sx/n,my=sy/n;
        const cov=sxy-n*mx*my;
        const vx=sxx-n*mx*mx;
        let b=vx>1e-9?cov/vx:0;
        b=clamp(b,-0.25,1.35);
        return {cal:{a:my-b*mx,b},globalMean};
    }
    function baseline(item,calibration,globalMean){
        if(item.publicMean!==null) return clamp(calibration.a+calibration.b*item.publicMean,1,10);
        return globalMean;
    }

    function localPrediction(target,ratedAll,vectors,summary){
        const {cal,globalMean}=calibrationForTarget(summary,target);
        const targetBase=baseline(target,cal,globalMean);
        const targetVec=vectors.get(target.file.path) || new Map();
        const candidates=[];
        for(const item of ratedAll){
            if(item.file.path===target.file.path) continue;
            const sim=metadataSimilarity(target,item,targetVec,vectors.get(item.file.path) || new Map());
            if(sim<MIN_SIM) continue;
            const itemBase=baseline(item,cal,globalMean);
            candidates.push({item,sim,resid:item.rating-itemBase});
        }
        candidates.sort((x,y)=>y.sim-x.sim);
        const top=candidates.slice(0,K_LOCAL);
        let sw=0,sr=0;
        for(const x of top){ const w=Math.pow(x.sim,3); sw+=w; sr+=w*x.resid; }
        const correction=sw>1e-9?sr/sw:0;
        const pred=clamp(targetBase+correction,1,10);
        const topMean=top.length?mean(top.slice(0,10).map(x=>x.sim)):0;
        const conf=clamp((top.length/35)*0.5+topMean*0.7,0,1);
        return {pred,confidence:conf};
    }

    async function loadCollaborativeModel(){
        const f=app.vault.getAbstractFileByPath(MODEL_PATH);
        if(!f) return null;
        try{return JSON.parse(await app.vault.read(f));}catch(_){return null;}
    }

    function buildCollaborativeCache(ratedAll,model){
        if(!model || !Array.isArray(model.users)) return null;
        const personal=new Map(ratedAll.filter(x=>x.imdbId).map(x=>[x.imdbId,x.rating]));
        const targetIndex=new Map();
        const users=[];
        for(const u of model.users){
            let n=0,sx=0,sy=0,sxx=0,syy=0,sxy=0;
            const clean=[];
            for(const p of (u.ratings||[])){
                const id=p[0], y=Number(p[1]);
                if(!id || !Number.isFinite(y)) continue;
                clean.push([id,y]);
                if(!targetIndex.has(id)) targetIndex.set(id,[]);
                targetIndex.get(id).push({idx:users.length,r:y});
                const x=personal.get(id);
                if(Number.isFinite(x)){
                    n++; sx+=x; sy+=y; sxx+=x*x; syy+=y*y; sxy+=x*y;
                }
            }
            users.push({
                mean:Number.isFinite(Number(u.mean))?Number(u.mean):(mean(clean.map(p=>p[1]))||6),
                n,sx,sy,sxx,syy,sxy
            });
        }
        return {personal,targetIndex,users};
    }

    function pearsonFromStats(st,excludeX=null,excludeY=null){
        let {n,sx,sy,sxx,syy,sxy}=st;
        if(Number.isFinite(excludeX) && Number.isFinite(excludeY)){
            n--; sx-=excludeX; sy-=excludeY; sxx-=excludeX*excludeX; syy-=excludeY*excludeY; sxy-=excludeX*excludeY;
        }
        if(n<4) return {n,corr:0,weight:0};
        const nume=sxy-(sx*sy/n);
        const vx=sxx-(sx*sx/n), vy=syy-(sy*sy/n);
        const corr=(vx>1e-9&&vy>1e-9)?nume/Math.sqrt(vx*vy):0;
        const shrink=n/(n+12);
        return {n,corr,weight:corr*shrink};
    }

    function collaborativePrediction(target,ratedAll,cache,summary){
        if(!cache || !target.imdbId) return null;
        const refs=cache.targetIndex.get(target.imdbId);
        if(!refs || !refs.length) return null;
        const excludeReal=target.rating!==null && target.rating>=1 && target.rating<=10;
        const ratingN=summary.ratingN-(excludeReal?1:0);
        const ratingSum=summary.ratingSum-(excludeReal?target.rating:0);
        const userMean=ratingN>0?ratingSum/ratingN:6;
        let nume=0,den=0,count=0,overlapTotal=0;
        for(const ref of refs){
            const u=cache.users[ref.idx];
            const sim=pearsonFromStats(u,excludeReal?target.rating:null,excludeReal?ref.r:null);
            if(sim.n<4 || sim.weight<=0.02) continue;
            const centered=ref.r-u.mean;
            nume+=sim.weight*centered;
            den+=Math.abs(sim.weight);
            count++; overlapTotal+=sim.n;
        }
        if(count<3 || den<0.08) return null;
        const pred=clamp(userMean+nume/den,1,10);
        const conf=clamp((Math.log1p(count)/Math.log(80))*0.65+(Math.min(40,overlapTotal/count)/40)*0.35,0,1);
        return {pred,confidence:conf,count};
    }

    function confidenceText(x){return x>=0.72?"высокая":x>=0.46?"средняя":"низкая";}
    function fixed1(x){return (Math.round(x*10)/10).toFixed(1);}

    const files=app.vault.getMarkdownFiles().filter(isMedia);
    if(!files.length){new Notice("Карточки фильмов/сериалов не найдены.",7000);return;}

    new Notice(`Прогноз: читаю ${files.length} карточек...`,5000);
    const items=[];
    for(let i=0;i<files.length;i++){
        items.push(await buildFeature(files[i]));
        if((i+1)%300===0) await new Promise(r=>setTimeout(r,0));
    }
    const ratedAll=items.filter(x=>x.rating!==null&&x.rating>=1&&x.rating<=10);
    if(ratedAll.length<30){new Notice("Для прогноза пока слишком мало твоих оценок.",7000);return;}

    // For rated targets this is exactly the same IDF corpus as the single-card script's leave-one-out + target corpus.
    // For unrated targets the difference is negligible and makes bulk calculation much faster.
    const idf=buildIdf(ratedAll);
    const vectors=new Map();
    for(const item of items) vectors.set(item.file.path,tfidfMap(item,idf));
    const summary=calibrationSummary(ratedAll);
    const model=await loadCollaborativeModel();
    const collabCache=buildCollaborativeCache(ratedAll,model);

    let updated=0,unchanged=0,withMl=0,localOnly=0,failed=0;
    new Notice(`Считаю прогнозы для ${items.length} карточек. Это может занять несколько минут...`,8000);

    for(let i=0;i<items.length;i++){
        const target=items[i];
        try{
            const local=localPrediction(target,ratedAll,vectors,summary);
            const collab=collaborativePrediction(target,ratedAll,collabCache,summary);
            let finalPred=local.pred,method="локальная интерполяция",confidence=local.confidence;
            if(collab){
                const wc=0.50+0.30*collab.confidence, wl=1-wc;
                finalPred=clamp(wc*collab.pred+wl*local.pred,1,10);
                confidence=clamp(0.55*collab.confidence+0.45*local.confidence,0,1);
                method="MovieLens + локальная интерполяция";
                withMl++;
            }else localOnly++;

            const desired={
                "Прогноз оценки":fixed1(finalPred),
                "Прогноз уверенность":confidenceText(confidence),
                "Прогноз метод":method,
                "Прогноз локальный":fixed1(local.pred),
                "Прогноз MovieLens":collab?fixed1(collab.pred):null
            };
            const fm=target.fm||{};
            const same=asText(fm["Прогноз оценки"])===desired["Прогноз оценки"] &&
                asText(fm["Прогноз уверенность"])===desired["Прогноз уверенность"] &&
                asText(fm["Прогноз метод"])===desired["Прогноз метод"] &&
                asText(fm["Прогноз локальный"])===desired["Прогноз локальный"] &&
                (desired["Прогноз MovieLens"]===null ? !asText(fm["Прогноз MovieLens"]) : asText(fm["Прогноз MovieLens"])===desired["Прогноз MovieLens"]);

            if(same){
                unchanged++;
            }else{
                await app.fileManager.processFrontMatter(target.file, frontmatter=>{
                    frontmatter["Прогноз оценки"]=desired["Прогноз оценки"];
                    frontmatter["Прогноз уверенность"]=desired["Прогноз уверенность"];
                    frontmatter["Прогноз метод"]=desired["Прогноз метод"];
                    frontmatter["Прогноз локальный"]=desired["Прогноз локальный"];
                    if(desired["Прогноз MovieLens"]!==null) frontmatter["Прогноз MovieLens"]=desired["Прогноз MovieLens"];
                    else delete frontmatter["Прогноз MovieLens"];
                });
                updated++;
            }
        }catch(e){
            failed++;
            console.error("Forecast failed:",target.file.path,e);
        }
        if((i+1)%50===0) await new Promise(r=>setTimeout(r,0));
    }

    new Notice(`Готово. Карточек: ${items.length}. Обновлено: ${updated}. Без изменений: ${unchanged}. MovieLens: ${withMl}. Только интерполяция: ${localOnly}. Ошибок: ${failed}.`,15000);
};
