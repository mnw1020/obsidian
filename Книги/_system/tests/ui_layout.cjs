// Read-only Chromium DOM checks of real widgets and current QuickAdd fields.
// Usage: node _system/tests/ui_layout.cjs --screenshots=<artifact-directory>
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {fromText,parseYaml}=require('./yaml_fixture.cjs');
const root=path.resolve(__dirname,'../..');
const deps=process.env.CODEX_TASK_NODE_MODULES||'C:/Users/Mindwork/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=require(path.join(deps,'playwright'));
const artifactDir=process.argv.find(x=>x.startsWith('--screenshots='))?.slice(14);
const widths=[320,390,736,1024],files=[],sources={};
function scan(folder,prefix){
 for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
  const full=path.join(folder,entry.name),vpath=prefix+'/'+entry.name;
  if(entry.isDirectory()){if(entry.name!=='_system')scan(full,vpath);continue;}
  if(!entry.name.endsWith('.md'))continue;
  const text=fs.readFileSync(full,'utf8');
  files.push({path:vpath,name:entry.name,basename:entry.name.slice(0,-3),extension:'md',text,fm:fromText(text),stat:{mtime:fs.statSync(full).mtimeMs}});
 }
}
scan(root,'Книги');
for(const name of ['book_core','lazy_base','knowledge','reading_dashboard'])sources['Книги/_system/'+name+'.js']=fs.readFileSync(path.join(root,'_system',name+'.js'),'utf8');
const app={metadataCache:{getFileCache:f=>({frontmatter:f.fm})},vault:{getMarkdownFiles:()=>files,getAbstractFileByPath:p=>files.find(f=>f.path===p)||(sources[p]?{path:p,text:sources[p]}:null),read:async f=>f.text},workspace:{getActiveFile:()=>null}};
const core=require('../book_core.js')({app,obsidian:{parseYaml}}),stats=core.stats(),config=[];
const base=fs.readFileSync(path.join(root,'Книги.base'),'utf8');
assert.match(base,/- type: list\r?\n\s+name: Главная[\s\S]*?limit: 20/);
assert.match(base,/- type: table\r?\n\s+name: Все/);
const plugin=path.resolve(root,'../.obsidian/plugins/quickadd');
const pluginJs=fs.readFileSync(path.join(plugin,'main.js'),'utf8');
const start=pluginJs.indexOf('renderFieldControl(t){',pluginJs.indexOf('Uh=class'));
const end=pluginJs.indexOf('}renderFilePickerField(t,n,i){',start);
assert(start>0&&end>start,'locate installed QuickAdd field renderer');
const rendererSource=pluginJs.slice(start,end+1);
const css=fs.readFileSync(path.join(root,'_system/books-library.css'),'utf8');
const pluginCss=fs.readFileSync(path.join(plugin,'styles.css'),'utf8');
const yamlSource=fs.readFileSync(path.join(__dirname,'yaml_fixture.cjs'),'utf8');
const notes=['_index.md','_system/Цитаты.md','_system/Итоги чтения.md'].map(name=>({name,text:fs.readFileSync(path.join(root,name),'utf8')}));
const knowledge=require('../knowledge.js');
core.books().slice(0,3).forEach((book,index)=>{book.text+='\n'+knowledge.renderExcerpt({id:'book-excerpt-layout-'+index,type:index===1?'quote':'idea',text:'Тест переноса: '+'длинноеслово'.repeat(25),themes:['длинная тема для проверки мобильного интерфейса','мышление'],conclusion:'Личный вывод с несколькими предложениями.',location:'глава 2, страница 17'});});
const baseline=[
'*{box-sizing:border-box}body{margin:0;font:16px/1.5 Arial,sans-serif;background:#20242a;color:#ececec;--background-primary:#20242a;--background-secondary:#292e36;--background-modifier-border:#454b56;--background-modifier-form-field:#232831;--text-muted:#b4b8c2;--text-normal:#ececec;--text-error:#ff8383;--size-4-4:16px;--size-4-2:8px;--size-4-3:12px;--font-ui-small:14px;--font-ui-smaller:13px}',
'.markdown-preview-view{max-width:900px;margin:auto;padding:16px;min-width:0}a{color:#efa76b;text-decoration:none}button,input,select,textarea{font:inherit;color:inherit;background:#333943;border:1px solid #59616d;border-radius:6px;padding:7px 10px}button{cursor:pointer}input,select,textarea{min-width:0}textarea{resize:vertical}table{border-collapse:collapse}td,th{padding:7px 10px;border:1px solid #454b56;text-align:left}h1{font-size:1.75em}h2{font-size:1.4em}h4{font-size:1em}.callout{padding:12px;border:1px solid #454b56}.bases-list{padding-left:20px}.bases-list li{padding:5px 0;overflow-wrap:anywhere}.internal-link{overflow-wrap:anywhere}',
'.modal-container{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#111a}.modal{width:min(700px,calc(100vw - 24px));padding:16px;background:#292e36;max-height:85vh;overflow:auto;border:1px solid #59616d;border-radius:12px}.modal-content{min-width:0}.setting-item{display:flex;align-items:center;gap:12px;border-top:1px solid #454b56;padding:12px 0}.setting-item-info{flex:1;min-width:0}.setting-item-name{font-weight:600}.setting-item-description{color:#b4b8c2;font-size:13px}.setting-item-control{display:flex;justify-content:flex-end;flex:0 1 55%;min-width:0;gap:6px}.setting-item-control input{width:100%;min-width:0}.setting-item-control select{max-width:100%}.qa-prompt-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}',
 '@media(max-width:540px){.setting-item{flex-direction:column;align-items:stretch}.setting-item-control{flex:auto;width:100%;justify-content:flex-start}.setting-item-control>*{width:100%}.modal{padding:12px}}'
].join('\n');
async function main(){
 await require('../QuickAdd/add_book.js')({app,obsidian:{parseYaml,normalizePath:x=>x,Notice:class{}},quickAddApi:{date:{now:()=> '2026-10-04'},requestInputs:async fields=>{config.push(...fields);return null;}}});
 assert.equal(config.length,9);
 assert.equal(config.find(f=>f.id.startsWith('authors')).options.length,stats.authors);
 assert.equal(config.find(f=>f.id.startsWith('series')).options.length,stats.series);
 assert.equal(config.find(f=>f.id.startsWith('rating')).numericConfig.max,10);
 const {marked}=await import(pathToFileURL(path.join(deps,'marked/lib/marked.esm.js')).href);
 const prepared=notes.map(note=>({...note,cssclasses:fromText(note.text).cssclasses||[],parts:note.text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/,'').split(/\x60{3}dataviewjs\r?\n([\s\S]*?)\x60{3}/g).map((value,index)=>index%2?{code:value}:{html:marked.parse(value.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,(_,target,label)=>'['+(label||target.split('/').at(-1))+'](#'+encodeURIComponent(target)+')'))})}));
 const executablePath=process.env.CODEX_TASK_CHROMIUM||'C:/Program Files/Google/Chrome/Application/chrome.exe';
 const browser=await chromium.launch({headless:true,executablePath}),results=[];
 try{
  for(const width of widths){
   for(const note of prepared){
    const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.setContent('<!doctype html><html><head><meta charset="utf-8"><style>'+baseline+'\n'+css+'</style></head><body></body></html>');
    await page.evaluate(async({note,files,sources,yamlSource})=>{
     const module={exports:{}};new Function('module',yamlSource)(module);
     const map=new Map(files.map(f=>[f.path,f]));for(const[path,text]of Object.entries(sources))map.set(path,{path,extension:'js',text});
     class Emitter{on(name,cb){return{name,cb};}offref(){}}
     const obsidian={parseYaml:module.exports.parseYaml,normalizePath:x=>x,Notice:class{},Component:class{},MarkdownRenderer:{render:async(app,text,content)=>{
      const list=content.createEl('ul',{cls:'bases-list'});
      const rows=[...map.values()].filter(f=>f.fm?.title&&f.fm?.authors).sort((a,b)=>String(b.fm.date).localeCompare(String(a.fm.date))).slice(0,20);
      for(const row of rows)list.createEl('li').textContent=row.fm.title+' · '+[].concat(row.fm.authors).join(', ')+' · '+(row.fm.rating||'—')+' · '+row.fm.date;
     }}};
     const vault=Object.assign(new Emitter(),{getMarkdownFiles:()=>[...map.values()].filter(f=>f.extension==='md'),getAbstractFileByPath:p=>map.get(p),read:async f=>f.text,cachedRead:async f=>f.text});
     const app={vault,metadataCache:Object.assign(new Emitter(),{getFileCache:f=>({frontmatter:f.fm||{}})}),workspace:{openLinkText(){}},plugins:{plugins:{quickadd:{api:{executeChoice:async()=>{}}}}}};
     Element.prototype.createEl=function(tag,opts={}){const el=document.createElement(tag);if(opts.text)el.textContent=opts.text;if(opts.cls)el.className=opts.cls;if(opts.href)el.setAttribute('href',opts.href);this.appendChild(el);return el;};
     Element.prototype.createDiv=function(opts){return this.createEl('div',opts);};Element.prototype.empty=function(){this.replaceChildren();};
     const root=document.body.createDiv({cls:'markdown-preview-view '+note.cssclasses.join(' ')}),dispose=[];
     const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
     for(const part of note.parts){
      if(part.html){const chunk=root.createDiv();chunk.innerHTML=part.html;for(const quote of chunk.querySelectorAll('blockquote'))if(quote.textContent.includes('[!quote] Библиотека')){quote.className='callout';quote.dataset.callout='quote';quote.createEl('span',{text:'Библиотека',cls:'callout-title-inner'});}}
      else{const container=root.createDiv({cls:'block-language-dataviewjs'});const dv={container,component:{register:cb=>dispose.push(cb),registerEvent(){},addChild(){},removeChild(){}},current:()=>({file:{path:'Книги/'+note.name}}),paragraph:text=>container.createEl('p',{text})};await new AsyncFunction('dv','app','require',part.code)(dv,app,()=>obsidian);}
     }
     window.__dispose=()=>dispose.forEach(fn=>fn());
    },{note,files,sources,yamlSource});
    const m=await page.evaluate(()=>({documentWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,
     widgets:[...document.querySelectorAll('.books-stat-grid,.book-knowledge-controls,.book-excerpt-card,.book-dashboard-metrics,.book-dashboard-table,.books-actionbar')].map(el=>({cls:el.className,width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right})),
     statsText:document.querySelector('.books-stat-card')?.textContent,excerpts:document.querySelectorAll('.book-excerpt-card').length,dashboardMetrics:document.querySelectorAll('.book-dashboard-metric').length,
     cardPadding:getComputedStyle(document.querySelector('.book-excerpt-card')||document.body).padding,dashboardDisplay:getComputedStyle(document.querySelector('.book-dashboard-metric')||document.body).display,
     errors:document.body.textContent.match(/Не удалось[^\n]*/g)||[]}));
    assert.deepEqual(errors,[],note.name+' browser errors');assert.deepEqual(m.errors,[],note.name+' rendering errors');
    assert(m.documentWidth<=width+1,note.name+' overflow at '+width+': '+JSON.stringify(m));
    for(const widget of m.widgets)assert(widget.right<=width+1,widget.cls+' clipped at '+width);
    if(note.name==='_index.md'){assert.match(m.statsText,new RegExp('^'+stats.books+' Произведений'));assert.equal(m.dashboardMetrics,3);}
    if(note.name.includes('Идеи')){assert.equal(m.excerpts,3);assert.notEqual(m.cardPadding,'0px','standalone knowledge styling');}
    if(note.name.includes('Итоги')){assert.equal(m.dashboardMetrics,3);assert.equal(m.dashboardDisplay,'flex','standalone dashboard styling');}
    if(artifactDir){fs.mkdirSync(artifactDir,{recursive:true});await page.screenshot({path:path.join(artifactDir,width+'-'+(note.name==='_index.md'?'home':note.name.includes('Идеи')?'knowledge':'dashboard')+'.png'),fullPage:true});}
    results.push({width,page:note.name,...m});await page.evaluate(()=>window.__dispose());await page.close();
   }
   const page=await browser.newPage({viewport:{width,height:900}});
   await page.setContent('<!doctype html><html><head><meta charset="utf-8"><style>'+baseline+'\n'+pluginCss+'</style></head><body><div class="modal-container quickAddModal onePageInputModal"><div class="modal"><div class="modal-content"></div></div></div></body></html>');
   await page.evaluate(({config,rendererSource})=>{
    Element.prototype.createEl=function(tag,opts={}){const el=document.createElement(tag);if(opts.text)el.textContent=opts.text;if(opts.cls)el.className=opts.cls;this.appendChild(el);return el;};
    Element.prototype.createDiv=function(opts){return this.createEl('div',opts);};Element.prototype.addClass=function(...names){this.classList.add(...names);return this;};
    class Setting{constructor(p){this.settingEl=p.createDiv({cls:'setting-item'});this.infoEl=this.settingEl.createDiv({cls:'setting-item-info'});this.nameEl=this.infoEl.createDiv({cls:'setting-item-name'});this.controlEl=this.settingEl.createDiv({cls:'setting-item-control'});}setName(x){this.nameEl.append(x);return this;}setDesc(text){this.infoEl.createDiv({cls:'setting-item-description',text});return this;}}
    class TextComponent{constructor(p,tag='input'){this.inputEl=p.createEl(tag);}setPlaceholder(x){this.inputEl.placeholder=x;return this;}setValue(x){this.inputEl.value=x;return this;}onChange(cb){this.inputEl.addEventListener('input',()=>cb(this.inputEl.value));return this;}}
    class TextAreaComponent extends TextComponent{constructor(p){super(p,'textarea');}}
    class DropdownComponent extends TextComponent{constructor(p){super(p,'select');}addOption(value,text){this.inputEl.createEl('option',{text}).value=value;return this;}setDisabled(x){this.inputEl.disabled=x;return this;}}
    const mt={Setting,TextComponent,TextAreaComponent,DropdownComponent};
    const renderer=new Function('mt','Ks','PW','FW','aS','return ({'+rendererSource+'})')(mt,x=>x,(x,options)=>options.includes(x)?x:options[0],x=>x,class{}),controls=new Map();
    Object.assign(renderer,{contentEl:document.querySelector('.modal-content'),app:{},initialValues:new Map(),controlFor:f=>{if(!controls.has(f.id))controls.set(f.id,{value:'',suggesters:[]});return controls.get(f.id);},publishControl(){},updatePreviewDebounced(){},decorateLabel:f=>f.label+(f.optional?' (optional)':''),enableImagePaste(){},attachFreeTextBehaviors(){}});
    renderer.contentEl.createEl('h2',{text:'Записать произведение'});for(const field of config)renderer.renderFieldControl(field);
    const actions=renderer.contentEl.createDiv({cls:'qa-prompt-actions'});actions.createEl('button',{text:'Отмена'});actions.createEl('button',{text:'Сохранить'});
   },{config,rendererSource});
   const m=await page.evaluate(()=>{const controls=[...document.querySelectorAll('.setting-item-control input,.setting-item-control select,.setting-item-control textarea')],outer=document.querySelector('.modal').getBoundingClientRect();return{documentWidth:document.documentElement.scrollWidth,controls:controls.length,modalWidth:outer.width,clipped:controls.filter(el=>{const r=el.getBoundingClientRect();return r.right>outer.right-4||r.left<outer.left+4;}).map(el=>el.outerHTML)};});
   assert.equal(m.controls,9);assert.equal(m.clipped.length,0,'QuickAdd controls clipped at '+width+': '+JSON.stringify(m));assert(m.documentWidth<=width+1,'QuickAdd page overflow');
   if(artifactDir)await page.screenshot({path:path.join(artifactDir,width+'-add-book.png'),fullPage:true});
   results.push({width,page:'add_book form',...m});await page.close();
  }
 }finally{await browser.close();}
 const report={stats,cases:results.length,widths,results,limitation:'Bases uses a list DOM fixture; actual installed QuickAdd renderFieldControl uses Obsidian DOM adapters and baseline Obsidian CSS. Native app verification is separate.'};
 if(artifactDir)fs.writeFileSync(path.join(artifactDir,'layout-report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({stats,cases:results.length,widths,result:'passed',artifactDir},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});

