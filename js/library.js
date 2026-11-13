/* What packs have added: the lists and their storage. */
import { scene, setWorldNow } from "./choose.js";
import { gl } from "./dom.js";
import { cleanFilter, cleanMotion, cleanOverlay, cleanPalette, cleanWorld } from "./packs.js";
import { NWORLD, packWorld, probeBuild } from "./probe.js";
import { build, filterProg, overlayProg } from "./programs.js";
import { LOOKS, MOTIONS, OVERLAYS } from "./state.js";
import { NPAL, PALETTES, WORLDS } from "./worlds.js";
export let NMOT, NLOOK, NOV;

export const LIB_MAX=16;
function libAdd(list,nBuilt,item){ /* 1 if taken. A built-in name is refused; a name already added is replaced. */
  if(!item)return 0;
  for(var i=0;i<list.length;i++)if(list[i].name===item.name){
    if(i<nBuilt)return 0;
    if(list[i].prog)gl.deleteProgram(list[i].prog.prog);
    list[i]=item;return 1;
  }
  if(list.length-nBuilt>=LIB_MAX)return 0;
  list.push(item);return 1;
}
/* from: "stored" for what this browser saved earlier, "site" for a pack published with the page, nothing for a file or pasted text.
   Filter code from the site's own packs has been reviewed. Any other filter code is shown smoothed over time, so it cannot flash. */
export function addToLibrary(raw,from){
  var n={p:0,m:0,f:0,o:0,w:0};
  if(!raw||typeof raw!=="object")return n;
  (Array.isArray(raw.worlds)?raw.worlds:[]).forEach(function(x){
    var c=cleanWorld(x),w,i;
    if(!c)return;
    w=packWorld(c);
    if(from==="site"||(from==="stored"&&x.reviewed===true))w.reviewed=true;
    for(i=0;i<NWORLD;i++)if(WORLDS[i].id===w.id||WORLDS[i].name===w.name)return; /* a built-in world's name or id is refused */
    for(i=NWORLD;i<WORLDS.length;i++)if(WORLDS[i].id===w.id&&WORLDS[i].name!==w.name)return; /* so is a name that differs from another only in spaces or digits */
    if(from!=="stored"){try{build(w);if(!probeBuild(w))throw 0;}catch(e){if(w.prog)gl.deleteProgram(w.prog);return;}} /* does not compile here: leave it out */
    for(i=NWORLD;i<WORLDS.length;i++)if(WORLDS[i].name===w.name){worldDrop(i);break;} /* the same name again replaces the earlier one */
    if(WORLDS.length-NWORLD>=LIB_MAX)return;
    WORLDS.push(w);n.w++;
  });
  (Array.isArray(raw.overlays)?raw.overlays:[]).forEach(function(x){
    var o=cleanOverlay(x);
    if(o&&(from==="site"||(from==="stored"&&x.reviewed===true)))o.reviewed=true;
    if(o&&from!=="stored"&&!overlayProg(o))o=null;
    n.o+=libAdd(OVERLAYS,NOV,o);
  });
  (Array.isArray(raw.filters)?raw.filters:[]).forEach(function(x){
    var f=cleanFilter(x);
    if(f&&(from==="site"||(from==="stored"&&x.reviewed===true)))f.reviewed=true;
    if(f&&f.code&&from!=="stored"&&!filterProg(f))f=null; /* does not compile here: leave it out */
    n.f+=libAdd(LOOKS,NLOOK,f);
  });
  (Array.isArray(raw.palettes)?raw.palettes:[]).forEach(function(x){n.p+=libAdd(PALETTES,NPAL,cleanPalette(x))});
  (Array.isArray(raw.motions)?raw.motions:[]).forEach(function(x){n.m+=libAdd(MOTIONS,NMOT,cleanMotion(x))});
  return n;
}
export function worldDrop(i){ /* take an added world out; if it is showing, go to the first world */
  var w=WORLDS[i],was=scene.world===w||(scene.hyb&&WORLDS[scene.hyb.b]===w);
  if(w.prog)gl.deleteProgram(w.prog);if(w.probe)gl.deleteProgram(w.probe.prog);
  WORLDS.splice(i,1);
  if(was){scene.hyb=null;setWorldNow(0);}
}
export function myWorlds(keepReviewed){return WORLDS.slice(NWORLD).map(function(w){var o=cleanWorld(w.src);if(keepReviewed&&w.reviewed)o.reviewed=true;return o})}
export function myFilters(keepReviewed){return LOOKS.slice(NLOOK).map(function(f){var o=cleanFilter(f);if(keepReviewed&&f.reviewed)o.reviewed=true;return o})}
export function myOverlays(keepReviewed){return OVERLAYS.slice(NOV).map(function(f){var o=cleanOverlay(f);if(keepReviewed&&f.reviewed)o.reviewed=true;return o})}
export function saveLibrary(){try{localStorage.setItem("mirrorfold-library",JSON.stringify({palettes:PALETTES.slice(NPAL),motions:MOTIONS.slice(NMOT),filters:myFilters(true),overlays:myOverlays(true),worlds:myWorlds(true)}))}catch(_){}}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
/* palettes and motions added from packs sit after the built-in ones and are saved in this browser */
NMOT=MOTIONS.length;
NLOOK=LOOKS.length;
NOV=OVERLAYS.length;
try{addToLibrary(JSON.parse(localStorage.getItem("mirrorfold-library")||"{}"),"stored")}catch(_){}
}

/* for the test tools and the browser console: every name in this file, readable and (where it can change) settable */
export const __dbg={get NMOT(){return NMOT},set NMOT(v){NMOT=v}, get NLOOK(){return NLOOK},set NLOOK(v){NLOOK=v}, get NOV(){return NOV},set NOV(v){NOV=v}, get LIB_MAX(){return LIB_MAX}, get libAdd(){return libAdd}, get addToLibrary(){return addToLibrary},
  get worldDrop(){return worldDrop}, get myWorlds(){return myWorlds}, get myFilters(){return myFilters}, get myOverlays(){return myOverlays}, get saveLibrary(){return saveLibrary}};
