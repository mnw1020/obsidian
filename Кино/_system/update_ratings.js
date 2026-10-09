// QuickAdd: context-aware local forecasts for analytics and recommendations.
const CHOICE = 'Кино - Обновить оценки';
const CHOICE_ID = '7be5f7b8-4f71-43fb-a923-296575e2ca10';
const AUDIT = 'Кино/_system/Проверка кинотеки.md';
function isMedia(app,file) {
    if (!file || !/^Кино\/Media\/[^/]+\.md$/i.test(file.path)) return false;
    const raw=app.metadataCache.getFileCache(file)?.frontmatter?.tags || [];
    return (Array.isArray(raw)?raw:[raw]).some(tag=>['movies','serial'].includes(String(tag).replace(/^#/,'')));
}
async function update(params) {
    const {app,obsidian={}}=params;
    if (app.__kinoRatingUpdate) return {busy:true};
    const active=params.targetFile || app.workspace.getActiveFile();
    const requested=params.scope || params.variables?.kinoRatingScope;
    const all=requested==='all' || (!requested && active?.path===AUDIT);
    const files=all?app.vault.getMarkdownFiles().filter(file=>isMedia(app,file)):isMedia(app,active)?[active]:[];
    const result={total:files.length,updated:0,unchanged:0,failed:[],cancelled:false};
    const notify=message=>{if(!params.suppressNotice&&obsidian.Notice)new obsidian.Notice(message,9000);};
    if (!files.length) {notify('Открой карточку фильма/сериала или «Проверку кинотеки».');return result;}
    const token={};app.__kinoRatingUpdate=token;
    let notice;
    const progress=value=>{params.onProgress?.(value);notice?.setMessage((value.phase==='predicting'?'Расчёт прогнозов':'Запись прогнозов')+': '+value.completed+' / '+value.total);};
    try {
        if(!params.suppressNotice&&obsidian.Notice)notice=new obsidian.Notice('Обновление прогнозов: '+files.length+' карточек…',0);
        const script=app.vault.getAbstractFileByPath('Кино/_system/predict_rating.js');
        if(!script)throw Error('Не найден расчёт прогнозов');
        const mod={exports:{}};new Function('module',await app.vault.read(script))(mod);
        const estimates=await mod.exports({app,obsidian,forecastFiles:files,onProgress:progress,shouldCancel:params.shouldCancel,suppressNotice:true});
        if(estimates.cancelled){result.cancelled=true;notify('Обновление отменено до записи прогнозов.');return result;}
        for(let index=0;index<estimates.results.length;index++) {
            if(params.shouldCancel?.()){result.cancelled=true;break;}
            const estimate=estimates.results[index];
            if(estimate.error){result.failed.push({path:estimate.file?.path||estimate.path,error:estimate.error});continue;}
            try {
                const fm=app.metadataCache.getFileCache(estimate.file)?.frontmatter || {};
                const old=fm['Прогноз оценки'];
                const value=estimate.prediction.toFixed(1);
                if(old!=null&&String(old).trim()!==''&&Number(String(old).replace(',','.'))===estimate.prediction)result.unchanged++;
                else {await app.fileManager.processFrontMatter(estimate.file,frontmatter=>{frontmatter['Прогноз оценки']=value;});result.updated++;}
            }catch(error){result.failed.push({path:estimate.file.path,error:String(error?.message||error)});}
            progress({phase:'writing',completed:index+1,total:files.length});
            if((index+1)%5===0)await new Promise(resolve=>setTimeout(resolve,0));
        }
        notify((result.cancelled?'Остановлено. ':'Готово. ')+'Прогнозов обновлено: '+result.updated+', без изменений: '+result.unchanged+', ошибок: '+result.failed.length+'.');
        return result;
    }finally{notice?.hide();if(app.__kinoRatingUpdate===token)delete app.__kinoRatingUpdate;}
}
// New settings are also adopted by an already-running QuickAdd when the report
// is opened. This does not save or replace any other plugin settings.
async function ensureCommand(app) {
    const plugin=app.plugins?.plugins?.quickadd;
    if(!plugin?.settings?.choices || !plugin.addCommandForChoice)return;
    const find=choices=>{for(const choice of choices||[]){if(choice.id===CHOICE_ID||choice.name===CHOICE)return choice;const nested=find(choice.choices);if(nested)return nested;}return null;};
    if(find(plugin.settings.choices))return;
    const saved=await plugin.loadData?.();const choice=find(saved?.choices);
    if(choice){plugin.settings.choices.push(choice);plugin.addCommandForChoice(choice);}
}
module.exports=update;
module.exports.ensureCommand=ensureCommand;
module.exports.CHOICE=CHOICE;
module.exports.CHOICE_ID=CHOICE_ID;
