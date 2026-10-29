// Навигация по одной заметке. Исходный Markdown читается, но не изменяется.
function sportNutritionParse(text) {
    const start = "<!-- SPORT:NUTRITION:CONTENT:START -->";
    const end = "<!-- SPORT:NUTRITION:CONTENT:END -->";
    const marker = /^<!-- SPORT:NUTRITION:CONTENT:START -->\s*$/m.exec(text);
    const offset = marker?.index ?? -1;
    const content = (offset < 0 ? text : text.slice(offset + start.length)).split(end)[0]
        .replace(/<!-- SPORT:NUTRITION:BACK:START -->[\s\S]*?<!-- SPORT:NUTRITION:BACK:END -->/g, "");
    const lines = content.split(/\r?\n/), entries = [], stack = [];
    let section = "", fenced = false;
    for (let i = 0; i < lines.length; i++) {
        if (/^\s*(\x60{3,}|~{3,})/.test(lines[i])) { fenced = !fenced; continue; }
        if (fenced) continue;
        const match = /^(#{1,6})\s+(.+?)\s*$/.exec(lines[i]);
        if (!match) continue;
        const level = match[1].length, title = match[2];
        if (level === 1) section = title;
        while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
        entries.push({ title, level, section, line: i, path: stack.map(item => item.title) });
        stack.push({ title, level });
    }
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        entry.body = lines.slice(entry.line + 1, entries[i + 1]?.line ?? lines.length).join("\n").trim();
        entry.plain = sportNutritionPlain(entry.body);
        entry.titleKey = sportNutritionNormalize(entry.title);
        entry.bodyKey = sportNutritionNormalize(entry.plain);
        entry.pathKey = sportNutritionNormalize(entry.path.join(" "));
    }
    return entries;
}
function sportNutritionNormalize(value) {
    return String(value).toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}
