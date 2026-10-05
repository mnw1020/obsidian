const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const lazy=require('../lazy_base.js');
const saved=require('../recommendation_tables.js');
const script=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

// A small Obsidian DOM fixture exercises click handlers and component lifetimes.
class Element {
    constructor(tag='div',options={}){
        this.tag=tag;this.children=[];this.style={};this.attrs={};this.events={};this._text=options.text||'';
        this.classes=new Set((options.cls||'').split(/\s+/).filter(Boolean));
        this.classList={add:(...names)=>names.forEach(n=>this.classes.add(n)),contains:n=>this.classes.has(n)};
        Object.assign(this,options);
    }
    createEl(tag,options){return this.appendChild(new Element(tag,options));}
    createDiv(options){return this.createEl('div',options);}
    appendChild(child){if(child.parent){child.parent.children.splice(child.parent.children.indexOf(child),1);}child.parent=this;this.children.push(child);return child;}
    empty(){this.children.forEach(c=>c.parent=null);this.children=[];this._text='';}
    set textContent(text){this.empty();this._text=String(text);}
    get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
    setAttribute(name,value){this.attrs[name]=String(value);}
    getAttribute(name){return this.attrs[name];}
    addEventListener(name,handler){(this.events[name]??=[]).push(handler);}
    removeEventListener(name,handler){this.events[name]=(this.events[name]||[]).filter(fn=>fn!==handler);}
    async click(extra={}){for(const handler of this.events.click||[])await handler({preventDefault(){},stopPropagation(){},...extra});}
    all(tag){return this.children.flatMap(c=>[...(c.tag===tag?[c]:[]),...c.all(tag)]);}
}
function lazyFixture(render){
    const container=new Element(),children=new Set(),removed=[],open=[],disposers=[];
    const dv={container,current:()=>({file:{path:'Кино/_index.md'}}),component:{addChild:c=>children.add(c),removeChild:c=>{children.delete(c);removed.push(c);},register:fn=>disposers.push(fn)}};
    const app={workspace:{openLinkText:(...args)=>open.push(args)}};
    lazy({dv,app,obsidian:{Component:class {},MarkdownRenderer:{render}},target:'Кино/_Кино.base#Последние',label:'последние просмотры'});
    return {container,button:container.all('button')[0],content:container.children[1],children,removed,open,disposers};
}

test('Bases stay unloaded until click; collapse releases child; reopen creates one child',async()=>{
    const calls=[];const f=lazyFixture(async(...args)=>{calls.push(args);args[2].createDiv({text:'Loaded'});});
    assert.equal(calls.length,0);assert.equal(f.button.getAttribute('aria-expanded'),'false');
    await f.button.click();assert.equal(calls.length,1);assert.equal(f.children.size,1);
    assert.equal(calls[0][1],'![[Кино/_Кино.base#Последние]]');assert.equal(f.button.getAttribute('aria-expanded'),'true');
    await f.button.click();assert.equal(f.children.size,0);assert.equal(f.removed.length,1);assert.equal(f.content.children.length,0);
    await f.button.click();assert.equal(calls.length,2);assert.equal(f.children.size,1);
});

test('Bases render failure releases resources and retry clears the old error',async()=>{
    let count=0;const f=lazyFixture(async(app,text,parent)=>{if(!count++)throw new Error('Render failed');parent.createDiv({text:'Loaded'});});
    await f.button.click();assert.equal(f.children.size,0);assert.equal(f.button.disabled,false);assert.equal(f.content.textContent,'Render failed');
    await f.button.click();assert.equal(f.content.textContent,'Loaded');assert.equal(f.children.size,1);
});

test('rapid clicks during Bases loading do not create duplicate components',async()=>{
    let done,calls=0;const f=lazyFixture(()=>{calls++;return new Promise(resolve=>done=resolve);});
    const first=f.button.click();await f.button.click();assert.equal(calls,1);assert.equal(f.children.size,1);assert.equal(f.button.disabled,true);
    done();await first;assert.equal(f.button.disabled,false);
});

test('missing Bases renderer leaves an explicit working catalogue link',async()=>{
    const container=new Element(),open=[];
    lazy({dv:{container,current:()=>({file:{path:'Кино/_index.md'}})},app:{workspace:{openLinkText:(...args)=>open.push(args)}},obsidian:{},target:'Кино/_Кино.base#Последние',label:'последние просмотры'});
    await container.all('button')[0].click();await container.all('a')[0].click({ctrlKey:true});
    assert.deepEqual(open,[['Кино/_Кино.base#Последние','Кино/_index.md',true]]);
});

