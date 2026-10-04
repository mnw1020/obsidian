// A Bases view is rendered only on demand and its resources unload on collapse.
module.exports=({dv,app,obsidian,target,label})=>{
    dv.container.classList.add("kino-lazy-section");
    const button=dv.container.createEl("button",{text:`Показать ${label}`,cls:"kino-lazy-toggle"});
    button.type="button";button.setAttribute("aria-expanded","false");
    const content=dv.container.createDiv({cls:"kino-lazy-content"});let child=null,busy=false;
    button.addEventListener("click",async()=>{
        if(busy)return;
        if(child){dv.component.removeChild(child);child=null;content.empty();button.textContent=`Показать ${label}`;button.setAttribute("aria-expanded","false");return;}
        if(!obsidian?.MarkdownRenderer||!obsidian?.Component||!dv.component){content.textContent="Открой таблицу по ссылке выше.";return;}
        busy=true;button.disabled=true;
        try{
            child=new obsidian.Component();dv.component.addChild(child);
            await obsidian.MarkdownRenderer.render(app,`![[${target}]]`,content,dv.current().file.path,child);
            button.textContent=`Скрыть ${label}`;
            button.setAttribute("aria-expanded","true");
        }catch(error){if(child)dv.component.removeChild(child);child=null;content.textContent=String(error?.message||error).slice(0,120);}
        finally{busy=false;button.disabled=false;}
    });
};
