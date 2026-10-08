const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Mindwork/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { fromText } = require('./yaml_fixture.cjs');
const core = require('../book_core.js')({ app: {}, obsidian: {} }), knowledge = require('../knowledge.js');
const root = path.resolve(__dirname, '../..'), records = [];
function scan(folder) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) scan(full);
    else if (entry.name.endsWith('.md')) {
      const text = fs.readFileSync(full, 'utf8'), fm = fromText(text);
      if (!fm.title || !fm.authors) continue;
      records.push({ fm, file: { path: 'Книги/' + path.relative(root, full).replaceAll('\\', '/'), basename: entry.name.slice(0, -3) }, history: core.parseHistory(text).entries, excerpts: knowledge.parseExcerpts(text) });
    }
  }
}
scan(path.join(root, 'Художественные')); scan(path.join(root, 'Non-fiction'));
const source = fs.readFileSync(path.join(root, '_system/reading_dashboard.js'), 'utf8');
const css = fs.readFileSync(path.join(root, '_system/reading-dashboard.css'), 'utf8');
const note = fs.readFileSync(path.join(root, '_system/Итоги чтения.md'), 'utf8');
const thingsCss = fs.readFileSync(path.resolve(root, '../.obsidian/themes/Things/theme.css'), 'utf8');
const gruvboxCss = fs.readFileSync(path.resolve(root, '../.obsidian/snippets/Obsidian gruvbox.css'), 'utf8');
const dataviewCss = fs.readFileSync(path.resolve(root, '../.obsidian/plugins/dataview/styles.css'), 'utf8');
const baseline = `*{box-sizing:border-box}body{margin:0;font:16px/1.5 "JetBrains Mono",monospace;background:var(--background-primary);color:var(--text-normal);--editor-font:"JetBrains Mono",monospace;--background-primary:#faf9f6;--background-secondary:#efede7;--background-modifier-border:#d8d3c9;--text-muted:#716b62;--text-normal:#302e2a;--text-error:#a83232}main{width:100%;max-width:1100px;height:100vh;overflow-y:auto;margin:auto;padding:24px;min-width:0}.markdown-preview-sizer{width:100%;max-width:820px;margin-inline:auto;min-width:0}button,select{font:inherit;cursor:pointer}.theme-dark{--background-primary:#16181c;--background-secondary:#202328;--background-modifier-border:#3c3f44;--text-muted:#b4b8c2;--text-normal:#ececec;--text-error:#ff8585}body.theme-light,body.theme-dark{--text-accent:#efa76b;--interactive-accent:#efa76b}.markdown-preview-pusher{height:32px;min-height:32px}`;

