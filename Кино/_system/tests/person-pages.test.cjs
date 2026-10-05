const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const system=path.resolve(__dirname,'..');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const noteNames={actor:'Актер',director:'Режиссер',genre:'Жанр'};
const selected={actor:'Vitaly Gogunsky (Виталий Гогунский)',director:'Shawn Levy',genre:'Криминал'};
const kinds=Object.keys(noteNames);
const baseHashes={director:'1c93e5d312b312b4e6642fb9363df95c816db387bd514a607bede263b69d7147',genre:'b60b9446ebeb8b7aa90946fa52041bbe86ea5e852d08cf69e09bab3b49126e24'};

function queryBlock(raw){
    const blocks=[...raw.matchAll(/```dataviewjs\r?\n([\s\S]*?)\r?\n```/g)].map(match=>match[1]);
    const block=blocks.find(source=>/const selected(?:Value)?\s*=/.test(source));
    assert.ok(block,'person query remains executable DataviewJS');
    return block;
}
function noteSource(kind){return fs.readFileSync(path.join(system,noteNames[kind]+'.md'),'utf8');}
function movie(name,values={}){
    return {file:{path:'Кино/Media/'+name+'.md',name,link:{path:'Кино/Media/'+name+'.md'},tags:['#movies']},
        tags:['movies'],'Режисер':['Shawn Levy'],'Жанр':['Криминал'],'Релиз':'2025','Оценка':'9,5','Оценка Imdb':8.1,
        'Оценка Кинопоиск':7.8,'Франшиза':'[[Кино/Франшизы/Пример]]',...values};
}
function fixture(){
    const a=movie('A');
    const b=movie('B',{file:{path:'Кино/Media/B.md',name:'B',link:{path:'Кино/Media/B.md'},tags:['#serial']},tags:['serial'],'Жанр':'cRiMe','Оценка':7,'Релиз':'2020 — 2025'});
    const unrelated=movie('Unrelated',{'Режисер':['Other Director'],'Жанр':['Drama']});
    const notMedia=movie('NotMedia',{tags:['books']});
    const systemPage=movie('System',{file:{path:'Кино/_system/System.md',name:'System',link:{path:'Кино/_system/System.md'},tags:['#movies']}});
    const roles=[
        {file:{path:'Кино/_system/Роли/A.роли.md'},'Основная карточка':{path:a.file.path},'Актеры':['Виталий Гогунский'],
            'Роли актеров':['Персонаж - Виталий Гогунский','Vitaly Gogunsky (Виталий Гогунский) - Вторая роль','Персонаж - Виталий Гогунский']},
        {file:{path:'Кино/_system/Роли/B.роли.md'},'Основная карточка':'[[Кино/Media/B|Название с псевдонимом]]','Актеры':['Vitaliy Gogunskiy'],
            'Роли актеров':['Хорошая роль - Виталий Гогунский']},
        {file:{path:'Кино/_system/Роли/Unrelated.роли.md'},'Основная карточка':{path:unrelated.file.path},'Актеры':['Other Actor'],'Роли актеров':['Персонаж - Other Actor']},
        {file:{path:'Кино/_system/Роли/Missing.роли.md'},'Основная карточка':'[[Кино/Media/Missing]]','Актеры':['Виталий Гогунский'],'Роли актеров':['Персонаж - Виталий Гогунский']}
    ];
    return {a,b,movies:[a,b,unrelated,notMedia,systemPage],roles};
}
async function execute(kind,{raw=noteSource(kind),selection=selected[kind],missing=false,fail=false,data=fixture(),app:providedApp,obsidian={}}={}){
    const captured=[],output=[],warnings=[],queries=[],writes=[];
    const moduleFile={path:'Кино/_system/person_ui.js',extension:'js'};
    const app=providedApp||{vault:{
        getAbstractFileByPath:requested=>requested===moduleFile.path&&!missing?moduleFile:null,
        read:async file=>{assert.equal(file,moduleFile);return fail?'module.exports=async()=>{throw new Error("Presentation failed");};':'module.exports=async options=>options.dv.capture(options);';},
        modify:async(...args)=>writes.push(args),create:async(...args)=>writes.push(args)
    }};
    const dv={
        container:{},component:{},
        current:()=>({'Выбрано':selection,file:{path:'Кино/_system/'+noteNames[kind]+'.md'}}),
        pages:query=>{queries.push(query);return {array:()=>query.includes('_system/Роли')?data.roles:data.movies};},
        page:requested=>data.movies.find(page=>page.file.path===requested||page.file.path.replace(/\.md$/,'')===requested)||null,
        header:(level,text)=>output.push({level,text}),paragraph:text=>output.push(text),table:(columns,rows)=>output.push({columns,rows}),
        capture:options=>captured.push(options)
    };
    await new AsyncFunction('dv','app','require','console',queryBlock(raw))(dv,app,()=>obsidian,{warn:(...args)=>warnings.push(args)});
    return {captured,output,warnings,queries,writes,data};
}

