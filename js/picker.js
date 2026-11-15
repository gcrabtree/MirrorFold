/* The choosers with pictures: a button in the controls shows what is chosen, and opens a grid of pictures with names.
   The pictures are the files in thumbs/, made by tools/thumbs.py. What came from a pack has no picture. */
import { scene, requestWorld, setLook, setMirrors, setMotion, setOverlay } from "./choose.js";
import { setFx, setSurface } from "./controls.js";
import { $ } from "./dom.js";
import { wakeHud } from "./input.js";
import { landKind, setLandKind } from "./land.js";
import { LK } from "./landscapes.js";
import { NLOOK, NMOT, NOV } from "./library.js";
import { NWORLD } from "./pack-worlds.js";
import { NPAL, PALETTES, palOpen, setPalette } from "./palettes.js";
import { FX, LOOKS, MOTIONS, OVERLAYS, SURFACES, mirrors, sel } from "./state.js";
import { WORLDS } from "./worlds.js";
export const PICK_ORDER=["world","palette","motion","filter","overlay","mirrors","fx","land","surface"];
let KINDS;          /* for each chooser: its title, its button, and how to list, read and set what it chooses */
let pickEl,pickOpen=""; /* the panel, and which chooser it is showing ("" when shut) */
let pickWas;        /* what each button last said, so that it is rewritten only when it changes */
/* the file name of a picture: thumbs/world-lattice.jpg, thumbs/filter-two-tone.jpg */
export function thumbName(kind,key){return "thumbs/"+kind+"-"+String(key).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")+".jpg";}
/* a palette from a pack has no picture, so its tile shows its colours: eight steps along it, as a CSS gradient made of numbers only */
export function palStripe(p){
  var s=[],i,j,c;
  for(i=0;i<=8;i++){
    c=[];for(j=0;j<3;j++)c.push(Math.round(255*Math.max(0,Math.min(1,p.a[j]+p.b[j]*Math.cos(6.28318*(p.c[j]*i/8+p.d[j]))))));
    s.push("rgb("+c.join(",")+")");
  }
  return "linear-gradient(90deg,"+s.join(",")+")";
}
function mirrorName(i){return mirrors[i]?"Mirrors "+mirrors[i]:"Mirrors off";}
export function closePick(){if(!pickOpen)return;pickOpen="";pickEl.hidden=true;wakeHud();}
/* Open one chooser: a tile for each thing, the chosen one marked. Choosing shuts the panel. */
export function openPick(kind){
  var K=KINDS[kind],grid=$("pickGrid"),n,cur,i;
  if(!K)return;
  n=K.n();cur=K.cur();
  pickOpen=kind;$("pickTitle").textContent=K.title;grid.textContent="";
  for(i=0;i<n;i++)(function(i){
    var b=document.createElement("button"),pic=K.pic(i),open=K.open?K.open(i):true,im,t=document.createElement("span");
    b.type="button";b.className="tile";b.setAttribute("aria-pressed",i===cur?"true":"false");b.disabled=!open;
    if(pic){im=document.createElement("img");im.alt="";im.loading="lazy";im.width=240;im.height=150;im.src=pic;}
    else{im=document.createElement("span");im.className="noPic";if(K.stripe)im.style.backgroundImage=K.stripe(i);else im.textContent="No picture: it came from a pack";}
    t.textContent=K.name(i)+(open?"":" (find an orb)");
    b.appendChild(im);b.appendChild(t);
    b.addEventListener("click",function(){K.set(i);closePick();});
    grid.appendChild(b);
  })(i);
  pickEl.hidden=false;pickEl.scrollTop=0;
  var on=grid.querySelector('[aria-pressed="true"]');if(on&&on.scrollIntoView)on.scrollIntoView({block:"center"});
}
/* a step of frame(): keep the five list buttons saying what is chosen, whoever changed it */
export function pickFrame(){
  var k,K,s;
  for(k=0;k<5;k++){
    K=KINDS[PICK_ORDER[k]];s=K.title+": "+K.name(K.cur());
    if(s!==pickWas[k]){pickWas[k]=s;K.btn.textContent=s;}
  }
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
pickEl=$("pick");pickWas=[];
KINDS={
 world:{title:"World",btn:$("pWorld"),n:function(){return WORLDS.length},name:function(i){return WORLDS[i]?WORLDS[i].name:""},
  pic:function(i){return i<NWORLD?thumbName("world",WORLDS[i].id):""},cur:function(){return WORLDS.indexOf(scene.world)},set:function(i){requestWorld(i)}},
 palette:{title:"Palette",btn:$("pPal"),n:function(){return PALETTES.length},name:function(i){return PALETTES[i]?PALETTES[i].name:""},
  pic:function(i){return i<NPAL?thumbName("palette",PALETTES[i].name):""},stripe:function(i){return palStripe(PALETTES[i])},open:palOpen,
  cur:function(){return sel.pi},set:setPalette},
 motion:{title:"Motion",btn:$("pMotion"),n:function(){return MOTIONS.length},name:function(i){return MOTIONS[i]?MOTIONS[i].name:""},
  pic:function(i){return i<NMOT?thumbName("motion",MOTIONS[i].name):""},cur:function(){return sel.moi},set:setMotion},
 filter:{title:"Filter",btn:$("pLook"),n:function(){return LOOKS.length},name:function(i){return LOOKS[i]?LOOKS[i].name:""},
  pic:function(i){return i<NLOOK?thumbName("filter",LOOKS[i].name):""},cur:function(){return sel.lki},set:setLook},
 overlay:{title:"Overlay",btn:$("pOv"),n:function(){return OVERLAYS.length},name:function(i){return OVERLAYS[i]?OVERLAYS[i].name:""},
  pic:function(i){return i<NOV?thumbName("overlay",OVERLAYS[i].name):""},cur:function(){return sel.ovi},set:setOverlay},
 mirrors:{title:"Mirrors",btn:$("bMirror"),n:function(){return mirrors.length},name:mirrorName,
  pic:function(i){return thumbName("mirrors",mirrors[i])},cur:function(){return sel.mi},set:setMirrors},
 fx:{title:"FX",btn:$("bFx"),n:function(){return FX.length},name:function(i){return "FX "+FX[i].name},
  pic:function(i){return thumbName("fx",FX[i].name)},cur:function(){return sel.fi},set:setFx},
 land:{title:"Land",btn:$("bLandKind"),n:function(){return LK.length},name:function(i){return LK[i].name},
  pic:function(i){return thumbName("land",LK[i].id)},cur:function(){return landKind},set:setLandKind},
 surface:{title:"Surface",btn:$("bSurf"),n:function(){return SURFACES.length},name:function(i){return "Surface "+SURFACES[i].name},
  pic:function(i){return thumbName("surface",SURFACES[i].name)},cur:function(){return sel.si},set:setSurface}
};
PICK_ORDER.forEach(function(k){KINDS[k].btn.addEventListener("click",function(){openPick(k)})});
$("pickClose").addEventListener("click",closePick);
pickEl.addEventListener("click",function(e){if(e.target===pickEl)closePick()}); /* a tap beside the grid shuts it */
window.addEventListener("keydown",function(e){if(e.code==="Escape")closePick()});
pickFrame();
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={PICK_ORDER, thumbName, palStripe, mirrorName, openPick, closePick, pickFrame,
  get KINDS(){return KINDS},set KINDS(v){KINDS=v}, get pickEl(){return pickEl},set pickEl(v){pickEl=v}, get pickOpen(){return pickOpen},set pickOpen(v){pickOpen=v}, get pickWas(){return pickWas},set pickWas(v){pickWas=v}};
