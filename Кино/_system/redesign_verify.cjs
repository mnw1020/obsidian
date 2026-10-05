'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),backupDir=path.join(__dirname,'redesign-backups');
const norm=s=>s.replace(/\r\n/g,'\n');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function run(){
    const manifestName=fs.readdirSync(backupDir).filter(n=>/^baseline-.*\.json$/.test(n)).sort()[0];
    const manifest=JSON.parse(fs.readFileSync(path.join(backupDir,manifestName),'utf8'));
    const zip=await require('jszip').loadAsync(fs.readFileSync(manifest.archive));
    const before=async rel=>zip.file('Кино/'+rel).async('string');
    const current=rel=>fs.readFileSync(path.join(root,rel),'utf8');
    const assert=(condition,message)=>{if(!condition)throw Error(message);};
    const baseOld=norm(await before('_Кино.base')),baseNow=norm(current('_Кино.base'));
    assert(baseOld.split(/^views:\s*$/m)[0]===baseNow.split(/^views:\s*$/m)[0],'Changed Base filters/formulas/properties');
    const viewNames=s=>[...s.matchAll(/^    name:\s*(.+)$/gm)].map(m=>m[1]);
    for(const name of viewNames(baseOld))assert(viewNames(baseNow).includes(name),'Missing Base view '+name);
    assert(viewNames(baseNow).includes('Карточки'),'All-media grid missing');
    const buttons=s=>Object.fromEntries([...s.matchAll(/```button\s*\n([\s\S]*?)\n```\s*\n\^(button-[^\s]+)/g)].map(m=>[m[2],m[1].match(/^action (.+)$/m)?.[1]]));
    const oldButtons=buttons(norm(await before('_index.md'))),nowButtons=buttons(norm(current('_index.md')));
    for(const [id,action]of Object.entries(oldButtons))assert(nowButtons[id]===action,'Changed button action '+id);
    const untouched=['_system/ai_core.js','_system/ai_crypto.js','_system/openai_recommendations.js','Просмотры/_Просмотры.base','Сезоны/_Сезоны.base'];
    for(const rel of untouched)assert(hash(fs.readFileSync(path.join(root,rel)))===manifest.files[rel].sha256,'Changed protected logic/base '+rel);
    const files=fs.readdirSync(__dirname).filter(n=>n.endsWith('.js'));
    for(const name of files){const source=current('_system/'+name);try{if(name==='recommendations.js')new AsyncFunction('dv','app','obsidian','require',source);else new Function('module','exports',source);}catch(e){throw Error('Script syntax: '+name+': '+e.message);}}
    let blocks=0;
    for(const rel of require('./redesign_migrate.cjs').targets()){
        const source=current(rel);
        for(const match of source.matchAll(/^```dataviewjs[^\r\n]*\r?\n([\s\S]*?)^```[ \t]*\r?$/gm)){
            try{new AsyncFunction('dv','app','obsidian','require',match[1]);}catch(e){throw Error('Dataview syntax: '+rel+': '+e.message);}blocks++;
        }
    }
    const originalRecommendations=await before('_system/Рекомендации.md');
    const payload=s=>s.match(/<!-- KINO:RECOMMENDATION-DETAILS:START -->[\s\S]*?<!-- KINO:RECOMMENDATION-DETAILS:END -->/)?.[0]||'';
    assert(payload(originalRecommendations)===payload(current('_system/Рекомендации.md')),'Saved recommendation results changed');
    const report={scriptsChecked:files.length,dataviewBlocksChecked:blocks,existingBaseViews: viewNames(baseOld).length,currentBaseViews:viewNames(baseNow).length,buttonActionsPreserved:Object.keys(oldButtons).length,aiLogicUnchanged:true,savedRecommendationsUnchanged:true};
    fs.writeFileSync(path.join(backupDir,'interface-verification.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report));
}
run().catch(e=>{console.error(e.message);process.exitCode=1;});
