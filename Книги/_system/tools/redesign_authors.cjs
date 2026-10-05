// Replace only author presentation blocks; preserve frontmatter and personal notes.
const fs=require('node:fs'),path=require('node:path'),pages=require('../author_pages.js');
const root=path.resolve(__dirname,'../..'),backup=path.join(root,'_system/backups/author-redesign');
const jobs=[{file:path.join(root,'_system/Авторы.md'),merge:pages.mergeOverview}];
const folder=path.join(root,'_system/Авторы');
if(fs.existsSync(folder))for(const entry of fs.readdirSync(folder,{withFileTypes:true}))if(entry.isFile()&&entry.name.endsWith('.md'))jobs.push({file:path.join(folder,entry.name),merge:pages.mergeAuthor});
let changed=0;
for(const {file,merge} of jobs){
 if(!fs.existsSync(file))continue;
 const original=fs.readFileSync(file,'utf8'),next=merge(original);
 if(next===original)continue;
 const relative=path.relative(root,file),target=path.join(backup,relative+'.before');
 if(fs.readFileSync(file,'utf8')!==original)throw new Error('Concurrent edit: '+relative);
 fs.mkdirSync(path.dirname(target),{recursive:true});
 if(!fs.existsSync(target))fs.writeFileSync(target,original,'utf8');
 fs.writeFileSync(file,next,'utf8');changed++;
}
console.log(`Author pages updated: ${changed}. Properties and personal notes preserved.`);
