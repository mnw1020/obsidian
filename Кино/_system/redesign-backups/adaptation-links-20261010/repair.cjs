'use strict';
// Add reciprocal properties only for explicit, reviewed links already in personal notes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const vault=path.resolve(__dirname,'../../../..'),root=path.join(vault,'Кино');
const {fromText}=require(path.join(vault,'Книги/_system/tests/yaml_fixture.cjs'));
const core=require(path.join(vault,'Книги/_system/book_core.js'))({app:{},obsidian:{}}),layout=require('../../card_layout.js');
const plan=JSON.parse(fs.readFileSync(path.join(__dirname,'data-audit-plan.json'),'utf8'));
const fields=['adaptations','Первоисточники','adapted_from','related'];
const selected=raw=>{const yaml=layout.splitRaw(raw).yaml;return fromText('---\n'+[...yaml.matchAll(/^(?:adaptations|Первоисточники|adapted_from|related):[^\r\n]*(?:\r?\n[ \t]+-[^\r\n]*)*/gm)].map(m=>m[0]).join('\n')+'\n---\n');};
const list=value=>[].concat(value||[]).map(String);
const canonical=value=>String(value).replace(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/,'$1').replace(/\.md$/i,'');
const hash=raw=>crypto.createHash('sha256').update(raw).digest('hex');
const notes=new Map();
function read(target){
    assert.ok(/^(?:Кино\/Media\/|Книги\/Художественные\/)/.test(target),'Only reviewed main notes');
    if(notes.has(target))return notes.get(target);
    const file=path.resolve(vault,target+'.md');assert.ok(file.startsWith(vault+path.sep));
    const raw=fs.readFileSync(file,'utf8'),note={target,file,raw,fm:selected(raw),updates:{}};notes.set(target,note);return note;
}
function add(source,property,target){
    const current=source.updates[property]||list(source.fm[property]);
    if(!current.some(value=>canonical(value)===target))source.updates[property]=[...current,'[['+target+']]'];
}
for(const relation of plan.recommendedAdditions){
    // The evidence must still be present when the conversion runs.
    for(const evidence of relation.evidence)assert.ok(fs.readFileSync(path.join(vault,evidence.file+'.md'),'utf8').replace(/\r\n/g,'\n').includes(evidence.text),'Evidence retained: '+evidence.file);
    const book=read(relation.book),media=read(relation.media);
    if(relation.recommendedRelation==='adaptation'){add(book,'adaptations',media.target);add(media,'Первоисточники',book.target);}
    else{assert.equal(relation.recommendedRelation,'related');add(book,'related',media.target);add(media,'related',book.target);}
}
function withoutChanged(yaml,keys){
    for(const key of keys)yaml=yaml.replace(new RegExp('^'+key+':[^\\r\\n]*(?:\\r?\\n[ \\t]+-[^\\r\\n]*)*(?:\\r?\\n|$)','gm'),'');
    return yaml.trimEnd();
}
for(const note of notes.values()){
    note.next=core.patchProperties(note.raw,note.updates);
    const before=layout.splitRaw(note.raw),after=layout.splitRaw(note.next);
    assert.equal(after.body,before.body,'All personal Markdown, recommendation actions and posters retained: '+note.target);
    assert.equal(withoutChanged(after.yaml,Object.keys(note.updates)),withoutChanged(before.yaml,Object.keys(note.updates)),'All other YAML retained: '+note.target);
    const fresh=selected(note.next);
    for(const property of fields)for(const value of list(note.fm[property]))assert.ok(list(fresh[property]).includes(value),'Existing relation retained');
}
const changed=[...notes.values()].filter(note=>note.next!==note.raw);
if(process.argv.includes('--apply')){
    for(const note of changed)assert.equal(fs.readFileSync(note.file,'utf8'),note.raw,'Concurrent edit; stop before first write');
    for(const note of changed){const backup=path.join(__dirname,'data-before',note.target+'.md');fs.mkdirSync(path.dirname(backup),{recursive:true});if(!fs.existsSync(backup))fs.writeFileSync(backup,note.raw);}
    for(const note of changed){assert.equal(fs.readFileSync(note.file,'utf8'),note.raw,'Concurrent edit; preserve newer version');fs.writeFileSync(note.file,note.next);}
}
const result={mode:process.argv.includes('--apply')?'apply':'dry-run',reviewedPairs:plan.recommendedAdditions.length,adaptations:plan.recommendedAdditions.filter(r=>r.recommendedRelation==='adaptation').length,related:plan.recommendedAdditions.filter(r=>r.recommendedRelation==='related').length,changedFiles:changed.map(note=>({path:note.target+'.md',properties:Object.keys(note.updates),before:hash(note.raw),after:hash(note.next)})),personalMarkdownPreserved:true,unrelatedYamlPreserved:true,existingRelationsPreserved:true};
fs.writeFileSync(path.join(__dirname,'repair-'+result.mode+'.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
