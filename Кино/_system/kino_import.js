/* Import from the Add dialog. No prompts, no overwrites, one serialized commit. */
'use strict';
const BASE='Кино/_system/';
const LOCK=Symbol.for('kino.import.lock'),CREATED=Symbol.for('kino.import.created');
function check(signal){if(signal?.aborted){const e=Error('Действие остановлено');e.name='AbortError';throw e;}}
function dateLocal(now=new Date()){return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');}
function safeName(value){let s=String(value||'Фильм').replace(/[<>:"/\\|?*#^\[\]\x00-\x1f]/g,' ').replace(/\s+/g,' ').trim().replace(/[. ]+$/,'').slice(0,120).trim();if(!s)s='Фильм';if(/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(s))s='_'+s;return s;}
function yaml(fields){return '---\n'+Object.entries(fields).map(([k,v])=>k+': '+JSON.stringify(v??null)).join('\n')+'\n---\n\n';}
async function load(app,name){const f=app.vault.getAbstractFileByPath(BASE+name+'.js');if(!f)throw Error('Не найден '+name);const m={exports:{}};new Function('module','exports',await app.vault.read(f))(m,m.exports);return m.exports;}
async function importFilm(params){
    const {app,obsidian={},candidate:c,type,rating,signal,onProgress=()=>{},findExisting}=params;
    if(!['movie','series'].includes(type))throw Error('Выбери фильм или сериал.');
    if(!Number.isFinite(rating)||rating<1||rating>10)throw Error('Введи личную оценку от 1 до 10.');
    if(!c||(!/^\d{1,12}$/.test(String(c.kpId||''))&&!/^tt\d{5,12}$/.test(c.imdbId||'')))throw Error('Нет корректного ID.');
    const previous=app[LOCK]||Promise.resolve();let release;app[LOCK]=new Promise(r=>release=r);await previous;
    try{
        check(signal);
        for(const identity of [{provider:'kp',id:c.kpId},{provider:'imdb',id:c.imdbId}].filter(x=>x.id)){
            const found=findExisting(app,identity);if(found)return {file:found,existing:true};
        }
        if(c.type!==type)throw Error('По этому ID найден '+(c.type==='series'?'сериал':'фильм')+'. Проверь выбранный тип.');
        const layout=await load(app,'card_layout');check(signal);
        const date=dateLocal(),base=safeName(c.ruTitle||c.enTitle),created=[];
        let name=base,paths;
        for(let i=0;;i++){
            name=i===0?base:safeName(base.slice(0,90)+' ('+(i===1?(c.year||c.kpId||c.imdbId):(c.kpId||c.imdbId)+' '+i)+')');
            paths={media:'Кино/Media/'+name+'.md',roles:BASE+'Роли/'+name+'.роли.md',viewing:'Кино/Просмотры/'+name+' - v1.md'};
            if(!Object.values(paths).some(p=>app.vault.getAbstractFileByPath(p)))break;
        }
        for(const folder of ['Кино/Media',BASE+'Роли','Кино/Просмотры'])if(!app.vault.getAbstractFileByPath(folder))await app.vault.createFolder(folder);
        const common={'Название':c.enTitle||c.ruTitle,'imdb Id':c.imdbId||null,'Кинопоиск ID':c.kpId||null,'Жанр':c.genres||[],'Режисер':c.directors||[]};
        const roleRaw=layout.ensureLayout(yaml({...common,'Основная карточка':'[['+paths.media+']]','Актеры':c.actors||[],'Роли актеров':c.actorRoles||c.actors||[]}),{kind:'roles',parseYaml:obsidian.parseYaml});
        const mainRaw=layout.ensureLayout(yaml({...common,obsidianUIMode:'preview','Просмотрено':date,'Оценка':rating,'Оценка Imdb':c.imdbRating,'Оценка Кинопоиск':c.kpRating,'Голосов Imdb':c.imdbVotes,'Голосов Кинопоиск':c.kpVotes,tags:[type==='series'?'serial':'movies'],'Релиз':c.releaseDate||c.year||null,'Время':c.duration?c.duration+' min':null,'Роли файл':'[['+paths.roles+']]','Описание':c.description||'','poster':c.poster||null,...(type==='movie'?{'Количество просмотров':1}:{})})+(type==='movie'?layout.viewingHistory([{number:1,date,rating}]):layout.region('seasons','')),{kind:'media',parseYaml:obsidian.parseYaml});
        const viewingRaw=layout.ensureLayout(yaml({obsidianUIMode:'preview','Фильм':'[[Кино/Media/'+name+'|'+name+']]','Дата':date,'Год':Number(date.slice(0,4)),'Просмотр':1,'Оценка':rating,'Последний просмотр':true,tags:['viewing'],'Комментарий':null}),{kind:'viewing',parseYaml:obsidian.parseYaml});
        onProgress({stage:'Создаю карточку и историю просмотра…'});
        let file,committed=false;
        try{
            for(const [path,raw]of [[paths.roles,roleRaw],...(type==='movie'?[[paths.viewing,viewingRaw]]:[]),[paths.media,mainRaw]]){
                check(signal);const f=await app.vault.create(path,raw);created.push({f,raw});if(path===paths.media){file=f;committed=true;}
            }
        }catch(error){if(!committed)for(const {f,raw}of created.reverse())if(await app.vault.read(f)===raw)await app.vault.delete(f);throw error;}
        const known=app[CREATED]||(app[CREATED]=new Map());if(c.kpId)known.set('kp:'+c.kpId,file.path);if(c.imdbId)known.set('imdb:'+c.imdbId,file.path);
        let warning='';
        try{
            onProgress({stage:'Готовлю прогноз для новой карточки…'});
            const deadline=Date.now()+10000;
            while(!app.metadataCache.getFileCache(file)?.frontmatter?.tags || !app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(paths.roles))?.frontmatter?.['Основная карточка']){check(signal);if(Date.now()>deadline)throw Error('Карточка сохранена; прогноз можно рассчитать после индексации.');await new Promise(r=>setTimeout(r,100));}
            check(signal);const predict=await load(app,'predict_rating');
            const estimate=await predict({app,obsidian,targetFile:file,onProgress,shouldCancel:()=>signal?.aborted,suppressNotice:true,prepareDescriptions:false});
            if(!estimate)throw Error(signal?.aborted?'Расчёт прогноза остановлен.':'Прогноз пока недоступен; его можно повторить из карточки.');
        }catch(e){warning='Карточка сохранена. '+(e.name==='AbortError'?'Расчёт прогноза остановлен.':e.message);}
        return {file,warning};
    }finally{release();}
}
module.exports=importFilm;Object.assign(module.exports,{dateLocal,safeName,yaml});
