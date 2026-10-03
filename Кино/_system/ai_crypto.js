// Password is never persisted. AES-GCM authenticates the encrypted settings.
const ITERATIONS=600000;
const encode=new TextEncoder(),decode=new TextDecoder();
const cryptoApi=()=>{if(!globalThis.crypto?.subtle)throw new Error("Web Crypto недоступен в этой версии Obsidian");return globalThis.crypto;};
const base64=bytes=>{let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);};
const unbase64=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const aad=encode.encode("kino-ai-settings:v1");
async function derive(password,salt,iterations){
    const c=cryptoApi(),material=await c.subtle.importKey("raw",encode.encode(password),"PBKDF2",false,["deriveKey"]);
    return c.subtle.deriveKey({name:"PBKDF2",hash:"SHA-256",salt,iterations},material,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
function validate(envelope){
    if(envelope?.format!=="kino-ai-encrypted"||envelope.version!==1||envelope.cipher!=="AES-256-GCM"||envelope.kdf!=="PBKDF2-SHA256"||
        !Number.isInteger(envelope.iterations)||envelope.iterations<100000||envelope.iterations>2000000||
        typeof envelope.salt!=="string"||typeof envelope.iv!=="string"||typeof envelope.data!=="string"||envelope.data.length>10*1024*1024)
        throw new Error("Неизвестный или повреждённый формат зашифрованного файла");
    const salt=unbase64(envelope.salt),iv=unbase64(envelope.iv);
    if(salt.length!==32||iv.length!==12)throw new Error("Повреждённые параметры шифрования");
    return {salt,iv};
}
async function seal(settings,session){
    const iv=cryptoApi().getRandomValues(new Uint8Array(12));
    const data=await cryptoApi().subtle.encrypt({name:"AES-GCM",iv,additionalData:aad,tagLength:128},session.key,encode.encode(JSON.stringify(settings)));
    return {format:"kino-ai-encrypted",version:1,cipher:"AES-256-GCM",kdf:"PBKDF2-SHA256",iterations:session.iterations,salt:base64(session.salt),iv:base64(iv),data:base64(new Uint8Array(data))};
}
async function create(settings,password){
    if(typeof password!=="string"||password.length<10)throw new Error("Пароль должен содержать не меньше 10 символов");
    const salt=cryptoApi().getRandomValues(new Uint8Array(32));
    const session={key:await derive(password,salt,ITERATIONS),salt,iterations:ITERATIONS};
    return {session,envelope:await seal(settings,session)};
}
async function unlock(envelope,password){
    const {salt,iv}=validate(envelope);
    const key=await derive(password,salt,envelope.iterations);
    let text;
    try{text=decode.decode(await cryptoApi().subtle.decrypt({name:"AES-GCM",iv,additionalData:aad,tagLength:128},key,unbase64(envelope.data)));}
    catch(_){throw new Error("Неверный пароль или зашифрованный файл повреждён");}
    const settings=JSON.parse(text);
    if(!settings||typeof settings!=="object"||!(settings.providers||settings.version===3&&Array.isArray(settings.connections)))throw new Error("В файле нет настроек ИИ");
    return {settings,session:{key,salt,iterations:envelope.iterations}};
}
module.exports={create,unlock,seal};
