/* Hold still: a pause, and the sharpening of the picture while nothing in it moves. With Lens blur on, the frames it
   averages are each seen from a different place on a lens, all aimed through one point at the depth of whatever is in
   the middle of the picture: that depth stays sharp and the rest softens, as in a photograph taken close up. */
import { cam } from "./camera.js";
import { scene } from "./choose.js";
import { packing, pkDeep, pkMix, pkWave, pkZoom } from "./packing.js";
import { $, gl, toast } from "./dom.js";
import { press, wakeHud } from "./input.js";
import { landMode } from "./land.js";
import { bindTex, link, pCopy, passTo } from "./programs.js";
import { sel } from "./state.js";
import { freeT, tA, target } from "./targets.js";
import { vidOn } from "./video.js";
import { stereo } from "./vr.js";
import { zoomKey } from "./zoom.js";
export let still=false;  /* the Hold still switch: the clocks, the morph, the drift and Journey are stopped */
export let stillN=0;     /* how many frames are in the kept picture, up to STILL_MAX; 0 while the scene is moving */
export const jit=[0,0];  /* how far this frame's rays are shifted, in pixels: a different part of each pixel every frame */
export const STILL_MAX=32;
export const STILL_LENS=128; /* with Lens blur the kept picture takes more frames: each is one place on the lens, and too few show as copies */
export const LENS=[{name:"off",a:0},{name:"soft",a:0.008},{name:"strong",a:0.02}]; /* a: the lens's radius as a part of the sharp depth, or of three times the distance to the nearest surface if that is less, so that what is close is softened and not smeared away */
export let lensI=0;      /* which of LENS is chosen */
export const lens=[0,0,0]; /* for the shader: where on the lens this frame's rays start, across and up, and the sharp depth; all 0 for no lens */
let pAcc=null,rcur=0,shots=0,key="",focus=0;
const tR=[null,null];    /* the kept picture and the one before it */
const was=[0,0,0,0,0,0,0,0,0,0]; /* where the camera was and which way it faced last frame, and the morph */

/* The kept picture moves a share k of the way to the new frame. Pictures hold 256 levels a colour, too few for a small
   share to register, so a different speck of noise is added each frame: on average the rounding then comes out right. */
export const FS_ACC=[
"precision highp float;varying vec2 v;uniform sampler2D uT,uP;uniform float uK,uSeed;",
"void main(){",
"  vec3 a=texture2D(uT,v).rgb,p=texture2D(uP,v).rgb;",
"  float n=fract(sin(dot(gl_FragCoord.xy+uSeed,vec2(12.9898,78.233)))*43758.5453)-0.5;",
"  gl_FragColor=vec4(mix(p,a,uK)+n/255.0,1.0);",
"}"].join("\n");

/* a number between 0 and 1 that fills the range evenly as i counts up (the Halton sequence in base b) */
export function halton(i,b){var f=1,r=0;while(i>0){f/=b;r+=f*(i%b);i=Math.floor(i/b);}return r;}

export function setStill(on){
  still=!!on;press($("bStill"),still);
  if(!still){stillN=0;jit[0]=jit[1]=0;lens[0]=lens[1]=lens[2]=0;}
}
export function setLens(i){lensI=LENS[i]?i:0;$("bLens").textContent="Lens blur "+LENS[lensI].name;press($("bLens"),lensI>0);}
/* How far ahead the picture is to be sharp: the depth of what is straight ahead, walked to with the world's distance.
   de(x,y,z) is that distance, reach how far to look; 0 if there is nothing ahead within reach. */
export function lensFocus(de,pos,F,reach){
  var t=0,k,d;
  for(k=0;k<96;k++){
    d=de(pos[0]+F[0]*t,pos[1]+F[1]*t,pos[2]+F[2]*t);
    if(d<0.002*t+1e-5)return Math.max(t,1e-4);
    t+=d;if(t>reach)break;
  }
  return 0;
}
/* the same for the world in use: a cloud world has no surface and a pack world no distance to walk with, so each has a depth of its own */
function focusNow(fr){
  var w=scene.world,m=fr.m;
  if(w.volume)return 0.5;
  if(w.pack)return Math.max(0.02,4*fr.dist);
  return lensFocus(function(x,y,z){return w.de(x,y,z,m);},cam.pos,cam.F,w.maxd*(pkDeep(w)?pkZoom(cam.pos,w.grid):1))||Math.max(0.02,4*fr.dist); /* looking out into the distance: the nearest things are the sharp ones */
}
export function stillFree(){freeT(tR[0]);freeT(tR[1]);tR[0]=tR[1]=null;stillN=0;}

