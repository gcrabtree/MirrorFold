/* Record a loop: a flight that ends exactly where it began, saved as a video that can be played on repeat with no join.
   Every world repeats, so a straight flight of one whole repeat ends at a copy of its start, which looks the same in
   every way. Where no straight way through is clear the camera goes once round a small circle in open space instead,
   and in the descent it flies in until everything is three times smaller, which is the same picture again.
   For the end to meet the start, everything else in the picture has to come round too. So while a loop is flown this
   file sets the clocks: the scene's clock, the colour drift and the morph swing a little way out and back in step with
   the lap, the mirrors turn through a whole number of their folds, and a soft pulse stands in for the music. Journey
   waits, and what lives in the world (the orb, sprites, a thrown light, friends, ribbons, doorways) is not drawn, since
   none of it would be back in its place. The first seconds are flown unrecorded so that the trails settle; the next
   whole lap is the video; after that the loop goes on until it is stopped. */
import { cam, camSquare, cross, norm, rot } from "./camera.js";
import { scene } from "./choose.js";
import { clock, morphValue } from "./clock.js";
import { $, calm, canvas, toast } from "./dom.js";
import { doorSpot } from "./doors.js";
import { flightPlaying, flightRecording } from "./flightplay.js";
import { press, wakeHud } from "./input.js";
import { landMode } from "./land.js";
import { started } from "./loop.js";
import { spawnOrb } from "./orbs.js";
import { deMany } from "./pack-worlds.js";
import { W_TURN, wTick } from "./worlds.js";
import { DP_IN, packing, pkDeep, pkMix, pkMul, pkTick, pkWave } from "./packing.js";
import { recType } from "./record.js";
import { mirrors, sel } from "./state.js";
import { setStill, still } from "./still.js";
import { tgGuest } from "./together.js";
import { vidAlone } from "./video.js";
import { stereo } from "./vr.js";
import { warpThen } from "./warp.js";
export const LAP_LEAD=4;     /* seconds flown before the recording starts, for the trails to settle */
export const LAP_MIN=8,LAP_MAX=24; /* the shortest and longest lap, in seconds */
export const LAP_SWING=4;    /* seconds the morph's clock swings either side of where it was */
/* The loop being flown, or null: kind ("line", "ring" or "deep"), T (seconds a lap), ph (laps flown; below 0 during the
   lead), the path (see lapPose), where the clocks stood at the start (t0, h0, s0, mt0, tt0), how far the morph's clock
   swings (A), how far the mirrors turn in a lap (turn) and the turning clock runs (gear), pulses in a lap (beats), what was chosen at the start (key),
   and the recording (rec, push, done). */
let lap=null;
export function lapOn(){return !!lap;}

/* Is the straight way from a to a+L clear by at least need? de(x,y,z) is the world's distance. Gives the least and
   the mean distance met on the way, or null if something is nearer than need. */
export function lapClear(de,a,L,need){
  var len=Math.hypot(L[0],L[1],L[2]),t=0,d,min=1e9,sum=0,n=0,k,lo=len/160;
  for(k=0;k<400&&t<len;k++){
    d=de(a[0]+L[0]*t/len,a[1]+L[1]*t/len,a[2]+L[2]*t/len);
    if(d<need)return null;
    if(d<min)min=d;sum+=d;n++;
    t+=Math.max(0.7*d,lo);
  }
  return n?{min:min,avg:sum/n}:null;
}
/* The clearest straight way through one whole repeat of a world along one of its three axes: {a, k, min, avg}, where
   a is the start and k says which axis and which way along it (three numbers, one of them 1 or -1), or null if every
   way tried is blocked. The way through the camera's own place (pos) is tried first and preferred, then tries more by
   chance; ways the camera already faces (F) are preferred. rnd gives chance numbers from 0 to 1. */
