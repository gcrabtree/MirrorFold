/* Palettes: the list, which are unlocked, which is chosen, and the one in use easing toward it. */
import { $, gl } from "./dom.js";
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
 {name:"Bone",a:[.5,.48,.44],b:[.5,.48,.44],c:[1,1,1],d:[0,.02,.05]},
 {name:"Wood",a:[.42,.23,.1],b:[.24,.15,.08],c:[1,1,1],d:[0,.03,.06]} /* browns, pale to dark: with Surface grain it gives timber */
,
 {name:"Aurora",a:[.2,.5,.4],b:[.2,.5,.4],c:[1,1,1],d:[.6,0,.3]},
 {name:"Infra",a:[.5,.1,.3],b:[.5,.1,.3],c:[1,1,1],d:[0,.5,.6]},
 {name:"Candy",a:[.7,.5,.6],b:[.3,.4,.4],c:[1,1,1],d:[0,.3,.6]},
 {name:"Toxic",a:[.3,.5,.05],b:[.3,.5,.05],c:[1,1,1],d:[.15,0,.5]},
 {name:"Gold",a:[.5,.4,.15],b:[.5,.4,.2],c:[1,1,1],d:[0,.05,.3]},
 {name:"Ultraviolet",a:[.35,.1,.55],b:[.35,.1,.45],c:[1,1,1],d:[.1,.5,0]},
 /* three near-greys for the Biomech world: cold steel, old bone, and green bronze. They are open from the start (open:true), not found by orbs */
 {name:"Gunmetal",a:[.36,.40,.41],b:[.33,.35,.34],c:[1,1,1],d:[0,.02,.05],open:true},
 {name:"Tallow",a:[.42,.36,.25],b:[.38,.32,.22],c:[1,1,1],d:[0,.03,.08],open:true},
 {name:"Verdigris",a:[.20,.35,.30],b:[.20,.30,.26],c:[1,1,1],d:[.06,0,.11],open:true},
 /* for the Seer world: gold flames through violet to deep blue. Open from the start too */
 {name:"Vision",a:[.5,.38,.42],b:[.5,.35,.42],c:[1,1,1],d:[0,.1,.5],open:true},
 /* for the Net world: deep blue to a pale silver-blue and back, and nothing else. Open from the start too */
 {name:"Cobalt",a:[.36,.48,.72],b:[.36,.42,.28],c:[1,1,1],d:[.5,.5,.5],open:true}
];
export const BASE_PALS=8;
export const ORB_PALS=6; /* how many palettes after those are opened by finding orbs */
export const NPAL=PALETTES.length;
/* a built-in palette is open once its orb is found; palettes from a pack are always open */
export function palOpen(i){return i<BASE_PALS+unlocked||i>=NPAL||!!(PALETTES[i]&&PALETTES[i].open);}
/* give a shader the palette in use (its four uniforms uPa, uPb, uPc, uPd) */
export function setPal(U){gl.uniform3fv(U.uPa,palCur.a);gl.uniform3fv(U.uPb,palCur.b);gl.uniform3fv(U.uPc,palCur.c);gl.uniform3fv(U.uPd,palCur.d);}

/* What this file does when the app starts. main.js calls each file's init in turn. */
/* an orb was collected: count it, and unlock the next palette if any are left. True if one was unlocked. */
export function orbCounted(){orbsFound++;if(unlocked<ORB_PALS){unlocked++;return true;}return false;}
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
try{var sv=JSON.parse(localStorage.getItem("mirrorfold")||"{}");unlocked=Math.max(0,Math.min(ORB_PALS,sv.u|0));orbsFound=sv.n|0;}catch(_){}
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={PALETTES, ORB_PALS, BASE_PALS, NPAL, palOpen, setPal, orbCounted, saveProgress, fillPalettes, labelPalettes, setPalette,
  randomPalette, easePalette, get unlocked(){return unlocked},set unlocked(v){unlocked=v}, get orbsFound(){return orbsFound},set orbsFound(v){orbsFound=v}, get palCur(){return palCur},set palCur(v){palCur=v}};
