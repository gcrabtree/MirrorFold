/* A video of your own, or the camera, shown in the picture. The shaders do not read the video itself but a small picture
   kept here, which follows the video only as fast as is safe: no sixteenth of it may change its average brightness quickly.
   So whatever is in the video, it cannot make the screen flash. */
import { ac, bus } from "./audio.js";
import { $, calm, errBox, gl, toast } from "./dom.js";
import { wakeHud } from "./input.js";
import { musicMode, setMusic } from "./listen.js";
import { bindTex, link, passTo } from "./programs.js";
import { freeT, target } from "./targets.js";

/* the ways a video can be shown. 3d: it is part of the world's surfaces, so it is right for each eye in the VR viewer; the others are flat on the screen */
export const VMODES=[
 {name:"on the surfaces",d3:true},  /* painted onto the world's surfaces, repeating with the world */
 {name:"through the shapes"},       /* flat on the screen, seen only where there is a surface, lit as the surface is */
 {name:"in the distance"},          /* flat on the screen, behind everything: the world fades into it with distance */
 {name:"in the overlay"},           /* the overlay's lines and shapes are windows onto it */
 {name:"as the colours",d3:true},   /* the world's colouring reads its colours from the video */
 {name:"filling the screen",alone:true} /* no world: the video is the scene, and the mirrors, motions, filters and overlays work on it. The land can stand in front */
];
export const VAMT=[.35,.6,.85,1];
export let vidMode=0,vidAmt=2;   /* positions in VMODES and VAMT */
export let vidOn=false;          /* a video is loaded and showing */
let kind="";                     /* the chosen file's type, as the browser names it, for the message if it will not play */
let sound=false,node=null;       /* the video's sound is wanted as the music, and its connection into the audio graph */
let pScene=null;
/* the video as the whole scene: fitted to the screen, folded by the mirrors as a world is, and swelling a little on the beat */
const FS_SCENE=[
"precision highp float;uniform vec2 uRes,uFit;uniform float uSeg,uSpin,uZoom;uniform sampler2D uVid;",
"void main(){",
"  float sc=sqrt(uRes.x*uRes.y);vec2 uv=(2.0*gl_FragCoord.xy-uRes)/sc;",
"  if(uSeg>0.5){float r=length(uv),seg=6.2831853/uSeg,a=atan(uv.y,uv.x)+uSpin;a=abs(a-floor(a/seg)*seg-0.5*seg);uv=r*vec2(cos(a),sin(a));}",
"  vec2 q=uv*sc/uRes*0.5*uFit*uZoom+0.5;",
"  gl_FragColor=vec4(texture2D(uVid,1.0-abs(fract(q*0.5)*2.0-1.0)).rgb,1.0);", /* past its edge the video carries on as its own mirror image */
"}"].join("\n");
let el=null,url=null,stream=null,raw=null,blank=null,pVid=null,cur=0,asp=16/9,lastT=-1;
const tV=[null,null];            /* the video picture the shaders read, and the one before it */
let tM=null,pMean=null;          /* a 4 by 4 picture of the newest frame: the average colour of each sixteenth of it */
const mNew=new Uint8Array(64),mOut=new Float32Array(64); /* those averages, and the same for the picture the shaders read */
const FS_MEAN="precision mediump float;varying vec2 v;uniform sampler2D uT;void main(){vec3 s=vec3(0.0);vec2 c=floor(v*4.0)/4.0;for(int i=0;i<6;i++)for(int j=0;j<6;j++)s+=texture2D(uT,c+(vec2(float(i),float(j))+0.5)/24.0).rgb;gl_FragColor=vec4(s/36.0,1.0);}";
const VW=640;                    /* its width in pixels */
const FS_VID="precision mediump float;varying vec2 v;uniform sampler2D uT,uP;uniform float uK;void main(){gl_FragColor=vec4(mix(texture2D(uP,v).rgb,texture2D(uT,vec2(v.x,1.0-v.y)).rgb,uK),1.0);}";

function label(){
  $("bVideo").textContent=vidOn?"Video on":"Video off";
  $("bVidMode").textContent="Video "+VMODES[vidMode].name;
  $("bVidAmt").textContent="Video strength "+Math.round(VAMT[vidAmt]*100)+"%";
  $("bVidPlay").hidden=!vidOn||!!stream;$("bVidPlay").textContent=el&&el.paused?"Play video":"Pause video";
}
export function setVidMode(i){vidMode=i%VMODES.length;label();}
export function vidFile(){return !!(el&&el.getAttribute("src"));} /* a video file is loaded (the camera does not count: it has no sound) */
export function vidAlone(){return vidOn&&!!tV[0]&&!!VMODES[vidMode].alone;} /* the video is the scene and no world is drawn */
/* Whether the video's sound is the music. The sound is joined to the audio graph the first time it is wanted; from then on it plays
   only through the graph, so muting the video is what silences it. The camera has no sound. */
