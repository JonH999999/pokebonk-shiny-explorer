/**
 * PokéBonk Shiny Explorer v36 — private catalog API.
 * The game-derived catalog lives only in D1. No bulk export endpoint.
 * Copyright (c) Jon. This Worker may be public; never commit production DB snapshots.
 */
const LEGENDS = new Set([144,145,146,150,151]);
const SOURCE_KINDS = new Set(["all","regular","special","totem","summoner","alpha","rift"]);
const ERROR = (code,message,status,headers={}) => json({error:code,message},status,headers);
function json(payload,status=200,headers={}) {
  return new Response(JSON.stringify(payload),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff",...headers}});
}
function bounded(value,allowed,fallback) {return allowed.includes(value)?value:fallback;}
function asInt(value,defaultValue,min,max) {const n=Number(value);return Number.isInteger(n)&&n>=min&&n<=max?n:defaultValue;}
const normSearch = v => String(v||"").trim().toLowerCase().replace(/^#/,"").slice(0,50);
function groupMap(data) {
  return Object.fromEntries(data.roster.map(p => [p.id,p]));
}
function familyMembers(data,p) {
  return Object.values(data.species).filter(s => s.family === p.family);
}
function presence(data,p,kind,map="all",stage="all") {
  const maps=map==="all"?Object.keys(data.maps):[map];
  const levels=stage==="all"?[1,2,3]:[Number(stage)];
  return maps.some(m=>levels.some(st=>(data.current[m]?.[String(st)]?.[kind]||[]).some(id=>data.species[id]?.family===p.family)));
}
function category(data,p) {
  if(presence(data,p,"regular"))return "regular";
  if(presence(data,p,"special"))return "special_only";
  if(LEGENDS.has(p.id))return "legend";
  return "no_source";
}
function matchesText(data,p,q){
  if(!q)return true;
  return String(p.id).includes(q)||p.name.toLowerCase().includes(q)||familyMembers(data,p).some(s=>s.name.toLowerCase().includes(q)||String(s.id).includes(q));
}
function avatar(p) {return {id:p.id,name:p.name,family:p.family,category:p.category};}
function summarized(data,p) {return avatar({...p,category:category(data,p)});}
function rowsForFamily(data,p,variant) {
  const result=[];
  for(const [map,zones] of Object.entries(data.current)){
    for(const [stage,zone] of Object.entries(zones)){
      const members=[];
      for(const kind of variant==="normal"?["regular","special"]:["regular"]){
        for(const id of zone[kind]||[])if(data.species[id]?.family===p.family)
          members.push({id,name:data.species[id].name,source:kind});
      }
      if(members.length)result.push({map,mapName:data.maps[map],stage:Number(stage),members});
    }
  }
  return result;
}
function specialMaps(data,p) {
  return Object.keys(data.maps).filter(m=>presence(data,p,"special",m));
}
function explain(data,p,variant) {
  const cat=category(data,p);
  if(cat==="regular") return "当前常规地图／楼层候选包含此家族；经典仍受已收藏家族及实际刷新计划影响。";
  if(cat==="special_only") return variant==="classic"
    ? "当前核对的经典自然池没有本家族常规候选；地图特殊出没不能直接证明经典异色资格。其他独立获取方式未证实。"
    : "当前常规敌人池无此家族；符合原生机制条件时，可通过地图特殊来源参与普通异色候选。";
  if(cat==="legend") return variant==="classic"
    ? "当前没有已确认的经典自然刷新路线。普通异色可能由独立神兽遭遇或圣域产生，但不能据此推断经典资格。"
    : "这是独立特殊神兽目标，不属于常规自然敌人池；仍须满足解锁、追踪或圣域条件。";
  return "当前图鉴覆盖的10张地图及其常规／特殊来源没有确认的自然刷新路线；其他获取途径与未来版本不能据此排除。";
}
function catalog(data,q) {
  const all=data.roster.filter(p=>matchesText(data,p,q)).map(p=>summarized(data,p));
  const counts={regular:0,special_only:0,legend:0,no_source:0};
  data.roster.forEach(p=>counts[category(data,p)]++);
  return {version:"v36",game:data.game,maps:Object.entries(data.maps).map(([id,name])=>({id,name})),familyCount:data.roster.length,counts,items:all};
}
function mapCounts(data,variant,stage) {
  const maps=[["all","全部地图"],...Object.entries(data.maps)];
  return {variant,stage,items:maps.map(([id,name])=>({
    id,name,regularCount:data.roster.filter(p=>presence(data,p,"regular",id,stage)).length,
    specialCount:data.roster.filter(p=>!presence(data,p,"regular",id,stage)&&presence(data,p,"special",id,stage)).length,
    count:data.roster.filter(p=>presence(data,p,"regular",id,stage)||(variant==="normal"&&presence(data,p,"special",id,stage))).length
  }))};
}
function candidates(data,map,stage,variant,q) {
  const items=[];
  for(const p of data.roster){
    if(!matchesText(data,p,q))continue;
    const regular=presence(data,p,"regular",map,stage);
    const special=variant==="normal"&&!regular&&presence(data,p,"special",map,stage);
    if(!regular&&!special)continue;
    items.push({...summarized(data,p),source:regular?"regular":"special"});
  }
  return {map,stage,variant,count:items.length,items};
}
function otherFloors(data,map,stage,variant,q) {
  if(map==="all"||stage==="all")return [];
  return data.roster.filter(p=>matchesText(data,p,q)&&!presence(data,p,"regular",map,stage)&&presence(data,p,"regular",map,"all"))
    .map(p=>({...summarized(data,p),source:"regular"}));
}
function exceptions(data,map,variant,q){
  const special=data.roster.filter(p=>category(data,p)==="special_only"&&matchesText(data,p,q)&&(map==="all"||specialMaps(data,p).includes(map))).map(p=>({...summarized(data,p),reason:explain(data,p,variant),mapNames:specialMaps(data,p).map(m=>data.maps[m])}));
  const unavailable=data.roster.filter(p=>category(data,p)==="no_source"&&matchesText(data,p,q)).map(p=>({...summarized(data,p),reason:explain(data,p,variant)}));
  const legendary=data.roster.filter(p=>category(data,p)==="legend"&&matchesText(data,p,q)).map(p=>({...summarized(data,p),reason:explain(data,p,variant)}));
  return {special,unavailable,legendary};
}
function family(data,id,variant) {
  const p=data.roster.find(x=>x.id===id||x.family===id||familyMembers(data,x).some(s=>s.id===id));
  if(!p)return null;
  const cat=category(data,p);
  return {...summarized(data,p),variant,reason:explain(data,p,variant),members:familyMembers(data,p).map(({id,name})=>({id,name})),locations:rowsForFamily(data,p,variant),
    specialMaps:cat==="special_only"?specialMaps(data,p).map(m=>({id:m,name:data.maps[m]})):[]};
}
function buildSources(data) {
  const list=[],seen=new Set(),configs=data.configs||{};
  const add=(id,map,stage,kind,evidence,note)=>{
    if(!data.species[id])return;
    const key=[id,map,stage,kind,evidence].join(":");
    if(seen.has(key))return;
    seen.add(key);
    const s=data.species[id];
    list.push({id,name:s.name,family:s.family,map,mapName:data.maps[map],stage,kind,evidence,note});
  };
  for(const map of Object.keys(data.maps)){
    const cfg=configs[map]||{};
    for(const id of cfg.residents||[])add(id,map,null,"regular","地图常驻配置","地图级来源，楼层待核实");
    for(const id of cfg.specials||[])add(id,map,null,"special","地图特殊物种","地图级来源，不证明经典资格");
    for(const st of [1,2,3]){
      const z=data.current[map]?.[String(st)]||{};
      for(const id of z.regular||[])add(id,map,st,"regular","常规敌人静态候选","当前构建楼层候选");
      for(const id of z.late||[])add(id,map,st,"regular","后期敌人静态候选","仍受局内条件约束");
      for(const id of z.special||[])add(id,map,null,"special","地图特殊来源","楼层尚未独立核验");
      for(const id of cfg.totems?.[st-1]||[])add(id,map,st,"totem","霸主 Totem","原生配置");
      for(const id of cfg.summoners?.[st-1]||[])add(id,map,st,"summoner","召唤者","原生配置");
      for(const id of z.regular||[])add(id,map,st,"alpha","普通 Alpha 静态候选","Alpha 原生选种规则尚未独立验证");
    }
  }
  return list;
}
function spawns(data,map,stage,kind,q,page){
  if(kind==="rift")return {count:0,page,pageCount:0,items:[],notice:"本局裂隙 Alpha 需要读取运行时 alphaId；公开网页没有此运行数据。"};
  const records=buildSources(data).filter(r=>(kind==="all"?r.kind!=="alpha":r.kind===kind)
    &&(map==="all"||r.map===map)&&(stage==="all"||r.stage===null||r.stage===Number(stage))
    &&(!q||String(r.id).includes(q)||r.name.toLowerCase().includes(q)));
  records.sort((a,b)=>a.id-b.id||a.map.localeCompare(b.map)||(a.stage||0)-(b.stage||0));
  const size=24,pageCount=Math.ceil(records.length/size);
  return {map,stage,source:kind,page,pageCount,count:records.length,items:records.slice((page-1)*size,page*size),
    notice:kind==="alpha"?"普通 Alpha 候选仅由静态常规池推导，尚未独立核实其原生选种规则。":"来源只证明出没信息，不直接证明普通或经典异色资格。"};
}
function originHeaders(req,env) {
  const origin=req.headers.get("Origin");
  const allow=(env.ALLOWED_ORIGIN||"https://jonh999999.github.io").split(",").map(s=>s.trim());
  if(origin&&!allow.includes(origin))return null;
  return {"Vary":"Origin","Access-Control-Allow-Origin":origin||allow[0],"Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type, X-Turnstile-Token","Access-Control-Max-Age":"600"};
}
async function verifyToken(token,req,env){
  if(!token||!env.TURNSTILE_SECRET)return false;
  try{
    const result=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({secret:env.TURNSTILE_SECRET,response:token,remoteip:req.headers.get("CF-Connecting-IP")||undefined})
    });
    const check=await result.json();
    return check.success===true&&(!check.hostname||(env.ALLOWED_HOSTNAMES||"jonh999999.github.io").split(",").map(x=>x.trim()).includes(check.hostname));
  }catch{return false}
}
async function checkRate(req,env,isDetail,headers) {
  if(!env.RL_COMMON||!env.RL_DETAILS)return ERROR("protection_unavailable","查询保护尚未配置，服务暂不可用。",503,headers);
  const ip=req.headers.get("CF-Connecting-IP")||"unknown";
  const ua=(req.headers.get("User-Agent")||"").slice(0,120);
  const bucket=ip+"|"+ua;
  try{
    const a=await env.RL_COMMON.limit({key:bucket});
    const b=isDetail?await env.RL_DETAILS.limit({key:bucket}):{success:true};
    if(a.success&&b.success)return null;
    const ok=await verifyToken(req.headers.get("X-Turnstile-Token"),req,env);
    if(ok)return null;
    return json({error:"rate_limited",message:"请求过于频繁。请稍后重试，或完成人机验证。",retryAfter:60,
      turnstileSiteKey:env.TURNSTILE_SECRET?env.TURNSTILE_SITEKEY||null:null},429,{"Retry-After":"60",...headers});
  }catch{return ERROR("rate_limit_failure","限流服务暂时不可用。",503,headers)}
}
let cache=null,cacheTime=0;
async function dataFromD1(env){
  if(cache&&Date.now()-cacheTime<30000)return cache;
  const row=await env.DB.prepare("SELECT payload FROM catalog_snapshot WHERE id = 1").first();
  if(!row||typeof row.payload!=="string")throw new Error("snapshot_missing");
  const parsed=JSON.parse(row.payload);
  if(!parsed.current||!parsed.roster||!parsed.species)throw new Error("snapshot_invalid");
  cache=parsed;cacheTime=Date.now();return parsed;
}
export default {
  async fetch(request,env){
    const headers=originHeaders(request,env);
    if(!headers)return ERROR("forbidden_origin","此来源不被允许。",403);
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
    if(request.method!=="GET")return ERROR("method_not_allowed","仅支持只读查询。",405,headers);
    const url=new URL(request.url);
    const path=url.pathname;
    if(path==="/api/v1/health")return json({status:"ok",version:"v36",dbConfigured:!!env.DB,ratelimitConfigured:!!(env.RL_COMMON&&env.RL_DETAILS)},200,headers);
    if(!path.startsWith("/api/v1/"))return ERROR("not_found","接口不存在。",404,headers);
    if(!env.DB)return ERROR("db_unavailable","私有数据库尚未部署。",503,headers);
    const q=normSearch(url.searchParams.get("q"));
    const variant=bounded(url.searchParams.get("variant"),["normal","classic"],"normal");
    let data;
    const detail=path.startsWith("/api/v1/family/")||path==="/api/v1/spawns";
    const limit=await checkRate(request,env,detail,headers);
    if(limit)return limit;
    try{data=await dataFromD1(env)}
    catch{return ERROR("data_unavailable","图鉴数据暂不可用，请稍后重试。",503,headers)}
    const map=bounded(url.searchParams.get("map"),["all",...Object.keys(data.maps)],"all");
    const stage=bounded(url.searchParams.get("stage"),["all","1","2","3"],"all");
    if(path==="/api/v1/view")return json({map,stage,variant,counts:mapCounts(data,variant,stage),candidates:candidates(data,map,stage,variant,q),
      others:url.searchParams.get("other")==="1"?otherFloors(data,map,stage,variant,q):[],
      exceptions:exceptions(data,map,variant,q)},200,headers);
    if(path==="/api/v1/catalog")return json(catalog(data,q),200,headers);
    if(path==="/api/v1/map-counts")return json(mapCounts(data,variant,stage),200,headers);
    if(path==="/api/v1/candidates")return json(candidates(data,map,stage,variant,q),200,headers);
    if(path==="/api/v1/exceptions")return json(exceptions(data,map,variant,q),200,headers);
    if(/^\/api\/v1\/family\/\d+$/.test(path)){
      const item=family(data,asInt(path.split("/").at(-1),0,1,999),variant);
      return item?json(item,200,headers):ERROR("not_found","未找到该精灵。",404,headers);
    }
    if(path==="/api/v1/spawns"){
      const source=bounded(url.searchParams.get("source"),[...SOURCE_KINDS],"all");
      const page=asInt(url.searchParams.get("page"),1,1,500);
      return json(spawns(data,map,stage,source,q,page),200,headers);
    }
    return ERROR("not_found","接口不存在。",404,headers);
  }
};
