const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const update=require('../update_ratings.js'),predict=require('../predict_rating.js');
function fixture(count=36){
    const files=Array.from({length:count},(_,i)=>({path:`Кино/Media/Фильм ${i}.md`,basename:`Фильм ${i}`,extension:'md',fm:{tags:[i%4?'movies':'serial'],Оценка:5+i%5,Жанр:['Drama',i%2?'Action':'Comedy'],Режисер:['Director '+i%5],Описание:'A story about life and family '+i,Релиз:'2000-01-01','Оценка Imdb':7,'Оценка Кинопоиск':7.5,'Количество просмотров':1}}));
    const writes=[],notices=[],content=fs.readFileSync(path.join(__dirname,'../predict_rating.js'),'utf8');
    let active=files[0];
    const app={vault:{getMarkdownFiles:()=>files,getAbstractFileByPath:p=>p.endsWith('predict_rating.js')?{path:p}:files.find(f=>f.path===p),read:async()=>content},metadataCache:{getFileCache:f=>({frontmatter:f.fm})},workspace:{getActiveFile:()=>active},fileManager:{processFrontMatter:async(file,callback)=>{writes.push(file.path);callback(file.fm);}}};
    class Notice{constructor(text){notices.push(text);}setMessage(){}hide(){}}
    return {app,files,writes,notices,obsidian:{Notice},active:file=>active=file};
}
test('context command updates only the active card, matches the existing forecast and preserves personal ratings',async()=>{
    const t=fixture(),before=JSON.parse(JSON.stringify(t.files.map(f=>f.fm)));
    const estimate=await predict({app:t.app,obsidian:t.obsidian,suppressNotice:true});
    const expected=estimate.prediction;delete t.files[0].fm['Прогноз оценки'];t.writes.length=0;
    const result=await update(t);assert.equal(result.updated,1);assert.deepEqual(t.writes,[t.files[0].path]);assert.equal(+t.files[0].fm['Прогноз оценки'],expected);
    for(let i=0;i<t.files.length;i++){const fm={...t.files[i].fm};delete fm['Прогноз оценки'];assert.deepEqual(fm,before[i]);}
    const original=t.files[0].fm.Оценка;t.files[0].fm.Оценка=10;
    const same=await predict({app:t.app,obsidian:t.obsidian,forecastFiles:[t.files[0]]});assert.equal(same.results[0].prediction,expected,'Target personal score cannot train its own forecast');t.files[0].fm.Оценка=original;
});
test('audit context and explicit button scope update all cards, skip unchanged predictions and prevent accidental global runs',async()=>{
    const t=fixture();t.active({path:'Кино/_system/Проверка кинотеки.md'});
    const result=await update(t);assert.equal(result.updated,t.files.length);assert.equal(result.failed.length,0);assert.equal(new Set(t.writes).size,t.files.length);
    const next=await update({...t,scope:'all'});assert.equal(next.unchanged,t.files.length);assert.equal(next.updated,0);
    t.active({path:'Кино/_index.md'});const none=await update(t);assert.equal(none.total,0);assert.equal(t.writes.length,t.files.length);assert.equal(t.app.__kinoRatingUpdate,undefined);
});
test('insufficient training, cancellation, write failures and concurrent invocation leave unrelated data untouched',async()=>{
    const short=fixture(10);const insufficient=await update({...short,scope:'all'});assert.equal(insufficient.failed.length,10);assert.equal(short.writes.length,0);
    const cancel=fixture();const stopped=await update({...cancel,scope:'all',shouldCancel:()=>true});assert.equal(stopped.cancelled,true);assert.equal(cancel.writes.length,0);assert.equal(cancel.app.__kinoRatingUpdate,undefined);
    const failed=fixture();failed.app.fileManager.processFrontMatter=async()=>{throw Error('Read only file');};const failures=await update(failed);assert.equal(failures.failed.length,1);assert.equal(failed.app.__kinoRatingUpdate,undefined);
    const busy=fixture();let resume;busy.app.vault.read=()=>new Promise(resolve=>resume=resolve);const running=update(busy);const blocked=await update(busy);assert.equal(blocked.busy,true);resume(fs.readFileSync(path.join(__dirname,'../predict_rating.js'),'utf8'));await running;
});
test('recommendation forecasts remain read-only and registered QuickAdd settings are adopted idempotently',async()=>{
    const t=fixture();const result=await predict({app:t.app,obsidian:t.obsidian,forecastCandidates:[{localPath:t.files[0].path,storedPrediction:8.5}]});assert.deepEqual(result,[8.5]);assert.equal(t.writes.length,0);
    const choice={id:update.CHOICE_ID,name:update.CHOICE,command:true};let registrations=0;
    t.app.plugins={plugins:{quickadd:{settings:{choices:[]},loadData:async()=>({choices:[choice]}),addCommandForChoice:c=>{assert.equal(c,choice);registrations++;}}}};
    await Promise.all([update.ensureCommand(t.app),update.ensureCommand(t.app)]);assert.equal(registrations,1);assert.equal(t.app.plugins.plugins.quickadd.settings.choices.length,1);
});
test('the new context command is saved and enabled in Obsidian QuickAdd without duplicate choices',()=>{
    const config=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../.obsidian/plugins/quickadd/data.json'),'utf8'));
    const choices=config.choices.filter(choice=>choice.name===update.CHOICE);assert.equal(choices.length,1);assert.equal(choices[0].command,true);
    assert.equal(choices[0].id,update.CHOICE_ID);assert.equal(choices[0].macro.commands[0].path,'Кино/_system/update_ratings.js');
});
