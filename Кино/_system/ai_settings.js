// Encrypted settings with a compact selector and an Obsidian modal editor.
module.exports=async function mountAiSettings({app,container,request,onApply,copyText,Modal}){
    const path="Кино/_system/ai_settings.json",encryptedPath="Кино/_system/ai_settings.enc.json";
    const sessionId=Symbol.for("kino.ai.settings.unlocked");
    async function load(name){const file=app.vault.getAbstractFileByPath(`Кино/_system/${name}.js`);if(!file)throw new Error(`Не найден ${name}.js`);const m={exports:{}};new Function("module",await app.vault.read(file))(m);return m.exports;}
    const crypt=await load("ai_crypto"),core=await load("ai_core");
    const host=container.createDiv({cls:"kino-ai"});
    host.setAttribute("role","region");host.setAttribute("aria-label","Рекомендации ИИ");
    host.createEl("div",{cls:"kino-ai-heading",text:"Рекомендации ИИ"});
    host.createEl("style",{text:`
        .kino-ai{margin:12px 0}.kino-ai-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:end;padding:12px;border:1px solid var(--background-modifier-border);border-radius:12px;background:var(--background-secondary)}
        .kino-ai label,.kino-ai-modal label{display:flex;flex-direction:column;gap:5px;font-size:var(--font-ui-small)}
        .kino-ai select{max-width:100%;min-width:180px}.kino-ai-state{color:var(--text-muted);font-size:var(--font-ui-small);margin:8px 2px}
        .kino-ai-modal{width:min(900px,94vw);max-width:94vw}.kino-ai-modal .modal-content{overflow-y:auto}
        .kino-ai-layout{display:grid;grid-template-columns:210px minmax(0,1fr);gap:20px}.kino-ai-sidebar{display:flex;flex-direction:column;gap:8px;border-right:1px solid var(--background-modifier-border);padding-right:16px}
        .kino-ai-sidebar button{text-align:left;white-space:normal;height:auto;padding:10px}.kino-ai-sidebar button.is-active{background:var(--interactive-accent);color:var(--text-on-accent)}
        .kino-ai-editor{min-width:0;display:flex;flex-direction:column;gap:12px}.kino-ai-editor input,.kino-ai-editor select{width:100%;min-width:0}
        .kino-ai-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.kino-ai-row input{flex:1;min-width:100px}.kino-ai-model{border:1px solid var(--background-modifier-border);border-radius:10px;padding:10px;margin:8px 0}.kino-ai-model .kino-ai-row label{flex-direction:row;align-items:center;flex:1;overflow-wrap:anywhere}.kino-ai-model input[type=radio]{width:auto;flex:none;min-width:0}
        .kino-ai-model details{margin-top:8px}.kino-ai-route{display:flex;flex-direction:column;gap:8px;padding-top:8px}.kino-ai-check{color:var(--text-muted);font-size:var(--font-ui-smaller);margin:6px 0}.kino-ai-footer{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;border-top:1px solid var(--background-modifier-border);margin-top:18px;padding-top:14px}.kino-ai-error{color:var(--text-error)}
        @media(max-width:600px){.kino-ai-layout{grid-template-columns:1fr}.kino-ai-sidebar{border-right:0;border-bottom:1px solid var(--background-modifier-border);padding:0 0 12px}.kino-ai-bar label{width:100%}.kino-ai-bar select{width:100%}}
    `});
    let encryptedFile=app.vault.getAbstractFileByPath(encryptedPath);
    let encryptedText=encryptedFile?await app.vault.read(encryptedFile):"";
    let session=app[sessionId]?.text===encryptedText?app[sessionId].session:null;
    let settings=null,busy=false,editor=null;
    const file=app.vault.getAbstractFileByPath(path),plainText=!encryptedFile&&file?await app.vault.read(file):"";
    if(session)settings=core.normalize(app[sessionId].settings);
    else if(!encryptedFile){settings=core.normalize(plainText?JSON.parse(plainText):{version:3,connections:[]});}
    const view=host.createDiv({cls:"kino-ai-selector"}),status=host.createEl("p",{cls:"kino-ai-state"});status.setAttribute("role","status");status.setAttribute("aria-live","polite");
    function field(parent,label,tag="input",type="text"){
        const holder=parent.createEl("label");holder.createEl("span",{text:label});const el=holder.createEl(tag,tag==="input"?{type}:{});el.setAttribute("aria-label",label);return el;
    }
    function button(parent,text,action){const b=parent.createEl("button",{text});b.type="button";b.addEventListener("click",action);return b;}
    function report(error){status.textContent=core.safeError(error,settings?.connections.map(c=>c.apiKey)||[]);}
    async function persist(next){
        next=core.validate(next);
        if(!session)throw new Error("Сначала зашифруй настройки");
        const target=app.vault.getAbstractFileByPath(encryptedPath);
        if(!target||await app.vault.read(target)!==encryptedText)throw new Error("Файл ключей изменился. Переоткрой рекомендации и расшифруй его заново");
        const text=JSON.stringify(await crypt.seal(next,session),null,2)+"\n";
        if(await app.vault.read(target)!==encryptedText)throw new Error("Файл ключей изменился; изменения не сохранены");
        await app.vault.modify(target,text);encryptedText=text;settings=next;
        app[sessionId]={text,session,settings:core.clone(next)};return next;
    }
    async function apply(next){const saved=await persist(next);render();Promise.resolve(onApply(saved)).catch(report);}
    async function perform(action){if(busy)return;busy=true;try{await action();}catch(e){report(e);}finally{busy=false;}}
    function render(){
        view.empty();status.textContent="";const bar=view.createDiv({cls:"kino-ai-bar"});
        if(!settings){
            const password=field(bar,"Пароль для расшифровки","input","password");password.autocomplete="off";
            const unlock=async()=>perform(async()=>{
                encryptedText=await app.vault.read(encryptedFile);const result=await crypt.unlock(JSON.parse(encryptedText),password.value);password.value="";
                session=result.session;settings=core.normalize(result.settings);app[sessionId]={text:encryptedText,session,settings:core.clone(settings)};
                render();await onApply(settings);
            });
            button(bar,"Расшифровать",unlock);password.addEventListener("keydown",e=>{if(e.key==="Enter")unlock();});
            status.textContent="Ключи зашифрованы. Разблокируй настройки для рекомендаций ИИ.";return;
        }
        if(!session){
            const password=field(bar,"Пароль — минимум 10 символов","input","password"),confirmation=field(bar,"Повтори пароль","input","password");
            button(bar,"Зашифровать",()=>perform(async()=>{
                if(password.value!==confirmation.value)throw new Error("Пароли не совпадают");
                if(app.vault.getAbstractFileByPath(encryptedPath)||file&&await app.vault.read(file)!==plainText)throw new Error("Файл настроек изменился. Переоткрой рекомендации");
                const result=await crypt.create(settings,password.value),text=JSON.stringify(result.envelope,null,2)+"\n";
                const target=await app.vault.create(encryptedPath,text);const checked=await crypt.unlock(JSON.parse(await app.vault.read(target)),password.value);
                if(JSON.stringify(checked.settings)!==JSON.stringify(settings))throw new Error("Проверка шифрования не прошла; исходник сохранён");
                encryptedFile=target;encryptedText=text;session=result.session;app[sessionId]={text,session,settings:core.clone(settings)};
                password.value=confirmation.value="";if(file)await app.vault.delete(file);render();await onApply(settings);
            }));return;
        }
        const select=field(bar,"Подключение","select"),model=field(bar,"Модель","select");
        for(const c of settings.connections)select.createEl("option",{text:c.name,value:c.id});select.value=settings.activeConnectionId;
        const active=core.connection(settings);for(const m of active?.models||[])model.createEl("option",{text:m.id,value:m.id});model.value=active?.model||"";
        select.disabled=!settings.connections.length;model.disabled=!active?.models.length;
        select.addEventListener("change",()=>perform(async()=>{const next=core.clone(settings);next.activeConnectionId=select.value;await apply(next);}));
        model.addEventListener("change",()=>perform(async()=>{const next=core.clone(settings);core.connection(next).model=model.value;await apply(next);}));
        button(bar,"⚙ Настройки ИИ",()=>{try{openEditor();}catch(e){report(e);}});
        button(bar,"Заблокировать",()=>perform(async()=>{if(editor&&!editor.requestClose())return;delete app[sessionId];settings=null;session=null;render();await onApply(null);}));
        const selected=active?.models.find(m=>m.id===active.model);
        status.textContent=!active?"Нет подключений. Открой настройки и добавь первое.":!selected?"Нет моделей. Добавь модель в настройках.":selected.check?.state==="verified"?`✓ ${selected.id} · подключение проверено`:`${selected.id} · ${selected.check?.detail||"подключение не проверено"}`;
    }
    function openEditor(){
        if(editor||busy)return;if(!Modal)throw new Error("Окно настроек недоступно: не найден Obsidian Modal");
        const initial=core.clone(settings);
        class SettingsModal extends Modal{
            constructor(){super(app);this.draft=core.clone(initial);this.selected=this.draft.activeConnectionId||this.draft.connections[0]?.id||"";this.working=false;this.discard=false;}
            dirty(){return JSON.stringify(this.draft)!==JSON.stringify(initial);}
            requestClose(){if(this.working)return false;if(this.dirty()&&!this.discard){this.confirmDiscard();return false;}this.discard=true;super.close();return true;}
            close(){this.requestClose();}
            onOpen(){this.modalEl.classList.add("kino-ai-modal");this.titleEl.setText("Настройки ИИ");this.draw();}
            onClose(){this.contentEl.empty();this.draft=null;editor=null;}
            confirmDiscard(){
                if(this.confirmation)return;this.confirmation=this.contentEl.createDiv({cls:"kino-ai-footer"});this.confirmation.createEl("span",{text:"Закрыть без сохранения изменений?"});
                button(this.confirmation,"Продолжить редактирование",()=>{this.confirmation.remove();this.confirmation=null;});button(this.confirmation,"Не сохранять",()=>{this.discard=true;this.requestClose();});
            }
            async run(action){
                if(this.working)return;this.working=true;
                const controls=[...this.contentEl.querySelectorAll("button,input,select")],states=controls.map(el=>el.disabled);controls.forEach(el=>el.disabled=true);
                try{await action();}catch(e){if(this.message.isConnected){this.message.textContent=core.safeError(e,this.draft?.connections.map(c=>c.apiKey)||[]);this.message.classList.add("kino-ai-error");}else report(e);}
                finally{this.working=false;controls.forEach((el,i)=>{if(el.isConnected)el.disabled=states[i];});}
            }
            draw(){
                this.contentEl.empty();this.confirmation=null;
                const layout=this.contentEl.createDiv({cls:"kino-ai-layout"}),sidebar=layout.createDiv({cls:"kino-ai-sidebar"}),edit=layout.createDiv({cls:"kino-ai-editor"});
                for(const c of this.draft.connections){const b=button(sidebar,c.name||"Новое подключение",()=>{this.selected=c.id;this.draw();});if(c.id===this.selected)b.classList.add("is-active");}
                button(sidebar,"+ Добавить подключение",()=>{const c={id:core.newId(),name:"Новое подключение",baseUrl:"",protocol:"responses",apiKey:"",models:[],model:""};this.draft.connections.push(c);this.selected=c.id;if(!this.draft.activeConnectionId)this.draft.activeConnectionId=c.id;this.draw();});
                const c=this.draft.connections.find(c=>c.id===this.selected);if(c)this.drawConnection(edit,c);else edit.createEl("p",{text:"Добавь подключение: сервер, ключ API и модели."});
                this.message=this.contentEl.createEl("p",{cls:"kino-ai-state"});this.message.setAttribute("role","status");this.message.setAttribute("aria-live","polite");
                const footer=this.contentEl.createDiv({cls:"kino-ai-footer"});button(footer,"Отмена",()=>this.requestClose());
                const save=button(footer,"Сохранить",()=>this.run(async()=>{
                    if(busy)throw new Error("Дождись сохранения выбранной модели");busy=true;try{await persist(this.draft);}finally{busy=false;}
                    render();this.discard=true;this.working=false;super.close();await onApply(settings);
                }));save.classList.add("mod-cta");
            }
            textField(parent,label,obj,key,type="text",invalidate){
                const el=field(parent,label,"input",type);el.value=obj[key]||"";el.autocomplete="off";el.spellcheck=false;el.addEventListener("input",()=>{obj[key]=el.value;invalidate?.();});return el;
            }
            protocolField(parent,obj,invalidate){const el=field(parent,"Протокол","select");for(const [id,label]of Object.entries(core.protocols))el.createEl("option",{text:label,value:id});el.value=obj.protocol;el.addEventListener("change",()=>{obj.protocol=el.value;invalidate?.();});return el;}
            drawConnection(edit,c){
                const invalidate=()=>{for(const m of c.models)m.check={state:"unchecked"};for(const el of edit.querySelectorAll(".kino-ai-check"))el.textContent="Подключение не проверено";};
                this.textField(edit,"Название подключения",c,"name");this.textField(edit,"Адрес сервера",c,"baseUrl","text",invalidate).placeholder="https://…/v1";this.protocolField(edit,c,invalidate);
                const keyRow=edit.createDiv({cls:"kino-ai-row"}),key=this.textField(keyRow,"Ключ API",c,"apiKey","password",invalidate);
                const show=button(keyRow,"Показать",()=>{key.type=key.type==="password"?"text":"password";show.textContent=key.type==="password"?"Показать":"Скрыть";});
                button(keyRow,"Копировать",()=>this.run(async()=>{if(!c.apiKey)throw new Error("Ключ не указан");if(copyText)await copyText(c.apiKey);else await navigator.clipboard.writeText(c.apiKey);this.message.textContent="Ключ скопирован.";}));
                edit.createEl("h3",{text:"Модели"});const models=edit.createDiv();this.drawModels(models,c);
                const addRow=edit.createDiv({cls:"kino-ai-row"}),id=field(addRow,"Идентификатор модели");id.placeholder="Название из API";
                button(addRow,"Добавить",()=>{const value=id.value.trim();if(!value){this.message.textContent="Укажи идентификатор модели";return;}if(c.models.some(m=>m.id===value)){this.message.textContent="Эта модель уже добавлена";return;}c.models.push({id:value,check:{state:"unchecked"}});if(!c.model)c.model=value;id.value="";this.drawModels(models,c);});
                button(edit,"Загрузить модели",()=>this.run(async()=>{
                    const ids=await core.loadModels(request,c);let added=0;for(const id of ids)if(!c.models.some(m=>m.id===id)){c.models.push({id,check:{state:"unchecked"}});added++;}
                    if(!c.model)c.model=c.models[0]?.id||"";this.drawModels(models,c);this.message.textContent=`Добавлено моделей: ${added}. Нажми «Сохранить», чтобы применить.`;
                }));
                const removeRow=edit.createDiv({cls:"kino-ai-row"});button(removeRow,"Удалить подключение",()=>{
                    removeRow.empty();removeRow.createEl("span",{text:`Удалить «${c.name}» и его модели?`});button(removeRow,"Отмена",()=>this.draw());button(removeRow,"Удалить",()=>{this.draft.connections=this.draft.connections.filter(x=>x.id!==c.id);if(this.draft.activeConnectionId===c.id)this.draft.activeConnectionId=this.draft.connections[0]?.id||"";this.selected=this.draft.connections[0]?.id||"";this.draw();});
                });
            }
            drawModels(parent,c){
                parent.empty();if(!c.models.length)parent.createEl("p",{text:"Нет моделей. Введи идентификатор ниже или загрузи список с сервера."});
                for(const m of c.models){
                    const card=parent.createDiv({cls:"kino-ai-model"}),row=card.createDiv({cls:"kino-ai-row"}),label=row.createEl("label"),radio=label.createEl("input",{type:"radio"});
                    radio.name=`default-${c.id}`;radio.checked=c.model===m.id;radio.setAttribute("aria-label",`${m.id} — использовать по умолчанию`);label.appendText(m.id);radio.addEventListener("change",()=>{c.model=m.id;});
                    button(row,"Удалить",()=>{c.models=c.models.filter(x=>x!==m);if(c.model===m.id)c.model=c.models[0]?.id||"";this.drawModels(parent,c);});
                    const check=card.createEl("p",{cls:"kino-ai-check",text:m.check?.state==="verified"?"✓ Подключение проверено":m.check?.detail||"Подключение не проверено"});
                    button(row,"Проверить",()=>this.run(async()=>{
                        check.textContent="Проверяю модель…";
                        try{
                            m.check=await core.probeModel(request,c,m);check.textContent="✓ Модель доступна";
                            this.message.textContent=`${m.id}: модель ответила. Проверка сохранится кнопкой «Сохранить».`;
                        }catch(error){
                            const detail=core.safeError(error,[c.apiKey]);m.check={state:"unverified",at:Date.now(),detail};
                            check.textContent=`Доступность не подтверждена: ${detail}`;this.message.textContent=`${m.id}: ${detail}`;
                        }
                    }));
                    const details=card.createEl("details");details.createEl("summary",{text:"Параметры подключения"});const route=details.createDiv({cls:"kino-ai-route"}),mode=field(route,"Сервер модели","select");
                    mode.createEl("option",{text:"Основной сервер подключения",value:"inherit"});mode.createEl("option",{text:"Свой сервер и протокол",value:"custom"});mode.value=m.route?"custom":"inherit";
                    const fields=route.createDiv(),invalidate=()=>{m.check={state:"unchecked"};check.textContent="Подключение не проверено";};
                    const drawRoute=()=>{fields.empty();if(m.route){this.textField(fields,"Адрес сервера модели",m.route,"baseUrl","text",invalidate);this.protocolField(fields,m.route,invalidate);}};
                    mode.addEventListener("change",()=>{if(mode.value==="custom")m.route={baseUrl:c.baseUrl,protocol:c.protocol};else delete m.route;invalidate();drawRoute();});drawRoute();
                }
            }
        }
        editor=new SettingsModal();editor.open();
    }
    if(session&&JSON.stringify(settings)!==JSON.stringify(app[sessionId].settings))await persist(settings);
    render();return settings;
};
