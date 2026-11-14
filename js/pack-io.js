/* Packs in and out: loading a pack, saving your own, the packs published with the site, and the library list. */
import { fillLooks, fillMotions, fillOverlays, fillWorlds } from "./choose.js";
import { $, gl, toast } from "./dom.js";
import { ED, edOpen } from "./editor.js";
import { advFill, advPick, advS, advT, mk } from "./journey-panel.js";
import { BUILTIN_S, BUILTIN_T, adopt, catOf, fillJT, findS, findT, journey, saveStore, selectJourney, store } from "./journey.js";
import { NLOOK, NMOT, NOV, addToLibrary, myFilters, myOverlays, myWorlds, saveLibrary, worldDrop } from "./library.js";
import { NWORLD } from "./pack-worlds.js";
import { cleanName } from "./packs.js";
import { NPAL, PALETTES, fillPalettes } from "./palettes.js";
import { LOOKS, MOTIONS, OVERLAYS, sel } from "./state.js";
import { WORLDS } from "./worlds.js";

/* ---------- packs: saving, loading and the library list ---------- */
export function refreshLists(){ /* after palettes or motions are added or removed */
  catOf("world").opts=WORLDS.map(function(w){return [w.id,w.name]});fillWorlds();
  catOf("palette").opts=PALETTES.map(function(q){return [q.name,q.name]});
  catOf("motion").opts=MOTIONS.map(function(o){return [o.name,o.name]});
  catOf("filter").opts=LOOKS.map(function(o){return [o.name,o.name]});
  catOf("overlay").opts=OVERLAYS.map(function(o){return [o.name,o.name]});
  fillPalettes();fillMotions();fillLooks();fillOverlays();
}
function count(n,word){return n+" "+word+(n===1?"":"s")}
export function packNow(){ /* everything of the user's own, as a pack */
  var strip=function(list){return JSON.parse(JSON.stringify(list)).map(function(x){delete x.builtin;return x})};
  return {mirrorfold:1,name:"My Mirrorfold pack",author:"",palettes:PALETTES.slice(NPAL),motions:MOTIONS.slice(NMOT),filters:myFilters(false),overlays:myOverlays(false),worlds:myWorlds(false),templates:strip(store.tpls),sets:strip(store.sets)};
}
export function packSummary(k){ /* "2 palettes, 1 filter and 3 templates": only what is there */
  var parts=[["worlds","world"],["palettes","palette"],["motions","motion"],["filters","filter"],["overlays","overlay"],["templates","template"],["sets","set"]]
    .filter(function(x){return k[x[0]].length>0}).map(function(x){return count(k[x[0]].length,x[1])});
  if(!parts.length)return "nothing";
  var last=parts.pop();
  return parts.length?parts.join(", ")+" and "+last:last;
}
export function loadPack(txt,from){
  var raw=null;
  if(typeof txt==="string"&&txt.length<=200000){try{raw=JSON.parse(txt)}catch(e){}}
  if(!raw||typeof raw!=="object"||Array.isArray(raw)){toast("That is not a Mirrorfold pack.");return false;}
  if(+raw.mirrorfold>1){toast("That pack was made for a newer Mirrorfold.");return false;}
  var n=addToLibrary(raw,from==="site"?"site":undefined);
  if(n.p||n.m||n.f||n.o||n.w){saveLibrary();refreshLists();} /* before the templates, so they can name what was just added */
  var got=adopt(raw);
  if(!n.p&&!n.m&&!n.f&&!n.o&&!n.w&&!got.tpls.length&&!got.sets.length){toast("Nothing in that pack could be used.");return false;}
  var tn=got.tpls.map(function(q){return q.name}),sn=got.sets.map(function(q){return q.name});
  store.tpls=store.tpls.filter(function(q){return tn.indexOf(q.name)<0}).concat(got.tpls);
  store.sets=store.sets.filter(function(q){return sn.indexOf(q.name)<0}).concat(got.sets);
  advPick(findT(advT.name)||BUILTIN_T[0],findS(advS.name)||BUILTIN_S[0]);
  if(journey)selectJourney(store.sel);
  saveStore();fillJT();advFill();
  toast("Loaded "+packSummary({worlds:{length:n.w},palettes:{length:n.p},motions:{length:n.m},filters:{length:n.f},overlays:{length:n.o},templates:got.tpls,sets:got.sets})+".");
  return true;
}
function libRemove(kind,i){
  if(kind==="w")worldDrop(i);
  else if(kind==="p"){PALETTES.splice(i,1);if(sel.pi===i)sel.pi=0;else if(sel.pi>i)sel.pi--;}
  else if(kind==="m"){MOTIONS.splice(i,1);if(sel.moi===i)sel.moi=0;else if(sel.moi>i)sel.moi--;}
  else if(kind==="f"){if(LOOKS[i].prog)gl.deleteProgram(LOOKS[i].prog.prog);LOOKS.splice(i,1);if(sel.lki===i)sel.lki=0;else if(sel.lki>i)sel.lki--;}
  else{if(OVERLAYS[i].prog)gl.deleteProgram(OVERLAYS[i].prog.prog);OVERLAYS.splice(i,1);if(sel.ovi===i)sel.ovi=0;else if(sel.ovi>i)sel.ovi--;}
  saveLibrary();refreshLists();advFill();
}
export function advRenderLib(){ /* the palettes and motions that came from packs, each with a Remove button */
  var box=$("advMine");box.textContent="";
  var row=function(kind,label,i){
    var rm=mk("button",{type:"button",text:"Remove"}),kids=[mk("span",{"class":"advItem",text:label})];
    rm.addEventListener("click",function(){libRemove(kind,i)});
    if(ED[kind]){var eb=mk("button",{type:"button",text:"Edit"});eb.addEventListener("click",function(){edOpen(kind,i)});kids.push(eb);}
    kids.push(rm);
    box.appendChild(mk("div",{"class":"advRow"},kids));
  };
  WORLDS.forEach(function(w,i){if(i>=NWORLD)row("w","World: "+w.name+(w.reviewed?"":" (not reviewed, so shown smoothed)"),i)});
  PALETTES.forEach(function(q,i){if(i>=NPAL)row("p","Palette: "+q.name,i)});
  MOTIONS.forEach(function(o,i){if(i>=NMOT)row("m","Motion: "+o.name,i)});
  LOOKS.forEach(function(o,i){if(i>=NLOOK)row("f","Filter: "+o.name+(o.code&&!o.reviewed?" (not reviewed, so shown smoothed)":""),i)});
  OVERLAYS.forEach(function(o,i){if(i>=NOV)row("o","Overlay: "+o.name+(o.reviewed?"":" (not reviewed, so shown smoothed)"),i)});
  if(!box.firstChild)box.appendChild(mk("p",{"class":"advNote",text:"Nothing added yet."}));
}

export let sitePacks=null; /* the packs published with the site, once packs/index.json has been fetched */
export function fetchText(url){return fetch(url,{cache:"no-cache"}).then(function(r){if(!r.ok)throw new Error("missing");return r.text()})}
export function loadSitePacks(){
  if(sitePacks||typeof fetch!=="function"||location.protocol==="file:")return;
  sitePacks=[];
  fetchText("packs/index.json").then(function(t){
    var list=JSON.parse(t),sel=$("advSite");
    (Array.isArray(list)?list:[]).slice(0,200).forEach(function(e){
      var file=e&&String(e.file||""),name=cleanName(e&&e.name),by=cleanName(e&&e.author);
      if(!/^[a-z0-9][a-z0-9_-]*\.json$/.test(file)||!name)return; /* a plain file name in the packs folder, nothing else */
      sitePacks.push(file);sel.appendChild(mk("option",{value:file,text:name+(by?" by "+by:"")}));
    });
    $("advSiteRow").hidden=!sitePacks.length;
  }).catch(function(){sitePacks=null});
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={refreshLists, count, packNow, packSummary, loadPack, libRemove, advRenderLib, fetchText, loadSitePacks, get sitePacks(){return sitePacks},set sitePacks(v){sitePacks=v}};
