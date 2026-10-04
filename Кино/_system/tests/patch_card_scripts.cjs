const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function edit(file,fn){const target=path.join(root,file),raw=fs.readFileSync(target,'utf8'),nl=raw.includes('\r\n')?'\r\n':'\n';let text=raw.replace(/\r\n/g,'\n');text=fn(text);fs.writeFileSync(target,text.replace(/\n/g,nl),'utf8');console.log('Updated '+file);}
function replace(text,before,after){if(!text.includes(before))throw Error('Missing edit anchor '+before.slice(0,100));return text.replace(before,after);}
function section(text,start,end,fn){const a=text.indexOf(start),b=text.indexOf(end,a+start.length);if(a<0||b<0)throw Error('Missing section '+start);return text.slice(0,a)+fn(text.slice(a,b))+text.slice(b);}
const loader=`
    const cardLayoutFile = app.vault.getAbstractFileByPath("Кино/_system/card_layout.js");
    if (!cardLayoutFile) throw new Error("Не найден модуль оформления карточек Кино");
    const cardLayoutModule = { exports: {} };
    new Function("module", "exports", await app.vault.read(cardLayoutFile))(cardLayoutModule, cardLayoutModule.exports);
    const cardLayout = cardLayoutModule.exports;
`;
const globalLoader=`
async function loadCardLayout(app) {
    const file = app.vault.getAbstractFileByPath("Кино/_system/card_layout.js");
    if (!file) throw new Error("Не найден модуль оформления карточек Кино");
    const loaded = { exports: {} };
    new Function("module", "exports", await app.vault.read(file))(loaded, loaded.exports);
    return loaded.exports;
}
`;
for(const file of ['add_viewing.js','edit_viewing.js','add_season.js','edit_season.js','rebuild_card.js'])edit(file,text=>{
 const imports=file==='rebuild_card.js'?'    const { Notice, parseYaml } = obsidian;':'    const { Notice, normalizePath, parseYaml } = obsidian;';
 text=replace(text,imports,imports+'\n'+loader);
 text=text.replace(/const VIEWINGS_START = "<!-- VIEWINGS:START -->";/g,'const VIEWINGS_START = "<!-- KINO:VIEWINGS:START -->";').replace(/const VIEWINGS_END = "<!-- VIEWINGS:END -->";/g,'const VIEWINGS_END = "<!-- KINO:VIEWINGS:END -->";');
 text=text.replace(/^        const persistent = extractPersistentCardBlocks\(parts.body\);\n/gm,'');
 if(file.includes('viewing')){
  text=section(text,'    async function rebuildOriginalNative(',file==='add_viewing.js'?'    function removeGeneratedBlocks(':'    function viewingPath(',part=>{
   const at=part.indexOf('        let result =\n            parts.frontmatterText;');if(at<0)throw Error('No viewing rebuild output');
   return part.slice(0,at)+`        const result = cardLayout.rebuildCard(raw, chunks.join("\\n\\n"), { parseYaml });
        await app.vault.modify(mediaFile, result);
    }


`;
  });
  text=replace(text,'                parts.frontmatterText + "\\n"','                cardLayout.ensureLayout(updated, { kind: "viewing", parseYaml })');
  text=section(text,'    async function readLegacyViewingBody(', '    async function migrateViewingFile(',part=>replace(part,'let body = parts.body.trim();','let body = cardLayout.personalBody(parts.body).trim();'));
  if(file==='add_viewing.js'){
   text=section(text,'    function removeGeneratedBlocks(', '    function extractLegacyReview(',()=>`    function removeGeneratedBlocks(body) {
        return cardLayout.personalBody(body);
    }

`);
   text=replace(text,'            buildViewingContent(args)','            cardLayout.ensureLayout(buildViewingContent(args), { kind: "viewing", parseYaml })');
  }
 }
 if(file==='add_season.js'){
  text=section(text,'    function removeOldGeneratedBlocks(', '    function parseLegacySeasons(',()=>`    function removeOldGeneratedBlocks(body) {
        return cardLayout.personalBody(body);
    }

    function cleanSeasonBody(text, posterUrl) {
        return cardLayout.personalBody(text, posterUrl);
    }

`);
  text=section(text,'    async function readLegacySeasonBody(', '    async function migrateSeasonFileToYaml(',part=>replace(part,'let body = parts.body.trim();','let body = cardLayout.personalBody(parts.body).trim();'));
  text=replace(text,'            parts.frontmatterText + "\\n"','            cardLayout.ensureLayout(updated, { kind: "season", parseYaml })');
  text=replace(text,'        return content;','        return cardLayout.ensureLayout(content, { kind: "season", parseYaml });');
  text=section(text,'    async function rebuildOriginalMarkdown(', '    // -------------------------------------------------\n    // 1.',part=>{
   const at=part.indexOf('        let body =\n            chunks.length > 0');if(at<0)throw Error('No season rebuild output');
   return part.slice(0,at)+`        const result = cardLayout.rebuildCard(originalText, chunks.join("\\n\\n"), { parseYaml });
        await app.vault.modify(serialFile, result);
    }

`;
  });
  text=text.replace('// Полностью очищаем тело файла сезона.','// Сохраняем личный Markdown и оформляем карточку сезона.');
 }
 if(file==='edit_season.js'){
  text=section(text,'    async function rebuildOriginal(', '    async function chooseSeasonFile(',part=>{
   const at=part.indexOf('        let result =\n');if(at<0)throw Error('No edited season output');
   return part.slice(0,at)+`        const result = cardLayout.rebuildCard(freshOriginal, body.join("\\n\\n"), { parseYaml });
        await app.vault.modify(serialFile, result);
    }

`;
  });
  text=replace(text,'        updatedParts.frontmatterText + "\\n"','        cardLayout.ensureLayout(updated, { kind: "season", parseYaml })');
  text=text.replace('// Архитектура сезонов YAML-only: тело очищаем.','// Комментарий остаётся в YAML; дополнительный личный Markdown сохраняется.');
 }
 if(file==='rebuild_card.js'){
  text=section(text,'    async function rebuildSeries(', '    async function getViewingRows(',part=>{
   const at=part.indexOf('        let result =\n');if(at<0)throw Error('No rebuild series output');
   return part.slice(0,at)+`        const result = cardLayout.rebuildCard(raw, body.join("\\n\\n"), { parseYaml });
        await app.vault.modify(mediaFile, result);
        return true;
    }

`;
  });
  text=section(text,'    async function rebuildViewings(', '    let mediaFile =',part=>{
   const at=part.indexOf('        let result =\n');if(at<0)throw Error('No rebuild viewings output');
   return part.slice(0,at)+`        const result = cardLayout.rebuildCard(raw, cardLayout.region("viewings", HISTORY_BLOCK), { parseYaml });
        await app.vault.modify(mediaFile, result);
        return true;
    }

`;
  });
 }
 return text;
});
edit('Examples_Attachments_movies.js',text=>{
 text=replace(text,'            const rolePath = roleFilePath(file);','            const cardLayout = await loadCardLayout(app);\n            const rolePath = roleFilePath(file);');
 text=replace(text,'                next = ensureRecommendationButton(next);','                next = ensureRecommendationButton(next);\n                next = cardLayout.ensureLayout(next, { kind: "media", parseYaml: ob.parseYaml });');
 text=replace(text,'    const content = lines.join("\\n");','    const cardLayout = await loadCardLayout(app);\n    const content = cardLayout.ensureLayout(lines.join("\\n"), { kind: "roles", parseYaml: ob.parseYaml });');
 // Companion data is regenerated, but additional personal Markdown is retained.
 text=replace(text,'    if (existing) await app.vault.modify(existing, content);',`    if (existing) {
        const previous = await app.vault.read(existing);
        const personal = cardLayout.personalBody(cardLayout.splitRaw(previous).body)
            .replace(/<!-- KINO:ENTITY:LINKS:V(?:1|2|3) -->\\r?\\n\x60{3}dataviewjs\\r?\\n[\\s\\S]*?^\x60{3}[ \\t]*\\r?$/gm, "");
        await app.vault.modify(existing, cardLayout.ensureLayout(content + (personal.trim() ? "\\n" + personal + "\\n" : ""), { kind: "roles", parseYaml: ob.parseYaml }));
    }`);
 return text+globalLoader;
});
edit('update_kino_roles.js',text=>{
 text=replace(text,'    const { app, obsidian: ob } = params;','    const { app, obsidian: ob } = params;\n    const cardLayout = await loadCardLayout(app);');
 text=replace(text,'                    const next = ensureRoleEmbed(raw, rolePath);','                    const next = cardLayout.ensureLayout(ensureRoleEmbed(raw, rolePath), { kind: "media", parseYaml: ob.parseYaml });');
 text=replace(text,'    const existing = app.vault.getAbstractFileByPath(rolePath);','    const cardLayout = await loadCardLayout(app);\n    const existing = app.vault.getAbstractFileByPath(rolePath);');
 text=replace(text,'    if (existing) await app.vault.modify(existing, content);',`    if (existing) {
        const previous = await app.vault.read(existing);
        const personal = cardLayout.personalBody(cardLayout.splitRaw(previous).body)
            .replace(/<!-- KINO:ENTITY:LINKS:V(?:1|2|3) -->\\r?\\n\x60{3}dataviewjs\\r?\\n[\\s\\S]*?^\x60{3}[ \\t]*\\r?$/gm, "");
        await app.vault.modify(existing, cardLayout.ensureLayout(content + (personal.trim() ? "\\n" + personal + "\\n" : ""), { kind: "roles" }));
    }`);
 text=replace(text,'    else await app.vault.create(rolePath, content);','    else await app.vault.create(rolePath, cardLayout.ensureLayout(content, { kind: "roles" }));');
 return text+globalLoader;
});
