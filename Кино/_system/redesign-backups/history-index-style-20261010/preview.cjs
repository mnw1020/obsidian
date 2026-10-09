/* Read-only browser fixture. Parses the real index Markdown into an Obsidian-like
 * native callout DOM; the Bases table is a fixture, not an Obsidian runtime. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '../../..');
const vault = path.dirname(root);
const appearance = JSON.parse(fs.readFileSync(path.join(vault, '.obsidian/appearance.json'), 'utf8'));
const styles = [
    fs.readFileSync(path.join(vault,'.obsidian/themes/Things/theme.css'),'utf8'),
    ...appearance.enabledCssSnippets.map(name => fs.readFileSync(path.join(vault,'.obsidian/snippets',name+'.css'),'utf8'))
];
const baseline = `
* {box-sizing:border-box;} body {margin:0; font:16px Arial,sans-serif;}
.markdown-preview-view {padding:32px 0; min-height:100vh; overflow-x:auto;}
.markdown-preview-sizer {padding:0 32px; margin:auto;}
.callout {overflow:visible;}
.callout-title {display:flex; align-items:center; padding:12px; cursor:pointer;}
.callout-title-inner {flex:1;}
.callout-icon,.callout-fold {width:18px; height:18px;}
.callout-fold svg {width:18px; height:18px; transform:rotate(90deg);}
.callout.is-collapsed>.callout-title>.callout-fold svg {transform:rotate(0);}
.callout.is-collapsed>.callout-content {display:none;}
.fixture-bases .bases-toolbar {display:flex; gap:8px; align-items:center; min-height:40px; padding:0 0 12px; color:var(--text-muted);font-size:12px;}
.fixture-bases .bases-toolbar-item {border:1px solid var(--background-modifier-border); border-radius:5px; padding:5px 8px; white-space:nowrap;}
.fixture-bases .bases-table {display:block; width:850px; font:13px Arial,sans-serif;}
.fixture-bases .bases-tr {display:grid; grid-template-columns:190px 190px 95px 115px 85px 175px;}
.fixture-bases :is(.bases-th,.bases-td) {padding:11px 12px; border-bottom:1px solid var(--background-modifier-border); min-width:0; overflow-wrap:anywhere;}
.fixture-bases .bases-th {color:var(--text-muted);background:var(--background-secondary);font-size:12px;}
.fixture-bases a {text-decoration:none;}
`;
const sources = ['Просмотры','Сезоны'].map(name => ({name,raw:fs.readFileSync(path.join(root,name,'_index.md'),'utf8')}));
async function mount(page, source) {
    await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body class="theme-dark"></body></html>');
    await page.evaluate(({styles,baseline,source}) => {
        for (const css of [baseline,...styles]) {const s=document.createElement('style');s.textContent=css;document.head.append(s);}
        const view=document.createElement('div');view.className='markdown-preview-view markdown-rendered kino-page kino-system kino-dashboard kino-history-index';
        const sizer=document.createElement('div');sizer.className='markdown-preview-sizer';view.append(sizer);document.body.append(view);
        const svg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 5 7 7-7 7"/></svg>';
        const inline=(raw,holder)=>{
            const regex=/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\[([^\]]+)\]\(([^)]+)\)/g;let last=0;
            for(const m of raw.matchAll(regex)){holder.append(document.createTextNode(raw.slice(last,m.index)));const a=document.createElement('a');a.textContent=m[2]||m[3]||m[1];a.href=m[4]||'#';if(m[1]){a.className='internal-link';a.dataset.href=m[1];}holder.append(a);last=m.index+m[0].length;}
            holder.append(document.createTextNode(raw.slice(last)));
        };
        const bases=(src,holder)=>{
            const embed=document.createElement('div');embed.className='internal-embed bases-embed';embed.setAttribute('src',src);
            const base=document.createElement('div');base.className='bases-view fixture-bases';embed.append(base);holder.append(embed);
            const toolbar=document.createElement('div');toolbar.className='bases-toolbar';base.append(toolbar);
            for(const text of ['По дате ▾','Сортировка','Фильтр']){const c=document.createElement('span');c.className='bases-toolbar-item';c.textContent=text;toolbar.append(c);}
            const table=document.createElement('div');table.className='bases-table';base.append(table);
            const rows=[['Запись',source.name==='Сезоны'?'Сериал':'Фильм',source.name==='Сезоны'?'Сезон':'Просмотр','Когда','Оценка','Комментарий'],...Array.from({length:8},(_,i)=>[`${source.name==='Сезоны'?'Локи':'Интерстеллар'} — ${i+1}`,source.name==='Сезоны'?'Локи':'Интерстеллар',String(8-i),`${String(10-i).padStart(2,'0')}.10.2026`,['8,5','9,0','7,0'][i%3],i===0?'Заметка к просмотру':''])];
            for(const [i,row] of rows.entries()){const tr=document.createElement('div');tr.className='bases-tr';table.append(tr);for(const [j,value] of row.entries()){const cell=document.createElement('div');cell.className=i?'bases-td':'bases-th';if(i&&j<2){const a=document.createElement('a');a.className='internal-link';a.href='#';a.textContent=value;cell.append(a);}else cell.textContent=value;tr.append(cell);}}
        };
        for(const block of source.raw.replace(/^---[\s\S]*?---\s*/,'').split(/\n\s*\n/)){
            const lines=block.split(/\r?\n/);const h=lines[0].match(/^> \[!([^\]]+)\]([+-]) (.+)$/);if(!h)continue;
            const callout=document.createElement('div');callout.className='callout is-collapsible'+(h[2]==='-'?' is-collapsed':'');callout.dataset.callout=h[1];
            const title=document.createElement('div');title.className='callout-title';title.tabIndex=0;
            const icon=document.createElement('div');icon.className='callout-icon';title.append(icon);
            const inner=document.createElement('div');inner.className='callout-title-inner';inner.textContent=h[3];title.append(inner);
            const fold=document.createElement('div');fold.className='callout-fold';fold.innerHTML=svg;title.append(fold);callout.append(title);
            const content=document.createElement('div');content.className='callout-content';callout.append(content);sizer.append(callout);
            const body=lines.slice(1).map(line=>line.replace(/^> ?/,'')).join('\n');
            for(const paragraph of body.split(/\n\s*\n/)){if(!paragraph.trim())continue;const m=paragraph.match(/^!\[\[([^\]]+)\]\]$/);if(m)bases(m[1],content);else{const p=document.createElement('p');inline(paragraph,p);content.append(p);}}
            const toggle=()=>callout.classList.toggle('is-collapsed');title.addEventListener('click',toggle);title.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle();}});
        }
    },{styles,baseline,source});
}
(async()=>{
    const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];
    try {
        for(const source of sources)for(const width of [390,1440]){
            const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:1});await mount(page,source);
            const measurements=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,panels:[...document.querySelectorAll('.callout')].map(el=>{const b=el.getBoundingClientRect();return{type:el.dataset.callout,left:b.left,right:b.right,width:b.width};}),actions:[...document.querySelectorAll('[data-callout="kino-history-header"] .callout-content>p:last-child a')].map(el=>{const b=el.getBoundingClientRect();return{text:el.textContent,left:b.left,right:b.right,width:b.width};}),table:(()=>{const el=document.querySelector('.bases-embed');return{client:el.clientWidth,scroll:el.scrollWidth,overflow:getComputedStyle(el).overflowX};})(),titleColor:getComputedStyle(document.querySelector('.callout-title-inner')).color,titleFont:getComputedStyle(document.querySelector('.callout-title-inner')).fontFamily}));
            assert.ok(measurements.document<=width,`${source.name}/${width}: page overflow ${measurements.document}`);
            for(const b of [...measurements.panels,...measurements.actions])assert.ok(b.left>=0&&b.right<=width+1,`${source.name}/${width}: ${JSON.stringify(b)}`);
            assert.equal(measurements.titleColor,'rgb(184, 151, 96)');
            assert.equal(measurements.table.overflow,'auto');
            const file=path.join(__dirname,`${source.name==='Сезоны'?'seasons':'viewings'}-${width}.png`);await page.screenshot({path:file,fullPage:true});
            await page.locator('[data-callout="kino-history-views"] .callout-title').click();
            assert.equal(await page.locator('[data-callout="kino-history-views"] .callout-content').isVisible(),true);
            assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
            await page.screenshot({path:file.replace('.png','-views.png'),fullPage:true});
            await page.locator('[data-callout="kino-history"] .callout-title').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('[data-callout="kino-history"] .callout-content').isVisible(),false);
            results.push({name:source.name,width,...measurements,screenshot:file});await page.close();
        }
        fs.writeFileSync(path.join(__dirname,'visual-verification.json'),JSON.stringify({environment:'Playwright Chrome, real Markdown parsed into native callout fixture; fixture Bases table; active snippets and Things theme; no live Obsidian runtime exercised',results},null,2));console.log(JSON.stringify(results,null,2));
    } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
