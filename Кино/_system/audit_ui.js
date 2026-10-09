const PATH = 'Кино/_system/Проверка кинотеки.md';
const UPDATE = 'Кино - Обновить оценки';
function ensureLayout(raw) {
    let text=String(raw).replace(/\r\n/g,'\n');
    if(!text.startsWith('---\n'))text='---\nobsidianUIMode: preview\n---\n\n'+text;
    const end=text.indexOf('\n---',4);
    let yaml=text.slice(4,end),body=text.slice(end+4);
    if(!/^obsidianUIMode:/m.test(yaml))yaml+='\nobsidianUIMode: preview';
    const classes=['kino-page','kino-system','kino-home-page','kino-report-page','kino-audit-page'];
    const existing=yaml.match(/^cssclasses:\s*(\[[^\n]*\])/m);
    if(existing){try{for(const value of JSON.parse(existing[1]))if(!classes.includes(value))classes.push(value);}catch{}}
    const replacement='cssclasses: '+JSON.stringify(classes);
    yaml=/^cssclasses:/m.test(yaml)?yaml.replace(/^cssclasses:[^\n]*(?:\n[ \t]+-[^\n]*)*/m,replacement):yaml+'\n'+replacement;
    const loader=['<!-- KINO:UI:START -->','```dataviewjs','try {',
        '    const file = app.vault.getAbstractFileByPath("Кино/_system/audit_ui.js");',
        '    if (!file) throw new Error("Не найден интерфейс проверки кинотеки");',
        '    const mod = { exports: {} };',
        '    new Function("module", await app.vault.read(file))(mod);',
        '    await mod.exports({ dv, app, obsidian: typeof require === "function" ? require("obsidian") : {} });',
        '} catch (error) { dv.paragraph("Не удалось загрузить интерфейс проверки: " + (error.message || error)); }',
        '```','<!-- KINO:UI:END -->'].join('\n');
    const region=/<!-- KINO:UI:START -->[\s\S]*?<!-- KINO:UI:END -->/;
    body=region.test(body)?body.replace(region,loader):'\n\n'+loader+'\n\n'+body.trimStart();
    const uri='obsidian://quickadd?choice='+encodeURIComponent(UPDATE);
    if(!body.includes(uri))body=body.replace(/^(\[🔎 Проверить\][^\n]*)/m,'$1 · [Обновить оценки]('+uri+' "Команда: '+UPDATE+'")');
    return '---\n'+yaml+'\n---'+body;
}
function sections(raw) {
    const body=String(raw).replace(/\r\n/g,'\n').replace(/^---\n[\s\S]*?\n---\n/,'').replace(/<!-- KINO:UI:START -->[\s\S]*?<!-- KINO:UI:END -->/,'');
    return [...body.matchAll(/^## ([^\n]+)\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)].map(match=>({title:match[1].replace(/^[^\p{L}\p{N}]+/u,'').trim(),body:match[2].trim()}));
}
async function render({dv,app,obsidian={}}) {
    const component=dv.component,doc=dv.container.ownerDocument,key='__kinoAudit';
    let state=component?.[key];
    if(!state){state={root:null,dispose:null,folds:{}};if(component){component[key]=state;const original=component.render;
        if(typeof original==='function'){const wrapped=function(...args){if(state.root?.parentNode===dv.container&&state.root.dataset.ready==='true')return Promise.resolve();return original.apply(this,args);};component.render=wrapped;component.register?.(()=>{if(component.render===wrapped)component.render=original;delete component[key];});}}}
    state.dispose?.();
    let disposed=false,root,timer,generation=0,busy=false,cancelled=false;
    const cleanups=[],sectionCleanups=[],children=new Set();
    function el(parent,tag,cls='',text){const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);parent.append(n);return n;}
    function listen(node,event,fn,list=cleanups){node.addEventListener(event,fn);list.push(()=>node.removeEventListener(event,fn));}
    function release(child){if(!children.delete(child))return;if(component?.removeChild)component.removeChild(child);else child.unload?.();}
    function makeChild(){
        const child=new obsidian.Component();let ended=false;
        const register=child.register?.bind(child),unload=child.unload?.bind(child),addChild=child.addChild?.bind(child);
        if(register)child.register=callback=>{if(ended||disposed){callback();return callback;}return register(callback);};
        child.unload=()=>{if(ended)return;ended=true;return unload?.();};
        if(addChild)child.addChild=nested=>{if(ended||disposed){nested.load?.();nested.unload?.();return nested;}return addChild(nested);};
        component.addChild(child);children.add(child);return child;
    }
    function clearSections(){for(const f of sectionCleanups.splice(0))f();for(const child of [...children])release(child);}
    function dispose(){if(disposed)return;disposed=true;cancelled=true;generation++;clearTimeout(timer);for(const f of cleanups.splice(0))f();clearSections();root?.remove();if(state.root===root)state.root=null;}
    state.dispose=dispose;component?.register?.(dispose);
    function internal(parent,label,path){const a=el(parent,'a','internal-link',label);a.href=path;listen(a,'click',event=>{event.preventDefault();app.workspace.openLinkText(path,PATH,Boolean(event.ctrlKey||event.metaKey));});}
    async function moduleAt(path){const f=app.vault.getAbstractFileByPath(path);if(!f)throw Error('Не найден '+path);const m={exports:{}};new Function('module',await app.vault.read(f))(m);return m.exports;}
    try{
        const styles=[];for(const path of ['Кино/_system/kino-home.css','Кино/_system/kino-statistics.css','Кино/_system/kino-audit.css']){const f=app.vault.getAbstractFileByPath(path);if(!f)throw Error('Не найден стиль проверки');styles.push(await app.vault.read(f));if(disposed)return {dispose};}
        root=el(dv.container,'section','kino-home-ui kino-report kino-audit');state.root=root;el(root,'style','',styles.join('\n'));
        const head=el(root,'header','kino-home-masthead');const nav=el(head,'nav','kino-home-nav');
        for(const [label,path]of [['← Кинотека','Кино/_index'],['Итоги просмотров','Кино/_system/Итоги просмотров'],['Журнал','Кино/_system/Журнал изменений'],['Исключения','Кино/_system/Исключения']])internal(nav,label,path);
        el(head,'h1','kino-home-title','Проверка кинотеки');
        const actions=el(head,'div','kino-home-actions'),buttons=[];
        const status=el(head,'p','kino-audit-status');status.setAttribute('role','status');status.hidden=true;
        const stop=el(head,'button','kino-audit-stop','Остановить обновление');stop.type='button';stop.hidden=true;listen(stop,'click',()=>{cancelled=true;stop.disabled=true;});
        const failures=el(head,'details','kino-audit-failures');failures.hidden=true;el(failures,'summary','','Карточки, которые не удалось обновить');const failureList=el(failures,'ul');
        async function run(action){if(busy||disposed)return;busy=true;cancelled=false;for(const b of buttons)b.disabled=true;status.hidden=false;status.textContent='Выполняется…';failures.hidden=true;
            try{
                if(action==='ratings'){
                    stop.hidden=false;stop.disabled=false;
                    const update=await moduleAt('Кино/_system/update_ratings.js');
                    const result=await update({app,obsidian,scope:'all',suppressNotice:true,shouldCancel:()=>cancelled||disposed,onProgress:p=>{if(!disposed)status.textContent=(p.phase==='predicting'?'Расчёт прогнозов':'Запись прогнозов')+': '+p.completed+' / '+p.total;}});
                    if(disposed)return;
                    status.textContent=result.busy?'Обновление уже выполняется.':(result.cancelled?'Обновление остановлено. ':'Готово. ')+'Обновлено прогнозов: '+result.updated+' · Без изменений: '+result.unchanged+' · Ошибок: '+result.failed.length;
                    if(result.failed?.length){failureList.replaceChildren();for(const entry of result.failed){const item=el(failureList,'li');internal(item,entry.path,entry.path);el(item,'span','',': '+entry.error);}failures.hidden=false;}
                }else{
                    const api=app.plugins?.plugins?.quickadd?.api;if(!api?.executeChoice)throw Error('Не найден QuickAdd');await api.executeChoice(action);if(!disposed)status.textContent='Готово.';
                }
            }catch(error){if(!disposed)status.textContent='Не удалось выполнить: '+(error.message||error);}
            finally{busy=false;if(!disposed){for(const b of buttons)b.disabled=false;stop.hidden=true;}}
        }
        for(const [label,choice,primary]of [['Проверить','Кино - Проверить кинотеку',true],['Обновить оценки','ratings',true],['Исправить безопасное','Кино - Исправить безопасное'],['Обновить роли','Кино - Обновить роли актёров']]){
            const button=el(actions,'button','kino-home-action'+(primary?' is-primary':''),label);button.type='button';buttons.push(button);
            if(choice==='ratings'){button.dataset.action='ratings';button.title='Команда: QuickAdd: '+UPDATE+'\nНа этой странице — все карточки; в карточке — только текущая. Пересчитывает «Прогноз оценки» для аналитики рекомендаций.';}
            listen(button,'click',()=>void run(choice));
        }
        el(head,'p','kino-audit-description','Обновление оценок пересчитывает локальные прогнозы для аналитики рекомендаций. Личные оценки сохраняются.');
        const content=el(root,'div','kino-audit-content');
        async function refresh(){const current=++generation;try{
            const file=app.vault.getAbstractFileByPath(PATH);if(!file)throw Error('Не найден отчёт проверки');const raw=await app.vault.read(file);if(disposed||current!==generation)return;
            clearSections();content.replaceChildren();
            for(const section of sections(raw)){
                const box=el(content,'details','kino-report-section');box.dataset.section=section.title;box.open=state.folds[section.title]??true;
                const summary=el(box,'summary');el(summary,'span','',section.title);el(summary,'span','kino-home-fold-chevron').setAttribute('aria-hidden','true');
                listen(box,'toggle',e=>{if(e.target===box)state.folds[section.title]=box.open;},sectionCleanups);
                const body=el(box,'div','kino-report-body');
                if(obsidian.MarkdownRenderer?.render&&obsidian.Component&&component?.addChild){
                    const child=makeChild();
                    await obsidian.MarkdownRenderer.render(app,section.body,body,PATH,child);
                    if(disposed||current!==generation){release(child);return;}
                }else el(body,'pre','kino-audit-fallback',section.body);
            }
        }catch(error){if(!disposed&&current===generation){status.hidden=false;status.textContent='Не удалось прочитать отчёт: '+(error.message||error);}}}
        await refresh();if(disposed)return {dispose};
        if(app.vault.on){const ref=app.vault.on('modify',file=>{if(file.path===PATH){clearTimeout(timer);timer=setTimeout(()=>void refresh(),100);}});cleanups.push(()=>app.vault.offref?.(ref));}
        try{const update=await moduleAt('Кино/_system/update_ratings.js');if(!disposed)await update.ensureCommand?.(app);}catch{/* The button remains usable without QuickAdd registration. */}
        if(!disposed)root.dataset.ready='true';return {dispose};
    }catch(error){dispose();throw error;}
}
module.exports=render;
module.exports.ensureLayout=ensureLayout;
module.exports.sections=sections;
