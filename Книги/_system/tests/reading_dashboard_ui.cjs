const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Mindwork/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { fromText } = require('./yaml_fixture.cjs');
const core = require('../book_core.js')({app:{},obsidian:{}}), knowledge = require('../knowledge.js');
const root = path.resolve(__dirname,'../..');
const records = [];
function scan(folder) {
  for (const entry of fs.readdirSync(folder,{withFileTypes:true})) {
    const full = path.join(folder,entry.name);
    if(entry.isDirectory()) scan(full);
    else if(entry.name.endsWith('.md')) {
      const text = fs.readFileSync(full,'utf8'), fm=fromText(text);
      if(!fm.title || !fm.authors) continue;
      records.push({fm,file:{path:'Книги/'+path.relative(root,full).replaceAll('\\','/'),basename:entry.name.slice(0,-3)},history:core.parseHistory(text).entries,excerpts:knowledge.parseExcerpts(text)});
    }
  }
}
scan(path.join(root,'Художественные')); scan(path.join(root,'Non-fiction'));
const source=fs.readFileSync(path.join(root,'_system/reading_dashboard.js'),'utf8');
const css=fs.readFileSync(path.join(root,'_system/reading-dashboard.css'),'utf8');
const baseline=`*{box-sizing:border-box}body{margin:0;font:16px/1.5 Arial;background:var(--background-primary);color:var(--text-normal);--background-primary:#faf9f6;--background-secondary:#efede7;--background-modifier-border:#d8d3c9;--text-muted:#716b62;--text-normal:#302e2a;--text-accent:#9b561e;--interactive-accent:#9b561e}main{max-width:900px;margin:auto;padding:16px;min-width:0}button,select{font:inherit;border:1px solid var(--background-modifier-border);background:var(--background-secondary);color:var(--text-normal);border-radius:6px;cursor:pointer}button{padding:5px 10px}a{color:var(--text-accent)}td,th{padding:8px;text-align:left;border-bottom:1px solid var(--background-modifier-border)}table{border-collapse:collapse}body.dark{--background-primary:#20242a;--background-secondary:#292e36;--background-modifier-border:#454b56;--text-muted:#b4b8c2;--text-normal:#ececec;--text-accent:#efa76b;--interactive-accent:#efa76b}`;
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 let checks=0;
 try{
  for(const width of [320,390,1024]) for(const mode of ['home','index']) for(const theme of ['light','dark']){
   const page=await browser.newPage({viewport:{width,height:1000}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.setContent(`<style>${baseline}</style><body class="${theme}"><main><h1>${mode==='home'?'Чтение в цифрах':'Итоги чтения'}</h1><div id="content"></div></main></body>`);
   await page.evaluate(async({records,source,css,mode})=>{
     const module={exports:{}};new Function('module',source)(module);
     const service={snapshot:async()=>records,subscribe:()=>()=>{},core:{displayDate:value=>value.split('-').reverse().join('.')}};
     globalThis.dashboardService=service;
     const app={vault:{getAbstractFileByPath:path=>({path}),read:async file=>file.path.endsWith('.css')?css:'module.exports.getService=async()=>globalThis.dashboardService;'},workspace:{openLinkText:()=>{}}};
     await module.exports({dv:{container:document.querySelector('#content'),component:{register:()=>{}}},app,obsidian:{},mode});
   },{records,source,css,mode});
   if(mode==='index'){
     await page.getByLabel('Год чтения',{exact:true}).selectOption('2024');
     await page.getByLabel('Месяц чтения',{exact:true}).selectOption('04');
     await page.getByRole('button',{name:'Сбросить месяц: апрель',exact:true}).click();
     assert.equal(await page.getByLabel('Месяц чтения',{exact:true}).inputValue(),'');
     await page.getByLabel('Месяц чтения',{exact:true}).selectOption('10');
     assert.equal(await page.locator('.book-dashboard-month.is-selected').count(),1);
     await page.getByRole('button',{name:'Сбросить месяц',exact:true}).click();
     assert.equal(await page.locator('.book-dashboard-month.is-selected').count(),0);
   }else assert.equal(await page.locator('select').count(),0);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   assert.equal(overflow,false,`${mode}, ${theme}, ${width}: page overflow`);
   assert.deepEqual(errors,[]);
   if(width===390 && theme==='light' && process.env.DASHBOARD_SCREENSHOT_DIR){
     await page.screenshot({path:path.join(process.env.DASHBOARD_SCREENSHOT_DIR,`reading-${mode}.png`)});
   }
   checks++;await page.close();
  }
 }finally{await browser.close();}
 console.log(`${checks} Chromium scenarios passed with ${records.length} real cards: periods, resets, mobile widths and themes.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
