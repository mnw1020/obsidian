const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ui=require('../journal_ui.js');
const system=path.resolve(__dirname,'..'),note='Кино/_system/Журнал изменений.md';
const fixture='---\nobsidianUIMode: source\ncssclasses: ["my-journal"]\nЛичное поле: "Сохранить"\n---\n\n# Журнал изменений\n\n[[Кино/_index|← Кинотека]]\n\n> История обслуживания кинотеки.\n\n'+
    '<!-- KINO-AUDIT-EVENT at="2026-09-17T00:00:00Z" structure="true" -->\n## 17.09.2026\n\n- Исправлены **2** карточки.\n- Проверена [[Кино/Media/Локи|карточка Локи]].\n\n'+
    '<!-- KINO-AUDIT-EVENT at="2026-09-17T00:00:00Z" roles="true" -->\n## 17.09.2026 — роли актёров\n\n- Добавлены роли актёров.\n';
const extra='\n<!-- KINO-AUDIT-EVENT at="2026-10-12T12:30:00" structure="true" -->\n## 12.10.2026 12:30\n\n- Новое безопасное исправление.\n';

test('journal layout retains metadata and distinct events with equal timestamps',()=>{
    for(const raw of [fixture,fixture.replace(/\n/g,'\r\n')]){
        const before=ui.entries(raw),decorated=ui.ensureLayout(raw);
        assert.equal(before.length,2);assert.equal(new Set(before.map(entry=>entry.key)).size,2);
        assert.deepEqual(before.map(entry=>entry.at),['2026-09-17T00:00:00Z','2026-09-17T00:00:00Z']);
        assert.deepEqual(ui.entries(decorated),before);assert.equal(ui.ensureLayout(decorated),decorated);
        assert.match(decorated,/Личное поле: "Сохранить"/);assert.match(decorated,/my-journal/);
        assert.match(decorated,/obsidianUIMode: preview/);assert.match(decorated,/journal_ui\.js/);assert.match(decorated,/kino-journal-page/);
        assert.equal((decorated.match(/<!-- KINO:UI:START -->/g)||[]).length,1);
        const cleared=ui.clearEntries(decorated);
        assert.deepEqual(ui.entries(cleared),[]);assert.match(cleared,/Личное поле: "Сохранить"/);assert.match(cleared,/# Журнал изменений/);assert.match(cleared,/journal_ui\.js/);
        assert.equal(ui.clearEntries(cleared),cleared);assert.equal(ui.entries(cleared+extra).length,1);
    }
    const legacy='# Журнал изменений\n\n## 10.10.2026\n\n- Запись без служебного комментария.\n';
    assert.equal(ui.entries(legacy).length,1);assert.deepEqual(ui.entries(ui.clearEntries(legacy)),[]);
});

function vaultFixture(raw,{concurrent=false}={}){
    const texts=new Map([[note,raw]]),files=new Map([[note,{path:note}],['Кино/_system/redesign-backups',{path:'Кино/_system/redesign-backups'}]]),writes=[];
    const app={vault:{
        getAbstractFileByPath:p=>files.get(p)||null,
        read:async file=>texts.get(file.path),
        createFolder:async p=>{files.set(p,{path:p});},
        create:async(p,text)=>{assert.equal(files.has(p),false,'backups never replace existing files');const file={path:p};files.set(p,file);texts.set(p,text);writes.push(p);return file;},
        process:async(file,transform)=>{if(concurrent)texts.set(note,texts.get(note)+extra);const next=transform(texts.get(file.path));texts.set(file.path,next);writes.push(file.path);return next;}
    }};
    return {app,texts,files,writes};
}

test('clear copies the exact raw journal, keeps its interface and allows future appends',async()=>{
    const raw=ui.ensureLayout(fixture).replace(/\n/g,'\r\n'),f=vaultFixture(raw);
    const result=await ui.clearJournal(f.app);
    assert.equal(result.cleared,2);assert.match(result.backupPath,/^Кино\/_system\/redesign-backups\/journal-[^/]+\.md$/);
    assert.equal(f.texts.get(result.backupPath),raw);assert.deepEqual(ui.entries(f.texts.get(note)),[]);
    assert.match(f.texts.get(note),/journal_ui\.js/);assert.match(f.texts.get(note),/Личное поле: "Сохранить"/);
    assert.equal(ui.entries(f.texts.get(note)+extra).length,1);
    const writes=f.writes.length;assert.deepEqual(await ui.clearJournal(f.app),{cleared:0,backupPath:null});assert.equal(f.writes.length,writes);
    const appended=f.texts.get(note)+extra;f.texts.set(note,appended);
    const next=await ui.clearJournal(f.app);assert.equal(next.cleared,1);assert.notEqual(next.backupPath,result.backupPath);assert.equal(f.texts.get(next.backupPath),appended);assert.equal(f.texts.get(result.backupPath),raw);
});

test('a concurrent journal update cannot be silently discarded by clear',async()=>{
    const raw=ui.ensureLayout(fixture),f=vaultFixture(raw,{concurrent:true});
    await assert.rejects(()=>ui.clearJournal(f.app),/измен|обнов|конфликт|changed|conflict/i);
    assert.equal(f.texts.get(note),raw+extra);assert.equal(ui.entries(f.texts.get(note)).length,3);
    assert.deepEqual(f.writes.filter(p=>p===note),[]);
    const backup=f.writes.find(p=>p!==note);assert.ok(backup);assert.equal(f.texts.get(backup),raw);
});

test('safe-fix creation retains the dedicated journal interface',async()=>{
    const mod={exports:{}};new Function('module',fs.readFileSync(path.join(system,'safe_fix_kino.js'),'utf8')+'\nmodule.exports.decorate=withKinoLayout;')(mod);
    const app={vault:{getAbstractFileByPath:p=>fs.existsSync(path.join(system,p.split('/').pop()))?{path:p}:null,
        read:async file=>fs.readFileSync(path.join(system,file.path.split('/').pop()),'utf8')}};
    const result=await mod.exports.decorate(app,{},fixture,'system');
    assert.match(result,/journal_ui\.js/);assert.match(result,/kino-journal-page/);assert.deepEqual(ui.entries(result),ui.entries(fixture));
});

test('real safe-fix appends to the newest journal source and creates its interface when missing',async()=>{
    const safeFix=require('../safe_fix_kino.js'),card={path:'Кино/Media/Тест.md',extension:'md',basename:'Тест'};
    for(const missing of [false,true]){
        let saved=missing?null:ui.ensureLayout(fixture),processed=0,created=0;
        const fields={tags:['movies'],Жанр:['Драма','Драма']};
        const app={vault:{
            getMarkdownFiles:()=>[card],
            getAbstractFileByPath:p=>p===note?(saved===null?null:{path:p}):p==='Кино/_system/journal_ui.js'?{path:p}:null,
            read:async file=>{if(file.path===note)throw Error('Existing journals must use atomic process');return fs.readFileSync(path.join(system,'journal_ui.js'),'utf8');},
            process:async(file,transform)=>{assert.equal(file.path,note);processed++;saved=transform(saved+extra);},
            create:async(p,raw)=>{assert.equal(p,note);assert.equal(saved,null);created++;saved=raw;return {path:p};},
            modify:async()=>{throw Error('Atomic append must not overwrite a stale source');}
        },metadataCache:{getFileCache:()=>({frontmatter:fields})},fileManager:{processFrontMatter:async(file,transform)=>{assert.equal(file.path,card.path);transform(fields);}}};
        await safeFix({app,obsidian:{normalizePath:p=>p,Notice:class{}}});
        assert.deepEqual(fields.Жанр,['Драма']);assert.equal(processed,missing?0:1);assert.equal(created,missing?1:0);
        assert.match(saved,/journal_ui\.js/);const entries=ui.entries(saved);assert.equal(entries.length,missing?1:4);
        assert.match(entries.at(-1).body,/Кино\/Media\/Тест\.md/);assert.match(entries.at(-1).body,/Изменено карточек/);
        if(!missing){assert.deepEqual(entries.slice(0,2),ui.entries(fixture));assert.match(entries[2].body,/Новое безопасное исправление/);}
    }
});

test('journal supports mobile and desktop refresh, keyboard clear, exact backups and cleanup',async()=>{
    const {chromium}=require('playwright'),browser=await chromium.launch({channel:'chrome',headless:true});
    try{for(const width of [390,1440]){
        const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
        const sources=Object.fromEntries(['journal_ui.js','kino-home.css','kino-statistics.css','kino-journal.css'].map(name=>['Кино/_system/'+name,fs.readFileSync(path.join(system,name),'utf8')]));
        sources[note]=ui.ensureLayout(fixture);
        const base=fs.readFileSync(path.join(__dirname,'design-ui.test.cjs'),'utf8').match(/const baseStyles = `([\s\S]*?)`;/)[1];
        const vault=path.resolve(system,'../..'),appearance=JSON.parse(fs.readFileSync(path.join(vault,'.obsidian/appearance.json'),'utf8'));
        const snippets=(appearance.enabledCssSnippets||[]).map(name=>path.join(vault,'.obsidian/snippets',name+'.css')).filter(fs.existsSync).map(file=>fs.readFileSync(file,'utf8'));
        await page.setContent('<!doctype html><body class="theme-dark"><div class="markdown-preview-view kino-page kino-home-page kino-journal-page"><div class="markdown-preview-sizer"><div class="el-pre"><div id="container"></div></div><h1 id="fallback">Журнал изменений</h1></div></div></body>');
        await page.evaluate(async({sources,base,snippets,note,extra})=>{
            for(const css of [base,...snippets]){const style=document.createElement('style');style.textContent=css;document.head.append(style);}
            const refs=new Set(),callbacks=[],children=new Set(),backups=[],links=[];
            const emit=(filePath=note)=>{for(const ref of refs)if(ref.event==='modify')ref.fn({path:filePath});};
            const app={vault:{
                getAbstractFileByPath:p=>p==='Кино/_system/redesign-backups'||Object.hasOwn(sources,p)?{path:p}:null,
                read:async file=>sources[file.path],
                createFolder:async()=>{},
                create:async(p,raw)=>{if(Object.hasOwn(sources,p))throw Error('Backup exists');sources[p]=raw;backups.push({path:p,raw});return {path:p};},
                process:async(file,transform)=>{sources[file.path]=transform(sources[file.path]);emit(file.path);return sources[file.path];},
                modify:async(file,raw)=>{sources[file.path]=raw;emit(file.path);},
                on:(event,fn)=>{const ref={event,fn};refs.add(ref);return ref;},offref:ref=>refs.delete(ref)
            },workspace:{openLinkText:(...args)=>links.push(args)}};
            class Component{constructor(){this.callbacks=[];}register(fn){this.callbacks.push(fn);}unload(){this.callbacks.splice(0).forEach(fn=>fn());}}
            const component={register:fn=>callbacks.push(fn),addChild:child=>children.add(child),removeChild:child=>{children.delete(child);child.unload();}};
            const original=async()=>{throw Error('Ready journal must retain state');};component.render=original;
            function inline(parent,text){
                for(const chunk of text.split(/(\*\*[^*]+\*\*|\[\[[^\]]+\]\]|`[^`]+`)/g)){
                    const tag=chunk.startsWith('**')?'strong':chunk.startsWith('`')?'code':chunk.startsWith('[[')?'a':null;
                    if(!tag){parent.append(document.createTextNode(chunk));continue;}
                    const node=document.createElement(tag);if(tag==='a'){const parts=chunk.slice(2,-2).split('|');node.textContent=parts[1]||parts[0];node.href=parts[0];node.className='internal-link';}else node.textContent=tag==='strong'?chunk.slice(2,-2):chunk.slice(1,-1);parent.append(node);
                }
            }
            const obsidian={Component,Notice:class{},MarkdownRenderer:{render:async(app,text,parent)=>{
                for(const block of text.split(/\n\n/)){if(!block.trim())continue;if(block.startsWith('- ')){const ul=document.createElement('ul');for(const line of block.split('\n')){const li=document.createElement('li');inline(li,line.replace(/^- /,''));ul.append(li);}parent.append(ul);}else{const p=document.createElement('p');inline(p,block);parent.append(p);}}
            }}};
            const mod={exports:{}};new Function('module',sources['Кино/_system/journal_ui.js'])(mod);
            window.journalTest={app,obsidian,render:mod.exports,component,original,refs,children,backups,links,raw:()=>sources[note],unload:()=>callbacks.forEach(fn=>fn()),append:()=>{sources[note]+=extra;emit();}};
            await mod.exports({dv:{container:document.getElementById('container'),component},app,obsidian});
        },{sources,base,snippets,note,extra});
        assert.equal(await page.locator('.kino-journal-entry').count(),2);assert.match(await page.locator('.kino-journal-entry summary').first().textContent(),/роли актёров/);
        assert.match(await page.locator('.kino-journal-count').textContent(),/2/);assert.equal(await page.locator('#fallback').isVisible(),false);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        assert.deepEqual(await page.locator('.kino-home-masthead,.kino-journal-entry').evaluateAll(nodes=>nodes.filter(node=>node.getClientRects().length&&node.scrollWidth>node.clientWidth+1).map(node=>node.className)),[]);
        const previews=path.join(system,'redesign-backups/previews');fs.mkdirSync(previews,{recursive:true});await page.screenshot({path:path.join(previews,'journal-populated-'+width+'.png'),fullPage:true});
        const roles=page.locator('.kino-journal-entry').filter({hasText:'17.09.2026 — роли актёров'});
        await roles.locator('summary').press('Enter');assert.equal(await roles.evaluate(node=>node.open),false);
        await page.evaluate(()=>journalTest.append());await page.waitForFunction(()=>document.querySelectorAll('.kino-journal-entry').length===3);
        assert.equal(await roles.evaluate(node=>node.open),false);assert.match(await page.locator('.kino-journal-entry summary').first().textContent(),/12\.10\.2026/);
        await page.evaluate(()=>journalTest.component.render());assert.equal(await page.locator('.kino-journal').count(),1);
        const before=await page.evaluate(()=>journalTest.raw()),clear=page.locator('.kino-journal-clear');assert.equal(await clear.textContent(),'Почистить');assert.equal(await clear.isEnabled(),true);
        await clear.press('Enter');await page.waitForFunction(()=>document.querySelectorAll('.kino-journal-entry').length===0);
        assert.equal(await clear.isDisabled(),true);assert.match(await page.locator('.kino-journal-count').textContent(),/0/);assert.equal(await page.locator('.kino-journal-empty').isVisible(),true);
        const backups=await page.evaluate(()=>journalTest.backups);assert.equal(backups.length,1);assert.equal(backups[0].raw,before);
        assert.match(backups[0].path,/^Кино\/_system\/redesign-backups\/journal-[^/]+\.md$/);assert.deepEqual(ui.entries(await page.evaluate(()=>journalTest.raw())),[]);
        assert.match(await page.locator('.kino-journal-status').textContent(),/очищ|чист/i);
        await page.locator('.kino-journal-backup').click();assert.deepEqual(await page.evaluate(()=>journalTest.links.at(-1)),[backups[0].path,note,false]);
        await page.screenshot({path:path.join(previews,'journal-'+width+'.png'),fullPage:true});
        await page.evaluate(()=>journalTest.append());await page.waitForFunction(()=>document.querySelectorAll('.kino-journal-entry').length===1);assert.equal(await clear.isEnabled(),true);
        await page.evaluate(()=>journalTest.unload());assert.equal(await page.locator('.kino-journal').count(),0);assert.equal(await page.locator('#fallback').isVisible(),true);
        assert.deepEqual(await page.evaluate(()=>({refs:journalTest.refs.size,children:journalTest.children.size,restored:journalTest.component.render===journalTest.original})),{refs:0,children:0,restored:true});
        await page.evaluate(async backupPath=>{
            const callbacks=[],children=new Set(),original=async()=>{throw Error('Ready archive must retain state');};
            const component={register:fn=>callbacks.push(fn),addChild:child=>children.add(child),removeChild:child=>{children.delete(child);child.unload();},render:original};
            window.archiveTest={component,original,children,unload:()=>callbacks.forEach(fn=>fn())};
            await journalTest.render({dv:{container:document.getElementById('container'),component,current:()=>({file:{path:backupPath}})},app:journalTest.app,obsidian:journalTest.obsidian});
        },backups[0].path);
        assert.equal(await page.locator('.kino-home-title').textContent(),'Копия журнала изменений');assert.equal(await page.locator('.kino-journal-entry').count(),3);
        assert.equal(await page.locator('.kino-journal-clear').isVisible(),false);assert.match(await page.locator('.kino-journal-count').textContent(),/3/);
        await page.evaluate(()=>journalTest.append());await page.waitForTimeout(150);assert.equal(await page.locator('.kino-journal-entry').count(),3);
        await page.evaluate(()=>archiveTest.component.render());assert.equal(await page.locator('.kino-journal').count(),1);
        await page.evaluate(()=>archiveTest.unload());assert.equal(await page.locator('.kino-journal').count(),0);
        assert.deepEqual(await page.evaluate(()=>({refs:journalTest.refs.size,children:archiveTest.children.size,restored:archiveTest.component.render===archiveTest.original})),{refs:0,children:0,restored:true});
        assert.deepEqual(errors,[]);await page.close();
    }}finally{await browser.close();}
});
