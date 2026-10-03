// Shared, provider-independent settings and request helpers.
const protocols={responses:"Responses",chat:"Chat Completions",anthropic:"Anthropic Messages"};
const clone=value=>JSON.parse(JSON.stringify(value));
const newId=()=>`connection-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
function cleanUrl(value){
    const text=String(value||"").trim().replace(/^\[([^\]]+)\]\([^)]*\)$/, "$1");
    let url;try{url=new URL(text);}catch(_){throw new Error("Укажи полный адрес сервера: https://…");}
    if(!["https:","http:"].includes(url.protocol)||url.username||url.password||url.search||url.hash)
        throw new Error("Адрес сервера должен быть HTTP(S), без пароля, параметров и якоря");
    return url.href.replace(/\/+$/,"");
}
function normalize(value){
    if(value?.version===3&&Array.isArray(value.connections)){
        const next=clone(value);
        for(const c of next.connections){
            c.models=Array.isArray(c.models)?c.models:[];
            if(!c.models.some(m=>m.id===c.model))c.model=c.models[0]?.id||"";
        }
        if(!next.connections.some(c=>c.id===next.activeConnectionId))next.activeConnectionId=next.connections[0]?.id||"";
        return next;
    }
    // Preserve generic legacy settings. The requested Tokenator replacement is a one-time encrypted migration.
    const legacy={openai:["OpenAI","https://api.openai.com/v1","responses"],deepseek:["DeepSeek","https://api.deepseek.com","chat"],anthropic:["Claude","https://api.anthropic.com","anthropic"]};
    const connections=[];
    for(const [provider,p] of Object.entries(value?.providers||{})){
        const defaults=legacy[provider];if(!defaults)continue;
        for(const k of p.keys|| (p.apiKey?[{id:newId(),apiKey:p.apiKey}]:[])){
            const ids=[...new Set([...(k.models||p.models||[]),k.model||p.model].filter(Boolean))];
            connections.push({id:k.id||newId(),name:k.name||defaults[0],baseUrl:defaults[1],protocol:defaults[2],apiKey:k.apiKey||"",model:k.model||p.model||ids[0]||"",models:ids.map(id=>({id,check:{state:"unchecked"}}))});
        }
    }
    const active=value?.providers?.[value.provider]?.activeKeyId;
    return normalize({version:3,connections,activeConnectionId:active||connections[0]?.id||""});
}
function validate(value){
    const next=normalize(value),ids=new Set();
    for(const c of next.connections){
        if(!c.id||ids.has(c.id))throw new Error("Повторяющийся идентификатор подключения");ids.add(c.id);
        c.name=String(c.name||"").trim();if(!c.name)throw new Error("Укажи название подключения");
        c.baseUrl=cleanUrl(c.baseUrl);if(!protocols[c.protocol])throw new Error("Выбери протокол");
        c.apiKey=String(c.apiKey||"").trim();if(!c.apiKey)throw new Error("Укажи ключ API");
        const models=new Set();
        for(const m of c.models){
            m.id=String(m.id||"").trim();if(!m.id||models.has(m.id))throw new Error("Модели должны иметь непустые уникальные идентификаторы");models.add(m.id);
            if(m.route){m.route.baseUrl=cleanUrl(m.route.baseUrl);if(!protocols[m.route.protocol])throw new Error("Выбери протокол модели");}
        }
    }
    return normalize(next);
}
const connection=settings=>settings?.connections?.find(c=>c.id===settings.activeConnectionId);
function resolve(settings){
    const c=connection(settings);if(!c)throw new Error("Добавь подключение в настройках ИИ");
    const m=c.models.find(m=>m.id===c.model);if(!m)throw new Error("Добавь и выбери модель в настройках ИИ");
    const route=m.route||c;
    return {connection:c,model:m.id,baseUrl:cleanUrl(route.baseUrl),protocol:route.protocol,apiKey:c.apiKey};
}
function endpoint(baseUrl,protocol,resource){
    const base=cleanUrl(baseUrl);
    if(resource==="models")return `${base}${protocol==="anthropic"&&!base.endsWith("/v1")?"/v1":""}/models`;
    const suffix={responses:"responses",chat:"chat/completions",anthropic:"messages"}[protocol];
    if(!suffix)throw new Error("Неизвестный протокол ИИ");
    return `${base}${protocol==="anthropic"&&!base.endsWith("/v1")?"/v1":""}/${suffix}`;
}
function headers(apiKey,protocol){
    if(!String(apiKey||"").trim())throw new Error("Укажи ключ API");
    return {Authorization:`Bearer ${apiKey.trim()}`,"Content-Type":"application/json",...(protocol==="anthropic"?{"anthropic-version":"2023-06-01"}:{})};
}
function safeError(error,secrets=[]){
    let text=String(error?.message||error);
    for(const secret of secrets.filter(Boolean))text=text.split(secret).join("[ключ скрыт]");
    return text.replace(/sk-[A-Za-z0-9_-]+/g,"[ключ скрыт]").replace(/Bearer\s+\S+/gi,"Bearer [ключ скрыт]").slice(0,180);
}
async function call(request,options,timeoutMs=15000){
    if(!request)throw new Error("requestUrl недоступен");
    let timer,response;
    try{response=await Promise.race([request({...options,throw:false}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error("Время ожидания ИИ истекло")),timeoutMs);})]);}
    catch(error){throw new Error(safeError(error,[options.headers?.Authorization?.replace(/^Bearer /,"")]));}
    finally{clearTimeout(timer);}
    let data;try{data=response.json||JSON.parse(response.text||"{}");}catch(_){throw new Error(`HTTP ${response.status}: ответ не является JSON`);}
    if(response.status<200||response.status>=300||data.error){
        const code=data.error?.code||data.error?.type||"request_failed";
        const hint=response.status===401?"ключ API недействителен":response.status===402||["insufficient_quota","credit_balance_exhausted"].includes(code)?"недостаточно средств или исчерпан лимит API":response.status===429?"превышен лимит запросов":response.status===404?"сервер или модель не найдены":safeError(code);
        throw new Error(`HTTP ${response.status}: ${hint}`);
    }
    return data;
}
async function loadModels(request,c){
    const ids=[],seenPages=new Set();let after="";
    for(let page=0;page<20;page++){
        const data=await call(request,{url:endpoint(c.baseUrl,c.protocol,"models")+(after?`?after_id=${encodeURIComponent(after)}`:""),method:"GET",headers:headers(c.apiKey,c.protocol)});
        ids.push(...(data.data||[]).map(m=>m.id).filter(id=>typeof id==="string"&&id));
        if(!data.has_more||!data.last_id||seenPages.has(data.last_id))break;
        after=data.last_id;seenPages.add(after);
    }
    if(!ids.length)throw new Error("Сервер не вернул список моделей; добавь модели вручную");
    return [...new Set(ids)];
}
module.exports={protocols,clone,newId,cleanUrl,normalize,validate,connection,resolve,endpoint,headers,safeError,call,loadModels};