const films=[
    {ruTitle:'Фильм 10',enTitle:'Film 10',kpRating:8,forecast:7.5,libraryPath:'Кино/Media/Film.md',description:'Long '.repeat(90)},
    {ruTitle:'Фильм 2',enTitle:'Film 2',kpRating:8,forecast:'9,1',url:'https://example.test/film',description:'Description'},
    {ruTitle:'Без оценки',enTitle:'',kpRating:null,forecast:null,url:'https://example.test/missing'}
];
test('saved recommendation rows retain values, stable sorting, full descriptions and internal links',async()=>{
    const container=new Element(),disposers=[],open=[];
    saved.render({container,component:{register:fn=>disposers.push(fn)},current:()=>({file:{path:'Кино/_system/Рекомендации.md'}})},films,{workspace:{openLinkText:(...args)=>open.push(args)}});
    const wrap=container.children[0],table=wrap.all('table')[0],body=table.all('tbody')[0];
    assert.equal(wrap.tabIndex,0);assert.equal(table.style.width,undefined);
    assert.equal(body.children[0].all('details')[0].all('div')[0].textContent,films[0].description.trim());
    assert.equal(body.children[1].children[3].textContent,'9.1');
    await body.children[0].all('a')[0].click({metaKey:true});
    assert.deepEqual(open,[['Кино/Media/Film.md','Кино/_system/Рекомендации.md',true]]);
    const buttons=table.all('button');await buttons[2].click();
    assert.ok(body.children[0].textContent.startsWith('✓ Фильм 10'));assert.ok(body.children[1].textContent.startsWith('Фильм 2'));
    assert.ok(body.children[2].textContent.startsWith('Без оценки'));await buttons[0].click();
    assert.ok(body.children[0].textContent.startsWith('Без оценки'));assert.ok(body.children[1].textContent.startsWith('Фильм 2'));
    disposers.forEach(fn=>fn());assert.equal(buttons[0].events.click.length,0);
});

test('live recommendation table preserves source links and sort callbacks without network work',async()=>{
    const source=script('recommendations.js');
    const section=source.slice(source.indexOf('function renderTable('),source.indexOf('function recommendationIdentity('));
    const columns=[['ruTitle','Русское название'],['enTitle','English'],['kpRating','Рейтинг КП'],['forecast','Мой прогноз'],['description','Описание']];
    const container=new Element(),open=[],sorts=[];
    const render=new Function('SORT_COLUMNS','fmt','kinopoiskUrl','app','dv',section+';return renderTable;')(columns,v=>v==null?'—':String(v),()=> 'https://example.test/kp',{workspace:{openLinkText:(...args)=>open.push(args)}},{current:()=>({file:{path:'Кино/_system/Рекомендации.md'}})});
    render({tableWrap:container},films,{key:'kpRating',direction:-1},key=>sorts.push(key));
    assert.equal(container.all('table')[0].style.width,undefined);
    await container.all('button')[0].click();assert.deepEqual(sorts,['ruTitle']);
    await container.all('a')[0].click();assert.equal(open[0][0],films[0].libraryPath);
    assert.equal(container.all('details')[0].all('div')[0].textContent,films[0].description.trim());
});

for(const [name,selected] of [['actor','Test Person'],['director','Test Person'],['genre','Драма']])test(`${name} fallback page gains presentation while retaining its original catalogue`,async()=>{
    async function create(withLayout){
        const files=new Map(),frontmatter=new Map(),opened=[];
        const layout={path:'Кино/_system/card_layout.js',extension:'js'};if(withLayout)files.set(layout.path,layout);
        const app={vault:{
            getAbstractFileByPath:p=>files.get(p),read:async f=>f===layout?script('card_layout.js'):f.raw,
            createFolder:async p=>files.set(p,{path:p}),create:async(p,raw)=>{const f={path:p,extension:'md',basename:path.basename(p,'.md'),raw};files.set(p,f);frontmatter.set(p,{});return f;}
        },metadataCache:{getFileCache:f=>({frontmatter:frontmatter.get(f.path)||{}})},fileManager:{processFrontMatter:async(f,fn)=>fn(frontmatter.get(f.path))},workspace:{getLeaf:()=>({openFile:async f=>opened.push(f)})}};
        await require('../open_kino_'+name+'.js')({app,obsidian:{parseYaml:()=>({})},quickAddApi:{},variables:{entity:selected}});
        assert.equal(opened.length,1);assert.equal(frontmatter.get(opened[0].path).Выбрано,selected);return opened[0];
    }
    const original=await create(false),file=await create(true);
    assert.equal(file.raw===require('../card_layout.js').ensureLayout(original.raw,{kind:'entity',parseYaml:()=>({})}),true,'catalogue content preserved exactly by the wrapper');
    assert.match(file.raw,/cssclasses: \["kino-page","kino-entity"\]/);
    assert.equal(file.raw.split('<!-- KINO:UI:START -->').length-1,1);
    assert.equal(/```(?:base|dataviewjs)/.test(file.raw),true);
});
