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
    const wrap=dv.container.createDiv({cls:"kino-table-wrap"});
    wrap.setAttribute("role","region");wrap.setAttribute("aria-label","Таблица рекомендаций");wrap.tabIndex=0;
    const table=wrap.createEl("table",{cls:"kino-recommendation-table"});
    const widths=[24,17,9,10,40],cols=table.createEl("colgroup");
    for(const width of widths)cols.createEl("col").style.width=`${width}%`;
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
        cell.setAttribute("scope","col");
        const button=cell.createEl("button",{text:label});buttons.push(button);button.type="button";
        button.title=`Сортировать: ${label}`;
        button.classList.add("kino-sort-button");
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
        const row=body.createEl("tr");const rating=number(film.kpRating),forecast=number(film.forecast);
        const cells=labels.map(label=>{const cell=row.createEl("td");cell.setAttribute("data-label",label);return cell;});
        const title=film.ruTitle||film.enTitle||"Фильм";
        const link=cells[0].createEl("a",{text:film.libraryPath?`✓ ${title}`:title});
        if(film.libraryPath){
            link.classList.add("internal-link");link.href=film.libraryPath;link.setAttribute("data-href",film.libraryPath);
            link.classList.add("kino-library-link");
            link.title="Просмотрено · Открыть карточку в кинотеке";
            const onClick=event=>{event.preventDefault();event.stopPropagation();app.workspace.openLinkText(film.libraryPath,dv.current()?.file?.path||"",event.ctrlKey||event.metaKey);};
            link.addEventListener("click",onClick);cleanups.push(()=>link.removeEventListener("click",onClick));
        }else{
            link.href=/^https?:\/\//i.test(film.url||"")?film.url:"https://www.kinopoisk.ru/";link.target="_blank";link.rel="noopener noreferrer";
        }
        if(film.year)cells[0].createEl("span",{text:` (${film.year})`,cls:"kino-year"});
        cells[1].textContent=film.enTitle||"—";
        cells[2].textContent=fmt(rating);cells[3].textContent=fmt(forecast);
        cells[2].classList.add("kino-rating");cells[3].classList.add("kino-rating");
        const full=String(film.description||"").trim();
        cells[4].createEl("div",{text:full.length>280?full.slice(0,277).trim()+"…":full||"—"});
        if(full.length>280){const details=cells[4].createEl("details",{cls:"kino-description-details"});details.createEl("summary",{text:"Полное описание"});details.createEl("div",{text:full});}
        rows.push({row,index,values:[title,film.enTitle||"",rating,forecast,full]});
    }
    update();dv.component.register(()=>{for(const dispose of cleanups)dispose();});
}
module.exports={render,sortRows};
