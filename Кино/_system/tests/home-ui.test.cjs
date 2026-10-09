/* Browser regression tests for the shipped home modules. Books are a read-only
 * reference. All notes, commands and native Bases use controlled test adapters. */
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const {chromium}=require('playwright');
const system=path.resolve(__dirname,'..'),vault=path.resolve(system,'../..');
const previews=path.join(system,'redesign-backups/previews');
const expectedChoices=['movie_imdb','Добавить просмотр','Добавить сезон','Редактировать просмотр','Редактировать сезон','Пересобрать карточку','Франшиза'];
const expectedNav=['Кино/_Кино.base#Карточки','Кино/_system/Рекомендации','Кино/_system/Аналитика прогнозов','Кино/_system/Проверка кинотеки','Кино/_system/README','Кино/_system/Журнал изменений'];
const base=fs.readFileSync(path.join(__dirname,'design-ui.test.cjs'),'utf8').match(/const baseStyles = `([\s\S]*?)`;/)[1]+`
 body{font:16px/1.5 "JetBrains Mono",monospace;--text-accent:#efa76b;--interactive-accent:#efa76b;--text-error:#ff8585}
 .markdown-preview-section{min-width:0}.kino-home-native-content{min-width:0}
`;
const today=new Date(),isoOffset=days=>{const d=new Date(today.getFullYear(),today.getMonth(),today.getDate()-days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const collection=Array.from({length:48},(_,i)=>({path:`Кино/Media/Фильм-${String(i).padStart(2,'0')}.md`,basename:`Фильм ${i}`,name:`Фильм-${i}.md`,extension:'md',stat:{mtime:48-i},fm:{tags:[i%5===0?'serial':'movies'],'Название':`Film ${i}`,'Просмотрено':i<30?isoOffset(i):null,'Оценка':i<30?String(7+i%3):null,'Количество просмотров':i%11===0?2:1,'Сезон':i%5===0?2:null}}));
const extraFiles=[
    {path:'Кино/_system/Роли/Посторонние.md',extension:'md',fm:{tags:['movies'],Оценка:10}},
    {path:'Кино/Media/Вложено/Чужая.md',extension:'md',fm:{tags:['movies'],Оценка:10}},
    {path:'Книги/Чужая.md',extension:'md',fm:{tags:['movies'],Оценка:10}}
];
let browser;
before(async()=>{fs.mkdirSync(previews,{recursive:true});browser=await chromium.launch({channel:process.env.AI_TEST_BROWSER||'chrome',headless:true});});
after(async()=>{await browser?.close();});

function activeCss(){
    const appearance=JSON.parse(fs.readFileSync(path.join(vault,'.obsidian/appearance.json'),'utf8'));
    const theme=path.join(vault,'.obsidian/themes',appearance.cssTheme||'Things','theme.css');
    return {theme:fs.existsSync(theme)?fs.readFileSync(theme,'utf8'):'',snippets:(appearance.enabledCssSnippets||[]).sort((a,b)=>Number(a==='Obsidian gruvbox')-Number(b==='Obsidian gruvbox')).map(name=>path.join(vault,'.obsidian/snippets',name+'.css')).filter(file=>fs.existsSync(file)).map(file=>fs.readFileSync(file,'utf8'))};
}
function bookReference(){
    const file=path.join(vault,'Книги/_system/tests/library_home_ui.cjs'),source=fs.readFileSync(file,'utf8');
    const mod={exports:{}};
    new Function('require','__dirname','module',source.slice(0,source.lastIndexOf('main().catch('))+'\nmodule.exports={mount,assertBounded,dispose};')(createRequire(file),path.dirname(file),mod);
    return mod.exports;
}

async function mount(options={}){
    const page=await browser.newPage({viewport:{width:options.width||1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const note=fs.readFileSync(path.join(system,'../_index.md'),'utf8');
    const sources={'Кино/_system/kino_home.js':fs.readFileSync(path.join(system,'kino_home.js'),'utf8'),'Кино/_system/kino-home.css':fs.readFileSync(path.join(system,'kino-home.css'),'utf8')};
    const css=activeCss();
    await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
    await page.evaluate(async({base,css,note,sources,files,options})=>{
        for(const text of [base,css.theme]){const style=document.createElement('style');style.textContent=text;document.head.append(style);}
        document.body.className='theme-dark';
        for(const [method,tag] of [['createDiv','div'],['createEl',null]])Object.defineProperty(HTMLElement.prototype,method,{configurable:true,value:function(arg,opts={}){
            const kind=tag||arg,options=tag?arg||{}:opts,node=document.createElement(kind);if(options.cls)node.className=options.cls;if(options.text!==undefined)node.textContent=options.text;
            for(const key of ['href','type','value'])if(options[key]!==undefined)node[key]=options[key];this.append(node);return node;
        }});
        HTMLElement.prototype.empty=function(){this.replaceChildren();};
        const view=document.body.createDiv({cls:'markdown-preview-view markdown-rendered kino-page kino-dashboard kino-home-page movies-dashboard'});
        if(options.pane){view.style.width=options.pane+'px';view.style.maxWidth='100%';view.style.marginInline='0';}
        const sizer=view.createDiv({cls:'markdown-preview-sizer markdown-preview-section'});
        sizer.createDiv({cls:'metadata-container',text:'Native properties'});sizer.createDiv({cls:'inline-title',text:'_index'});
        const wrapper=sizer.createDiv({cls:'el-pre'}),container=wrapper.createDiv({cls:'block-language-dataviewjs'});container.id='content';
        const nativeTitle=sizer.createDiv({cls:'el-h1'});nativeTitle.id='native-title';nativeTitle.createEl('h1',{text:'Кинотека'});
        const nativeActions=sizer.createDiv({cls:'el-p'});nativeActions.id='native-actions';
        nativeActions.createEl('a',{text:'Добавить фильм или сериал',href:'obsidian://quickadd?choice=movie_imdb'});
        const nativeBody=sizer.createDiv({cls:'el-p'});nativeBody.id='native-body';nativeBody.createEl('p',{text:'Исходная главная сохраняет каталог и ссылки'});
        nativeBody.createEl('a',{text:'Каталог',href:'Кино/_Кино.base#Карточки'});
        class Events{constructor(){this.refs=new Set();}on(name,callback){const ref={emitter:this,name,callback};this.refs.add(ref);return ref;}offref(ref){this.refs.delete(ref);}emit(name,...args){for(const ref of [...this.refs])if(ref.name===name)ref.callback(...args);}}
        const map=new Map(files.map(file=>[file.path,{...file}]));for(const [path,text]of Object.entries(sources))map.set(path,{path,text});
        map.set('Кино/_index.md',{path:'Кино/_index.md',basename:'_index',extension:'md',text:note,fm:{cssclasses:['kino-page','kino-home-page']}});
        if(options.missingCss)map.delete('Кино/_system/kino-home.css');if(options.emptyCss)map.get('Кино/_system/kino-home.css').text=' ';if(options.missingModule)map.delete('Кино/_system/kino_home.js');
        const state={writes:0,network:0,choices:[],links:[],nativeCalls:[],waits:[],components:[],map,commandFailure:options.commandFailure,commandPending:options.commandPending};
        class Component{
            constructor(){this.cleanups=[];this.refs=[];this.children=new Set();this.unloaded=false;state.components.push(this);}
            register(fn){if(this.unloaded)fn();else this.cleanups.push(fn);return fn;}
            registerEvent(ref){if(this.unloaded)ref.emitter.offref(ref);else this.refs.push(ref);return ref;}
            addChild(child){if(this.unloaded)child.unload?.();else this.children.add(child);child.load?.();return child;}
            removeChild(child){this.children.delete(child);child.unload?.();return child;}
            load(){}
            unload(){if(this.unloaded)return;this.unloaded=true;for(const child of this.children)child.unload?.();this.children.clear();for(const fn of this.cleanups.splice(0))fn();for(const ref of this.refs.splice(0))ref.emitter.offref(ref);}
        }
        const vault=Object.assign(new Events(),{getName:()=> 'Личная кинотека',getAbstractFileByPath:path=>map.get(path),getMarkdownFiles:()=>[...map.values()].filter(file=>file.extension==='md'),read:async file=>{
            if(options.delayCss&&file.path==='Кино/_system/kino-home.css')await new Promise(resolve=>state.resolveCss=resolve);return file.text;
        },cachedRead:async file=>file.text,modify:async()=>{state.writes++;throw Error('Home must not modify notes');},process:async()=>{state.writes++;throw Error('Home must not process notes');},create:async()=>{state.writes++;throw Error('Home must not create notes');}});
        const metadataCache=Object.assign(new Events(),{getFileCache:file=>file?.fm?{frontmatter:file.fm}:null});
        const api={executeChoice:async choice=>{state.choices.push(choice);if(state.commandPending)await new Promise(resolve=>state.resolveCommand=resolve);if(state.commandFailure)throw Error(state.commandFailure);}};
        const app={vault,metadataCache,workspace:{openLinkText:(...args)=>state.links.push(args),getActiveFile:()=>map.get('Кино/_index.md')},plugins:{plugins:options.noQuickadd?{}:{quickadd:{api}}}};
        const component=new Component(),dv={container,component,current:()=>({file:{path:'Кино/_index.md',name:'_index'}}),paragraph:text=>container.createEl('p',{text})};
        const obsidian={Component,MarkdownRenderer:{render:async(app,text,holder,source,child)=>{
            state.nativeCalls.push({text,source});if(options.delayNative)await new Promise(resolve=>state.waits.push(resolve));
            if(options.failNative&&!state.failedNative){state.failedNative=true;throw Error('Native Bases failed');}
            holder.createDiv({cls:'bases-view',text:'Native Bases · '+text});
        }}};
        if(options.noRenderer)delete obsidian.MarkdownRenderer;
        window.fetch=async()=>{state.network++;throw Error('Home must not fetch');};
        window.homeTest={state,app,dv,component,view,sizer,container,originalFiles:JSON.stringify(files),
            modify(path,changes){const file=map.get(path);Object.assign(file.fm,changes);metadataCache.emit('changed',file);vault.emit('modify',file);},
            add(file){map.set(file.path,file);vault.emit('create',file);},
            remove(path){const file=map.get(path);map.delete(path);vault.emit('delete',file);},
            leaks(){return {refs:vault.refs.size+metadataCache.refs.size,children:state.components.reduce((sum,c)=>sum+c.children.size,0),writes:state.writes,network:state.network};}
        };
        let renderer;
        async function execute(){
            const file=map.get('Кино/_system/kino_home.js');if(!file)return;
            try{if(!renderer){const mod={exports:{}};new Function('module',file.text)(mod);renderer=mod.exports;}window.homeTest.renderer=renderer;window.homeTest.obsidian=obsidian;window.homeTest.handle=await renderer({dv,app,obsidian});}
            catch(error){state.initialError=error.message;dv.paragraph('Не удалось загрузить главную. Каталог и команды доступны ниже.');}
        }
        const originalRender=async()=>{container.replaceChildren();await execute();};component.render=originalRender;window.homeTest.originalRender=originalRender;
        window.homeTest.renderPromise=execute();if(!options.delayCss)await window.homeTest.renderPromise;
        // Late active snippets challenge the module's inline styles, as in Obsidian.
        for(const text of css.snippets){const style=document.createElement('style');style.textContent=text;document.head.append(style);}
    },{base,css,note,sources,files:options.files||[...collection,...extraFiles],options});
    return {page,errors};
}
async function bounded(page,prefix='.kino-home'){
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const overflow=await page.evaluate(prefix=>[...document.querySelectorAll(`${prefix}-ui,${prefix}-masthead,${prefix}-stats,${prefix}-panel,${prefix}-overviews`)].filter(el=>el.getClientRects().length&&el.scrollWidth>el.clientWidth+1).map(el=>({cls:el.className,width:el.clientWidth,scroll:el.scrollWidth})),prefix);
    assert.deepEqual(overflow,[],'Home panels stay within their actual width');
}
async function dispose(page){
    await page.evaluate(()=>{window.homeTest.handle?.dispose?.();window.homeTest.component.unload();});
    assert.equal(await page.locator('.kino-home-ui').count(),0);
    assert.deepEqual(await page.evaluate(()=>window.homeTest.leaks()),{refs:0,children:0,writes:0,network:0});
    for(const selector of ['#native-title','#native-actions','#native-body'])assert.equal(await page.locator(selector).isVisible(),true);
}
function styles(page,prefix){return page.evaluate(prefix=>{
    const title=document.querySelector(prefix+'-title'),number=document.querySelector(prefix+'-stat strong'),masthead=document.querySelector(prefix+'-masthead'),section=document.querySelector(prefix+'-panel-head h2');
    const t=getComputedStyle(title),n=getComputedStyle(number),m=getComputedStyle(masthead),s=getComputedStyle(section);
    return {titleFont:t.fontFamily,titleWeight:t.fontWeight,numberFont:n.fontFamily,numberWeight:n.fontWeight,numeric:n.fontVariantNumeric,sectionFont:s.fontFamily,sectionWeight:s.fontWeight,border:m.borderTopWidth};
},prefix);}

test('actual Books and cinema home renderers share masthead, typography and bounded responsive panels',async()=>{
    const reference=bookReference();
    for(const layout of [{width:390},{width:768},{width:1440},{width:1440,pane:330}]){
        const book=await reference.mount(browser,{...layout,theme:'theme-dark'});
        const kino=await mount(layout);
        try{
            const css=activeCss();await book.page.evaluate(snippets=>{for(const text of snippets){const style=document.createElement('style');style.textContent=text;document.head.append(style);}},css.snippets);
            await reference.assertBounded(book.page);await bounded(kino.page);
            assert.deepEqual(await styles(kino.page,'.kino-home'),await styles(book.page,'.book-home'));
            assert.equal(await kino.page.locator('.kino-home-ui[data-ready="true"]').count(),1);
            assert.equal(await kino.page.locator('.kino-home-title').textContent(),'Кинотека');
            assert.equal(await kino.page.locator('.kino-home-stat strong').count(),4);
            assert.equal(await kino.page.locator('.kino-home-recent .kino-home-row').count(),20);
            assert.equal(await kino.page.locator('.kino-home-serials .kino-home-row').count(),5);
            assert.deepEqual(await kino.page.locator('.kino-home-recent .kino-home-row').evaluateAll(rows=>rows.map(row=>row.dataset.path)),collection.slice(0,20).map(file=>file.path));
            assert.deepEqual(await kino.page.locator('.kino-home-serials .kino-home-row').evaluateAll(rows=>rows.map(row=>row.dataset.path)),collection.filter(file=>file.fm.tags.includes('serial')).slice(0,5).map(file=>file.path));
            assert.equal(await kino.page.locator('.kino-home-overview').count(),4);
            if(layout.pane){
                const lines=await kino.page.locator('.kino-home-overview>a[data-choice="Кино - Открыть режиссера"]').evaluate(link=>{const range=document.createRange();range.selectNodeContents(link);return new Set([...range.getClientRects()].map(rect=>Math.round(rect.top))).size;});
                assert.equal(lines,1,'The director label stays on one line in a narrow actual pane');
                const wordLines=await kino.page.locator('[data-period="reread"]+span').evaluate(label=>{const range=document.createRange();range.setStart(label.firstChild,0);range.setEnd(label.firstChild,'Пересмотрено'.length);return new Set([...range.getClientRects()].map(rect=>Math.round(rect.top))).size;});
                assert.equal(wordLines,1,'The reread label wraps at spaces in a narrow actual pane');
            }
            assert.equal(await kino.page.locator('.kino-home-native-content:not(:empty)').count(),0);
            assert.equal(await kino.page.locator('.inline-title').isVisible(),false);
            for(const selector of ['#native-title','#native-actions','#native-body'])assert.equal(await kino.page.locator(selector).isVisible(),false);
            const suffix=layout.pane?'pane-'+layout.pane:String(layout.width);
            await book.page.screenshot({path:path.join(previews,`home-books-reference-${suffix}.png`),fullPage:true});
            await kino.page.screenshot({path:path.join(previews,`home-books-cinema-${suffix}.png`),fullPage:true});
            await dispose(kino.page);await reference.dispose(book.page);assert.deepEqual(kino.errors,[]);assert.deepEqual(book.errors,[]);
        }finally{await book.page.close();await kino.page.close();}
    }
});

test('all home blocks collapse by keyboard and retain their state after reopening the home',async()=>{
    const {page,errors}=await mount({width:390});
    try{
        await page.evaluate(()=>{
            const stored=new Map();
            Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value)}});
        });
        const keys=['masthead','recent','reading','serials','overview','footer'];
        const headingButton=page.locator('.kino-home-recent h2>.kino-home-fold');
        assert.equal(await headingButton.locator('.kino-home-fold-title').textContent(),'Последние просмотры');
        assert.equal(await headingButton.locator('svg').count(),0);
        assert.equal(await headingButton.evaluate(button=>{const title=button.querySelector('.kino-home-fold-title').getBoundingClientRect(),chevron=button.querySelector('.kino-home-fold-chevron').getBoundingClientRect();return chevron.left>=title.right&&getComputedStyle(button).fontFamily===getComputedStyle(button.parentElement).fontFamily;}),true);
        for(const key of keys){
            const control=page.locator(`[data-fold="${key}"] .kino-home-fold`).first();
            // Nested serials must be folded before their parent is hidden.
            if(key==='reading')continue;
            await control.press('Enter');assert.equal(await control.getAttribute('aria-expanded'),'false');
            const hidden=await control.evaluate(button=>button.getAttribute('aria-controls').split(' ').every(id=>document.getElementById(id).hidden));
            assert.equal(hidden,true);
        }
        await page.locator('[data-fold="reading"] .kino-home-fold').first().press('Space');
        await page.locator('.kino-home-management>summary').click();
        await page.locator('.kino-home-views>summary').click();
        const native=page.locator('.kino-home-native-view').first();await native.locator('summary').click();await native.locator('.bases-view').waitFor();
        await page.evaluate(async()=>{const test=window.homeTest;delete test.app.__kinoHomeFolds;test.handle=await test.renderer({dv:test.dv,app:test.app,obsidian:test.obsidian});});
        for(const key of keys)assert.equal(await page.locator(`[data-fold="${key}"] .kino-home-fold`).first().getAttribute('aria-expanded'),'false');
        assert.equal(await page.locator('.kino-home-management').evaluate(node=>node.open),true);
        assert.equal(await page.locator('.kino-home-views').evaluate(node=>node.open),true);
        await page.locator('.kino-home-native-view .bases-view').waitFor();
        await page.locator('[data-fold="recent"] .kino-home-fold').first().press('Enter');
        assert.equal(await page.locator('.kino-home-recent .kino-home-row').first().isVisible(),true);
        assert.equal(await page.locator('.kino-home-recent .kino-home-section-link').getAttribute('data-href'),'Кино/_Кино.base#Все');
        await bounded(page);await dispose(page);assert.deepEqual(errors,[]);
    }finally{await page.close();}
});

test('home retains all command choices, original navigation and source-aware internal links',async()=>{
    const {page,errors}=await mount();
    try{
        const navigation=await page.locator('.kino-home-ui a[data-href]').evaluateAll(links=>links.map(link=>link.dataset.href));
        for(const target of expectedNav)assert.ok(navigation.includes(target),`Original navigation target remains available: ${target}`);
        await page.locator('.kino-home-management summary').click();
        const links=page.locator('.kino-home-actions a[data-choice],.kino-home-management a[data-choice]');
        assert.deepEqual(await links.evaluateAll(links=>links.map(link=>new URL(link.href).searchParams.get('choice'))),expectedChoices);
        for(let i=0;i<7;i++)await links.nth(i).click();assert.deepEqual(await page.evaluate(()=>window.homeTest.state.choices),expectedChoices);
        assert.equal(await page.locator('.kino-home-ui a[data-choice]').count(),10);
        assert.deepEqual(await page.locator('.kino-home-overview a[data-choice]').evaluateAll(links=>links.map(link=>link.dataset.choice)),['Кино - Открыть актера','Кино - Открыть режиссера','Кино - Открыть жанр']);
        await page.locator('.kino-home-nav a').first().click({modifiers:['Control']});
        assert.deepEqual(await page.evaluate(()=>window.homeTest.state.links[0]),['Кино/_system/Рекомендации','Кино/_index.md',true]);
        await page.locator('.kino-home-row-title').first().click({modifiers:['Meta']});
        assert.equal(await page.evaluate(()=>window.homeTest.state.links[1][1]),'Кино/_index.md');assert.equal(await page.evaluate(()=>window.homeTest.state.links[1][2]),true);
        await dispose(page);assert.deepEqual(errors,[]);
    }finally{await page.close();}
});

test('stats update from local data events, exclude other folders and render untrusted text safely',async()=>{
    const {page,errors}=await mount();
    try{
        assert.deepEqual(await page.locator('.kino-home-stats strong').allTextContents(),['48','38','10','8,00']);
        await page.evaluate(()=>window.homeTest.modify('Кино/Media/Фильм-47.md',{'Просмотрено':'2026-10-08','Оценка':'7,5'}));
        await page.waitForFunction(()=>document.querySelector('[data-stat="average"]').textContent==='7,98');
        assert.equal(await page.locator('[data-stat="watched"]').count(),0);
        assert.equal(await page.locator('[data-stat="average"]').textContent(),'7,98');
        await page.evaluate(()=>window.homeTest.add({path:'Кино/Media/Текст.md',basename:'<img src=x onerror=alert(1)>',name:'Текст.md',extension:'md',stat:{mtime:100},fm:{tags:['movies','serial'],'Просмотрено':'2099-01-01','Оценка':'bad','Название':'<script>alert(1)</script>'}}));
        await page.waitForFunction(()=>document.querySelector('[data-stat="total"]').textContent==='49');
        assert.equal(await page.locator('.kino-home-recent .kino-home-row-title').first().textContent(),'<img src=x onerror=alert(1)>');
        assert.equal(await page.locator('.kino-home-ui img,.kino-home-ui script').count(),0);
        assert.equal(await page.locator('[data-stat="movies"]').textContent(),'39');assert.equal(await page.locator('[data-stat="serials"]').textContent(),'11');
        await page.evaluate(()=>window.homeTest.remove('Кино/Media/Текст.md'));
        await page.waitForFunction(()=>document.querySelector('[data-stat="total"]').textContent==='48');
        await dispose(page);assert.deepEqual(errors,[]);
    }finally{await page.close();}
});

test('deferred native views retain their targets and release native children on collapse and unload',async()=>{
    const {page,errors}=await mount();
    try{
        assert.equal(await page.evaluate(()=>window.homeTest.state.nativeCalls.length),0);
        await page.locator('.kino-home-views>summary').click();
        const views=page.locator('.kino-home-native-view');assert.equal(await views.count(),3);
        for(const target of ['Кино/_Кино.base#Последние','Кино/_Кино.base#Перепросмотры','Кино/_Кино.base#Последние сериалы']){
            const view=page.locator(`.kino-home-native-view[data-target="${target}"]`);await view.locator('summary').click();await view.locator('.bases-view').waitFor();
            assert.equal(await page.evaluate(()=>window.homeTest.state.nativeCalls.at(-1).text),`![[${target}]]`);
            assert.equal(await page.evaluate(()=>window.homeTest.state.nativeCalls.at(-1).source),'Кино/_index.md');
            await view.locator('summary').click();await view.locator('.bases-view').waitFor({state:'detached'});
        }
        await dispose(page);assert.deepEqual(errors,[]);
    }finally{await page.close();}
});

test('missing modules and CSS preserve native fallbacks; delayed reads cannot resurrect an unloaded home',async()=>{
    for(const options of [{missingModule:true},{missingCss:true},{emptyCss:true},{delayCss:true}]){
        const {page,errors}=await mount(options);
        try{
            if(options.delayCss){await page.waitForFunction(()=>typeof window.homeTest.state.resolveCss==='function');await page.evaluate(()=>window.homeTest.component.unload());await page.evaluate(async()=>{window.homeTest.state.resolveCss();await window.homeTest.renderPromise;});}
            assert.equal(await page.locator('.kino-home-ui').count(),0);assert.equal(await page.locator('#native-title').isVisible(),true);assert.equal(await page.locator('#native-actions').isVisible(),true);
            await dispose(page);assert.deepEqual(errors,[]);
        }finally{await page.close();}
    }
});

test('QuickAdd URI fallback, busy actions and command failures leave the home usable',async()=>{
    const fallback=await mount({noQuickadd:true});
    try{assert.equal(new URL(await fallback.page.locator('.kino-home-action').first().getAttribute('href')).searchParams.get('choice'),'movie_imdb');await dispose(fallback.page);}finally{await fallback.page.close();}
    const busy=await mount({commandPending:true});
    try{
        const first=busy.page.locator('.kino-home-actions a[data-choice]').first();await first.click();await busy.page.waitForFunction(()=>typeof window.homeTest.state.resolveCommand==='function');await first.dispatchEvent('click');
        assert.deepEqual(await busy.page.evaluate(()=>window.homeTest.state.choices),['movie_imdb']);await busy.page.evaluate(()=>window.homeTest.state.resolveCommand());
        await busy.page.waitForFunction(()=>!document.querySelector('.kino-home-action[aria-disabled="true"]'));await dispose(busy.page);
    }finally{await busy.page.close();}
    for(const message of ['Input cancelled by user.','Command failed']){
        const failed=await mount({commandFailure:message});
        try{await failed.page.locator('.kino-home-actions a').first().click();if(message==='Command failed')await failed.page.locator('.kino-home-action-error').waitFor({state:'visible'});else assert.equal(await failed.page.locator('.kino-home-action-error').isVisible(),false);await dispose(failed.page);}finally{await failed.page.close();}
    }
});

test('native failure retries and late completion do not leak or restore hidden home widgets',async()=>{
    const failed=await mount({failNative:true});
    try{
        await failed.page.locator('.kino-home-views>summary').click();const view=failed.page.locator('.kino-home-native-view').first();await view.locator('summary').click();await view.locator('.kino-home-widget-error').waitFor();
        await view.locator('summary').click();await view.locator('summary').click();await view.locator('.bases-view').waitFor();await dispose(failed.page);
    }finally{await failed.page.close();}
    const late=await mount({delayNative:true});
    try{
        await late.page.locator('.kino-home-views>summary').click();await late.page.locator('.kino-home-native-view summary').first().click();await late.page.waitForFunction(()=>window.homeTest.state.waits.length===1);
        await late.page.evaluate(()=>window.homeTest.component.unload());await late.page.evaluate(()=>window.homeTest.state.waits[0]());
        await dispose(late.page);assert.equal(await late.page.locator('.bases-view').count(),0);
    }finally{await late.page.close();}
});

test('Dataview refresh guards a ready home and repeated mounting replaces prior event subscriptions',async()=>{
    const {page,errors}=await mount({width:390});
    try{
        const refs=await page.evaluate(()=>window.homeTest.leaks().refs);assert.ok(refs>0);
        const state=await page.evaluate(async()=>{const test=window.homeTest;const wrapped=test.component.render!==test.originalRender;window.scrollTo(0,500);const before=scrollY;await test.component.render();return {wrapped,before,after:scrollY,roots:document.querySelectorAll('.kino-home-ui').length,leaks:test.leaks(),minHeight:test.container.style.minHeight};});
        assert.equal(state.wrapped,true);assert.equal(state.roots,1);assert.equal(state.leaks.refs,refs);assert.equal(state.leaks.children,0);assert.equal(state.minHeight,'');assert.ok(Math.abs(state.before-state.after)<=2);
        await page.evaluate(async()=>{const test=window.homeTest;test.handle=await test.renderer({dv:test.dv,app:test.app,obsidian:test.obsidian});});
        assert.equal(await page.locator('.kino-home-ui').count(),1);assert.equal(await page.evaluate(()=>window.homeTest.leaks().refs),refs);
        await dispose(page);assert.equal(await page.evaluate(()=>window.homeTest.component.render===window.homeTest.originalRender),true);assert.deepEqual(errors,[]);
    }finally{await page.close();}
});

test('missing data, zero and comma ratings preserve old totals while period metrics count unique media',async()=>{
    const row=(name,fm)=>({path:`Кино/Media/${name}.md`,basename:name,name:name+'.md',extension:'md',fm});
    const files=[row('A',{tags:['movies','serial'],'Просмотрено':isoOffset(0)+'T23:00:00Z','Оценка':'7,5','Количество просмотров':'2','Релиз':'2015'}),
        row('B',{tags:'#movies','Просмотрено':'','Оценка':0}),row('C',{tags:['serial'],'Просмотрено':'2026-02-30','Оценка':'Infinity','Количество просмотров':'3'}),
        row('D',{tags:['movies'],'Просмотрено':null,'Оценка':''}),row('E',{tags:['movies'],'Просмотрено':isoOffset(0),'Оценка':9}),
        row('F',{tags:['movies'],'Просмотрено':isoOffset(400),'Оценка':'bad'})];
    const full=await mount({files,width:390});
    try{
        assert.deepEqual(await full.page.locator('.kino-home-stats strong').allTextContents(),['6','5','2','5,50']);
        assert.deepEqual(await full.page.locator('.kino-home-metric strong').allTextContents(),['2','2','2']);
        assert.deepEqual(await full.page.locator('.kino-home-recent .kino-home-row').evaluateAll(rows=>rows.map(row=>row.dataset.path.split('/').at(-1))),['E.md','A.md','F.md','B.md','C.md','D.md']);
        assert.equal(await full.page.locator('.kino-home-recent .kino-home-row[data-path="Кино/Media/A.md"] .kino-home-row-meta').textContent(),'Сериал · 2015');
        assert.equal(await full.page.locator('.kino-home-recent .kino-home-row[data-path="Кино/Media/B.md"] .kino-home-row-score').textContent(),'0');
        assert.equal(await full.page.locator('.kino-home-recent .kino-home-row[data-path="Кино/Media/C.md"] .kino-home-row-date').textContent(),'Без даты');
        await bounded(full.page);await dispose(full.page);assert.deepEqual(full.errors,[]);
    }finally{await full.page.close();}
    const empty=await mount({files:[],width:390});
    try{assert.deepEqual(await empty.page.locator('.kino-home-stats strong').allTextContents(),['0','0','0','—']);assert.equal(await empty.page.locator('.kino-home-empty').count(),2);await bounded(empty.page);await dispose(empty.page);assert.deepEqual(empty.errors,[]);}finally{await empty.page.close();}
});
