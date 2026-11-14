/* Packs in and out: loading a pack, saving your own, the packs published with the site, and the library list. */
import { fillLooks, fillMotions, fillOverlays, fillWorlds, requestWorld, scene, setLook, setMirrors, setMotion, setOverlay } from "./choose.js";
import { setFx } from "./controls.js";
import { $, gl, toast } from "./dom.js";
import { ED, edOpen } from "./editor.js";
import { advFill, advPick, advS, advT, mk } from "./journey-panel.js";
import { BUILTIN_S, BUILTIN_T, adopt, catOf, fillJT, findS, findT, jCur, journey, saveStore, selectJourney, store } from "./journey.js";
import { setLand, setLandKind } from "./land.js";
import { LK } from "./landscapes.js";
import { NLOOK, NMOT, NOV, addToLibrary, myFilters, myOverlays, myWorlds, saveLibrary, worldDrop } from "./library.js";
import { NWORLD } from "./pack-worlds.js";
import { cleanFilter, cleanMotion, cleanName, cleanOverlay, cleanPalette, cleanScene, cleanWorld } from "./packs.js";
import { NPAL, PALETTES, fillPalettes, palOpen, setPalette } from "./palettes.js";
import { applySpot, encodeSpot } from "./spots.js";
import { FX, LOOKS, MOTIONS, OVERLAYS, mirrors, sel } from "./state.js";
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
/* The scene showing now: the place, as Share spot writes it, and the look by name. */
export function sceneNow(){
  return {spot:encodeSpot(),palette:PALETTES[sel.pi].name,motion:MOTIONS[sel.moi].name,filter:LOOKS[sel.lki].name,overlay:OVERLAYS[sel.ovi].name,
          mirrors:mirrors[sel.mi],fx:FX[sel.fi].name,land:jCur("land")};
}
/* A pack that holds the scene and whatever it uses that is not built in, so that someone else can open it. Save picture puts this in the file. */
export function packOfScene(){
  var k={mirrorfold:1,name:"Picture",scene:sceneNow()};
  if(sel.pi>=NPAL)k.palettes=[cleanPalette(PALETTES[sel.pi])];
  if(sel.moi>=NMOT)k.motions=[cleanMotion(MOTIONS[sel.moi])];
  if(sel.lki>=NLOOK)k.filters=[cleanFilter(LOOKS[sel.lki])];
  if(sel.ovi>=NOV)k.overlays=[cleanOverlay(OVERLAYS[sel.ovi])];
  if(scene.world.pack)k.worlds=[cleanWorld(scene.world.src)];
  return k;
}
/* Go to a scene that cleanScene has passed. False if its world is not here. */
export function goScene(sc){
  var id=sc.spot.split("-")[0],wi=-1,i;
  var at=function(list,name){for(var j=0;j<list.length;j++)if(list[j].name===name)return j;return -1};
  for(i=0;i<WORLDS.length;i++)if(WORLDS[i].id===id)wi=i;
  if(wi<0)return false;
  requestWorld(wi,true,function(){
    var j,sp;
    applySpot(sc.spot.split("-")[1]);
    if(sc.palette&&(j=at(PALETTES,sc.palette))>=0&&palOpen(j))setPalette(j);
    if(sc.motion&&(j=at(MOTIONS,sc.motion))>=0)setMotion(j);
    if(sc.filter&&(j=at(LOOKS,sc.filter))>=0)setLook(j);
    if(sc.overlay&&(j=at(OVERLAYS,sc.overlay))>=0)setOverlay(j);
    if(sc.mirrors!==undefined&&(j=mirrors.indexOf(sc.mirrors))>=0)setMirrors(j);
    if(sc.fx&&(j=at(FX,sc.fx))>=0)setFx(j);
    if(sc.land){
      sp=sc.land.split(" ");
      if(sc.land==="none")setLand(0);
      else for(j=0;j<LK.length;j++)if(LK[j].id===sp[0]){setLandKind(j);setLand(sp[1]==="over"?2:1);}
    }
    scene.lastHash=sc.spot;try{location.hash=sc.spot}catch(_){}
  });
  return true;
}
export function loadPack(txt,from){
  var raw=null;
  if(typeof txt==="string"&&txt.length<=200000){try{raw=JSON.parse(txt)}catch(e){}}
  if(!raw||typeof raw!=="object"||Array.isArray(raw)){toast("That is not a Mirrorfold pack.");return false;}
  if(+raw.mirrorfold>1){toast("That pack was made for a newer Mirrorfold.");return false;}
  var n=addToLibrary(raw,from==="site"?"site":undefined);
  if(n.p||n.m||n.f||n.o||n.w){saveLibrary();refreshLists();} /* before the templates, so they can name what was just added */
  var got=adopt(raw);
  var sc=cleanScene(raw.scene),went=!!sc&&goScene(sc); /* after the library, so the scene can use what came with it */
  if(!n.p&&!n.m&&!n.f&&!n.o&&!n.w&&!got.tpls.length&&!got.sets.length){
    toast(went?"Going to that scene.":sc?"That scene is in a world this copy does not have.":"Nothing in that pack could be used.");return went;
  }
  var tn=got.tpls.map(function(q){return q.name}),sn=got.sets.map(function(q){return q.name});
  store.tpls=store.tpls.filter(function(q){return tn.indexOf(q.name)<0}).concat(got.tpls);
  store.sets=store.sets.filter(function(q){return sn.indexOf(q.name)<0}).concat(got.sets);
  advPick(findT(advT.name)||BUILTIN_T[0],findS(advS.name)||BUILTIN_S[0]);
  if(journey)selectJourney(store.sel);
  saveStore();fillJT();advFill();
  toast("Loaded "+packSummary({worlds:{length:n.w},palettes:{length:n.p},motions:{length:n.m},filters:{length:n.f},overlays:{length:n.o},templates:got.tpls,sets:got.sets})+(went?", and going to its scene.":"."));
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

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={sceneNow, packOfScene, goScene, refreshLists, count, packNow, packSummary, loadPack, libRemove, advRenderLib};
