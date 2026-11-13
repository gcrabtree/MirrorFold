import { cross, norm, rot, toast } from "./flight.js";
import { press, wakeHud } from "./input.js";
import { $, isTouch } from "./dom.js";
import { G } from "./shared.js";
let gyroBound;

/* ---------- VR viewer ----------
   For a phone in a Cardboard-style holder: the picture is drawn twice, side by side, and turning your head turns the view.
   Effects that are centred on the screen (motions, overlays, some filters) are left out while it is on; see frame(). */
/* which way the screen faces, as a 3x3 matrix (row by row) from screen axes to earth axes; angles in degrees, o is the screen rotation */
function devMat(al,be,ga,o){
  var k=Math.PI/180,cA=Math.cos(al*k),sA=Math.sin(al*k),cB=Math.cos(be*k),sB=Math.sin(be*k),cG=Math.cos(ga*k),sG=Math.sin(ga*k);
  var m=[cA*cG-sA*sB*sG,-cB*sA,cG*sA*sB+cA*sG, cG*sA+cA*sB*sG,cA*cB,sA*sG-cA*cG*sB, -cB*sG,sB,cB*cG];
  var c=Math.cos(o*k),s=Math.sin(o*k),x,y,i;
  for(i=0;i<9;i+=3){x=m[i];y=m[i+1];m[i]=x*c-y*s;m[i+1]=x*s+y*c;}
  return m;
}
/* the turn between two of those matrices, as a vector along its axis with the angle as its length, in screen axes (x right, y up, z toward you) */
function gyroTurn(P,S){
  var d=function(i,j){return P[i]*S[j]+P[3+i]*S[3+j]+P[6+i]*S[6+j]};
  var v=[(d(2,1)-d(1,2))/2,(d(0,2)-d(2,0))/2,(d(1,0)-d(0,1))/2];
  var l=Math.hypot(v[0],v[1],v[2]),th=Math.atan2(l,(d(0,0)+d(1,1)+d(2,2)-1)/2),f=l>1e-9?th/l:1;
  return [v[0]*f,v[1]*f,v[2]*f];
}
function screenAngle(){
  if(typeof window.orientation==="number")return window.orientation;
  return (screen.orientation&&screen.orientation.angle)||0;
}
function onGyro(e){
  if(!G.stereo||e.alpha===null||e.beta===null||e.gamma===null){G.gyroPrev=null;return;}
  var S=devMat(e.alpha,e.beta,e.gamma,screenAngle()),P=G.gyroPrev;G.gyroPrev=S;
  if(!P||!G.started)return;
  var w=gyroTurn(P,S),an=Math.hypot(w[0],w[1],w[2]);
  if(an<1e-6||an>0.6)return; /* a jump this large is the screen turning over, not a head */
  /* the camera's forward axis points into the screen, so turns about right and up change sign */
  var ax=[(-w[0]*G.R[0]-w[1]*G.Up[0]+w[2]*G.F[0])/an,(-w[0]*G.R[1]-w[1]*G.Up[1]+w[2]*G.F[1])/an,(-w[0]*G.R[2]-w[1]*G.Up[2]+w[2]*G.F[2])/an];
  G.F=rot(G.F,ax,an);G.Up=rot(G.Up,ax,an);G.userTurn+=an;
  G.F=norm(G.F);G.R=norm(cross(G.Up,G.F));G.Up=cross(G.F,G.R);
}
function gyroStart(){
  if(gyroBound||!window.DeviceOrientationEvent)return;
  var bind=function(){gyroBound=true;window.addEventListener("deviceorientation",onGyro);};
  if(typeof DeviceOrientationEvent.requestPermission==="function"){ /* iPhone asks the first time */
    try{
      DeviceOrientationEvent.requestPermission().then(function(r){
        if(r==="granted")bind();else toast("Motion access was refused. Drag to look instead.");
      }).catch(function(){toast("Motion access was refused. Drag to look instead.")});
    }catch(_){}
  }else bind();
}
/* the screen is kept awake while Journey or the VR viewer is on, because nobody is touching it then */
export function keepAwake(){
  var on=G.journey||G.stereo;
  try{
    if(on&&!G.wakeLock&&navigator.wakeLock){navigator.wakeLock.request("screen").then(function(l){G.wakeLock=l;l.addEventListener("release",function(){if(G.wakeLock===l)G.wakeLock=null});if(!(G.journey||G.stereo))keepAwake();}).catch(function(){});}
    else if(!on&&G.wakeLock){var l0=G.wakeLock;G.wakeLock=null;l0.release();}
  }catch(_){}
}
function setStereo(on){
  G.stereo=!!on;G.gyroPrev=null;press($("bVr"),G.stereo);
  keepAwake();
  if(G.stereo){gyroStart();toast(window.innerWidth<window.innerHeight?"VR viewer on. Turn the phone sideways.":"VR viewer on");}
  else toast("VR viewer off");
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
gyroBound=false;
/* on a copy hosted at someone.github.io/name, the help link points at that copy's own repository */
(function(){
  var h=/^([a-z0-9-]+)\.github\.io$/i.exec(location.hostname),seg=location.pathname.split("/")[1];
  if(h&&seg)$("aHelp").href="https://github.com/"+h[1]+"/"+seg+"#readme";
})();
if(!isTouch)$("bVr").style.display="none";
$("bVr").addEventListener("click",function(){setStereo(!G.stereo);wakeHud()});
window.addEventListener("orientationchange",function(){G.gyroPrev=null});
document.addEventListener("visibilitychange",function(){G.gyroPrev=null;if(!document.hidden)keepAwake()});
}

/* for the test tools and the browser console: every name in this file, readable and (where it can change) settable */
export const __dbg={get devMat(){return devMat}, get gyroTurn(){return gyroTurn}, get screenAngle(){return screenAngle}, get onGyro(){return onGyro}, get gyroBound(){return gyroBound},set gyroBound(v){gyroBound=v}, get gyroStart(){return gyroStart},
  get keepAwake(){return keepAwake}, get setStereo(){return setStereo}};