test('actor filmography keeps bilingual matching, role extraction, links and complete media values',async()=>{
    const result=await execute('actor');
    assert.equal(result.captured.length,1);
    const view=result.captured[0];
    assert.equal(view.kind,'actor');assert.equal(view.selected,selected.actor);
    assert.deepEqual(view.rows,[{page:result.data.a,role:'Вторая роль · Персонаж'},{page:result.data.b,role:'Хорошая роль'}]);
    assert.equal(view.rows[0].page['Оценка'],'9,5');assert.equal(view.rows[1].page['Релиз'],'2020 — 2025');
    assert.equal(view.rows[0].page['Франшиза'],'[[Кино/Франшизы/Пример]]');
    assert.equal(result.output.length,0,'successful presentation does not duplicate the original heading or table');
    assert.deepEqual(result.queries,['"Кино/_system/Роли"']);assert.equal(result.writes.length,0);
});

test('director filmography keeps original media/tag filtering and original native table definition',async()=>{
    const result=await execute('director');
    assert.equal(result.captured.length,1);
    const view=result.captured[0];assert.equal(view.kind,'director');assert.equal(view.selected,selected.director);
    assert.deepEqual(view.rows,[{page:result.data.a,role:''},{page:result.data.b,role:''}]);
    // Snapshot of the existing native Base, normalizing line endings only.
    // Its original four views, filters, columns and summaries must stay available.
    const hash=crypto.createHash('sha256').update(view.baseSource.replace(/\r\n/g,'\n')).digest('hex');
    assert.equal(hash,baseHashes.director);
    assert.match(view.baseSource,/list\(note\["Режисер"\]\)\.contains\(this\.Выбрано\)/);
    assert.equal(result.output.length,0);assert.equal(result.writes.length,0);
});

test('genre catalogue keeps alias matching, media filtering and complete original native table',async()=>{
    const result=await execute('genre',{selection:'  crime  '});
    assert.equal(result.captured.length,1);
    const view=result.captured[0];assert.equal(view.kind,'genre');assert.equal(view.selected,'Криминал');
    assert.deepEqual(view.rows,[{page:result.data.a,role:''},{page:result.data.b,role:''}]);
    assert.equal(crypto.createHash('sha256').update(view.baseSource.replace(/\r\n/g,'\n')).digest('hex'),baseHashes.genre);
    assert.match(view.baseSource,/list\(note\["Жанр"\]\)\.contains\(this\.Выбрано\)/);
    assert.equal(result.output.length,0);assert.deepEqual(result.queries,['"Кино/Media"']);assert.equal(result.writes.length,0);
});

test('empty selections stay usable and avoid scanning the collection',async()=>{
    for(const kind of kinds){
        const result=await execute(kind,{selection:''});
        assert.equal(result.captured.length,1);assert.equal(result.captured[0].selected,'');assert.deepEqual(result.captured[0].rows,[]);
        assert.equal(result.queries.length,0);assert.equal(result.writes.length,0);
        const fallback=await execute(kind,{selection:'',missing:true});
        assert.equal(fallback.captured.length,0);assert.equal(fallback.queries.length,0);
        assert.ok(fallback.output.some(value=>typeof value==='string'&&/Выбери (?:имя|жанр)/.test(value)));
    }
});

test('missing or failing presentation helper preserves readable statistics and actor table',async()=>{
    for(const kind of kinds)for(const failure of [{missing:true},{fail:true}]){
        const result=await execute(kind,failure);
        assert.equal(result.captured.length,0);
        assert.ok(result.output.some(value=>value?.level===2&&value.text===selected[kind]));
        assert.ok(result.output.some(value=>typeof value==='string'&&/Произведений: 2/.test(value)&&/8\.25/.test(value)));
        assert.equal(result.writes.length,0);
        if(kind==='actor'){
            const table=result.output.find(value=>value?.columns);
            assert.deepEqual(table.columns,['Произведение','Роль','Тип','Релиз','Моя оценка','IMDb','КП','Франшиза']);
            assert.deepEqual(table.rows[0],[result.data.a.file.link,'Вторая роль · Персонаж','Фильм','2025','9,5',8.1,7.8,'[[Кино/Франшизы/Пример]]']);
            assert.equal(table.rows[1][2],'Сериал');
        }
    }
});

