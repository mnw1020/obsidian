/* Actual presentation module in Chromium, with minimal read-only Obsidian adapters.
 * The Markdown adapter covers paragraph/emphasis/link rendering needed by fixtures;
 * these previews are browser harnesses, not screenshots of an Obsidian window. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const system = path.resolve(__dirname, '..');
const vault = path.resolve(system, '..', '..');
const sources = {
    renderer: fs.readFileSync(path.join(system, 'kino_ui.js'), 'utf8'),
    design: fs.readFileSync(path.join(system, 'kino-design.css'), 'utf8'),
    gruvbox: fs.readFileSync(path.join(vault, '.obsidian/snippets/Obsidian gruvbox.css'), 'utf8'),
    dynamic: fs.readFileSync(path.join(vault, '.obsidian/plugins/dynamic-views/styles.css'), 'utf8')
};
const homePage = fs.readFileSync(path.join(system, '../_index.md'), 'utf8');
sources.home = homePage.match(/```dataviewjs\r?\n([\s\S]*?)\r?\n```/)[1];
sources.homeSections = [...homePage.matchAll(/^## ([^\r\n]+)\r?\n\r?\n([^\r\n]+)\r?\n\r?\n```dataviewjs\r?\n([\s\S]*?)\r?\n```/gm)]
    .map(match => ({heading:match[1],description:match[2],script:match[3]}));
sources.lazy = fs.readFileSync(path.join(system, 'lazy_base.js'), 'utf8');
const previewDir = path.join(system, 'redesign-backups/previews');
const originalLoki = fs.readFileSync(path.join(system, '../Media/Локи.md'), 'utf8');
const lokiNotes = originalLoki.slice(originalLoki.indexOf('<!-- SEASONS:START -->') + 22, originalLoki.indexOf('<!-- SEASONS:END -->')).trim();
const media = {
    name: 'Локи',
    path: 'Кино/Media/Локи.md',
    frontmatter: {
        'Название': 'Loki', tags: ['serial'], 'Релиз': '2021-06-09', 'Время': 'N/A', 'Просмотрено': '2025-01-01',
        'Оценка': 9, 'Оценка Imdb': '8,2', 'Оценка Кинопоиск': 7.8, 'Прогноз оценки': '7.4',
        'Количество сезонов': 2, 'Количество просмотров': 1,
        'Описание': 'Бог хитрости Локи оказывается за пределами привычного времени. Чтобы понять, кем он хочет стать, ему придётся встретиться с самим собой.',
        'Жанр': ['Action', 'Adventure', 'Fantasy'], 'Режисер': ['Aaron Moorhead', 'Kate Herron'],
        'Франшиза': '[[Кино/Франшизы/Киновселенная Marvel|Киновселенная Marvel]]',
        'Роли файл': '[[Кино/_system/Роли/Локи.роли.md]]', 'imdb Id': 'tt9140554', 'Кинопоиск ID': '1203039',
        poster: 'https://example.test/only-at-bottom.jpg', 'Личное поле': 'Значение сохранено',
        'Ссылка с якорем': '[[Кино/Media/Локи#^личная-заметка|Важная мысль]]'
    },
    notes: lokiNotes,
    poster: true,
    table: true
};
const baseStyles = `
    :root { --font-text: monospace; --font-interface: monospace; --font-monospace: monospace; --text-normal: #222; --text-muted:#666; --background-primary:#fff; --background-secondary:#eee; --background-modifier-border:#ccc; --size-2-3:6px; --size-4-2:8px; --radius-s:4px; --radius-m:8px; --font-ui-medium:14px; }
    * { box-sizing:border-box; } body { margin:0; background: #e5e5e5; font:16px Arial,sans-serif; }
    .markdown-preview-view { background:var(--background-primary); color:var(--text-normal); min-height:100vh; padding:32px 0; }
    .markdown-preview-sizer { padding:0 32px; margin:0 auto; width:100%; }
    .inline-title { font-size:40px; } .metadata-container { padding:10px; background:#eee; }
    .markdown-rendered { font-family:var(--font-text); } .markdown-preview-section img { max-width:100%; }
    .markdown-preview-section a { color: #5656aa; } .markdown-preview-section p { margin: 0 0 1em; }
    button { font:inherit; padding:8px 12px; cursor:pointer; } a { cursor:pointer; } summary { cursor:pointer; }
    .workspace-leaf-content { min-height:100vh; padding:24px; background:var(--background-primary); }
    .bases-view { font:16px var(--font-interface); } .bases-header { padding:18px 0; font-weight:600; }
    .dynamic-views-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr)); gap:16px; }
    .dynamic-views .card { display:flex; flex-direction:column; position:relative; }
    .dynamic-views .card-cover-wrapper { width:100%; height:230px; overflow:hidden; }
    .dynamic-views .card-cover-wrapper img { width:100%; height:100%; object-fit:cover; }
    .bases-table { display:grid; } .bases-tr { display:grid; grid-template-columns:minmax(160px,2fr) 1fr 1fr; }
    .bases-td, .bases-th { padding:12px; border-bottom:1px solid #ccc; }
`;

async function mount(page, fixture = media, kind = 'media', options = {}) {
    await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
    await page.evaluate(async ({ sources, baseStyles, fixture, kind, options }) => {
        for (const css of [baseStyles, sources.gruvbox, sources.dynamic, sources.design]) {
            const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
        }
        document.body.className = options.light ? 'theme-light' : 'theme-dark';
        const view = document.createElement('div'); view.className = `${options.source ? 'markdown-source-view' : 'markdown-preview-view'} markdown-rendered`;
        const sizer = document.createElement('div'); sizer.className = 'markdown-preview-sizer'; view.append(sizer);
        const inline = document.createElement('div'); inline.className = 'inline-title'; inline.textContent = fixture.name; sizer.append(inline);
        const properties = document.createElement('div'); properties.className = 'metadata-container'; properties.textContent = 'Native editable properties'; sizer.append(properties);
        const section = document.createElement('div'); section.className = 'markdown-preview-section'; sizer.append(section);
        const container = document.createElement('div'); container.className = 'block-language-dataviewjs'; section.append(container); document.body.append(view);
        const escaped = text => String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        const paragraph = text => escaped(text).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/_([^_]+)_/g,'<em>$1</em>');
        const renderMarkdown = (text, holder) => {
            if (/^!\[\[/.test(text)) {
                holder.innerHTML = '<div class="markdown-embed"><div class="markdown-embed-title">Роли</div><div class="markdown-embed-content"><h3>В главных ролях</h3><p>Tom Hiddleston · Sophia Di Martino · Owen Wilson</p><table><tbody><tr><td>Tom Hiddleston</td><td>Loki</td></tr><tr><td>Sophia Di Martino</td><td>Sylvie</td></tr></tbody></table></div></div>';
                return;
            }
            holder.innerHTML = String(text).split(/\r?\n\r?\n/).map(block => {
                const heading = block.match(/^(#{1,6}) (.*)$/s);
                if (heading) return `<h${heading[1].length}>${paragraph(heading[2])}</h${heading[1].length}>`;
                if (block.startsWith('>')) return `<blockquote><p>${paragraph(block.replace(/^>/gm,''))}</p></blockquote>`;
                return `<p>${paragraph(block).replace(/\r?\n/g,'<br>')}</p>`;
            }).join('');
        };
        const stats = { children:0, added:0, removed:0, links:[], renders:[], writes:0, waits:[], cleanups:[] };
        class Component {}
        const component = {
            register: callback => stats.cleanups.push(callback),
            addChild: child => { stats.added++; stats.children++; return child; },
            removeChild: child => { if (child.released) throw Error('Child removed twice'); child.released=true; stats.removed++; stats.children--; }
        };
        const current = { ...fixture.frontmatter, file:{path:fixture.path, name:fixture.name} };
        const file = {path:fixture.path, basename:fixture.name};
        const app = {
            vault:{ getName:()=> 'Кино & личное', getAbstractFileByPath:p=>p===fixture.path ? options.missingFile ? null : file : p.includes('Локи.роли') && !options.missingRoles ? {path:'Кино/_system/Роли/Локи.роли.md'} : null,
                modify:()=>{ stats.writes++; throw Error('Unexpected note write'); }, create:()=>{ stats.writes++; throw Error('Unexpected note write'); } },
            metadataCache:{ getFileCache:f=>{ if (!f) throw Error('Null file passed to metadata'); return {frontmatter:fixture.frontmatter}; }, getFirstLinkpathDest:p=>p.includes('Локи.роли') && !options.missingRoles ? {path:'Кино/_system/Роли/Локи.роли.md'} : null },
            workspace:{openLinkText:(...args)=>stats.links.push(args)}
        };
        const obsidian = options.noRenderer ? {} : {
            Component,
            MarkdownRenderer:{ render:async(app, text, holder, source, child)=>{
                stats.renders.push({text,source});
                if (options.deferRoles && /^!\[\[/.test(text)) await new Promise(resolve=>stats.waits.push(resolve));
                if (options.failRoles && /^!\[\[/.test(text)) throw Error('Renderer unavailable');
                renderMarkdown(text, holder);
            }}
        };
        const m={exports:{}};new Function('module',sources.renderer)(m);
        window.kinoTest = {stats,view,section,app,component,source:current,renderer:m.exports,renderMarkdown,dispose:()=>stats.cleanups.forEach(f=>f())};
        await m.exports({dv:{container,current:()=>current,component},app,obsidian,kind});
        if (fixture.notes) {
            const notes = document.createElement('div'); notes.className = 'personal-notes'; renderMarkdown(fixture.notes,notes); section.append(notes);
        }
        if (fixture.table) {
            const history=document.createElement('div'); history.className='history';
            history.innerHTML='<h2>История просмотров</h2><table class="table-view-table"><thead><tr><th>Просмотр</th><th>Дата</th><th>Оценка</th><th>Комментарий</th></tr></thead><tbody><tr><td><span class="internal-link" data-href="Кино/Просмотры/Локи">Просмотр 1</span></td><td>01.01.2025</td><td>9 / 10</td><td>Повторный просмотр: собственные мысли и впечатления.</td></tr></tbody></table>'; section.append(history);
        }
        if (fixture.poster) {
            const action=document.createElement('div');action.className='kino-recommend-action';const button=document.createElement('button');button.textContent='Найти похожие';action.append(button);section.append(action);
            const poster=document.createElement('div');poster.className='poster-final';
            const img=document.createElement('img');img.alt='Постер в самом низу';
            const svg='<svg xmlns="http://www.w3.org/2000/svg" width="350" height="525"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#232d35"/><stop offset="1" stop-color="#685544"/></linearGradient></defs><rect width="350" height="525" fill="url(#g)"/><circle cx="180" cy="220" r="125" fill="none" stroke="#d1ad75" stroke-width="2"/><circle cx="180" cy="220" r="110" fill="none" stroke="#d1ad75" stroke-width="1"/><text x="175" y="412" text-anchor="middle" fill="#efdfba" font-size="50" font-family="Georgia">LOKI</text><text x="175" y="454" text-anchor="middle" fill="#d1ad75" font-size="12" font-family="Arial" letter-spacing="4">OUTSIDE OF TIME</text></svg>';
            img.src='data:image/svg+xml;base64,'+btoa(svg);poster.append(img);section.append(poster);
        }
        window.kinoTest.notesBefore = document.querySelector('.personal-notes')?.innerHTML;
    }, {sources, baseStyles, fixture, kind, options});
    await page.waitForFunction(() => [...document.querySelectorAll('.history table')].every(t=>t.closest('.kino-table-wrap')));
}

test('responsive cinema presentation preserves visible notes, footer poster and scoped typography', async () => {
    fs.mkdirSync(previewDir, {recursive:true});
    const browser = await chromium.launch({channel:process.env.AI_TEST_BROWSER||'chrome',headless:true});
    const errors=[];
    try {
        const page = await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
        for (const width of [390,768,1440]) {
            await page.setViewportSize({width,height:1000}); await mount(page,media,'media',{light:width===768});
            const state = await page.evaluate(() => {
                const view=document.querySelector('.markdown-preview-view'), title=document.querySelector('.kino-card-title'), notes=document.querySelector('.personal-notes'), poster=document.querySelector('.poster-final');
                return {
                    background:getComputedStyle(view).backgroundColor, font:getComputedStyle(view).fontFamily, titleFont:getComputedStyle(title).fontFamily,
                    titleWeight:getComputedStyle(title).fontWeight, titleSize:getComputedStyle(title).fontSize,
                    scoreValues:[...document.querySelectorAll('.kino-score-value')].map(x=>x.textContent),
                    rootImages:document.querySelectorAll('.kino-ui-root img').length, last:poster===poster.parentElement.lastElementChild,
                    notesHidden:Boolean(notes.closest('details')), noteHeight:notes.getBoundingClientRect().height, notesUnchanged:notes.innerHTML===window.kinoTest.notesBefore,
                    posterBelow:poster.getBoundingClientRect().top>notes.getBoundingClientRect().bottom,
                    overflow:document.documentElement.scrollWidth>innerWidth, metadata:getComputedStyle(document.querySelector('.metadata-container')).display,
                    inlineTitle:getComputedStyle(document.querySelector('.inline-title')).display,
                    historyWrapped:Boolean(document.querySelector('.history table').closest('.kino-table-wrap')), writes:window.kinoTest.stats.writes,
                    forecastTooltip:document.querySelector('.kino-score-forecast').title
                };
            });
            assert.equal(state.background,'rgb(22, 24, 28)'); assert.match(state.font,/Segoe UI/);assert.match(state.titleFont,/Segoe UI/);assert.equal(state.titleWeight,'650');
            assert.equal(state.titleSize,width===390?'30px':width===768?'32.256px':'46px');
            assert.deepEqual(state.scoreValues,['9 / 10','8.2 / 10','7.8 / 10','7.4 / 10']);
            assert.equal(state.rootImages,0);assert.equal(state.last,true);assert.equal(state.notesHidden,false);assert.equal(state.notesUnchanged,true);assert.equal(state.posterBelow,true);
            assert.ok(state.noteHeight>400);assert.equal(state.overflow,false);assert.equal(state.historyWrapped,true);assert.equal(state.metadata,'none');assert.equal(state.inlineTitle,'none');assert.equal(state.writes,0);assert.match(state.forecastTooltip,/Прогноз/);
            await page.screenshot({path:path.join(previewDir,`media-${width}.png`),fullPage:true});
        }
        assert.deepEqual(errors,[]);
    } finally { await browser.close(); }
});

test('properties and roles render lazily, navigate anchors safely, and release components on collapse and disposal', async () => {
    const browser=await chromium.launch({channel:process.env.AI_TEST_BROWSER||'chrome',headless:true});
    try {
        const page=await browser.newPage({viewport:{width:390,height:950}});await mount(page,media);
        assert.equal(await page.locator('.kino-property-list').count(),0);assert.equal(await page.locator('.kino-role-embed').count(),0);
        await page.getByText('Все свойства',{exact:true}).click();await page.locator('.kino-property-list').waitFor();
        assert.equal(await page.locator('.kino-property-list dt').filter({hasText:'Личное поле'}).count(),1);
        const anchor=page.getByText('Важная мысль',{exact:true});assert.match(await anchor.getAttribute('href'),/^obsidian:\/\/open\?/);
        await anchor.click({modifiers:['Control']});
        assert.deepEqual(await page.evaluate(()=>window.kinoTest.stats.links[0]),['Кино/Media/Локи#^личная-заметка','Кино/Media/Локи.md',true]);
        await page.getByText('Роли и создатели',{exact:true}).click();await page.locator('.kino-role-embed').waitFor();
        assert.equal(await page.evaluate(()=>window.kinoTest.stats.children),2);
        assert.equal(await page.locator('.kino-role-embed .kino-table-wrap').count(),1);
        await page.getByText('Роли и создатели',{exact:true}).click();await page.locator('.kino-role-embed').waitFor({state:'detached'});
        assert.equal(await page.evaluate(()=>window.kinoTest.stats.children),1);
        await page.getByText('Роли и создатели',{exact:true}).click();await page.locator('.kino-role-embed').waitFor();
        await page.evaluate(()=>window.kinoTest.dispose());
        assert.deepEqual(await page.evaluate(()=>({children:window.kinoTest.stats.children,writes:window.kinoTest.stats.writes,classes:window.kinoTest.view.className,notes:document.querySelector('.personal-notes').innerHTML===window.kinoTest.notesBefore})),
            {children:0,writes:0,classes:'markdown-preview-view markdown-rendered',notes:true});
    } finally {await browser.close();}
});

test('missing data, absent files, unavailable Markdown renderer and roles failure remain usable',async()=>{
    const browser=await chromium.launch({channel:process.env.AI_TEST_BROWSER||'chrome',headless:true});
    try {
        const page=await browser.newPage({viewport:{width:390,height:950}});
        await mount(page,{name:'Новый фильм',path:'Кино/Media/Новый фильм.md',frontmatter:{'Релиз':'N/A','Оценка':'N/A','Оценка Imdb':'not-a-score','Описание':'<script>alert(1)</script>','Жанр':null}},'media',{missingFile:true,noRenderer:true});
        assert.deepEqual(await page.locator('.kino-score-value').allTextContents(),['—','—','—','—']);assert.equal(await page.locator('script').count(),0);
        assert.equal(await page.locator('.kino-card-meta').textContent(),'');assert.equal(await page.locator('.kino-markdown-fallback').textContent(),'<script>alert(1)</script>');
        await mount(page,media,'media',{missingRoles:true});await page.getByText('Роли и создатели',{exact:true}).click();await page.getByText('Файл ролей не найден. Проверь ссылку в свойствах.').waitFor();
        assert.equal(await page.locator('.kino-roles-content a').count(),1);
        await mount(page,media,'media',{failRoles:true});await page.getByText('Роли и создатели',{exact:true}).click();await page.getByText('Не удалось загрузить роли. Открой файл по ссылке выше.').waitFor();assert.equal(await page.evaluate(()=>window.kinoTest.stats.children),1);
        await mount(page,media,'media',{deferRoles:true});await page.getByText('Роли и создатели',{exact:true}).click();await page.waitForFunction(()=>window.kinoTest.stats.waits.length===1);
        await page.getByText('Роли и создатели',{exact:true}).click();await page.evaluate(()=>window.kinoTest.stats.waits[0]());await page.waitForFunction(()=>!document.querySelector('.kino-role-embed'));assert.equal(await page.evaluate(()=>window.kinoTest.stats.children),1);
    } finally {await browser.close();}
});

test('viewing and season comments retain Markdown; utility kinds keep existing titles and source properties editable',async()=>{
    const browser=await chromium.launch({channel:process.env.AI_TEST_BROWSER||'chrome',headless:true});
    try {
        const page=await browser.newPage({viewport:{width:390,height:950}});
        for(const kind of ['viewing','season']) {
            await mount(page,{name:'Локи — '+kind,path:'Кино/'+kind+'/Локи.md',frontmatter:{'Комментарий':'**Сильная история**\n\n_Второй взгляд_ — личные мысли полностью видны.','Оценка':9,'Сериал':'[[Кино/Media/Локи]]','Дата':'2025-01-01','Сезон':2}},kind);
            assert.equal(await page.locator('.kino-comment strong').textContent(),'Сильная история');assert.equal(await page.locator('.kino-comment em').textContent(),'Второй взгляд');assert.equal(await page.locator('.kino-comment details').count(),0);
            assert.equal(await page.locator('.kino-card-title').count(),1);assert.equal(await page.locator('.kino-card-meta').textContent(),'Локи01.01.2025'+(kind==='season'?'Сезон 2':''));
            await page.screenshot({path:path.join(previewDir,`${kind}-390.png`),fullPage:true});
        }
        for(const kind of ['entity','system','dashboard']) {
            await mount(page,{name:'Служебная страница',path:'Кино/_system/страница.md',frontmatter:{}},kind);
            assert.equal(await page.locator('.kino-card-title').count(),0);assert.equal(await page.locator('.kino-properties').count(),0);
            if(kind!=='dashboard')assert.notEqual(await page.locator('.inline-title').evaluate(el=>getComputedStyle(el).display),'none');
            assert.equal(await page.locator('.metadata-container').evaluate(el=>getComputedStyle(el).display),'none');
        }
        await mount(page,{name:'Локи.роли',path:'Кино/_system/Роли/Локи.роли.md',frontmatter:{'Основная карточка':'[[Кино/Media/Локи.md]]','Роли актеров':['Loki - Tom Hiddleston','Sylvie - Sophia Di Martino'],'Актеры':['Tom Hiddleston','Sophia Di Martino'],'Личное поле':'Текст'}},'roles');
        assert.equal(await page.locator('.kino-card-title').textContent(),'Локи');
        assert.equal(await page.locator('.kino-card-meta').textContent(),'ЛокиРолей: 2');
        assert.equal(await page.locator('.metadata-container').evaluate(el=>getComputedStyle(el).display),'none');
        await page.getByText('Все свойства',{exact:true}).click();await page.getByText('Личное поле',{exact:true}).waitFor();
        await mount(page,media,'media',{source:true});
        assert.notEqual(await page.locator('.metadata-container').evaluate(el=>getComputedStyle(el).display),'none');
        assert.notEqual(await page.locator('.inline-title').evaluate(el=>getComputedStyle(el).display),'none');
    } finally {await browser.close();}
});

test('cold native Bases style by cinema paths, including span links, without affecting unrelated pages or collections',async()=>{
    const browser=await chromium.launch({channel:process.env.AI_TEST_BROWSER||'chrome',headless:true});
    try {
        const page=await browser.newPage();
        for(const width of [390,768,1440]) {
            await page.setViewportSize({width,height:950});await mount(page,{name:'Каталог',path:'Кино/_system/каталог.md',frontmatter:{}},'system');
            await page.evaluate(()=>{
                document.body.replaceChildren();
                const leaf=document.createElement('div');leaf.className='workspace-leaf-content';leaf.dataset.type='bases';
                leaf.innerHTML='<div class="view-content"><header class="bases-header">Каталог · Карточки</header><div class="bases-view dynamic-views"><div class="bases-cards-container"><div class="dynamic-views-grid">'+['Локи','Матрица','Трасса 60'].map((name,i)=>'<div class="card has-card-content has-properties-bottom"><div class="card-cover-wrapper"><div class="card-image" style="height:230px;background:linear-gradient(135deg,#333e40,#876c4d);display:grid;place-items:center;color:#e6ceb0;font:30px Georgia">'+name+'</div></div><div class="card-content"><div class="card-header"><div class="card-title-block"><span class="card-title internal-link" data-href="Кино/Media/'+name+'">'+name+'</span></div></div><div class="card-body has-body-content"><div class="card-properties card-properties-bottom"><div class="property"><span class="property-content">'+(i===0?'Сериал · 2021':'Фильм · 1999')+'</span></div><div class="property"><span class="property-content">Моя оценка: 9</span></div></div></div></div></div>').join('')+'</div></div></div></div>';
                [...leaf.querySelectorAll('.card')].forEach((card,i)=>card.dataset.path='Кино/Media/'+['Локи','Матрица','Трасса 60'][i]+'.md');
                document.body.append(leaf);
            });
            const grid=await page.evaluate(()=>({background:getComputedStyle(document.querySelector('.bases-view')).backgroundColor,card:getComputedStyle(document.querySelector('.card')).backgroundColor,border:getComputedStyle(document.querySelector('.card')).borderRadius,title:getComputedStyle(document.querySelector('.card-title')).color,font:getComputedStyle(document.querySelector('.card-title')).fontFamily,overflow:document.documentElement.scrollWidth>innerWidth,body:getComputedStyle(document.querySelector('.card-body')).display,property:getComputedStyle(document.querySelector('.card-properties')).color}));
            assert.equal(grid.background,'rgb(22, 24, 28)');assert.equal(grid.card,'rgb(32, 35, 41)');assert.equal(grid.border,'12px');assert.equal(grid.title,'rgb(240, 236, 227)');assert.match(grid.font,/Segoe UI/);assert.equal(grid.overflow,false);
            assert.equal(grid.body,'flex');assert.equal(grid.property,'rgb(168, 166, 159)');
            await page.screenshot({path:path.join(previewDir,`catalog-${width}.png`),fullPage:true});
            await page.evaluate(()=>{
                document.querySelector('.view-content').innerHTML='<header class="bases-header">Каталог · Таблица</header><div class="bases-view"><div class="bases-table"><div class="bases-tr"><div class="bases-th">Название</div><div class="bases-th">Релиз</div><div class="bases-th">Оценка</div></div><div class="bases-tr"><div class="bases-td" data-property="file.name"><span class="internal-link" data-href="Кино/Media/Локи.md">Локи</span></div><div class="bases-td">2021</div><div class="bases-td">9</div></div></div></div>';
            });
            assert.equal(await page.locator('.bases-td .internal-link').evaluate(el=>getComputedStyle(el).color),'rgb(228, 164, 95)');
            for(const property of ['note.Фильм','note.Сериал']) {
                await page.locator('.bases-td .internal-link').evaluate((el,property)=>el.parentElement.dataset.property=property,property);
                assert.equal(await page.locator('.bases-td .internal-link').evaluate(el=>getComputedStyle(el).color),'rgb(228, 164, 95)');
                assert.equal(await page.locator('.bases-view').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(22, 24, 28)');
                assert.equal(await page.locator('.bases-header').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(22, 24, 28)');
            }
        }
        await page.evaluate(()=>{
            document.body.replaceChildren();
            const foreign=document.createElement('div');foreign.className='markdown-preview-view';foreign.innerHTML='<div class="markdown-preview-section"><h2>Другая заметка</h2><p>Обычный текст</p><a href="#">Ссылка</a></div>';document.body.append(foreign);
            const leaf=document.createElement('div');leaf.className='workspace-leaf-content';leaf.dataset.type='bases';leaf.innerHTML='<div class="bases-view"><div class="card" data-path="Книги/Книга.md"><span class="internal-link" data-href="Книги/Книга.md">Книга</span></div><div class="bases-td" data-property="file.name"><span class="internal-link" data-href="Книги/Книга.md">Книга</span></div></div>';document.body.append(leaf);
        });
        const withDesign=await page.evaluate(()=>[...document.querySelectorAll('.markdown-preview-view,.markdown-preview-section h2,.markdown-preview-section a,.bases-view,.card,.bases-td .internal-link')].map(el=>{const s=getComputedStyle(el);return [s.color,s.backgroundColor,s.fontFamily,s.fontSize,s.fontWeight,s.borderRadius];}));
        await page.evaluate(()=>{[...document.querySelectorAll('style')].find(s=>s.textContent.startsWith('/* Кино —')).remove();});
        const withoutDesign=await page.evaluate(()=>[...document.querySelectorAll('.markdown-preview-view,.markdown-preview-section h2,.markdown-preview-section a,.bases-view,.card,.bases-td .internal-link')].map(el=>{const s=getComputedStyle(el);return [s.color,s.backgroundColor,s.fontFamily,s.fontSize,s.fontWeight,s.borderRadius];}));
        assert.deepEqual(withDesign,withoutDesign);
    } finally {await browser.close();}
});

test('shared renderer leases survive one embedded unload and preserve native classes',async()=>{
    const browser=await chromium.launch({channel:process.env.AI_TEST_BROWSER||'chrome',headless:true});
    try {
        const page=await browser.newPage();await mount(page,media);
        await page.evaluate(async()=>{
            const test=window.kinoTest,callbacks=[],container=document.createElement('div');test.section.prepend(container);
            await test.renderer({dv:{container,current:()=>test.source,component:{register:f=>callbacks.push(f)}},app:test.app,kind:'media'});
            test.dispose();
            test.secondDispose=()=>callbacks.forEach(f=>f());
        });
        assert.equal(await page.locator('.kino-ui-root').count(),1);assert.equal(await page.locator('.kino-page.kino-media.kino-has-properties.kino-has-card-title').count(),1);
        await page.evaluate(()=>window.kinoTest.secondDispose());assert.equal(await page.locator('.kino-page').count(),0);
        await page.evaluate(async()=>{
            const test=window.kinoTest,callbacks=[],container=document.createElement('div');test.section.prepend(container);test.view.classList.add('kino-page');
            await test.renderer({dv:{container,current:()=>test.source,component:{register:f=>callbacks.push(f)}},app:test.app,kind:'media'});
            callbacks.forEach(f=>f());
        });
        assert.equal(await page.locator('.kino-page').count(),1);assert.equal(await page.locator('.kino-media,.kino-has-properties,.kino-has-card-title').count(),0);
    } finally {await browser.close();}
});

test('franchise header hides only an exact duplicate original title and preserves headings and anchors',async()=>{
    const browser=await chromium.launch({channel:process.env.AI_TEST_BROWSER||'chrome',headless:true});
    try {
        const page=await browser.newPage({viewport:{width:390,height:950}});
        const fixture={name:'Средиземье',path:'Кино/Франшизы/Средиземье.md',frontmatter:{tags:['franchise'],'Порядок':'выход'},notes:'# Средиземье\n\n## Общее впечатление\n\nМир, в который хочется возвращаться.\n\n## Произведения\n\n«Властелин колец» и «Хоббит».',table:true};
        await mount(page,fixture,'franchise');await page.locator('.kino-duplicate-title').waitFor({state:'attached'});
        await page.locator('.kino-duplicate-title').evaluate(el=>el.id='original-title-anchor');
        assert.equal(await page.locator('.kino-duplicate-title').evaluate(el=>getComputedStyle(el).display),'none');
        assert.equal(await page.locator('#original-title-anchor').textContent(),'Средиземье');assert.equal(await page.locator('.kino-card-title').textContent(),'Средиземье');
        assert.equal(await page.locator('.personal-notes h2').count(),2);await page.screenshot({path:path.join(previewDir,'franchise-390.png'),fullPage:true});
        await page.setViewportSize({width:1440,height:950});await page.screenshot({path:path.join(previewDir,'franchise-1440.png'),fullPage:true});
        await page.evaluate(()=>window.kinoTest.dispose());assert.equal(await page.locator('.kino-duplicate-title').count(),0);assert.equal(await page.locator('#original-title-anchor').textContent(),'Средиземье');
        await mount(page,{...fixture,notes:'# Личные заметки\n\n# Средиземье\n\nНи один заголовок не скрывается.'},'franchise');
        assert.equal(await page.locator('.kino-duplicate-title').count(),0);
        await mount(page,fixture,'franchise',{source:true});await page.locator('.kino-duplicate-title').waitFor({state:'attached'});assert.notEqual(await page.locator('.kino-duplicate-title').evaluate(el=>getComputedStyle(el).display),'none');
    } finally {await browser.close();}
});

test('actual home header, statistics, command links and deferred Bases sections fit mobile and desktop',async()=>{
    const browser=await chromium.launch({channel:process.env.AI_TEST_BROWSER||'chrome',headless:true});
    try {
        const page=await browser.newPage(),homeSources={...sources,homeRenderer:fs.readFileSync(path.join(system,'kino_home.js'),'utf8'),homeCss:fs.readFileSync(path.join(system,'kino-home.css'),'utf8')};
        for(const width of [390,768,1440]) {
            await page.setViewportSize({width,height:1000});await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body class="theme-dark"></body></html>');
            await page.evaluate(async({sources,baseStyles})=>{
                for(const text of [baseStyles,sources.gruvbox,sources.dynamic,sources.design]){const style=document.createElement('style');style.textContent=text;document.head.append(style);}
                Element.prototype.createEl=function(tag,options={}){const el=document.createElement(tag);if(options.text!==undefined)el.textContent=options.text;if(options.cls)el.className=options.cls;for(const name of ['href','type','value'])if(options[name]!==undefined)el[name]=options[name];this.append(el);return el;};
                Element.prototype.createDiv=function(options={}){return this.createEl('div',typeof options==='string'?{cls:options}:options);};Element.prototype.empty=function(){this.replaceChildren();};
                const view=document.body.createDiv({cls:'markdown-preview-view markdown-rendered kino-page kino-dashboard movies-dashboard kino-home-page'}),sizer=view.createDiv({cls:'markdown-preview-sizer markdown-preview-section'});
                sizer.createDiv({cls:'metadata-container',text:'Native properties'});sizer.createDiv({cls:'inline-title',text:'_index'});
                const container=sizer.createDiv({cls:'el-pre'}).createDiv({cls:'block-language-dataviewjs'}),fallback=sizer.createEl('h1',{text:'Кинотека'});fallback.id='home-static-title';
                const cleanups=[],stats={writes:0,links:[]},component={register:callback=>cleanups.push(callback)};
                const fileMap={'Кино/_system/kino_home.js':{path:'Кино/_system/kino_home.js',content:sources.homeRenderer},'Кино/_system/kino-home.css':{path:'Кино/_system/kino-home.css',content:sources.homeCss}};
                const collection=Array.from({length:48},(_,i)=>({path:`Кино/Media/Фильм-${i}.md`,basename:`Фильм ${i}`,data:{tags:[i%5===0?'serial':'movies'],'Просмотрено':i<30?'2025-01-01':null,'Оценка':i<30?7+i%3:null}}));
                const app={vault:{getMarkdownFiles:()=>collection,getAbstractFileByPath:p=>fileMap[p]??collection.find(f=>f.path===p),read:async f=>f.content,modify:()=>stats.writes++},metadataCache:{getFileCache:f=>({frontmatter:f.data??{}})},workspace:{openLinkText:(...args)=>stats.links.push(args)}};
                const dv={container,current:()=>({file:{name:'_index',path:'Кино/_index.md'}}),component,paragraph:text=>container.createEl('p',{text})};
                await new Function('dv','app','require','return (async()=>{'+sources.home+'})()')(dv,app,()=>({}));
                window.kinoHomeTest={stats,dispose:()=>cleanups.splice(0).forEach(callback=>callback())};
            },{sources:homeSources,baseStyles});
            assert.equal(await page.locator('.kino-home-title').textContent(),'Кинотека');assert.deepEqual(await page.locator('.kino-home-stat strong').allTextContents(),['48','30','38','10','8,00']);
            assert.equal(await page.locator('.kino-home-actions a[data-choice]').count(),7);assert.equal(await page.locator('.kino-home-native-view').count(),3);
            assert.equal(await page.locator('.kino-home-recent .kino-home-row').count(),20);assert.equal(await page.locator('.kino-home-serials .kino-home-row').count(),5);
            assert.equal(await page.locator('.kino-home-native-content:not(:empty)').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
            assert.equal(await page.locator('.metadata-container').evaluate(el=>getComputedStyle(el).display),'none');
            await page.locator('.kino-home-views>summary').click();await page.locator('.kino-home-native-view summary').first().click();await page.locator('.kino-home-native-content a').waitFor();
            assert.equal(await page.locator('.kino-home-native-content a').getAttribute('data-href'),'Кино/_Кино.base#Последние');
            await page.locator('.kino-home-views>summary').click();await page.locator('.kino-home-native-content a').waitFor({state:'detached'});
            await page.screenshot({path:path.join(previewDir,`home-composite-${width}.png`),fullPage:true});
            await page.evaluate(()=>window.kinoHomeTest.dispose());assert.equal(await page.locator('.kino-home-ui').count(),0);assert.equal(await page.locator('#home-static-title').isVisible(),true);assert.equal(await page.evaluate(()=>window.kinoHomeTest.stats.writes),0);
        }
    } finally {await browser.close();}
});
