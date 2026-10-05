/* Actual actor/director/genre rows in Chrome with read-only Obsidian adapters.
 * Screenshots exercise the shipped Gruvbox/Dynamic styles; they are browser
 * previews, not screenshots of a live Obsidian window. */
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const system=path.resolve(__dirname,'..'),vault=path.resolve(system,'../..');
const previewDir=path.join(system,'redesign-backups/previews');
const entityNames={actor:'Актер',director:'Режиссер',genre:'Жанр'};
const baseStyles=fs.readFileSync(path.join(__dirname,'design-ui.test.cjs'),'utf8').match(/const baseStyles = `([\s\S]*?)`;/)[1];
const fixtures=[
    {page:{file:{name:'Локи',path:'Кино/Media/Локи.md',tags:['#serial']},tags:['serial'],'Название':'Loki','Релиз':'2021-06-09','Оценка':9,'Оценка Imdb':'8,2','Оценка Кинопоиск':7.8,'Прогноз оценки':8.4,'Франшиза':'[[Кино/Франшизы/Киновселенная Marvel|Киновселенная Marvel]]'},role:'Loki · The God of Mischief'},
    {page:{file:{name:'Багровый пик',path:'Кино/Media/Багровый пик.md',tags:['#movies']},tags:['movies'],'Название':'Crimson Peak','Релиз':'2015-10-16','Оценка':7,'Оценка Imdb':6.5,'Оценка Кинопоиск':6.9,'Прогноз оценки':7.3},role:'Sir Thomas Sharpe'},
    {page:{file:{name:'Выживут только любовники',path:'Кино/Media/Выживут только любовники.md',tags:['#movies']},tags:['movies'],'Название':'Only Lovers Left Alive','Релиз':'2013','Оценка':8,'Оценка Imdb':7.2,'Оценка Кинопоиск':7.3,'Прогноз оценки':8},role:'Adam · A Musician'},
    {page:{file:{name:'Невероятно длинное название фильма для проверки переноса и сохранности карточки на узком экране',path:'Кино/Media/Очень длинное название.md',tags:['#movies']},tags:['movies'],'Название':'A very long original title with a complete subtitle','Релиз':'N/A','Оценка':null,'Оценка Imdb':null,'Оценка Кинопоиск':null,'Прогноз оценки':null},role:'Полностью видимая длинная роль актера, которую нельзя обрезать в карточке'}
];
const releaseFormats=[['Локальная дата','16.10.2015'],['Числовой год',2015],['Диапазон лет','2015–2017'],['Английская дата','16 Oct 2015'],['Прошлое десятилетие','2009'],['Дата как объект',{year:2019,month:1,day:2}],['Пустой релиз','']].map(([name,release])=>({page:{file:{name,path:`Кино/Media/${name}.md`,tags:['#movies']},tags:['movies'],'Релиз':release,'Оценка':8},role:''}));
let browser;
before(async()=>{fs.mkdirSync(previewDir,{recursive:true});browser=await chromium.launch({channel:process.env.AI_TEST_BROWSER||'chrome',headless:true});});
after(async()=>{await browser?.close();});

