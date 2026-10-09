// Read-only cinema report. History files override the summary date; never add both.
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
function number(value) {
    if (value == null || String(value).trim() === '') return null;
    const n = Number(String(value).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}
function date(value) {
    const raw = value instanceof Date ? `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`
        : typeof value?.toISODate === 'function' ? value.toISODate() : String(value ?? '').trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(raw);
    if (!match) return null;
    const d = new Date(0); d.setFullYear(+match[1], +match[2]-1, +match[3]);
    return d.getFullYear() === +match[1] && d.getMonth()+1 === +match[2] && d.getDate() === +match[3] ? match.slice(1).join('-') : null;
}
function values(value) {
    return [...new Set((Array.isArray(value) ? value : [value]).map(v => {
        const s = String(v?.display ?? v?.path ?? v ?? '').trim().normalize('NFC');
        const link = /^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/.exec(s);
        return link ? link[2] || link[1].split('/').pop().replace(/\.md$/i, '') : s;
    }).filter(v => v && !/^(?:N\/?A|null|undefined)$/i.test(v)))];
}
function target(value) {
    const raw = String(value?.path ?? value ?? '').trim();
    return (raw.match(/^\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/)?.[1] || raw).replace(/#.*$/, '');
}
function collect(app) {
    const files = app.vault.getMarkdownFiles(), byPath = new Map(files.map(f => [f.path.toLowerCase(), f]));
    const fm = file => app.metadataCache.getFileCache(file)?.frontmatter || {};
    function resolve(value, source) {
        const path = target(value); if (!path) return null;
        const resolved = app.metadataCache.getFirstLinkpathDest?.(path, source);
        if (resolved) return resolved;
        const candidates = [path, path + '.md', 'Кино/Media/' + path, 'Кино/Media/' + path + '.md'];
        for (const p of candidates) if (byPath.has(p.toLowerCase())) return byPath.get(p.toLowerCase());
        return null;
    }
    const records = files.filter(f => /^Кино\/Media\/[^/]+\.md$/i.test(f.path)).map(file => {
        const fields = fm(file), tags = values(fields.tags).map(t => t.replace(/^#/, ''));
        if (!tags.includes('movies') && !tags.includes('serial')) return null;
        const roles = resolve(fields['Роли файл'], file.path) || byPath.get(('Кино/_system/Роли/' + file.basename + '.роли.md').toLowerCase());
        const roleFields = roles ? fm(roles) : {};
        const combine = (...entries) => [...new Set(entries.flatMap(values))];
        const year = /\b((?:18|19|20|21)\d{2})\b/.exec(String(fields['Релиз'] ?? ''))?.[1] || '';
        return { file, fields, title: file.basename || file.name.replace(/\.md$/i,''), type: tags.includes('serial') ? 'serials' : 'movies',
            score: number(fields['Оценка']), watched: date(fields['Просмотрено']), year,
            genres: combine(fields['Жанр'], roleFields['Жанр']), directors: combine(fields['Режисер'], fields['Режиссер'], roleFields['Режисер'], roleFields['Режиссер']),
            actors: combine(fields['Актеры'], fields['Актёры'], roleFields['Актеры'], roleFields['Актёры']),
            franchises: values(fields['Франшиза']), countries: values(fields['Страна']), events: [] };
    }).filter(Boolean);
    const lookup = new Map(records.map(r => [r.file.path.toLowerCase(), r]));
    let unlinked = 0;
    for (const file of files) {
        const season = /^Кино\/Сезоны\/[^/]+\.md$/i.test(file.path);
        if (!season && !/^Кино\/Просмотры\/[^/]+\.md$/i.test(file.path)) continue;
        const fields = fm(file), ref = season ? fields['Сериал'] : fields['Фильм'];
        const media = resolve(ref, file.path), record = media && lookup.get(media.path.toLowerCase());
        if (!record) { unlinked++; continue; }
        record.events.push({ file, date: date(fields['Дата']), score: number(fields['Оценка']),
            number: season ? 0 : number(fields['Просмотр']), season: season ? number(fields['Сезон']) : null, fallback: false, record });
    }
    for (const record of records) {
        if (!record.events.length && record.watched) record.events.push({ file: record.file, date: record.watched, score: record.score, number: 1, season: null, fallback: true, record });
    }
    return { records, unlinked };
}
function mean(records) {
    const scores = records.map(r => r.score).filter(n => n != null);
    return scores.length ? scores.reduce((a,b) => a+b, 0) / scores.length : null;
}
function split(records) { return [records.filter(r => r.type === 'movies').length, records.filter(r => r.type === 'serials').length]; }
function groups(records, field) {
    const map = new Map();
    for (const record of records) for (const name of record[field]) {
        if (!map.has(name)) map.set(name, []);
        map.get(name).push(record);
    }
    return [...map].map(([name, rows]) => ({ name, rows, count: rows.length, average: mean(rows), types: split(rows) }))
        .sort((a,b) => b.count-a.count || a.name.localeCompare(b.name, 'ru'));
}
function build(data, { year = '', month = '', type = '' } = {}) {
    const records = data.records.filter(r => !type || r.type === type);
    const allEvents = records.flatMap(r => r.events);
    const period = year ? year + (month ? '-' + month : '') : '';
    const events = allEvents.filter(e => !period || e.date?.startsWith(period));
    const activePaths = new Set(events.map(e => e.record.file.path));
    const active = year ? records.filter(r => activePaths.has(r.file.path)) : records;
    const annual = new Map(), releases = new Map(), decades = new Map(), ratings = new Map();
    for (const event of allEvents) if (event.date) {
        const key = event.date.slice(0,4); if (!annual.has(key)) annual.set(key, []); annual.get(key).push(event);
    }
    for (const r of active) {
        const release = r.year || 'Без года', decade = r.year ? String(Math.floor(+r.year/10)*10) + '-е' : 'Без года';
        for (const [map, key] of [[releases,release],[decades,decade]]) { if (!map.has(key)) map.set(key, []); map.get(key).push(r); }
        if (r.score != null) { if (!ratings.has(r.score)) ratings.set(r.score, []); ratings.get(r.score).push(r); }
    }
    return { records: active, events, allEvents, average: mean(active), types: split(active),
        repeats: events.filter(e => e.number > 1).length,
        years: [...annual].sort((a,b) => b[0].localeCompare(a[0])),
        months: MONTHS.map((label,i) => [label, allEvents.filter(e => e.date && (!year || e.date.startsWith(year+'-')) && +e.date.slice(5,7) === i+1)]),
        releases: [...releases].sort((a,b) => b[0].localeCompare(a[0])), decades: [...decades].sort((a,b) => b[0].localeCompare(a[0])),
        ratings: [...ratings].sort((a,b) => b[0]-a[0]),
        genres: groups(active,'genres'), directors: groups(active,'directors'), actors: groups(active,'actors'), franchises: groups(active,'franchises'), countries: groups(active,'countries') };
}

async function render({ dv, app }) {
    const component = dv.component, doc = dv.container.ownerDocument, source = dv.current?.()?.file?.path || 'Кино/_system/Итоги просмотров.md';
    const key = '__kinoStatistics';
    let state = component?.[key];
    if (!state) {
        state = { root: null, dispose: null, year: '', month: '', type: '', folds: {}, tables: {} };
        if (component) {
            component[key] = state;
            const original = component.render;
            if (typeof original === 'function') {
                const wrapped = function(...args) { if (state.root?.parentNode === dv.container && state.root.dataset.ready === 'true') return Promise.resolve(); return original.apply(this,args); };
                component.render = wrapped;
                component.register?.(() => { if (component.render === wrapped) component.render = original; delete component[key]; });
            }
        }
    }
    state.dispose?.();
    let disposed = false, timer, data, root;
    const cleanups = [];
    function el(parent,tag,cls='',text) { const node=doc.createElement(tag); if(cls)node.className=cls; if(text!==undefined)node.textContent=String(text); parent.append(node); return node; }
    function listen(node,event,fn) { node.addEventListener(event,fn); cleanups.push(()=>node.removeEventListener(event,fn)); }
    function dispose() { if(disposed)return;disposed=true;clearTimeout(timer);for(const f of cleanups.splice(0))f();root?.remove();if(state.root===root)state.root=null; }
    state.dispose=dispose;component?.register?.(dispose);
    function internal(parent,text,path) { const a=el(parent,'a','internal-link',text);a.href=path;a.dataset.href=path;listen(a,'click',e=>{e.preventDefault();app.workspace.openLinkText(path,source,Boolean(e.ctrlKey||e.metaKey));});return a; }
    const fmt=n=>n==null?'—':n.toFixed(2).replace('.',',');
    try {
        const css = [];
        for(const path of ['Кино/_system/kino-home.css','Кино/_system/kino-statistics.css']) {
            const file=app.vault.getAbstractFileByPath(path);if(!file)throw Error('Не найден стиль статистики');css.push(await app.vault.read(file));
            if(disposed)return {dispose};
        }
        root=el(dv.container,'section','kino-home-ui kino-report');state.root=root;
        el(root,'style','',css.join('\n'));
        const head=el(root,'header','kino-home-masthead');
        const nav=el(head,'nav','kino-home-nav');internal(nav,'← Кинотека','Кино/_index.md');internal(nav,'Каталог','Кино/_Кино.base#Все');
        el(head,'h1','kino-home-title','Итоги просмотров');
        const controls=el(head,'div','kino-report-controls');
        function select(label,options) { const wrap=el(controls,'label','',label);const sel=el(wrap,'select');sel.setAttribute('aria-label',label);for(const [value,text]of options){el(sel,'option','',text).value=value;}return sel; }
        const yearSelect=select('Год просмотра',[['','Все годы']]);
        const monthSelect=select('Месяц',[['','Все месяцы'],...MONTHS.map((m,i)=>[String(i+1).padStart(2,'0'),m])]);
        const typeSelect=select('Тип',[['','Фильмы и сериалы'],['movies','Фильмы'],['serials','Сериалы']]);
        const reset=el(controls,'button','','За всё время');reset.type='button';
        const period=el(head,'p','kino-report-period');period.setAttribute('role','status');
        const metrics=el(head,'div','kino-report-metrics');
        const metricNodes=[];
        for(const [key,label]of [['works','Произведений'],['movies','Фильмов'],['serials','Сериалов'],['events','Просмотров и сезонов'],['repeats','Повторных просмотров'],['average','Средняя оценка']]) {
            const box=el(metrics,'div','kino-home-stat');const n=el(box,'strong');n.dataset.metric=key;el(box,'span','',label);metricNodes.push([key,n]);
        }
        function section(title,id,open=true) {
            const box=el(root,'details','kino-report-section');box.dataset.section=id;box.open=state.folds[id]??open;
            const summary=el(box,'summary');el(summary,'span','',title);el(summary,'span','kino-home-fold-chevron').setAttribute('aria-hidden','true');
            listen(box,'toggle',e=>{if(e.target===box)state.folds[id]=box.open;});
            return el(box,'div','kino-report-body');
        }
        const activity=section('Годы и месяцы просмотров','activity');
        const activityGrid=el(activity,'div','kino-report-grid');
        const yearsBox=el(activityGrid,'div');el(yearsBox,'h3','','По годам');const yearsChart=el(yearsBox,'div','kino-report-scroll');
        const monthsBox=el(activityGrid,'div');const monthsHeading=el(monthsBox,'h3');const monthsChart=el(monthsBox,'div');
        const ratingBox=section('Личные оценки','ratings');const ratingChart=el(ratingBox,'div');
        const releaseBox=section('Годы выпуска и десятилетия','releases');const releaseGrid=el(releaseBox,'div','kino-report-grid');
        const decadesBox=el(releaseGrid,'div');el(decadesBox,'h3','','По десятилетиям');const decadeChart=el(decadesBox,'div');
        const releasesBox=el(releaseGrid,'div');el(releasesBox,'h3','','По годам выпуска');const releaseChart=el(releasesBox,'div','kino-report-scroll');
        const groupTables={};
        for(const [id,title]of [['genres','Жанры'],['directors','Режиссёры'],['actors','Актёры'],['franchises','Франшизы'],['countries','Страны']]) {
            const body=section(title,id,id!=='countries');groupTables[id]=makeTable(body,id,['Название','Всего','Фильмы','Сериалы','Средняя оценка']);
        }
        const works=makeTable(section('Произведения выбранного периода','works'),'works',['Название','Тип','Год выпуска','Моя оценка']);
        const history=makeTable(section('История просмотров и сезонов','history',false),'history',['Дата','Произведение','Запись','Оценка']);
        const method=section('Как считаются итоги','method',false);
        el(method,'p','','Год и месяц относятся к дате просмотра. Счётчик произведений и разрезы по жанрам, людям и оценкам учитывают каждую карточку один раз. Средняя оценка — по текущим личным оценкам карточек.');
        el(method,'p','','Просмотры фильмов и сезоны сериалов берутся из отдельных записей истории. Если истории нет, используется одна последняя дата из карточки. Прошлые даты по счётчику просмотров не восстанавливаются. Просмотр без корректной даты учитывается только за всё время.');
        el(method,'p','','У произведения может быть несколько жанров, режиссёров или актёров, поэтому суммы этих строк могут превышать число произведений. Карточка с обоими тегами относится к сериалам. Записи сезонов не считаются повторными просмотрами.');
        const quality=el(method,'p');
        const updateStatus=el(root,'p','kino-report-update');updateStatus.setAttribute('role','status');updateStatus.hidden=true;

        function makeTable(parent,id,headings) {
            const options=state.tables[id]||(state.tables[id]={query:'',sort:'count',limit:'25'});
            const bar=el(parent,'div','kino-report-table-controls');const search=el(bar,'input');search.type='search';search.placeholder='Поиск';search.setAttribute('aria-label','Поиск: '+id);search.value=options.query;
            const sort=el(bar,'select');sort.setAttribute('aria-label','Сортировка: '+id);
            for(const [value,label]of (id==='works'?[['score','По оценке'],['name','По названию']]:id==='history'?[['date','Сначала новые'],['name','По названию']]:[['count','По количеству'],['score','По средней оценке'],['name','По названию']]))el(sort,'option','',label).value=value;
            if(![...sort.options].some(o=>o.value===options.sort))options.sort=sort.options[0].value;sort.value=options.sort;
            const limit=el(bar,'select');limit.setAttribute('aria-label','Показать строк: '+id);for(const n of ['25','50','100','all'])el(limit,'option','',n==='all'?'Все строки':n+' строк').value=n;limit.value=options.limit;
            const wrap=el(parent,'div','kino-report-table');const table=el(wrap,'table');const tr=el(el(table,'thead'),'tr');for(const h of headings)el(tr,'th','',h);const tbody=el(table,'tbody');const caption=el(parent,'p','kino-report-table-caption');
            let entries=[];
            function drawRows(){tbody.replaceChildren();let rows=entries.filter(r=>r.name.toLocaleLowerCase('ru').includes(options.query.toLocaleLowerCase('ru')));
                rows.sort((a,b)=>(options.sort==='name'?0:options.sort==='score'?(b.score??-Infinity)-(a.score??-Infinity):options.sort==='date'?String(b.date||'').localeCompare(a.date||''):(b.count||0)-(a.count||0))||a.name.localeCompare(b.name,'ru'));
                const shown=options.limit==='all'?rows:rows.slice(0,+options.limit);
                for(const entry of shown){const row=el(tbody,'tr');for(const value of entry.cells){const cell=el(row,'td');if(value?.path){const a=el(cell,'a','internal-link',value.text);a.href=value.path;a.dataset.href=value.path;}else if(value?.choice){const a=el(cell,'a','',value.text);a.href='obsidian://quickadd?vault='+encodeURIComponent(app.vault.getName?.()||'')+'&choice='+encodeURIComponent(value.choice)+'&value-entity='+encodeURIComponent(value.text);}else cell.textContent=String(value??'—');}}
                caption.textContent=rows.length?'Показано '+shown.length+' из '+rows.length:'Нет данных для выбранного периода.';
            }
            listen(tbody,'click',e=>{const a=e.target.closest('a[data-href]');if(!a)return;e.preventDefault();app.workspace.openLinkText(a.dataset.href,source,Boolean(e.ctrlKey||e.metaKey));});
            listen(search,'input',()=>{options.query=search.value;drawRows();});listen(sort,'change',()=>{options.sort=sort.value;drawRows();});listen(limit,'change',()=>{options.limit=limit.value;drawRows();});
            return rows=>{entries=rows;drawRows();};
        }
        function chart(parent,entries,onSelect) {
            parent.replaceChildren();const max=Math.max(1,...entries.map(e=>e.types[0]+e.types[1]));
            if(!entries.length){el(parent,'p','kino-home-empty','Нет данных для выбранного периода.');return;}
            for(const entry of entries){const row=el(parent,onSelect?'button':'div','kino-report-bar');if(onSelect){row.type='button';row.dataset.value=entry.value;row.setAttribute('aria-pressed',String(entry.selected));}
                el(row,'span','kino-report-bar-label',entry.label);const track=el(row,'span','kino-home-chart-track');track.setAttribute('aria-hidden','true');
                for(const [i,kind]of ['movies','serials'].entries()){const segment=el(track,'span','kino-home-chart-bar is-'+kind);segment.style.width=entry.types[i]/max*100+'%';}
                el(row,'strong','kino-home-chart-count',entry.types[0]+entry.types[1]);row.setAttribute('aria-label',entry.label+': фильмы — '+entry.types[0]+', сериалы — '+entry.types[1]);
            }
        }
        function setPeriod(year,month=''){state.year=year;state.month=year?month:'';draw();}
        listen(yearSelect,'change',()=>setPeriod(yearSelect.value));listen(monthSelect,'change',()=>setPeriod(state.year,monthSelect.value));listen(typeSelect,'change',()=>{state.type=typeSelect.value;draw();});listen(reset,'click',()=>{state.type='';setPeriod('');});
        listen(yearsChart,'click',e=>{const button=e.target.closest('button[data-value]');if(button)setPeriod(state.year===button.dataset.value?'':button.dataset.value);});
        listen(monthsChart,'click',e=>{const button=e.target.closest('button[data-value]');if(button&&state.year)setPeriod(state.year,state.month===button.dataset.value?'':button.dataset.value);});
        function draw(){if(disposed)return;const model=build(data,state);yearSelect.value=state.year;monthSelect.value=state.month;monthSelect.disabled=!state.year;typeSelect.value=state.type;
            period.textContent=(state.year?(state.month?MONTHS[+state.month-1]+' · ':'')+state.year:'За всё время')+(state.type?' · '+(state.type==='movies'?'Фильмы':'Сериалы'):'');
            const totals={works:model.records.length,movies:model.types[0],serials:model.types[1],events:model.events.length,repeats:model.repeats,average:fmt(model.average)};for(const [key,node]of metricNodes)node.textContent=totals[key];
            chart(yearsChart,model.years.map(([year,events])=>({label:year,value:year,selected:state.year===year,types:split(events.map(e=>e.record))})),true);
            monthsHeading.textContent='По месяцам · '+(state.year||'все годы');chart(monthsChart,model.months.map(([label,events],i)=>({label:label.slice(0,3),value:String(i+1).padStart(2,'0'),selected:state.month===String(i+1).padStart(2,'0'),types:split(events.map(e=>e.record))})),Boolean(state.year));
            chart(ratingChart,model.ratings.map(([score,rows])=>({label:String(score).replace('.',','),types:split(rows)})));
            chart(decadeChart,model.decades.map(([label,rows])=>({label,types:split(rows)})));chart(releaseChart,model.releases.map(([label,rows])=>({label,types:split(rows)})));
            for(const [id,set]of Object.entries(groupTables)){const choice={genres:'Кино - Открыть жанр',directors:'Кино - Открыть режиссера',actors:'Кино - Открыть актера'}[id];set(model[id].map(row=>({name:row.name,count:row.count,score:row.average,cells:[choice?{text:row.name,choice}:row.name,row.count,...row.types,fmt(row.average)]})));}
            works(model.records.map(r=>({name:r.title,score:r.score,cells:[{path:r.file.path,text:r.title},r.type==='movies'?'Фильм':'Сериал',r.year||'—',fmt(r.score)]})));
            history(model.events.map(e=>({name:e.record.title,date:e.date,cells:[e.date||'Без даты',{path:e.record.file.path,text:e.record.title},e.fallback?'Последняя дата карточки':{path:e.file.path,text:e.season!=null?'Сезон '+e.season:'Просмотр '+(e.number??'')},fmt(e.score)]})));
            quality.textContent='Последняя дата вместо истории: '+data.records.filter(r=>r.events.some(e=>e.fallback)).length+' карточек. Записей без корректной даты: '+data.records.flatMap(r=>r.events).filter(e=>!e.date).length+'. Записей без связи с карточкой: '+data.unlinked+'.';
        }
        function refresh(){if(disposed)return;try{data=collect(app);const years=[...new Set(data.records.flatMap(r=>r.events).map(e=>e.date?.slice(0,4)).filter(Boolean))].sort((a,b)=>b.localeCompare(a));yearSelect.replaceChildren();el(yearSelect,'option','','Все годы').value='';for(const y of years)el(yearSelect,'option','',y).value=y;
                if(state.year&&!years.includes(state.year)){state.year='';state.month='';}draw();updateStatus.hidden=true;
            }catch(error){updateStatus.textContent='Не удалось обновить статистику: '+(error.message||error);updateStatus.hidden=false;}}
        refresh();
        for(const [owner,events]of [[app.metadataCache,['changed']],[app.vault,['create','delete','rename','modify']]])if(owner?.on)for(const event of events){const ref=owner.on(event,()=>{clearTimeout(timer);timer=setTimeout(refresh,150);});cleanups.push(()=>owner.offref?.(ref));}
        root.dataset.ready='true';return {dispose};
    }catch(error){dispose();throw error;}
}
module.exports=render;
module.exports.collect=collect;
module.exports.build=build;
