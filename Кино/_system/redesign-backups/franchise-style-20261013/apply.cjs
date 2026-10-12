'use strict';
// One-off: supply the shared renderer only where it is missing. Other franchise
// notes and all generated tables remain byte-for-byte unchanged.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const system=path.resolve(__dirname,'../..'),root=path.resolve(system,'..');
const layout=require(path.join(system,'card_layout.js'));
const reportPath=path.join(__dirname,'verification.json');
if(fs.existsSync(reportPath))throw Error('Franchise presentation migration already completed. Do not repeat.');
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
const dir=path.join(root,'Франшизы'),names=fs.readdirSync(dir).filter(name=>name.endsWith('.md')).sort();
const snapshots=names.map(name=>({name,raw:fs.readFileSync(path.join(dir,name),'utf8')}));
const queries=raw=>[...raw.matchAll(/<!-- FRANCHISE:TABLE:v1 -->[\s\S]*?```dataviewjs\r?\n([\s\S]*?)\r?\n```/g)].map(match=>match[1]);
const withoutUI=body=>body.replace(/<!-- KINO:UI:START -->[\s\S]*?<!-- KINO:UI:END -->/g,'').trim();
const changed=[];
for(const {name,raw}of snapshots){
    if(raw.includes('<!-- KINO:UI:START -->'))continue;
    const next=layout.ensureLayout(raw,{kind:'franchise'}),before=layout.splitRaw(raw),after=layout.splitRaw(next);
    if(before.yaml!==after.yaml||withoutUI(before.body)!==withoutUI(after.body)||JSON.stringify(queries(raw))!==JSON.stringify(queries(next)))throw Error('Unexpected source change: '+name);
    const backup=path.join(__dirname,'before','Франшизы',name);fs.mkdirSync(path.dirname(backup),{recursive:true});fs.writeFileSync(backup,raw,'utf8');
    fs.writeFileSync(path.join(dir,name),next,'utf8');changed.push(name);
}
const report={date:'2026-10-13',franchises:names.length,changed,unchanged:names.length-changed.length,notes:[]};
for(const {name,raw}of snapshots){
    const next=fs.readFileSync(path.join(dir,name),'utf8');
    if(JSON.stringify(queries(raw))!==JSON.stringify(queries(next)))throw Error('Franchise query changed: '+name);
    if((next.match(/<!-- KINO:UI:START -->/g)||[]).length!==1)throw Error('Renderer missing or duplicated: '+name);
    report.notes.push({name,beforeSHA256:sha(raw),afterSHA256:sha(next),queriesPreserved:true});
}
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({franchises:report.franchises,changed,unchanged:report.unchanged,queriesPreserved:true}));