function sportNutritionPlain(value) {
    return String(value)
        .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
        .replace(/\[\[([^\]]+)\]\]/g, "$1")
        .replace(/\[([^\]]+)\]\([^]*?\)/g, "$1")
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/[*_\x60>#]/g, "").replace(/^\^[\w-]+$/gm, "")
        .replace(/\s+/g, " ").trim();
}
function sportNutritionSearch(entries, query, section = "") {
    const key = sportNutritionNormalize(query), terms = key.split(" ").filter(Boolean);
    return entries.filter(entry => (!section || entry.section === section)
        && terms.every(term => (entry.titleKey + " " + entry.pathKey + " " + entry.bodyKey).includes(term)))
        .map(entry => ({ entry, rank: !key ? 5 : entry.titleKey === key ? 0
            : entry.titleKey.startsWith(key) ? 1 : entry.titleKey.includes(key) ? 2
                : terms.every(term => entry.titleKey.includes(term)) ? 3 : 4 }))
        .sort((a, b) => a.rank - b.rank || a.entry.line - b.entry.line).map(item => item.entry);
}
// Продолжение общего парсера. Содержимое заметки никогда не записывается из UI.
const readerCss = [
".sport-nutrition-page{--file-line-width:100%;--sn-accent:#b89760;--sn-line:var(--background-modifier-border,#363a42)}",
".markdown-preview-view.sport-nutrition-page .markdown-preview-sizer{max-width:none;width:100%;min-width:0}.sport-nutrition-page .inline-title{display:none}",
".sn-reader{container:sn-reader / inline-size;min-width:0;width:100%;font-size:15px}.sn-reader *{box-sizing:border-box}.sn-reader [hidden]{display:none!important}",
".sn-reader :is(button,input,a,summary):focus-visible{outline:2px solid var(--sn-accent);outline-offset:2px}.sn-reader button{font:inherit;box-shadow:none;cursor:pointer;white-space:normal;height:auto}",
".sn-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0 20px;padding-bottom:16px;border-bottom:1px solid var(--sn-line)}",
".sn-reader .sn-search{flex:1;min-width:130px;height:44px;padding:10px 12px;border:1px solid var(--sn-line);border-radius:7px;background:var(--background-primary);color:var(--text-normal);font:inherit}",
".sn-reader .sn-action{min-height:44px;padding:8px 12px;border:1px solid var(--sn-line);border-radius:7px;background:transparent;color:var(--text-muted);font-size:13px}.sn-reader .sn-action[aria-pressed=true]{color:var(--sn-accent);border-color:var(--sn-accent)}.sn-reader button:disabled{opacity:.35;cursor:default}",
".sn-shell{display:grid;grid-template-columns:minmax(210px,25%) minmax(0,1fr);gap:24px;align-items:start;min-width:0}",
".sn-sidebar{height:72vh;min-height:300px;overflow:auto;scrollbar-width:thin;padding:8px;border:1px solid var(--sn-line);border-radius:10px;background:var(--background-primary);min-width:0}",
".sn-reader .sn-row{display:block;width:100%;text-align:left;padding:10px;min-height:44px;border:0;border-radius:6px;background:transparent;color:var(--text-normal);font-size:13px;line-height:1.45;overflow-wrap:anywhere}",
".sn-reader .sn-row:hover{background:var(--background-modifier-hover,#282b31)}.sn-reader .sn-row[aria-current=page]{background:color-mix(in srgb,var(--sn-accent) 12%,var(--background-primary));box-shadow:inset 2px 0 var(--sn-accent);color:var(--sn-accent)}",
".sn-branch>summary{display:flex;align-items:start;list-style:none;cursor:pointer}.sn-branch>summary::-webkit-details-marker{display:none}.sn-branch>summary:before{content:'›';flex:0 0 23px;padding-top:11px;text-align:center;color:var(--text-muted)}.sn-branch[open]>summary:before{content:'⌄'}.sn-branch>summary .sn-row{flex:1;min-width:0}.sn-children{margin-left:10px;padding-left:8px;border-left:1px solid var(--sn-line)}",
".sn-caption{display:block;font-size:11px;color:var(--text-muted);margin-top:4px}.sn-reading{min-width:0}.sn-breadcrumb{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px;color:var(--text-muted);font-size:12px}.sn-reader .sn-crumb{border:0;background:none;color:inherit;font-size:inherit;padding:3px;min-height:30px}",
".sn-reading-head{display:flex;align-items:start;justify-content:space-between;gap:12px;margin-bottom:12px}.sn-reader h2.sn-title{font:600 25px/1.3 'Palatino Linotype',Georgia,serif;color:var(--sn-accent);margin:0;border:0;overflow-wrap:anywhere}.sn-status{font-size:12px;color:var(--text-muted);margin:8px 0 0}",
".sn-article{height:65vh;min-height:280px;overflow:auto;scrollbar-width:thin;overscroll-behavior:contain;border:1px solid var(--sn-line);border-radius:10px;padding:22px;line-height:1.75;overflow-wrap:anywhere}.sn-article :is(h1,h2,h3,h4){scroll-margin-top:12px}.sn-article>:first-child{margin-top:0}.sn-article a{color:var(--sn-accent)}",
".sn-footer{display:flex;justify-content:space-between;gap:8px;margin-top:12px}.sn-footer .sn-action{max-width:48%;text-align:left}.sn-nav-toggle{display:none!important}",
"/* Hide only the native fallback after a complete successful reader render. */",
".markdown-preview-view.sport-nutrition-page .el-pre:has(.sn-reader[data-ready=true]) ~ :not(.markdown-preview-pusher):not(.mod-ui):not(.search-highlight){display:block!important;height:0!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;overflow:hidden;visibility:hidden;pointer-events:none}",
"@container sn-reader (max-width:680px){.sn-shell{grid-template-columns:minmax(0,1fr);gap:16px}.sn-nav-toggle{display:inline-block!important}.sn-reader[data-navigation-open=false] .sn-sidebar{display:none}.sn-sidebar{height:45vh;min-height:180px}.sn-article{height:65vh;padding:16px}.sn-search{flex-basis:100%!important}.sn-reading-head{display:block}}"
].join("\n");

