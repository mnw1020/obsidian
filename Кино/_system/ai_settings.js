// Named API keys live in an encrypted file after password setup.
module.exports=async function mountAiSettings({app,container,request,onApply,copyText}){
    const path="Кино/_system/ai_settings.json";
    const encryptedPath="Кино/_system/ai_settings.enc.json";
    const sessionId=Symbol.for("kino.ai.settings.unlocked");
    const host=container.createDiv();
    const options={app,container:host,request,onApply,copyText};
    const cryptoFile=app.vault.getAbstractFileByPath("Кино/_system/ai_crypto.js");
    if(!cryptoFile)throw new Error("Не найден ai_crypto.js");
    const cryptoModule={exports:{}};new Function("module",await app.vault.read(cryptoFile))(cryptoModule);
    const crypt=cryptoModule.exports;
    let encryptedFile=app.vault.getAbstractFileByPath(encryptedPath);
    let encryptedText=encryptedFile?await app.vault.read(encryptedFile):"";
    let session=app[sessionId]?.text===encryptedText?app[sessionId]?.session:null;
    if(encryptedFile&&!session){
        const panel=host.createEl("details");panel.open=true;panel.createEl("summary",{text:"⚙ Настройки ИИ — ключи зашифрованы"});
        panel.createEl("span",{text:"Пароль (mindwork2012)"}).style.cssText="display:block;margin:8px 0;color:var(--text-muted)";
        const password=panel.createEl("input",{type:"password"});password.placeholder="Пароль для расшифровки";password.setAttribute("aria-label","Пароль для расшифровки");password.autocomplete="off";
        const unlock=panel.createEl("button",{text:"Расшифровать"});const status=panel.createEl("p");
        unlock.addEventListener("click",async()=>{
            if(unlock.disabled)return;unlock.disabled=true;
            try{
                encryptedText=await app.vault.read(encryptedFile);
                const result=await crypt.unlock(JSON.parse(encryptedText),password.value);password.value="";
                app[sessionId]={text:encryptedText,session:result.session,settings:result.settings};
                host.empty();const settings=await module.exports(options);await onApply(settings);
            }catch(error){password.value="";status.textContent=String(error?.message||error).slice(0,160);}
            finally{unlock.disabled=false;}
        });
        return null;
    }
    const labels={openai:"OpenAI / ChatGPT",deepseek:"DeepSeek",anthropic:"Claude / Opus"};
    const defaults={openai:"gpt-4.1-mini",deepseek:"deepseek-flash",anthropic:"claude-opus-5-5"};
    const presets={openai:["gpt-4.1-mini","gpt-4.1","gpt-4o-mini"],deepseek:["deepseek-flash","deepseek-v4-pro"],anthropic:["claude-opus-5-5","claude-sonnet-5-5","claude-haiku-4-5-20251001"]};
    const newId=()=>`key-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
    let settings;
    const file=app.vault.getAbstractFileByPath(path);
    const plainText=!encryptedFile&&file?await app.vault.read(file):"";
    if(session)settings=JSON.parse(JSON.stringify(app[sessionId].settings));
    else if(plainText){try{settings=JSON.parse(plainText);}catch(_){throw new Error("Не удалось прочитать ai_settings.json; файл не перезаписан");}}
    settings ||= {version:2,provider:"deepseek",providers:{}};
    const before=JSON.stringify(settings);
    settings.providers ||= {};
    for(const id of Object.keys(labels)){
        const p=settings.providers[id] ||= {model:defaults[id]};
        if(!Array.isArray(p.keys))p.keys=[];
        if(p.apiKey){p.keys.push({id:newId(),name:`${labels[id]} — основной`,apiKey:p.apiKey});}
        delete p.apiKey;
        p.activeKeyId=p.keys.some(k=>k.id===p.activeKeyId)?p.activeKeyId:(p.keys[0]?.id||"");
        p.model ||= defaults[id];
    }
    settings.version=2;
    if(!labels[settings.provider])settings.provider="deepseek";
    const persist=async next=>{
        if(!session)throw new Error("Сначала зашифруй ключи: задай пароль и нажми «Зашифровать»");
        const target=app.vault.getAbstractFileByPath(encryptedPath);
        if(!target||await app.vault.read(target)!==encryptedText)throw new Error("Файл ключей изменился. Переоткрой рекомендации и расшифруй его заново");
        const text=JSON.stringify(await crypt.seal(next,session),null,2)+"\n";
        await app.vault.modify(target,text);encryptedText=text;
        app[sessionId]={text,session,settings:JSON.parse(JSON.stringify(next))};
        settings=next;
    };
    if(session&&before!==JSON.stringify(settings))await persist(settings);
    const panel=host.createEl("details");panel.style.margin="8px 0";
    panel.createEl("summary",{text:"⚙ Настройки ИИ"});
    const security=panel.createDiv();security.style.cssText="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px";
    const securityStatus=security.createEl("span",{text:session?"Ключи расшифрованы на этом устройстве.":"Задай пароль для шифрования файла ключей."});
    security.createEl("span",{text:"Пароль (mindwork2012)"}).style.cssText="display:block;margin:8px 0;color:var(--text-muted)";
    const password=security.createEl("input",{type:"password"});password.placeholder="Пароль — минимум 10 символов";password.autocomplete="off";
    const confirmation=security.createEl("input",{type:"password"});confirmation.placeholder="Повтори пароль";confirmation.autocomplete="off";
    const encrypt=security.createEl("button",{text:"Зашифровать"});
    const lock=security.createEl("button",{text:"Заблокировать"});
    password.hidden=confirmation.hidden=encrypt.hidden=Boolean(session);lock.hidden=!session;
    panel.createEl("p",{text:"После перезапуска Obsidian файл нужно расшифровать снова."});
    const form=panel.createDiv();form.style.cssText="display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 0";
    const field=(label,tag,type)=>{
        const holder=form.createEl("label");holder.style.cssText="display:flex;flex-direction:column;gap:4px";
        holder.createEl("span",{text:label});const el=holder.createEl(tag,type?{type}:{});el.setAttribute("aria-label",label);return el;
    };
    const provider=field("Провайдер","select");
    for(const [id,label] of Object.entries(labels)){const o=provider.createEl("option",{text:label});o.value=id;}
    provider.value=settings.provider;
    const account=field("Сохранённый ключ","select");account.style.minWidth="220px";
    const model=field("Модель","select");model.style.maxWidth="100%";model.style.minWidth="220px";
    const custom=field("Своя модель","input","text");custom.placeholder="Название модели API";
    const name=field("Короткое имя / описание","input","text");name.placeholder="Например: личный, рабочий, запасной";
    const key=field("Ключ API","input","text");key.autocomplete="off";key.spellcheck=false;key.style.width="min(600px,70vw)";
    const copy=form.createEl("button",{text:"Копировать ключ"});
    const add=form.createEl("button",{text:"Добавить ключ"});
    const refresh=form.createEl("button",{text:"Загрузить модели"});
    const save=form.createEl("button",{text:"Сохранить и использовать"});
    const remove=form.createEl("button",{text:"Удалить ключ"});
    const status=panel.createEl("p");status.style.margin="0";
    let draftModels=[],busy=false;
    const current=()=>settings?.providers?.[provider.value]||{keys:[],model:defaults[provider.value]};
    const selected=()=>current().keys.find(k=>k.id===account.value);
    const drawModels=(selectedModel)=>{
        const value=selectedModel||current().model||defaults[provider.value];
        const ids=[...new Set(draftModels.filter(x=>typeof x==="string"&&x))];
        if(!ids.includes(value))ids.push(value);
        model.empty();for(const id of ids){const o=model.createEl("option",{text:id});o.value=id;}
        const other=model.createEl("option",{text:"Ввести свою модель…"});other.value="__custom__";
        model.value=value;custom.value="";custom.parentElement.style.display="none";
    };
    const showKey=()=>{
        const record=selected();name.value=record?.name||"";key.value=record?.apiKey||"";
        draftModels=record?.models||current().models||presets[provider.value];
        drawModels(record?.model||current().model);
        remove.disabled=!record;copy.disabled=!key.value;status.textContent="";
    };
    const populate=(id=current().activeKeyId)=>{
        account.empty();for(const record of current().keys){const o=account.createEl("option",{text:record.name||"Без имени"});o.value=record.id;}
        if(!current().keys.length){const o=account.createEl("option",{text:"Добавь первый ключ"});o.value="";}
        account.value=id||current().keys[0]?.id||"";showKey();
    };
    provider.addEventListener("change",()=>populate());
    account.addEventListener("change",showKey);
    model.addEventListener("change",()=>{custom.parentElement.style.display=model.value==="__custom__"?"flex":"none";});
    key.addEventListener("input",()=>{copy.disabled=!key.value;});
    populate();
    const perform=async action=>{
        if(busy)return;busy=true;
        const controls=[provider,account,model,custom,name,key,copy,add,refresh,save,remove];for(const el of controls)el.disabled=true;
        try{await action();}catch(error){status.textContent=String(error?.message||error).replace(/sk-[A-Za-z0-9_-]+/g,"[ключ скрыт]").slice(0,180);}
        finally{busy=false;for(const el of controls)el.disabled=false;remove.disabled=!selected();copy.disabled=!key.value;}
    };
    encrypt.addEventListener("click",()=>perform(async()=>{
        if(password.value!==confirmation.value)throw new Error("Пароли не совпадают");
        if(file&&await app.vault.read(file)!==plainText)throw new Error("Исходный файл изменился. Переоткрой рекомендации перед шифрованием");
        if(app.vault.getAbstractFileByPath(encryptedPath))throw new Error("Зашифрованный файл уже появился. Переоткрой рекомендации");
        const result=await crypt.create(settings,password.value);
        const text=JSON.stringify(result.envelope,null,2)+"\n";
        const target=await app.vault.create(encryptedPath,text);
        const verified=await crypt.unlock(JSON.parse(await app.vault.read(target)),password.value);
        if(JSON.stringify(verified.settings)!==JSON.stringify(settings))throw new Error("Проверка зашифрованного файла не прошла; исходник сохранён");
        encryptedFile=target;encryptedText=text;session=result.session;
        app[sessionId]={text,session,settings:JSON.parse(JSON.stringify(settings))};
        password.value=confirmation.value="";password.hidden=confirmation.hidden=encrypt.hidden=true;lock.hidden=false;
        securityStatus.textContent="Ключи зашифрованы.";
        if(file)await app.vault.delete(file);
        status.textContent="Создан ai_settings.enc.json. Незашифрованный файл удалён. Для Git используй зашифрованный файл.";
        await onApply(settings);
    }));
    lock.addEventListener("click",()=>perform(async()=>{
        delete app[sessionId];settings=null;session=null;key.value="";name.value="";password.value=confirmation.value="";
        host.empty();await module.exports(options);await onApply(null);
    }));
    copy.addEventListener("click",()=>perform(async()=>{
        if(!key.value)throw new Error("Ключ не указан");
        if(copyText)await copyText(key.value);
        else if(typeof navigator!=="undefined"&&navigator.clipboard)await navigator.clipboard.writeText(key.value);
        else throw new Error("Копирование недоступно; выдели ключ и нажми Ctrl+C");
        status.textContent="Ключ скопирован.";
    }));
    add.addEventListener("click",()=>{
        const existing=Array.from(account.options||account.children).find(o=>o.value==="__new__");
        if(!existing){const o=account.createEl("option",{text:"Новый ключ"});o.value="__new__";}
        account.value="__new__";showKey();name.focus();status.textContent="Введи имя и ключ, затем нажми «Сохранить и использовать».";
    });
    save.addEventListener("click",()=>perform(async()=>{
        const id=provider.value,value=(model.value==="__custom__"?custom.value:model.value).trim();
        if(!value)throw new Error("Укажи модель");if(!name.value.trim())throw new Error("Укажи короткое имя ключа");if(!key.value.trim())throw new Error("Укажи ключ API");
        const next=JSON.parse(JSON.stringify(settings));const p=next.providers[id];
        let record=p.keys.find(k=>k.id===account.value);
        if(!record){record={id:newId()};p.keys.push(record);}
        Object.assign(record,{name:name.value.trim(),apiKey:key.value.trim(),model:value,models:[...draftModels]});
        next.provider=id;p.activeKeyId=record.id;p.model=value;
        await persist(next);populate(record.id);status.textContent="Ключ, имя и модель сохранены. Этот ключ используется для рекомендаций.";await onApply(next);
    }));
    remove.addEventListener("click",()=>perform(async()=>{
        const record=selected();if(!record)return;
        const next=JSON.parse(JSON.stringify(settings)),p=next.providers[provider.value];
        p.keys=p.keys.filter(k=>k.id!==record.id);
        if(p.activeKeyId===record.id){p.activeKeyId=p.keys[0]?.id||"";p.model=p.keys[0]?.model||p.model;}
        await persist(next);populate();status.textContent="Ключ удалён из файла.";await onApply(next);
    }));
    refresh.addEventListener("click",()=>perform(async()=>{
        const id=provider.value,apiKey=key.value.trim();if(!apiKey)throw new Error("Сначала добавь ключ API");if(!request)throw new Error("requestUrl недоступен");
        const base={openai:"https://api.openai.com/v1/models",deepseek:"https://api.deepseek.com/models",anthropic:"https://api.anthropic.com/v1/models"}[id];
        const headers=id==="anthropic"?{"x-api-key":apiKey,"anthropic-version":"2023-06-01"}:{Authorization:`Bearer ${apiKey}`};
        let ids=[],after="";
        for(let page=0;page<20;page++){
            let timer,response;
            try{response=await Promise.race([request({url:base+(after?`?after_id=${encodeURIComponent(after)}`:""),method:"GET",throw:false,headers}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error("Время ожидания списка моделей истекло")),15000);})]);}
            finally{clearTimeout(timer);}
            let data;try{data=response.json||JSON.parse(response.text||"{}");}catch(_){throw new Error(`HTTP ${response.status}: ответ не является JSON`);}
            if(response.status!==200)throw new Error(`HTTP ${response.status}: список моделей недоступен`);
            ids.push(...(data.data||[]).map(x=>x.id).filter(x=>typeof x==="string"&&(id!=="openai"||/^(gpt-|o[134](?:-|$)|chatgpt-)/.test(x)&&!/audio|realtime|image|transcrib|tts|codex|instruct|search/.test(x))));
            if(id!=="anthropic"||!data.has_more||!data.last_id||after===data.last_id)break;
            after=data.last_id;
        }
        ids=[...new Set(ids)].sort();if(!ids.length)throw new Error("Подходящих текстовых моделей не найдено");
        const chosen=model.value==="__custom__"?custom.value:model.value;draftModels=ids;drawModels(chosen);
        // Save the list immediately, so a Dataview rerender cannot reset it to presets.
        const next=JSON.parse(JSON.stringify(settings));const record=next.providers[id].keys.find(k=>k.id===account.value);
        if(record&&record.apiKey===apiKey){record.models=ids;if(session)await persist(next);else settings=next;}
        status.textContent=`Получено моделей: ${ids.length}. Все доступны в списке «Модель».`;
    }));
    return settings;
};
