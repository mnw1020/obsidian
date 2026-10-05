const assert = require('node:assert/strict'), { test } = require('node:test');
const pages = require('../author_pages.js'), ui = require('../authors_ui.js');
const card = (path, fm, history = []) => ({file:{path,basename:'Карточка'},fm,history,excerpts:[]});
test('author replacement preserves properties, notes, literal replacement tokens and mixed personal newlines', () => {
    const old = '<!-- BOOK-AUTHOR-GENERATED:START -->\r\nСтарая шапка\r\n<!-- BOOK-AUTHOR-GENERATED:END -->';
    const prefix = '---\r\nselected_author: "Автор"\r\ncustom: true\r\n---\r\n\r\n';
    const notes = '\r\n## Мои заметки\r\n\nЛичные сведения $& [[Ссылка]] ^anchor\r\n';
    const raw = prefix + old + notes, next = pages.mergeAuthor(raw);
    assert.equal(next.slice(0,prefix.length),prefix); assert.ok(next.endsWith(notes));
    assert.equal(pages.mergeAuthor(next),next);
    assert.match(next,/mode: "author"/);
    assert.throws(()=>pages.mergeAuthor(raw+old),/маркеры/);
});
test('legacy author catalogue migrates without dropping trailing personal notes', () => {
    const raw='---\ncustom: true\n---\n\n# 👥 Авторы\n\nБаллы симпатии\n\n## Художественные\n\n| Автор |\n| --- |\n| Автор |\n\n## Non-fiction\n\n| Автор | Произведений |\n| --- | ---: |\n| Автор | 1 |\n\n## Мои заметки\n\nТекст пользователя $&';
    const next=pages.mergeOverview(raw);
    assert.ok(next.startsWith('---\ncustom: true\n---\n\n')); assert.ok(next.endsWith('## Мои заметки\n\nТекст пользователя $&'));
    assert.equal(pages.mergeOverview(next),next);
    assert.throws(()=>pages.mergeOverview('Заметка без созданной таблицы'),/Исходный текст сохранён/);
});
test('authors deduplicate coauthors, ignore nonfiction ratings and keep current rating semantics',()=>{
    const items=ui.buildItems([
      card('Книги/Художественные/Первая.md',{title:'Первая',authors:['Автор','Автор','Соавтор'],rating:9},[{date:'2024-04',number:1},{date:'2026',number:2}]),
      card('Книги/Non-fiction/Вторая.md',{title:'Вторая',authors:['Автор'],rating:10},[{date:'2025-06-01',number:1}]),
      card('Книги/Художественные/Третья.md',{title:'Третья',authors:'Автор',rating:3})
    ]);
    const author=ui.aggregate(items).find(row=>row.name==='Автор');
    assert.equal(author.count,3); assert.equal(author.average,6); assert.equal(author.favorites,1); assert.equal(author.points,4);
    assert.equal(ui.filterItems(items,{year:'2024'}).length,1);
    assert.equal(ui.filterItems(items,{year:'2026'}).length,1);
    assert.equal(ui.filterItems(items,{filter:'best'}).length,1);
    assert.equal(ui.filterItems(items,{filter:'nonfiction'}).length,1);
    assert.equal(ui.filterItems(items,{year:'unknown'}).length,1);
    assert.deepEqual(items[0].years,['2024','2026']);
});