export function lapLine(de,per,pos,F,rnd,need,tries){
  var best=null,i,j,a,L,k,c,sc;
  for(i=0;i<3;i++){
    k=[0,0,0];k[i]=F[i]<0?-1:1;L=[k[0]*per[0],k[1]*per[1],k[2]*per[2]];
    for(j=0;j<=tries;j++){
      a=j?[(rnd()-0.5)*per[0],(rnd()-0.5)*per[1],(rnd()-0.5)*per[2]]:[pos[0],pos[1],pos[2]];
      c=lapClear(de,a,L,need);
      if(!c)continue;
      sc=c.min*(j?1:1.5)*(0.6+0.4*Math.abs(F[i]));
      if(!best||sc>best.sc)best={a:a,k:k,min:c.min,avg:c.avg,sc:sc};
    }
  }
  return best;
}
/* two directions at right angles to F and to each other; the first is as near to up as it can be */
function square(F,up){
  var d=F[0]*up[0]+F[1]*up[1]+F[2]*up[2],u=[up[0]-d*F[0],up[1]-d*F[1],up[2]-d*F[2]];
  if(Math.hypot(u[0],u[1],u[2])<1e-3){u=Math.abs(F[1])<0.9?[0,1,0]:[1,0,0];d=F[0]*u[0]+F[1]*u[1]+F[2]*u[2];u=[u[0]-d*F[0],u[1]-d*F[1],u[2]-d*F[2]];}
  u=norm(u);return [u,cross(u,F)];
}
/* Where the camera is, and how it faces, a part u (0 to 1) of the way round a loop p. per is the world's period now.
   A line: from a (as parts of the period) one whole period along k, facing along it, rolling over once and looking a
   little from side to side on the way. A ring: once round a circle of radius rad about c, facing along it. Deep: from
   4.5 grids out to 1.5 along e, in equal times for equal shrinking, rolling over once. Each ends as it began. */
export function lapPose(p,u,per){
  var w=6.2831853*u,pos=[0,0,0],F,Up,R,i,g,sq;
  if(p.kind==="ring"){
    for(i=0;i<3;i++)pos[i]=p.c[i]+p.rad*(p.e1[i]*Math.cos(w)+p.e2[i]*Math.sin(w));
    F=[p.e2[0]*Math.cos(w)-p.e1[0]*Math.sin(w),p.e2[1]*Math.cos(w)-p.e1[1]*Math.sin(w),p.e2[2]*Math.cos(w)-p.e1[2]*Math.sin(w)];
    return {pos:pos,F:F,Up:cross(p.e2,p.e1)};
  }
  if(p.kind==="deep"){
    g=3*DP_IN*p.grid*Math.pow(3,-u);
    for(i=0;i<3;i++)pos[i]=p.e[i]*g;
    F=p.F0;
  }else{
    for(i=0;i<3;i++){pos[i]=(p.a[i]+u*p.k[i])*per[i];pos[i]-=per[i]*Math.floor(pos[i]/per[i]+0.5);}
    F=norm([p.k[0]*per[0],p.k[1]*per[1],p.k[2]*per[2]]);
  }
  sq=square(F,p.up);
  Up=rot(sq[0],F,w*p.rolls);
  F=rot(F,Up,0.22*p.sway*Math.sin(w));R=cross(Up,F);
  F=rot(F,R,0.12*p.sway*Math.sin(2*w));Up=cross(F,R);
  return {pos:pos,F:F,Up:Up};
}
/* the soft pulse that stands in for the music: n of them to a lap, the first at its start */
export function lapBeat(u,n){return n>0?0.5*Math.pow(0.5+0.5*Math.cos(6.2831853*u*n),6):0;}

