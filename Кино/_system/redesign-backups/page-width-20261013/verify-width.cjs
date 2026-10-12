'use strict';
// One-off browser geometry verification. Native Obsidian width defaults are
// represented by a fixture; actual Things and every enabled snippet are loaded.
// Run with NODE_PATH set to the bundled Node packages. --source-last permits
// checking the source before its installed snippet copy has been synchronized.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const system=path.resolve(__dirname,'../..'),vault=path.resolve(system,'../..');
const sourceLast=process.argv.includes('--source-last'),mode=sourceLast?'source-last':'installed';
const read=file=>fs.readFileSync(file,'utf8'),hash=text=>crypto.createHash('sha256').update(text).digest('hex');
const sourceDesign=read(path.join(system,'kino-design.css')),sourceHome=read(path.join(system,'kino-home.css'));
const appearance=JSON.parse(read(path.join(vault,'.obsidian/appearance.json')));
const snippets=(appearance.enabledCssSnippets||[]).map(name=>({name,file:path.join(vault,'.obsidian/snippets',name+'.css')})).filter(item=>fs.existsSync(item.file)).map(item=>({...item,css:read(item.file)}));
const installed=snippets.find(item=>item.name==='kino-design');
const themePath=path.join(vault,'.obsidian/themes',appearance.cssTheme||'Things','theme.css');
const theme=fs.existsSync(themePath)?read(themePath):'';
const profiles=[
    ['generic','kino-page',1],['system','kino-page kino-system',1],['card','kino-page kino-card',1],
    ['media','kino-page kino-media',1],['franchise','kino-page kino-franchise',1],['season','kino-page kino-season',1],
    ['viewing','kino-page kino-viewing',1],['home','kino-page kino-home-page kino-dashboard movies-dashboard',1],
    ['history','kino-page kino-system kino-history-index',1],['report','kino-page kino-system kino-home-page kino-report-page',1],
    ['journal','kino-page kino-system kino-home-page kino-report-page kino-journal-page',1],
    ['actor','kino-page kino-entity kino-person-page',.8],['director','kino-page kino-entity kino-person-page',.8],
    ['genre','kino-page kino-entity kino-person-page',.8],['entity-before-render','kino-page kino-entity',.8],
    ['person-runtime','kino-page kino-person-page',.8],['unrelated','unrelated-page',null]
].map(([name,classes,ratio])=>({name,classes,ratio}));
const layouts=[{viewport:390,pane:390},{viewport:768,pane:768},{viewport:1440,pane:1440},{viewport:1920,pane:1920},{viewport:1920,pane:800}];
const nativeFixture=`
    :root{--file-line-width:700px;--font-text:Arial,sans-serif;--font-interface:Arial,sans-serif;--font-monospace:monospace;}
    *{box-sizing:border-box}body{margin:0;background:#16181c;color:#f0ece3;font:16px Arial,sans-serif}
    .width-pane{margin:0 0 20px;padding:0;overflow:visible;outline:1px solid #383a40}
    .width-label{display:block;padding:8px 12px;font:12px monospace;color:#b89760;background:#202329}
    .markdown-preview-view,.markdown-source-view{width:100%;min-width:0;padding:0;overflow:auto}
    .markdown-preview-sizer,.cm-sizer{width:100%;max-width:none;min-width:0;margin-inline:auto;padding:12px 32px;}
    .markdown-preview-view.is-readable-line-width>.markdown-preview-sizer,
    .markdown-source-view.is-readable-line-width .cm-sizer{max-width:var(--file-line-width);}
    .markdown-preview-section,.cm-editor,.cm-scroller,.cm-contentContainer,.cm-content{width:100%;min-width:0;}
    .markdown-source-view.is-readable-line-width :is(.cm-contentContainer,.cm-content){max-width:var(--file-line-width);}
    .cm-editor,.cm-scroller{height:auto;overflow:visible;}
    .width-probe{display:block;width:100%;min-width:0;min-height:86px;padding:14px;border:1px solid #87684a;border-radius:8px;background:#202329;color:#f0ece3;overflow-wrap:anywhere;}
    .cm-content{padding:0}.width-probe p{margin:0;font:14px/1.6 Arial,sans-serif}
`;

