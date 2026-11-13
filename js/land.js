/* The land at run time: its noise table, height, programs, drawing and controls. */
import { LK, landSrc } from "./landscapes.js";
import { LAND_PRE_MAIN, LFREQ } from "./land-shader.js";
import { $, gl } from "./dom.js";
import { link } from "./programs.js";
import { freeT, tA, target } from "./targets.js";
import { bindTex, camArr, passTo } from "./loop.js";
import { mirrors } from "./state.js";
import { palCur } from "./shaders.js";
import { toast } from "./flight.js";
import { G } from "./shared.js";
export let landMode, landKind, landTint, landFx, pLand, pMix;
let pLandPre, landTex;

const FS_MIX="precision highp float;varying vec2 v;uniform sampler2D uT,uL;void main(){vec4 L=texture2D(uL,v);gl_FragColor=vec4(mix(texture2D(uT,v).rgb,L.rgb,L.a),1.0);}"; /* the land laid over the world */
const LAND_U=["uX","uRes","uTime","uPos","uCam","uFov","uSeg","uSpin","uSky","uSkyT","uSun","uSunCol","uCi","uCf","uLi","uLf","uDa","uDb","uPa","uPb","uPc","uPd","uHue","uTint","uN","uPre","uPreRes","uK"];
/* the table of random numbers, made the same way every time */
const LTAB=new Uint8Array(65536);
export function landHash(ix,iy){return LTAB[(ix&255)+256*(iy&255)]/255;}
/* the land's height in JavaScript: the same sum as terrL (N=4) and terrM (N=6) in the shader */
export function landH(x,z,N){
  if(LK[landKind].h)return LK[landKind].h(x,z);
  var px=x*LFREQ,pz=z*LFREQ,a=0,b=1,dx=0,dz=0,i,t;
  for(i=0;i<N;i++){
    var ix=Math.floor(px),iz=Math.floor(pz),fx=px-ix,fz=pz-iz,ux=fx*fx*fx*(fx*(fx*6-15)+10),uz=fz*fz*fz*(fz*(fz*6-15)+10);
    var A=landHash(ix,iz),B=landHash(ix+1,iz),C=landHash(ix,iz+1),D=landHash(ix+1,iz+1),k=A-B-C+D;
    var v=A+(B-A)*ux+(C-A)*uz+k*ux*uz;
    dx+=30*fx*fx*(fx*(fx-2)+1)*(B-A+k*uz);dz+=30*fz*fz*(fz*(fz-2)+1)*(C-A+k*ux);
    a+=b*(i<3?v:v-0.5)/(1+dx*dx+dz*dz);b*=0.5;
    t=2*px-pz;pz=px+2*pz;px=t;px-=256*Math.floor(px/256);pz-=256*Math.floor(pz/256);
  }
  return LK[landKind].shape(a);
}
export function landFloor(x,z){return LK[landKind].h?0:Math.max(landH(x,z,6),LK[landKind].water);}
const LAYERS=[[240,0],[100,1],[160,1],[30,1],[230,0],[320,1]];
const pLandK=[];
export const lpos=[412,1,300];
export const lvel=[0,0];
export const lhead=[0.56,0.83];
/* For a landscape with free-standing shapes: a table, one entry to each square of the coarsest grid, of whether a shape
   stands there and the height of the ground under it. The shader reads it as a texture (height in two bytes), JavaScript as xh. */
