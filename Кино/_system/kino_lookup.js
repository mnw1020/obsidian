/* Explicit, on-demand Kinopoisk lookup. Opening the dialog performs no search or inference. */
'use strict';
const BASE = 'Кино/_system/';
const STATE = BASE + 'Прогноз/рекомендации_state.json';
const INSTANCE = Symbol.for('kino.lookup.dialog');
const number = value => {
    if (value == null || typeof value === 'boolean' || String(value).trim() === '') return null;
    const n = Number(String(value).replace(',', '.')); return Number.isFinite(n) ? n : null;
};
const list = value => (Array.isArray(value) ? value : value == null ? [] : [value]).map(String).map(s => s.trim()).filter(Boolean);
function parseId(value) {
    const raw = String(value ?? '').trim();
    let id = /^\d{1,12}$/.test(raw) ? raw : '';
    if (!id) {
        try {
            const url = new URL(/^(?:www\.)?kinopoisk\.ru\//i.test(raw) ? 'https://' + raw : raw);
            if (!['https:', 'http:'].includes(url.protocol) || !/^(?:www\.)?kinopoisk\.ru$/i.test(url.hostname) || url.username || url.password || url.port) return null;
            id = url.pathname.match(/^\/(?:film|series)\/(\d{1,12})\/?$/)?.[1] || '';
        } catch (_) { return null; }
    }
    return id && Number(id) > 0 ? String(Number(id)) : null;
}
function parseIdentity(value) {
    const kp=parseId(value);if(kp)return {provider:'kp',id:kp};
    let raw=String(value??'').trim(),id=/^tt\d{5,12}$/i.test(raw)?raw.toLowerCase():'';
    if(!id)try{const u=new URL(/^(?:www\.)?imdb\.com\//i.test(raw)?'https://'+raw:raw);if(['http:','https:'].includes(u.protocol)&&/^(?:www\.)?imdb\.com$/i.test(u.hostname)&&!u.username&&!u.password&&!u.port)id=u.pathname.match(/^\/title\/(tt\d{5,12})\/?$/i)?.[1]?.toLowerCase()||'';}catch(_){}
    return id?{provider:'imdb',id}:null;
}
function findExisting(app,identity) {
    if(!identity)return null;
    const pending=app[Symbol.for('kino.import.created')];
    const remembered=pending?.get(identity.provider+':'+identity.id);
    if(remembered&&app.vault.getAbstractFileByPath(remembered))return app.vault.getAbstractFileByPath(remembered);
    return app.vault.getMarkdownFiles().filter(f=>/^Кино\/Media\/[^/]+\.md$/i.test(f.path)).find(f=>{
        const fm=app.metadataCache.getFileCache(f)?.frontmatter||{};
        return identity.provider==='kp'?String(fm['Кинопоиск ID']??'').replace(/^0+/,'')===identity.id:String(fm['imdb Id']||'').trim().toLowerCase()===identity.id;
    })||null;
}
const GENRES = {
    'боевик':'Action','приключения':'Adventure','мультфильм':'Animation','биография':'Biography',
    'комедия':'Comedy','криминал':'Crime','документальный':'Documentary','драма':'Drama','семейный':'Family',
    'фэнтези':'Fantasy','история':'History','ужасы':'Horror','музыка':'Music','мюзикл':'Musical',
    'детектив':'Mystery','мелодрама':'Romance','фантастика':'Sci-Fi','короткометражка':'Short',
    'спорт':'Sport','триллер':'Thriller','военный':'War','вестерн':'Western','фильм-нуар':'Film-Noir',
    'реальное тв':'Reality-TV','ток-шоу':'Talk-Show','игра':'Game-Show','новости':'News','аниме':'Animation'
};
function normalizeFilm(data, staff = [], id) {
    if (!data || typeof data !== 'object' || String(data.kinopoiskId ?? '') !== id || !(data.nameRu || data.nameOriginal || data.nameEn)) throw Error('Кинопоиск вернул неполные сведения о фильме.');
    const people = Array.isArray(staff) ? staff : [];
    const names = professions => [...new Set(people.filter(p => professions.includes(p.professionKey)).map(p => String(p.nameEn || p.nameRu || '').trim()).filter(Boolean))];
    return { kpId: id, ruTitle: String(data.nameRu || data.nameOriginal || data.nameEn), enTitle: String(data.nameOriginal || data.nameEn || ''),
        imdbId: /^tt\d+$/i.test(data.imdbId || '') ? data.imdbId.toLowerCase() : '',
        kpRating: number(data.ratingKinopoisk), imdbRating: number(data.ratingImdb),
        year: String(data.year ?? ''), duration: number(data.filmLength),
        type: data.serial === true || /^(?:TV_SERIES|MINI_SERIES|TV_SHOW)$/.test(data.type || '') ? 'series' : 'movie',
        description: String(data.description || data.shortDescription || '').trim(),
        genres: [...new Set((data.genres || []).map(g => String(g?.genre ?? g).trim()).filter(Boolean).map(g => GENRES[g.toLocaleLowerCase('ru')] || g))],
        directors: names(['DIRECTOR']), actors: names(['ACTOR','VOICE_MALE','VOICE_FEMALE','HIMSELF','HERSELF']),
        actorRoles: people.filter(p=>['ACTOR','VOICE_MALE','VOICE_FEMALE'].includes(p.professionKey)).map(p=>[p.description,p.nameEn||p.nameRu].filter(Boolean).join(' - ')),
        kpVotes:number(data.ratingKinopoiskVoteCount),imdbVotes:number(data.ratingImdbVoteCount),
        poster: String(data.posterUrlPreview || data.posterUrl || ''), franchise: '', localPath: '', personalRating: null,
        partialCredits: !Array.isArray(staff), source: 'Кинопоиск' };
}
function localFilm(app, id) {
    const matches = app.vault.getMarkdownFiles().filter(file => /^Кино\/Media\/[^/]+\.md$/i.test(file.path)).filter(file => {
        const fm = app.metadataCache.getFileCache(file)?.frontmatter || {};
        return (String(fm['Кинопоиск ID'] ?? '').trim().replace(/^0+/, '') === id || String(fm['imdb Id']||'').toLowerCase()===id) && list(fm.tags).some(t => ['movies','serial'].includes(t.replace(/^#/, '')));
    });
    matches.sort((a,b) => a.path.localeCompare(b.path, 'ru'));
    const file = matches[0]; if (!file) return null;
    const fm = app.metadataCache.getFileCache(file)?.frontmatter || {};
    const rolePath = String(fm['Роли файл'] ?? '').replace(/^\[\[|\]\]$/g, '').split('|')[0];
    const role = rolePath && (app.metadataCache.getFirstLinkpathDest?.(rolePath,file.path) || app.vault.getAbstractFileByPath(rolePath) || app.vault.getAbstractFileByPath(rolePath+'.md'));
    const roleFm = role ? app.metadataCache.getFileCache(role)?.frontmatter || {} : {};
    return {kpId:String(fm['Кинопоиск ID']||''),ruTitle:file.basename,enTitle:String(fm['Название'] || ''),imdbId:String(fm['imdb Id']||''),
        kpRating:number(fm['Оценка Кинопоиск']),imdbRating:number(fm['Оценка Imdb']),
        year:String(fm['Релиз']||'').match(/(?:18|19|20)\d{2}/)?.[0]||'',duration:number(String(fm['Время']||'').match(/\d+/)?.[0]),
        type:list(fm.tags).some(t=>t.replace(/^#/,'')==='serial')?'series':'movie',description:String(fm['Описание']||''),
        genres:list(fm['Жанр']),directors:list(fm['Режисер'] ?? fm['Режиссер']),actors:list(roleFm['Актеры'] ?? fm['Актеры']).slice(0,60),
        poster:String(fm.poster||''),franchise:String(fm['Франшиза']||''),localPath:file.path,personalRating:number(fm['Оценка']),source:'Кинотека'};
}
function abortError() { const error = Error('Действие остановлено'); error.name = 'AbortError'; return error; }
function check(signal) { if (signal?.aborted) throw abortError(); }
async function apiKey(app) {
    for (const name of ['Examples_Attachments_movies.js','recommendations.js']) {
        const file = app.vault.getAbstractFileByPath(BASE + name); if (!file) continue;
        const source = await app.vault.read(file);
        const key = source.match(/^const KP_API_KEY\s*=\s*['"]([^'"\r\n]+)['"]/m)?.[1];
        if (key) return key;
    }
    throw Error('Не найден настроенный ключ Кинопоиска.');
}
async function requestJson(obsidian, url, key, signal) {
    check(signal); if (!obsidian.requestUrl) throw Error('На этом устройстве недоступен запрос к Кинопоиску.');
    let timer, cancel;
    try {
        const response = await Promise.race([
            Promise.resolve().then(() => { check(signal); return obsidian.requestUrl({url,headers:{'X-API-KEY':key,Accept:'application/json'},throw:false}); }),
            new Promise((_,reject) => { timer=setTimeout(()=>reject(Error('Кинопоиск долго не отвечает. Попробуй ещё раз.')),20000); }),
            new Promise((_,reject) => { cancel=()=>reject(abortError());signal?.addEventListener('abort',cancel,{once:true}); })
        ]);
        check(signal);
        if (response.status === 404) throw Error('Фильм с таким ID не найден. Проверь номер.');
        if ([401,403].includes(response.status)) throw Error('Кинопоиск не принял настроенный ключ API.');
        if (response.status === 429 || response.status === 402) throw Error('Достигнут лимит Кинопоиска. Попробуй позже.');
        if (response.status < 200 || response.status >= 300) throw Error('Кинопоиск временно недоступен: HTTP ' + response.status + '.');
        return response.json ?? JSON.parse(response.text);
    } finally { clearTimeout(timer); if(cancel)signal?.removeEventListener('abort',cancel); }
}
async function resolveImdb({app,obsidian,id,signal,onProgress}) {
    onProgress({stage:'Загружаю сведения IMDb…'});
    let settings=app.plugins?.plugins?.quickadd?.settings;
    if(!settings){try{settings=JSON.parse(await app.vault.adapter.read('.obsidian/plugins/quickadd/data.json'));}catch(_){}}
    function keyIn(value,depth=0){if(depth>16||!value||typeof value!=='object')return '';if(typeof value['OMDb API Key']==='string'&&value['OMDb API Key'].trim())return value['OMDb API Key'].trim();for(const child of Object.values(value)){const key=keyIn(child,depth+1);if(key)return key;}return '';}
    const key=keyIn(settings);if(!key)throw Error('IMDb ID не найден в Кинопоиске, а ключ OMDb не настроен. Попробуй ID Кинопоиска.');
    let data;try{data=await requestJson(obsidian,'https://www.omdbapi.com/?i='+id+'&plot=full&apikey='+encodeURIComponent(key),'',signal);}catch(e){if(e.name==='AbortError')throw e;throw Error('Не удалось получить сведения IMDb. Попробуй ещё раз или введи ID Кинопоиска.');}
    if(data.Response==='False'||data.imdbID!==id)throw Error('IMDb ID не найден. Проверь идентификатор.');
    if(!['movie','series'].includes(data.Type))throw Error('Используй ID фильма или сериала целиком, а не отдельной серии.');
    const text=v=>!v||v==='N/A'?'':String(v),parts=v=>text(v).split(',').map(x=>x.trim()).filter(Boolean);
    return {kpId:'',imdbId:id,ruTitle:text(data.Title),enTitle:text(data.Title),year:text(data.Year).match(/\d{4}/)?.[0]||'',duration:number(text(data.Runtime).match(/\d+/)?.[0]),type:data.Type,description:text(data.Plot),genres:parts(data.Genre),directors:parts(data.Director),actors:parts(data.Actors),poster:text(data.Poster),imdbRating:number(data.imdbRating),imdbVotes:number(text(data.imdbVotes).replace(/,/g,'')),kpRating:null,franchise:'',localPath:'',personalRating:null,partialCredits:true,source:'IMDb'};
}
async function resolveFilm({app,obsidian={},id,identity=parseIdentity(id),type,signal,onProgress=()=>{}}) {
    check(signal);if(!identity)throw Error('Введи ID Кинопоиска или IMDb.');
    const local=localFilm(app,identity.id);if(local)return local;
    onProgress({stage:'Загружаю сведения о фильме…'});
    let key;try{key=await apiKey(app);}catch(e){if(identity.provider==='imdb')return resolveImdb({app,obsidian,id:identity.id,signal,onProgress});throw e;}check(signal);
    if(identity.provider==='imdb'){
        let found;try{found=await requestJson(obsidian,`https://kinopoiskapiunofficial.tech/api/v2.2/films?imdbId=${identity.id}&page=1`,key,signal);}catch(e){if(e.name==='AbortError')throw e;return resolveImdb({app,obsidian,id:identity.id,signal,onProgress});}
        const matches=(found.items||[]).filter(x=>String(x.imdbId||'').toLowerCase()===identity.id);
        const selected=matches.find(x=>!type||(type==='series')===/SERIES|TV_SHOW/.test(x.type||''))||matches[0];
        if(!selected)return resolveImdb({app,obsidian,id:identity.id,signal,onProgress});
        id=String(selected.kinopoiskId);
    }else id=identity.id;
    const [film,staff]=await Promise.all([
        requestJson(obsidian,`https://kinopoiskapiunofficial.tech/api/v2.2/films/${id}`,key,signal),
        requestJson(obsidian,`https://kinopoiskapiunofficial.tech/api/v1/staff?filmId=${id}`,key,signal).catch(error=>{if(error.name==='AbortError')throw error;return null;})
    ]);
    check(signal);const candidate=normalizeFilm(film,staff,id);
    if(identity.provider==='imdb'&&candidate.imdbId!==identity.id)throw Error('Источник вернул другой IMDb ID. Добавление остановлено.');
    return candidate;
}
async function openRecommendations({app,candidate,signal,sourcePath}) {
    check(signal); const page=app.vault.getAbstractFileByPath(BASE+'Рекомендации.md');
    if(!page)throw Error('Не найдена страница рекомендаций.');
    const payload={reference:candidate.localPath||(candidate.kpId?'kp:'+candidate.kpId:'imdb:'+candidate.imdbId),updatedAt:new Date().toISOString(),
        sourceSettings:{kp:Boolean(candidate.kpId),imdb:!candidate.kpId,movieTon:false,likeFilm:false,tmdb:false,openai:false,watched:false}};
    if(!candidate.localPath)payload.externalReference=candidate;
    const content=JSON.stringify(payload,null,2),file=app.vault.getAbstractFileByPath(STATE);
    if(file) { if(app.vault.process)await app.vault.process(file,()=>content);else await app.vault.modify(file,content); }
    else {
        const folder=BASE+'Прогноз';if(!app.vault.getAbstractFileByPath(folder))await app.vault.createFolder(folder);
        check(signal);await app.vault.create(STATE,content);
    }
    check(signal);const key=Symbol.for('kino.recommendations.launch');app[key]=payload.updatedAt;
    try { if(app.workspace.getLeaf)await app.workspace.getLeaf(false).openFile(page);else await app.workspace.openLinkText(page.path,sourcePath); }
    catch(error){if(app[key]===payload.updatedAt)delete app[key];throw error;}
    return payload;
}
async function load(app,name) {
    const file=app.vault.getAbstractFileByPath(BASE+name+'.js');if(!file)throw Error('Не найден '+name+'.js');
    const mod={exports:{}};new Function('module','exports',await app.vault.read(file))(mod,mod.exports);return mod.exports;
}
async function openLookup({app,obsidian={},doc=globalThis.document,trigger,sourcePath='Кино/_index.md'}) {
    if(app[INSTANCE]?.isOpen()){app[INSTANCE].focus();return app[INSTANCE];}
    const cssFile=app.vault.getAbstractFileByPath(BASE+'kino-lookup.css');if(!cssFile)throw Error('Не найдено оформление поиска по ID.');
    const css=await app.vault.read(cssFile);
    if(app[INSTANCE]?.isOpen()){app[INSTANCE].focus();return app[INSTANCE];}
    let modal,host,content,closed=false,busy=false,operation=null,resolved=null,report=null,details=null,focusTimer;
    const listeners=[],focusBefore=trigger||doc.activeElement;
    function el(parent,tag,cls='',text){const node=doc.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=String(text);parent.appendChild(node);return node;}
    function listen(node,event,callback){node.addEventListener(event,callback);listeners.push(()=>node.removeEventListener(event,callback));}
    function dispose(){if(closed)return;closed=true;clearTimeout(focusTimer);operation?.abort();details?.close();for(const fn of listeners.splice(0))fn();if(app[INSTANCE]===controller)delete app[INSTANCE];if(focusBefore?.isConnected)focusBefore.focus();}
    function close(){if(closed)return;if(modal)modal.close();else{host.close?.();host.remove();dispose();}}
    const controller={close,isOpen:()=>!closed,focus:()=>input.focus()};
    if(obsidian.Modal){modal=new obsidian.Modal(app);host=modal.modalEl;host.classList.add('kino-lookup-modal');content=modal.contentEl;
        if(modal.setTitle)modal.setTitle('Добавить в кинотеку');else modal.titleEl.textContent='Добавить в кинотеку';modal.onClose=dispose;
    }else{host=el(doc.body,'dialog','kino-lookup-modal');host.setAttribute('aria-label','Добавить в кинотеку');content=el(host,'div');
        el(content,'h2','kino-lookup-title','Добавить в кинотеку');const dismiss=el(content,'button','kino-lookup-dismiss','×');dismiss.type='button';dismiss.setAttribute('aria-label','Закрыть');listen(dismiss,'click',close);listen(host,'cancel',event=>{event.preventDefault();close();});}
    el(content,'style','',css);
    const root=el(content,'div','kino-lookup');
    const form=el(root,'form','kino-lookup-form');
    const label=el(form,'label','kino-lookup-label','ID Кинопоиска или IMDb');
    const input=el(label,'input');input.type='text';input.placeholder='435 или tt0120689';input.autocomplete='off';input.spellcheck=false;input.maxLength=300;
    input.setAttribute('aria-label','ID Кинопоиска или IMDb');
    const fields=el(form,'div','kino-lookup-fields');
    const typeLabel=el(fields,'label','kino-lookup-label','Что добавляем?');
    const typeInput=el(typeLabel,'select');typeInput.setAttribute('aria-label','Фильм или сериал');
    for(const [value,text]of [['','Выбери тип'],['movie','Фильм'],['series','Сериал']]){const o=el(typeInput,'option','',text);o.value=value;}
    const ratingLabel=el(fields,'label','kino-lookup-label','Твоя оценка');const ratingInput=el(ratingLabel,'input');ratingInput.type='text';ratingInput.inputMode='decimal';ratingInput.placeholder='От 1 до 10';ratingInput.setAttribute('aria-label','Личная оценка');
    const today=new Date();el(form,'p','kino-lookup-hint','Дата просмотра: '+today.toLocaleDateString('ru-RU')+' · сегодня');
    const actions=el(form,'div','kino-lookup-actions');
    function action(label,kind){const b=el(actions,'button','kino-lookup-action is-'+kind,label);b.type='button';return b;}
    const recommendations=action('Рекомендации','recommendations');
    const forecast=action('Прогноз','forecast');
    const add=action('Добавить','add');
    const status=el(root,'p','kino-lookup-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const progress=el(root,'progress','kino-lookup-progress');progress.hidden=true;progress.setAttribute('aria-label','Ход расчёта');
    const cancel=el(root,'button','kino-lookup-cancel','Остановить');cancel.type='button';cancel.hidden=true;
    const result=el(root,'section','kino-lookup-result');result.hidden=true;result.setAttribute('aria-label','Результат прогноза');
    function updateButtons(){const valid=Boolean(parseIdentity(input.value));add.disabled=recommendations.disabled=forecast.disabled=busy||!valid;input.disabled=typeInput.disabled=ratingInput.disabled=busy;cancel.hidden=!busy;progress.hidden=!busy;}
    function message(text,error=false){if(closed)return;status.textContent=text;status.classList.toggle('is-error',error);}
    function onProgress(value){if(closed||!busy)return;const stage=value.stage||({model:'Подготавливаю локальную модель…',embeddings:'Сравниваю сюжет с кинотекой…',training:'Проверяю прогноз по текущим оценкам…',validating:'Проверяю точность модели…'}[value.phase])||'Рассчитываю прогноз…';
        message(stage);if(Number.isFinite(value.total)&&value.total>0&&Number.isFinite(value.completed)){progress.max=value.total;progress.value=value.completed;}else progress.removeAttribute('value');}
    const fmt=n=>Number.isFinite(n)?n.toFixed(1).replace('.',','):'—';
    function showResult(candidate,value){
        report=value;result.replaceChildren();result.hidden=false;
        const top=el(result,'div','kino-lookup-film');
        if(/^https:\/\//i.test(candidate.poster)){const image=el(top,'img','kino-lookup-poster');image.src=candidate.poster;image.alt='';image.loading='lazy';listen(image,'error',()=>image.remove());}
        const about=el(top,'div','kino-lookup-about');el(about,'p','kino-lookup-eyebrow',candidate.localPath?'Уже в кинотеке':'Новый для кинотеки');el(about,'h3','',candidate.ruTitle||candidate.enTitle);
        if(candidate.enTitle&&candidate.enTitle!==candidate.ruTitle)el(about,'p','kino-lookup-original',candidate.enTitle);
        el(about,'p','kino-lookup-meta',[candidate.type==='series'?'Сериал':'Фильм',candidate.year,candidate.kpId?'КП '+candidate.kpId:candidate.imdbId].filter(Boolean).join(' · '));
        const links=el(about,'div','kino-lookup-film-links');
        const kp=el(links,'a','',candidate.kpId?'Кинопоиск ↗':'IMDb ↗');kp.href=candidate.kpId?`https://www.kinopoisk.ru/${candidate.type==='series'?'series':'film'}/${candidate.kpId}/`:`https://www.imdb.com/title/${candidate.imdbId}/`;kp.target='_blank';kp.rel='noopener noreferrer';
        if(candidate.localPath){const local=el(links,'a','internal-link','Моя карточка ↗');local.href=candidate.localPath;listen(local,'click',event=>{event.preventDefault();void app.workspace.openLinkText(candidate.localPath,sourcePath);close();});}
        const scores=el(result,'div','kino-lookup-scores');
        for(const [name,label,n]of [['final','Мой прогноз',value.final.prediction],['data','По данным',value.data.prediction],['plot','По сюжету',value.plot.prediction]]){
            const cell=el(scores,'div','kino-lookup-score is-'+name);el(cell,'span','',label);el(cell,'strong','',fmt(n));
        }
        const w=value.final.effectiveWeights||{},dw=w.data155,pw=w['plot-embeddinggemma'];
        el(result,'p','kino-lookup-note',Number.isFinite(dw)&&Number.isFinite(pw)?`В итог входят: данные ${fmt(dw*100)}% · сюжет ${fmt(pw*100)}%.`:'Итог рассчитан текущей моделью кинотеки.');
        if(Number.isFinite(candidate.personalRating))el(result,'p','kino-lookup-note','Твоя личная оценка: '+fmt(candidate.personalRating)+'. Она и оценки дубликатов исключены из собственного прогноза.');
        if(value.final.provisional)el(result,'p','kino-lookup-warning','Предварительный прогноз. '+(value.plot.reason||value.final.reason||'Сюжетная часть пока недоступна.'));
        if(candidate.partialCredits)el(result,'p','kino-lookup-note','Состав актёров и режиссёры недоступны; учтены остальные признаки фильма.');
        const more=el(result,'button','kino-lookup-more','Как получен прогноз');more.type='button';
        listen(more,'click',async()=>{more.disabled=true;try{const open=await load(app,'forecast_details');if(!closed){details=await open({app,obsidian,doc,sourcePath:candidate.localPath||sourcePath,snapshot:report,trigger:more,parent:result});if(closed)details.close();}}catch(error){message(error.message||String(error),true);}finally{more.disabled=false;}});
        doc.defaultView.requestAnimationFrame(()=>{if(!closed)result.scrollIntoView({block:'nearest'});});
    }
    function requestInput(prompt,signal){
        check(signal);message(prompt.description||prompt.title);progress.hidden=true;
        const block=el(root,'div','kino-lookup-question');
        const label=el(block,'label','kino-lookup-label',prompt.title);
        const field=el(label,prompt.options?'select':'input');field.setAttribute('aria-label',prompt.title);
        if(prompt.options){prompt.options.forEach((text,i)=>{const option=el(field,'option','',text);option.value=String(i);});}
        else {field.type='text';field.value=prompt.value||'';}
        const next=el(block,'button','kino-lookup-more','Продолжить');next.type='button';field.focus();
        return new Promise((resolve,reject)=>{
            function cleanup(){signal?.removeEventListener('abort',abort);next.removeEventListener('click',done);field.removeEventListener('keydown',enter);block.remove();}
            function done(){const value=field.value;cleanup();progress.hidden=false;resolve(value);}
            function abort(){cleanup();reject(abortError());}
            function enter(event){if(event.key==='Enter'){event.preventDefault();done();}}
            next.addEventListener('click',done);field.addEventListener('keydown',enter);signal?.addEventListener('abort',abort,{once:true});
        });
    }
    async function submit(kind){
        if(closed||busy)return;const identity=parseIdentity(input.value);const id=identity?identity.provider+':'+identity.id:'';if(!identity){message('Введи ID Кинопоиска, IMDb или ссылку на фильм/сериал.',true);input.focus();return;}
        const existing=kind==='add'?findExisting(app,identity):null;
        if(existing){try{await app.workspace.getLeaf(false).openFile(existing);close();}catch(error){message('Не удалось открыть карточку: '+error.message,true);}return;}
        if(kind==='add'&&!typeInput.value){message('Выбери: фильм или сериал.',true);typeInput.focus();return;}
        const rating=number(ratingInput.value);
        if(kind==='add'&&(rating===null||rating<1||rating>10)){message('Введи личную оценку от 1 до 10.',true);ratingInput.focus();return;}
        busy=true;operation=new AbortController();const signal=operation.signal;cancel.disabled=false;updateButtons();progress.removeAttribute('value');result.hidden=true;
        message('Проверяю кинотеку…');
        try{
            if(kind==='add'){
                const legacy=await load(app,'Examples_Attachments_movies');check(signal);
                if(typeof legacy.addFromDialog!=='function')throw Error('Старый скрипт добавления не загружен.');
                const imported=await legacy.addFromDialog({app,obsidian,query:input.value,type:typeInput.value,rating,signal,onProgress,findExisting,requestInput});
                if(!closed){if(imported.warning&&obsidian.Notice)new obsidian.Notice(imported.warning,8000);message(imported.warning||'Готово. Открываю карточку…');await app.workspace.getLeaf(false).openFile(imported.file);close();}
            }else{
                const candidate=resolved?.id===id?resolved.candidate:await resolveFilm({app,obsidian,identity,type:typeInput.value,signal,onProgress});check(signal);resolved={id,candidate};
            if(kind==='recommendations'){message('Открываю рекомендации…');await openRecommendations({app,candidate,signal,sourcePath});close();}
            else{onProgress({stage:'Готовлю персональный прогноз…'});const predictor=await load(app,'predict_rating');check(signal);
                const value=await predictor.preview({app,obsidian,forecastCandidate:candidate,shouldCancel:()=>signal.aborted,onProgress});check(signal);
                if(!closed){showResult(candidate,value);message('Прогноз готов. Карточки и личные оценки не изменены.');}
            }
            }
        }catch(error){if(!closed)message(error.name==='AbortError'?'Действие остановлено.':error.message||String(error),error.name!=='AbortError');}
        finally{operation?.abort();busy=false;operation=null;if(!closed)updateButtons();}
    }
    listen(input,'keydown',event=>{if(event.key==='Enter'){event.preventDefault();void submit('forecast');}});
    listen(input,'input',()=>{message('');result.hidden=true;updateButtons();});listen(form,'submit',event=>{event.preventDefault();void submit('forecast');});
    listen(add,'click',()=>{void submit('add');});
    listen(typeInput,'change',()=>{resolved=null;});
    listen(recommendations,'click',()=>{void submit('recommendations');});listen(forecast,'click',()=>{void submit('forecast');});
    listen(cancel,'click',()=>{cancel.disabled=true;message('Останавливаю…');operation?.abort();});
    updateButtons();app[INSTANCE]=controller;
    if(modal)modal.open();else host.showModal();focusTimer=setTimeout(()=>{if(!closed)input.focus();},20);
    return controller;
}
module.exports=openLookup;
Object.assign(module.exports,{parseId,parseIdentity,findExisting,normalizeFilm,localFilm,resolveFilm,openRecommendations});
