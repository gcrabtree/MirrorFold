import { $, canvas } from "./dom.js";
import { look, mirrors, stick } from "./state.js";
import { doBoost, gest, lastTap, toast, userLook } from "./flight.js";
import { WORLDS } from "./worlds.js";
import { requestWorld, setMirrors, setPalette } from "./choose.js";
import { setJourney } from "./journey.js";
import { setMusic, tap } from "./listen.js";
import { G } from "./shared.js";
let stickEl, knob, hud, hudTimer;

export function wakeHud(){
  if(!G.started)return;
  hud.classList.remove("hide");clearTimeout(hudTimer);
  hudTimer=setTimeout(function(){
    var ae=document.activeElement;
    if(ae&&ae.tagName==="SELECT"){wakeHud();return;}
    hud.classList.add("hide");
  },5000);
}
function release(e){
  if(e.pointerId===stick.id){stick.id=null;stick.x=stick.y=0;stickEl.classList.remove("on");}
  if(e.pointerId===gest.id){gest.id=null;}
  else if(e.pointerId===look.id){
    if(gest.id!==null){look.id=gest.id;look.x=gest.x;look.y=gest.y;look.t0=0;gest.id=null;}
    else{
      if(e.pointerType!=="mouse"&&performance.now()-look.t0<260&&Math.hypot(e.clientX-look.sx,e.clientY-look.sy)<14){lastTap.t=performance.now();lastTap.x=e.clientX;lastTap.y=e.clientY;}
      look.id=null;
    }
  }
}
function stepWorld(stp){
  var n=WORLDS.length,c=(G.pendingWorld>=0&&G.warpDir>0)?G.pendingWorld:WORLDS.indexOf(G.world);
  requestWorld((c+stp+n)%n);
}

/* ---------- HUD ---------- */
export function press(b,on){b.setAttribute("aria-pressed",on?"true":"false")}
export function cycleMirrors(){setMirrors((G.mi+1)%mirrors.length);}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
/* ---------- input ---------- */
stickEl=$("stick"),knob=$("knob"),hud=$("hud"),hudTimer=0;
canvas.addEventListener("pointerdown",function(e){
  if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();
  wakeHud();
  if(e.pointerType==="mouse"){
    look.id=e.pointerId;look.x=e.clientX;look.y=e.clientY;
    if(G.started&&canvas.requestPointerLock){try{var pr=canvas.requestPointerLock();if(pr&&pr.catch)pr.catch(function(){});}catch(_){}}
    return;
  }
  try{canvas.setPointerCapture(e.pointerId)}catch(_){}
  var nowT=performance.now();
  if(stick.id===null&&e.clientX<window.innerWidth*0.45){
    stick.id=e.pointerId;stick.ox=e.clientX;stick.oy=e.clientY;stick.x=stick.y=0;
    stickEl.style.left=e.clientX+"px";stickEl.style.top=e.clientY+"px";stickEl.classList.add("on");
    knob.style.transform="translate(0px,0px)";
  }else if(look.id===null){
    look.id=e.pointerId;look.x=e.clientX;look.y=e.clientY;look.sx=e.clientX;look.sy=e.clientY;look.t0=nowT;
    if(nowT-lastTap.t<320&&Math.hypot(e.clientX-lastTap.x,e.clientY-lastTap.y)<50){doBoost();lastTap.t=0;}
  }else if(gest.id===null){ /* second finger on the look side: pinch for speed, twist to roll */
    gest.id=e.pointerId;gest.x=e.clientX;gest.y=e.clientY;
    gest.d0=Math.max(20,Math.hypot(gest.x-look.x,gest.y-look.y));gest.a=Math.atan2(gest.y-look.y,gest.x-look.x);gest.s0=G.baseSpeed;
  }
});
canvas.addEventListener("dblclick",function(){if(G.started)doBoost()});
canvas.addEventListener("pointermove",function(e){
  if(e.pointerType==="mouse"){
    if(document.pointerLockElement===canvas){userLook(e.movementX*0.0022,e.movementY*0.0022);}
    else if(look.id===e.pointerId&&e.buttons){userLook((e.clientX-look.x)*0.004,(e.clientY-look.y)*0.004);look.x=e.clientX;look.y=e.clientY;}
    return;
  }
  if(e.pointerId===stick.id){
    var dx=e.clientX-stick.ox,dy=e.clientY-stick.oy,l=Math.hypot(dx,dy),m=60;
    if(l>m){dx*=m/l;dy*=m/l;}
    stick.x=dx/m;stick.y=dy/m;knob.style.transform="translate("+dx+"px,"+dy+"px)";
  }else if(gest.id!==null&&(e.pointerId===look.id||e.pointerId===gest.id)){
    if(e.pointerId===look.id){look.x=e.clientX;look.y=e.clientY;}else{gest.x=e.clientX;gest.y=e.clientY;}
    var gd=Math.hypot(gest.x-look.x,gest.y-look.y),ga=Math.atan2(gest.y-look.y,gest.x-look.x),da=ga-gest.a;
    if(da>Math.PI)da-=2*Math.PI;if(da<-Math.PI)da+=2*Math.PI;
    G.gRoll+=da;gest.a=ga;
    var ns=Math.min(4,Math.max(.2,gest.s0*gd/gest.d0));
    if(Math.abs(ns-G.baseSpeed)>0.02){G.baseSpeed=ns;toast("Speed "+ns.toFixed(1)+"x");}
  }else if(e.pointerId===look.id){
    userLook((e.clientX-look.x)*0.0055,(e.clientY-look.y)*0.0055);look.x=e.clientX;look.y=e.clientY;
  }
});
canvas.addEventListener("pointerup",release);canvas.addEventListener("pointercancel",release);
canvas.addEventListener("wheel",function(e){e.preventDefault();G.baseSpeed=Math.min(4,Math.max(.2,G.baseSpeed*(e.deltaY<0?1.15:0.87)));},{passive:false});
window.addEventListener("keydown",function(e){
  if(e.target&&/^(SELECT|INPUT|TEXTAREA)$/.test(e.target.tagName))return;
  G.keys[e.code]=true;
  if(G.started){
    if(e.code==="KeyM")cycleMirrors();
    if(e.code==="KeyP")setPalette(G.pi+1);
    if(e.code==="KeyJ")setJourney(!G.journey);
    if(e.code==="KeyB")doBoost();
    if(e.code==="KeyT"){if(G.musicMode!=="tap")setMusic("tap");tap();}
    if(/^Digit[1-9]$/.test(e.code))requestWorld(+e.code.slice(5)-1);
    if(e.code==="BracketRight")stepWorld(1);
    if(e.code==="BracketLeft")stepWorld(-1);
  }
  if(e.code==="Space"||e.code.indexOf("Arrow")===0)e.preventDefault();
});
window.addEventListener("keyup",function(e){G.keys[e.code]=false});
window.addEventListener("blur",function(){G.keys={}});
}

/* for the test tools and the browser console: every name in this file, readable and (where it can change) settable */
export const __dbg={get stickEl(){return stickEl},set stickEl(v){stickEl=v}, get knob(){return knob},set knob(v){knob=v}, get hud(){return hud},set hud(v){hud=v}, get hudTimer(){return hudTimer},set hudTimer(v){hudTimer=v}, get wakeHud(){return wakeHud}, get release(){return release},
  get stepWorld(){return stepWorld}, get press(){return press}, get cycleMirrors(){return cycleMirrors}};
