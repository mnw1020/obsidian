// Synthetic read-only regressions for persistent entities and home widget lifecycles.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const { fromText, parseYaml } = require(path.join(root, '_system/tests/yaml_fixture.cjs'));
const files = new Map();
let writes = 0;
let skippedYaml = [];
function makeFile(vpath, text, fullpath) {
  const name = vpath.split('/').at(-1);
  let fm = {};
  try { fm = fromText(text); } catch (error) {
    if(vpath.startsWith('Кино/')){
      const tags = text.match(/^tags:\s*\r?\n((?:[ \t]+-.*\r?\n)*)/m)?.[1]||'';
      fm.tags = [...tags.matchAll(/^[ \t]+-\s+["']?#?([^"'\r\n]+)/gm)].map(match=>match[1].trim());
      fm['Оценка'] = text.match(/^Оценка:\s*["']?(\d+(?:\.\d+)?)/m)?.[1];
    } else skippedYaml.push([vpath,error.message]);
  }
  const file = {path:vpath, name, basename:name.replace(/\.md$/i,''), extension:path.extname(name).slice(1), fm, text, fullpath, stat:{mtime:Date.now()}};
  files.set(vpath,file);
  return file;
}
function fixture(vpath, fm) {
  return makeFile(vpath, '---\n' + Object.entries(fm).map(([key,value]) => key + ': ' + JSON.stringify(value)).join('\n') + '\n---\n\nЛичный конспект.\n');
}
fixture('Книги/Художественные/Первая.md', {title:'Первая',authors:['Леонид Каганов'],rating:8,date:'2026-10-03',read_count:1,series:'Тёмные начала',series_index:1});
fixture('Книги/Художественные/Вторая.md', {title:'Вторая',authors:['Леонид Каганов'],rating:9,date:'2024-10',read_count:1,series:'Память о прошлом Земли',series_index:1});
fixture('Книги/Художественные/Третья.md', {title:'Третья',authors:['Олдос Хаксли'],rating:7,date:'2023-09',read_count:1});
makeFile('Книги/_index.md', fs.readFileSync(path.join(root,'_index.md'),'utf8'));
makeFile('Книги/_system/book_core.js',fs.readFileSync(path.join(root,'_system/book_core.js'),'utf8'));
class Events {
  constructor(){this.handlers=[];}
  on(name,cb){const handle={emitter:this,name,cb};this.handlers.push(handle);return handle;}
  offref(ref){this.handlers=this.handlers.filter(x=>x!==ref);}
  emit(name,...args){for(const handler of [...this.handlers])if(handler.name===name)handler.cb(...args);}
}
const vault = new Events();
Object.assign(vault,{
  getMarkdownFiles:()=>[...files.values()].filter(file=>file.extension==='md'),
  getAbstractFileByPath:vpath=>files.get(vpath),
  read:async file=>file.text,
  cachedRead:async file=>file.text,
  createFolder:async vpath=>{files.set(vpath,{path:vpath});},
  create:async(vpath,text)=>{assert(!files.has(vpath),'create existing '+vpath);writes++;return makeFile(vpath,text);},
  process:async(file,fn)=>{const text=fn(file.text);if(text!==file.text){file.text=text;file.fm=fromText(text);writes++;}return text;}
});
const metadataCache = new Events();
Object.assign(metadataCache,{
  getFileCache:file=>({frontmatter:file.fm}),
  getFirstLinkpathDest:(target,source)=>files.get(target+'.md')||files.get(target)
});
const notices=[],opened=[],choices=[];
let active=files.get('Книги/_index.md');
const app={vault,metadataCache,workspace:{getActiveFile:()=>active,getLeaf:()=>({openFile:async file=>{opened.push(file.path);active=file;}})},plugins:{plugins:{quickadd:{api:{executeChoice:async name=>choices.push(name)}}}}};
const obsidian={parseYaml,normalizePath:value=>value,Notice:class{constructor(value){notices.push(value);}}};
const api={suggester:async(labels,values)=>values[0]};
const openAuthor=require(path.join(root,'_system/QuickAdd/open_author.js'));
const openSeries=require(path.join(root,'_system/QuickAdd/open_series.js'));
const overviews=['authors_overview','series_overview','adaptations_overview'].map(name=>require(path.join(root,'_system/QuickAdd',name+'.js')));
const loadCore=require(path.join(root,'_system/book_core.js'));
const params={app,obsidian,quickAddApi:api};

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
class Element{
  constructor(tag='div',options={}){this.tag=tag;this.textContent=options.text||'';this.cls=options.cls||'';this.children=[];this.style={};this.listeners=new Map();this.attributes={};}
  createDiv(options={}){return this.createEl('div',options);}
  createEl(tag,options={}){const child=new Element(tag,options);this.children.push(child);return child;}
  setAttribute(key,value){this.attributes[key]=value;}
  addEventListener(name,cb){this.listeners.set(name,cb);}
  removeEventListener(name,cb){if(this.listeners.get(name)===cb)this.listeners.delete(name);}
  empty(){this.children=[];this.textContent='';}
  closest(){return null;}
}
function view(){
  const cleanups=[], refs=[], children=[];
  const component={
    register:cb=>cleanups.push(cb),
    registerEvent:ref=>refs.push(ref),
    addChild:child=>children.push(child),
    removeChild:child=>{const index=children.indexOf(child);if(index>=0)children.splice(index,1);},
  };
  const dv={container:new Element(),component,current:()=>({file:{path:'Книги/_index.md'}}),paragraph:text=>dv.container.createEl('p',{text})};
  return {dv,children,dispose:()=>{for(const cb of cleanups)cb();for(const ref of refs)ref.emitter.offref(ref);},refs};
}
async function main(){
 assert.equal(skippedYaml.length,0,JSON.stringify(skippedYaml.slice(0,5)));
 const AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor;
 for(const [,body]of fs.readFileSync(path.join(root,'_index.md'),'utf8').matchAll(/\x60{3}dataviewjs\r?\n([\s\S]*?)\x60{3}/g))new AsyncFunction('dv','app','require',body);
 const stats=loadCore({app,obsidian}).stats();
 console.log('Current stats:',JSON.stringify(stats));
 for(const overview of overviews)await overview(params);
 const afterFirst=writes;
 for(const overview of overviews)await overview(params);
 assert.equal(writes,afterFirst,'unchanged summaries must not write');
 await openAuthor({...params,variables:{author:'Леонид Каганов'}});
 const authorA=active;
 await openAuthor({...params,variables:{author:'Олдос Хаксли'}});
 const authorB=active;
 assert.notEqual(authorA.path,authorB.path,'authors need separate pages');
 assert.equal(authorA.fm.selected_author,'Леонид Каганов');
 const personal='\nЛичные сведения пользователя: $& [[Ссылка]] ^my-anchor\n';
 authorA.text+=personal; authorA.fm=fromText(authorA.text);
 await openAuthor({...params,variables:{author:'Леонид Каганов'}});
 assert.ok(authorA.text.endsWith(personal),'personal notes preserved byte-for-byte');
 const atomicProcess=vault.process;
 const concurrentText='\nConcurrent user edit preserved by atomic generated-region merge.\n';
 authorA.text=authorA.text.replace('**Произведений:** 2','**Произведений:** 0');
 vault.process=async(file,fn)=>{if(file===authorA)file.text+=concurrentText;return atomicProcess(file,fn);};
 await openAuthor({...params,variables:{author:'Леонид Каганов'}});
 assert.ok(authorA.text.endsWith(concurrentText),'concurrent personal edit must survive');
 assert.match(authorA.text,/\*\*Произведений:\*\* 2/);
 vault.process=atomicProcess;
 authorA.text=authorA.text.replace(concurrentText,'');
 const afterAuthor=writes;
 await openAuthor({...params,variables:{author:'Леонид Каганов'}});
 assert.equal(writes,afterAuthor,'unchanged author must not write');
 await openSeries({...params,variables:{series:'Тёмные начала'}});
 const seriesA=active;
 await openSeries({...params,variables:{series:'Память о прошлом Земли'}});
 assert.notEqual(seriesA.path,active.path,'series need separate pages');
 assert.equal(seriesA.fm.selected_series,'Тёмные начала');
 seriesA.text+=personal;
 await openSeries({...params,variables:{series:'Тёмные начала'}});
 assert.ok(seriesA.text.endsWith(personal),'series personal notes preserved');
 const lazy=require(path.join(root,'_system/lazy_base.js'));
 const actions=view(); await lazy({dv:actions.dv,app,obsidian,mode:'actions'});
 assert.equal(actions.dv.container.children[0].children.length,4);
 for(const button of actions.dv.container.children[0].children)await button.listeners.get('click')();
 assert.deepEqual(choices,['Книги - Добавить книгу','Книги - Добавить чтение','Книги - Добавить выписку','Книги - Редактировать чтение']);
 const choiceApi=app.plugins.plugins.quickadd.api;
 const execute=choiceApi.executeChoice;
 choiceApi.executeChoice=async()=>{throw new Error('Input cancelled by user');};
 const noticeCount=notices.length;
 await actions.dv.container.children[0].children[0].listeners.get('click')();
 assert.equal(notices.length,noticeCount,'intentional cancellation must be quiet');
 assert.equal(actions.dv.container.children[0].children[0].disabled,false,'cancel restores buttons');
 choiceApi.executeChoice=async()=>{throw new Error('Disk failure');};
 await actions.dv.container.children[0].children[0].listeners.get('click')();
 assert.equal(notices.length,noticeCount+1,'real failures remain visible');
 choiceApi.executeChoice=execute;
 actions.dispose();
 const statsView=view();await lazy({dv:statsView.dv,app,obsidian,mode:'stats'});
 assert.equal(statsView.dv.container.children[0].children[0].children[0].textContent,String(stats.books));
 const book=vault.getMarkdownFiles().find(file=>loadCore({app,obsidian}).isBook(file));
 files.delete(book.path);vault.emit('delete',book);await sleep(160);
 assert.equal(statsView.dv.container.children[0].children[0].children[0].textContent,String(stats.books-1));
 files.set(book.path,book);vault.emit('create',book);await sleep(160);
 assert.equal(statsView.dv.container.children[0].children[0].children[0].textContent,String(stats.books));
 statsView.dispose();
 assert.equal(metadataCache.handlers.length,0,'stats listeners disposed');
 const reread=view();await lazy({dv:reread.dv,app,obsidian,mode:'reread',label:'перечитанные',target:'Книги/Книги.base#Перечитанные'});
 const children=reread.dv.container.children[0].children;
 assert.equal(children[0].style.display,'');
 assert.equal(children[1].style.display,'none');
 const oldCount=book.fm.read_count;book.fm.read_count=2;metadataCache.emit('changed',book);await sleep(160);
 assert.equal(children[1].style.display,'');book.fm.read_count=oldCount;reread.dispose();
 const base=view();await lazy({dv:base.dv,app,obsidian:{...obsidian,Component:class{},MarkdownRenderer:{render:async(app,source,content)=>{content.textContent=source;}}},mode:'base',target:'Книги/Книги.base#Главная',label:'недавние20',expanded:true});
 assert.equal(base.children.length,1);
 await base.dv.container.children[0].children[1].listeners.get('click')();
 assert.equal(base.children.length,0,'collapse unloads native component');
 base.dispose();
 assert.equal(vault.handlers.length,0,'all events disposed');
 console.log('UI smoke passed: summaries no-op, permanent entities, note preservation, actions, live stats/delete/create, empty rereads, lazy unload.');

}
main().catch(error=>{console.error(error);process.exitCode=1;});
