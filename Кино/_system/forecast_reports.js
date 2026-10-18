const ROOT = 'Кино/_system/Прогноз/reports';
const knownName = name => /^[a-f0-9]{12}-[a-f0-9]{20}\.json$/i.test(name);
function compactReport(report) {
    const next = {...report};
    if (report.dataVariants?.['155'] && JSON.stringify(report.data) === JSON.stringify(report.dataVariants['155'])) delete next.data;
    if (report.plotVariants?.embeddinggemma && JSON.stringify(report.plot) === JSON.stringify(report.plotVariants.embeddinggemma)) delete next.plot;
    return next;
}
async function referenced(app, onProgress, shouldCancel) {
    const result = new Set(), files = app.vault.getMarkdownFiles();
    for (let i = 0; i < files.length; i++) {
        if (shouldCancel?.()) throw Object.assign(Error('Очистка остановлена'), {name:'AbortError'});
        // Read source files: metadata may still point at the previous report.
        const raw = await app.vault.read(files[i]);
        for (const match of raw.matchAll(/[a-f0-9]{12}-[a-f0-9]{20}\.json/gi)) result.add(match[0].toLowerCase());
        if (i % 100 === 0) {onProgress?.({phase:'references',completed:i+1,total:files.length});await new Promise(resolve=>setTimeout(resolve,0));}
    }
    return result;
}
async function cleanup(params) {
    const {app, onProgress, shouldCancel} = params;
    if (app.__kinoForecastReportCleanup || (app.__kinoRatingUpdate && params.ratingUpdateToken !== app.__kinoRatingUpdate)) return {busy:true};
    const token={};app.__kinoForecastReportCleanup=token;
    const result={scanned:0,compacted:0,deleted:0,kept:0,recent:0,savedBytes:0,failed:[],cancelled:false};
    try {
        const queue=app.vault.getAbstractFileByPath('Кино/_system/Прогноз/queue.json');
        if(queue){const maintenance=JSON.parse(await app.vault.read(queue)).maintenance;if(maintenance?.token&&Date.parse(maintenance.expiresAt)>Date.now())return {busy:true};}
        let refs=await referenced(app,onProgress,shouldCancel);
        const folder=app.vault.getAbstractFileByPath(ROOT);
        const paths=folder?.children?folder.children.filter(file=>file.extension==='json').map(file=>file.path):(await app.vault.adapter.list(ROOT)).files;
        const entries=[];
        for(let i=0;i<paths.length;i++){
            if(shouldCancel?.()){result.cancelled=true;break;}
            const path=paths[i],name=path.slice(ROOT.length+1);
            if(!path.startsWith(ROOT+'/')||name.includes('/')||!knownName(name))continue;
            const file=app.vault.getAbstractFileByPath(path);if(!file)continue;
            result.scanned++;
            if(!refs.has(name.toLowerCase())){entries.push({path,name,mtime:file.stat?.mtime});continue;}
            result.kept++;
            try{
                const raw=await app.vault.read(file),report=JSON.parse(raw),next=JSON.stringify(compactReport(report));
                if(!report.final||!report.target||(!report.data&&!report.dataVariants))throw Error('Неизвестный формат отчёта');
                if(next!==JSON.stringify(report)){
                    await app.vault.process(file,current=>{if(current!==raw)throw Error('Отчёт изменился во время очистки');return next;});
                    result.compacted++;result.savedBytes+=new TextEncoder().encode(raw).length-new TextEncoder().encode(next).length;
                }
            }catch(error){result.failed.push({path,error:String(error.message||error)});}
            onProgress?.({phase:'compacting',completed:i+1,total:paths.length});
            if(i%20===0)await new Promise(resolve=>setTimeout(resolve,0));
        }
        if(!result.cancelled&&entries.length){
            refs=await referenced(app,onProgress,shouldCancel);
            for(let i=0;i<entries.length;i++){
                if(shouldCancel?.()){result.cancelled=true;break;}
                const entry=entries[i],file=app.vault.getAbstractFileByPath(entry.path);
                if(!file||refs.has(entry.name.toLowerCase()))continue;
                // Protect a just-created report whose card has not been saved yet.
                if(file.stat?.mtime!==entry.mtime||!Number.isFinite(file.stat?.mtime)||Date.now()-file.stat.mtime<60000){result.recent++;continue;}
                try{
                    const raw=await app.vault.read(file),report=JSON.parse(raw);
                    if(!report.target||!report.final)throw Error('Неизвестный формат отчёта');
                    if(app.vault.trash)await app.vault.trash(file,true);else await app.vault.delete(file);
                    result.deleted++;result.savedBytes+=new TextEncoder().encode(raw).length;
                }catch(error){result.failed.push({path:entry.path,error:String(error.message||error)});}
                onProgress?.({phase:'deleting',completed:i+1,total:entries.length});
            }
        }
        return result;
    }catch(error){if(error.name==='AbortError'){result.cancelled=true;return result;}throw error;}
    finally{if(app.__kinoForecastReportCleanup===token)delete app.__kinoForecastReportCleanup;}
}
module.exports={compactReport,cleanup};