function landXTab(K){
  if(!K.xcell||K.xh)return;
  var px=new Uint8Array(262144),ix,iz,o,v,q;K.xh=new Float32Array(65536);
  for(iz=0;iz<256;iz++)for(ix=0;ix<256;ix++){
    o=ix+256*iz;v=K.xcell(ix,iz);
    if(v===null){K.xh[o]=NaN;continue;}
    q=Math.round(Math.max(0,Math.min(65535,(v+0.5)*13107)));K.xh[o]=q/13107-0.5;
    px[4*o]=q>>8;px[4*o+1]=q&255;px[4*o+2]=255;px[4*o+3]=255;
  }
  K.xtex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,K.xtex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,256,256,0,gl.RGBA,gl.UNSIGNED_BYTE,px);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
}
function landBuild(){ /* compiled the first time the land is turned on; false if this device cannot */
  var c=pLandK[landKind],src;
  if(c){pLand=c[0];pLandPre=c[1];return true;}
  try{if(LK[landKind].src)c=[link(LK[landKind].src(),LAND_U),null];else{src=landSrc(landKind);c=[link(src,LAND_U),link(src.slice(0,src.indexOf("/*sky*/"))+LAND_PRE_MAIN,LAND_U)];}if(!pMix)pMix=link(FS_MIX,["uT","uL"]);}catch(e){return false;}
  pLandK[landKind]=c;pLand=c[0];pLandPre=c[1];
  landXTab(LK[landKind]);
  if(landTex)return true;
  /* each texel holds its own number and those of the three neighbours to its right, above, and above right */
  var px=new Uint8Array(262144),x,y,o;
  for(y=0;y<256;y++)for(x=0;x<256;x++){o=4*(x+256*y);px[o]=LTAB[x+256*y];px[o+1]=LTAB[((x+1)&255)+256*y];px[o+2]=LTAB[x+256*((y+1)&255)];px[o+3]=LTAB[((x+1)&255)+256*((y+1)&255)];}
  landTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,landTex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,256,256,0,gl.RGBA,gl.UNSIGNED_BYTE,px);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  return true;
}
/* draw the land into dst. "over" leaves the sky clear (alpha 0) and lets lakes mirror the world in tA. */
const LP_CI=new Float32Array(26),LP_CF=new Float32Array(26),LP_LI=new Float32Array(12),LP_LF=new Float32Array(12);
export function landPass(dst,over,fov,hue){
  var pw=Math.ceil(tA.w/8),ph=Math.ceil(tA.h/8),k,tt,wrap=function(v){return v-256*Math.floor(v/256)};
  if(!G.tLP||G.tLP.w!==pw||G.tLP.h!==ph){freeT(G.tLP);G.tLP=target(pw,ph);}
  /* the camera's place in each noise layer and each grid of things, split into a whole number and a remainder so the shader loses nothing */
  var ci=LP_CI,cf=LP_CF,li=LP_LI,lf=LP_LF,px=lpos[0]*LFREQ,pz=lpos[2]*LFREQ; /* kept between frames, so nothing is left for the browser to clear up */
  for(k=0;k<13;k++){px=wrap(px);pz=wrap(pz);ci[2*k]=Math.floor(px);ci[2*k+1]=Math.floor(pz);cf[2*k]=px-Math.floor(px);cf[2*k+1]=pz-Math.floor(pz);tt=2*px-pz;pz=px+2*pz;px=tt;}
  LAYERS.forEach(function(L,j){var ax=lpos[0]*LFREQ*L[0],az=lpos[2]*LFREQ*L[0],bx=wrap(L[1]?2*ax-az:ax),bz=wrap(L[1]?ax+2*az:az);
    li[2*j]=Math.floor(bx);li[2*j+1]=Math.floor(bz);lf[2*j]=bx-Math.floor(bx);lf[2*j+1]=bz-Math.floor(bz);});
  var da=[wrap(lpos[0]*LFREQ*429),wrap(lpos[2]*LFREQ*429)],db=[wrap(lpos[0]*LFREQ*2571),wrap(lpos[2]*LFREQ*2571)];
  var set=function(U){
    gl.uniform2f(U.uRes,tA.w,tA.h);gl.uniform1f(U.uTime,G.time);
    gl.uniform3f(U.uPos,lpos[0],lpos[1],lpos[2]);gl.uniformMatrix3fv(U.uCam,false,camArr);
    gl.uniform1f(U.uFov,fov);gl.uniform1f(U.uSeg,mirrors[G.mi]);gl.uniform1f(U.uSpin,G.spin);gl.uniform1f(U.uSky,over?1:0);
    gl.uniform2fv(U.uCi,ci);gl.uniform2fv(U.uCf,cf);gl.uniform2fv(U.uLi,li);gl.uniform2fv(U.uLf,lf);
    gl.uniform4f(U.uDa,Math.floor(da[0]),Math.floor(da[1]),da[0]%1,da[1]%1);gl.uniform4f(U.uDb,Math.floor(db[0]),Math.floor(db[1]),db[0]%1,db[1]%1);
    gl.uniform3fv(U.uPa,palCur.a);gl.uniform3fv(U.uPb,palCur.b);gl.uniform3fv(U.uPc,palCur.c);gl.uniform3fv(U.uPd,palCur.d);
    gl.uniform1f(U.uHue,hue);gl.uniform1f(U.uTint,landTint);
    gl.uniform3fv(U.uSun,LK[landKind].sun);gl.uniform3fv(U.uSunCol,LK[landKind].sunCol);
    gl.uniform1i(U.uX,7);gl.uniform1i(U.uN,4);gl.uniform1i(U.uPre,5);gl.uniform1i(U.uSkyT,6);gl.uniform2f(U.uPreRes,pw,ph);gl.uniform1f(U.uK,8);
  };
  camArr[0]=G.R[0];camArr[1]=G.R[1];camArr[2]=G.R[2];camArr[3]=G.Up[0];camArr[4]=G.Up[1];camArr[5]=G.Up[2];camArr[6]=G.F[0];camArr[7]=G.F[1];camArr[8]=G.F[2];
  bindTex(5,landTex);bindTex(6,landTex);bindTex(7,LK[landKind].xtex||landTex);bindTex(4,landTex);
  if(pLandPre){passTo(G.tLP,pLandPre);set(pLandPre.U);gl.drawArrays(gl.TRIANGLES,0,3);}
  bindTex(5,G.tLP.t);bindTex(6,over?tA.t:landTex);
  passTo(dst,pLand);set(pLand.U);gl.drawArrays(gl.TRIANGLES,0,3);
}
export function setLand(mode){
  if(mode&&!landBuild()){toast("The land does not work on this device.");mode=0;if(!pLandK[landKind])pLand=null;}
  landMode=mode;
  if(mode)lpos[1]=Math.max(lpos[1],landFloor(lpos[0],lpos[2])+G.landClear);
  $("bLand").textContent=["Land off","Land alone","Land over world"][mode];
  $("bLandKind").hidden=$("bLandTint").hidden=!mode;$("bLandFx").hidden=mode!==2;
}
export function setLandKind(k){ /* each landscape's shader is compiled the first time it is chosen */
  var was=landKind;landKind=k;
  if(landMode&&!landBuild()){landKind=was;landBuild();toast("That landscape does not work on this device.");}
  if(landMode)lpos[1]=Math.max(lpos[1],landFloor(lpos[0],lpos[2])+G.landClear);
  $("bLandKind").textContent=LK[landKind].name;
}
export function setLandTint(k){landTint=k;$("bLandTint").textContent=["Land colours natural","Palette on sky and light","Palette on everything"][k];}
export function setLandFx(k){landFx=k;$("bLandFx").textContent=["Effects on everything","Effects on the sky","Effects on the land"][k];}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
(function(){var sd=20261113,i;for(i=0;i<65536;i++){sd=(Math.imul(sd,1664525)+1013904223)>>>0;LTAB[i]=sd>>>24;}})(); /* the grids things are scattered on: trees, trees, bushes, boulders, rocks, scree */
landMode=0,landKind=0,landTint=0,landFx=0; /* which landscape (an entry in LK); 0 off, 1 alone, 2 over the world; palette on nothing, sky and light, everything; effects on everything, sky, land */
pLand=null;
pLandPre=null;
pMix=null;
landTex=null;
G.tL=null;
G.tC=null;
G.tLP=null;
G.landClear=0.11;
}

