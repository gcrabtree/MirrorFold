/* What the user has liked and not liked: a weight for each option Journey can choose, kept in this browser. */
export const taste={};               /* "filter:Neon" -> weight. An option with no entry has weight 1, the even chance. */
export const TASTE_MIN=0.2,TASTE_MAX=4; /* never so low that an option is shut out, never so high that it is all there is */

export function tasteOf(w,k,key){var v=w[k+":"+key];return typeof v==="number"?v:1;}
/* multiply an option's weight by f, within the limits. A weight back at about 1 is forgotten, so the list stays short. */
export function tasteNudge(w,k,key,f){
  var v=Math.max(TASTE_MIN,Math.min(TASTE_MAX,tasteOf(w,k,key)*f));
  if(Math.abs(v-1)<0.02)delete w[k+":"+key];else w[k+":"+key]=v;
  return v;
}
/* one of the options, each with a chance in proportion to its weight. r is a random number from 0 up to 1. */
export function pickWeighted(opts,weightOf,r){
  var tot=0,i,ws=[];
  for(i=0;i<opts.length;i++){ws.push(Math.max(0,weightOf(opts[i])));tot+=ws[i];}
  if(!opts.length)return undefined;
  if(!(tot>0))return opts[Math.min(opts.length-1,Math.floor(r*opts.length))];
  r*=tot;
  for(i=0;i<opts.length;i++){r-=ws[i];if(r<0)return opts[i];}
  return opts[opts.length-1];
}
/* what was stored, checked: plain "kind:name" keys, numbers within the limits, at most 400 of them */
export function cleanTaste(raw){
  var out={},n=0,k,v;
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return out;
  for(k in raw){
    v=raw[k];
    if(n>=400||k.length>64||!/^[a-z]+:/.test(k)||typeof v!=="number"||!isFinite(v))continue;
    out[k]=Math.max(TASTE_MIN,Math.min(TASTE_MAX,v));n++;
  }
  return out;
}
export function tasteCount(){var n=0,k;for(k in taste)n++;return n;}
export function saveTaste(){try{localStorage.setItem("mirrorfold-taste",JSON.stringify(taste))}catch(_){}}
export function tasteClear(){for(var k in taste)delete taste[k];saveTaste();}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
try{var got=cleanTaste(JSON.parse(localStorage.getItem("mirrorfold-taste")||"{}"));for(var k in got)taste[k]=got[k];}catch(_){}
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={taste, TASTE_MIN, TASTE_MAX, tasteOf, tasteNudge, pickWeighted, cleanTaste, tasteCount, saveTaste, tasteClear};
