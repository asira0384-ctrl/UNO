export const VIEW_MODES=['auto','portrait','landscape'];
export const VIEW_LABELS={auto:'自動',portrait:'縦',landscape:'横'};
export function viewMode(value){return VIEW_MODES.includes(value)?value:'auto';}
// The inner browsing viewport really changes size, so every media query and
// pointer coordinate uses the chosen orientation, including on iPhone Safari.
export function framePlan(width,height,mode='auto'){
  const w=Math.max(1,Number(width)||1),h=Math.max(1,Number(height)||1),selected=viewMode(mode);
  const portrait=h>=w,rotate=selected==='landscape'&&portrait?90:selected==='portrait'&&!portrait?-90:0;
  return {width:rotate?h:w,height:rotate?w:h,rotate};
}
