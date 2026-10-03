// Dataview renders each saved second-degree group as an interactive table.
function sortRows(rows,column,direction){
    const collator=new Intl.Collator("ru",{numeric:true,sensitivity:"base"}),numeric=column===2||column===3;
    return [...rows].sort((a,b)=>{
        const left=a.values[column],right=b.values[column],missing=v=>v===null||v===undefined||v===""||v==="-"||v==="—";
        if(missing(left)||missing(right))return Number(missing(left))-Number(missing(right))||a.index-b.index;
        return (numeric?left-right:collator.compare(String(left),String(right)))*direction||a.index-b.index;
    });
}
function render(dv,films,app=dv.app){
    const wrap=dv.container.createDiv();
    wrap.style.cssText="width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;margin:12px 0 28px;border:1px solid var(--background-modifier-border);border-radius:14px";
    const table=wrap.createEl("table");
    table.style.cssText="width:1100px;min-width:1100px;max-width:none;table-layout:fixed;border-collapse:collapse;margin:0";
    const widths=[260,190,100,110,440],cols=table.createEl("colgroup");
    for(const width of widths)cols.createEl("col").style.width=`${width}px`;
    const head=table.createEl("thead").createEl("tr"),body=table.createEl("tbody");
    const labels=["Русское название","English","Рейтинг КП","Мой прогноз","Описание"];
    const buttons=[],headers=[],rows=[],cleanups=[];
    let column=-1,direction=1;
    const update=()=>headers.forEach((cell,i)=>{
        cell.setAttribute("aria-sort",column===i?(direction===1?"ascending":"descending"):"none");
        buttons[i].textContent=`${labels[i]} ${column===i?(direction===1?"↑":"↓"):"↕"}`;
    });
    labels.forEach((label,i)=>{
        const cell=head.createEl("th");headers.push(cell);
        cell.style.cssText="text-align:left;vertical-align:middle;padding:10px 12px;border:0;border-bottom:2px solid var(--interactive-accent);background:var(--background-secondary);white-space:normal";
        const button=cell.createEl("button",{text:label});buttons.push(button);button.type="button";
        button.title=`Сортировать: ${label}`;
        button.style.cssText="border:0;box-shadow:none;background:transparent;padding:0;color:inherit;cursor:pointer;font:inherit;font-weight:600;line-height:1.4;text-align:left;height:auto;width:100%;white-space:normal";
        const onClick=()=>{
            direction=column===i?-direction:(i===2||i===3?-1:1);column=i;
            for(const item of sortRows(rows,column,direction))body.appendChild(item.row);
            update();
        };
        button.addEventListener("click",onClick);cleanups.push(()=>button.removeEventListener("click",onClick));
    });
    const number=v=>{if(v===null||v===undefined||String(v).trim()==="")return null;const n=Number(String(v).replace(",","."));return Number.isFinite(n)?n:null;};
    const fmt=v=>v===null?"—":v.toFixed(1);
    for(const [index,film] of films.entries()){
        const row=body.createEl("tr");if(index%2)row.style.background="var(--background-primary-alt)";const rating=number(film.kpRating),forecast=number(film.forecast);
        const cells=labels.map(()=>{const cell=row.createEl("td");cell.style.cssText="vertical-align:top;padding:9px 12px;border:0;border-bottom:1px solid var(--background-modifier-border);white-space:normal;overflow-wrap:break-word;line-height:1.45";return cell;});
        const title=film.ruTitle||film.enTitle||"Фильм";
        const link=cells[0].createEl("a",{text:film.libraryPath?`✓ ${title}`:title});
        if(film.libraryPath){
            link.classList.add("internal-link");link.href=film.libraryPath;link.setAttribute("data-href",film.libraryPath);
            link.style.fontWeight="700";link.style.color="var(--text-success, var(--interactive-accent))";
            link.title="Просмотрено · Открыть карточку в кинотеке";
            const onClick=event=>{event.preventDefault();event.stopPropagation();app.workspace.openLinkText(film.libraryPath,dv.current()?.file?.path||"",event.ctrlKey||event.metaKey);};
            link.addEventListener("click",onClick);cleanups.push(()=>link.removeEventListener("click",onClick));
        }else{
            link.href=/^https?:\/\//i.test(film.url||"")?film.url:"https://www.kinopoisk.ru/";link.target="_blank";link.rel="noopener noreferrer";
        }
        if(film.year)cells[0].createEl("span",{text:` (${film.year})`}).style.opacity="0.65";
        cells[1].textContent=film.enTitle||"—";
        cells[2].textContent=fmt(rating);cells[3].textContent=fmt(forecast);
        cells[2].style.textAlign=cells[3].style.textAlign="center";cells[2].style.fontWeight=cells[3].style.fontWeight="600";
        const full=String(film.description||"").trim();
        cells[4].createEl("div",{text:full.length>280?full.slice(0,277).trim()+"…":full||"—"});
        if(full.length>280){const details=cells[4].createEl("details");details.style.marginTop="6px";details.createEl("summary",{text:"Полное описание"});details.createEl("div",{text:full});}
        rows.push({row,index,values:[title,film.enTitle||"",rating,forecast,full]});
    }
    update();dv.component.register(()=>{for(const dispose of cleanups)dispose();});
}
module.exports={render,sortRows};