test('director and genre fallback tables render in the original note context',async()=>{
    for(const kind of ['director','genre']){
        const calls=[];
        await execute(kind,{missing:true,obsidian:{MarkdownRenderer:{render:async(...args)=>calls.push(args)}}});
        assert.equal(calls.length,1);
        assert.equal(calls[0][3],'Кино/_system/'+noteNames[kind]+'.md','this.Выбрано remains bound to the original note');
        const hash=crypto.createHash('sha256').update(calls[0][1].replace(/\r\n/g,'\n')).digest('hex');
        assert.equal(hash,baseHashes[kind]);
    }
});

async function openFixture(kind,{existing=false}={}){
    const files=new Map(),frontmatter=new Map(),opened=[],modified=[];let refreshes=0;
    const target='Кино/_system/'+noteNames[kind]+'.md';
    const personal={Выбрано:'Previous Person',cssclasses:['personal-class'],Личное:'сохранить'};
    if(existing){const file={path:target,basename:noteNames[kind],extension:'md',raw:'Личная заметка без изменений.'};files.set(target,file);frontmatter.set(target,structuredClone(personal));}
    const moduleFile={path:'Кино/_system/person_ui.js',extension:'js'};files.set(moduleFile.path,moduleFile);
    const layoutFile={path:'Кино/_system/person_page_layout.js',extension:'js'};files.set(layoutFile.path,layoutFile);
    const app={vault:{
        getAbstractFileByPath:requested=>files.get(requested),
        read:async file=>file===moduleFile?'module.exports=async options=>options.dv.capture(options);':file===layoutFile?fs.readFileSync(path.join(system,'person_page_layout.js'),'utf8'):file.raw,
        createFolder:async folder=>files.set(folder,{path:folder}),
        create:async(requested,raw)=>{const file={path:requested,basename:path.basename(requested,'.md'),extension:'md',raw};files.set(requested,file);frontmatter.set(requested,{});return file;},
        modify:async(...args)=>modified.push(args)
    },metadataCache:{getFileCache:file=>({frontmatter:frontmatter.get(file.path)||{}})},
        fileManager:{processFrontMatter:async(file,callback)=>callback(frontmatter.get(file.path))},
        workspace:{getLeaf:()=>({openFile:async file=>opened.push(file),view:{getViewType:()=> 'markdown',previewMode:{rerender:async()=>{refreshes++;}}}})}};
    await require(path.join(system,'open_kino_'+kind+'.js'))({app,obsidian:{parseYaml:()=>({})},quickAddApi:{},variables:{entity:selected[kind]}});
    assert.equal(opened.length,1);assert.equal(frontmatter.get(target).Выбрано,selected[kind]);assert.equal(refreshes,1);
    assert.equal(modified.length,0,'opening a person does not rewrite existing Markdown');
    return {app,file:opened[0],fm:frontmatter.get(target),personal};
}

test('person commands preserve existing note content and unrelated frontmatter while changing selection',async()=>{
    for(const kind of kinds){
        const result=await openFixture(kind,{existing:true});
        assert.equal(result.file.raw,'Личная заметка без изменений.');
        assert.deepEqual(result.fm,{...result.personal,Выбрано:selected[kind]});
    }
});

test('person commands recreate usable filmography pages with the new presentation',async()=>{
    for(const kind of kinds){
        const result=await openFixture(kind);
        const view=await execute(kind,{raw:result.file.raw,app:result.app});
        assert.equal(view.captured.length,1);assert.equal(view.captured[0].kind,kind);assert.equal(view.captured[0].selected,selected[kind]);
        assert.deepEqual(view.captured[0].rows.map(row=>row.page.file.path),['Кино/Media/A.md','Кино/Media/B.md']);
        if(kind==='actor')assert.deepEqual(view.captured[0].rows.map(row=>row.role),['Вторая роль · Персонаж','Хорошая роль']);
        else assert.match(view.captured[0].baseSource,/```base[\s\S]*?name: Лучшие/,'recreated page retains its original native table');
    }
});
