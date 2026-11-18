/* A VR headset (WebXR): the world all round the wearer, a picture for each eye drawn for that eye's own lens, the view
   turned and moved by the head, and the hand controllers for flying. Made for the Meta Quest's browser; any browser
   that offers an immersive session should do.
   It is built on the VR viewer's two pictures (js/vr.js and the shaders' uVr): the same side-by-side pair, each ray
   starting from its own eye, the same effects worked on the view between the eyes. Three things differ.
   - The lens. A phone's viewer has a plain lens whose bending the shaders undo. A headset bends its own picture, and
     says exactly what each eye sees (a projection, which is not the same to the left as to the right, nor up as down).
     xrLensOf turns that into the numbers the shaders take (setHeadLens), with no bending.
   - Where the picture goes. It is drawn into a picture of our own (setOut), smaller than the headset's, and then put
     into each eye's part of the headset's picture. Drawing a world costs by the pixel, and a headset has millions:
     the size is a part of the headset's own (scale), stepped down when pictures come late and up when there is time.
   - Who asks for the pictures. The headset does, at its own rate (onFrame), and the browser's usual call stands by. */
import { cam, userLook } from "./camera.js";
import { $, canvas, gl, toast } from "./dom.js";
import { doBoost } from "./flight.js";
import { press, stepWorld, stick, wakeHud } from "./input.js";
import { journey, setJourney } from "./journey.js";
import { frame, notes } from "./loop.js";
import { setPalette } from "./palettes.js";
import { bindTex, link, setOut } from "./programs.js";
import { askSpark } from "./spark.js";
import { sel } from "./state.js";
import { freeT, setFilmSize, target } from "./targets.js";
import { gyroTurn, headTurn, setHeadLens, setStereo, vrEye } from "./vr.js";
export const XR_SCALE0=0.4;   /* the picture's width to begin with, as a part of the headset's own for one eye */
export const XR_SCALE_MIN=0.22,XR_SCALE_MAX=0.8;
export const XR_LEAN=0.5;     /* the head's own movement moves the camera no further in one picture than this part of the distance to the nearest surface */
const FS_EYE2="precision mediump float;varying vec2 v;uniform sampler2D uT;uniform float uOff;void main(){gl_FragColor=vec4(texture2D(uT,vec2(uOff+0.5*v.x,v.y)).rgb,1.0);}";
let pHalf=null;               /* the program that puts one half of our picture into one eye's part of the headset's */
/* the session, its space and its picture; our own picture; the head as it was a picture ago (its axes and its place); what the controllers' buttons were; and the size's governor */
const xr={session:null,ref:null,layer:null,T:null,S:null,P:null,btn:{},mine:false,w:0,h:0,g:{scale:XR_SCALE0,max:XR_SCALE_MAX,good:0,rose:false},acc:0,n:0,last:0};

export function xrOn(){return !!xr.session;}
/* The numbers the shaders take, from what the headset says each eye sees: its two projections, as sixteen numbers
   each, column by column. off is how far each eye's straight-ahead is from the middle of the side-by-side picture, tan
   the tangent of the angle one pixel covers, both for a picture one unit wide; cy how far above the middle
   straight-ahead is, for a picture one unit high; aspect the width of one eye's picture over its height, such that a
   pixel covers the same angle up and down as across. The two eyes are taken to mirror each other. */
export function xrLensOf(PL,PR){
  var p0=(PL[0]+PR[0])/2,p5=(PL[5]+PR[5])/2;
  return {off:0.25+(PL[8]-PR[8])/8,tan:4/p0,cy:-(PL[9]+PR[9])/4,aspect:p5/p0};
}
/* Our picture's size for both eyes side by side: one eye's width in the headset, a scale, and the aspect. Even numbers. */
export function xrSize(eyeW,scale,aspect){
  var w=Math.max(64,2*Math.round(eyeW*scale/2)),h=Math.max(64,2*Math.round(w/aspect/2));
  return [2*w,h];
}
/* the head's axes, as vr.js's gyroTurn takes them (three rows of three), from the sixteen numbers of its pose */
export function xrAxes(m){return [m[0],m[4],m[8],m[1],m[5],m[9],m[2],m[6],m[10]];}
/* The size's governor. Every so many pictures it is told the mean time between them and the time the headset means
   there to be. Late by a fifth: smaller, and if it had just grown, that size is the most it will try again. On time
   four tellings running: a little larger, up to the most. g is {scale, max, good, rose}; true if the scale changed. */