async function mount(page,kind='actor',options={}){
    const appearance=JSON.parse(fs.readFileSync(path.join(vault,'.obsidian/appearance.json'),'utf8'));
    const themePath=path.join(vault,'.obsidian/themes',appearance.cssTheme||'Things','theme.css');
    const snippets=(appearance.enabledCssSnippets||[]).filter(name=>name!=='kino-design').sort((a,b)=>Number(a==='Obsidian gruvbox')-Number(b==='Obsidian gruvbox')).map(name=>path.join(vault,'.obsidian/snippets',name+'.css')).filter(file=>fs.existsSync(file)).map(file=>fs.readFileSync(file,'utf8'));
    const sources={renderer:fs.readFileSync(path.join(system,'person_ui.js'),'utf8'),shared:fs.readFileSync(path.join(system,'kino_ui.js'),'utf8'),design:fs.readFileSync(path.join(system,'kino-design.css'),'utf8'),theme:fs.existsSync(themePath)?fs.readFileSync(themePath,'utf8'):'',snippets,dynamic:fs.readFileSync(path.join(vault,'.obsidian/plugins/dynamic-views/styles.css'),'utf8')};
    await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
    await page.evaluate(async({sources,baseStyles,fixtures,kind,options})=>{
        // Deliberately load the cinema design before every active snippet. This
        // catches late Gruvbox/Things rules overriding the actual title styles.
        for(const css of [baseStyles,sources.theme,sources.dynamic,sources.design,...sources.snippets]){const style=document.createElement('style');style.textContent=css;document.head.append(style);}
        document.body.className='theme-dark';
        Element.prototype.createEl=function(tag,options={}){const el=document.createElement(tag);if(options.text!==undefined)el.textContent=options.text;if(options.cls)el.className=options.cls;for(const key of ['href','type','value','title','placeholder'])if(options[key]!==undefined)el[key]=options[key];this.append(el);return el;};
        Element.prototype.createDiv=function(options={}){return this.createEl('div',typeof options==='string'?{cls:options}:options);};
        Element.prototype.empty=function(){this.replaceChildren();};Element.prototype.setText=function(text){this.textContent=text;};
        const view=document.body.createDiv({cls:(options.source?'markdown-source-view':'markdown-preview-view')+' markdown-rendered kino-page kino-entity'});
        if(options.paneWidth){view.style.width=options.paneWidth+'px';view.style.maxWidth='100%';}
        const entityName={actor:'Актер',director:'Режиссер',genre:'Жанр'}[kind];
        const sizer=view.createDiv({cls:'markdown-preview-sizer'}),inline=sizer.createDiv({cls:'inline-title',text:entityName});
        const metadata=sizer.createDiv({cls:'metadata-container',text:'Native properties'}),section=sizer.createDiv({cls:'markdown-preview-section'});
        const originalTitle=section.createEl('h1',{text:entityName});originalTitle.id='original-person-heading';
        const container=section.createDiv({cls:'block-language-dataviewjs'});
        const unrelated=section.createEl('h1',{text:'Личные впечатления'});unrelated.id='unrelated-heading';
        const rows=options.emptyRows?[]:options.rows||fixtures,selected=options.emptySelection?'':options.selected??{actor:'Tom Hiddleston (Том Хиддлстон)',director:'Guillermo del Toro (Гильермо дель Торо)',genre:'Фэнтези'}[kind];
        const frontmatter={Выбрано:selected,...options.frontmatter};
        const sourcePath='Кино/_system/'+entityName+'.md';
        const stats={writes:0,network:0,links:[],renders:[],children:0,maxChildren:0,added:0,removed:0,waits:[],cleanups:[],failures:options.failRender?1:0};
        class Component {}
        const component={register:fn=>stats.cleanups.push(fn),addChild:child=>{stats.added++;stats.children++;stats.maxChildren=Math.max(stats.maxChildren,stats.children);return child;},removeChild:child=>{if(child.released)throw Error('Child released twice');child.released=true;stats.removed++;stats.children--;}};
        const app={
            vault:{getName:()=> 'Личная кинотека',getAbstractFileByPath:p=>({path:p}),read:async()=>{throw Error('Unexpected vault read');},modify:()=>{stats.writes++;throw Error('Unexpected write');},create:()=>{stats.writes++;throw Error('Unexpected write');}},
            fileManager:{processFrontMatter:()=>{stats.writes++;throw Error('Unexpected metadata write');}},
            metadataCache:{getFileCache:()=>({frontmatter}),getFirstLinkpathDest:p=>({path:p})},
            workspace:{openLinkText:(...args)=>stats.links.push(args)}
        };
        window.fetch=async()=>{stats.network++;throw Error('Unexpected network');};
        const obsidian=options.noRenderer?{}:{Component,MarkdownRenderer:{render:async(app,text,holder,source,child)=>{
            stats.renders.push({text,source});if(options.deferRender)await new Promise(resolve=>stats.waits.push(resolve));
            if(stats.failures){stats.failures--;throw Error('Preview renderer unavailable');}
            holder.createDiv({cls:'bases-view',text:'Native Bases · Все · Фильмы · Сериалы · Лучшие'});
        }}};
        const mod={exports:{}};new Function('module','exports',sources.renderer)(mod,mod.exports);
        const dv={container,current:()=>({...frontmatter,file:{name:entityName,path:sourcePath}}),component,paragraph:text=>container.createEl('p',{text})};
        window.personTest={stats,view,section,container,inline,originalTitle,unrelated,metadata,rows,rowsBefore:JSON.stringify(rows),app,component,dv,renderer:mod.exports,sourcePath,dispose:()=>stats.cleanups.forEach(fn=>fn())};
        const shared={exports:{}};new Function('module','exports',sources.shared)(shared,shared.exports);
        await shared.exports({dv,app,obsidian,kind:'entity'});
        await mod.exports({dv,app,obsidian,kind,selected,rows,baseSource:'```base\nfilters:\n  and:\n    - file.inFolder("Кино/Media")\nviews:\n  - type: table\n    name: Все\n```'});
    },{sources,baseStyles,fixtures,kind,options});
}

