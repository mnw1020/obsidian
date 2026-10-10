const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const system=path.resolve(__dirname,'..');
test('cinema relations hide when empty, show saved links immediately, bind source path and release view listeners',async()=>{
    const {chromium}=require('playwright'),browser=await chromium.launch({channel:'chrome',headless:true});
    try{for(const width of [390,1440]){
        const page=await browser.newPage({viewport:{width,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
        const sources=Object.fromEntries(['kino_ui.js','adaptation_links.js','kino-design.css'].map(name=>[name,fs.readFileSync(path.join(system,name),'utf8')]));
        const base=fs.readFileSync(path.join(__dirname,'design-ui.test.cjs'),'utf8').match(/const baseStyles = `([\s\S]*?)`;/)[1];
        await page.setContent('<!doctype html><body class="theme-dark"><div class="markdown-preview-view markdown-rendered"><div class="markdown-preview-sizer"><div id="container"></div></div></div></body>');
        await page.evaluate(async({sources,base})=>{
            for(const css of [base,sources['kino-design.css']]){const style=document.createElement('style');style.textContent=css;document.head.append(style);}
            const media={path:'Кино/Media/Фильм.md',basename:'Фильм',extension:'md'},book={path:'Книги/Художественные/Автор/Книга.md',basename:'Книга',extension:'md'};
            const metadata=new Map([[media.path,{tags:['movies'],Оценка:8}],[book.path,{title:'Книга <img src=x onerror=alert(1)>',authors:['Автор']}]]),cleanup=[],calls=[],opened=[];
            function events(){const listeners=new Map();return {on:(name,fn)=>{if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);return {name,fn};},offref:ref=>listeners.get(ref.name)?.delete(ref.fn),trigger:(name,...args)=>{for(const fn of listeners.get(name)||[])fn(...args);},count:name=>listeners.get(name)?.size||0};}
            const vault={...events(),getName:()=> 'Vault',getMarkdownFiles:()=>[media,book],getAbstractFileByPath:p=>p===media.path?media:p===book.path?book:p==='Кино/_system/adaptation_links.js'?{path:p}:null,read:async()=>sources['adaptation_links.js']};
            const workspace={...events(),openLinkText:(...args)=>opened.push(args),getActiveFile:()=>book};
            const app={vault,workspace,metadataCache:{...events(),getFileCache:f=>({frontmatter:metadata.get(f.path)}),getFirstLinkpathDest:p=>p===book.path.replace(/\.md$/,'')||p==='Книга'?book:null},plugins:{plugins:{quickadd:{api:{executeChoice:async(name,variables)=>{
                calls.push({name,path:variables.adaptationRequest.path});await new Promise(resolve=>setTimeout(resolve,25));
                variables.adaptationRequest.onLinked({bookPath:book.path,mediaPath:media.path,bookFm:{...metadata.get(book.path),adaptations:['[[Кино/Media/Фильм]]']},mediaFm:{...metadata.get(media.path),Первоисточники:['[[Книги/Художественные/Автор/Книга]]']}});
            }}}}}};
            const component={register:fn=>cleanup.push(fn)},mod={exports:{}};new Function('module',sources['kino_ui.js'])(mod);
            window.cinemaRelations={app,metadata,media,book,calls,opened,dispose:()=>cleanup.forEach(fn=>fn()),clear:()=>{vault.trigger('modify',media);vault.trigger('modify',book);app.metadataCache.trigger('changed',media);}};
            await mod.exports({dv:{container:document.getElementById('container'),current:()=>({file:{name:'Фильм',path:media.path}}),component},app,kind:'media'});
        },{sources,base});
        assert.equal(await page.locator('.kino-related-panel').count(),0);
        await page.getByRole('button',{name:'Связать с книгой'}).click();await page.locator('.kino-related-item').waitFor();
        assert.deepEqual(await page.evaluate(()=>cinemaRelations.calls),[{name:'Книги - Связать с кино',path:'Кино/Media/Фильм.md'}]);
        assert.match(await page.locator('.kino-related-title').textContent(),/<img/);assert.equal(await page.locator('.kino-related-item img').count(),0);
        await page.locator('.kino-related-item').click({modifiers:['Control']});assert.deepEqual((await page.evaluate(()=>cinemaRelations.opened))[0],['Книги/Художественные/Автор/Книга','Кино/Media/Фильм.md',true]);
        await page.locator('.kino-related-panel summary').press('Enter');assert.equal(await page.locator('.kino-related-panel').evaluate(e=>e.open),false);
        await page.locator('.kino-related-panel summary').press('Enter');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        const previews=path.join(system,'redesign-backups/previews');fs.mkdirSync(previews,{recursive:true});await page.screenshot({path:path.join(previews,'cinema-relations-'+width+'.png'),fullPage:true});
        await page.evaluate(()=>cinemaRelations.clear());await page.locator('.kino-related-panel').waitFor({state:'detached'});
        await page.evaluate(()=>cinemaRelations.dispose());assert.equal(await page.locator('.kino-ui-root').count(),0);
        assert.deepEqual(await page.evaluate(()=>({cache:cinemaRelations.app.metadataCache.count('changed'),workspace:cinemaRelations.app.workspace.count('kino:adaptations-changed'),create:cinemaRelations.app.vault.count('create')})),{cache:0,workspace:0,create:0});
        assert.deepEqual(errors,[]);await page.close();
    }}finally{await browser.close();}
});