export function videoSound(on){
  sound=!!on;if(!el)return;
  if(sound&&!node&&ac){try{node=ac.createMediaElementSource(el);node.connect(bus);}catch(e){}}
  el.muted=!(sound&&node&&!stream);
}
/* draw the video as the scene into the picture o */
export function videoScene(o,seg,spin,bt){
  var sa=o.w/o.h;
  passTo(o,pScene);bindTex(5,tV[cur].t);gl.uniform1i(pScene.U.uVid,5);
  gl.uniform2f(pScene.U.uRes,o.w,o.h);gl.uniform2f(pScene.U.uFit,sa>asp?1:sa/asp,sa>asp?asp/sa:1);
  gl.uniform1f(pScene.U.uSeg,seg);gl.uniform1f(pScene.U.uSpin,spin);gl.uniform1f(pScene.U.uZoom,1-0.025*bt);
  gl.drawArrays(gl.TRIANGLES,0,3);
}
export function setVidAmt(i){vidAmt=i%VAMT.length;label();}
function stopSource(){
  if(stream){stream.getTracks().forEach(function(t){t.stop()});stream=null;}
  if(el){el.pause();el.removeAttribute("src");el.srcObject=null;}
  if(url){try{URL.revokeObjectURL(url)}catch(_){}url=null;}
  vidOn=false;lastT=-1;
}
export function videoOff(){stopSource();if(musicMode==="video")setMusic("off");label();}
function element(){
  if(el)return el;
  el=document.createElement("video");el.muted=true;el.loop=true;el.playsInline=true;el.setAttribute("playsinline","");el.preload="auto";
  el.addEventListener("loadeddata",function(){
    /* a file whose sound the browser can play but whose picture it cannot: common with phone recordings (HEVC) on a computer */
    if(!el.videoWidth){if(!stream)errBox.textContent="This browser can play that file's sound but not its picture. The picture is probably HEVC (H.265), which many computers cannot show. Try it on the phone it came from, or convert it to H.264.";return;}
    if(Math.max(el.videoWidth,el.videoHeight)>gl.getParameter(gl.MAX_TEXTURE_SIZE)){errBox.textContent="That video is "+el.videoWidth+" by "+el.videoHeight+", larger than this device can draw.";videoOff();return;}
    asp=el.videoWidth/el.videoHeight;
    var h=Math.max(2,Math.round(VW/asp));
    if(!tV[0]||tV[0].h!==h){freeT(tV[0]);freeT(tV[1]);tV[0]=target(VW,h);tV[1]=target(VW,h);mOut.fill(0);}
    vidOn=true;lastT=-1;label();
  });
  el.addEventListener("error",function(){
    if(!el.getAttribute("src"))return;
    /* say why, as far as the browser tells: 4 is a kind of file it cannot play, 3 is one it began and could not decode, 2 is a failed read */
    var c=el.error?el.error.code:0,why=c===4?"This browser cannot play that kind of video file"+(kind?" ("+kind+")":"")+". If it came from a phone it is probably HEVC (H.265): try it on the phone, or convert it to H.264.":
      c===3?"The video began but could not be decoded. It may be too large for this device or damaged.":c===2?"The file could not be read.":"That video would not play here.";
    errBox.textContent=why+(el.error&&el.error.message?"\n("+el.error.message+")":"");videoOff();
  });
  el.addEventListener("play",label);el.addEventListener("pause",label);
  return el;
}
/* show the video at this address: an object address made from a file the user chose */
export function videoFrom(src){
  stopSource();element().src=src;videoSound(sound);
  var p=el.play();if(p&&p.catch)p.catch(function(){});
}
function useCamera(){
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){toast("This browser gives no camera here.");return;}
  navigator.mediaDevices.getUserMedia({video:{facingMode:"environment",width:{ideal:1280}},audio:false}).then(function(s){
    stopSource();stream=s;element().srcObject=s;if(musicMode==="video")setMusic("off");videoSound(false);
    var p=el.play();if(p&&p.catch)p.catch(function(){});
  },function(){toast("The camera was not allowed.")});
}

/* A step of the frame: move the picture the shaders read towards the video's newest frame.
   How far it moves is set by the sixteenth of the picture whose average colour has the furthest to go: that average may change by
   at most 0.6 of full brightness a second (half that when reduced motion is asked for). Ordinary video moves less than that and
   is followed closely. A hard cut becomes a fade of up to a second, and a strobe is flattened to a few percent. */