test('entity rows retain values, actor roles, navigation context and change-selection commands without writes/network',async()=>{
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    try{
        for(const kind of ['actor','director','genre']){
            await mount(page,kind);
            const text=await page.locator('.kino-person').innerText();
            for(const value of ['Локи','2021','Сериал','9','8,2','7,8','Киновселенная Marvel'])assert.ok(text.includes(value),`${kind}: source datum visible: ${value}`);
            assert.equal(await page.locator('.kino-person').getAttribute('data-kind'),kind);
            assert.equal(await page.locator('.kino-person-card-role-value').count(),kind==='actor'?4:0);
            if(kind==='actor')assert.ok(text.includes('Loki · The God of Mischief'));
            if(kind==='genre')assert.equal(await page.locator('.kino-person-name').textContent(),'Фэнтези');
            assert.equal(await page.evaluate(()=>JSON.stringify(window.personTest.rows)===window.personTest.rowsBefore),true);
            assert.deepEqual(await page.evaluate(()=>({writes:window.personTest.stats.writes,network:window.personTest.stats.network,renders:window.personTest.stats.renders.length})),{writes:0,network:0,renders:0});
            assert.equal(await page.locator('.kino-person-stat').filter({hasText:'Средняя моя оценка'}).locator('.kino-person-stat-value').textContent(),'8,00');
            await page.locator('.kino-person-card-title a').filter({hasText:'Локи'}).click({modifiers:['Control']});
            assert.deepEqual(await page.evaluate(()=>window.personTest.stats.links[0]),['Кино/Media/Локи.md',`Кино/_system/${entityNames[kind]}.md`,true]);
            await page.getByRole('link',{name:'Киновселенная Marvel',exact:true}).click({modifiers:['Meta']});
            assert.deepEqual(await page.evaluate(()=>window.personTest.stats.links[1]),['Кино/Франшизы/Киновселенная Marvel',`Кино/_system/${entityNames[kind]}.md`,true]);
            const choice=new URL(await page.locator('.kino-person-change').getAttribute('href'));
            assert.equal(choice.searchParams.get('choice'),{actor:'Кино - Открыть актера',director:'Кино - Открыть режиссера',genre:'Кино - Открыть жанр'}[kind]);
            assert.equal(choice.searchParams.get('vault'),'Личная кинотека');
        }
    }finally{await page.close();}
});