/* for the test tools and the browser console: every name in this file, readable and (where it can change) settable */
export const __dbg={get FS_MIX(){return FS_MIX}, get LAND_U(){return LAND_U}, get LTAB(){return LTAB}, get landHash(){return landHash}, get landH(){return landH}, get landFloor(){return landFloor},
  get LAYERS(){return LAYERS}, get landMode(){return landMode},set landMode(v){landMode=v}, get landKind(){return landKind},set landKind(v){landKind=v}, get landTint(){return landTint},set landTint(v){landTint=v}, get landFx(){return landFx},set landFx(v){landFx=v}, get pLand(){return pLand},set pLand(v){pLand=v},
  get pLandPre(){return pLandPre},set pLandPre(v){pLandPre=v}, get pLandK(){return pLandK}, get pMix(){return pMix},set pMix(v){pMix=v}, get landTex(){return landTex},set landTex(v){landTex=v}, get lpos(){return lpos}, get lvel(){return lvel},
  get lhead(){return lhead}, get landXTab(){return landXTab}, get landBuild(){return landBuild}, get LP_CI(){return LP_CI}, get LP_CF(){return LP_CF}, get LP_LI(){return LP_LI},
  get LP_LF(){return LP_LF}, get landPass(){return landPass}, get setLand(){return setLand}, get setLandKind(){return setLandKind}, get setLandTint(){return setLandTint}, get setLandFx(){return setLandFx}};
