import test from "node:test";
import assert from "node:assert/strict";
import api from "../src/index.js";

const data={
 game:"mwoblfeo",
 maps:{forest:"青翠森林",desert:"岩石沙漠"},
 roster:[
  {id:1,name:"妙蛙种子",family:1},
  {id:95,name:"大岩蛇",family:95},
  {id:206,name:"土龙弟弟",family:206},
  {id:150,name:"超梦",family:150},
  {id:243,name:"雷公",family:243}
 ],
 species:{
  1:{id:1,name:"妙蛙种子",family:1},
  95:{id:95,name:"大岩蛇",family:95},
  208:{id:208,name:"大钢蛇",family:95},
  206:{id:206,name:"土龙弟弟",family:206},
  150:{id:150,name:"超梦",family:150},
  243:{id:243,name:"雷公",family:243}
 },
 current:{
  forest:{
   1:{regular:[1],special:[206],late:[],resident:[]},
   2:{regular:[],special:[206],late:[],resident:[]},
   3:{regular:[],special:[],late:[],resident:[]}
  },
  desert:{
   1:{regular:[95],special:[208],late:[],resident:[]},
   2:{regular:[95],special:[208],late:[],resident:[]},
   3:{regular:[],special:[],late:[],resident:[]}
  }
 },
 configs:{
  forest:{residents:[1],specials:[206],totems:[[1],[],[]],summoners:[[],[],[]]},
  desert:{residents:[95],specials:[208],totems:[[],[],[]],summoners:[[],[],[]]}
 }
};
function makeEnv({common=true,detail=true,allow=true}={}){
 return {
  DB:{prepare(){return {async first(){return {payload:JSON.stringify(data)}}}}},
  RL_COMMON:common?{async limit(){return {success:allow}}}:undefined,
  RL_DETAILS:detail?{async limit(){return {success:allow}}}:undefined,
  ALLOWED_ORIGIN:"https://jonh999999.github.io",
  ALLOWED_HOSTNAMES:"jonh999999.github.io"
 };
}
async function call(path,env=makeEnv(),origin="https://jonh999999.github.io"){
 const req=new Request("https://example.workers.dev"+path,{headers:{Origin:origin,"CF-Connecting-IP":"198.51.100.4","User-Agent":"test"}});
 const res=await api.fetch(req,env);
 return {status:res.status,data:await res.json(),headers:res.headers};
}
test("health and no public catalog snapshot",async()=>{
 const health=await call("/api/v1/health");
 assert.equal(health.status,200);
 const r=await call("/api/v1/catalog");
 assert.equal(r.status,200);
 assert.equal(r.data.items.length,5);
 assert.equal(r.data.items[2].category,"special_only");
 assert.equal(r.data.items[3].category,"legend");
 assert.equal(r.data.items[4].category,"no_source");
 assert.equal(JSON.stringify(r.data).includes('"current"'),false);
 assert.equal(JSON.stringify(r.data).includes('"configs"'),false);
});
test("classic and normal have separate verified candidate sets",async()=>{
 const normal=await call("/api/v1/view?map=all&stage=all&variant=normal");
 const classic=await call("/api/v1/view?map=all&stage=all&variant=classic");
 assert.equal(normal.data.candidates.count,3);
 assert.equal(classic.data.candidates.count,2);
 assert.deepEqual(normal.data.exceptions.special.map(x=>x.id),[206]);
 assert.deepEqual(classic.data.exceptions.special.map(x=>x.id),[206]);
 assert.equal(classic.data.candidates.items.some(x=>x.id===206),false);
});
test("Onix family keeps regular classic route despite Steelix special source",async()=>{
 const res=await call("/api/v1/family/208?variant=classic");
 assert.equal(res.data.id,95);
 assert.equal(res.data.locations.some(x=>x.members.some(m=>m.id===95)),true);
});
test("other floors only shows alternate-floor regular families",async()=>{
 const res=await call("/api/v1/view?map=forest&stage=2&variant=classic&other=1");
 assert.deepEqual(res.data.others.map(x=>x.id),[1]);
});
test("spawn index is paged and never dumps the raw database",async()=>{
 const res=await call("/api/v1/spawns?source=all&map=all&stage=all&page=1");
 assert.equal(res.status,200);
 assert.ok(res.data.items.length<=24);
 assert.equal(JSON.stringify(res.data).includes('"current"'),false);
});
test("rate-limit, invalid origin, missing protection and method guarding",async()=>{
 assert.equal((await call("/api/v1/catalog",makeEnv({allow:false}))).status,429);
 assert.equal((await call("/api/v1/catalog",makeEnv({common:false}))).status,503);
 const denied=await call("/api/v1/catalog",makeEnv(),"https://evil.example");
 assert.equal(denied.status,403);
 const res=await api.fetch(new Request("https://example.workers.dev/api/v1/catalog",{method:"POST"}),makeEnv());
 assert.equal(res.status,405);
});
