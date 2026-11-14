/* The orb: one hidden in each world. Flying into it unlocks a palette, or warps on to another world once all are unlocked. */
import { ac, pluck } from "./audio.js";
import { cam } from "./camera.js";
import { requestWorld, scene } from "./choose.js";
import { morphValue } from "./clock.js";
import { orbsOn } from "./controls.js";
import { toast } from "./dom.js";
import { bands, musicMode } from "./listen.js";
import { started } from "./loop.js";
import { deMany } from "./pack-worlds.js";
import { BASE_PALS, PALETTES, labelPalettes, orbCounted, orbsFound, saveProgress, setPalette, unlocked } from "./palettes.js";
import { sel } from "./state.js";
import { vidAlone } from "./video.js";
import { tr } from "./warp.js";
import { WORLDS } from "./worlds.js";
export function spawnOrb(){
  var w=scene.world,m=morphValue(),per=w.period(m),sc=Math.min(per[0],per[1],per[2])/2,best=-1,bp=null,bd=0;
  var nc=w.pack?96:260,cand=new Float32Array(3*nc),k;
  for(k=0;k<3*nc;k++)cand[k]=(Math.random()-.5)*per[k%3];
  var cd=deMany(w,cand,nc,m);
  for(k=0;k<nc;k++){
    var c=[cand[3*k],cand[3*k+1],cand[3*k+2]];
    var d=Math.abs(cd[k]),far=0;
    for(var i=0;i<3;i++){var q=c[i]-cam.pos[i];q-=per[i]*Math.floor(q/per[i]+.5);far+=q*q;}
    var sc2=Math.min(d,0.25*sc)*(Math.sqrt(far)>0.45*sc?1:0.1)*(0.7+0.3*Math.random());
    if(sc2>best){best=sc2;bp=c;bd=d;}
  }
  scene.orb={p:bp,r:Math.max(0.012*sc,Math.min(0.05*sc,bd*0.35))};scene.orbT=0;
}
function chime(){
  if(ac&&ac.state==="running"&&(musicMode==="built"||musicMode==="file")){var t=ac.currentTime;pluck(t,880);pluck(t+0.09,1318.5);pluck(t+0.18,1760);}
}
export function collectOrb(){
  bands.b.p=1;cam.boost=Math.max(cam.boost,0.5);chime();
  if(orbCounted()){
    labelPalettes();setPalette(BASE_PALS+unlocked-1);
    toast("Orb found. Palette unlocked: "+PALETTES[sel.pi].name);
    spawnOrb();
  }else{
    toast("Orb found. "+orbsFound+" so far. Warping on.");
    var nw=(WORLDS.indexOf(scene.world)+1+Math.floor(Math.random()*(WORLDS.length-1)))%WORLDS.length;
    scene.orb=null;requestWorld(nw);
  }
  saveProgress();
}
/* The orb: drawn at its nearest copy, collected when you reach it, moved if the morph swallows it. Leaves where to draw it in fr.orbU. */
export function stepOrb(fr){
  var dt=fr.dt,m=fr.m,w=fr.w,per=fr.per,i;
  var orbU=fr.orbU;orbU[0]=orbU[1]=orbU[2]=orbU[3]=0;
  if(scene.orb&&orbsOn&&started&&!vidAlone()&&!w.flat){ /* a zoom world is a flat picture: nowhere to hide an orb */
    /* with the video filling the screen there is no world to find an orb in */
    var oq=[0,0,0],od=0;
    for(i=0;i<3;i++){oq[i]=scene.orb.p[i]-cam.pos[i];oq[i]-=per[i]*Math.floor(oq[i]/per[i]+.5);od+=oq[i]*oq[i];}
    if(Math.sqrt(od)<scene.orb.r*2.5&&tr.warpDir===0)collectOrb();
    else{
      orbU[0]=cam.pos[0]+oq[0];orbU[1]=cam.pos[1]+oq[1];orbU[2]=cam.pos[2]+oq[2];orbU[3]=scene.orb.r;
      scene.orbT+=dt;
      if(scene.orbT>1.5){scene.orbT=0;if(!w.volume&&Math.abs(w.de(scene.orb.p[0],scene.orb.p[1],scene.orb.p[2],m))<scene.orb.r*0.6)spawnOrb();}
    }
  }
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={spawnOrb, chime, collectOrb, stepOrb};
