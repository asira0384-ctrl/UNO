const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const presets=()=>Array.from({length:8},(_,i)=>`<button type="button" data-account-action="preset" data-preset="robot-${i+1}" aria-label="アイコン${i+1}"><img src="/assets/avatars/robot-${i+1}.svg" alt=""></button>`).join('');
const field=(id,label,attrs)=>`<label for="${id}">${label}</label><input id="${id}" ${attrs}>`;
const password=(id,label,name='password',autocomplete='current-password')=>field(id,label,`type="password" name="${name}" minlength="8" maxlength="128" autocomplete="${autocomplete}" required`);
const idField=(value='',id='account-login-id')=>field(id,'ID',`name="loginId" value="${esc(value)}" minlength="3" maxlength="20" pattern="[A-Za-z0-9][A-Za-z0-9_]{2,19}" autocomplete="username" autocapitalize="none" spellcheck="false" required`);
const error=()=>'<p class="account-error" data-account-error role="alert"></p>';
export class AccountUI{
 constructor({app,modal,notify,onAuthenticated,onProfile,orientations,art}){
  Object.assign(this,{app,modal,notify,onAuthenticated,onProfile,orientations,art});this.avatarChoice=null;this.mode='signin';
  document.addEventListener('submit',e=>{if(e.target.matches('[data-account-form]')){e.preventDefault();this.submit(e.target);}});
  document.addEventListener('change',e=>{if(e.target.matches('[data-account-image]'))this.pickImage(e.target);});
  document.addEventListener('click',e=>{const b=e.target.closest('[data-account-action]');if(b)this.action(b);});
 }
 async request(path,data){const response=await fetch(path,{method:data===undefined?'GET':'POST',headers:data===undefined?{}:{'Content-Type':'application/json'},credentials:'same-origin',body:data===undefined?undefined:JSON.stringify(data)});const result=await response.json().catch(()=>({error:'通信を確認して、もう一度試してね'}));if(!response.ok||result.ok===false)throw Error(result.error||'操作を完了できませんでした');return result;}
 avatarEditor(image='/assets/avatars/robot-1.svg'){return `<div class="account-avatar-editor"><img class="account-avatar-preview" data-account-preview src="${esc(image)}" alt="アイコンのプレビュー"><div><label class="account-image-pick">画像を選ぶ<input type="file" data-account-image accept="image/*" aria-label="アイコン画像を選ぶ"></label><small>写真やイラストをアイコンにできます</small></div></div><div class="account-presets">${presets()}</div>`;}
 gate(mode='signin'){
  this.mode=mode;this.avatarChoice=null;document.body.dataset.screen='account';document.body.dataset.game='home';const signup=mode==='register',recover=mode==='recover';
  this.app.innerHTML=`<section class="account-gate"><div class="account-welcome"><div class="eyebrow">PLAY TOGETHER. ANYTIME, ANYWHERE.</div><h1>集まれば、<br>そこが遊び場。</h1><p>気軽に集まって、もう一勝負。<br>9つのゲームが待っています。</p><div class="account-game-art">${this.art('uno')}${this.art('shogi')}${this.art('reversi')}</div>${this.orientations()}</div><div class="account-card"><div class="account-tabs"><button type="button" class="${!signup&&!recover?'active':''}" data-account-action="signin">サインイン</button><button type="button" class="${signup?'active':''}" data-account-action="register">アカウント作成</button></div><h2>${signup?'はじめまして。':recover?'パスワードの再設定':'おかえりなさい。'}</h2><p class="account-caption">${signup?'メールアドレス不要。名前とIDを決めよう。':recover?'保存した復旧コードで、パスワードを変更します。':'IDとパスワードでログインしよう。'}</p><form data-account-form="${mode}">${signup?this.avatarEditor()+field('account-name','名前',`name="name" maxlength="24" autocomplete="nickname" required`):''}${idField()}${signup?'<small class="account-field-note">半角英数字・_で3〜20文字</small>':''}${recover?field('account-recovery-code','復旧コード',`name="recoveryCode" maxlength="80" autocomplete="off" required`):''}${password('account-password',recover?'新しいパスワード':'パスワード',recover?'newPassword':'password',signup||recover?'new-password':'current-password')}${signup||recover?'<small class="account-field-note">8〜128文字</small>'+password('account-confirm','パスワードをもう一度','confirm','new-password'):''}${error()}<button class="btn primary full account-submit" type="submit">${signup?'アカウントを作成':recover?'変更してログイン':'サインイン'}</button></form>${!signup&&!recover?'<button class="account-forgot" data-account-action="recover">パスワードを忘れた</button>':''}${this.dev?'<button type="button" class="subtle full" data-account-action="dev-login">開発用ログイン</button>':''}</div></section>`;
 }
 dialog(title,body){this.modal.innerHTML=`<div class="modal-shade"><section class="hub-dialog account-dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="dialog-top"><h2>${esc(title)}</h2><button class="round close" data-action="close" aria-label="閉じる"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.5"/></svg></button></div><div class="dialog-body">${body}</div></section></div>`;}
 async settings(){
  this.avatarChoice=null;this.dialog('アカウント設定','<p class="muted">読み込み中…</p>');
  try{const {user}=await this.request('/api/account');if(!this.modal.querySelector('.account-dialog'))return;
   this.dialog('アカウント設定',`<form data-account-form="profile">${this.avatarEditor(user.image)}${field('profile-name','名前',`name="name" value="${esc(user.name)}" maxlength="24" autocomplete="nickname" required`)}${idField(user.loginId||'','profile-login-id')}<small class="account-field-note">IDは半角英数字・_で3〜20文字。フレンド検索にも使います。</small>${user.hasPassword?field('profile-current-password','現在のパスワード（IDを変える時だけ）',`type="password" name="currentPassword" autocomplete="current-password" maxlength="128"`):'<p class="account-migrate">このアカウント用のIDとパスワードを設定すると、今のフレンドやデータを引き継いで使えます。</p>'+password('profile-new-password','このアカウントのパスワード','newPassword','new-password')+password('profile-new-confirm','パスワードをもう一度','confirm','new-password')}${error()}<button class="btn primary full" type="submit">変更を保存</button></form>${user.hasPassword?`<details class="account-password-section"><summary>パスワードを変更</summary><form data-account-form="password">${password('password-old','現在のパスワード','currentPassword')}${password('password-new','新しいパスワード','newPassword','new-password')}${password('password-confirm','新しいパスワードをもう一度','confirm','new-password')}${error()}<button class="btn full" type="submit">パスワードを変更</button></form></details><details class="account-password-section"><summary>復旧コードを作り直す</summary><p class="muted">パスワードを忘れた時に使えます。作り直すと、以前のコードは使えなくなります。</p><form data-account-form="recovery-code">${password('recovery-current-password','現在のパスワード','currentPassword')}${error()}<button class="btn full" type="submit">復旧コードを作成</button></form></details>`:''}<button class="subtle full account-logout" data-action="logout">ログアウト</button>`);
  }catch(e){this.dialog('アカウント設定',`<p class="account-error">${esc(e.message)}</p>`);}
 }
 showRecovery(code,loginAfter=false){this.recoveryCode=code;this.recoveryLoginAfter=loginAfter;this.dialog('復旧コードを保存',`<p class="account-recovery-note">パスワードを忘れた時に使うコードです。コピーして、自分だけが見られる場所に保存してね。</p><code class="account-recovery-value">${esc(code)}</code><button class="btn full" data-account-action="copy-recovery">コードをコピー</button><button class="btn primary full" data-account-action="finish-recovery">${loginAfter?'ゲームをはじめる':'閉じる'}</button>`);const close=this.modal.querySelector('[data-action="close"]');close.removeAttribute('data-action');close.dataset.accountAction='finish-recovery';}
 async action(button){const action=button.dataset.accountAction;if(['signin','register','recover'].includes(action)){this.gate(action);return;}
  if(action==='dev-login'){button.disabled=true;try{await this.request('/auth/dev',{});this.onAuthenticated();}catch(e){this.notify(e.message);button.disabled=false;}return;}
  if(action==='preset'){this.avatarChoice=button.dataset.preset;const root=button.closest('.account-card,.account-dialog'),preview=root.querySelector('[data-account-preview]');if(preview)preview.src='/assets/avatars/'+this.avatarChoice+'.svg';root.querySelectorAll('[data-preset]').forEach(e=>e.classList.toggle('selected',e===button));}
  if(action==='copy-recovery'){try{await navigator.clipboard.writeText(this.recoveryCode);this.notify('コピーしました');}catch{this.notify('コードを長押ししてコピーしてね');}}
  if(action==='finish-recovery'){const login=this.recoveryLoginAfter;this.recoveryCode=null;this.modal.innerHTML='';if(login)this.onAuthenticated();}
 }
 async pickImage(input){const file=input.files?.[0];if(!file)return;const root=input.closest('.account-card,.account-dialog'),out=root.querySelector('[data-account-error]');
  try{
   if(file.size>12*1024*1024||!file.type.startsWith('image/'))throw Error('12MB以内の画像を選んでね');
   const url=URL.createObjectURL(file);let image;
   try{image=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('この画像は読み込めません。PNGやJPEGを試してね'));i.src=url;});}finally{URL.revokeObjectURL(url);}
   const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d'),side=Math.min(image.naturalWidth,image.naturalHeight);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,0,0,256,256);const data=canvas.toDataURL('image/png');if(data.length>400000)throw Error('この画像は大きすぎます。別の画像を選んでね');
   this.avatarChoice=data;root.querySelector('[data-account-preview]').src=data;root.querySelectorAll('[data-preset]').forEach(e=>e.classList.remove('selected'));if(out)out.textContent='';
  }catch(e){if(out)out.textContent=e.message;else this.notify(e.message);}finally{input.value='';}
 }
 async submit(form){
  if(form.dataset.pending)return;const type=form.dataset.accountForm,f=new FormData(form),values=Object.fromEntries(f.entries()),out=form.querySelector('[data-account-error]'),submit=form.querySelector('[type="submit"]');
  if(values.confirm!==undefined&&values.confirm!==(values.newPassword||values.password)){out.textContent='パスワードが一致していません';return;}
  if(this.avatarChoice&&(type==='register'||type==='profile'))values.avatar=this.avatarChoice;
  delete values.confirm;form.dataset.pending='true';submit.disabled=true;out.textContent='';
  try{
   const endpoint={signin:'/auth/login',register:'/auth/register',recover:'/auth/recover',profile:'/api/account/profile',password:'/api/account/password','recovery-code':'/api/account/recovery-code'}[type];
   const r=await this.request(endpoint,values);form.querySelectorAll('input[type="password"]').forEach(e=>e.value='');
   if(type==='profile'){this.avatarChoice=null;this.onProfile?.(r.user);if(r.recoveryCode)this.showRecovery(r.recoveryCode);else this.notify('アカウントを更新しました');}
   else if(type==='password'){this.notify('パスワードを変更しました');this.onAuthenticated();}
   else if(r.recoveryCode)this.showRecovery(r.recoveryCode,type!=='recovery-code');else this.onAuthenticated();
  }catch(e){out.textContent=e.message;}finally{delete form.dataset.pending;submit.disabled=false;}
 }
}
