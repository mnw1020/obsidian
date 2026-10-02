// Settings UI. Credentials are read/written only in ai_settings.json.
module.exports=async function mountAiSettings({app,container,request,onApply}){
    const path="Кино/_system/ai_settings.json";
    let settings;
    const file=app.vault.getAbstractFileByPath(path);
    if(file){try{settings=JSON.parse(await app.vault.read(file));}catch(_){throw new Error("Не удалось прочитать ai_settings.json; файл не перезаписан");}}
    settings ||= {version:1,provider:"deepseek",providers:{}};
    settings.providers ||= {};
    const defaults={openai:"gpt-4.1-mini",deepseek:"deepseek-flash"};
    for(const id of Object.keys(defaults))settings.providers[id] ||= {model:defaults[id],apiKey:""};
    const labels={openai:"OpenAI",deepseek:"DeepSeek"};
    const panel=container.createEl("details");panel.style.margin="8px 0";
    panel.createEl("summary",{text:"⚙ Настройки ИИ"});
    const form=panel.createDiv();form.style.cssText="display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 0";
    const provider=form.createEl("select");provider.setAttribute("aria-label","Провайдер ИИ");
    for(const [id,label] of Object.entries(labels)){const option=provider.createEl("option",{text:label});option.value=id;}
    provider.value=labels[settings.provider]?settings.provider:"deepseek";
    const model=form.createEl("input",{type:"text"});model.setAttribute("aria-label","Модель ИИ");model.placeholder="Модель";
    const list=form.createEl("datalist");list.id=`kino-ai-models-${Math.random().toString(36).slice(2)}`;model.setAttribute("list",list.id);
    const key=form.createEl("input",{type:"password"});key.setAttribute("aria-label","Ключ API ИИ");key.autocomplete="off";
    const refresh=form.createEl("button",{text:"Загрузить модели"});
    const save=form.createEl("button",{text:"Сохранить"});
    const remove=form.createEl("button",{text:"Удалить ключ"});
    const status=panel.createEl("p");status.style.margin="0";
    const models={openai:["gpt-4.1-mini","gpt-4.1","gpt-4o-mini"],deepseek:["deepseek-flash","deepseek-v4-pro"]};
    const drawModels=()=>{list.empty();for(const id of models[provider.value]){const o=list.createEl("option");o.value=id;}};
    const populate=()=>{
        model.value=settings.providers[provider.value].model||defaults[provider.value];key.value="";
        const exists=Boolean(settings.providers[provider.value].apiKey);
        key.placeholder=exists?"Ключ сохранён; введи новый для замены":"Вставь ключ API";
        remove.disabled=!exists;drawModels();status.textContent="";
    };
    provider.addEventListener("change",populate);populate();
    const persist=async next=>{
        const text=JSON.stringify(next,null,2)+"\n",target=app.vault.getAbstractFileByPath(path);
        if(target)await app.vault.modify(target,text);else await app.vault.create(path,text);
        settings=next;
    };
    let busy=false;
    const perform=async action=>{
        if(busy)return;busy=true;save.disabled=true;remove.disabled=true;refresh.disabled=true;provider.disabled=true;
        try{await action();}catch(error){status.textContent=String(error?.message||error).replace(/sk-[A-Za-z0-9_-]+/g,"[ключ скрыт]").slice(0,160);}
        finally{busy=false;save.disabled=false;refresh.disabled=false;provider.disabled=false;remove.disabled=!settings.providers[provider.value].apiKey;}
    };
    save.addEventListener("click",()=>perform(async()=>{
        const id=provider.value,value=model.value.trim();if(!value)throw new Error("Укажи модель");
        const next=JSON.parse(JSON.stringify(settings));next.provider=id;
        next.providers[id]={model:value,apiKey:key.value.trim()||settings.providers[id].apiKey||""};
        await persist(next);populate();status.textContent="Настройки сохранены.";await onApply(next);
    }));
    remove.addEventListener("click",()=>perform(async()=>{
        const next=JSON.parse(JSON.stringify(settings));next.providers[provider.value].apiKey="";
        await persist(next);populate();status.textContent="Ключ удалён из файла.";await onApply(next);
    }));
    refresh.addEventListener("click",()=>perform(async()=>{
        const id=provider.value,apiKey=key.value.trim()||settings.providers[id].apiKey;
        if(!apiKey)throw new Error("Сначала добавь ключ API");if(!request)throw new Error("requestUrl недоступен");
        let timer,response;
        try{response=await Promise.race([request({url:id==="deepseek"?"https://api.deepseek.com/models":"https://api.openai.com/v1/models",method:"GET",throw:false,headers:{Authorization:`Bearer ${apiKey}`}}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error("Время ожидания списка моделей истекло")),15000);})]);}
        finally{clearTimeout(timer);}
        let data;try{data=response.json||JSON.parse(response.text||"{}");}catch(_){throw new Error(`HTTP ${response.status}: ответ не является JSON`);}
        if(response.status!==200)throw new Error(`HTTP ${response.status}: список моделей недоступен`);
        const ids=(data.data||[]).map(x=>x.id).filter(x=>typeof x==="string"&&
            (id==="deepseek"||/^(gpt-|o[134](?:-|$)|chatgpt-)/.test(x)&&!/audio|realtime|image|transcrib|tts|codex|instruct|search/.test(x))).sort();
        if(!ids.length)throw new Error("Подходящих текстовых моделей не найдено");
        models[id]=ids;drawModels();status.textContent=`Получено моделей: ${ids.length}. Выбери модель или введи её название.`;
    }));
    return settings;
};
