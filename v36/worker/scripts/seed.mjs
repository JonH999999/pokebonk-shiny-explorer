/**
 * One-time private data import from a locally held trusted v35 index.html.
 * Never commit .private/ or any generated SQL/data. No secret or DB data is sent to GitHub.
 *
 * Usage: node scripts/seed.mjs --input path/to/index-v35.html
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
const argv=process.argv;
const file=argv[argv.indexOf("--input")+1];
if(!file||!fs.existsSync(file)){
  console.error("Usage: node scripts/seed.mjs --input /private/path/index-v35.html");
  process.exit(2);
}
const html=fs.readFileSync(file,"utf8");
const match=html.match(/<script id="db" type="application\/json">([\s\S]*?)<\/script>/);
if(!match)throw new Error("v35 source has no embedded DB; pass a trusted original v35 backup");
const db=JSON.parse(match[1]);
if(db.roster?.length!==138||Object.keys(db.current||{}).length!==10)throw new Error("Unexpected catalog dimensions; inspect source before importing");
const conf=html.match(/const configs\s*=\s*(\{[\s\S]*?\});/);
if(!conf)throw new Error("v35 spawn configuration missing; refusing incomplete source import");
db.configs=vm.runInNewContext("("+conf[1]+")",Object.create(null),{timeout:2000});
if(Object.keys(db.configs).length!==10)throw new Error("Unexpected source configuration map count");
const has=(p,kind)=>Object.values(db.current).some(z=>Object.values(z).some(x=>(x[kind]||[]).some(id=>db.species[id]?.family===p.family)));
const special=db.roster.filter(p=>!has(p,"regular")&&has(p,"special")).map(p=>p.id);
const noSource=db.roster.filter(p=>!has(p,"regular")&&!has(p,"special")&&![144,145,146,150,151].includes(p.id)).map(p=>p.id);
const regular=db.roster.filter(p=>has(p,"regular")).length;
if(regular!==123||special.join(",")!=="206,207,211,231"||noSource.join(",")!=="243,244,245,249,250,251")throw new Error("Data classification mismatch: "+JSON.stringify({regular,special,noSource}));
const payload=JSON.stringify(db);
const sha256=crypto.createHash("sha256").update(payload).digest("hex");
const quote=str=>"'"+str.replace(/'/g,"''")+"'";
const sql="INSERT INTO catalog_snapshot (id,payload,sha256,imported_at) VALUES (1,"+quote(payload)+","+quote(sha256)+",CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,sha256=excluded.sha256,imported_at=CURRENT_TIMESTAMP;\n";
const dir=path.join(process.cwd(),".private");
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,"seed.sql"),sql,{mode:0o600});
console.log("Wrote .private/seed.sql locally (never commit).");
console.log(JSON.stringify({sha256,game:db.game,regular,special,noSource,sourceMaps:Object.keys(db.configs).length},null,2));
