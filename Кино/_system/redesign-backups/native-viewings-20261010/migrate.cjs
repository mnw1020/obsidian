'use strict';
// One-off conversion: source history is read only; summary properties are untouched.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),layout=require('../../card_layout.js');
const digest=text=>crypto.createHash('sha256').update(text).digest('hex');
function field(yaml,key){
    const lines=yaml.replace(/\r\n/g,'\n').split('\n'),index=lines.findIndex(line=>line.startsWith(key+':'));
    if(index<0)return null;
    const value=lines[index].slice(key.length+1).trim();
    if(value==='|-'||value==='|'||value==='|+'){
        const body=[];for(let i=index+1;i<lines.length&&(lines[i].startsWith('  ')||!lines[i]);i++)body.push(lines[i].replace(/^  /,''));
        return body.join('\n').replace(/\n+$/,'');
    }
    if(value.startsWith('"'))return JSON.parse(value);
    if(value.startsWith("'")&&value.endsWith("'"))return value.slice(1,-1).replace(/''/g,"'");
    if(!value||value==='null')return null;
    if(/^[|>]/.test(value))throw Error('Unsupported history YAML field '+key);
    return value;
}
const groups=new Map(),sources=[];
for(const folder of ['Просмотры','Сезоны'])for(const name of fs.readdirSync(path.join(root,folder)).filter(name=>name.endsWith('.md')&&name!=='_index.md')){
    const relative=folder+'/'+name,raw=fs.readFileSync(path.join(root,relative),'utf8');sources.push({path:relative,sha256:digest(raw)});
    if(folder!=='Просмотры')continue;
    const yaml=layout.splitRaw(raw).yaml,reference=String(field(yaml,'Фильм')||'').match(/^\[\[(Кино\/Media\/[^|\]]+)(?:\|[^\]]+)?\]\]$/);
    assert.ok(reference,'Canonical viewing link: '+relative);
    const media=reference[1].replace(/^Кино\//,'').replace(/\.md$/,'')+'.md';
    const number=Number(field(yaml,'Просмотр')),value=field(yaml,'Оценка'),rating=value==null?null:Number(String(value).replace(',','.'));
    assert.ok(Number.isInteger(number)&&number>0);assert.ok(rating===null||Number.isFinite(rating));
    const row={number,date:field(yaml,'Дата'),year:field(yaml,'Год'),rating,comment:field(yaml,'Комментарий')||''};
    if(!groups.has(media))groups.set(media,[]);groups.get(media).push(row);
}
const plan=[];
for(const [relative,rows] of groups){
    const file=path.join(root,relative),before=fs.readFileSync(file,'utf8'),history=layout.viewingHistory(rows);
    const after=layout.rebuildCard(before,history),oldParts=layout.splitRaw(before),newParts=layout.splitRaw(after);
    assert.equal(newParts.yaml,oldParts.yaml,'All original YAML bytes retained');
    const poster=field(oldParts.yaml,'poster');
    assert.equal(layout.personalBody(oldParts.body,poster),layout.personalBody(newParts.body,poster),'Personal Markdown retained');
    assert.ok(!after.includes('FROM "Кино/Просмотры"'),'Legacy history query removed');
    assert.ok(after.trimEnd().endsWith('![]('+poster+')'),'Poster last');
    for(const row of rows)if(row.comment)assert.ok(after.replace(/\r\n/g,'\n').includes(String(row.comment).trim()),'Complete source comment retained');
    assert.equal(layout.rebuildCard(after,history),after,'Repeated conversion unchanged');
    plan.push({file,relative,before,after,records:rows.length});
}
if(process.argv[2]==='apply'){
    // Validate every planned file before writing either one.
    for(const item of plan)assert.equal(fs.readFileSync(item.file,'utf8'),item.before);
    for(const item of plan)if(item.after!==item.before)fs.writeFileSync(item.file,item.after);
}
for(const source of sources)assert.equal(digest(fs.readFileSync(path.join(root,source.path),'utf8')),source.sha256,'Source history unchanged');
const report={mode:process.argv[2]==='apply'?'apply':'dry-run',cards:plan.map(item=>({path:item.relative,records:item.records,changed:item.before!==item.after})),sourceRecords:sources,frontmatterPreserved:true,personalMarkdownPreserved:true,postersLast:true};
fs.writeFileSync(path.join(__dirname,'migration-'+report.mode+'.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