async function mount(browser, { width = 1024, pane, mode = 'index', theme = 'theme-light', delayStyleRead = false } = {}) {
  const page = await browser.newPage({ viewport: { width, height: 1000 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const paneStyle = pane ? ` style="width:${pane}px;margin-inline:0"` : '';
  const pageClass = mode === 'index' ? 'books-reading-page' : 'books-home-page';
  await page.setContent(`<style>${baseline}</style><style>${thingsCss}</style><style>${gruvboxCss}</style><style>${dataviewCss}</style><style>body.theme-light,body.theme-dark{--text-accent:#efa76b;--interactive-accent:#efa76b}</style><body class="${theme}"><main class="markdown-preview-view markdown-rendered ${pageClass}"${paneStyle}><div class="markdown-preview-sizer markdown-preview-section"><div class="metadata-container">Свойства</div><div class="frontmatter-container">cssclasses: books-reading-page</div><div class="inline-title">Итоги чтения</div><div class="el-pre"><div id="content" class="block-language-dataviewjs block-language-dataview"></div></div><div class="el-h1" id="native-title"><h1>Итоги чтения</h1></div><div class="el-p" id="native-nav"><a class="internal-link" href="Книги/_index">← Библиотека</a> · Цитаты · Стихи</div><div class="el-p" id="native-help"><p>Выбери год и месяц в обзоре.</p></div><div class="markdown-preview-pusher"></div></div></main></body>`);
  await page.evaluate(async ({ records, source, css, mode, note, delayStyleRead }) => {
    const module = { exports: {} }; new Function('module', source)(module);
    class Component {
      constructor() { this.cleanups = []; this.unloaded = false; }
      register(callback) { if (this.unloaded) callback(); else this.cleanups.push(callback); }
      unload() { if (this.unloaded) return; this.unloaded = true; for (const callback of this.cleanups.splice(0)) callback(); }
    }
    const subscribers = new Set(), opened = [], component = new Component();
    const service = { snapshotCalls: 0, snapshot: async () => { service.snapshotCalls++; return records; }, subscribe(callback) { subscribers.add(callback); return () => subscribers.delete(callback); }, emit() { for (const callback of [...subscribers]) callback(); }, core: { displayDate: value => value.split('-').reverse().join('.') } };
    globalThis.dashboardService = service;
    const app = { vault: { getAbstractFileByPath: filePath => ({ path: filePath, text: note }), read: async file => { if (delayStyleRead && file.path.endsWith('.css')) await new Promise(resolve => { fixture.resolveStyleRead = resolve; }); return file.path.endsWith('.css') ? css : 'module.exports.getService=async()=>globalThis.dashboardService;'; } }, workspace: { openLinkText: (...args) => opened.push(args) } };
    const sourcePath = mode === 'index' ? 'Книги/_system/Итоги чтения.md' : 'Книги/_index.md';
    const dv = { container: document.querySelector('#content'), component, current: () => ({ file: { path: sourcePath } }) };
    globalThis.fixture = { app, component, service, subscribers, opened };
    component.render = async () => { dv.container.innerHTML = ''; fixture.renderCalls = (fixture.renderCalls || 0) + 1; fixture.handle = await module.exports({ dv, app, obsidian: {}, mode }); return fixture.handle; };
    fixture.originalRender = component.render;
    fixture.renderPromise = component.render();
    if (!delayStyleRead) await fixture.renderPromise;
  }, { records, source, css, mode, note, delayStyleRead });
  return { page, errors };
}
async function assertBounded(page, description) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${description}: no horizontal page overflow`);
  const overflowing = await page.evaluate(() => ['main', '.markdown-preview-sizer', '#content', '.book-reading-dashboard', '.book-dashboard-masthead', '.book-dashboard-controls', '.book-dashboard-summary', '.book-dashboard-content', '.book-dashboard-section', '.book-dashboard-breakdown-groups'].flatMap(selector => [...document.querySelectorAll(selector)].filter(node => node.getClientRects().length && node.scrollWidth > node.clientWidth + 1).map(node => ({ selector, clientWidth: node.clientWidth, scrollWidth: node.scrollWidth }))));
  assert.deepEqual(overflowing, [], `${description}: root, controls and panels fit their Obsidian pane`);
}
async function indexAppearance(page) {
  assert.equal(await page.locator('.book-dashboard-title').textContent(), 'Итоги чтения');
  assert.equal(await page.locator('.book-dashboard-masthead > .book-dashboard-summary').count(), 1, 'Period metrics belong to the masthead');
  for (const selector of ['.metadata-container', '.frontmatter-container', '.inline-title']) assert.equal(await page.locator(selector).isVisible(), false, `${selector} stays hidden`);
  const fallback = await page.locator('#native-title, #native-nav, #native-help').evaluateAll(nodes => nodes.map(node => ({ display: getComputedStyle(node).display, visibility: getComputedStyle(node).visibility, height: node.offsetHeight })));
  assert.equal(fallback.length, 3);
  for (const node of fallback) { assert.notEqual(node.display, 'none', 'Fallback wrappers stay measurable by Obsidian'); assert.equal(node.visibility, 'hidden'); assert.equal(node.height, 0); }
  const offsets = await page.evaluate(() => { const block = document.querySelector('.el-pre'); return { next: block.nextElementSibling.offsetTop, top: block.offsetTop, height: block.offsetHeight }; });
  assert(offsets.next - offsets.top >= offsets.height - 1, 'The next fallback offset includes the complete dynamic section height');
  assert.equal(await page.locator('.markdown-preview-pusher').evaluate(node => node.offsetHeight), 32, 'The native preview pusher remains in the flow');
  const numbers = await page.locator('.book-dashboard-summary .book-dashboard-metric strong').evaluateAll(nodes => {
    const probe = document.createElement('span'); probe.style.color = 'color-mix(in srgb,var(--text-normal) 45%,var(--text-accent) 55%)'; nodes[0].parentNode.append(probe); const expected = getComputedStyle(probe).color; probe.remove();
    return nodes.map(node => { const style = getComputedStyle(node); return { family: style.fontFamily, weight: style.fontWeight, variant: style.fontVariantNumeric, color: style.color, expected }; });
  });
  assert.equal(numbers.length, 5);
  for (const number of numbers) { assert.match(number.family, /JetBrains Mono|Cascadia|Consolas|monospace/i); assert.equal(number.weight, '700'); assert.match(number.variant, /tabular-nums/); assert.match(number.variant, /lining-nums/); assert.equal(number.color, number.expected, 'Numbers share the main page accent blend'); }
  const links = await page.locator('.book-dashboard-nav a').evaluateAll(nodes => nodes.map(node => [node.textContent, node.getAttribute('data-href')]));
  assert.deepEqual(links, [['← Библиотека', 'Книги/_index'], ['Цитаты', 'Книги/Цитаты'], ['Стихи', 'Книги/Стихи']]);
  for (const [name] of links) await page.locator('.book-dashboard-nav').getByRole('link', { name, exact: true }).click();
  assert.deepEqual(await page.evaluate(() => fixture.opened.map(args => args[0])), links.map(([, target]) => target), 'Navigation uses internal vault links');
}
async function periodChecks(page) {
  const year = page.getByLabel('Год чтения', { exact: true }), month = page.getByLabel('Месяц чтения', { exact: true });
  assert.equal(await year.inputValue(), ''); assert.equal(await month.isDisabled(), true);
  await year.selectOption('2024'); await month.selectOption('04');
  assert.equal(await page.locator('.book-dashboard-month.is-selected').count(), 1);
  await page.getByRole('button', { name: 'Сбросить месяц: апрель', exact: true }).click();
  assert.equal(await month.inputValue(), ''); assert.equal(await year.inputValue(), '2024');
  await month.selectOption('10'); await page.getByRole('button', { name: 'Сбросить месяц', exact: true }).click();
  assert.equal(await month.inputValue(), ''); assert.equal(await page.locator('.book-dashboard-month.is-selected').count(), 0);
  await page.getByRole('button', { name: 'Этот месяц', exact: true }).click();
  const now = await page.evaluate(() => ({ year: String(new Date().getFullYear()), month: String(new Date().getMonth() + 1).padStart(2, '0') }));
  assert.equal(await year.inputValue(), now.year); assert.equal(await month.inputValue(), now.month);
  await page.locator('.book-dashboard-month.is-selected').click(); assert.equal(await month.inputValue(), '', 'Clicking the selected month resets it');
  await page.getByRole('button', { name: 'За всё время', exact: true }).click();
  assert.equal(await year.inputValue(), ''); assert.equal(await month.inputValue(), ''); assert.equal(await month.isDisabled(), true);
}
async function dispose(page) {
  await page.evaluate(() => { fixture.handle?.dispose?.(); fixture.component.unload(); });
  const state = await page.evaluate(() => ({ subscribers: fixture.subscribers.size, restored: fixture.component.render === fixture.originalRender }));
  assert.equal(state.subscribers, 0, 'Unload releases the reading service subscription'); assert.equal(state.restored, true, 'Unload restores the native Dataview renderer');
}
async function refreshChecks(browser) {
  const { page, errors } = await mount(browser, { width: 390 });
  try {
    await page.getByLabel('Год чтения', { exact: true }).selectOption('2024'); await page.getByLabel('Месяц чтения', { exact: true }).selectOption('04');
    const before = await page.evaluate(() => { fixture.savedRoot = document.querySelector('.book-reading-dashboard'); fixture.savedContent = document.querySelector('.book-dashboard-content').firstElementChild; const scroll = document.querySelector('main'); scroll.scrollTop = scroll.scrollHeight; return { scroll: scroll.scrollTop, renderCalls: fixture.renderCalls, snapshots: fixture.service.snapshotCalls }; });
    assert(before.scroll > 400, 'The selected period creates a genuinely scrolled page');
    await page.evaluate(async () => { for (let attempt = 0; attempt < 3; attempt++) await fixture.component.render(); fixture.service.emit(); });
    await page.waitForFunction(count => fixture.service.snapshotCalls > count, before.snapshots); await page.waitForTimeout(50);
    const after = await page.evaluate(() => ({ rootSame: fixture.savedRoot === document.querySelector('.book-reading-dashboard'), contentSame: fixture.savedContent === document.querySelector('.book-dashboard-content').firstElementChild, scroll: document.querySelector('main').scrollTop, renderCalls: fixture.renderCalls }));
    assert.equal(after.rootSame, true, 'Global refresh keeps the root DOM'); assert.equal(after.contentSame, true, 'An unchanged service snapshot keeps existing content DOM'); assert.equal(after.renderCalls, before.renderCalls, 'Global refresh does not invoke the destructive Dataview renderer'); assert.equal(after.scroll, before.scroll, 'Refresh at the bottom preserves the Obsidian pane scroll');
    assert.equal(await page.getByLabel('Год чтения', { exact: true }).inputValue(), '2024'); assert.equal(await page.getByLabel('Месяц чтения', { exact: true }).inputValue(), '04');
    assert.deepEqual(errors, []); await dispose(page);
  } finally { await page.close(); }
  const delayed = await mount(browser, { delayStyleRead: true });
  try {
    await delayed.page.evaluate(async () => { fixture.component.unload(); fixture.resolveStyleRead(); await fixture.renderPromise; });
    assert.equal(await delayed.page.evaluate(() => fixture.subscribers.size), 0, 'Closing during the initial CSS read creates no late subscription'); assert.equal(await delayed.page.locator('.book-reading-dashboard').count(), 0, 'Closing during initial load leaves no late page root'); assert.deepEqual(delayed.errors, []);
  } finally { await delayed.page.close(); }
}
async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  let checks = 0; const layouts = [{ width: 320 }, { width: 390 }, { width: 1024 }, { width: 1280, pane: 390 }], narrowColumns = new Map();
  try {
    for (const layout of layouts) for (const mode of ['home', 'index']) for (const theme of ['theme-light', 'theme-dark']) {
      const { page, errors } = await mount(browser, { ...layout, mode, theme });
      try {
        if (mode === 'index') {
          await indexAppearance(page); await periodChecks(page); await page.getByLabel('Год чтения', { exact: true }).selectOption('2024');
          const columns = await page.locator('.book-dashboard-months').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length);
          if (layout.width === 390) narrowColumns.set(theme, columns);
          if (layout.pane) assert.equal(columns, narrowColumns.get(theme), 'Container queries adapt a narrow pane even in a wide viewport');
          await page.getByRole('button', { name: 'За всё время', exact: true }).click();
        } else assert.equal(await page.locator('select').count(), 0, 'Period controls belong to the full reading page');
        await assertBounded(page, `${mode}, ${theme}, viewport ${layout.width}${layout.pane ? `, pane ${layout.pane}` : ''}`); assert.deepEqual(errors, []);
        if (mode === 'index' && !layout.pane && ((layout.width === 390 && theme === 'theme-light') || (layout.width === 1024 && theme === 'theme-dark')) && process.env.DASHBOARD_SCREENSHOT_DIR) {
          fs.mkdirSync(process.env.DASHBOARD_SCREENSHOT_DIR, { recursive: true }); await page.locator('main').evaluate(node => { node.style.height = 'auto'; node.style.overflow = 'visible'; }); await page.screenshot({ path: path.join(process.env.DASHBOARD_SCREENSHOT_DIR, `reading-index-${layout.width}-${theme}.png`), fullPage: true });
        }
        await dispose(page); checks++;
      } finally { await page.close(); }
    }
    await refreshChecks(browser);
  } finally { await browser.close(); }
  console.log(`${checks} Chromium scenarios passed with ${records.length} real cards: reading page masthead, period controls, pane container queries, numeric style, hidden properties, measurable fallback and refresh/unload scroll regression.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
