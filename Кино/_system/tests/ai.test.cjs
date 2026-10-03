const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../ai_core.js'),crypt=require('../ai_crypto.js'),recommend=require('../openai_recommendations.js');
const fixture=()=>({version:3,activeConnectionId:'test',connections:[{id:'test',name:'Test',apiKey:'test-secret',baseUrl:'https://example.test/v1',protocol:'responses',model:'model-a',models:[{id:'model-a',check:{state:'unchecked'}},{id:'model-b'}]}]});
const film={ruTitle:'Экзамен',enTitle:'Exam',year:2009,description:'Описание',reason:'Причина',genres:['thriller']};
const reference={ruTitle:'Матрица',enTitle:'The Matrix',year:1999,genres:[]};
test('selection repair, empty state, per-model route, URL validation and model duplicates',()=>{
    const s=fixture();s.connections[0].model='missing';assert.equal(core.normalize(s).connections[0].model,'model-a');
    s.activeConnectionId='missing';assert.equal(core.normalize(s).activeConnectionId,'test');
    s.connections[0].models[0].route={baseUrl:'https://example.test/anthropic',protocol:'anthropic'};s.connections[0].model='model-a';s.activeConnectionId='test';
    assert.equal(core.endpoint(core.resolve(s).baseUrl,'anthropic'),'https://example.test/anthropic/v1/messages');
    assert.equal(core.endpoint('https://example.test/anthropic/v1','anthropic'),'https://example.test/anthropic/v1/messages');
    assert.equal(core.cleanUrl('[https://example.test/v1](https://example.test/v1)'),'https://example.test/v1');
    assert.throws(()=>core.cleanUrl('https://user:pass@example.test/v1'));
    s.connections[0].models.push({id:'model-a'});assert.throws(()=>core.validate(s),/уникальные/);
    assert.throws(()=>core.resolve({version:3,connections:[]}),/подключение/);
    const empty=fixture();empty.connections[0].models=[];assert.equal(core.normalize(empty).connections[0].model,'');
});
test('encrypted version 3 round-trip and wrong password',async()=>{
    const s=fixture(),sealed=await crypt.create(s,'test-password-123');const opened=await crypt.unlock(sealed.envelope,'test-password-123');assert.deepEqual(opened.settings,s);
    await assert.rejects(()=>crypt.unlock(sealed.envelope,'wrong-password'),/Неверный пароль/);
    assert.ok(!JSON.stringify(sealed.envelope).includes('test-secret'));
});
for(const protocol of ['responses','chat','anthropic'])test(`${protocol}: request, parsing and separate server cache`,async()=>{
    const s=fixture();s.connections[0].protocol=protocol;const cache={};let count=0;
    const request=async options=>{count++;const body=JSON.parse(options.body);assert.equal(body.model,'model-a');assert.equal(options.headers.Authorization,'Bearer test-secret');assert.equal(options.url,core.endpoint(s.connections[0].baseUrl,protocol));
        if(protocol==='responses')assert.ok(body.text.format.schema);else assert.ok(body.messages);
        const text=JSON.stringify({films:[film,film,{...film,year:'invalid'}]});return {status:200,json:protocol==='responses'?{status:'completed',output:[{content:[{type:'output_text',text}]}]}:protocol==='chat'?{choices:[{finish_reason:'stop',message:{content:text}}]}:{stop_reason:'end_turn',content:[{type:'text',text}]}};};
    const run=()=>recommend({settings:s,core,reference,taste:[],cache,request});
    assert.equal((await run()).items.length,1);assert.equal((await run()).cacheHit,true);assert.equal(count,1);
    s.connections[0].baseUrl='https://second.test/v1';await run();assert.equal(count,2);
});
test('HTTP errors, non-JSON, timeout and secret redaction',async()=>{
    for(const [status,message]of [[401,'недействителен'],[402,'средств'],[429,'лимит'],[404,'не найдены']])await assert.rejects(()=>core.call(async()=>({status,json:{error:{message:'test-secret'}}}),{headers:{Authorization:'Bearer test-secret'}}),new RegExp(message));
    await assert.rejects(()=>core.call(async()=>({status:200,text:'not JSON'}),{}),/не является JSON/);
    await assert.rejects(()=>core.call(()=>new Promise(()=>{}),{},5),/ожидания/);
    await assert.rejects(()=>core.call(async()=>{throw Error('Authorization Bearer test-secret sk-test-key')},{headers:{Authorization:'Bearer test-secret'}}),e=>!e.message.includes('test-secret')&&!e.message.includes('sk-test-key'));
});
test('model discovery paginates and deduplicates without filtering model families',async()=>{
    let count=0;const ids=await core.loadModels(async o=>{count++;return{status:200,json:count===1?{data:[{id:'claude-a'},{id:'gemini-b'}],has_more:true,last_id:'page-1'}:{data:[{id:'gemini-b'},{id:'gpt-c'}]}}},fixture().connections[0]);assert.deepEqual(ids,['claude-a','gemini-b','gpt-c']);assert.equal(count,2);
});