export function xrGovern(g,mean,want){
  if(mean>want*1.2){
    if(g.rose)g.max=Math.max(XR_SCALE_MIN,g.scale*0.93);
    g.rose=false;g.good=0;
    if(g.scale<=XR_SCALE_MIN)return false;
    g.scale=Math.max(XR_SCALE_MIN,g.scale*0.86);return true;
  }
  g.rose=false;
  if(mean<want*1.06&&++g.good>=4&&g.scale<g.max-0.005){g.good=0;g.scale=Math.min(g.max,g.scale*1.08);g.rose=true;return true;}
  return false;
}
/* The controllers. Left stick: fly (forward, back, sideways). Right stick: turn. Right trigger: a burst of speed.
   A or X: the next world. B or Y: the next palette. Left trigger: throw a light. Either grip: Journey on or off. */
function pads(s,dt){
  var moved=false,i,src,gp,x,y,h,b,was,down=function(k){return !!(gp.buttons[k]&&gp.buttons[k].pressed);};
  var list=s.inputSources||[];
  for(i=0;i<list.length;i++){
    src=list[i];gp=src.gamepad;if(!gp)continue;
    h=src.handedness==="left"?"L":"R";
    x=gp.axes.length>=4?gp.axes[2]:gp.axes[0]||0;y=gp.axes.length>=4?gp.axes[3]:gp.axes[1]||0;
    if(h==="L"){if(Math.hypot(x,y)>0.15){stick.id="xr";stick.x=x;stick.y=y;moved=true;}}
    else if(Math.abs(x)>0.2)userLook(x*1.4*dt,0);
    b={t:down(0),g:down(1),a:down(4),b:down(5)};was=xr.btn[h]||{};
    if(b.a&&!was.a)stepWorld(1);
    if(b.b&&!was.b)setPalette(sel.pi+1);
    if(b.g&&!was.g)setJourney(!journey);
    if(b.t&&!was.t){if(h==="L")askSpark();else doBoost();}
    xr.btn[h]=b;
  }
  if(!moved&&stick.id==="xr"){stick.id=null;stick.x=stick.y=0;}
}
/* One picture for the headset. */
function onFrame(t,xf){
  var s=xr.session,pose,L=null,R=null,i,v,vp,sz,lens,S,P,d,k,w,scale,mean;
  if(!s)return;
  s.requestAnimationFrame(onFrame);
  pose=xf.getViewerPose(xr.ref);
  if(!pose)return; /* the headset does not know where it is just now */
  for(i=0;i<pose.views.length;i++){v=pose.views[i];if(v.eye==="left")L=v;else if(v.eye==="right")R=v;}
  if(!L||!R){L=pose.views[0];R=pose.views[pose.views.length-1];}
  /* the lens and the size */
  lens=xrLensOf(L.projectionMatrix,R.projectionMatrix);setHeadLens(lens);
  vp=xr.layer.getViewport(L);xr.vpw=vp.width;xr.vph=vp.height;
  sz=xrSize(vp.width,xr.g.scale,lens.aspect);
  if(sz[0]!==xr.w||sz[1]!==xr.h){xr.w=sz[0];xr.h=sz[1];setFilmSize(sz[0],sz[1]);}
  if(!xr.T||xr.T.w!==canvas.width||xr.T.h!==canvas.height){freeT(xr.T);xr.T=target(canvas.width,canvas.height);setOut(xr.T);}
  /* the head: its turn since the last picture turns the camera, as the phone's does in the viewer, so it adds to the
     autopilot's steering and the stick's; and its movement moves the camera, in a world scaled so that the eyes are
     as far apart as the wearer's (the same scale the two pictures are drawn at) */
  S=xrAxes(pose.transform.matrix);P=pose.transform.position;
  if(xr.S){
    headTurn(gyroTurn(xr.S,S));
    d=[P.x-xr.P[0],P.y-xr.P[1],P.z-xr.P[2]];
    w=[d[0]*S[0]+d[1]*S[3]+d[2]*S[6],d[0]*S[1]+d[1]*S[4]+d[2]*S[7],d[0]*S[2]+d[1]*S[5]+d[2]*S[8]]; /* in the head's own axes: right, up, toward the wearer */
    scale=vrEye/0.032;k=Math.hypot(w[0],w[1],w[2])*scale;
    if(k>0&&k<10*vrEye&&notes.w&&!notes.w.flat){
      k=Math.min(1,XR_LEAN*Math.max(0,notes.dist)/k)*scale;
      for(i=0;i<3;i++)cam.pos[i]+=(cam.R[i]*w[0]+cam.Up[i]*w[1]-cam.F[i]*w[2])*k;
    }
  }
  xr.S=S;xr.P=[P.x,P.y,P.z];
  pads(s,Math.min(0.05,Math.max(0,(t-xr.last)/1000)));
  frame(t);
  /* our picture, half by half, into each eye's part of the headset's */
  gl.bindFramebuffer(gl.FRAMEBUFFER,xr.layer.framebuffer);gl.useProgram(pHalf.prog);bindTex(0,xr.T.t);gl.uniform1i(pHalf.U.uT,0);
  for(i=0;i<2;i++){
    v=i?R:L;vp=xr.layer.getViewport(v);
    gl.viewport(vp.x,vp.y,vp.width,vp.height);gl.uniform1f(pHalf.U.uOff,i?0.5:0);gl.drawArrays(gl.TRIANGLES,0,3);
  }
  /* the governor: every 36 pictures */
  if(xr.last){xr.acc+=t-xr.last;xr.n++;}
  xr.last=t;
  if(xr.n>=36){mean=xr.acc/xr.n;xr.acc=0;xr.n=0;xr.mean=mean;xr.hz=s.frameRate||72;xrGovern(xr.g,mean,1000/xr.hz);}
}
/* What to say on coming out, since nothing can be read in there: how large the pictures were and how fast they came. It is what to send back if VR was not smooth. */
export function xrReport(){
  return "VR: pictures of "+xr.w/2+" by "+xr.h+" an eye, "+Math.round(xr.g.scale*100)+" hundredths of the headset's "+(xr.vpw||0)+" by "+(xr.vph||0)+
    (xr.mean?"; "+(Math.round(xr.mean*10)/10)+" ms apart at the end, where the headset asks for "+(Math.round(10000/xr.hz)/10):"")+".";
}
function end(){
  var s=xr.session,said;
  if(!s)return;
  said=xrReport();xr.said=said;
  xr.session=null;xr.S=null;xr.last=0;xr.acc=0;xr.n=0;xr.w=xr.h=0;
  setOut(null);freeT(xr.T);xr.T=null;setHeadLens(null);setStereo(false,true);setFilmSize(0,0);
  if(stick.id==="xr"){stick.id=null;stick.x=stick.y=0;}
  if(xr.mine)setJourney(false); /* Journey was turned on for the headset: off again */
  press($("bXr"),false);$("bXr").textContent="VR headset";wakeHud();toast(said);
}
/* Begin, given a session (and, for the test tools, a stand-in for its picture). */
export function xrBegin(s,layer){
  if(!pHalf)pHalf=link(FS_EYE2,["uT","uOff"]);
  xr.layer=layer||new window.XRWebGLLayer(s,gl,{antialias:false,depth:false,stencil:false,alpha:false});
  s.updateRenderState({baseLayer:xr.layer});
  s.addEventListener("end",end);
  /* 72 pictures a second where the headset lets the page choose: a world is drawn pixel by pixel, and 72 it can keep to */
  try{if(s.updateTargetFrameRate&&s.supportedFrameRates&&Array.prototype.indexOf.call(s.supportedFrameRates,72)>=0)s.updateTargetFrameRate(72);}catch(_){}
  return s.requestReferenceSpace("local").then(function(ref){
    xr.session=s;xr.ref=ref;xr.S=null;xr.btn={};xr.g={scale:XR_SCALE0,max:XR_SCALE_MAX,good:0,rose:false};
    setStereo(true,true);
    xr.mine=!journey;if(xr.mine)setJourney(true); /* nobody can reach the controls in there: Journey flies unless a hand takes the stick */
    press($("bXr"),true);$("bXr").textContent="Leave VR";
    s.requestAnimationFrame(onFrame);
  });
}
/* The button: into the headset, or out of it. */
export function xrToggle(){
  if(xr.session){try{xr.session.end()}catch(_){end();}return;}
  if(!navigator.xr){toast("This browser has no VR.");return;}
  navigator.xr.requestSession("immersive-vr",{optionalFeatures:["local-floor"]}).then(function(s){
    return Promise.resolve(gl.makeXRCompatible?gl.makeXRCompatible():null).then(function(){return xrBegin(s,null);});
  }).then(null,function(e){toast("VR could not be started: "+(e&&e.message||e));});
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
var b=$("bXr");
b.addEventListener("click",function(){xrToggle();wakeHud();});
/* the button shows only where the browser says it can do it; and there the phone's viewer, which is for a phone in a holder, is put away */
try{
  if(navigator.xr&&navigator.xr.isSessionSupported)navigator.xr.isSessionSupported("immersive-vr").then(function(ok){if(ok){b.hidden=false;$("bVr").style.display="none";}},function(){});
}catch(_){}
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={xrReport, XR_SCALE0, XR_SCALE_MIN, XR_SCALE_MAX, XR_LEAN, xrOn, xrLensOf, xrSize, xrAxes, xrGovern, xrPads:pads, xrFrame:onFrame, xrEnd:end, xrBegin, xrToggle, xrSt:xr};