/* a world's distance at a morph clock: its own morph, and the packing's wave, as they are at that time */
function deAt(w,T){
  var m=Math.sin(T*0.09)+0.15*Math.sin(T*0.31);
  return function(x,y,z){return w.de(x,y,z,m);};
}
/* Is a way clear at the middle and both ends of the morph's swing? chk(de) answers for one distance. */
function swings(w,chk){
  var T=clock.morphT,ok=true,i,at=[T-LAP_SWING,T+LAP_SWING];
  for(i=0;i<2&&ok;i++){pkTick(at[i]);wTick(clock.turnT,at[i]);if(!chk(deAt(w,at[i])))ok=false;}
  pkTick(T);wTick(clock.turnT,T);
  return ok;
}
/* a pack world has no distance to walk with: its ways through are judged from 24 places along each, asked of the chip together */
function packLine(w,m,per,pos,F){
  var k,j,i,n=24,ways=[],pts,d,best=null,a,kk,min;
  for(i=0;i<3;i++)for(j=0;j<4;j++){
    kk=[0,0,0];kk[i]=F[i]<0?-1:1;
    a=j?[(Math.random()-0.5)*per[0],(Math.random()-0.5)*per[1],(Math.random()-0.5)*per[2]]:cam.pos.slice();
    ways.push({a:a,k:kk});
  }
  pts=new Float32Array(3*n*ways.length);
  for(j=0;j<ways.length;j++)for(k=0;k<n;k++)for(i=0;i<3;i++)pts[3*(j*n+k)+i]=ways[j].a[i]+ways[j].k[i]*per[i]*k/n;
  d=deMany(w,pts,n*ways.length,m);
  for(j=0;j<ways.length;j++){
    min=1e9;for(k=0;k<n;k++)min=Math.min(min,d[j*n+k]);
    if(min>0.03*Math.min(per[0],per[1],per[2])&&(!best||min>best.min))best={a:ways[j].a,k:ways[j].k,min:min,avg:min};
  }
  return best;
}
/* Find a loop to fly from here: a straight way through the world if one is clear, the way in if this is the descent,
   or else a circle in the most open place. Null if there is no room for any. */
function lapPlan(w){
  var m=morphValue(),per=w.period(m),sc=Math.min(per[0],per[1],per[2])/pkMul(w),de=function(x,y,z){return w.de(x,y,z,m);};
  var p={kind:"line",T:12,A:calm?0:LAP_SWING,up:cam.Up.slice(),rolls:calm?0:1,sway:calm?0:1},ln,i,j,e,ax,b,c,sp,sq,sd,pts,best=-1;
  if(pkDeep(w)){ /* the descent: in along the axis the camera is nearest, a little off its middle as a flight starts there */
    ax=0;for(i=1;i<3;i++)if(Math.abs(cam.pos[i])>Math.abs(cam.pos[ax]))ax=i;
    for(j=0;j<3;j++){
      i=(ax+j)%3;e=[0,0,0];e[i]=cam.pos[i]<0?-1:1;e[(i+1)%3]=0.048;e[(i+2)%3]=0.032;
      b=[e[0]*3*DP_IN*w.grid,e[1]*3*DP_IN*w.grid,e[2]*3*DP_IN*w.grid];c=function(d){return !!lapClear(d,b,[-b[0]*2/3,-b[1]*2/3,-b[2]*2/3],0.02*w.grid);};
      if(!c(de))continue;
      if(!swings(w,c))p.A=0;
      p.kind="deep";p.e=e;p.grid=w.grid;p.F0=[0,0,0];p.F0[i]=-e[i];
      return p;
    }
    return null;
  }
  ln=w.pack?packLine(w,m,per,cam.pos,cam.F):lapLine(de,per,cam.pos,cam.F,Math.random,0.004*sc,w.volume?0:24);
  if(ln){
    if(w.pack)p.A=0;
    else if(p.A&&!swings(w,function(d){return !!lapClear(d,ln.a,[ln.k[0]*per[0],ln.k[1]*per[1],ln.k[2]*per[2]],0.003*sc);}))p.A=0;
    p.a=[ln.a[0]/per[0],ln.a[1]/per[1],ln.a[2]/per[2]];p.k=ln.k;
    sp=0.5*Math.min(w.speed,Math.max(0.012,2.6*ln.avg));
    p.T=Math.max(LAP_MIN,Math.min(LAP_MAX,Math.abs(ln.k[0]*per[0]+ln.k[1]*per[1]+ln.k[2]*per[2])/sp))*(calm?1.5:1);
    return p;
  }
  /* no straight way: once round a circle in the most open of a few hundred places */
  if(w.pack){
    pts=new Float32Array(3*96);for(i=0;i<3*96;i++)pts[i]=(Math.random()-0.5)*per[i%3];
    sd=deMany(w,pts,96,m);c=null;
    for(i=0;i<96;i++)if(sd[i]>best){best=sd[i];c={q:[pts[3*i],pts[3*i+1],pts[3*i+2]],r:0.45*sd[i]};}
    p.A=0;
  }else{
    c=doorSpot(de,per,Math.random);
    if(c&&!swings(w,function(d){return d(c.q[0],c.q[1],c.q[2])>1.6*c.r;}))p.A=0;
  }
  if(!c||c.r<0.0005*sc)return null;
  sq=square(norm(cam.Up),cam.F);
  p.kind="ring";p.c=c.q;p.rad=c.r;p.e1=sq[0];p.e2=sq[1];p.T=calm?24:14;
  return p;
}
function label(){$("bLap").textContent=lap?"Stop the loop":"Record a loop";press($("bLap"),!!lap);}
function lapSave(blob,id,secs){
  if(!blob.size){toast("Nothing was recorded.");return;}
  var a=document.createElement("a"),url=URL.createObjectURL(blob);
  a.href=url;a.download="mirrorfold-loop-"+id+(/mp4/.test(blob.type)?".mp4":".webm");document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(function(){URL.revokeObjectURL(url)},10000);
  toast("Loop saved: "+Math.round(secs)+" seconds. Played on repeat, it has no join. The loop goes on here until you stop it.");
}
/* Start the recorder. Where the browser lets the page say when a frame is ready, each frame drawn is handed over as it
   is; otherwise the browser takes them at its own pace. */
