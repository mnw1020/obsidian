// Import the original six sections as explicitly indexed excerpts, keeping sources and dates honest.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const knowledge=require('../knowledge.js'),root=path.resolve(__dirname,'../..');
const originalPath=path.join(root,'Цитата.md'),backup=path.join(root,'_system/backups/legacy-quotes/Цитата.md.before');
const current=fs.readFileSync(originalPath,'utf8');
const original=fs.existsSync(backup)?fs.readFileSync(backup,'utf8'):current;
const headings=[...original.matchAll(/^## (.+)\r?$/gm)];
assert.equal(headings.length,6,'Expected the six original quote sections');
const themes={
 'Вера - это':['убеждения','мышление'],
 'Женщина и гордость':['отношения','гордость'],
 'Забавно':['юмор'],
 'Мотивация':['мотивация'],
 'Объяснительная':['юмор','работа'],
 'Слишком много сладкого':['воспитание','видеоигры']
};
const motivation=[['сон'],['успех'],['планирование'],['ритм жизни'],['утро'],['эксперименты'],['прокрастинация'],['действие'],['неудачи'],['общение'],['вина','тревога']];
const outputs=[];let total=0;
for(let i=0;i<headings.length;i++){
 const title=headings[i][1],section=original.slice(headings[i].index,i+1<headings.length?headings[i+1].index:original.length);
 const lines=section.split(/\r?\n/),start=lines.findIndex(line=>/^> \[!quote\]/.test(line));assert(start>=0,title);
 const body=[];for(let j=start+1;j<lines.length&&/^>/.test(lines[j]);j++)body.push(lines[j].replace(/^> ?/,''));
 const text=body.join('\n').trim();
 const fragments=['Забавно','Мотивация'].includes(title)?text.split(/\n[ \t]*\n/).map(value=>value.trim()).filter(Boolean):[text];
 assert.equal(fragments.length,title==='Мотивация'?11:title==='Забавно'?3:1,title);
 const excerpts=fragments.map((text,index)=>({type:'quote',text,
  id:'book-excerpt-legacy-'+createHash('sha256').update(title+'\0'+index+'\0'+text).digest('hex').slice(0,20),
  themes:[...themes[title],...(title==='Мотивация'?motivation[index]:[])]}));
 const authors=title==='Женщина и гордость'?['Сергей Стиллавин']:[];
 const contents=['---','note_type: excerpt_collection',`title: ${JSON.stringify(title)}`,`authors: ${JSON.stringify(authors)}`,'cssclasses:','  - book-knowledge','obsidianUIMode: preview','---','',`# ${title}`,'',...excerpts.map(entry=>knowledge.renderExcerpt(entry))].join('\n');
 const parsed=knowledge.parseExcerpts(contents);
 assert.deepEqual(parsed.map(entry=>entry.text),fragments,'Quote text must remain exact');
 assert(parsed.every(entry=>!entry.savedDate),'Legacy saving dates are unknown');
 total+=parsed.length;outputs.push({filename:path.join(root,'Цитаты',title+'.md'),contents});
}
assert.equal(total,18);
const redirect=['# 💬 Цитаты','', '[[Книги/Цитаты/_Идеи и цитаты|Открыть идеи и цитаты]]','',...headings.flatMap(heading=>[`## ${heading[1]}`,'',`[[Книги/Цитаты/${heading[1]}|Открыть раздел]]`,''])].join('\n');
// Validate every target before the first write. Never replace manual changes in imported collections.
for(const {filename,contents} of outputs)if(fs.existsSync(filename)&&fs.readFileSync(filename,'utf8')!==contents)throw new Error('Imported collection was edited; preserved: '+filename);
if(fs.readFileSync(originalPath,'utf8')!==current)throw new Error('The source changed during import');
if(!fs.existsSync(backup)){fs.mkdirSync(path.dirname(backup),{recursive:true});fs.writeFileSync(backup,original,'utf8');}
fs.mkdirSync(path.join(root,'Цитаты'),{recursive:true});
let changed=0;for(const {filename,contents} of outputs)if(!fs.existsSync(filename)){fs.writeFileSync(filename,contents,'utf8');changed++;}
if(current!==redirect){fs.writeFileSync(originalPath,redirect,'utf8');changed++;}
console.log(`Imported ${total} quotes in ${outputs.length} collections. Changed files: ${changed}. Text verified; legacy anchors retained; dates not invented.`);
