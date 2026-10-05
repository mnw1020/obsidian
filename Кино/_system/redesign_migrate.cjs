'use strict';
// Offline migration. The normal Obsidian renderers use Obsidian's full YAML parser.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const backupDir = path.join(__dirname, 'redesign-backups');
const layout = () => require('./card_layout.js');
const normalize = text => String(text).replace(/\r\n/g, '\n').replace(/^\uFEFF/, '');

function split(text) {
    const match = String(text).match(/^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    return match ? { yaml: match[1], body: text.slice(match[0].length) } : { yaml: '', body: text };
}
function scalar(value) {
    value = value.trim();
    if (value.startsWith('"')) { try { return JSON.parse(value); } catch (_) {} }
    if (value.startsWith("'") && value.endsWith("'")) return value.slice(1,-1).replace(/''/g,"'");
    return value;
}
function briefYaml(yaml) {
    const result = {};
    const poster = String(yaml).match(/^poster:[ \t]*(.*)$/m);
    if (poster) result.poster = scalar(poster[1]);
    const classes = normalize(yaml).match(/^cssclasses:[ \t]*(.*)(?:\n((?:[ \t]+.*(?:\n|$)|\n)*))?/m);
    if (classes) {
        const inline = classes[1].trim();
        result.cssclasses = inline.startsWith('[')
            ? inline.slice(1, inline.lastIndexOf(']')).split(',').map(scalar).filter(Boolean)
            : inline ? scalar(inline) : (classes[2] || '').split('\n').filter(s => /^\s+-\s+/.test(s)).map(s => scalar(s.replace(/^\s+-\s+/,'')));
    }
    return result;
}
function withoutClasses(yaml) {
    return normalize(yaml).replace(/^cssclasses:[^\n]*(?:\n(?:[ \t]+[^\n]*|[ \t]*$))*/gm, '').trim();
}
function withoutUi(body) {
    return normalize(body).replace(/<!-- KINO:UI:START -->[\s\S]*?<!-- KINO:UI:END -->\n?/g,'').trim();
}
function withoutStandardPoster(body,poster) {
    if (!poster || ['N/A','null','undefined'].includes(poster)) return body.trim();
    const lines=body.split('\n');
    for(let i=lines.length-1;i>=0;i--) if(lines[i].trim()==='![]('+poster+')'){lines[i]='';break;}
    return lines.join('\n').trim();
}
function kindFor(rel) {
    if (rel.startsWith('Media/')) return 'media';
    if (rel.startsWith('Франшизы/')) return 'franchise';
    if (rel.startsWith('Просмотры/')) return 'viewing';
    if (rel.startsWith('Сезоны/')) return 'season';
    if (rel.startsWith('_system/Роли/')) return 'roles';
    if (rel.startsWith('_system/') && ['Актер.md','Жанр.md','Режиссер.md'].includes(path.basename(rel))) return 'entity';
    return 'system';
}
function targets() {
    const result = [];
    for (const dir of ['Media','Франшизы','Просмотры','Сезоны','_system/Роли','_system']) {
        for (const name of fs.readdirSync(path.join(root,dir))) {
            const rel = dir+'/'+name;
            if (!name.endsWith('.md') || name === 'Редизайн — прогресс.md') continue;
            if (fs.statSync(path.join(root,rel)).isFile()) result.push(rel);
        }
    }
    return result.sort();
}
function assertRetained(original, updated, rel, options = {}) {
    const a=split(original), b=split(updated);
    const personKind=rel==='_system/Актер.md'?'actor':rel==='_system/Режиссер.md'?'director':rel==='_system/Жанр.md'?'genre':null;
    const comparableYaml=yaml=>{
        const clean=withoutClasses(yaml);
        // QuickAdd changes this view-selection field during normal use.
        return personKind && options.allowLiveSelection ? clean.replace(/^Выбрано:[^\n]*\n?/m,'').trim() : clean;
    };
    if (personKind && options.allowLiveSelection && /^Выбрано:/m.test(a.yaml)!==/^Выбрано:/m.test(b.yaml)) throw Error('Потеря поля выбора: '+rel);
    if (comparableYaml(a.yaml) !== comparableYaml(b.yaml)) throw Error('Изменены исходные свойства: '+rel);
    const prior=briefYaml(a.yaml).cssclasses;
    const next=briefYaml(b.yaml).cssclasses;
    for (const cls of Array.isArray(prior)?prior:prior?[prior]:[]) if (!(Array.isArray(next)?next:[next]).includes(cls)) throw Error('Потерян CSS-класс: '+rel);
    const kind=kindFor(rel), poster=kind==='media'?briefYaml(a.yaml).poster:'';
    const comparisonBody = rel==='_system/README.md'
        ? b.body.replace(/<!-- KINO:REDESIGN:DOCS:START -->[\s\S]*?<!-- KINO:REDESIGN:DOCS:END -->\r?\n?/g,'') : b.body;
    const expectedBody = personKind && updated.includes('// KINO:PERSON:PRESENTATION:V1') && !original.includes('// KINO:PERSON:PRESENTATION:V1')
        ? split(require('./person_page_layout.js')(original,{kind:personKind})).body : a.body;
    if (withoutStandardPoster(withoutUi(expectedBody),poster) !== withoutStandardPoster(withoutUi(comparisonBody),poster)) throw Error('Изменено исходное тело заметки: '+rel);
    if ((updated.match(/<!-- KINO:UI:START -->/g)||[]).length !== 1 || (updated.match(/<!-- KINO:UI:END -->/g)||[]).length !== 1) throw Error('Дубликат интерфейса: '+rel);
    if (kind==='media') {
        const originalButtons=(original.match(/<!-- KINO:RECOMMEND:BUTTON:V2 -->/g)||[]).length;
        if ((updated.match(/<!-- KINO:RECOMMEND:BUTTON:V2 -->/g)||[]).length!==originalButtons) throw Error('Потеря кнопки: '+rel);
        const finalPoster=briefYaml(b.yaml).poster;
        if (finalPoster && !['N/A','null','undefined'].includes(finalPoster) && !normalize(b.body).trimEnd().endsWith('![]('+finalPoster+')')) throw Error('Постер не внизу: '+rel);
    }
}
async function run(mode) {
    if (!['dry-run','apply','verify'].includes(mode)) throw Error('Usage: redesign_migrate.cjs dry-run|apply|verify');
    const files=targets(), totals={}, changed=[];
    if (mode==='verify') {
        const manifests=fs.readdirSync(backupDir).filter(n=>/^baseline-.*\.json$/.test(n)).sort();
        const baseline=JSON.parse(fs.readFileSync(path.join(backupDir,manifests[0]),'utf8'));
        const JSZip=require('jszip');
        const zip=await JSZip.loadAsync(fs.readFileSync(baseline.archive));
        for (const rel of files) {
            const original=await zip.file('Кино/'+rel).async('string');
            const current=fs.readFileSync(path.join(root,rel),'utf8');
            assertRetained(original,current,rel,{allowLiveSelection:true});
            const again=layout().ensureLayout(current,{kind:kindFor(rel),parseYaml:briefYaml});
            if (again!==current) throw Error('Неидемпотентная карточка: '+rel);
            totals[kindFor(rel)]=(totals[kindFor(rel)]||0)+1;
        }
        const protectedFiles=Object.keys(baseline.files).filter(rel=>rel.endsWith('.json')||rel.startsWith('_system/imdbKey_'));
        for (const rel of protectedFiles) {
            const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,rel))).digest('hex');
            if (hash!==baseline.files[rel].sha256) throw Error('Изменён файл состояния/настроек: '+rel);
        }
        const report={mode,checked:files.length,totals,protectedFilesChecked:protectedFiles.length,metadata:'unchanged except cssclasses and current person view selection',body:'unchanged except generated UI, approved person presentation and appended README design documentation',idempotent:true};
        fs.writeFileSync(path.join(backupDir,'verification.json'),JSON.stringify(report,null,2));
        console.log(JSON.stringify(report));return;
    }
    const staged=[];
    for(const rel of files) {
        const original=fs.readFileSync(path.join(root,rel),'utf8');
        const next=layout().ensureLayout(original,{kind:kindFor(rel),parseYaml:briefYaml});
        assertRetained(original,next,rel);
        if(layout().ensureLayout(next,{kind:kindFor(rel),parseYaml:briefYaml})!==next) throw Error('Повторный запуск меняет карточку: '+rel);
        if(next!==original){staged.push([rel,next,original]);changed.push(rel);}
        totals[kindFor(rel)]=(totals[kindFor(rel)]||0)+1;
    }
    // All cards are validated before the first write; dry-run never writes note files.
    if(mode==='apply') for(const [rel,next,original] of staged) {
        const target=path.join(root,rel);
        if(fs.readFileSync(target,'utf8')!==original) throw Error('Заметка изменена во время миграции; повторите проверку: '+rel);
        const temporary=target+'.kino-redesign.tmp';
        fs.writeFileSync(temporary,next,'utf8');
        fs.renameSync(temporary,target);
    }
    const report={mode,checked:files.length,changed:changed.length,totals,files:changed};
    fs.writeFileSync(path.join(backupDir,'migration-'+mode+'.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({mode,checked:report.checked,changed:report.changed,totals}));
}
if(require.main===module)run(process.argv[2]||'dry-run').catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={split,briefYaml,withoutClasses,withoutUi,assertRetained,targets,kindFor};
