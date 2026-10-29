import { NUMERALS } from './numerals.js?v=2.2';
export const CARD_COLORS={red:'#e51b32',yellow:'#f4c817',green:'#128c45',blue:'#086cb6'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const svg=(body,cls='')=>`<svg class="card-symbol ${cls}" viewBox="0 0 100 100" aria-hidden="true">${body}</svg>`;
export function cardSymbol(value){
  if(value==='reverse')return svg('<g fill="#fff" stroke="#17202b" stroke-width="3.5" stroke-linejoin="round"><path d="m16 55 30-30-10-10h36v36L62 41 32 71Z"/><path d="M84 45 54 75l10 10H28V49l10 10 30-30Z"/></g>','reverse-symbol');
  if(value==='skip')return svg('<g fill="none" stroke="#15202b" stroke-width="17"><circle cx="50" cy="50" r="32"/><path d="m28 72 44-44"/></g><g fill="none" stroke="white" stroke-width="10"><circle cx="50" cy="50" r="32"/><path d="m28 72 44-44"/></g>');
  if(value==='wild')return svg('<g stroke="white" stroke-width="3"><path d="M50 4A46 46 0 0 0 4 50h46Z" fill="#e51b32"/><path d="M50 4a46 46 0 0 1 46 46H50Z" fill="#086cb6"/><path d="M96 50a46 46 0 0 1-46 46V50Z" fill="#128c45"/><path d="M50 96A46 46 0 0 1 4 50h46Z" fill="#f4c817"/></g>','wild-symbol');
  if(value==='wild4')return svg('<g stroke="#fff" stroke-width="3" stroke-linejoin="round"><rect x="12" y="36" width="29" height="43" rx="3" fill="#128c45" transform="rotate(-18 26 57)"/><rect x="30" y="16" width="29" height="43" rx="3" fill="#086cb6" transform="rotate(-7 44 37)"/><rect x="54" y="15" width="29" height="43" rx="3" fill="#f4c817" transform="rotate(12 68 36)"/><rect x="43" y="48" width="29" height="43" rx="3" fill="#e51b32" transform="rotate(15 57 69)"/></g>');
  if(value==='draw2')return svg('<g fill="white" stroke="#17202b" stroke-width="3"><rect x="18" y="18" width="37" height="52" rx="4" transform="rotate(-16 36 44)"/><rect x="45" y="31" width="37" height="52" rx="4" transform="rotate(13 63 57)"/></g>');
  if(NUMERALS[value])return `<svg class="card-symbol number-symbol" viewBox="0 0 100 140" aria-hidden="true"><path d="${NUMERALS[value]}" fill="#fff" stroke="#17202b" stroke-width="4" paint-order="stroke fill"/>${['6','9'].includes(value)?'<path d="M26 128H74" stroke="#17202b" stroke-width="7"/><path d="M26 128H74" stroke="#fff" stroke-width="3"/>':''}</svg>`;
  return esc(value);
}
export function cardMarkup(card,cls='',chosenColor=null){
  if(!card)return '';
  const back=card.back,wild=card.color==='wild',selected=wild&&CARD_COLORS[chosenColor];
  const value=back?'UNO!':cardSymbol(card.value);
  const corner=back?'':card.value==='wild'?cardSymbol('wild'):card.value==='wild4'?'+4':card.value==='draw2'?'+2':cardSymbol(card.value);
  return `<span aria-hidden="true" data-card-value="${esc(card.value)}" ${selected?`data-selected-color="${chosenColor}" style="--face:${selected}"`:''} class="card ${back?'card-back':`${esc(card.color)} ${esc(card.value)}`} ${esc(cls)}"><span class="card-face"><span class="card-oval"></span><span class="card-corner top">${corner}</span><span class="card-value ${['reverse','skip','draw2','wild','wild4'].includes(card.value)?'symbol':''}">${value}</span><span class="card-corner bottom">${corner}</span></span></span>`;
}