async function sportNutritionReader({dv,app,obsidian={}}) {
    if (!obsidian.MarkdownRenderer || !obsidian.Component) throw new Error("Недоступен MarkdownRenderer Obsidian");
    const component=dv.component, doc=dv.container.ownerDocument, source=dv.current()?.file?.path || "Спортивное питание.md";
    if (!component) throw new Error("Недоступен компонент Dataview");
    let lifecycle=component.__snReader;
    if (!lifecycle) {
        lifecycle={generation:0,alive:true,dispose:null};
        component.__snReader=lifecycle;
        component.register(()=>{lifecycle.alive=false;lifecycle.generation++;lifecycle.dispose?.();delete component.__snReader;});
    }
    lifecycle.dispose?.(); const generation=++lifecycle.generation;
    const file=app.vault.getAbstractFileByPath(source);
    const text=await app.vault.read(file);
    if (!lifecycle.alive || generation!==lifecycle.generation) return;
    const entries=sportNutritionParse(text);
    const raw=text.split("<!-- SPORT:NUTRITION:CONTENT:START -->")[1]?.split("<!-- SPORT:NUTRITION:CONTENT:END -->")[0]
        .replace(/<!-- SPORT:NUTRITION:BACK:START -->[\s\S]*?<!-- SPORT:NUTRITION:BACK:END -->/g,"");
    if (!raw || !entries.length) throw new Error("Не найден текст справочника");
    // Use the exact line origin of the common parser.
    const lines=raw.split(/\r?\n/);
    const key="sport_nutrition_reader:"+source;
    let saved={};
    try {saved=JSON.parse(doc.defaultView.localStorage.getItem(key)) || {};} catch (_) {}
    let selected=saved.selected===""||entries.some(e=>e.title===saved.selected)?saved.selected:entries[0].title;
    let opened=new Set(Array.isArray(saved.opened)?saved.opened:[]), positions=saved.positions||{};
    let query="", disposed=false, renderId=0, child=null, timer=null, displayed=null;
    const history=[], cleanup=[];
    const root=doc.createElement("section");root.className="sn-reader";root.dataset.navigationOpen="false";
    lifecycle.dispose=()=>{disposed=true;renderId++;clearTimeout(timer);cleanup.splice(0).forEach(fn=>fn());release();root.remove();};
    function release(){if(child){component.removeChild(child);child=null;}}
    function el(parent,tag,cls,text){const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;parent.appendChild(n);return n;}
    function listen(n,event,fn,options){n.addEventListener(event,fn,options);cleanup.push(()=>n.removeEventListener(event,fn,options));}
    function persist(){try{doc.defaultView.localStorage.setItem(key,JSON.stringify({selected,opened:[...opened],positions}));}catch(_){}}
    function button(parent,label,cls,action){const b=el(parent,"button",cls,label);b.type="button";b.dataset.action=action;return b;}
    const style=doc.getElementById("sport-nutrition-ui-style")||el(doc.head,"style","");
    style.id="sport-nutrition-ui-style";style.textContent=readerCss;
    const toolbar=el(root,"div","sn-toolbar");
    const search=el(toolbar,"input","sn-search");search.type="search";search.placeholder="Найти вещество, термин или фразу";
    search.setAttribute("aria-label","Поиск по всему справочнику");
    button(toolbar,"×","sn-action","clear").setAttribute("aria-label","Очистить поиск");
    const navToggle=button(toolbar,"Разделы","sn-action sn-nav-toggle","navigation");navToggle.setAttribute("aria-expanded","false");
    const all=button(toolbar,"Весь текст","sn-action","all");
    const back=button(toolbar,"← Назад","sn-action","back");
    const shell=el(root,"div","sn-shell"), sidebar=el(shell,"nav","sn-sidebar");
    sidebar.setAttribute("aria-label","Рубрикатор справочника");
    const reading=el(shell,"section","sn-reading"), crumbs=el(reading,"nav","sn-breadcrumb");
    crumbs.setAttribute("aria-label","Путь раздела");
    const head=el(reading,"div","sn-reading-head"), heading=el(head,"h2","sn-title");
    const status=el(head,"p","sn-status");status.setAttribute("role","status");
    const article=el(reading,"div","sn-article markdown-rendered");article.tabIndex=0;article.setAttribute("aria-label","Текст выбранной темы");
    const footer=el(reading,"div","sn-footer"), previous=button(footer,"","sn-action","previous"), next=button(footer,"","sn-action","next");
    const tree=[], stack=[];
    entries.forEach((entry,index)=>{
        const node={entry,index,children:[]};
        while(stack.length&&stack.at(-1).entry.level>=entry.level)stack.pop();
        (stack.length?stack.at(-1).children:tree).push(node);stack.push(node);
    });
    function reveal(){
        const entry=entries.find(e=>e.title===selected);
        entry?.path.forEach(title=>opened.add(title));
    }
    function row(parent,entry,caption=""){
        const b=button(parent,"","sn-row","select");b.dataset.title=entry.title;
        b.setAttribute("aria-current",selected===entry.title?"page":"false");
        el(b,"span","",entry.title);if(caption)el(b,"small","sn-caption",caption);
    }
    function drawTree(){
        sidebar.replaceChildren();
        if(query){
            const hits=sportNutritionSearch(entries,query);
            el(sidebar,"p","sn-status","Найдено: "+hits.length);
            hits.forEach(e=>{
                const word=sportNutritionNormalize(query).split(" ").find(term=>e.bodyKey.includes(term));
                const start=word?Math.max(0,e.bodyKey.indexOf(word)-30):0;
                const snippet=e.plain?(start?"…":"")+e.plain.slice(start,start+120)+(start+120<e.plain.length?"…":""):"";
                row(sidebar,e,[e.path.join(" › "),snippet].filter(Boolean).join(" · "));
            });
            return;
        }
        function draw(nodes,parent){
            nodes.forEach(node=>{
                if(!node.children.length){row(parent,node.entry);return;}
                const details=el(parent,"details","sn-branch");details.dataset.title=node.entry.title;
                const summary=el(details,"summary","");summary.setAttribute("aria-label","Раскрыть: "+node.entry.title);
                row(summary,node.entry);
                draw(node.children,el(details,"div","sn-children"));details.open=opened.has(node.entry.title);
            });
        }
        draw(tree,sidebar);
        const active=sidebar.querySelector('[aria-current="page"]');
        if(active){
            const box=sidebar.getBoundingClientRect(), row=active.getBoundingClientRect();
            if(row.bottom>box.bottom)sidebar.scrollTop+=row.bottom-box.bottom+12;
            else if(row.top<box.top)sidebar.scrollTop-=box.top-row.top+12;
        }
    }
    function rememberPosition(){if(displayed!==null)positions[displayed||"__all"]=article.scrollTop;}
    async function show(title,{push=true}={}){
        rememberPosition();
        if(push&&title!==selected)history.push(selected);
        selected=title;query="";search.value="";reveal();drawTree();persist();
        root.dataset.navigationOpen="false";navToggle.setAttribute("aria-expanded","false");
        back.disabled=!history.length;all.setAttribute("aria-pressed",String(!selected));
        const index=entries.findIndex(e=>e.title===selected), entry=entries[index];
        crumbs.replaceChildren();
        if(entry)entry.path.forEach(parent=>{const b=button(crumbs,parent,"sn-crumb","select");b.dataset.title=parent;el(crumbs,"span","","›");});
        heading.textContent=entry?.title||"Весь справочник";
        previous.hidden=next.hidden=!entry;
        previous.disabled=index<=0;next.disabled=index>=entries.length-1;
        previous.textContent=index>0?"← "+entries[index-1].title:"Начало";
        next.textContent=index<entries.length-1?"Следующая: "+entries[index+1].title+" →":"Конец";
        let stop=index+1;
        while(stop<entries.length&&entries[stop].level>entry?.level)stop++;
        const markdown=entry?lines.slice(entry.line+1,entries[stop]?.line??lines.length).join("\n"):raw;
        const token=++renderId, holder=doc.createElement("div");
        const renderComponent=new obsidian.Component();component.addChild(renderComponent);
        status.textContent="Загрузка…";
        try {
            await obsidian.MarkdownRenderer.render(app,markdown,holder,source,renderComponent);
            if(disposed||token!==renderId){component.removeChild(renderComponent);return;}
            release();child=renderComponent;article.replaceChildren(holder);displayed=selected;
            article.scrollTop=positions[selected||"__all"]||0;
            status.textContent=entry?"Тема "+(index+1)+" из "+entries.length:"Все "+entries.length+" заголовков";
            root.dataset.ready="true";
        }catch(error){
            component.removeChild(renderComponent);
            if(disposed||token!==renderId)return;
            root.dataset.ready="false";status.textContent="Не удалось показать текст. Исходная заметка доступна ниже.";
            console.warn("Спортивное питание: чтение",error);
        }
    }
    // toggle does not bubble.
    root.addEventListener("toggle",onToggle,true);
    function onToggle(event){const d=event.target;if(!d.matches?.("details.sn-branch"))return;if(d.open)opened.add(d.dataset.title);else opened.delete(d.dataset.title);persist();}
    cleanup.push(()=>root.removeEventListener("toggle",onToggle,true));
    listen(root,"click",event=>{
        const b=event.target.closest?.("button[data-action]");
        if(b&&root.contains(b)){
            event.preventDefault();event.stopPropagation();
            const action=b.dataset.action,index=entries.findIndex(e=>e.title===selected);
            if(action==="select")show(b.dataset.title);
            if(action==="all")show("");
            if(action==="previous"&&index>0)show(entries[index-1].title);
            if(action==="next"&&index<entries.length-1)show(entries[index+1].title);
            if(action==="back"&&history.length)show(history.pop(),{push:false});
            if(action==="clear"){query="";search.value="";drawTree();search.focus();}
            if(action==="navigation"){const open=root.dataset.navigationOpen!=="true";root.dataset.navigationOpen=String(open);navToggle.setAttribute("aria-expanded",String(open));}
            return;
        }
        const link=event.target.closest?.("a.internal-link");
        if(!link||!article.contains(link))return;
        let target=link.dataset.href||link.getAttribute("href")||"";
        try{target=decodeURIComponent(target);}catch(_){}
        const hash=target.indexOf("#");
        if(hash<0)return;
        const targetFile=target.slice(0,hash), anchor=target.slice(hash+1);
        if(targetFile&&targetFile!==source&&targetFile!==source.replace(/\.md$/,""))return;
        const entry=anchor.startsWith("^")?entries.find(e=>e.body.includes(anchor)):entries.find(e=>e.title===anchor);
        if(entry){event.preventDefault();event.stopPropagation();show(entry.title);}
    },true);
    listen(search,"input",()=>{query=search.value.trim();drawTree();if(query){root.dataset.navigationOpen="true";navToggle.setAttribute("aria-expanded","true");}});
    listen(search,"keydown",event=>{if(event.key==="Escape"){query="";search.value="";drawTree();}});
    listen(article,"scroll",()=>{rememberPosition();clearTimeout(timer);timer=setTimeout(persist,200);});
    dv.container.appendChild(root);
    await show(selected,{push:false});
    if(!lifecycle.alive||generation!==lifecycle.generation)lifecycle.dispose?.();
    return {dispose:lifecycle.dispose};
}
module.exports=sportNutritionReader;
module.exports.parse=sportNutritionParse;
module.exports.search=sportNutritionSearch;
module.exports.css=readerCss;
