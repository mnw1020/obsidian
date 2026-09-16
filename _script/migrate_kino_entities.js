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

let migrationRunning=false;
module.exports=async function installEntities({app,obsidian:ob,quickAddApi:qa}) {
    if(migrationRunning)return;
    migrationRunning=true;
    const note=new ob.Notice('Подготовка миграции трех полей…',0);
    try {
        const quickadd=app.plugins.plugins.quickadd;
        if(!Array.isArray(quickadd?.settings?.choices)||typeof quickadd.saveSettings!=='function')throw new Error('QuickAdd не готов к установке команд');
        const edits=[];
        let total=0;
        for(const file of app.vault.getMarkdownFiles()) {
            if(!originalMediaPath(file.path))continue;
            const before=await app.vault.read(file);
            if(!isMediaRaw(file.path,before,ob))continue;
            total++;
            const after=migrateEntities(before,ob);
            if(after!==before)edits.push({path:file.path,before,after});
        }
        for(const file of app.vault.getFiles().filter(f=>f.extension==='base' && f.path.startsWith('Кино/') && !/^Кино\/(Просмотры|Сезоны)\//.test(f.path))) {
            const before=await app.vault.read(file);
            const after=patchEntityBase(before,ob,app.vault.getName());
            if(after!==before)edits.push({path:file.path,before,after});
        }
        for(const [path,after] of Object.entries(SERVICE_PAGES)) {
            const file=app.vault.getAbstractFileByPath(path);
            if(file) {
                const text=await app.vault.read(file);
                if(!text.includes('<!-- KINO:ENTITY:V1 -->'))throw new Error('Служебная страница уже занята другим содержимым: '+path);
            } else edits.push({path,before:null,after});
        }
        const allChoices=[];
        function walk(items){for(const item of items||[]){allChoices.push(item);if(item.type==='Multi')walk(item.choices);}}
        walk(quickadd.settings.choices);
        const commands=[];
        for(const command of COMMANDS) {
            const present=allChoices.find(x=>x.name===command.name);
            if(present && present.id!==command.id)throw new Error('Команда с таким именем уже существует: '+command.name);
            if(!present)commands.push(command);
        }
        if(!edits.length&&!commands.length){new ob.Notice('Все три поля и команды уже обновлены.');return;}
        // Резервная копия до первой записи. Не создаем дополнительных Markdown-страниц.
        const backupPath=`${app.vault.configDir}/plugins/quickadd/kinoteka-entities-${Date.now()}.json`;
        const backup={version:1,at:new Date().toISOString(),edits,commands:commands.map(x=>x.id),applied:[]};
        await app.vault.adapter.write(backupPath,JSON.stringify(backup,null,2));
        for(const edit of edits) {
            const file=app.vault.getAbstractFileByPath(edit.path);
            if(edit.before===null) {
                if(file)throw new Error('Файл появился во время миграции: '+edit.path);
                await makeFolders(app,edit.path);await app.vault.create(edit.path,edit.after);
            } else {
                if(!file)throw new Error('Файл удален во время миграции: '+edit.path);
                await app.vault.process(file,text=>{
                    if(text!==edit.before)throw new Error('Файл изменен во время миграции: '+edit.path);
                    return edit.after;
                });
            }
            backup.applied.push(edit.path);
        }
        quickadd.settings.choices.push(...commands);
        await quickadd.saveSettings();
        for(const command of commands)quickadd.addCommandForChoice?.(command);
        await app.vault.adapter.write(backupPath,JSON.stringify(backup,null,2));
        let checked=0;
        for(const edit of edits) {
            const file=app.vault.getAbstractFileByPath(edit.path),actual=await app.vault.read(file);
            if(actual!==edit.after)throw new Error('Файл изменился после записи: '+edit.path);
            if(originalMediaPath(edit.path)) {
                if(migrateEntities(actual,ob)!==actual)throw new Error('Проверка нормализации не пройдена: '+edit.path);
                checked++;
            }
        }
        await qa.infoDialog('Готово',[
            `Карточек проверено: ${total}. Изменено: ${checked}.`,
            'Обновлены только Режисер, Актеры, Жанр. Остальной текст карточек сохранен.',
            'Добавлены три динамические страницы и три команды QuickAdd.',
            'В Bases теперь кликабельные имена. Старый Template остается на месте.',
            `Резервная копия: ${backupPath}`
        ]);
    } finally {note.hide?.();migrationRunning=false;}
};

function patchEntityBase(raw,ob,vaultName) {
    const data=ob.parseYaml(raw);
    if(!data||!Array.isArray(data.views))return raw;
    const relevant=JSON.stringify(data).match(/Режисер|Актеры|Жанр/);
    if(!relevant)return raw;
    const before=JSON.stringify(data);
    data.formulas||={};data.properties||={};
    for(const [field,meta] of Object.entries(ENTITY_META)) {
        data.formulas[meta.formula]=entityLinkFormula(field,meta.command,vaultName);
        data.properties['formula.'+meta.formula]={displayName:meta.label};
    }
    for(const view of data.views) {
        if(Array.isArray(view.order))view.order=view.order.map(key=>{
            const field=key.replace(/^note\./,'');return ENTITY_META[field]?'formula.'+ENTITY_META[field].formula:key;
        });
        if(view.type==='table') {
            view.order||=['file.name'];
            for(const meta of Object.values(ENTITY_META))if(!view.order.includes('formula.'+meta.formula))view.order.push('formula.'+meta.formula);
        }
    }
    return before===JSON.stringify(data)?raw:ob.stringifyYaml(data);
}
function entityLinkFormula(field,command,vaultName) {
    // Bases не предоставляет encodeURIComponent. Кодируем разделители query string
    // явно; Unicode в URL штатно кодируется обработчиком ссылки Obsidian.
    let value='value.toString()';
    for(const [from,to] of [['%','%25'],['&','%26'],['+','%2B'],['#','%23'],['?','%3F'],['=','%3D'],[' ','%20'],['"','%22'],["'",'%27'],['<','%3C'],['>','%3E'],['\n','%0A'],['\r','%0D'],['\t','%09']])value+=`.replace(${JSON.stringify(from)}, ${JSON.stringify(to)})`;
    const base='obsidian://quickadd?'+(vaultName?'vault='+encodeURIComponent(vaultName)+'&':'')+'choice='+encodeURIComponent(command)+'&value-entity=';
    return `list(note[${JSON.stringify(field)}]).filter(value != null && value != "").map(link(${JSON.stringify(base)} + ${value}, value))`;
}

const SERVICE_PAGES = {
  "Кино/_system/Режиссер.md": "---\nВыбрано: \"\"\n---\n\n<!-- KINO:ENTITY:V1 -->\n# Режиссер\n\n```dataviewjs\nconst selected = String(dv.current()[\"Выбрано\"] || \"\");\nif (!selected) {\n    dv.paragraph(\"Выбери имя в кинотеке или запусти соответствующую команду QuickAdd.\");\n} else {\n    dv.header(2, selected);\n    const rows = dv.pages('\"Кино\"').array().filter(p => {\n        if (/^Кино\\/(Просмотры|Сезоны|Франшизы|Служебное|_system)\\//.test(p.file.path)) return false;\n        const tags = Array.isArray(p.tags) ? p.tags : [p.tags];\n        if (!tags.some(t => [\"movies\", \"serial\"].includes(String(t).replace(/^#/, \"\")))) return false;\n        const values = Array.isArray(p[\"Режисер\"]) ? p[\"Режисер\"] : [p[\"Режисер\"]];\n        return values.includes(selected);\n    });\n    const ratings = rows.map(p => p[\"Оценка\"]).filter(v => v != null && String(v).trim() !== \"\")\n        .map(v => Number(String(v).replace(\",\", \".\"))).filter(v => Number.isFinite(v) && v >= 1 && v <= 10);\n    dv.paragraph(\"Произведений: \" + rows.length + \" · Средняя моя оценка: \" +\n        (ratings.length ? (ratings.reduce((a,b) => a+b, 0) / ratings.length).toFixed(2) : \"нет оценок\"));\n}\n```\n\n```base\nfilters:\n  and:\n  - file.inFolder(\"Кино\")\n  - file.ext == \"md\"\n  - file.hasTag(\"movies\") || file.hasTag(\"serial\")\n  - '!file.inFolder(\"Кино/Просмотры\")'\n  - '!file.inFolder(\"Кино/Сезоны\")'\n  - '!file.inFolder(\"Кино/Франшизы\")'\n  - '!file.inFolder(\"Кино/Служебное\")'\n  - '!file.inFolder(\"Кино/_system\")'\n  - this.Выбрано != null && this.Выбрано != \"\"\n  - list(note[\"Режисер\"]).contains(this.Выбрано)\nformulas:\n  type: if(file.hasTag(\"serial\"), \"Сериал\", \"Фильм\")\n  rating: if(note.Оценка != null && note.Оценка.toString().trim() != \"\", number(note.Оценка), null)\n  imdb: if(note[\"Оценка Imdb\"] != null && note[\"Оценка Imdb\"].toString().trim() != \"\", number(note[\"Оценка Imdb\"]), null)\nproperties:\n  file.name:\n    displayName: Название\n  formula.type:\n    displayName: Тип\n  note.Релиз:\n    displayName: Год / релиз\n  formula.rating:\n    displayName: Моя оценка\n  formula.imdb:\n    displayName: IMDb\n  note.Франшиза:\n    displayName: Франшиза\nsummaries:\n  entity_average: values.filter(value != null).mean().round(2)\nviews:\n- type: table\n  name: Все\n  order:\n  - file.name\n  - formula.type\n  - note.Релиз\n  - formula.rating\n  - formula.imdb\n  - note.Франшиза\n  sort:\n  - property: formula.rating\n    direction: DESC\n  - property: file.name\n    direction: ASC\n  summaries:\n    file.name: Filled\n    formula.rating: entity_average\n- type: table\n  name: Фильмы\n  order:\n  - file.name\n  - formula.type\n  - note.Релиз\n  - formula.rating\n  - formula.imdb\n  - note.Франшиза\n  sort:\n  - property: formula.rating\n    direction: DESC\n  - property: file.name\n    direction: ASC\n  summaries:\n    file.name: Filled\n    formula.rating: entity_average\n  filters:\n    and:\n    - file.hasTag(\"movies\") && !file.hasTag(\"serial\")\n- type: table\n  name: Сериалы\n  order:\n  - file.name\n  - formula.type\n  - note.Релиз\n  - formula.rating\n  - formula.imdb\n  - note.Франшиза\n  sort:\n  - property: formula.rating\n    direction: DESC\n  - property: file.name\n    direction: ASC\n  summaries:\n    file.name: Filled\n    formula.rating: entity_average\n  filters:\n    and:\n    - file.hasTag(\"serial\")\n- type: table\n  name: Лучшие\n  order:\n  - file.name\n  - formula.type\n  - note.Релиз\n  - formula.rating\n  - formula.imdb\n  - note.Франшиза\n  sort:\n  - property: formula.rating\n    direction: DESC\n  - property: file.name\n    direction: ASC\n  summaries:\n    file.name: Filled\n    formula.rating: entity_average\n  filters:\n    and:\n    - formula.rating >= 8\n```\n\n\"Лучшие\" - личная оценка от 8. Строки открывают исходные карточки.\n",
  "Кино/_system/Актер.md": "---\nВыбрано: \"\"\n---\n\n<!-- KINO:ENTITY:V1 -->\n# Актер\n\n```dataviewjs\nconst selected = String(dv.current()[\"Выбрано\"] || \"\");\nif (!selected) {\n    dv.paragraph(\"Выбери имя в кинотеке или запусти соответствующую команду QuickAdd.\");\n} else {\n    dv.header(2, selected);\n    const rows = dv.pages('\"Кино\"').array().filter(p => {\n        if (/^Кино\\/(Просмотры|Сезоны|Франшизы|Служебное|_system)\\//.test(p.file.path)) return false;\n        const tags = Array.isArray(p.tags) ? p.tags : [p.tags];\n        if (!tags.some(t => [\"movies\", \"serial\"].includes(String(t).replace(/^#/, \"\")))) return false;\n        const values = Array.isArray(p[\"Актеры\"]) ? p[\"Актеры\"] : [p[\"Актеры\"]];\n        return values.includes(selected);\n    });\n    const ratings = rows.map(p => p[\"Оценка\"]).filter(v => v != null && String(v).trim() !== \"\")\n        .map(v => Number(String(v).replace(\",\", \".\"))).filter(v => Number.isFinite(v) && v >= 1 && v <= 10);\n    dv.paragraph(\"Произведений: \" + rows.length + \" · Средняя моя оценка: \" +\n        (ratings.length ? (ratings.reduce((a,b) => a+b, 0) / ratings.length).toFixed(2) : \"нет оценок\"));\n}\n```\n\n```base\nfilters:\n  and:\n  - file.inFolder(\"Кино\")\n  - file.ext == \"md\"\n  - file.hasTag(\"movies\") || file.hasTag(\"serial\")\n  - '!file.inFolder(\"Кино/Просмотры\")'\n  - '!file.inFolder(\"Кино/Сезоны\")'\n  - '!file.inFolder(\"Кино/Франшизы\")'\n  - '!file.inFolder(\"Кино/Служебное\")'\n  - '!file.inFolder(\"Кино/_system\")'\n  - this.Выбрано != null && this.Выбрано != \"\"\n  - list(note[\"Актеры\"]).contains(this.Выбрано)\nformulas:\n  type: if(file.hasTag(\"serial\"), \"Сериал\", \"Фильм\")\n  rating: if(note.Оценка != null && note.Оценка.toString().trim() != \"\", number(note.Оценка), null)\n  imdb: if(note[\"Оценка Imdb\"] != null && note[\"Оценка Imdb\"].toString().trim() != \"\", number(note[\"Оценка Imdb\"]), null)\nproperties:\n  file.name:\n    displayName: Название\n  formula.type:\n    displayName: Тип\n  note.Релиз:\n    displayName: Год / релиз\n  formula.rating:\n    displayName: Моя оценка\n  formula.imdb:\n    displayName: IMDb\n  note.Франшиза:\n    displayName: Франшиза\nsummaries:\n  entity_average: values.filter(value != null).mean().round(2)\nviews:\n- type: table\n  name: Все\n  order:\n  - file.name\n  - formula.type\n  - note.Релиз\n  - formula.rating\n  - formula.imdb\n  - note.Франшиза\n  sort:\n  - property: formula.rating\n    direction: DESC\n  - property: file.name\n    direction: ASC\n  summaries:\n    file.name: Filled\n    formula.rating: entity_average\n- type: table\n  name: Фильмы\n  order:\n  - file.name\n  - formula.type\n  - note.Релиз\n  - formula.rating\n  - formula.imdb\n  - note.Франшиза\n  sort:\n  - property: formula.rating\n    direction: DESC\n  - property: file.name\n    direction: ASC\n  summaries:\n    file.name: Filled\n    formula.rating: entity_average\n  filters:\n    and:\n    - file.hasTag(\"movies\") && !file.hasTag(\"serial\")\n- type: table\n  name: Сериалы\n  order:\n  - file.name\n  - formula.type\n  - note.Релиз\n  - formula.rating\n  - formula.imdb\n  - note.Франшиза\n  sort:\n  - property: formula.rating\n    direction: DESC\n  - property: file.name\n    direction: ASC\n  summaries:\n    file.name: Filled\n    formula.rating: entity_average\n  filters:\n    and:\n    - file.hasTag(\"serial\")\n- type: table\n  name: Лучшие\n  order:\n  - file.name\n  - formula.type\n  - note.Релиз\n  - formula.rating\n  - formula.imdb\n  - note.Франшиза\n  sort:\n  - property: formula.rating\n    direction: DESC\n  - property: file.name\n    direction: ASC\n  summaries:\n    file.name: Filled\n    formula.rating: entity_average\n  filters:\n    and:\n    - formula.rating >= 8\n```\n\n\"Лучшие\" - личная оценка от 8. Строки открывают исходные карточки.\n",
  "Кино/_system/Жанр.md": "---\nВыбрано: \"\"\n---\n\n<!-- KINO:ENTITY:V1 -->\n# Жанр\n\n```dataviewjs\nconst selected = String(dv.current()[\"Выбрано\"] || \"\");\nif (!selected) {\n    dv.paragraph(\"Выбери имя в кинотеке или запусти соответствующую команду QuickAdd.\");\n} else {\n    dv.header(2, selected);\n    const rows = dv.pages('\"Кино\"').array().filter(p => {\n        if (/^Кино\\/(Просмотры|Сезоны|Франшизы|Служебное|_system)\\//.test(p.file.path)) return false;\n        const tags = Array.isArray(p.tags) ? p.tags : [p.tags];\n        if (!tags.some(t => [\"movies\", \"serial\"].includes(String(t).replace(/^#/, \"\")))) return false;\n        const values = Array.isArray(p[\"Жанр\"]) ? p[\"Жанр\"] : [p[\"Жанр\"]];\n        return values.includes(selected);\n    });\n    const ratings = rows.map(p => p[\"Оценка\"]).filter(v => v != null && String(v).trim() !== \"\")\n        .map(v => Number(String(v).replace(\",\", \".\"))).filter(v => Number.isFinite(v) && v >= 1 && v <= 10);\n    dv.paragraph(\"Произведений: \" + rows.length + \" · Средняя моя оценка: \" +\n        (ratings.length ? (ratings.reduce((a,b) => a+b, 0) / ratings.length).toFixed(2) : \"нет оценок\"));\n}\n```\n\n```base\nfilters:\n  and:\n  - file.inFolder(\"Кино\")\n  - file.ext == \"md\"\n  - file.hasTag(\"movies\") || file.hasTag(\"serial\")\n  - '!file.inFolder(\"Кино/Просмотры\")'\n  - '!file.inFolder(\"Кино/Сезоны\")'\n  - '!file.inFolder(\"Кино/Франшизы\")'\n  - '!file.inFolder(\"Кино/Служебное\")'\n  - '!file.inFolder(\"Кино/_system\")'\n  - this.Выбрано != null && this.Выбрано != \"\"\n  - list(note[\"Жанр\"]).contains(this.Выбрано)\nformulas:\n  type: if(file.hasTag(\"serial\"), \"Сериал\", \"Фильм\")\n  rating: if(note.Оценка != null && note.Оценка.toString().trim() != \"\", number(note.Оценка), null)\n  imdb: if(note[\"Оценка Imdb\"] != null && note[\"Оценка Imdb\"].toString().trim() != \"\", number(note[\"Оценка Imdb\"]), null)\nproperties:\n  file.name:\n    displayName: Название\n  formula.type:\n    displayName: Тип\n  note.Релиз:\n    displayName: Год / релиз\n  formula.rating:\n    displayName: Моя оценка\n  formula.imdb:\n    displayName: IMDb\n  note.Франшиза:\n    displayName: Франшиза\nsummaries:\n  entity_average: values.filter(value != null).mean().round(2)\nviews:\n- type: table\n  name: Все\n  order:\n  - file.name\n  - formula.type\n  - note.Релиз\n  - formula.rating\n  - formula.imdb\n  - note.Франшиза\n  sort:\n  - property: formula.rating\n    direction: DESC\n  - property: file.name\n    direction: ASC\n  summaries:\n    file.name: Filled\n    formula.rating: entity_average\n- type: table\n  name: Фильмы\n  order:\n  - file.name\n  - formula.type\n  - note.Релиз\n  - formula.rating\n  - formula.imdb\n  - note.Франшиза\n  sort:\n  - property: formula.rating\n    direction: DESC\n  - property: file.name\n    direction: ASC\n  summaries:\n    file.name: Filled\n    formula.rating: entity_average\n  filters:\n    and:\n    - file.hasTag(\"movies\") && !file.hasTag(\"serial\")\n- type: table\n  name: Сериалы\n  order:\n  - file.name\n  - formula.type\n  - note.Релиз\n  - formula.rating\n  - formula.imdb\n  - note.Франшиза\n  sort:\n  - property: formula.rating\n    direction: DESC\n  - property: file.name\n    direction: ASC\n  summaries:\n    file.name: Filled\n    formula.rating: entity_average\n  filters:\n    and:\n    - file.hasTag(\"serial\")\n- type: table\n  name: Лучшие\n  order:\n  - file.name\n  - formula.type\n  - note.Релиз\n  - formula.rating\n  - formula.imdb\n  - note.Франшиза\n  sort:\n  - property: formula.rating\n    direction: DESC\n  - property: file.name\n    direction: ASC\n  summaries:\n    file.name: Filled\n    formula.rating: entity_average\n  filters:\n    and:\n    - formula.rating >= 8\n```\n\n\"Лучшие\" - личная оценка от 8. Строки открывают исходные карточки.\n"
};
const COMMANDS = [
  {
    "id": "kinoteka-entity-director-v1",
    "name": "Кино - Открыть режиссера",
    "type": "Macro",
    "command": true,
    "runOnStartup": false,
    "macro": {
      "id": "kinoteka-entity-macro-director-v1",
      "name": "Кино - Открыть режиссера",
      "commands": [
        {
          "id": "kinoteka-entity-script-director-v1",
          "name": "open_kino_director",
          "type": "UserScript",
          "path": "скрипты/open_kino_director.js",
          "settings": {}
        }
      ]
    }
  },
  {
    "id": "kinoteka-entity-actor-v1",
    "name": "Кино - Открыть актера",
    "type": "Macro",
    "command": true,
    "runOnStartup": false,
    "macro": {
      "id": "kinoteka-entity-macro-actor-v1",
      "name": "Кино - Открыть актера",
      "commands": [
        {
          "id": "kinoteka-entity-script-actor-v1",
          "name": "open_kino_actor",
          "type": "UserScript",
          "path": "скрипты/open_kino_actor.js",
          "settings": {}
        }
      ]
    }
  },
  {
    "id": "kinoteka-entity-genre-v1",
    "name": "Кино - Открыть жанр",
    "type": "Macro",
    "command": true,
    "runOnStartup": false,
    "macro": {
      "id": "kinoteka-entity-macro-genre-v1",
      "name": "Кино - Открыть жанр",
      "commands": [
        {
          "id": "kinoteka-entity-script-genre-v1",
          "name": "open_kino_genre",
          "type": "UserScript",
          "path": "скрипты/open_kino_genre.js",
          "settings": {}
        }
      ]
    }
  }
];
const ENTITY_META = {
  "Режисер": {
    "formula": "entity_director",
    "command": "Кино - Открыть режиссера",
    "label": "Режиссер"
  },
  "Актеры": {
    "formula": "entity_actor",
    "command": "Кино - Открыть актера",
    "label": "Актер"
  },
  "Жанр": {
    "formula": "entity_genre",
    "command": "Кино - Открыть жанр",
    "label": "Жанр"
  }
};
