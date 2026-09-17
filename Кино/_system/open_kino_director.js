// QuickAdd: Кино - Открыть режиссера
const FIELD="Режисер";
const LABEL="режиссера";
const PAGE="Кино/_system/Режиссер.md";
const PAGE_TEXT="---\nВыбрано: \"\"\n---\n\n<!-- KINO:ENTITY:V1 -->\n# Режиссер\n\n```dataviewjs\nconst selected = String(dv.current()[\"Выбрано\"] || \"\");\nif (!selected) {\n    dv.paragraph(\"Выбери имя в кинотеке или запусти соответствующую команду QuickAdd.\");\n} else {\n    dv.header(2, selected);\n    const rows = dv.pages('\"Кино\"').array().filter(p => {\n        if (/^Кино\\/(Просмотры|Сезоны|Франшизы|Служебное|_system)\\//.test(p.file.path)) return false;\n        const tags = Array.isArray(p.tags) ? p.tags : [p.tags];\n        if (!tags.some(t => [\"movies\", \"serial\"].includes(String(t).replace(/^#/, \"\")))) return false;\n        const values = Array.isArray(p[\"Режисер\"]) ? p[\"Режисер\"] : [p[\"Режисер\"]];\n        return values.includes(selected);\n    });\n    const ratings = rows.map(p => p[\"Оценка\"]).filter(v => v != null && String(v).trim() !== \"\")\n        .map(v => Number(String(v).replace(\",\", \".\"))).filter(v => Number.isFinite(v) && v >= 1 && v <= 10);\n    dv.paragraph(\"Произведений: \" + rows.length + \" · Средняя моя оценка: \" +\n        (ratings.length ? (ratings.reduce((a,b) => a+b, 0) / ratings.length).toFixed(2) : \"нет оценок\"));\n}\n```\n\n```base\nfilters:\n  and:\n  - file.inFolder(\"Кино\")\n  - file.ext == \"md\"\n  - file.hasTag(\"movies\") || file.hasTag(\"serial\")\n  - '!file.inFolder(\"Кино/Просмотры\")'\n  - '!file.inFolder(\"Кино/Сезоны\")'\n  - '!file.inFolder(\"Кино/Франшизы\")'\n  - '!file.inFolder(\"Кино/Служебное\")'\n  - '!file.inFolder(\"Кино/_system\")'\n  - this.Выбрано != null && this.Выбрано != \"\"\n  - list(note[\"Режисер\"]).contains(this.Выбрано)\nformulas:\n  type: if(file.hasTag(\"serial\"), \"Сериал\", \"Фильм\")\n  rating: if(note.Оценка != null && note.Оценка.toString().trim() != \"\", number(note.Оценка), null)\n  imdb: if(note[\"Оценка Imdb\"] != null && note[\"Оценка Imdb\"].toString().trim() != \"\", number(note[\"Оценка Imdb\"]), null)\nproperties:\n  file.name:\n    displayName: Название\n  formula.type:\n    displayName: Тип\n  note.Релиз:\n    displayName: Год / релиз\n  formula.rating:\n    displayName: Моя оценка\n  formula.imdb:\n    displayName: IMDb\n  note.Франшиза:\n    displayName: Франшиза\nsummaries:\n  entity_average: values.filter(value != null).mean().round(2)\nviews:\n- type: table\n  name: Все\n  order:\n  - file.name\n  - formula.type\n  - note.Релиз\n  - formula.rating\n  - formula.imdb\n  - note.Франшиза\n  sort:\n  - property: formula.rating\n    direction: DESC\n  - property: file.name\n    direction: ASC\n  summaries:\n    file.name: Filled\n    formula.rating: entity_average\n- type: table\n  name: Фильмы\n  order:\n  - file.name\n  - formula.type\n  - note.Релиз\n  - formula.rating\n  - formula.imdb\n  - note.Франшиза\n  sort:\n  - property: formula.rating\n    direction: DESC\n  - property: file.name\n    direction: ASC\n  summaries:\n    file.name: Filled\n    formula.rating: entity_average\n  filters:\n    and:\n    - file.hasTag(\"movies\") && !file.hasTag(\"serial\")\n- type: table\n  name: Сериалы\n  order:\n  - file.name\n  - formula.type\n  - note.Релиз\n  - formula.rating\n  - formula.imdb\n  - note.Франшиза\n  sort:\n  - property: formula.rating\n    direction: DESC\n  - property: file.name\n    direction: ASC\n  summaries:\n    file.name: Filled\n    formula.rating: entity_average\n  filters:\n    and:\n    - file.hasTag(\"serial\")\n- type: table\n  name: Лучшие\n  order:\n  - file.name\n  - formula.type\n  - note.Релиз\n  - formula.rating\n  - formula.imdb\n  - note.Франшиза\n  sort:\n  - property: formula.rating\n    direction: DESC\n  - property: file.name\n    direction: ASC\n  summaries:\n    file.name: Filled\n    formula.rating: entity_average\n  filters:\n    and:\n    - formula.rating >= 8\n```\n\n\"Лучшие\" - личная оценка от 8. Строки открывают исходные карточки.\n";
const ENTITY_FIELDS = ['Режисер','Актеры','Жанр'];
function entityName(value) {
    if (typeof value !== 'string') throw new Error('Ожидалась строка имени сущности');
    const text=value.trim();
    const link=text.match(/^\[\[([\s\S]+?)\]\]$/);
    if(!link)return text.normalize('NFC');
    if(link[1]==='N/A')return 'N/A';
    const parts=link[1].split('|');
    return (parts.length>1?parts.slice(1).join('|'):parts[0].split('#')[0].replace(/\.md$/i,'').split('/').pop()).trim().normalize('NFC');
}
function normalizeEntityField(value) {
    if(value==null)return value;
    return Array.isArray(value)?value.map(entityName):entityName(value);
}
function yamlParts(raw) {
    const m=raw.match(/^(\uFEFF?---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/);
    return m?{prefix:m[1],yaml:m[2],end:m[3],body:raw.slice(m[0].length)}:null;
}
function propertyBlock(yaml,key) {
    const exp=new RegExp('^(?:'+key+'|"'+key+'"|\''+key+'\'):[^\\r\\n]*(?:\\r?\\n(?![^ \\t\\r\\n#][^\\r\\n]*:)[^\\r\\n]*)*','m');
    return yaml.match(exp);
}
function migrateEntities(raw,ob) {
    const parts=yamlParts(raw);
    if(!parts)return raw;
    let yaml=parts.yaml;
    const newline=raw.includes('\r\n')?'\r\n':'\n';
    for(const key of ENTITY_FIELDS) {
        const block=propertyBlock(yaml,key);
        if(!block)continue;
        const value=ob.parseYaml(block[0])?.[key];
        const result=normalizeEntityField(value);
        if(JSON.stringify(value)===JSON.stringify(result))continue;
        const replacement=Array.isArray(result)?key+':'+(result.length?newline+result.map(x=>'  - '+JSON.stringify(x)).join(newline):' []'):key+': '+JSON.stringify(result);
        yaml=yaml.slice(0,block.index)+replacement+yaml.slice(block.index+block[0].length);
    }
    return parts.prefix+yaml+parts.end+parts.body;
}
function originalMediaPath(path) {
    return path.startsWith('Кино/') && path.endsWith('.md') && !/^Кино\/(Просмотры|Сезоны|Франшизы|Служебное|_system)\//.test(path);
}
function isMediaRaw(path,raw,ob) {
    if(!originalMediaPath(path))return false;
    const parts=yamlParts(raw);
    if(!parts)return false;
    const block=propertyBlock(parts.yaml,'tags');
    const tags=block?ob.parseYaml(block[0])?.tags:[];
    return (Array.isArray(tags)?tags:[tags]).some(x=>['movies','serial'].includes(String(x).replace(/^#/,'')));
}
async function makeFolders(app,path) {
    let current='';
    for(const part of path.split('/').slice(0,-1)) {
        current=current?current+'/'+part:part;
        if(!app.vault.getAbstractFileByPath(current))await app.vault.createFolder(current);
    }
}

module.exports=async function openEntity(params) {
    const {app,obsidian:ob,quickAddApi:qa}=params;
    let selected=params.variables?.entity;
    // URI уже декодирован QuickAdd. Повторный decodeURIComponent испортил бы имена с %.
    if(typeof selected==='string' && selected.trim())selected=entityName(selected);
    else {
        const values=new Set();
        for(const file of app.vault.getMarkdownFiles()) {
            if(!originalMediaPath(file.path))continue;
            const raw=await app.vault.read(file);
            if(!isMediaRaw(file.path,raw,ob))continue;
            const part=yamlParts(raw),block=propertyBlock(part.yaml,FIELD);
            const value=block?normalizeEntityField(ob.parseYaml(block[0])?.[FIELD]):null;
            for(const name of Array.isArray(value)?value:[value])if(name)values.add(name);
        }
        const names=[...values].sort((a,b)=>a.localeCompare(b,'ru',{sensitivity:'base'}));
        selected=await qa.suggester(names,names,'Выбери '+LABEL);
    }
    if(!selected)return;
    let file=app.vault.getAbstractFileByPath(PAGE);
    if(!file){await makeFolders(app,PAGE);file=await app.vault.create(PAGE,PAGE_TEXT);}
    if(file.extension!=='md')throw new Error('Путь служебной страницы занят: '+PAGE);
    await app.fileManager.processFrontMatter(file,fm=>{fm['Выбрано']=selected;});
    await app.workspace.getLeaf(false).openFile(file);
};
