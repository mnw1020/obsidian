const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const renderer=require('../kino_statistics.js');
const system=path.resolve(__dirname,'..');
function file(folder,name,fm){return {path:`Кино/${folder}/${name}.md`,basename:name,name:name+'.md',extension:'md',fm};}
const fixtures=[
    file('Media','Фильм А',{tags:['movies'],Просмотрено:'2026-05-01',Оценка:'7,5',Релиз:'2001-03-02',Жанр:['Drama','Drama'],Режисер:['Режиссёр А'],'Роли файл':'[[Кино/_system/Роли/Фильм А.роли.md]]'}),
    file('Media','Сериал Б',{tags:['movies','serial'],Просмотрено:'2026-03-03',Оценка:9,Релиз:'2020',Жанр:['Drama']}),
    file('Media','Фильм В',{tags:'#movies',Просмотрено:'2025-01-01',Оценка:0,Релиз:'1999'}),
    file('Media','Без даты',{tags:['movies'],Просмотрено:'2026-02-30',Оценка:''}),
    file('Media/Вложено','Чужой',{tags:['movies'],Оценка:10}),
    file('_system/Роли','Фильм А.роли',{Актеры:['Актёр А','Актёр А'],Жанр:['Comedy'],Режисер:['Режиссёр А']}),
    file('Просмотры','А1',{Фильм:'[[Кино/Media/Фильм А|Фильм А]]',Дата:'2025-01-01',Просмотр:1,Оценка:6}),
    file('Просмотры','А2',{Фильм:'[[Кино/Media/Фильм А.md]]',Дата:'2026-05-01',Просмотр:2,Оценка:'7,5'}),
    file('Сезоны','Б1',{Сериал:'[[Кино/Media/Сериал Б]]',Дата:'2025-02-01',Сезон:1,Оценка:8}),
    file('Сезоны','Б2',{Сериал:'[[Кино/Media/Сериал Б]]',Дата:'2026-03-03',Сезон:2,Оценка:9}),
    file('Просмотры','Без связи',{Фильм:'[[Удалён]]',Дата:'2026-01-01'}),
];
function appFor(files){return {vault:{getMarkdownFiles:()=>files},metadataCache:{getFileCache:f=>({frontmatter:f.fm})}};}
test('history overrides summaries, fallback is counted once, and year/type filters preserve unique works',()=>{
    const data=renderer.collect(appFor(fixtures)),all=renderer.build(data);
    assert.equal(data.records.length,4);assert.equal(data.unlinked,1);
    assert.equal(all.events.length,5);assert.equal(all.repeats,1);assert.deepEqual(all.types,[3,1]);
    assert.equal(all.average,5.5);assert.deepEqual(all.years.map(([y,e])=>[y,e.length]),[['2026',2],['2025',3]]);
    const selected=renderer.build(data,{year:'2026'});assert.equal(selected.records.length,2);assert.equal(selected.events.length,2);
    const month=renderer.build(data,{year:'2026',month:'05'});assert.equal(month.records.length,1);assert.equal(month.events.length,1);
    const serial=renderer.build(data,{type:'serials'});assert.equal(serial.records.length,1);assert.equal(serial.events.length,2);assert.equal(serial.repeats,0);
    assert.deepEqual(all.genres.map(r=>[r.name,r.count]),[['Drama',2],['Comedy',1]]);
    assert.equal(all.directors[0].count,1);assert.equal(all.actors[0].count,1);
    assert.ok(all.ratings.some(([score])=>score===0));assert.equal(all.releases.find(([year])=>year==='Без года')[1].length,1);
    assert.equal(fixtures[0].fm.Жанр.length,2,'Source fields are unchanged');
});
test('invalid history dates are excluded from periods, but retained in all-time history',()=>{
    const files=[file('Media','A',{tags:'movies',Просмотрено:'2026-01-01'}),file('Просмотры','A1',{Фильм:'[[A]]',Дата:'2026-02-30',Просмотр:1})];
    const data=renderer.collect(appFor(files));assert.equal(renderer.build(data).events.length,1);assert.equal(renderer.build(data,{year:'2026'}).events.length,0);
    assert.equal(data.records[0].events[0].fallback,false);assert.deepEqual(renderer.build({records:[],unlinked:0}).types,[0,0]);
});
test('report supports filters, live metadata, table search, keyboard folds, source links and unload on narrow and wide screens',async()=>{
    const {chromium}=require('playwright');const browser=await chromium.launch({channel:'chrome',headless:true});
    try{for(const width of [390,1440]){
        const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
        const css=fs.readFileSync(path.join(__dirname,'design-ui.test.cjs'),'utf8').match(/const baseStyles = `([\s\S]*?)`;/)[1];
        const vault=path.resolve(system,'../..'),appearance=JSON.parse(fs.readFileSync(path.join(vault,'.obsidian/appearance.json'),'utf8'));
        const snippets=(appearance.enabledCssSnippets||[]).map(n=>path.join(vault,'.obsidian/snippets',n+'.css')).filter(fs.existsSync).map(f=>fs.readFileSync(f,'utf8'));
        await page.setContent('<!doctype html><body class="theme-dark"><div class="markdown-preview-view kino-page kino-home-page kino-report-page"><div class="markdown-preview-sizer"><div class="el-pre"><div id="container"></div></div><h1 id="fallback">Итоги просмотров</h1></div></div></body>');
        await page.evaluate(async({source,files,css,home,report,snippets})=>{
            const style=document.createElement('style');style.textContent=css;document.head.append(style);
            const mod={exports:{}};new Function('module',source)(mod);
            class Events{constructor(){this.refs=new Set();}on(event,callback){const ref={event,callback};this.refs.add(ref);return ref;}offref(ref){this.refs.delete(ref);}emit(){for(const ref of this.refs)ref.callback();}}
            const callbacks=[],original=async()=>{throw Error('Dataview should keep the ready report');},component={render:original,register:f=>callbacks.push(f)};
            const vault=Object.assign(new Events(),{getName:()=> 'Тест',getMarkdownFiles:()=>files,getAbstractFileByPath:path=>({path}),read:async f=>f.path.endsWith('kino-home.css')?home:report,modify:()=>{throw Error('Read only');}});
            const metadataCache=Object.assign(new Events(),{getFileCache:f=>({frontmatter:f.fm})});const links=[];
            const app={vault,metadataCache,workspace:{openLinkText:(...args)=>links.push(args)}};
            const dv={container:document.getElementById('container'),component,current:()=>({file:{path:'Кино/_system/Итоги просмотров.md'}})};
            const handle=await mod.exports({dv,app});window.reportTest={app,dv,component,original,handle,files,links,renderer:mod.exports,unload:()=>callbacks.forEach(f=>f())};
            for(const text of snippets){const s=document.createElement('style');s.textContent=text;document.head.append(s);}
        },{source:fs.readFileSync(path.join(system,'kino_statistics.js'),'utf8'),files:fixtures,css,home:fs.readFileSync(path.join(system,'kino-home.css'),'utf8'),report:fs.readFileSync(path.join(system,'kino-statistics.css'),'utf8'),snippets});
        assert.equal(await page.locator('[data-metric],.kino-report-metrics').count(),0);
        assert.equal(await page.locator('[data-section=works] tbody tr').count(),4);
        assert.equal(await page.locator('.kino-home-chart-legend').count(),0);
        await page.getByLabel('Год просмотра',{exact:true}).selectOption('2026');assert.equal(await page.locator('[data-section=works] tbody tr').count(),2);
        await page.getByLabel('Месяц',{exact:true}).selectOption('05');assert.equal(await page.locator('[data-section=works] tbody tr').count(),1);
        const directors=page.locator('[data-section=directors]');await directors.locator('summary').press('Enter');assert.equal(await directors.evaluate(e=>e.open),false);await directors.locator('summary').press('Enter');
        await page.getByRole('button',{name:'За всё время',exact:true}).click();
        const search=page.locator('[data-section=genres] input');await search.fill('Comedy');assert.equal(await page.locator('[data-section=genres] tbody tr').count(),1);
        await page.evaluate(()=>{const t=window.reportTest;t.files[0].fm.Оценка=10;t.app.metadataCache.emit();});
        await page.waitForFunction(()=>document.querySelector('[data-section=works] tbody tr').textContent.includes('10,00'));assert.equal(await search.inputValue(),'Comedy');
        await page.locator('[data-section=works] tbody a[data-href]').first().click({modifiers:['Control']});
        assert.deepEqual(await page.evaluate(()=>window.reportTest.links[0].slice(1)),['Кино/_system/Итоги просмотров.md',true]);
        await page.evaluate(()=>window.reportTest.component.render());assert.equal(await page.locator('.kino-report').count(),1);
        assert.equal(await page.locator('#fallback').isVisible(),false);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        assert.deepEqual(await page.locator('.kino-report-section,.kino-report-grid').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length&&n.scrollWidth>n.clientWidth+1).map(n=>n.className)),[]);
        const preview=path.join(system,'redesign-backups/previews');fs.mkdirSync(preview,{recursive:true});await page.screenshot({path:path.join(preview,`statistics-${width}.png`),fullPage:true});
        await page.evaluate(()=>window.reportTest.unload());assert.equal(await page.locator('.kino-report').count(),0);assert.equal(await page.locator('#fallback').isVisible(),true);
        assert.deepEqual(await page.evaluate(()=>({vault:window.reportTest.app.vault.refs.size,cache:window.reportTest.app.metadataCache.refs.size,restored:window.reportTest.component.render===window.reportTest.original})),{vault:0,cache:0,restored:true});
        assert.deepEqual(errors,[]);await page.close();
    }}finally{await browser.close();}
});
