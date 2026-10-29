import {randomBytes,randomUUID,createHash,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback),COST={N:32768,r:8,p:3,maxmem:64*1024*1024};
let working=0;const waiting=[];
const safeError=(message,status=400)=>Object.assign(new Error(message),{safe:true,status});
export const normalizeLoginId=v=>String(v??'').trim().toLowerCase();
export function validateLoginId(value){const id=normalizeLoginId(value);if(!/^[a-z0-9][a-z0-9_]{2,19}$/.test(id))throw safeError('IDは半角英数字・_で3〜20文字にしてね');return id;}
export function validateName(value){if(typeof value!=='string')throw safeError('名前を入力してね');const name=value.trim();if(!name||[...name].length>24||/[\p{Cc}\p{Cf}]/u.test(name))throw safeError('名前は1〜24文字にしてね');return name;}
export function validatePassword(value){if(typeof value!=='string'||[...value].length<8||[...value].length>128||Buffer.byteLength(value)>512||/[\u0000-\u001f\u007f]/.test(value))throw safeError('パスワードは8〜128文字にしてね');return value.normalize('NFC');}
async function derive(password,salt){
 if(working>=2){if(waiting.length>=12)throw safeError('ログインが混み合っています。少し待ってね',429);await new Promise(resolve=>waiting.push(resolve));}
 working++;
 try{return await scrypt(password,salt,32,COST);}finally{working--;waiting.shift()?.();}
}
const DUMMY=`scrypt$32768$8$3$${'a'.repeat(32)}$${'0'.repeat(64)}`;
export async function hashPassword(password){const p=validatePassword(password),salt=randomBytes(16).toString('hex'),key=await derive(p,Buffer.from(salt,'hex'));return `scrypt$32768$8$3$${salt}$${key.toString('hex')}`;}
export async function verifyPassword(password,stored){
 if(typeof password!=='string'||Buffer.byteLength(password)>512)return false;
 const valid=typeof stored==='string'&&/^scrypt\$32768\$8\$3\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(stored),parts=(valid?stored:DUMMY).split('$');
 const key=await derive(password.normalize('NFC'),Buffer.from(parts[4],'hex'));
 return timingSafeEqual(key,Buffer.from(parts[5],'hex'))&&valid;
}
const recoveryDigest=value=>createHash('sha256').update('party-room-recovery:'+String(value??'').toUpperCase().replace(/[^A-Z0-9]/g,'')).digest('hex');
function newRecovery(user){const raw='PR-'+randomBytes(16).toString('hex').toUpperCase().match(/.{1,4}/g).join('-');user.recoveryHash=recoveryDigest(raw);return raw;}
export function validateAvatar(input,userId){
 if(typeof input!=='string')throw safeError('アイコンを選んでね');
 if(/^robot-[1-8]$/.test(input))return {image:'/assets/avatars/'+input+'.svg',avatarData:null,avatarVersion:null};
 if(input.length>400000||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(input))throw safeError('アイコン画像を読み込み直してね');
 const bytes=Buffer.from(input.slice(22),'base64');
 if(bytes.length<45||bytes.length>290000||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.subarray(12,16).toString()!=='IHDR'||bytes.subarray(-8,-4).toString()!=='IEND')throw safeError('PNG画像を選んでね');
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
 if(!width||!height||width>512||height>512||width*height>262144)throw safeError('アイコンは512px以内にしてね');
 const version=randomBytes(8).toString('hex');return {image:`/api/avatar/${userId}/${version}`,avatarData:bytes.toString('base64'),avatarVersion:version};
}
export function installAccountRoutes(app,db,save,auth,options={}){
 const limits=new Map(),pendingIds=new Set();
 function limit(key,max,span=15*60000){const now=Date.now();let row=limits.get(key);if(!row||row.until<now){row={count:0,until:now+span};limits.set(key,row);}if(++row.count>max)throw safeError('試行回数が多いため、少し時間をあけてね',429);if(limits.size>5000)for(const [k,r] of limits){if(r.until<now)limits.delete(k);if(limits.size<=4000)break;}while(limits.size>5000)limits.delete(limits.keys().next().value);}
 const keyId=id=>createHash('sha256').update(id).digest('hex');
 const find=id=>Object.values(db.users).find(u=>u.loginId===id);
 const publicAccount=u=>({id:u.id,name:u.name,username:u.username,image:u.image,loginId:u.loginId||null,hasPassword:!!u.passwordHash});
 const route=fn=>async(req,res)=>{try{await fn(req,res);}catch(e){res.status(e.safe?e.status:500).json({ok:false,error:e.safe?e.message:'処理を完了できませんでした。もう一度試してね'});}};
 function requireUser(req){const s=auth.session(req);if(!s)throw safeError('ログインしてください',401);return {s,u:db.users[s.userId]};}
 function stillSignedIn(req,session){if(auth.session(req)?.hash!==session.hash)throw safeError('ログインし直してください',401);}
 function revoke(user,keep){for(const [id,s] of Object.entries(db.sessions))if(s.userId===user.id&&id!==keep){delete db.sessions[id];options.logout?.(id);}}
 function startSession(req,res,user){const old=auth.session(req);if(old){delete db.sessions[old.hash];options.logout?.(old.hash);}auth.issue(res,user);}
 app.get('/api/account',route(async(req,res)=>{const {u}=requireUser(req);res.json({ok:true,user:publicAccount(u)});}));
 app.get('/api/avatar/:id/:version',(req,res)=>{
  if(!auth.session(req))return res.sendStatus(401);const u=db.users[req.params.id];
  if(!u?.avatarData||u.avatarVersion!==req.params.version)return res.sendStatus(404);
  res.set({'Content-Type':'image/png','Cache-Control':'private, max-age=86400','X-Content-Type-Options':'nosniff'}).send(Buffer.from(u.avatarData,'base64'));
 });
 app.post('/auth/register',route(async(req,res)=>{
  limit('register:'+req.ip,20,3600000);const name=validateName(req.body?.name),id=validateLoginId(req.body?.loginId),password=validatePassword(req.body?.password);
  if(find(id)||pendingIds.has(id))throw safeError('そのIDはすでに使われています',409);
  if(Object.keys(db.users).length>=20000)throw safeError('アカウントが混み合っています',503);
  pendingIds.add(id);
  try{
   const user={id:randomUUID(),name,username:id,loginId:id,friends:[],requests:[],blocks:[],mutes:[],invites:[],createdAt:Date.now()};
   Object.assign(user,validateAvatar(req.body?.avatar||'robot-1',user.id));user.passwordHash=await hashPassword(password);
   if(find(id))throw safeError('そのIDはすでに使われています',409);
   const recoveryCode=newRecovery(user);db.users[user.id]=user;startSession(req,res,user);save();res.status(201).json({ok:true,user:publicAccount(user),recoveryCode});
  }finally{pendingIds.delete(id);}
 }));
 app.post('/auth/login',route(async(req,res)=>{
  limit('login-ip:'+req.ip,90);const id=normalizeLoginId(req.body?.loginId);
  if(id.length>20)throw safeError('IDかパスワードが違います',401);
  const attempt='login:'+keyId(id)+':'+req.ip;limit(attempt,15);
  const user=find(id),stored=user?.passwordHash,ok=await verifyPassword(req.body?.password,stored);
  if(!ok||user.passwordHash!==stored)throw safeError('IDかパスワードが違います',401);
  limits.delete(attempt);startSession(req,res,user);res.json({ok:true,user:publicAccount(user)});
 }));
 app.post('/api/account/profile',route(async(req,res)=>{
  const {s,u}=requireUser(req);limit('profile:'+u.id,25,60000);const name=validateName(req.body?.name),id=validateLoginId(req.body?.loginId),previousHash=u.passwordHash;
  const other=find(id);if(other&&other.id!==u.id)throw safeError('そのIDはすでに使われています',409);
  const identityChange=u.loginId!==id;let passwordHash;
  if(previousHash&&identityChange&&!await verifyPassword(req.body?.currentPassword,previousHash))throw safeError('現在のパスワードが違います',401);
  if(!previousHash)passwordHash=await hashPassword(req.body?.newPassword);
  stillSignedIn(req,s);if(u.passwordHash!==previousHash)throw safeError('ログインし直してください',401);
  const collision=find(id);if(collision&&collision.id!==u.id)throw safeError('そのIDはすでに使われています',409);
  const avatar=req.body?.avatar===undefined?{}:validateAvatar(req.body.avatar,u.id);
  Object.assign(u,{name,username:id,loginId:id,...avatar});let recoveryCode;
  if(passwordHash){u.passwordHash=passwordHash;recoveryCode=newRecovery(u);revoke(u,s.hash);}
  save();options.onProfile?.(u);res.json({ok:true,user:publicAccount(u),...(recoveryCode?{recoveryCode}:{})});
 }));
 app.post('/api/account/password',route(async(req,res)=>{
  const {s,u}=requireUser(req);limit('password:'+u.id,8);const old=u.passwordHash;
  if(!old||!await verifyPassword(req.body?.currentPassword,old))throw safeError('現在のパスワードが違います',401);
  const next=await hashPassword(req.body?.newPassword);stillSignedIn(req,s);if(u.passwordHash!==old)throw safeError('ログインし直してください',401);
  u.passwordHash=next;revoke(u);auth.issue(res,u);save();res.json({ok:true});
 }));
 app.post('/api/account/recovery-code',route(async(req,res)=>{
  const {s,u}=requireUser(req);limit('recovery-rotate:'+u.id,5);const old=u.passwordHash;
  if(!await verifyPassword(req.body?.currentPassword,old))throw safeError('現在のパスワードが違います',401);
  stillSignedIn(req,s);if(u.passwordHash!==old)throw safeError('ログインし直してください',401);
  const recoveryCode=newRecovery(u);save();res.json({ok:true,recoveryCode});
 }));
 app.post('/auth/recover',route(async(req,res)=>{
  limit('recover:'+req.ip,10);const id=validateLoginId(req.body?.loginId),u=find(id),code=String(req.body?.recoveryCode||'');
  if(code.length>80||!timingSafeEqual(Buffer.from(recoveryDigest(code),'hex'),Buffer.from(u?.recoveryHash||'0'.repeat(64),'hex')))throw safeError('IDか復旧コードが違います',401);
  const old=u.passwordHash,next=await hashPassword(req.body?.newPassword);if(u.passwordHash!==old)throw safeError('もう一度試してね',409);
  u.passwordHash=next;const recoveryCode=newRecovery(u);revoke(u);auth.issue(res,u);save();res.json({ok:true,recoveryCode,user:publicAccount(u)});
 }));
 return {publicAccount};
}
