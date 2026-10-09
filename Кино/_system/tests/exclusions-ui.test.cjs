const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ui=require('../exclusions_ui.js'),toggle=require('../toggle_audit_exclusion.js');
const system=path.resolve(__dirname,'..'),note='Кино/_system/Исключения.md';
const source=fs.readFileSync(path.join(system,'Исключения.md'),'utf8');
test('exclusion presentation preserves source data, and real toggle regenerates the design',async()=>{
    const before=ui.entries(source),decorated=ui.ensureLayout(source);
    assert.equal(before.length,6);assert.deepEqual(ui.entries(decorated),before);assert.equal(ui.ensureLayout(decorated),decorated);
    let saved=decorated;
    const app={vault:{getAbstractFileByPath:p=>p.startsWith('Кино/')?{path:p,extension:'md',basename:p.split('/').pop()}:null,
        read:async f=>f.path===note?saved:fs.readFileSync(path.join(system,f.path.split('/').pop()),'utf8'),
        modify:async(f,text)=>{assert.equal(f.path,note);saved=text;}},commands:{commands:{check:{id:'check',name:'Кино - Проверить кинотеку'}},executeCommandById:id=>assert.equal(id,'check')}};
    const obsidian={Notice:class{},normalizePath:p=>p};
    await toggle({app,obsidian,variables:{path:before[0].path,action:'include'}});
    assert.deepEqual(ui.entries(saved),before.slice(1));assert.match(saved,/exclusions_ui\.js/);assert.match(saved,/kino-exclusions-page/);
    await toggle({app,obsidian,variables:{path:before[0].path,action:'exclude'}});
    assert.deepEqual(ui.entries(saved),before);assert.equal(ui.ensureLayout(saved),saved);
});
test('compact exclusions rows work on mobile and desktop, refresh, fold and clean up',async()=>{
    const {chromium}=require('playwright');const browser=await chromium.launch({channel:'chrome',headless:true});
    try{for(const width of [390,1440]){
        const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
        const sources=Object.fromEntries(['exclusions_ui.js','kino-home.css','kino-statistics.css','kino-exclusions.css','Исключения.md'].map(name=>['Кино/_system/'+name,fs.readFileSync(path.join(system,name),'utf8')]));
        const base=fs.readFileSync(path.join(__dirname,'design-ui.test.cjs'),'utf8').match(/const baseStyles = `([\s\S]*?)`;/)[1];
        const vault=path.resolve(system,'../..'),appearance=JSON.parse(fs.readFileSync(path.join(vault,'.obsidian/appearance.json'),'utf8'));
        const snippets=(appearance.enabledCssSnippets||[]).map(n=>path.join(vault,'.obsidian/snippets',n+'.css')).filter(fs.existsSync).map(f=>fs.readFileSync(f,'utf8'));
        await page.setContent('<!doctype html><body class="theme-dark"><div class="markdown-preview-view kino-page kino-home-page kino-exclusions-page"><div class="markdown-preview-sizer"><div class="el-pre"><div id="container"></div></div><h1 id="fallback">Исключения</h1></div></div></body>');
        await page.evaluate(async({sources,base,snippets})=>{
            for(const css of [base,...snippets]){const s=document.createElement('style');s.textContent=css;document.head.append(s);}
            const callbacks=[],refs=new Set(),calls=[],links=[];
            const app={vault:{getAbstractFileByPath:path=>sources[path]?{path}:null,read:async f=>sources[f.path],on:(event,fn)=>{const ref={fn};refs.add(ref);return ref;},offref:ref=>refs.delete(ref)},workspace:{openLinkText:(...args)=>links.push(args)},plugins:{plugins:{quickadd:{api:{executeChoice:async(choice,vars)=>{
                calls.push({choice,vars});sources['Кино/_system/Исключения.md']=sources['Кино/_system/Исключения.md'].split('\n').filter(line=>!line.startsWith('- [['+vars.path+'|')).join('\n');
            }}}}}};
            const component={register:fn=>callbacks.push(fn)},original=async()=>{throw Error('Unexpected render');};component.render=original;
            const mod={exports:{}};new Function('module',sources['Кино/_system/exclusions_ui.js'])(mod);
            window.exTest={calls,links,refs,component,original,unload:()=>callbacks.forEach(f=>f()),empty:()=>{sources['Кино/_system/Исключения.md']='Список пуст.';for(const ref of refs)ref.fn({path:'Кино/_system/Исключения.md'});}};
            await mod.exports({dv:{container:document.getElementById('container'),component},app});
        },{sources,base,snippets});
        assert.equal(await page.locator('.kino-exclusions-row').count(),6);assert.equal(await page.locator('#fallback').isVisible(),false);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        const previews=path.join(system,'redesign-backups/previews');fs.mkdirSync(previews,{recursive:true});await page.screenshot({path:path.join(previews,'exclusions-'+width+'.png'),fullPage:true});
        await page.locator('.kino-exclusions-row a').first().click();assert.equal((await page.evaluate(()=>exTest.links))[0][1],note);
        await page.locator('.kino-exclusions-restore').first().press('Enter');await page.waitForFunction(()=>document.querySelectorAll('.kino-exclusions-row').length===5);
        const calls=await page.evaluate(()=>exTest.calls);assert.equal(calls.length,1);assert.equal(calls[0].choice,'Кино - Переключить исключение аудита');assert.deepEqual(calls[0].vars,{path:ui.entries(source)[0].path,action:'include'});
        await page.locator('summary').press('Enter');assert.equal(await page.locator('details').evaluate(e=>e.open),false);
        await page.evaluate(()=>exTest.empty());await page.waitForFunction(()=>document.querySelector('.kino-exclusions-count').textContent==='0');assert.equal(await page.locator('details').evaluate(e=>e.open),false);
        await page.locator('summary').press('Enter');assert.match(await page.locator('.kino-exclusions-empty').textContent(),/Исключений нет/);
        await page.evaluate(()=>exTest.component.render());assert.equal(await page.locator('.kino-exclusions').count(),1);
        await page.evaluate(()=>exTest.unload());assert.equal(await page.locator('#fallback').isVisible(),true);assert.deepEqual(await page.evaluate(()=>({refs:exTest.refs.size,restored:exTest.component.render===exTest.original})),{refs:0,restored:true});assert.deepEqual(errors,[]);
        await page.close();
    }}finally{await browser.close();}
});
