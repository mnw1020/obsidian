const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/Mindwork/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {fromText}=require('./yaml_fixture.cjs'),core=require('../book_core.js')({app:{},obsidian:{}}),knowledge=require('../knowledge.js');
const root=path.resolve(__dirname,'../..'),records=[];
function scan(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){const full=path.join(folder,entry.name);if(entry.isDirectory())scan(full);else if(entry.name.endsWith('.md')){const text=fs.readFileSync(full,'utf8'),fm=fromText(text);if(fm.title&&fm.authors)records.push({fm,file:{path:'Книги/'+path.relative(root,full).replaceAll('\\','/'),basename:entry.name.slice(0,-3)},history:core.parseHistory(text).entries,excerpts:knowledge.parseExcerpts(text)});}}}
scan(path.join(root,'Художественные'));scan(path.join(root,'Non-fiction'));
const source=fs.readFileSync(path.join(root,'_system/authors_ui.js'),'utf8'),css=fs.readFileSync(path.join(root,'_system/authors-ui.css'),'utf8');
const baseline=`*{box-sizing:border-box}body{margin:0;font:16px/1.5 Arial;background:var(--background-primary);color:var(--text-normal);--background-primary:#faf9f6;--background-secondary:#efede7;--background-modifier-border:#d8d3c9;--text-muted:#716b62;--text-normal:#302e2a;--text-accent:#9b561e;--interactive-accent:#9b561e;--font-interface:Arial}main{max-width:1100px;margin:auto;padding:24px;min-width:0}button,select{font:inherit;cursor:pointer}a{color:var(--text-accent)}.theme-dark{--background-primary:#16181c;--background-secondary:#202328;--background-modifier-border:#3c3f44;--text-muted:#b4b8c2;--text-normal:#ececec;--text-accent:#efa76b;--interactive-accent:#efa76b}p{margin:12px 0}@media(max-width:500px){main{padding:16px}}`;
async function main(){const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});let checks=0;try{
 for(const layout of [{width:320},{width:390},{width:1024},{width:1440,pane:390}])for(const mode of ['index','author'])for(const theme of ['theme-light','theme-dark']){
  const page=await browser.newPage({viewport:{width:layout.width,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent(`<style>${baseline}</style><body class="${theme}"><main class="markdown-preview-view"${layout.pane?' style="width:'+layout.pane+'px"':''}><div class="inline-title">Прежний заголовок</div><div id="content"></div><h2>Мои заметки</h2><p id="personal">Личные впечатления $& [[Ссылка]]</p></main></body>`);
  await page.evaluate(async({source,css,records,mode})=>{
   const m={exports:{}};new Function('module',source)(m);window.authorCalls=[];window.linkCalls=[];window.subscriptions=0;
   window.authorService={core:{displayDate:value=>value.split('-').reverse().join('.')},snapshot:async()=>records,subscribe:()=>{window.subscriptions++;return()=>window.subscriptions--;}};
   const app={vault:{getAbstractFileByPath:path=>({path}),read:async file=>file.path.endsWith('.css')?css:'module.exports.getService=async()=>window.authorService;'},workspace:{openLinkText:(...args)=>window.linkCalls.push(args)},plugins:{plugins:{quickadd:{api:{executeChoice:async(...args)=>window.authorCalls.push(args)}}}}};
   window.authorHandle=await m.exports({app,dv:{container:document.querySelector('#content'),current:()=>({selected_author:'Леонид Каганов',file:{path:'Книги/_system/Авторы/Леонид Каганов-93dfbaac.md'}})},mode});
  },{source,css,records,mode});
  assert.equal(await page.locator('.inline-title').isVisible(),false);
  const initial=await page.locator('.book-authors-row').count();assert(initial>0);
  if(mode==='index'){
   await page.getByLabel('Поиск среди авторов',{exact:true}).fill('каганов');
   assert.equal(await page.locator('.book-authors-row').count(),1);
   await page.getByRole('link',{name:'Леонид Каганов',exact:true}).click();
   assert.deepEqual(await page.evaluate(()=>window.authorCalls[0]),['Книги - Открыть автора',{author:'Леонид Каганов'}]);
   await page.getByRole('button',{name:'Сбросить',exact:true}).click();
   await page.getByLabel('Сортировка',{exact:true}).selectOption('name');
  }else{
   await page.getByLabel('Поиск среди произведений',{exact:true}).fill('эпос');
   assert.equal(await page.locator('.book-authors-row').count(),1);
   await page.locator('.book-authors-row-title a').click();
   assert.match((await page.evaluate(()=>window.linkCalls[0]))[0],/Эпос хищника$/);
   await page.getByRole('button',{name:'Сбросить',exact:true}).click();
  }
  await page.getByRole('button',{name:'Non-fiction',exact:true}).click();
  if(mode==='author')assert.equal(await page.locator('.book-authors-row').count(),0);
  await page.getByRole('button',{name:'Сбросить',exact:true}).click();
  assert.equal(await page.locator('.book-authors-row').count(),initial);
  const yearOptions=await page.getByLabel('Год чтения',{exact:true}).locator('option').evaluateAll(nodes=>nodes.map(node=>node.value));
  if(yearOptions.includes('2025')){await page.getByLabel('Год чтения',{exact:true}).selectOption('2025');await page.getByRole('button',{name:'Сбросить',exact:true}).click();}
  await page.getByRole('button',{name:'Любимые 8–10',exact:true}).click();
  assert((await page.locator('.book-authors-row').count())<=initial);
  await page.getByRole('button',{name:'Сбросить',exact:true}).click();
  assert.equal(await page.locator('#personal').textContent(),'Личные впечатления $& [[Ссылка]]');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${mode},${theme},${JSON.stringify(layout)}`);
  const clipped=await page.locator('.book-authors-ui').evaluate(root=>[...root.querySelectorAll('input,select,.book-authors-chip,.book-authors-row-title')].filter(node=>node.getBoundingClientRect().right>root.getBoundingClientRect().right+1).map(node=>node.className));assert.deepEqual(clipped,[]);
  assert.deepEqual(errors,[]);
  if(process.env.AUTHORS_SCREENSHOT_DIR && !layout.pane && (layout.width===390&&theme==='theme-light'||layout.width===1024&&theme==='theme-dark'))await page.screenshot({path:path.join(process.env.AUTHORS_SCREENSHOT_DIR,`authors-${mode}-${layout.width}.png`)});
  await page.evaluate(()=>window.authorHandle.dispose());assert.equal(await page.evaluate(()=>window.subscriptions),0);
  checks++;await page.close();
 }
 }finally{await browser.close();}console.log(`${checks} author Chromium scenarios passed: real library, search, categories, years, sorting, reset, links, theme, narrow panes and cleanup.`);}
main().catch(error=>{console.error(error);process.exitCode=1;});
