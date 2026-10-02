// Enhance saved second-degree HTML tables without rewriting notes or fetching data.
function sortRows(rows,column,direction){
    const collator=new Intl.Collator("ru",{numeric:true,sensitivity:"base"});
    const numeric=column===2||column===3;
    return [...rows].sort((a,b)=>{
        const left=a.values[column],right=b.values[column];
        const missing=v=>v===null||v===undefined||v===""||v==="-"||v==="—";
        if(missing(left)||missing(right))return Number(missing(left))-Number(missing(right))||a.index-b.index;
        const cmp=numeric?left-right:collator.compare(String(left),String(right));
        return cmp*direction||a.index-b.index;
    });
}
module.exports=function mountRecommendationTables(dv){
    const root=dv.container.closest(".markdown-preview-view, .markdown-source-view")||dv.container.parentElement;
    if(!root)return;
    const cleanups=[];
    const decorate=()=>{
        for(const table of root.querySelectorAll("table.kino-recommendation-table")){
            if(table.dataset.kinoSortBound)continue;
            const body=table.tBodies[0],head=table.tHead?.rows[0];if(!body||!head)continue;
            table.dataset.kinoSortBound="true";
            table.style.cssText="width:1100px;min-width:1100px;max-width:none;table-layout:fixed;border-collapse:collapse;margin:0;font-size:var(--font-text-size)";
            const wrap=table.closest(".kino-recommendation-scroll");
            if(wrap)wrap.style.cssText="width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;margin:12px 0 24px";
            const widths=[260,190,100,110,440];
            table.querySelectorAll("col").forEach((col,i)=>col.style.width=`${widths[i]}px`);
            const rows=Array.from(body.rows).map((row,index)=>{
                const values=Array.from(row.cells).map((cell,i)=>{
                    cell.style.cssText="vertical-align:top;padding:9px 12px;border:1px solid var(--background-modifier-border);white-space:normal;overflow-wrap:break-word;line-height:1.45";
                    if(i===2||i===3){cell.style.textAlign="center";cell.style.fontWeight="600";const n=Number(cell.textContent.trim().replace(",","."));return cell.textContent.trim()&&!/^[-—]$/.test(cell.textContent.trim())&&Number.isFinite(n)?n:null;}
                    if(i===4&&!cell.dataset.kinoDescription){
                        const full=cell.textContent.trim();cell.dataset.kinoDescription="true";
                        if(full.length>280){
                            cell.textContent="";cell.createEl("div",{text:full.slice(0,277).trim()+"…"});
                            const details=cell.createEl("details");details.style.marginTop="6px";
                            details.createEl("summary",{text:"Полное описание"});details.createEl("div",{text:full});
                        }
                    }
                    return i===0?(cell.querySelector("a")?.textContent||cell.textContent).trim():cell.textContent.trim();
                });return {row,values,index};
            });
            let column=Number(table.dataset.kinoSortColumn??-1),direction=Number(table.dataset.kinoSortDirection)||1;
            const headers=Array.from(head.cells),buttons=[];
            const update=()=>{
                headers.forEach((cell,i)=>{
                    cell.setAttribute("aria-sort",column===i?(direction===1?"ascending":"descending"):"none");
                    buttons[i].textContent=`${buttons[i].dataset.label} ${column===i?(direction===1?"↑":"↓"):"↕"}`;
                });
            };
            headers.forEach((cell,i)=>{
                cell.style.cssText="text-align:left;vertical-align:middle;padding:10px 12px;border:1px solid var(--background-modifier-border);background:var(--background-secondary);white-space:normal";
                let button=cell.querySelector("button");
                if(!button){const label=cell.textContent.trim();cell.textContent="";button=cell.createEl("button");button.dataset.label=label;}
                button.type="button";button.title="Нажми для сортировки в обратном порядке";
                button.style.cssText="all:unset;display:block;width:100%;cursor:pointer;font:inherit;font-weight:600;line-height:1.4";
                const onClick=()=>{
                    direction=column===i?-direction:(i===2||i===3?-1:1);column=i;
                    for(const item of sortRows(rows,column,direction))body.appendChild(item.row);
                    table.dataset.kinoSortColumn=String(column);table.dataset.kinoSortDirection=String(direction);update();
                };
                button.addEventListener("click",onClick);cleanups.push(()=>button.removeEventListener("click",onClick));buttons.push(button);
            });
            update();cleanups.push(()=>delete table.dataset.kinoSortBound);
        }
    };
    decorate();
    // Catch tables rendered after this block. Row reorders and buttons do not trigger rescans.
    const observer=new MutationObserver(records=>{
        if(records.some(r=>Array.from(r.addedNodes).some(n=>n.nodeType===1&&
            (n.matches?.("table.kino-recommendation-table")||n.querySelector?.("table.kino-recommendation-table")))))decorate();
    });
    observer.observe(root,{childList:true,subtree:true});
    dv.component.register(()=>{observer.disconnect();for(const dispose of cleanups)dispose();});
};
module.exports.sortRows=sortRows;
