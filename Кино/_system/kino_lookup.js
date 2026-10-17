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
        directors: names(['DIRECTOR']), actors: names(['ACTOR','VOICE_MALE','VOICE_FEMALE','HIMSELF','HERSELF']).slice(0,60),
        poster: String(data.posterUrlPreview || data.posterUrl || ''), franchise: '', localPath: '', personalRating: null,
        partialCredits: !Array.isArray(staff), source: 'Кинопоиск' };
}
function localFilm(app, id) {
    const matches = app.vault.getMarkdownFiles().filter(file => /^Кино\/Media\/[^/]+\.md$/i.test(file.path)).filter(file => {
        const fm = app.metadataCache.getFileCache(file)?.frontmatter || {};
        return String(fm['Кинопоиск ID'] ?? '').trim().replace(/^0+/, '') === id && list(fm.tags).some(t => ['movies','serial'].includes(t.replace(/^#/, '')));
    });
    matches.sort((a,b) => a.path.localeCompare(b.path, 'ru'));
    const file = matches[0]; if (!file) return null;
    const fm = app.metadataCache.getFileCache(file)?.frontmatter || {};
    const rolePath = String(fm['Роли файл'] ?? '').replace(/^\[\[|\]\]$/g, '').split('|')[0];
    const role = rolePath && (app.metadataCache.getFirstLinkpathDest?.(rolePath,file.path) || app.vault.getAbstractFileByPath(rolePath) || app.vault.getAbstractFileByPath(rolePath+'.md'));
    const roleFm = role ? app.metadataCache.getFileCache(role)?.frontmatter || {} : {};
    return {kpId:id,ruTitle:file.basename,enTitle:String(fm['Название'] || ''),imdbId:String(fm['imdb Id']||''),
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
async function resolveFilm({app,obsidian={},id,signal,onProgress=()=>{}}) {
    check(signal); const local=localFilm(app,id); if(local)return local;
    onProgress({stage:'Загружаю сведения из Кинопоиска…'});
    const key=await apiKey(app); check(signal);
    const [film,staff]=await Promise.all([
        requestJson(obsidian,`https://kinopoiskapiunofficial.tech/api/v2.2/films/${id}`,key,signal),
        requestJson(obsidian,`https://kinopoiskapiunofficial.tech/api/v1/staff?filmId=${id}`,key,signal).catch(error=>{if(error.name==='AbortError')throw error;return null;})
    ]);
    check(signal); return normalizeFilm(film,staff,id);
}
async function openRecommendations({app,candidate,signal,sourcePath}) {
    check(signal); const page=app.vault.getAbstractFileByPath(BASE+'Рекомендации.md');
    if(!page)throw Error('Не найдена страница рекомендаций.');
    const payload={reference:candidate.localPath||'kp:'+candidate.kpId,updatedAt:new Date().toISOString(),
        sourceSettings:{kp:true,imdb:false,movieTon:false,likeFilm:false,tmdb:false,openai:false,watched:false}};
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
        if(modal.setTitle)modal.setTitle('Кино по ID Кинопоиска');else modal.titleEl.textContent='Кино по ID Кинопоиска';modal.onClose=dispose;
    }else{host=el(doc.body,'dialog','kino-lookup-modal');host.setAttribute('aria-label','Кино по ID Кинопоиска');content=el(host,'div');
        el(content,'h2','kino-lookup-title','Кино по ID Кинопоиска');const dismiss=el(content,'button','kino-lookup-dismiss','×');dismiss.type='button';dismiss.setAttribute('aria-label','Закрыть');listen(dismiss,'click',close);listen(host,'cancel',event=>{event.preventDefault();close();});}
    el(content,'style','',css);
    const root=el(content,'div','kino-lookup');
    el(root,'p','kino-lookup-intro','Найди похожее кино или узнай, насколько фильм может тебе понравиться. Добавлять его в коллекцию не нужно.');
    const form=el(root,'form','kino-lookup-form');
    const label=el(form,'label','kino-lookup-label','ID или ссылка на Кинопоиск');
    const input=el(label,'input');input.type='text';input.inputMode='numeric';input.placeholder='Например, 435';input.autocomplete='off';input.spellcheck=false;input.maxLength=300;
    input.setAttribute('aria-label','ID или ссылка на Кинопоиск');
    const help=el(form,'p','kino-lookup-hint','Можно вставить ссылку на фильм или сериал. Enter — мой прогноз.');help.id='kino-lookup-hint-'+Math.random().toString(36).slice(2);input.setAttribute('aria-describedby',help.id);
    const actions=el(form,'div','kino-lookup-actions');
    function action(label,description,kind){const b=el(actions,'button','kino-lookup-action is-'+kind);b.type='button';el(b,'strong','',label);el(b,'span','',description);return b;}
    const recommendations=action('Рекомендации','Похожие фильмы и сериалы','recommendations');
    const forecast=action('Мой прогноз','Оценка по моим предпочтениям','forecast');
    const status=el(root,'p','kino-lookup-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const progress=el(root,'progress','kino-lookup-progress');progress.hidden=true;progress.setAttribute('aria-label','Ход расчёта');
    const cancel=el(root,'button','kino-lookup-cancel','Остановить');cancel.type='button';cancel.hidden=true;
    const result=el(root,'section','kino-lookup-result');result.hidden=true;result.setAttribute('aria-label','Результат прогноза');
    function updateButtons(){const valid=Boolean(parseId(input.value));recommendations.disabled=forecast.disabled=busy||!valid;input.disabled=busy;cancel.hidden=!busy;progress.hidden=!busy;}
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
        el(about,'p','kino-lookup-meta',[candidate.type==='series'?'Сериал':'Фильм',candidate.year,'КП '+candidate.kpId].filter(Boolean).join(' · '));
        const links=el(about,'div','kino-lookup-film-links');
        const kp=el(links,'a','','Кинопоиск ↗');kp.href=`https://www.kinopoisk.ru/${candidate.type==='series'?'series':'film'}/${candidate.kpId}/`;kp.target='_blank';kp.rel='noopener noreferrer';
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
    }
    async function submit(kind){
        if(closed||busy)return;const id=parseId(input.value);if(!id){message('Введи числовой ID или ссылку на фильм/сериал Кинопоиска.',true);input.focus();return;}
        busy=true;operation=new AbortController();const signal=operation.signal;cancel.disabled=false;updateButtons();progress.removeAttribute('value');result.hidden=true;
        message('Проверяю кинотеку…');
        try{
            const candidate=resolved?.id===id?resolved.candidate:await resolveFilm({app,obsidian,id,signal,onProgress});check(signal);resolved={id,candidate};
            if(kind==='recommendations'){message('Открываю рекомендации…');await openRecommendations({app,candidate,signal,sourcePath});close();}
            else{onProgress({stage:'Готовлю персональный прогноз…'});const predictor=await load(app,'predict_rating');check(signal);
                const value=await predictor.preview({app,obsidian,forecastCandidate:candidate,shouldCancel:()=>signal.aborted,onProgress});check(signal);
                if(!closed){showResult(candidate,value);message('Прогноз готов. Карточки и личные оценки не изменены.');}
            }
        }catch(error){if(!closed)message(error.name==='AbortError'?'Действие остановлено.':error.message||String(error),error.name!=='AbortError');}
        finally{operation?.abort();busy=false;operation=null;if(!closed)updateButtons();}
    }
    listen(input,'input',()=>{message('');result.hidden=true;updateButtons();});listen(form,'submit',event=>{event.preventDefault();void submit('forecast');});
    listen(recommendations,'click',()=>{void submit('recommendations');});listen(forecast,'click',()=>{void submit('forecast');});
    listen(cancel,'click',()=>{cancel.disabled=true;message('Останавливаю…');operation?.abort();});
    updateButtons();app[INSTANCE]=controller;
    if(modal)modal.open();else host.showModal();focusTimer=setTimeout(()=>{if(!closed)input.focus();},20);
    return controller;
}
module.exports=openLookup;
Object.assign(module.exports,{parseId,normalizeFilm,localFilm,resolveFilm,openRecommendations});