test('modal editing, cancellation, save, encryption, conflicts, empty state and responsive layout',async()=>{
    const fs=require('fs'),path=require('path'),os=require('os'),http=require('http');
    const {chromium}=require('playwright');
    const sources=Object.fromEntries(['ai_settings','ai_core','ai_crypto'].map(n=>[n,fs.readFileSync(path.join(__dirname,'..',n+'.js'),'utf8')]));
    const s=fixture();s.connections[0].name='Tokenator';s.connections[0].models[0].check={state:'verified'};
    const sealed=await crypt.create(s,'test-password-123');const text=JSON.stringify(sealed.envelope);
    const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><body><main id="root"></main></body></html>')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const browser=await chromium.launch({channel:process.env.AI_TEST_BROWSER||'chrome',headless:true});
    try{
        const page=await browser.newPage({viewport:{width:1100,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.evaluate(async({sources,text})=>{
            Element.prototype.createEl=function(tag,options={}){const el=document.createElement(tag);if(options.text!==undefined)el.textContent=options.text;if(options.cls)el.className=options.cls;for(const key of ['type','value'])if(options[key]!==undefined)el[key]=options[key];this.append(el);return el;};
            Element.prototype.createDiv=function(options){return this.createEl('div',typeof options==='string'?{cls:options}:options);};Element.prototype.empty=function(){this.replaceChildren();};Element.prototype.setText=function(text){this.textContent=text;};Element.prototype.appendText=function(text){this.append(document.createTextNode(text));};
            document.head.createEl('style',{text:':root{--background-primary:#fff;--background-secondary:#f6f6f6;--background-modifier-border:#ddd;--interactive-accent:#6953bc;--text-on-accent:white;--text-muted:#666;--text-error:#c22;--font-ui-small:13px;--font-ui-smaller:12px}*{box-sizing:border-box}body{font:14px Arial;background:var(--background-primary);color:var(--text-normal,#222);margin:16px}button,input,select{font:inherit;padding:7px;border:1px solid var(--background-modifier-border);border-radius:5px;background:var(--background-primary);color:inherit}button{cursor:pointer}button.mod-cta{background:var(--interactive-accent);color:white}.modal{position:fixed;top:20px;left:50%;transform:translateX(-50%);background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:12px;padding:20px;max-height:94vh;box-shadow:0 8px 60px #0004;display:flex;flex-direction:column}.modal-title{font-size:20px;margin-bottom:16px}.modal-content{min-height:0}h3{margin:4px 0}'});
            class Modal{constructor(){this.modalEl=document.body.createDiv({cls:'modal'});this.titleEl=this.modalEl.createDiv({cls:'modal-title'});this.contentEl=this.modalEl.createDiv({cls:'modal-content'});}open(){this.onOpen();}close(){this.onClose();this.modalEl.remove();}}
            const files={'Кино/_system/ai_settings.enc.json':text,...Object.fromEntries(Object.entries(sources).map(([n,v])=>[`Кино/_system/${n}.js`,v]))};
            const app={vault:{getAbstractFileByPath:p=>files[p]!==undefined?{path:p}:null,read:async f=>files[f.path],modify:async(f,text)=>{files[f.path]=text;},create:async(p,text)=>{files[p]=text;return{path:p}},delete:async f=>delete files[f.path]}};
            window.test={app,files,applied:[],copied:'',sources,Modal,root:document.querySelector('#root')};
            const m={exports:{}};new Function('module',sources.ai_settings)(m);window.test.mount=m.exports;
            await m.exports({app,container:window.test.root,Modal,copyText:async v=>window.test.copied=v,onApply:async v=>window.test.applied.push(v),request:async()=>({status:200,json:{data:[{id:'model-b'},{id:'model-c'}]}})});
        },{sources,text});
        await page.getByLabel('Пароль для расшифровки',{exact:true}).fill('test-password-123');await page.getByRole('button',{name:'Расшифровать',exact:true}).click();await page.getByLabel('Подключение',{exact:true}).waitFor();
        const open=()=>page.getByRole('button',{name:'⚙ Настройки ИИ',exact:true}).click();await open();
        assert.equal(await page.getByLabel('Ключ API',{exact:true}).getAttribute('type'),'password');
        await page.getByRole('button',{name:'Загрузить модели',exact:true}).click();await page.getByText('Добавлено моделей: 1.',{exact:false}).waitFor();assert.equal(await page.locator('.kino-ai-model').count(),3);
        await page.getByRole('button',{name:'Отмена',exact:true}).click();await page.getByRole('button',{name:'Не сохранять',exact:true}).click();assert.equal(await page.locator('.modal').count(),0);
        await open();assert.equal(await page.locator('.kino-ai-model').count(),2);
        await page.getByLabel('Идентификатор модели',{exact:true}).fill('custom-model');await page.getByRole('button',{name:'Добавить',exact:true}).click();
        const card=page.locator('.kino-ai-model').filter({hasText:'custom-model'});await card.locator('summary').click();await card.getByLabel('Сервер модели',{exact:true}).selectOption('custom');await card.getByLabel('Адрес сервера модели',{exact:true}).fill('https://example.test/anthropic');await card.getByLabel('Протокол',{exact:true}).selectOption('anthropic');
        await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.locator('.modal').waitFor({state:'detached'});
        assert.equal(await page.getByLabel('Модель',{exact:true}).locator('option').count(),3);
        await open();await page.getByRole('button',{name:'+ Добавить подключение',exact:true}).click();await page.getByLabel('Название подключения',{exact:true}).fill('Second server');await page.getByLabel('Адрес сервера',{exact:true}).fill('https://second.test/v1');await page.getByLabel('Ключ API',{exact:true}).fill('second-test-secret');await page.getByLabel('Идентификатор модели',{exact:true}).fill('model-x');await page.getByRole('button',{name:'Добавить',exact:true}).click();await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.locator('.modal').waitFor({state:'detached'});
        assert.equal(await page.getByLabel('Подключение',{exact:true}).locator('option').count(),2);
        await page.getByLabel('Подключение',{exact:true}).selectOption({label:'Second server'});await page.waitForFunction(()=>window.test.applied.at(-1)?.connections.find(c=>c.id===window.test.applied.at(-1).activeConnectionId)?.name==='Second server');
        await open();await page.getByLabel('Название подключения',{exact:true}).fill('Unsaved edit');await page.evaluate(()=>window.test.files['Кино/_system/ai_settings.enc.json']+=' ');await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.getByText('Файл ключей изменился.',{exact:false}).waitFor();assert.equal(await page.locator('.modal').count(),1);
        await page.getByRole('button',{name:'Отмена',exact:true}).click();await page.getByRole('button',{name:'Не сохранять',exact:true}).click();
        // Remount simulates a restart, and validates decrypting the modified encrypted file.
        await page.evaluate(async()=>{delete window.test.app[Symbol.for('kino.ai.settings.unlocked')];window.test.root.empty();await window.test.mount({app:window.test.app,container:window.test.root,Modal:window.test.Modal,onApply:async v=>window.test.applied.push(v)});});
        await page.getByLabel('Пароль для расшифровки',{exact:true}).fill('test-password-123');await page.getByRole('button',{name:'Расшифровать',exact:true}).click();await page.getByLabel('Подключение',{exact:true}).waitFor();await open();
        const shot=path.join(os.tmpdir(),'kino-ai-desktop.png');await page.screenshot({path:shot});
        await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('.kino-ai-layout').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),1);
        assert.ok(await page.locator('.modal').evaluate(el=>el.getBoundingClientRect().width<=window.innerWidth));
        await page.evaluate(()=>document.documentElement.style.cssText='--background-primary:#202020;--background-secondary:#292929;--background-modifier-border:#444;--text-normal:#eee;--text-muted:#aaa');await page.screenshot({path:path.join(os.tmpdir(),'kino-ai-mobile-dark.png')});
        for(let n=0;n<2;n++){await page.getByRole('button',{name:'Удалить подключение',exact:true}).click();await page.locator('.kino-ai-editor').getByRole('button',{name:'Удалить',exact:true}).last().click();}
        await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.locator('.modal').waitFor({state:'detached'});assert.equal(await page.getByLabel('Подключение',{exact:true}).isDisabled(),true);await page.getByText('Нет подключений.',{exact:false}).waitFor();
        assert.deepEqual(errors,[]);console.log('UI screenshots:',shot,path.join(os.tmpdir(),'kino-ai-mobile-dark.png'));
    }finally{await browser.close();await new Promise(r=>server.close(r));}
});
