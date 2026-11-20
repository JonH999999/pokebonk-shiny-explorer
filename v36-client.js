/* PokéBonk v36 client — no source-pool database in browser. */
(() => {
"use strict";
const $=id=>document.getElementById(id);
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const base=String(window.PB_V36_API_BASE||"").replace(/\/+$/,"");
const state={mode:"shiny",map:"all",stage:"all",variant:"normal",q:"",source:"all",layout:"species",page:1,hideOwned:false,mark:false};
const legends={144:["天空冰川","天空之湖圣域"],145:["风暴海岸","雷霆海角圣域"],146:["岩石沙漠","沙漠圣域"],150:["华蓝洞窟","洞窟深处圣域"],151:["青翠森林","森林圣域"]};
const getOwned=k=>{try{return new Set(JSON.parse(localStorage.getItem("pb-exclude-owned-"+k)||"[]").map(Number))}catch{return new Set()}};
const owned={normal:getOwned("normal"),classic:getOwned("classic")};
let epoch=0,queryTimer,challengePromise;
const style=document.createElement("style");
style.textContent=".v36Bar{margin:0 0 14px}.v36Source{margin:0 0 14px}.v36Source[hidden]{display:none!important}.v36Status{padding:11px 14px;margin:8px 0 12px;border:1px solid var(--border);background:var(--card);border-radius:9px;color:var(--muted);font-size:13px}.v36Status[hidden]{display:none}.v36Error{border-color:var(--gold);color:var(--ink)}.v36Page{display:flex;justify-content:center;align-items:center;gap:12px;margin:17px auto}.v36Challenge{position:fixed;inset:0;background:#000b;z-index:100;display:flex;align-items:center;justify-content:center}.v36ChallengeBox{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:23px;display:grid;gap:15px;max-width:90vw}body.v36Spawn #variantCluster,body.v36Spawn #othersWrap,body.v36Spawn #hideOwnedWrap,body.v36Spawn #mark,body.v36Spawn #collectionModeHint,body.v36Spawn #classicGap,body.v36Spawn #legendarySection,body.v36Spawn #specialMetric{display:none!important}.v36Long{line-height:1.75}";
document.head.append(style);
function notice(message,error=false){const e=$("v36Status");e.textContent=message||"";e.hidden=!message;e.classList.toggle("v36Error",error)}
async function challenge(sitekey){
 if(challengePromise)return challengePromise;
 challengePromise=new Promise(async resolve=>{
  const overlay=document.createElement("div");overlay.className="v36Challenge";
  overlay.innerHTML='<div class="v36ChallengeBox" role="dialog" aria-modal="true"><strong>需要验证访问</strong><p>查询过于频繁，请完成人机验证。</p><div id="v36Verify"></div><button id="v36Cancel" type="button">取消</button></div>';
  document.body.append(overlay);
  const end=token=>{overlay.remove();challengePromise=null;resolve(token||null)};
  $("v36Cancel").onclick=()=>end(null);
  try{
   if(!window.turnstile)await new Promise((ok,no)=>{const s=document.createElement("script");s.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";s.onload=ok;s.onerror=no;document.head.append(s)});
   window.turnstile.render($("v36Verify"),{sitekey,callback:end,"error-callback":()=>end(null),"expired-callback":()=>end(null)});
  }catch{end(null)}
 });
 return challengePromise;
}
async function api(path,params={},token){
 if(!/^https:\/\//.test(base)||base.includes("REPLACE_"))throw Error("v36 私有 API 尚未配置或部署；原版线上网站不受影响。");
 const q=new URLSearchParams(Object.entries(params).filter(([,v])=>v!==null&&v!==undefined));
 const response=await fetch(base+path+(q.size?"?"+q:""),{cache:"no-store",mode:"cors",headers:token?{"X-Turnstile-Token":token}:{}});
 let obj;try{obj=await response.json()}catch{throw Error("服务端返回内容无效")}
 if(response.status===429&&obj.turnstileSiteKey&&!token){const passed=await challenge(obj.turnstileSiteKey);if(passed)return api(path,params,passed)}
 if(!response.ok)throw Error(obj.message||"查询失败（"+response.status+"）");
 return obj;
}
const imageURL=id=>"https://pokebonk.com/assets/portraits/"+id+".png";
function picture(id){
 const isClassic=state.variant==="classic";
 const color=Math.round((id===3?.486:.22+(id*.618034%1)*.56)*360);
 return '<div class="avatar shinyAvatar"><img src="'+(isClassic?"https://pokebonk.com/assets/portraits-shiny/"+id+".png":imageURL(id))+'" style="'+(isClassic?"":"filter:hue-rotate("+color+"deg)")+'" loading="lazy" alt="精灵 #'+id+'"></div>';
}
function hasOwned(p){return owned[state.variant].has(p.id)}
function visible(p){return !state.hideOwned||!hasOwned(p)}
function toggleOwned(p){const s=owned[state.variant];s.has(p.id)?s.delete(p.id):s.add(p.id);localStorage.setItem("pb-exclude-owned-"+state.variant,JSON.stringify([...s]));refresh()}
function card(p,tag,desc,open){
 const el=document.createElement("button");el.type="button";el.className="mon";
 el.innerHTML=picture(p.id)+'<div class="name">'+esc(p.name)+'<small>#'+p.id+'</small></div><div class="tags"><span class="tag '+(tag==="常规出没"?"reg":"spe")+'">'+esc(tag)+'</span>'+(hasOwned(p)?'<span class="tag old">✓ 已收集</span>':"")+'</div><div class="loc">'+esc(desc||"点击查看详情")+'</div>';
 const img=el.querySelector(".avatar img");let fallback=false;
 img.onerror=()=>{if(state.variant==="classic"&&!fallback){fallback=true;img.src=imageURL(p.id);img.style.filter="hue-rotate("+Math.round((.22+(p.id*.618034%1)*.56)*360)+"deg)";return}img.style.display="none";img.parentElement.textContent="#"+p.id};
 el.onclick=()=>state.mark?toggleOwned(p):open();
 return el;
}
function section(title,description,nodes){
 const sec=document.createElement("section"),heading=document.createElement("div"),grid=document.createElement("div");
 heading.className="section";heading.innerHTML="<div><h3>"+esc(title)+" <span class='secCount'>"+nodes.length+" 项</span></h3><p>"+esc(description)+"</p></div>";
 grid.className="cards";if(nodes.length)nodes.forEach(n=>grid.append(n));else grid.innerHTML='<p class="empty">当前筛选没有符合条件的目标。</p>';
 sec.append(heading,grid);$("results").append(sec);
}
function modal(title,html){$("detailTitle").textContent=title;$("detail").innerHTML=html;$("modalBG").classList.add("open")}
async function detail(p){
 try{
  const d=await api("/api/v1/family/"+p.id,{variant:state.variant});
  const rows=d.locations.map(r=>'<tr><td>'+esc(r.mapName)+'</td><td>第'+r.stage+'层</td><td>'+r.members.map(x=>esc(x.name)+" #"+x.id+(x.source==="special"?"（特殊出没）":"")).join("、")+'</td></tr>').join("");
  modal(d.name+" · #"+d.id,'<div class="playerHint">'+esc(d.reason)+'</div><p>家族：'+esc(d.members.map(x=>x.name+" #"+x.id).join("、"))+'</p>'
   +(d.specialMaps.length?'<p>地图级特殊来源：'+esc(d.specialMaps.map(x=>x.name).join("、"))+'</p>':"")
   +(rows?'<table class="detailTable"><tr><th>地图</th><th>楼层</th><th>家族成员</th></tr>'+rows+'</table>':'<p class="empty">当前类型没有已核实的常规楼层自然候选。</p>')
   +'<p class="muted footnote">特殊地图来源不代表经典自然资格，也不保证每个楼层都能生成特殊敌人。</p>');
 }catch(e){notice(e.message,true)}
}
function legendDetail(p){
 const g=legends[p.id];
 modal(p.name+" · #"+p.id,'<p class="playerHint">'+(state.variant==="classic"?"当前经典自然池无已确认路线；普通异色独立神兽遭遇不证明经典资格。":"独立神兽遭遇与普通自然敌人池分开判断，仍受解锁、追踪和本局条件约束。")+'</p><p>普通异色独立遭遇及第4层圣域：'+esc(g[0]+" · "+g[1])+'</p>'+(p.id===150?'<p>超梦还存在第2／3层额外首领事件。</p>':""));
}
function legendsRender(items){
 const sect=$("legendarySection");sect.style.display="block";$("specialMetric").style.display="flex";
 $("countTotal").textContent=items.length;$("labelTotal").textContent="特殊神兽";
 const h=sect.querySelector(".legendaryFoldLead strong"),sub=sect.querySelector(".legendaryFoldLead > span");
 if(h)h.textContent=state.variant==="classic"?"🌟 特殊神兽 · 经典自然池无路线":"🌟 特殊神兽异色";
 if(sub)sub.textContent="独立特殊遭遇 · 圣域 · 与常规自然池独立";
 $("legendaryQuickStats").textContent=state.variant==="classic"?"五只神兽当前没有已确认的经典自然路线":"普通异色可通过独立特殊遭遇或圣域获取";
 $("legendaryMapSub").textContent="神兽特殊机制不同于常规自然池，不能直接推断经典异色资格。";
 const grid=$("legendaryCards"),dist=$("legendaryDistribution");grid.replaceChildren();dist.replaceChildren();
 for(const p of items){
  const g=legends[p.id];if(!g)continue;
  const note=document.createElement("div");note.innerHTML="<strong>"+esc(p.name)+"</strong><span>特殊遭遇／圣域</span><small>"+esc(g[0])+"</small>";dist.append(note);
  if(visible(p))grid.append(card(p,state.variant==="classic"?"经典自然池无路线":"特殊神兽",g[0]+" · "+g[1],()=>legendDetail(p)));
 }
 if(!grid.children.length)grid.innerHTML='<p class="empty">没有符合当前条件的神兽。</p>';
}
function mapsRender(items){
 $("maps").replaceChildren();
 for(const m of items){
  const btn=document.createElement("button");btn.className=m.id===state.map?"active":"";
  btn.innerHTML="<b>"+esc(m.name)+"</b><small>"+m.count+" 种候选</small>";
  btn.onclick=()=>{state.map=m.id;state.page=1;refresh()};$("maps").append(btn);
 }
}
function updateControls(){
 document.querySelectorAll("[data-variant]").forEach(b=>b.classList.toggle("active",b.dataset.variant===state.variant));
 document.querySelectorAll("[data-stage]").forEach(b=>b.classList.toggle("active",b.dataset.stage===state.stage));
 for(const type of ["mode","source","layout"])document.querySelectorAll("[data-v36-"+type+"]").forEach(b=>b.classList.toggle("active",b.dataset["v36"+type.charAt(0).toUpperCase()+type.slice(1)]===state[type]));
 document.body.classList.toggle("v36Spawn",state.mode==="spawn");
 $("v36SourceControls").hidden=state.mode!=="spawn";
 $("collectionModeHint").hidden=!state.mark||state.mode==="spawn";
 $("mark").classList.toggle("active",state.mark);$("mark").textContent=state.mark?"✓ 完成收藏标记":"☑ 标记已收集";
}
function shinyRender(view){
 $("title").textContent=view.counts.items.find(m=>m.id===state.map)?.name||"全部地图";
 $("subtitle").textContent=(state.stage==="all"?"全部楼层":"第"+state.stage+"层")+" · "+(state.variant==="normal"?"普通异色":"经典异色")+" · 按进化家族统计";
 const regular=view.candidates.items.filter(p=>p.source==="regular"&&visible(p));
 $("countDirect").textContent=regular.length;$("labelDirect").textContent="常规自然候选";
 $("countOther").textContent=view.candidates.items.filter(hasOwned).length;$("labelOther").textContent="候选已收藏";
 $("results").replaceChildren();
 section("常规自然池候选","普通与经典共用常规地图／楼层候选；经典还受家族收藏与实际刷新计划约束。",
  regular.map(p=>card(p,"常规出没","点击查看家族的具体地图与楼层",()=>detail(p))));
 section(state.variant==="classic"?"特殊家族 · 经典自然池无路线":"特殊家族 · 普通异色特殊来源",
  state.variant==="classic"?"地图特殊来源不会自动获得经典自然异色资格。":"没有常规敌人来源，但普通异色具有特殊来源。",
  view.exceptions.special.filter(visible).map(p=>card(p,state.variant==="classic"?"经典自然池无路线":"特殊出没",p.reason,()=>detail(p))));
 section("当前图鉴未发现自然路线的目标","保留全局目标及原因；不代表未来版本或其他获取方式永久不存在。",
  view.exceptions.unavailable.filter(visible).map(p=>card(p,"无确认路线",p.reason,()=>detail(p))));
 legendsRender(view.exceptions.legendary);
}
function sourceCard(r){
 return card({id:r.id,name:r.name},r.kind==="regular"?"普通敌人":r.kind==="special"?"特殊物种":r.kind==="totem"?"霸主":r.kind==="summoner"?"召唤者":"Alpha 候选",
  r.mapName+(r.stage?" · 第"+r.stage+"层":" · 地图级")+" · "+r.evidence,
  ()=>modal(r.name+" · #"+r.id,'<p class="playerHint">'+esc(r.note)+'</p><p>地图：'+esc(r.mapName)+'</p><p>来源：'+esc(r.evidence)+'</p><p>出没来源不能直接证明经典或普通异色资格。</p>'));
}
function spawnRender(data){
 $("title").textContent="全部出没";$("subtitle").textContent="独立出没来源索引 · 分页查询";
 $("countDirect").textContent=data.count;$("labelDirect").textContent="来源记录";
 $("countOther").textContent=data.pageCount;$("labelOther").textContent="总页数";
 $("specialMetric").style.display="none";$("legendarySection").style.display="none";
 $("v36EvidenceNote").textContent=data.notice;$("results").replaceChildren();
 if(state.layout==="map"){
  const groups=new Map();
  data.items.forEach(r=>{const key=r.mapName+(r.stage?" · 第"+r.stage+"层":" · 地图级");if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r)});
  for(const [name,items]of groups)section(name,"本页来源记录",items.map(sourceCard));
 }else{
  const groups=new Map();
  data.items.forEach(r=>{if(!groups.has(r.id))groups.set(r.id,[]);groups.get(r.id).push(r)});
  section("全部出没 · 按精灵","当前仅展示分页数据；来源不等于经典异色资格。",
   [...groups.values()].map(items=>card(items[0],"出没来源",items.map(r=>r.mapName+(r.stage?" S"+r.stage:"")+" · "+r.kind).join("；"),
    ()=>modal(items[0].name+" · #"+items[0].id,"<p>"+esc(items.map(r=>r.mapName+" · "+r.evidence).join("；"))+"</p>"))));
 }
 const nav=document.createElement("div");nav.className="v36Page";const prev=document.createElement("button"),next=document.createElement("button");
 prev.textContent="上一页";next.textContent="下一页";prev.disabled=state.page<=1;next.disabled=state.page>=data.pageCount;
 prev.onclick=()=>{state.page--;refresh()};next.onclick=()=>{state.page++;refresh()};
 nav.append(prev,document.createTextNode("第 "+state.page+" / "+Math.max(1,data.pageCount)+" 页"),next);$("results").append(nav);
}
async function refresh(){
 const call=++epoch;updateControls();notice("正在查询…");
 try{
  if(state.mode==="shiny"){
   const view=await api("/api/v1/view",{map:state.map,stage:state.stage,variant:state.variant,q:state.q});
   if(call!==epoch)return;mapsRender(view.counts.items);shinyRender(view);
  }else{
   const [counts,data]=await Promise.all([
    api("/api/v1/map-counts",{variant:state.variant,stage:state.stage}),
    api("/api/v1/spawns",{map:state.map,stage:state.stage,source:state.source,q:state.q,page:state.page})
   ]);
   if(call!==epoch)return;mapsRender(counts.items);spawnRender(data);
  }
  notice("");
 }catch(e){if(call===epoch)notice(e.message,true)}
}
function init(){
 const bar=document.createElement("div");bar.className="panel controls v36Bar";
 bar.innerHTML='<div class="cluster"><span>查询模式</span><button type="button" data-v36-mode="shiny">✨ 异色筛选</button><button type="button" data-v36-mode="spawn">🗺️ 全部出没</button></div><small class="muted">v36 · 私有数据库按需查询</small>';
 $("maps").insertAdjacentElement("beforebegin",bar);
 const panel=document.createElement("div");panel.id="v36SourceControls";panel.className="panel v36Source";
 const buttons=[["all","全部来源"],["regular","普通敌人"],["special","特殊物种"],["totem","霸主"],["summoner","召唤者"],["alpha","Alpha 候选"],["rift","裂隙 Alpha"]];
 panel.innerHTML='<div class="controls"><div class="cluster"><span>来源类型</span>'+buttons.map(([k,t])=>'<button data-v36-source="'+k+'">'+t+'</button>').join("")+'</div><div class="cluster"><span>排列方式</span><button data-v36-layout="species">按精灵</button><button data-v36-layout="map">按地图</button></div></div><p class="muted" id="v36EvidenceNote"></p>';
 $("search").closest(".panel").insertAdjacentElement("afterend",panel);
 const n=document.createElement("div");n.id="v36Status";n.className="v36Status";n.hidden=true;$("maps").insertAdjacentElement("beforebegin",n);
 document.querySelector("[data-variant]").closest(".cluster").id="variantCluster";$("others").closest("label").id="othersWrap";$("hideOwned").closest("label").id="hideOwnedWrap";
 bar.onclick=e=>{const b=e.target.closest("[data-v36-mode]");if(b){state.mode=b.dataset.v36Mode;state.page=1;state.mark=false;refresh()}};
 panel.onclick=e=>{const s=e.target.closest("[data-v36-source]"),l=e.target.closest("[data-v36-layout]");
  if(s){state.source=s.dataset.v36Source;state.page=1;refresh()}if(l){state.layout=l.dataset.v36Layout;refresh()}};
 document.querySelectorAll("[data-variant]").forEach(b=>b.onclick=()=>{state.variant=b.dataset.variant;refresh()});
 document.querySelectorAll("[data-stage]").forEach(b=>b.onclick=()=>{state.stage=b.dataset.stage;state.page=1;refresh()});
 $("search").oninput=e=>{state.q=e.target.value;state.page=1;clearTimeout(queryTimer);queryTimer=setTimeout(refresh,240)};
 $("hideOwned").onchange=e=>{state.hideOwned=e.target.checked;refresh()};
 $("others").onchange=e=>{refresh()};
 $("mark").onclick=()=>{state.mark=!state.mark;updateControls()};
 $("finishMark").onclick=()=>{state.mark=false;updateControls()};
 $("specialMetric").onclick=()=>{const fold=$("legendaryFold");fold.open=!fold.open;$("specialMetric").setAttribute("aria-expanded",String(fold.open))};
 $("close").onclick=()=>$("modalBG").classList.remove("open");$("modalBG").onclick=e=>{if(e.target===$("modalBG"))$("modalBG").classList.remove("open")};
 document.addEventListener("keydown",e=>{if(e.key==="Escape")$("modalBG").classList.remove("open")});
 try{if(localStorage.getItem("pb-theme")==="light"){document.body.classList.add("light");$("theme").textContent="☾ 深色模式"}}catch{}
 $("theme").onclick=()=>{document.body.classList.toggle("light");const t=document.body.classList.contains("light")?"light":"dark";$("theme").textContent=t==="light"?"☾ 深色模式":"☀ 亮色模式";try{localStorage.setItem("pb-theme",t)}catch{}};
 $("importBtn").onclick=()=>$("importFile").click();
 $("importFile").onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const d=JSON.parse(await f.text());for(const k of ["normal","classic"])if(Array.isArray(d[k])){owned[k]=new Set(d[k].map(Number).filter(Number.isFinite));localStorage.setItem("pb-exclude-owned-"+k,JSON.stringify([...owned[k]]))}alert("收藏数据已导入");refresh()}catch{alert("收藏数据格式错误")}e.target.value=""};
 $("export").onclick=()=>{const blob=new Blob([JSON.stringify({normal:[...owned.normal],classic:[...owned.classic]},null,2)],{type:"application/json"}),u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download="pokebonk-shiny-owned.json";a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)};
 $("classicGap").style.display="none";
 updateControls();refresh();
}
init();
})();