/* Before the scene is drawn: is everything where it was last frame? If so, one more frame goes into the kept picture,
   with its rays shifted to a new part of each pixel. The land alone and a video are left as they are. */
export function stillAim(fr){
  var blur=lensI>0&&!stereo&&!landMode&&!scene.world.flat,most=blur?STILL_LENS:STILL_MAX,a,r;
  if(!still||landMode===1||vidOn){stillN=0;jit[0]=jit[1]=0;lens[0]=lens[1]=lens[2]=0;return;}
  var now=[cam.pos[0],cam.pos[1],cam.pos[2],cam.F[0],cam.F[1],cam.F[2],cam.Up[0],cam.Up[1],cam.Up[2],fr.m],i,same=true;
  var k=scene.world.id+","+tA.w+","+tA.h+","+sel.mi+","+sel.pi+","+(stereo?1:0)+","+packing+(pkWave?"w":"")+(pkMix?"m":"")+","+lensI+(scene.world.flat?","+zoomKey():"");
  for(i=0;i<10;i++){if(Math.abs(now[i]-was[i])>1e-9)same=false;was[i]=now[i];}
  if(k!==key){key=k;same=false;}
  stillN=same?Math.min(most,stillN+1):1;
  shots=same?shots+1:0;
  jit[0]=halton(shots%64+1,2)-0.5;jit[1]=halton(shots%64+1,3)-0.5;
  if(!blur){lens[0]=lens[1]=lens[2]=0;return;}
  if(!same||!(focus>0))focus=focusNow(fr);
  /* this frame's place on the lens: the places fill a disc evenly as the frames go by */
  r=LENS[lensI].a*Math.min(focus,3*Math.max(fr.dist,1e-4))*Math.sqrt(halton(shots%256+1,5));a=6.2831853*halton(shots%256+1,7);
  lens[0]=r*Math.cos(a);lens[1]=r*Math.sin(a);lens[2]=focus;
}
/* After the scene is drawn: fold it into the kept picture, and put the kept picture where the scene was, for the effects to work on. */
export function stillBlend(){
  if(!stillN)return;
  if(!tR[0]){tR[0]=target(tA.w,tA.h);tR[1]=target(tA.w,tA.h);}
  var dst=tR[rcur],U=pAcc.U;
  passTo(dst,pAcc);bindTex(0,tA.t);bindTex(1,tR[1-rcur].t);
  gl.uniform1i(U.uT,0);gl.uniform1i(U.uP,1);gl.uniform1f(U.uK,1/stillN);gl.uniform1f(U.uSeed,shots*17.0);
  gl.drawArrays(gl.TRIANGLES,0,3);
  passTo(tA,pCopy);bindTex(0,dst.t);gl.uniform1i(pCopy.U.uT,0);gl.drawArrays(gl.TRIANGLES,0,3);
  rcur=1-rcur;
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
pAcc=link(FS_ACC,["uT","uP","uK","uSeed"]);
$("bStill").addEventListener("click",function(){
  setStill(!still);
  toast(still?"Holding still. The picture sharpens while you are not moving.":"Moving again");wakeHud();
});
(function(){var sv="",i;try{sv=localStorage.getItem("mirrorfold-lens")||""}catch(_){}for(i=0;i<LENS.length;i++)if(LENS[i].name===sv)lensI=i;setLens(lensI);})();
$("bLens").addEventListener("click",function(){
  setLens((lensI+1)%LENS.length);try{localStorage.setItem("mirrorfold-lens",LENS[lensI].name)}catch(_){}
  toast(lensI?"Lens blur "+LENS[lensI].name+". It shows while holding still: what is in the middle of the picture stays sharp, and the rest softens.":"Lens blur off");wakeHud();
});
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={jit, lens, LENS, STILL_LENS, setLens, lensFocus, focusNow, get lensI(){return lensI},set lensI(v){lensI=v}, get lensDepth(){return focus},set lensDepth(v){focus=v}, STILL_MAX, FS_ACC, halton, setStill, stillFree, stillAim, stillBlend, tR, was,
  get still(){return still},set still(v){still=v}, get stillN(){return stillN},set stillN(v){stillN=v}, get pAcc(){return pAcc},set pAcc(v){pAcc=v},
  get rcur(){return rcur},set rcur(v){rcur=v}, get shots(){return shots},set shots(v){shots=v}, get key(){return key},set key(v){key=v}};