function recBegin(){
  var type="",stream,track,parts=[],r,id=scene.world.id,secs=lap.T;
  lap.push=null;
  try{
    type=recType(function(t){return MediaRecorder.isTypeSupported(t)});
    stream=canvas.captureStream(0);track=stream.getVideoTracks()[0];
    if(track&&track.requestFrame)lap.push=function(){track.requestFrame()};
    else if(stream.requestFrame)lap.push=function(){stream.requestFrame()};
    else stream=canvas.captureStream(30);
    r=new MediaRecorder(stream,type?{mimeType:type,videoBitsPerSecond:12000000}:{videoBitsPerSecond:12000000});
  }catch(e){lap.rec=null;lap.done=true;toast("This browser cannot record the picture, so the loop is only shown.");return;}
  r.ondataavailable=function(e){if(e.data&&e.data.size)parts.push(e.data)};
  r.onstop=function(){if(r.keep)lapSave(new Blob(parts,{type:r.mimeType||type||"video/webm"}),id,secs);};
  r.start();lap.rec=r;
}
function recEnd(keep){
  var r=lap&&lap.rec;
  if(!r)return;
  lap.rec=null;lap.done=true;r.keep=keep;
  try{if(r.state!=="inactive")r.stop();}catch(_){}
}
function lapKey(){return scene.world.id+","+packing+(pkWave?"w":"")+(pkMix?"m":"");}
/* Why a loop cannot be flown now, or "" if it can. */
function lapBar(){
  var w=scene.world;
  if(!started)return "Enter first.";
  if(w.flat)return "A loop cannot be made in a zoom world: it has no way round.";
  if(landMode)return "A loop cannot be made over the land.";
  if(stereo)return "A loop cannot be made in the VR viewer.";
  if(vidAlone())return "A loop needs a world to fly in.";
  if(tgGuest())return "A loop cannot be made while you are flying as someone's guest.";
  if(flightPlaying()||flightRecording())return "A loop cannot be made while a flight is being played or recorded.";
  return "";
}
export function lapStart(){
  var why=lapBar(),plan,seg;
  if(lap)return;
  if(why){toast(why);return;}
  plan=lapPlan(scene.world);
  if(!plan){toast("No way round was found from here. Fly somewhere more open and try again.");return;}
  if(still)setStill(false);
  seg=mirrors[sel.mi]?6.2831853/mirrors[sel.mi]:0;
  plan.turn=calm?0:seg*Math.max(1,Math.round(0.045*plan.T/Math.max(seg,1e-6))); /* the mirrors turn through whole folds, and the picture is the same after each */
  plan.gear=W_TURN*Math.round((calm?0.4:1)*plan.T/W_TURN); /* the turning clock goes through whole steps of what turns by it, at about its usual pace, so the gears are the same after each lap */
  plan.beats=calm?0:Math.max(1,Math.round(plan.T/1.2));
  plan.ph=-LAP_LEAD/plan.T;plan.rec=null;plan.push=null;plan.done=false;
  /* the move to the loop's start goes behind a transition, which is over before the recording begins */
  if(!warpThen(function(){
    if(lap||lapBar())return;
    plan.t0=clock.time;plan.h0=clock.hueT;plan.s0=clock.spin;plan.mt0=clock.morphT;plan.tt0=clock.turnT;plan.key=lapKey();
    lap=plan;label();
  })){toast("A transition is running. Try again in a moment.");return;}
  toast(plan.kind==="ring"?"No straight way through is clear here, so the loop goes once round a circle. It records after a few seconds and saves itself.":plan.kind==="deep"?"Flying in until everything is three times smaller. It records after a few seconds and saves itself.":"Flying one whole repeat of the world. It records after a few seconds and saves itself.");
}
export function lapStop(msg){
  if(!lap)return;
  recEnd(false);
  lap=null;cam.vel=[0,0,0];label();
  if(pkDeep(scene.world))spawnOrb(); /* the orb was not moved out with the camera meanwhile */
  if(msg)toast(msg);
}
/* A step of the frame, in the clocks' place while a loop is flown: move the lap on, start and end the recording, and
   set every clock and the stand-in for the sound from how far round the lap is. */