test('search, type, best filter and sorting change only the displayed collection',async()=>{
    const page=await browser.newPage({viewport:{width:768,height:1000}});
    try{
        for(const kind of ['actor','director','genre']){
        await mount(page,kind);
        assert.equal(await page.locator('.kino-person-card').count(),4);
        await page.getByRole('button',{name:'Сериалы',exact:true}).click();assert.equal(await page.locator('.kino-person-card').count(),1);
        await page.getByRole('button',{name:'Фильмы',exact:true}).click();assert.equal(await page.locator('.kino-person-card').count(),3);
        await page.getByRole('button',{name:'Лучшие',exact:true}).click();assert.equal(await page.locator('.kino-person-card').count(),2);
        await page.getByRole('button',{name:'Все',exact:true}).click();
        await page.locator('.kino-person-search-input').fill(kind==='actor'?'Thomas Sharpe':'Crimson Peak');assert.equal(await page.locator('.kino-person-card').count(),1);
        assert.equal(await page.locator('.kino-person-card-title').textContent(),'Багровый пик');
        await page.locator('.kino-person-search-input').fill('Only Lovers');assert.equal(await page.locator('.kino-person-card').count(),1);
        await page.locator('.kino-person-search-input').fill('');
        await page.locator('.kino-person-sort-select').selectOption('name');
        assert.deepEqual(await page.locator('.kino-person-card-title').allTextContents(),['Багровый пик','Выживут только любовники','Локи',fixtures[3].page.file.name]);
        await page.locator('.kino-person-sort-select').selectOption('newest');
        assert.deepEqual((await page.locator('.kino-person-card-title').allTextContents()).slice(0,3),['Локи','Багровый пик','Выживут только любовники']);
        await page.locator('.kino-person-sort-select').selectOption('myrating');
        assert.deepEqual((await page.locator('.kino-person-card-title').allTextContents()).slice(0,3),['Локи','Выживут только любовники','Багровый пик']);
        assert.equal(await page.evaluate(()=>JSON.stringify(window.personTest.rows)===window.personTest.rowsBefore),true);
        }
    }finally{await page.close();}
});

test('release-year filters combine with type, best and search without changing source rows',async()=>{
    const page=await browser.newPage({viewport:{width:390,height:1000}});
    try{
        for(const kind of ['actor','director','genre']){
            await mount(page,kind);const years=page.locator('.kino-person-year-select');
            assert.equal(await years.inputValue(),'all');
            assert.deepEqual(await years.locator('option').evaluateAll(options=>options.map(o=>o.value)),['all','2021','2015','2013','unknown']);
            await years.selectOption('2015');assert.deepEqual(await page.locator('.kino-person-card-title').allTextContents(),['Багровый пик']);
            await page.getByRole('button',{name:'Сериалы',exact:true}).click();assert.equal(await page.locator('.kino-person-card').count(),0);
            await page.getByRole('button',{name:'Все',exact:true}).click();assert.equal(await page.locator('.kino-person-card').count(),1);
            await page.getByRole('button',{name:'Лучшие',exact:true}).click();assert.equal(await page.locator('.kino-person-card').count(),0);
            await page.getByRole('button',{name:'Фильмы',exact:true}).click();assert.equal(await page.locator('.kino-person-card').count(),1);
            await page.locator('.kino-person-search-input').fill('Loki');assert.equal(await page.locator('.kino-person-card').count(),0);
            await page.locator('.kino-person-search-input').fill('Crimson');assert.equal(await page.locator('.kino-person-card').count(),1);
            await page.locator('.kino-person-sort-select').selectOption('myrating');assert.equal(await page.locator('.kino-person-card-title').textContent(),'Багровый пик');
            await page.locator('.kino-person-search-input').fill('');await page.getByRole('button',{name:'Все',exact:true}).click();
            if(kind==='genre')await page.screenshot({path:path.join(previewDir,'year-filter-genre-390.png'),fullPage:true});
            await years.selectOption('unknown');assert.deepEqual(await page.locator('.kino-person-card-title').allTextContents(),[fixtures[3].page.file.name]);
            await years.selectOption('all');assert.equal(await page.locator('.kino-person-card').count(),4);
            assert.equal(await page.evaluate(()=>JSON.stringify(window.personTest.rows)===window.personTest.rowsBefore),true);
            assert.deepEqual(await page.evaluate(()=>({writes:window.personTest.stats.writes,network:window.personTest.stats.network})),{writes:0,network:0});
        }
    }finally{await page.close();}
});

