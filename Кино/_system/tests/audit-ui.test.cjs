const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const audit=require('../audit_ui.js');
const system=path.resolve(__dirname,'..');
test('audit report layout preserves every result and is retained by the audit generator',async()=>{
    const raw=fs.readFileSync(path.join(system,'Проверка кинотеки.md'),'utf8'),decorated=audit.ensureLayout(raw);
    assert.equal(audit.ensureLayout(decorated),decorated);assert.deepEqual(audit.sections(decorated),audit.sections(raw));assert.equal(audit.sections(raw).length,6);
    assert.match(decorated,/obsidianUIMode: preview/);assert.match(decorated,/kino-audit-page/);
    const module={exports:{}};new Function('module',fs.readFileSync(path.join(system,'audit_kino.js'),'utf8')+'\nmodule.exports.decorate=withKinoLayout;')(module);
    const app={vault:{getAbstractFileByPath:path=>({path}),read:async file=>fs.readFileSync(path.join(system,file.path.split('/').pop()),'utf8')}};
    const regenerated=await module.exports.decorate(app,{},'# Проверка кинотеки\n\n## Ошибки\n\nТестовая ошибка.\n','system');
    assert.match(regenerated,/audit_ui\.js/);assert.match(regenerated,/Тестовая ошибка/);assert.match(regenerated,/kino-audit-page/);
});
test('audit page uses shared style, explicit command tooltip, global update progress and live report refresh',async()=>{
    const {chromium}=require('playwright');const browser=await chromium.launch({channel:'chrome',headless:true});
    try{for(const width of [390,1440]){
        const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
        const sources=Object.fromEntries(['audit_ui.js','kino-home.css','kino-statistics.css','kino-audit.css','Проверка кинотеки.md'].map(name=>['Кино/_system/'+name,fs.readFileSync(path.join(system,name),'utf8')]));
        sources['Кино/_system/update_ratings.js']=`module.exports=async params=>{window.auditTest.calls.push(params.scope);params.onProgress({phase:'predicting',completed:1,total:2});await new Promise(resolve=>setTimeout(resolve,50));return {updated:2,unchanged:0,failed:[],cancelled:params.shouldCancel()};};module.exports.ensureCommand=async()=>{};`;
        const base=fs.readFileSync(path.join(__dirname,'design-ui.test.cjs'),'utf8').match(/const baseStyles = `([\s\S]*?)`;/)[1];
        const vault=path.resolve(system,'../..'),appearance=JSON.parse(fs.readFileSync(path.join(vault,'.obsidian/appearance.json'),'utf8'));
        const snippets=(appearance.enabledCssSnippets||[]).map(name=>path.join(vault,'.obsidian/snippets',name+'.css')).filter(fs.existsSync).map(file=>fs.readFileSync(file,'utf8'));
        await page.setContent('<!doctype html><body class="theme-dark"><div class="markdown-preview-view kino-page kino-home-page kino-audit-page"><div class="markdown-preview-sizer"><div class="el-pre"><div id="container"></div></div><h1 id="fallback">Проверка кинотеки</h1></div></div></body>');
        await page.evaluate(async({sources,base,snippets})=>{
            const style=document.createElement('style');style.textContent=base;document.head.append(style);
            const refs=new Set(),callbacks=[],children=new Set(),choices=[],links=[],calls=[];
            const vault={getAbstractFileByPath:path=>sources[path]?{path}:null,read:async f=>sources[f.path],on:(event,fn)=>{const ref={event,fn};refs.add(ref);return ref;},offref:ref=>refs.delete(ref)};
            const app={vault,workspace:{openLinkText:(...args)=>links.push(args)},plugins:{plugins:{quickadd:{api:{executeChoice:async choice=>choices.push(choice)}}}}};
            class Component{unload(){}}
            const component={register:fn=>callbacks.push(fn),addChild:child=>children.add(child),removeChild:child=>{children.delete(child);child.unload();}};
            const original=async()=>{throw Error('Ready page must retain state');};component.render=original;
            function inline(parent,text){
                for(const chunk of text.split(/(\*\*[^*]+\*\*|\[\[[^\]]+\]\]|`[^`]+`)/g)){
                    const tag=chunk.startsWith('**')?'strong':chunk.startsWith('`')?'code':chunk.startsWith('[[')?'a':null;
                    if(!tag){parent.append(document.createTextNode(chunk));continue;}const node=document.createElement(tag);
                    if(tag==='a'){const parts=chunk.slice(2,-2).split('|');node.textContent=parts[1]||parts[0];node.href=parts[0];}else node.textContent=tag==='strong'?chunk.slice(2,-2):chunk.slice(1,-1);parent.append(node);
                }
            }
            const dv={container:document.getElementById('container'),component};const obsidian={Component,MarkdownRenderer:{render:async(app,text,parent)=>{
                for(const block of text.split(/\n\n/)){if(block.startsWith('- ')){const ul=document.createElement('ul');for(const line of block.split('\n')){const li=document.createElement('li');inline(li,line.replace(/^- /,''));ul.append(li);}parent.append(ul);}else{const p=document.createElement('p');inline(p,block);parent.append(p);}}
            }}};
            const mod={exports:{}};new Function('module',sources['Кино/_system/audit_ui.js'])(mod);
            window.auditTest={app,dv,refs,choices,links,calls,component,original,children,unload:()=>callbacks.forEach(f=>f()),modify:()=>{sources['Кино/_system/Проверка кинотеки.md']+='\n## Новый результат\n\nОбновлено.\n';for(const ref of refs)ref.fn({path:'Кино/_system/Проверка кинотеки.md'});}};
            await mod.exports({dv,app,obsidian});
            for(const css of snippets){const style=document.createElement('style');style.textContent=css;document.head.append(style);}
        },{sources,base,snippets});
        const button=page.locator('[data-action=ratings]');assert.match(await button.getAttribute('title'),/QuickAdd: Кино - Обновить оценки/);assert.equal(await page.locator('.kino-report-section').count(),6);
        await button.click();await button.dispatchEvent('click');await page.waitForFunction(()=>document.querySelector('.kino-audit-status').textContent.includes('Обновлено прогнозов: 2'));
        assert.deepEqual(await page.evaluate(()=>window.auditTest.calls),['all']);
        await page.getByRole('button',{name:'Проверить',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.auditTest.choices),['Кино - Проверить кинотеку']);
        const first=page.locator('.kino-report-section').first();await first.locator('summary').press('Enter');assert.equal(await first.evaluate(e=>e.open),false);
        await page.evaluate(()=>window.auditTest.modify());await page.locator('[data-section="Новый результат"]').waitFor();assert.equal(await first.evaluate(e=>e.open),false);
        await page.evaluate(()=>window.auditTest.component.render());assert.equal(await page.locator('.kino-audit').count(),1);
        assert.equal(await page.locator('#fallback').isVisible(),false);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        assert.deepEqual(await page.locator('.kino-home-masthead,.kino-report-section').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length&&n.scrollWidth>n.clientWidth+1).map(n=>n.className)),[]);
        const previews=path.join(system,'redesign-backups/previews');fs.mkdirSync(previews,{recursive:true});await page.screenshot({path:path.join(previews,'audit-'+width+'.png'),fullPage:true});
        await page.evaluate(()=>window.auditTest.unload());assert.equal(await page.locator('.kino-audit').count(),0);assert.equal(await page.locator('#fallback').isVisible(),true);
        assert.deepEqual(await page.evaluate(()=>({refs:window.auditTest.refs.size,children:window.auditTest.children.size,restored:window.auditTest.component.render===window.auditTest.original})),{refs:0,children:0,restored:true});assert.deepEqual(errors,[]);await page.close();
    }}finally{await browser.close();}
});
