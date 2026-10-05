// Convert registered ideas to quotes, retaining every excerpt id, field, date and body.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),knowledge=require('../knowledge.js');
const root=path.resolve(__dirname,'../..'),backup=path.join(root,'_system/backups/quotes-only');
let changed=0,converted=0;
function scan(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){const full=path.join(folder,entry.name);if(entry.isDirectory()){scan(full);continue;}if(!entry.name.endsWith('.md'))continue;
 const raw=fs.readFileSync(full,'utf8'),original=knowledge.parseExcerpts(raw),lines=raw.split(/(?<=\n)/);let count=0;
 for(const quote of original){const line=lines[quote.line];if(!/^>\s*\[!idea\]/i.test(line))continue;lines[quote.line]=line.replace(/\[!idea\]/i,'[!quote]').replace(/(\[!quote\][+-]?\s+)Идея(?=\r?\n|$)/,'$1Цитата');count++;}
 if(!count)continue;
 const next=lines.join('');assert.deepEqual(knowledge.parseExcerpts(next),original,'Excerpt data must not change');
 const saved=path.join(backup,path.relative(root,full)+'.before');fs.mkdirSync(path.dirname(saved),{recursive:true});if(!fs.existsSync(saved))fs.writeFileSync(saved,raw,'utf8');
 if(fs.readFileSync(full,'utf8')!==raw)throw new Error('Concurrent edit: '+full);
 fs.writeFileSync(full,next,'utf8');changed++;converted+=count;
}}
for(const folder of ['Художественные','Non-fiction','Цитаты'])scan(path.join(root,folder));
console.log(`Converted ${converted} registered ideas in ${changed} files. Text, metadata, dates and block links preserved.`);