test('release years normalize ISO, local, numeric, object and range dates with unique decade groups',async()=>{
    const page=await browser.newPage({viewport:{width:768,height:1000}});
    try{
        await mount(page,'genre',{rows:[...fixtures,...releaseFormats]});
        const years=page.locator('.kino-person-year-select');
        assert.deepEqual(await years.locator('option').evaluateAll(options=>options.map(o=>o.value)),['all','2021','2019','2015','2013','2009','unknown']);
        assert.deepEqual(await years.locator('optgroup').evaluateAll(groups=>groups.map(g=>({label:g.label,years:[...g.children].map(o=>o.value)}))),[
            {label:'2020-е',years:['2021']},{label:'2010-е',years:['2019','2015','2013']},{label:'2000-е',years:['2009']}
        ]);
        await years.selectOption('2015');assert.equal(await page.locator('.kino-person-card').count(),5);
        const titles=await page.locator('.kino-person-card-title').allTextContents();
        for(const title of ['Багровый пик','Локальная дата','Числовой год','Диапазон лет','Английская дата'])assert.ok(titles.includes(title));
        await years.selectOption('2019');assert.deepEqual(await page.locator('.kino-person-card-title').allTextContents(),['Дата как объект']);
        await years.selectOption('unknown');assert.equal(await page.locator('.kino-person-card').count(),2);
        assert.equal(await page.evaluate(()=>JSON.stringify(window.personTest.rows)===window.personTest.rowsBefore),true);
    }finally{await page.close();}
});

test('short genre headings use available pane width and keep cinema colors under late active snippets',async()=>{
    const page=await browser.newPage({viewport:{width:1440,height:1100}});
    try{
        for(const width of [250,320,330,390,768]){
            await mount(page,'genre',{paneWidth:width,selected:'Боевик'});
            const heading=await page.locator('.kino-person-name').evaluate(el=>{
                const range=document.createRange();range.selectNodeContents(el);
                const rects=[...range.getClientRects()].filter(r=>r.width>0&&r.height>0),style=getComputedStyle(el);
                const available=el.closest('.kino-person-heading').getBoundingClientRect(),title=el.getBoundingClientRect(),header=el.closest('.kino-person-header').getBoundingClientRect();
                return {lines:new Set(rects.map(r=>Math.round(r.top))).size,color:style.color,font:style.fontFamily,available:available.width,titleWidth:title.width,overflow:header.right>el.closest('.markdown-preview-view').getBoundingClientRect().right+1};
            });
            assert.equal(heading.lines,1,`Боевик at actual ${width}px pane uses one line`);
            assert.equal(heading.color,'rgb(240, 236, 227)');assert.match(heading.font,/Segoe UI/);
            assert.ok(heading.available>=heading.titleWidth-1);assert.equal(heading.overflow,false);
            if(width===250||width===390)await page.locator('.markdown-preview-view').screenshot({path:path.join(previewDir,`header-genre-${width}.png`)});
        }
        for(const selected of ['Guillermo del Toro (Гильермо дель Торо)','AnIncrediblyLongUnbrokenPersonNameThatMustWrapInsideThePaneWithoutLosingText']){
            await mount(page,'director',{paneWidth:250,selected});
            const state=await page.locator('.kino-person-header').evaluate(el=>{const view=el.closest('.markdown-preview-view').getBoundingClientRect();return {outside:[...el.querySelectorAll('*')].some(item=>{const r=item.getBoundingClientRect();return r.left<view.left-1||r.right>view.right+1;}),title:el.querySelector('.kino-person-name').textContent};});
            assert.equal(state.outside,false);assert.equal(state.title,selected.split(' (')[0]);
        }
    }finally{await page.close();}
});

