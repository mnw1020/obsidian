const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/Mindwork/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {fromText}=require('./yaml_fixture.cjs'),root=path.resolve(__dirname,'../..'),files=[];
function scan(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){const full=path.join(folder,entry.name);if(entry.isDirectory())scan(full);else if(entry.name.endsWith('.md')){const text=fs.readFileSync(full,'utf8'),fm=fromText(text);files.push({path:'Книги/'+path.relative(root,full).replaceAll('\\','/'),basename:entry.name.slice(0,-3),extension:'md',text,fm,stat:{mtime:1}});}}}
for(const folder of ['Художественные','Non-fiction','Цитаты'])scan(path.join(root,folder));
const source=fs.readFileSync(path.join(root,'_system/knowledge.js'),'utf8'),core=fs.readFileSync(path.join(root,'_system/book_core.js'),'utf8'),css=fs.readFileSync(path.join(root,'_system/quotes-index.css'),'utf8');
const baseline=`*{box-sizing:border-box}body{margin:0;font:16px/1.5 Arial;background:var(--background-primary);color:var(--text-normal);--background-primary:#faf9f6;--background-secondary:#efede7;--background-modifier-border:#d8d3c9;--text-muted:#716b62;--text-normal:#302e2a;--text-accent:#9b561e}main{max-width:900px;margin:auto;padding:20px;min-width:0}button,select{font:inherit;cursor:pointer}.theme-dark{--background-primary:#16181c;--background-secondary:#202328;--background-modifier-border:#3c3f44;--text-muted:#b4b8c2;--text-normal:#ececec;--text-accent:#efa76b}`;
async function main(){const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});let checks=0;try{
for(const width of [320,390,1024])for(const theme of ['theme-light','theme-dark']){
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent(`<style>${baseline}</style><body class="${theme}"><main><h1>Цитаты</h1><div id="content"></div></main></body>`);
 await page.evaluate(async({source,core,css,files})=>{
  const map=new Map(files.map(file=>[file.path,file]));
  map.set('Книги/_system/book_core.js',{path:'Книги/_system/book_core.js',text:core});map.set('Книги/_system/quotes-index.css',{path:'Книги/_system/quotes-index.css',text:css});
  const app={vault:{getAbstractFileByPath:path=>map.get(path),read:async file=>file.text,getMarkdownFiles:()=>files,on:()=>({})},metadataCache:{getFileCache:file=>({frontmatter:file.fm}),on:()=>({})},workspace:{openLinkText:()=>{}}};
  const m={exports:{}};new Function('module',source)(m);window.handle=await m.exports({app,obsidian:{},dv:{container:document.querySelector('#content'),component:{register:()=>{}}},mode:'index'});
 },{source,core,css,files});
 const total=await page.locator('.book-excerpt-card').count();assert(total>=18);
 assert.equal(await page.locator('.book-quotes-group[open]').count(),0);
 const heading=page.locator('.book-quotes-group > summary').filter({hasText:'Мотивация'});await heading.click();
 assert.equal(await page.locator('.book-quotes-group[open] .book-excerpt-card').count(),11);
 await page.getByRole('button',{name:'По источникам',exact:true}).click();
 assert.equal(await page.locator('.book-quotes-group[open]').count(),0);
 assert((await page.locator('.book-quotes-group').count())>=6);
 await page.getByLabel('Поиск цитат',{exact:true}).fill('мелкой моторики');
 assert.equal(await page.locator('.book-excerpt-card').count(),1);assert.equal(await page.locator('.book-quotes-group[open]').count(),1);
 await page.getByRole('button',{name:'Сбросить',exact:true}).click();assert.equal(await page.locator('.book-excerpt-card').count(),total);
 await page.getByRole('button',{name:'Раскрыть все',exact:true}).click();
 assert.equal(await page.locator('.book-quotes-group[open]').count(),await page.locator('.book-quotes-group').count());
 await page.getByRole('button',{name:'Свернуть все',exact:true}).click();assert.equal(await page.locator('.book-quotes-group[open]').count(),0);
 await page.getByLabel('Все темы',{exact:true}).selectOption('сон');
 assert.equal(await page.locator('.book-excerpt-card').count(),1);
 await page.getByRole('button',{name:'Сбросить',exact:true}).click();
 await page.getByRole('button',{name:'По темам',exact:true}).click();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 if(process.env.QUOTES_SCREENSHOT_DIR&&width===390&&theme==='theme-light')await page.screenshot({path:path.join(process.env.QUOTES_SCREENSHOT_DIR,'quotes-organized.png')});
 await page.evaluate(()=>window.handle.dispose());assert.deepEqual(errors,[]);checks++;await page.close();
}
}finally{await browser.close();}console.log(`${checks} quote Chromium scenarios passed: real collection, closed sections, themes/sources, search, reset and expand/collapse.`);}
main().catch(error=>{console.error(error);process.exitCode=1;});