export function lapClock(fr){
  var u,s,was;
  if(!lap)return;
  if(still||lapBar()||lapKey()!==lap.key){lapStop("The loop was stopped.");return;}
  was=Math.floor(lap.ph);lap.ph+=fr.dt/lap.T;
  lap.wrapped=Math.floor(lap.ph)!==was;
  if(lap.ph>=1&&lap.rec)recEnd(true);
  else if(lap.ph>=0&&!lap.rec&&!lap.done)recBegin();
  u=lap.ph-Math.floor(lap.ph);s=Math.sin(6.2831853*u);
  clock.time=lap.t0+0.6*lap.T/6.2831853*s;
  clock.hueT=lap.h0+0.017*lap.T/6.2831853*s;
  clock.spin=lap.s0+lap.turn*u;
  clock.morphT=lap.mt0+lap.A*s;
  clock.turnT=lap.tt0+lap.gear*u;
  fr.bt=lapBeat(u,lap.beats);fr.lv=fr.mp=fr.mv=fr.hp=fr.hv=0;
}
/* A step of the frame, after the camera has moved: put the camera on the loop. Any steering ends it. */
export function lapFrame(fr){
  var at,u,w=scene.world;
  if(!lap)return;
  if(!fr.idle||fr.mx!==0||fr.my!==0||fr.uz!==0||cam.lookAct>0.05){lapStop("The loop was stopped. You have the controls.");return;}
  u=lap.ph-Math.floor(lap.ph);
  fr.per=w.period(fr.m);
  at=lapPose(lap,u,fr.per);
  cam.pos=at.pos;cam.F=at.F;cam.Up=at.Up;camSquare();cam.vel=[0,0,0];cam.boost=0;cam.lookX=cam.lookY=0;
  fr.jump=lap.kind==="deep"&&lap.wrapped?3:1;
  fr.spN=0.45;
  if(!w.pack)fr.dist=Math.abs(w.de(cam.pos[0],cam.pos[1],cam.pos[2],fr.m));
}
/* A step of the frame, after the picture is finished: hand it to the recorder. */
export function lapShot(){if(lap&&lap.rec&&lap.push)lap.push();}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
var b=$("bLap");
label();
if(!(canvas.captureStream&&window.MediaRecorder)){b.hidden=true;return;} /* no recorder in this browser: no button */
b.addEventListener("click",function(){if(lap)lapStop("The loop was stopped.");else lapStart();wakeHud();});
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={LAP_LEAD, LAP_MIN, LAP_MAX, LAP_SWING, lapOn, lapClear, lapLine, lapPose, lapBeat, lapPlan, lapSave, lapBar, lapKey, lapStart, lapStop, lapClock, lapFrame, lapShot, lapLabel:label, lapRecBegin:recBegin, lapRecEnd:recEnd,
  get lap(){return lap},set lap(v){lap=v}};
