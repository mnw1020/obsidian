const PATH='Кино/_system/Исключения.md';
const CHOICE='Кино - Переключить исключение аудита';
function entries(raw){
    const found=new Map();
    for(const m of String(raw).matchAll(/\[\[(Кино\/[^\]|]+)(?:\|([^\]]+))?\]\]/g)){
        const path=m[1].endsWith('.md')?m[1]:m[1]+'.md';
        found.set(path,{path,title:m[2]||path.split('/').pop().replace(/\.md$/i,'')});
    }
    return [...found.values()].sort((a,b)=>a.title.localeCompare(b.title,'ru'));
}
function ensureLayout(raw){
    let text=String(raw).replace(/\r\n/g,'\n');
    if(!text.startsWith('---\n'))text='---\nobsidianUIMode: preview\n---\n\n'+text;
    const end=text.indexOf('\n---',4);let yaml=text.slice(4,end),body=text.slice(end+4);
    yaml=/^obsidianUIMode:/m.test(yaml)?yaml.replace(/^obsidianUIMode:[^\n]*/m,'obsidianUIMode: preview'):yaml+'\nobsidianUIMode: preview';
    const classes=['kino-page','kino-system','kino-home-page','kino-report-page','kino-exclusions-page'];
    const existing=yaml.match(/^cssclasses:\s*(\[[^\n]*\])/m);
    if(existing){try{for(const value of JSON.parse(existing[1]))if(!classes.includes(value))classes.push(value);}catch{}}
    const replacement='cssclasses: '+JSON.stringify(classes);
    yaml=/^cssclasses:/m.test(yaml)?yaml.replace(/^cssclasses:[^\n]*(?:\n[ \t]+-[^\n]*)*/m,replacement):yaml+'\n'+replacement;
    const loader=['<!-- KINO:UI:START -->','```dataviewjs','try {',
        '    const file = app.vault.getAbstractFileByPath("Кино/_system/exclusions_ui.js");',
        '    if (!file) throw new Error("Не найден интерфейс исключений");',
        '    const mod = { exports: {} };',
        '    new Function("module", await app.vault.read(file))(mod);',
        '    await mod.exports({ dv, app, obsidian: typeof require === "function" ? require("obsidian") : {} });',
        '} catch (error) { dv.paragraph("Не удалось загрузить исключения: " + (error.message || error)); }',
        '```','<!-- KINO:UI:END -->'].join('\n');
    const region=/<!-- KINO:UI:START -->[\s\S]*?<!-- KINO:UI:END -->/;
    body=region.test(body)?body.replace(region,loader):'\n\n'+loader+'\n\n'+body.trimStart();
    return '---\n'+yaml+'\n---'+body;
}
async function render({dv,app}){
    const doc=dv.container.ownerDocument,component=dv.component,key='__kinoExclusions';
    let state=component?.[key];
    if(!state){state={open:true};if(component){component[key]=state;const original=component.render;
        if(typeof original==='function'){const wrapped=function(...args){if(state.root?.parentNode===dv.container&&state.root.dataset.ready==='true')return Promise.resolve();return original.apply(this,args);};component.render=wrapped;component.register?.(()=>{if(component.render===wrapped)component.render=original;delete component[key];});}}}
    state.dispose?.();
    let root,disposed=false,timer,generation=0,busy=false;const cleanups=[],rowCleanups=[];
    function el(parent,tag,cls='',text){const node=doc.createElement(tag);node.className=cls;if(text!==undefined)node.textContent=text;parent.append(node);return node;}
    function listen(node,event,fn,list=cleanups){node.addEventListener(event,fn);list.push(()=>node.removeEventListener(event,fn));}
    function clearRows(){for(const fn of rowCleanups.splice(0))fn();}
    function dispose(){if(disposed)return;disposed=true;generation++;clearTimeout(timer);clearRows();for(const fn of cleanups.splice(0))fn();root?.remove();if(state.root===root)state.root=null;}
    state.dispose=dispose;component?.register?.(dispose);
    function link(parent,label,path,list=cleanups){const a=el(parent,'a','internal-link',label);a.href=path;listen(a,'click',event=>{event.preventDefault();app.workspace.openLinkText(path,PATH,Boolean(event.ctrlKey||event.metaKey));},list);return a;}
    try{
        const css=[];for(const name of ['kino-home.css','kino-statistics.css','kino-exclusions.css']){
            const file=app.vault.getAbstractFileByPath('Кино/_system/'+name);if(!file)throw Error('Не найден стиль исключений');css.push(await app.vault.read(file));if(disposed)return {dispose};
        }
        root=el(dv.container,'section','kino-home-ui kino-report kino-exclusions');state.root=root;el(root,'style','',css.join('\n'));
        const head=el(root,'header','kino-home-masthead'),nav=el(head,'nav','kino-home-nav');
        link(nav,'← Кинотека','Кино/_index');link(nav,'Проверка кинотеки','Кино/_system/Проверка кинотеки');link(nav,'Журнал','Кино/_system/Журнал изменений');
        el(head,'h1','kino-home-title','Исключения');
        el(head,'p','kino-exclusions-description','Эти карточки пропускаются при проверке кинотеки. Верните карточку в проверку, когда исключение больше не нужно.');
        const status=el(head,'p','kino-exclusions-status');status.setAttribute('role','status');status.hidden=true;
        const box=el(root,'details','kino-report-section');box.open=state.open;
        const summary=el(box,'summary');el(summary,'span','','Исключённые карточки');
        const meta=el(summary,'span','kino-exclusions-meta');const count=el(meta,'span','kino-exclusions-count');el(meta,'span','kino-home-fold-chevron').setAttribute('aria-hidden','true');
        listen(box,'toggle',event=>{if(event.target===box)state.open=box.open;});
        const rows=el(box,'div','kino-exclusions-list');
        async function restore(entry){
            if(busy||disposed)return;busy=true;status.hidden=false;status.textContent='Возвращаем карточку в проверку…';
            for(const b of rows.querySelectorAll('button'))b.disabled=true;
            try{const api=app.plugins?.plugins?.quickadd?.api;if(!api?.executeChoice)throw Error('Не найден QuickAdd');
                await api.executeChoice(CHOICE,{path:entry.path,action:'include'});
                if(!disposed){await refresh();status.textContent='Возвращено в проверку: '+entry.title;}
            }catch(error){if(!disposed)status.textContent='Не удалось вернуть карточку: '+(error.message||error);}
            finally{busy=false;if(!disposed)for(const b of rows.querySelectorAll('button'))b.disabled=false;}
        }
        async function refresh(){const current=++generation;try{
            const file=app.vault.getAbstractFileByPath(PATH);if(!file)throw Error('Не найден список исключений');
            const raw=await app.vault.read(file);if(disposed||current!==generation)return;
            const list=entries(raw);clearRows();rows.replaceChildren();count.textContent=String(list.length);
            if(!list.length)el(rows,'p','kino-exclusions-empty','Исключений нет — проверяются все карточки.');
            for(const entry of list){const row=el(rows,'div','kino-exclusions-row');
                link(row,entry.title,entry.path,rowCleanups);
                const button=el(row,'button','kino-exclusions-restore','Вернуть в проверку');button.type='button';button.disabled=busy;
                button.setAttribute('aria-label','Вернуть в проверку: '+entry.title);
                listen(button,'click',()=>void restore(entry),rowCleanups);
            }
        }catch(error){if(!disposed&&current===generation){status.hidden=false;status.textContent='Не удалось прочитать исключения: '+(error.message||error);}}}
        await refresh();if(disposed)return {dispose};
        if(app.vault.on){const ref=app.vault.on('modify',file=>{if(file.path===PATH){clearTimeout(timer);timer=setTimeout(()=>void refresh(),100);}});cleanups.push(()=>app.vault.offref?.(ref));}
        root.dataset.ready='true';return {dispose};
    }catch(error){dispose();throw error;}
}
module.exports=render;
module.exports.ensureLayout=ensureLayout;
module.exports.entries=entries;
