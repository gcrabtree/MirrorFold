/* Palettes: the list, which are unlocked, which is chosen, and the one in use easing toward it. */
import { $ } from "./dom.js";
import { sel } from "./state.js";
export let unlocked=0,orbsFound=0; /* palettes unlocked by orbs, and orbs found; kept in this browser */
/* cosine palettes: colour = a + b*cos(2pi*(c*x+d)) */
export const PALETTES=[
 {name:"Spectrum",a:[.5,.5,.5],b:[.5,.5,.5],c:[1,1,1],d:[0,.33,.67]},
 {name:"Ember",a:[.5,.22,.08],b:[.5,.25,.1],c:[1,1,1],d:[0,.07,.15]},
 {name:"Abyss",a:[.1,.4,.5],b:[.12,.4,.5],c:[1,1,1],d:[.55,.15,0]},
 {name:"Sunset",a:[.5,.5,.5],b:[.5,.5,.5],c:[1,.7,.4],d:[0,.15,.2]},
 {name:"Acid",a:[.5,.5,.5],b:[.5,.5,.5],c:[2,1,0],d:[.5,.2,.25]},
 {name:"Orchid",a:[.55,.3,.6],b:[.45,.3,.4],c:[1,1,1],d:[0,.45,.15]},
 {name:"Bone",a:[.5,.48,.44],b:[.5,.48,.44],c:[1,1,1],d:[0,.02,.05]}
,
 {name:"Aurora",a:[.2,.5,.4],b:[.2,.5,.4],c:[1,1,1],d:[.6,0,.3]},
 {name:"Infra",a:[.5,.1,.3],b:[.5,.1,.3],c:[1,1,1],d:[0,.5,.6]},
 {name:"Candy",a:[.7,.5,.6],b:[.3,.4,.4],c:[1,1,1],d:[0,.3,.6]},
 {name:"Toxic",a:[.3,.5,.05],b:[.3,.5,.05],c:[1,1,1],d:[.15,0,.5]},
 {name:"Gold",a:[.5,.4,.15],b:[.5,.4,.2],c:[1,1,1],d:[0,.05,.3]},
 {name:"Ultraviolet",a:[.35,.1,.55],b:[.35,.1,.45],c:[1,1,1],d:[.1,.5,0]}
];
export const BASE_PALS=7;
export const NPAL=PALETTES.length;
/* a built-in palette is open once its orb is found; palettes from a pack are always open */
export function palOpen(i){return i<BASE_PALS+unlocked||i>=NPAL;}
/* What this file does when the app starts. main.js calls each file's init in turn. */
/* an orb was collected: count it, and unlock the next palette if any are left. True if one was unlocked. */
export function orbCounted(){orbsFound++;if(unlocked<NPAL-BASE_PALS){unlocked++;return true;}return false;}
export let palCur;
export function saveProgress(){try{localStorage.setItem("mirrorfold",JSON.stringify({u:unlocked,n:orbsFound}))}catch(_){}}
export function fillPalettes(){
  $("selPal").textContent="";
  PALETTES.forEach(function(p,i){var o=document.createElement("option");o.value=String(i);$("selPal").appendChild(o);});
  labelPalettes();$("selPal").value=String(sel.pi);
}
export function labelPalettes(){
  Array.prototype.forEach.call($("selPal").options,function(o,i){
    var locked=!palOpen(i);o.disabled=locked;o.textContent=PALETTES[i].name+(locked?" (find an orb)":"");
  });
}
export function setPalette(i){ /* wraps round, and steps past palettes that are still locked */
  var n=PALETTES.length;i=((i%n)+n)%n;
  while(!palOpen(i))i=(i+1)%n;
  sel.pi=i;$("selPal").value=String(sel.pi);
}
function randomPalette(){
  var o=[],i;for(i=0;i<PALETTES.length;i++)if(i!==sel.pi&&palOpen(i))o.push(i);
  return o.length?o[Math.floor(Math.random()*o.length)]:sel.pi;
}
/* The palette in use eases toward the chosen one. */
export function easePalette(dt){
  var pl=PALETTES[sel.pi],pe=1-Math.exp(-dt*1.6),key,j;
  for(key in palCur){for(j=0;j<3;j++)palCur[key][j]+=(pl[key][j]-palCur[key][j])*pe;}
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
palCur={a:PALETTES[0].a.slice(),b:PALETTES[0].b.slice(),c:PALETTES[0].c.slice(),d:PALETTES[0].d.slice()};
try{var sv=JSON.parse(localStorage.getItem("mirrorfold")||"{}");unlocked=Math.max(0,Math.min(NPAL-BASE_PALS,sv.u|0));orbsFound=sv.n|0;}catch(_){}
}

/* for the test tools and the browser console: every name in this file, readable and (where it can change) settable */
export const __dbg={get unlocked(){return unlocked},set unlocked(v){unlocked=v}, get orbsFound(){return orbsFound},set orbsFound(v){orbsFound=v}, get PALETTES(){return PALETTES}, get BASE_PALS(){return BASE_PALS}, get NPAL(){return NPAL}, get palOpen(){return palOpen},
  get orbCounted(){return orbCounted}, get palCur(){return palCur},set palCur(v){palCur=v}, get saveProgress(){return saveProgress}, get fillPalettes(){return fillPalettes}, get labelPalettes(){return labelPalettes}, get setPalette(){return setPalette},
  get randomPalette(){return randomPalette}, get easePalette(){return easePalette}};