test('actor/director/genre use compact full-width rows at 390/768/1440 without clipping',async()=>{
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    try{
        for(const kind of ['actor','director','genre'])for(const width of [390,768,1440]){
            await page.setViewportSize({width,height:1000});await mount(page,kind);
            const geometry=await page.evaluate(()=>({
                overflow:document.documentElement.scrollWidth>innerWidth,
                clipped:[...document.querySelectorAll('.kino-person-card')].some(el=>el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+1),
                outside:[...document.querySelectorAll('.kino-person-card')].some(el=>{const r=el.getBoundingClientRect();return r.left<0||r.right>innerWidth+1;}),
                controls:[...document.querySelectorAll('.kino-person button,.kino-person input,.kino-person select')].map(el=>({tab:el.tabIndex,disabled:el.disabled})),
                rows:[...document.querySelectorAll('.kino-person-row')].map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height,title:el.querySelector('.kino-person-card-title').textContent};}),
                native:getComputedStyle(document.querySelector('.inline-title')).display,
                original:getComputedStyle(document.querySelector('#original-person-heading')).display,
                unrelated:getComputedStyle(document.querySelector('#unrelated-heading')).display
            }));
            assert.equal(geometry.overflow,false,`${kind} ${width}: page fits`);assert.equal(geometry.clipped,false,`${kind} ${width}: card content fits`);assert.equal(geometry.outside,false);
            assert.equal(geometry.rows.length,4);
            for(let i=1;i<geometry.rows.length;i++){
                assert.ok(geometry.rows[i].top>=geometry.rows[i-1].bottom-1,`${kind} ${width}: one item per row`);
                assert.equal(Math.round(geometry.rows[i].left),Math.round(geometry.rows[0].left));
                assert.equal(Math.round(geometry.rows[i].right),Math.round(geometry.rows[0].right));
            }
            const ordinary=geometry.rows.find(row=>row.title==='Багровый пик');
            assert.ok(ordinary.height<=(width<520?145:100),`${kind} ${width}: ordinary row remains compact (${ordinary.height}px)`);
            assert.ok(geometry.controls.length>=6);assert.ok(geometry.controls.every(c=>c.tab>=0&&!c.disabled));
            assert.equal(geometry.native,'none');assert.equal(geometry.original,'none');assert.notEqual(geometry.unrelated,'none');
            if(kind==='actor')assert.equal(await page.locator('.kino-person-card').last().innerText().then(text=>text.includes(fixtures[3].role)),true);
            await page.screenshot({path:path.join(previewDir,`entity-years-${kind}-${width}.png`),fullPage:true});
        }
        assert.deepEqual(errors,[]);
    }finally{await page.close();}
});

test('empty entity states stay usable; cleanup restores native titles and personal properties remain visible',async()=>{
    const page=await browser.newPage({viewport:{width:390,height:900}});
    try{
        for(const kind of ['actor','director','genre']){
        await mount(page,kind,{emptySelection:true,emptyRows:true});
        assert.equal(await page.locator('.kino-person-card').count(),0);assert.ok((await page.locator('.kino-person').innerText()).length>0);
        if(kind==='genre')assert.equal(await page.locator('.kino-person-name').textContent(),'Жанр');
        await mount(page,kind);await page.locator('.kino-person-search-input').fill('zzzzzz-not-present');
        assert.equal(await page.locator('.kino-person-card').count(),0);assert.ok((await page.locator('.kino-person-empty').innerText()).length>0);
        await page.locator('.kino-person-search-input').fill('');assert.equal(await page.locator('.kino-person-card').count(),4);
        await page.evaluate(()=>window.personTest.dispose());
        assert.notEqual(await page.locator('.inline-title').evaluate(el=>getComputedStyle(el).display),'none');
        assert.notEqual(await page.locator('#original-person-heading').evaluate(el=>getComputedStyle(el).display),'none');
        assert.notEqual(await page.locator('.metadata-container').evaluate(el=>getComputedStyle(el).display),'none');
        assert.equal(await page.locator('.kino-person').count(),0);
        await mount(page,kind,{frontmatter:{'Личная заметка':'My own property'}});
        assert.notEqual(await page.locator('.metadata-container').evaluate(el=>getComputedStyle(el).display),'none');
        await mount(page,kind);
        assert.equal(await page.locator('.metadata-container').evaluate(el=>getComputedStyle(el).display),'none');
        await mount(page,kind,{source:true});
        assert.notEqual(await page.locator('.inline-title').evaluate(el=>getComputedStyle(el).display),'none');
        assert.notEqual(await page.locator('#original-person-heading').evaluate(el=>getComputedStyle(el).display),'none');
        assert.notEqual(await page.locator('.metadata-container').evaluate(el=>getComputedStyle(el).display),'none');
        }
    }finally{await page.close();}
});

