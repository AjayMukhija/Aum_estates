// Read-only audit of repository scripts. All script writes occur in a new OS temp directory.
// Run from any directory: node /absolute/path/to/audit/2026-10-29/reproduce.cjs
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'aum-backend-probes-'));
const results = [];
let index = 0;
function fixture() {
  const dir = path.join(sandbox, String(++index));
  const data = path.join(dir, 'AUM_ESTATES_Website_For_Hostinger/data');
  fs.mkdirSync(data, {recursive:true});
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.mkdirSync(path.join(dir, 'aum-grid-local-baseline-2026-10-27/dist/data'), {recursive:true});
  fs.mkdirSync(path.join(dir, 'AUM_ESTATES_Website_For_Hostinger/concepts/aum-grid-study/data'), {recursive:true});
  for (const name of ['sanitize_and_build.js','manage_inventory.js']) {
    fs.copyFileSync(path.join(root,'scripts',name),path.join(dir,'scripts',name));
  }
  const original = [{property_id:'AUM-WEB-000001',status:'Available',listing_title:'Synthetic audit listing',transaction_type:'Sale',property_type:'Apartment',price_value:1,price_unit:'Cr'}];
  fs.writeFileSync(path.join(data,'public_inventory.json'),JSON.stringify(original));
  fs.writeFileSync(path.join(data,'public_inventory.js'),`window.AUM_PUBLIC_INVENTORY=${JSON.stringify(original)};`);
  fs.writeFileSync(path.join(dir,'AUM_ESTATES_Website_For_Hostinger/concepts/aum-grid-study/data/public_inventory.json'),JSON.stringify(original));
  return {dir,data,read:()=>JSON.parse(fs.readFileSync(path.join(data,'public_inventory.json')))};
}
function run(f,script,args=[],env={}) {
  const e={...process.env,...env};delete e.FORCE_BUILD;
  if (Object.hasOwn(env,'FORCE_BUILD')) e.FORCE_BUILD=env.FORCE_BUILD;
  const p=spawnSync(process.execPath,[path.join(f.dir,'scripts',script),...args],{cwd:f.dir,env:e,encoding:'utf8',timeout:10000});
  if(p.error)throw p.error;
  return {exit:p.status,output:p.stdout+p.stderr};
}
function record(name,issueReproduced,evidence) {results.push({name,issueReproduced,evidence});}
function buildCase(name,input,check,env={}) {
  const f=fixture(),p=path.join(f.dir,'input.json');fs.writeFileSync(p,JSON.stringify(input));
  const r=run(f,'sanitize_and_build.js',[p],env),out=f.read();
  record(name,check(r,out),{exit:r.exit,outputRecords:out.length});
}
buildCase('Empty import replaces existing inventory',[],(r,o)=>r.exit===0&&o.length===0);
buildCase('Duplicate IDs warn but still write',[{property_id:'DUP',listing_title:'A'},{property_id:'DUP',listing_title:'B'}],(r,o)=>r.exit===0&&o[0].property_id===o[1].property_id);
buildCase('Missing ID and title accepted',[{}],(r,o)=>r.exit===0&&!o[0].property_id&&!o[0].listing_title&&o[0].status==='Available');
buildCase('Nested private data bypasses string scanner',[{property_id:'NESTED',listing_title:{owner_contact:'9123456789',internal_notes:'synthetic private data'}}],(r,o)=>r.exit===0&&!!o[0].listing_title.owner_contact);
buildCase('Official phone exempts another number in same field',[{property_id:'MIXED',listing_title:'Desk 9873813595; other 9123456789'}],(r,o)=>r.exit===0&&o[0].listing_title.includes('9123456789'));
buildCase('Spaced phone bypasses detection',[{property_id:'SPACED',listing_title:'Seller 91234 56789'}],(r,o)=>r.exit===0&&o[0].listing_title.includes('91234 56789'));
buildCase('Cheque terms bypass financial leak rule',[{property_id:'PAYMENT',listing_title:'Synthetic title',price_text:'Full cheque; 75% cheque'}],(r,o)=>r.exit===0&&o[0].price_text.includes('cheque'));
buildCase('Numeric phone value bypasses detection',[{property_id:'NUMERIC',listing_title:9123456789}],(r,o)=>r.exit===0&&o[0].listing_title===9123456789);
buildCase('FORCE_BUILD=0 bypasses privacy failure',[{property_id:'FORCE',listing_title:'synthetic brokerage note'}],(r,o)=>r.exit===0&&o[0].listing_title.includes('brokerage'),{FORCE_BUILD:'0'});
buildCase('Draft is emitted into public feed',[{property_id:'DRAFT',status:'Draft',listing_title:'Synthetic draft'}],(r,o)=>r.exit===0&&o[0].status==='Draft');
buildCase('Explicitly private visibility is dropped and record emitted',[{property_id:'PRIVATE',visibility:'Private',publication_approved:false,listing_title:'Synthetic private draft'}],(r,o)=>r.exit===0&&o[0].status==='Available'&&!Object.hasOwn(o[0],'visibility'));
buildCase('Specified nested master schema not transformed',[{property_id:'MASTER',public_listing_data:{listing_title:'Expected public title'},_private_broker_metadata:{owner_contact:'9123456789'}}],(r,o)=>r.exit===0&&!o[0].listing_title);
{
  const f=fixture();const r=run(f,'manage_inventory.js',['update-price','AUM-WEB-000001','-5','9123456789']);
  const o=f.read()[0];record('Price update accepts negative value and unscanned phone in unit',r.exit===0&&o.price_value===-5&&o.price_text.includes('9123456789'),{exit:r.exit,negativePrice:o.price_value<0,phoneInPublicUnit:o.price_unit==='9123456789'});
  const concept=JSON.parse(fs.readFileSync(path.join(f.dir,'AUM_ESTATES_Website_For_Hostinger/concepts/aum-grid-study/data/public_inventory.json')));
  record('CLI update leaves packaged concept feed stale',o.price_value!==concept[0].price_value,{mainPrice:o.price_value,conceptPrice:concept[0].price_value});
}
{
  const f=fixture(),p=path.join(f.dir,'new.json');fs.writeFileSync(p,JSON.stringify({project_name:'Synthetic nameless listing'}));
  const r=run(f,'manage_inventory.js',['add',p]);record('CLI add accepts record without title or schema',r.exit===0&&!f.read()[1].listing_title,{exit:r.exit,records:f.read().length});
}
{
  const f=fixture();run(f,'manage_inventory.js',['update-price','AUM-WEB-000001','2']);
  // Distinct timestamps make backup ordering deterministic.
  const until=Date.now()+5;while(Date.now()<until){}
  run(f,'manage_inventory.js',['rollback']);const first=f.read()[0].price_value;
  const until2=Date.now()+5;while(Date.now()<until2){}
  run(f,'manage_inventory.js',['rollback']);const second=f.read()[0].price_value;
  record('Consecutive rollback re-applies undone change',first===1&&second===2,{firstRollbackPrice:first,secondRollbackPrice:second});
}
{
  const source=fs.readFileSync(path.join(root,'scripts/sanitize_and_build.js'),'utf8').replace(/main\(\);\s*$/,'globalThis.auditSanitize=runSanitization;');
  const c={require,__dirname:path.join(root,'scripts'),process,console:{log(){}}};vm.runInNewContext(source,c);
  const r=c.auditSanitize([{property_id:'REGEX',listing_title:'9873813595',key_features:'9123456789'}]);
  record('Global regex lastIndex skips following field',r.warnings.length===0,{warnings:r.warnings.length});
}
{
  let source=fs.readFileSync(path.join(root,'AUM_ESTATES_Website_For_Hostinger/concepts/aum-grid-study/main.js'),'utf8');
  const end=source.lastIndexOf('})();');source=source.slice(0,end)+'window.__audit={propertyCard,currentFiltered};'+source.slice(end);
  const c={window:{AUM_PUBLIC_INVENTORY:[{property_id:'SOLD',status:'Sold',transaction_type:'Sale',property_type:'Apartment'},{property_id:'DRAFT',status:'Draft',transaction_type:'Sale',property_type:'Apartment'}],dispatchEvent(){}},document:{addEventListener(){},querySelector(){return null},querySelectorAll(){return[]}},CustomEvent:class{constructor(name,p){this.name=name;this.detail=p.detail;}}};
  vm.runInNewContext(source,c);
  const ids=c.window.__audit.currentFiltered().map(x=>x.property_id);
  record('Grid results include Sold and Draft records',ids.includes('SOLD')&&ids.includes('DRAFT'),{ids});
  const marker='<img src=x onerror="window.__audit_marker=1">';
  const html=c.window.__audit.propertyCard({property_id:marker,listing_title:'Synthetic title',property_type:'Apartment'},0);
  record('Grid property ID is inserted as raw HTML',html.includes('REF / '+marker),{unescapedMarkupPresent:html.includes('REF / '+marker),payloadExecuted:false});
  let listenerCalls=0;c.window._AUM_CRM_LISTENER=()=>listenerCalls++;c.window.AUM_CRM_HOOK({action:'audit'});
  record('Grid hook does not invoke documented CRM listener',listenerCalls===0,{listenerCalls});
}
{
  const f=fixture(),preload=path.join(f.dir,'write-failure.cjs');
  fs.writeFileSync(preload,`const fs=require('node:fs');const original=fs.writeFileSync;fs.writeFileSync=function(p,...args){if(String(p).endsWith('/data/public_inventory.js'))throw new Error('Synthetic write failure');return original.call(this,p,...args);};`);
  const r=run(f,'manage_inventory.js',['update-price','AUM-WEB-000001','2'],{NODE_OPTIONS:`--require=${preload}`});
  const c={window:{}};vm.runInNewContext(fs.readFileSync(path.join(f.data,'public_inventory.js'),'utf8'),c);
  record('Write failure leaves JSON and JS on different versions',r.exit!==0&&f.read()[0].price_value===2&&c.window.AUM_PUBLIC_INVENTORY[0].price_value===1,{exit:r.exit,jsonPrice:f.read()[0].price_value,jsPrice:c.window.AUM_PUBLIC_INVENTORY[0].price_value});
}
{
  const dir=path.join(sandbox,'package');fs.mkdirSync(dir);
  for(const name of ['scripts','AUM_ESTATES_Website_For_Hostinger','aum-grid-local-baseline-2026-10-27'])fs.cpSync(path.join(root,name),path.join(dir,name),{recursive:true});
  fs.mkdirSync(path.join(dir,'private_master_store'));
  const canary=JSON.stringify({owner_contact:'9123456789',owner_email:'audit@example.invalid',internal_notes:'synthetic private canary'});
  fs.writeFileSync(path.join(dir,'AUM_ESTATES_Website_For_Hostinger/assets/audit-canary.json'),canary);
  const outside=path.join(dir,'outside-source-canary.json');fs.writeFileSync(outside,canary);
  fs.symlinkSync(outside,path.join(dir,'AUM_ESTATES_Website_For_Hostinger/assets/audit-link.json'));
  const r=run({dir},'package_release.js');
  const copied=p=>fs.existsSync(path.join(dir,'dist_hostinger/assets',p))&&fs.readFileSync(path.join(dir,'dist_hostinger/assets',p),'utf8')===canary;
  record('Full package succeeds with private data outside inventory filename',r.exit===0&&copied('audit-canary.json'),{exit:r.exit,privateCanaryCopied:copied('audit-canary.json'),preflight45ChecksPassed:r.output.includes('45/45 CHECKS PASSED')});
  record('Packager follows symlink outside source tree',r.exit===0&&copied('audit-link.json'),{exit:r.exit,outsideCanaryCopied:copied('audit-link.json')});
}
console.log(JSON.stringify({checkedAt:new Date().toISOString(),sandbox,results},null,2));