async function main(){
    const report={mode,theme:appearance.cssTheme,activeSnippets:snippets.map(item=>item.name),sourceDesignSHA256:hash(sourceDesign),installedDesignSHA256:installed?hash(installed.css):null,
        installedMatchesSource:Boolean(installed&&hash(installed.css)===hash(sourceDesign)),fixture:'Native readable-line-width defaults, actual Things theme and all enabled snippets; not a screenshot of the Obsidian application.',geometry:[],unrelated:[],screenshots:[]};
    const browser=await chromium.launch({channel:'chrome',headless:true});
    try{
        for(const layout of layouts){
            const page=await browser.newPage({viewport:{width:layout.viewport,height:700}});
            await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body class="theme-dark"></body></html>');
            const result=await page.evaluate(({layout,profiles,nativeFixture,theme,snippets,sourceDesign,sourceHome,sourceLast})=>{
                function style(css,before){const node=document.createElement('style');node.textContent=css;if(before)document.head.insertBefore(node,before);else document.head.append(node);return node;}
                style(nativeFixture);style(theme);
                const snippetNodes=[];for(const snippet of snippets)if(snippet.name!=='kino-design')snippetNodes.push(style(snippet.css));
                for(const profile of profiles)for(const kind of ['preview','source']){
                    const pane=document.createElement('section');pane.className='width-pane';pane.style.width=layout.pane+'px';pane.dataset.profile=profile.name;pane.dataset.kind=kind;
                    const label=document.createElement('span');label.className='width-label';label.textContent=profile.name+' / '+kind+' / pane '+layout.pane+' px';pane.append(label);
                    const view=document.createElement('div');view.className=(kind==='preview'?'markdown-preview-view markdown-rendered':'markdown-source-view mod-cm6 is-live-preview')+' '+profile.classes;pane.append(view);
                    let sizer,content;
                    if(kind==='preview'){
                        sizer=document.createElement('div');sizer.className='markdown-preview-sizer';view.append(sizer);
                        content=document.createElement('div');content.className='markdown-preview-section';sizer.append(content);
                    }else{
                        const editor=document.createElement('div'),scroller=document.createElement('div');editor.className='cm-editor';scroller.className='cm-scroller';view.append(editor);editor.append(scroller);
                        sizer=document.createElement('div');sizer.className='cm-sizer';scroller.append(sizer);
                        const holder=document.createElement('div');holder.className='cm-contentContainer';sizer.append(holder);
                        content=document.createElement('div');content.className='cm-content';holder.append(content);
                    }
                    const probe=document.createElement('div');probe.className='width-probe';probe.innerHTML='<p>'+(/actor|director|genre|entity|person/.test(profile.name)?'Центрированная страница — 80% ширины панели.':'Страница кинотеки занимает всю ширину панели.')+'</p><p>Карточки, свойства и содержимое используют доступное пространство.</p>';content.append(probe);
                    document.body.append(pane);
                }
                function rect(node){const r=node.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width};}
                function capture(pane,readable){
                    const view=pane.querySelector('.markdown-preview-view,.markdown-source-view');view.classList.toggle('is-readable-line-width',readable);
                    const sizer=pane.querySelector('.markdown-preview-sizer,.cm-sizer'),content=pane.querySelector('.markdown-preview-section,.cm-content'),holder=pane.querySelector('.cm-contentContainer');
                    const computed=getComputedStyle(sizer),r=rect(sizer),v=rect(view);
                    return {profile:pane.dataset.profile,kind:pane.dataset.kind,viewport:layout.viewport,pane:layout.pane,readable,view:v,sizer:r,leftGap:r.left-v.left,rightGap:v.right-r.right,
                        maxWidth:computed.maxWidth,widthVariable:getComputedStyle(view).getPropertyValue('--kino-page-width').trim(),paddingLeft:parseFloat(computed.paddingLeft),paddingRight:parseFloat(computed.paddingRight),content:rect(content),holder:holder?rect(holder):null};
                }
                const unrelatedBefore=[];for(const pane of document.querySelectorAll('[data-profile="unrelated"]'))for(const readable of [false,true])unrelatedBefore.push(capture(pane,readable));
                if(sourceLast){for(const snippet of snippets)if(snippet.name==='kino-design')style(snippet.css);style(sourceDesign);style(sourceHome);}
                else{
                    const anchor=snippetNodes[0];style(sourceDesign,anchor);style(sourceHome,anchor);
                    // kino-design is the last enabled snippet in the user's current setup.
                    for(const snippet of snippets)if(snippet.name==='kino-design')style(snippet.css);
                }
                const geometry=[];for(const pane of document.querySelectorAll('.width-pane'))for(const readable of [false,true])geometry.push(capture(pane,readable));
                return {geometry,unrelatedBefore};
            },{layout,profiles,nativeFixture,theme,snippets,sourceDesign,sourceHome,sourceLast});
            report.geometry.push(...result.geometry);
            for(const actual of result.geometry){
                if(actual.profile==='unrelated'){
                    const before=result.unrelatedBefore.find(item=>item.kind===actual.kind&&item.readable===actual.readable);
                    report.unrelated.push({viewport:layout.viewport,pane:layout.pane,kind:actual.kind,readable:actual.readable,before:before.sizer,after:actual.sizer});
                    for(const property of ['left','right','width'])assert.ok(Math.abs(actual.sizer[property]-before.sizer[property])<1,'Unrelated '+actual.kind+' '+property+' remains unchanged');
                    continue;
                }
                const profile=profiles.find(item=>item.name===actual.profile),expected=actual.view.width*profile.ratio;
                const prefix=actual.profile+' '+actual.kind+' viewport '+layout.viewport+' pane '+layout.pane+' readable '+actual.readable;
                assert.ok(Math.abs(actual.sizer.width-expected)<1,prefix+': width '+actual.sizer.width+' expected '+expected);
                assert.ok(Math.abs(actual.leftGap-actual.rightGap)<1,prefix+': centered gaps '+actual.leftGap+'/'+actual.rightGap);
                const inner=actual.sizer.width-actual.paddingLeft-actual.paddingRight;
                assert.ok(Math.abs(actual.content.width-inner)<1,prefix+': content fills available '+inner+' px, got '+actual.content.width);
                if(actual.holder)assert.ok(Math.abs(actual.holder.width-inner)<1,prefix+': content container fills available width');
            }
            if(layout.viewport===390||layout.viewport===1920){
                for(const [profile,kind] of [['media','preview'],['actor','preview'],['actor','source']]){
                    const file='geometry-'+mode+'-'+profile+'-'+kind+'-'+layout.viewport+(layout.pane!==layout.viewport?'-pane-'+layout.pane:'')+'.png';
                    await page.locator('[data-profile="'+profile+'"][data-kind="'+kind+'"]').screenshot({path:path.join(__dirname,file)});report.screenshots.push(file);
                }
            }
            await page.close();
        }
        if(!sourceLast)assert.equal(report.installedMatchesSource,true,'Installed kino-design snippet must exactly match the verified source');
        report.passed=true;report.checks=report.geometry.filter(item=>item.profile!=='unrelated').length;
        fs.writeFileSync(path.join(__dirname,'geometry-'+mode+'.json'),JSON.stringify(report,null,2)+'\n');
        console.log(JSON.stringify({passed:true,mode,checks:report.checks,unrelatedChecks:report.unrelated.length,installedMatchesSource:report.installedMatchesSource,report:path.join(__dirname,'geometry-'+mode+'.json')}));
    }catch(error){
        report.passed=false;report.error=error.stack;fs.writeFileSync(path.join(__dirname,'geometry-'+mode+'.json'),JSON.stringify(report,null,2)+'\n');throw error;
    }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