test('native Bases are lazy, retain all entity source contexts, and release on collapse/disposal',async()=>{
    const page=await browser.newPage({viewport:{width:768,height:1000}});
    try{
        for(const kind of ['actor','director','genre']){
        await mount(page,kind);assert.equal(await page.evaluate(()=>window.personTest.stats.renders.length),0);
        await page.locator('.kino-person-table summary').click();await page.locator('.kino-person-table-body .bases-view').waitFor();
        assert.deepEqual(await page.evaluate(()=>({children:window.personTest.stats.children,source:window.personTest.stats.renders[0].source})),{children:1,source:`Кино/_system/${entityNames[kind]}.md`});
        assert.match(await page.evaluate(()=>window.personTest.stats.renders[0].text),/^```base\nfilters:/);
        await page.locator('.kino-person-table summary').click();await page.waitForFunction(()=>window.personTest.stats.children===0);
        await page.locator('.kino-person-table summary').click();await page.locator('.kino-person-table-body .bases-view').waitFor();
        await page.evaluate(()=>window.personTest.dispose());assert.equal(await page.evaluate(()=>window.personTest.stats.children),0);
        assert.equal(await page.evaluate(()=>window.personTest.stats.maxChildren),1);
        }
    }finally{await page.close();}
});

test('Bases render race and failure retry do not leave stale content or extra children',async()=>{
    const page=await browser.newPage({viewport:{width:390,height:1000}});
    try{
        await mount(page,'actor',{deferRender:true});await page.locator('.kino-person-table summary').click();await page.waitForFunction(()=>window.personTest.stats.waits.length===1);
        await page.locator('.kino-person-table summary').click();await page.evaluate(()=>window.personTest.stats.waits[0]());
        await page.waitForFunction(()=>window.personTest.stats.children===0);assert.equal(await page.locator('.kino-person-table-body .bases-view').count(),0);
        await page.locator('.kino-person-table summary').click();await page.waitForFunction(()=>window.personTest.stats.waits.length===2);
        await page.evaluate(()=>window.personTest.dispose());await page.evaluate(()=>window.personTest.stats.waits[1]());await page.waitForFunction(()=>window.personTest.stats.children===0);
        assert.equal(await page.locator('.kino-person-table-body .bases-view').count(),0);
        await mount(page,'actor',{failRender:true});await page.locator('.kino-person-table summary').click();
        await page.waitForFunction(()=>window.personTest.stats.renders.length===1&&window.personTest.stats.children===0);
        await page.getByRole('button',{name:'Повторить',exact:true}).click();await page.locator('.kino-person-table-body .bases-view').waitFor();
        assert.equal(await page.evaluate(()=>window.personTest.stats.children),1);assert.equal(await page.locator('.kino-person-table-body .bases-view').count(),1);
        assert.equal(await page.evaluate(()=>({writes:window.personTest.stats.writes,network:window.personTest.stats.network})).then(s=>s.writes+s.network),0);
    }finally{await page.close();}
});