export function videoFrame(fr){
  if(!vidOn||!tV[0]||el.readyState<2)return;
  var t=el.currentTime,i,d,big=0,k=1-Math.exp(-fr.dt/0.06),lim=(calm?0.3:0.6)*fr.dt*255;
  if(t!==lastT||stream){
    lastT=t;
    gl.activeTexture(gl.TEXTURE0+5);gl.bindTexture(gl.TEXTURE_2D,raw);
    try{gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,el);}catch(e){errBox.textContent="This browser cannot draw that video.";videoOff();return;}
    passTo(tM,pMean);bindTex(0,raw);gl.uniform1i(pMean.U.uT,0);gl.drawArrays(gl.TRIANGLES,0,3);
    gl.readPixels(0,0,4,4,gl.RGBA,gl.UNSIGNED_BYTE,mNew);
  }
  for(i=0;i<64;i++)if((i&3)<3){d=Math.abs(mNew[i]-mOut[i]);if(d>big)big=d;}
  if(big*k>lim)k=lim/big;
  for(i=0;i<64;i++)mOut[i]+=(mNew[i]-mOut[i])*k; /* the blend below does the same to every pixel, so these stay the picture's averages */
  cur=1-cur;
  passTo(tV[cur],pVid);bindTex(0,raw);bindTex(1,tV[1-cur].t);
  gl.uniform1i(pVid.U.uT,0);gl.uniform1i(pVid.U.uP,1);gl.uniform1f(pVid.U.uK,k);
  gl.drawArrays(gl.TRIANGLES,0,3);
}
/* Hand the video to a shader: U holds its uniforms, and w and h are the size of the picture being drawn.
   flat is false where a video that lies flat on the screen must be left out (the VR viewer). per is the world's period, for the surfaces. */
export function videoUniforms(U,w,h,flat,per){
  var on=vidOn&&tV[0]&&(flat||VMODES[vidMode].d3),sa=w/h;
  bindTex(5,on?tV[cur].t:blank);gl.uniform1i(U.uVid,5);
  /* the video fills the screen and keeps its shape: the part that does not fit is cut off */
  gl.uniform4f(U.uVidK,on?vidMode+1:0,VAMT[vidAmt],sa>asp?1:sa/asp,sa>asp?asp/sa:1);
  if(per&&U.uVidS){
    /* on the surfaces the video repeats, each copy the mirror of the one beside it so that no seam shows. A pair of copies must fit
       the world's period a whole number of times; each copy is made about 1.6 units wide and keeps the video's shape where the period allows */
    var nx=Math.max(1,Math.round(per[0]/3.2)),ny=Math.max(1,Math.round(per[1]*asp/3.2)),nz=Math.max(1,Math.round(per[2]/3.2));
    gl.uniform3f(U.uVidS,2*nx/per[0],2*ny/per[1],2*nz/per[2]);
  }
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
pVid=link(FS_VID,["uT","uP","uK"]);pScene=link(FS_SCENE,["uRes","uFit","uSeg","uSpin","uZoom","uVid"]);pMean=link(FS_MEAN,["uT"]);tM=target(4,4);
raw=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,raw);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
blank=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,blank);
gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));
$("bVideo").addEventListener("click",function(){
  var row=$("rowVideo");row.hidden=!row.hidden;
  if(row.hidden)videoOff();else if(!vidOn)toast("Choose a video file, or use the camera.");
  wakeHud();
});
$("vidIn").addEventListener("change",function(){
  var f=this.files&&this.files[0];if(!f)return;
  errBox.textContent="";kind=f.type;var u=URL.createObjectURL(f);videoFrom(u);url=u;
  setMusic("video");toast("Music is now the video's sound. The Music list changes it.");wakeHud();
});
$("bVidCam").addEventListener("click",function(){useCamera();wakeHud()});
$("bVidMode").addEventListener("click",function(){setVidMode(vidMode+1);wakeHud()});
$("bVidAmt").addEventListener("click",function(){setVidAmt(vidAmt+1);wakeHud()});
$("bVidPlay").addEventListener("click",function(){if(el.paused){var p=el.play();if(p&&p.catch)p.catch(function(){});}else el.pause();wakeHud()});
label();
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={VMODES, VAMT, FS_SCENE, tV, mNew, mOut, FS_MEAN, VW, FS_VID, label,
  setVidMode, vidFile, vidAlone, videoSound, videoScene, setVidAmt, stopSource, videoOff, element, videoFrom,
  useCamera, videoFrame, videoUniforms, get vidMode(){return vidMode},set vidMode(v){vidMode=v}, get vidAmt(){return vidAmt},set vidAmt(v){vidAmt=v}, get vidOn(){return vidOn},set vidOn(v){vidOn=v}, get kind(){return kind},set kind(v){kind=v}, get sound(){return sound},set sound(v){sound=v}, get node(){return node},set node(v){node=v}, get pScene(){return pScene},set pScene(v){pScene=v},
  get el(){return el},set el(v){el=v}, get url(){return url},set url(v){url=v}, get stream(){return stream},set stream(v){stream=v}, get raw(){return raw},set raw(v){raw=v}, get blank(){return blank},set blank(v){blank=v}, get pVid(){return pVid},set pVid(v){pVid=v}, get cur(){return cur},set cur(v){cur=v}, get asp(){return asp},set asp(v){asp=v}, get lastT(){return lastT},set lastT(v){lastT=v}, get tM(){return tM},set tM(v){tM=v},
  get pMean(){return pMean},set pMean(v){pMean=v}};
