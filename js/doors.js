/* Doorways: a ring that stands in the open space of one world and shows another world through it. Flying through the
   ring puts the camera in that other world with no cut, because what was seen through the ring is exactly what is seen
   from the far side: each frame the other world is drawn first, from where the camera would be in it, into a picture of
   its own (js/render.js), and the scene shader shows that picture inside the ring (js/shaders.js).
   A doorway joins a place p in this world to a place q in the other. A camera at p + x here sees, through the ring,
   the other world from q + s*x, where s is how much bigger the open space is there; both ends face the same way.
   Journey changes world through a doorway when it is flying (the autopilot is steered into it), and Open a doorway
   makes one by hand. A doorway closes if nobody goes through, or if the morph shuts the space at either end. After
   going through, the way back stays open behind for a few seconds; behind Journey's own flight it closes at once.
   Only worlds with surfaces and a distance worked out here can have one: not a zoom, a cloud or a pack world.
   A strange doorway leads into the same world, changed (DOOR_LIES): close up to the surface ahead, where the ring at
   the far end is a small part of the size, so that the camera comes out small among large shapes; or to the same place
   turned upside down; or to the same place mirrored. For these the far side is p's offset turned by T as well as
   scaled, far = q + s*T*x, and the camera's own directions are turned by T as it goes through. T always leaves the
   ring's facing as it is, so the ring is the same ring from both sides. Journey opens one now and then while it flies. */
import { cam } from "./camera.js";
import { calm } from "./dom.js";
import { lapOn } from "./lap.js";
import { requestWorld, scene, setWorldNow } from "./choose.js";
import { packing, pkDeep } from "./packing.js";
import { $, toast } from "./dom.js";
import { flightPlaying, flightRecording } from "./flightplay.js";
import { press, wakeHud } from "./input.js";
import { journey } from "./journey.js";
import { landMode } from "./land.js";
import { started } from "./loop.js";
import { build, buildReady, buildStart } from "./programs.js";
import { still } from "./still.js";
import { tgGuest } from "./together.js";
import { vidAlone } from "./video.js";
import { stereo } from "./vr.js";
import { tr } from "./warp.js";
import { WORLDS } from "./worlds.js";
export const DOOR_LIFE=40;   /* seconds a doorway waits to be flown through */
export const DOOR_BACK=10;   /* seconds the way back stays open behind */
export const DOOR_BACK_J=2;  /* the same while Journey is flying: it closes at once, so that the autopilot cannot turn round and go back through */
export const DOOR_TRY=6;     /* seconds spent looking for room to put one before giving up */
export const DOOR_LIES=["small","over","mirror"]; /* the strange doorways: close up and small, upside down, mirrored */
export const DOOR_SMALL=0.12; /* a small doorway's far ring, as a part of the near one's size, where there is room for it */
export const LIE_EVERY=70;   /* seconds of Journey's flying between the strange doorways it opens for itself, give or take a third */
export const doorU=new Float32Array(4); /* for the shader: the ring's middle (the copy nearest the camera) and its size now; 0 for none */
export const doorN=new Float32Array(3); /* the way the ring faces */
export let doorsOn=true;     /* Journey changes world through doorways */
/* The doorway, or null: to and from (the worlds), p, n, r (its place, facing and full size here), q and s (its place in
   the other world and the scale between them), open (0 shut to 1), age, back (it is the way back), warp (if nobody goes
   through, change world the old way), wait (no place found for it yet), shut (closing), was (the camera's place from
   the ring's middle last frame), chk (time since the space at both ends was last measured), lie ("" or one of
   DOOR_LIES), T (the turn between the two sides as nine numbers, row by row; null for none) and say (it was opened by
   hand, so its kind is told when it appears). */
let door=null;
let lieT=0,lieNext=LIE_EVERY; /* how long Journey has flown since its last strange doorway, and when the next is due */

/* Can this world have an end of a doorway in it? */
export function doorWorld(w){return !!w&&!w.flat&&!w.volume&&!w.pack&&!w.sheet&&typeof w.de==="function";} /* not the Fabric: the camera is held above its cloth, and a doorway could stand below it */
function unit(v){var l=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/l,v[1]/l,v[2]/l];}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
/* a turn T (nine numbers, row by row, or null for none) applied to v; and the turn that undoes it */
export function doorTurn(T,v){return T?[T[0]*v[0]+T[1]*v[1]+T[2]*v[2],T[3]*v[0]+T[4]*v[1]+T[5]*v[2],T[6]*v[0]+T[7]*v[1]+T[8]*v[2]]:[v[0],v[1],v[2]];}
export function doorUnturn(T){return T?[T[0],T[3],T[6],T[1],T[4],T[7],T[2],T[5],T[8]]:null;}
/* The turn of a strange doorway whose ring faces n: "over" is half a turn about n, which puts the far side upside down;
   "mirror" swaps the two sides of the plane through n and up, which mirrors it left to right. Both leave n as it is. */
export function doorLieTurn(kind,n,right){
  var u,k;
  if(kind==="over")return [2*n[0]*n[0]-1,2*n[0]*n[1],2*n[0]*n[2],2*n[1]*n[0],2*n[1]*n[1]-1,2*n[1]*n[2],2*n[2]*n[0],2*n[2]*n[1],2*n[2]*n[2]-1];
  if(kind==="mirror"){
    k=dot(right,n);u=unit([right[0]-k*n[0],right[1]-k*n[1],right[2]-k*n[2]]);
    return [1-2*u[0]*u[0],-2*u[0]*u[1],-2*u[0]*u[2],-2*u[1]*u[0],1-2*u[1]*u[1],-2*u[1]*u[2],-2*u[2]*u[0],-2*u[2]*u[1],1-2*u[2]*u[2]];
  }
  return null;
}
/* The far end of a small doorway: straight on from the ring at p (which faces n and has size r), walked to where the
   open space is just enough for a ring DOOR_SMALL of the size. {q, s}, or null if nothing is met within reach or the
   place found does not suit. */
export function doorSmall(de,p,n,r,reach){
  var want=r*DOOR_SMALL/0.45,t=0,k,d,q,s;
  for(k=0;k<300;k++){
    q=[p[0]-n[0]*t,p[1]-n[1]*t,p[2]-n[2]*t];d=de(q[0],q[1],q[2]);
    if(d<=1.15*want){s=0.45*d/r;return s>=0.03&&s<=0.4?{q:q,s:s}:null;}
    t+=Math.max(d-want,0.2*want);
    if(t>reach)return null;
  }
  return null;
}
/* v taken to its nearest copy round a world's repeat */
export function doorWrap(v,per){return [v[0]-per[0]*Math.round(v[0]/per[0]),v[1]-per[1]*Math.round(v[1]/per[1]),v[2]-per[2]*Math.round(v[2]/per[2])];}
/* A place for a doorway ahead of a camera: {p, n, r}, or null if there is no room. de(x,y,z) is the world's distance,
   scale the shortest side of its repeat. The way ahead and four ways a little to each side are walked until something
   is in the way; the ring goes part of the way along the clearest, as big as the space there allows and no bigger than
   looks right from here, facing the camera. */
export function doorAhead(de,pos,F,R,Up,scale){
  var tilt=[[0,0],[0.4,0],[-0.4,0],[0,0.4],[0,-0.4]],best=null,i,k,d,t,dir,c,r,tc,sc;
  var here=Math.max(Math.abs(de(pos[0],pos[1],pos[2])),0.01*scale),reach=0.4*scale;
  for(i=0;i<tilt.length;i++){
    dir=unit([F[0]+tilt[i][0]*R[0]+tilt[i][1]*Up[0],F[1]+tilt[i][0]*R[1]+tilt[i][1]*Up[1],F[2]+tilt[i][0]*R[2]+tilt[i][1]*Up[2]]);
    for(t=0,k=0;k<48;k++){d=de(pos[0]+dir[0]*t,pos[1]+dir[1]*t,pos[2]+dir[2]*t);if(d<0.004*scale||t>reach)break;t+=d;}
    tc=Math.min(0.6*Math.min(t,reach),10*here);
    c=[pos[0]+dir[0]*tc,pos[1]+dir[1]*tc,pos[2]+dir[2]*tc];
    r=Math.min(0.45*de(c[0],c[1],c[2]),0.3*tc);
    sc=r*(i?1:1.3); /* straight ahead is preferred */
    if(r>=0.006*scale&&(!best||sc>best.sc))best={p:c,n:[-dir[0],-dir[1],-dir[2]],r:r,sc:sc};
  }
  return best?{p:best.p,n:best.n,r:best.r}:null;
}
/* The other end: the most open of 160 places in one repeat of a world, and the size a ring can have there. rnd gives chance numbers from 0 to 1. */
export function doorSpot(de,per,rnd){
  var best=0,q=null,k,c,d;
  for(k=0;k<160;k++){
    c=[(rnd()-0.5)*per[0],(rnd()-0.5)*per[1],(rnd()-0.5)*per[2]];d=de(c[0],c[1],c[2]);
    if(d>best){best=d;q=c;}
  }
  return q?{q:q,r:0.45*best}:null;
}
/* Did the camera go through the ring between two frames? a and b are its places from the ring's middle, n the ring's facing, r its size. */
export function doorCross(a,b,n,r){
  var sa=dot(a,n),sb=dot(b,n),u,h;
  if(sa===sb||(sa>0)===(sb>0))return false;
  u=sa/(sa-sb);h=[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u];
  return dot(h,h)<r*r;
}
/* The part of the picture a ring can show in, as [x, y, width, height] in pixels from the bottom left: "all" if the
   camera is in or near it, null if it is behind the camera or off the picture. c is the ring's middle from the camera,
   in the camera's own right, up and forward; fov and the picture's size are as the scene shader has them. */
export function doorBox(c,r,fov,w,h){
  var rb=1.1*r,S=Math.sqrt(w*h),e,x0,x1,y0,y1;
  if(c[2]<=1.5*rb)return Math.hypot(c[0],c[1],c[2])<4*rb?"all":null;
  e=1.3*fov*rb/(c[2]-rb)*(1+Math.hypot(c[0],c[1])/c[2]);
  x0=Math.floor(((fov*c[0]/c[2]-e)*S+w)/2)-2;x1=Math.ceil(((fov*c[0]/c[2]+e)*S+w)/2)+2;
  y0=Math.floor(((fov*c[1]/c[2]-e)*S+h)/2)-2;y1=Math.ceil(((fov*c[1]/c[2]+e)*S+h)/2)+2;
  x0=Math.max(0,x0);y0=Math.max(0,y0);x1=Math.min(w,x1);y1=Math.min(h,y1);
  if(x1<=x0||y1<=y0)return null;
  return [x0,y0,x1-x0,y1-y0];
}

/* May a doorway be opened now, from the world in use to world number i? */
function doorMay(i){
  var to=WORLDS[i];
  return started&&!door&&!still&&!stereo&&!landMode&&!vidAlone()&&tr.warpDir===0&&!tgGuest()&&!flightPlaying()&&!lapOn()&&
    doorWorld(scene.world)&&doorWorld(to)&&to!==scene.world&&!pkDeep(scene.world)&&!pkDeep(to); /* not in the descent, where a ring would have to be moved out with the camera */
}
/* May a strange doorway be opened now? As for any doorway; and not while a flight is being recorded, which keeps the
   camera's path and not the doorways, and would play the turn as a lurch. */
function doorMayLie(){
  return started&&!door&&!still&&!stereo&&!landMode&&!vidAlone()&&tr.warpDir===0&&!tgGuest()&&!flightPlaying()&&!flightRecording()&&!lapOn()&&
    doorWorld(scene.world)&&!pkDeep(scene.world);
}
/* Open a strange doorway of one kind, from this world into itself. False if there cannot be one now. */
export function doorOpenLie(kind){
  if(DOOR_LIES.indexOf(kind)<0||!doorMayLie())return false;
  door={to:scene.world,from:scene.world,p:null,n:null,r:0,q:null,s:1,open:0,age:0,back:false,warp:false,wait:true,shut:false,was:null,chk:0,pk:packing,lie:kind,T:null,say:false};
  return true;
}
/* Open a doorway from here to world number i. With warp, the world is changed the old way if nobody goes through.
   False if there cannot be one; true once it is on its way (it appears when a place has been found for it). */
export function doorOpen(i,warp){
  if(!doorMay(i))return false;
  try{if(!WORLDS[i].prog)buildStart(WORLDS[i]);}catch(_){return false;}
  door={to:WORLDS[i],from:scene.world,p:null,n:null,r:0,q:null,s:1,open:0,age:0,back:false,warp:!!warp,wait:true,shut:false,was:null,chk:0,pk:packing,lie:"",T:null};
  return true;
}
/* the doorway is over: forgotten, and if Journey was owed a change of world it gets one the old way */
function doorEnd(){
  var d=door;
  door=null;doorU[3]=0;
  if(d&&d.warp&&!d.back&&journey&&scene.world===d.from)requestWorld(WORLDS.indexOf(d.to));
}
/* look for a place to put a doorway that is waiting for one: its program must be made, there must be room ahead, and room at the far end */
function doorPlace(fr){
  var d=door,m=fr.m,here,there,per=fr.per,dper,de;
  if(!buildReady(d.to))return;
  try{build(d.to);}catch(_){doorEnd();return;}
  de=function(x,y,z){return d.from.de(x,y,z,m);};
  here=doorAhead(de,cam.pos,cam.F,cam.R,cam.Up,Math.min(per[0],per[1],per[2]));
  if(!here)return;
  if(d.lie){ /* a strange doorway: the far end is in this world, straight on and close up, or at the ring itself with the world turned */
    there=d.lie==="small"?doorSmall(de,here.p,here.n,here.r,1.5*Math.min(per[0],per[1],per[2])):{q:here.p.slice(),s:1};
    if(!there){if(d.age>1.5)d.lie=Math.random()<0.5?"over":"mirror";return;} /* nothing near enough straight ahead for a small one: another kind, which needs only the room here */
    d.T=doorLieTurn(d.lie,here.n,cam.R);
    d.p=here.p;d.n=here.n;d.r=here.r;d.q=there.q;d.s=there.s;d.wait=false;d.age=0;
    if(d.say)toast(d.lie==="small"?"A doorway to the surface ahead, close up, where you are small. Fly through the ring.":d.lie==="over"?"A doorway into this same world upside down. Fly through the ring.":"A doorway into this same world mirrored. Fly through the ring.");
    return;
  }
  dper=d.to.period(m);
  there=doorSpot(function(x,y,z){return d.to.de(x,y,z,m);},dper,Math.random);
  if(!there)return;
  d.p=here.p;d.n=here.n;d.r=here.r;d.q=there.q;d.s=there.r/here.r;d.wait=false;d.age=0;
}
/* The camera has gone through: it is now in the other world, at the matching place, flying the same way, and the
   doorway it came through is the way back. The frame's notes are brought up to date for the steps that follow. */
function doorThrough(fr,rel){
  var d=door,vel=doorTurn(d.T,cam.vel),i,per,hand=cam.hand;
  door=null;doorU[3]=0;
  if(d.to!==d.from&&!setWorldNow(WORLDS.indexOf(d.to),false))return;
  per=d.to.period(fr.m);rel=doorTurn(d.T,rel);
  for(i=0;i<3;i++){cam.pos[i]=d.q[i]+d.s*rel[i];cam.pos[i]-=per[i]*Math.floor(cam.pos[i]/per[i]+0.5);cam.vel[i]=vel[i]*d.s;}
  if(d.T){cam.R=doorTurn(d.T,cam.R);cam.Up=doorTurn(d.T,cam.Up);cam.F=doorTurn(d.T,cam.F);} /* the camera's directions turn with the world it has gone into, so the picture does not */
  if(d.lie==="small"&&fr.travel){ /* a small doorway comes out facing the surface it leads to: Journey is turned toward whichever side has most room, so that it does not creep up to the wall */
    var e=2*d.r*d.s,m=fr.m,side=[cam.R,[-cam.R[0],-cam.R[1],-cam.R[2]],cam.Up,[-cam.Up[0],-cam.Up[1],-cam.Up[2]]],best=0,bd=-1,dd;
    for(i=0;i<4;i++){dd=d.to.de(cam.pos[0]+side[i][0]*e,cam.pos[1]+side[i][1]*e,cam.pos[2]+side[i][2]*e,m);if(dd>bd){bd=dd;best=i;}}
    if(best<2)cam.lookX+=best===0?1.3:-1.3;else cam.lookY+=best===2?-1.3:1.3;
  }
  cam.hand=d.lie==="mirror"?-hand:hand; /* a mirrored view stays mirrored through an ordinary doorway, or the picture would flip at the ring */
  fr.w=d.to;fr.wSpeed=d.to.speed;fr.pk=false;fr.per=per;fr.dist=Math.abs(d.to.de(cam.pos[0],cam.pos[1],cam.pos[2],fr.m));
  door={to:d.from,from:d.to,p:d.q,n:d.n,r:d.r*d.s,q:d.p,s:1/d.s,open:1,age:0,back:true,warp:false,wait:false,shut:false,was:null,chk:0,pk:packing,lie:d.lie,T:doorUnturn(d.T)};
}
/* Is the straight way from the camera to a place off by v clear? de is the world's distance, r the room wanted round the line. */
export function doorClear(de,pos,v,r){
  var k,u;
  for(k=1;k<=4;k++){u=k/5;if(de(pos[0]+v[0]*u,pos[1]+v[1]*u,pos[2]+v[2]*u)<r)return false;}
  return true;
}
/* A step of the frame, in the autopilot's place: while Journey flies and a doorway stands ahead, turn toward its middle.
   True if the way to it is clear, and then the autopilot is left out this frame, so that nothing pulls the flight off
   the ring. If something is in the way it only leans toward the ring and the autopilot steers too. One that has been
   passed is closed. */
export function doorSteer(fr){
  var d=door,v,u,z,m=fr.m,own,g,lim;
  if(!d||d.wait||d.back||d.shut||!fr.travel||still)return false;
  v=doorWrap([d.p[0]-cam.pos[0],d.p[1]-cam.pos[1],d.p[2]-cam.pos[2]],fr.w.period(fr.m));
  if(dot(v,d.n)>0){d.shut=true;return false;} /* the camera is behind it */
  u=unit(v);z=dot(u,cam.F);
  if(z<0.1)return false;
  own=doorClear(function(x,y,z){return d.from.de(x,y,z,m);},cam.pos,v,0.4*d.r);
  g=own?5:2.6;lim=own?2.2:1.4;
  cam.lookX+=Math.max(-lim,Math.min(lim,g*dot(u,cam.R)))*fr.dt*fr.hands;cam.lookY-=Math.max(-lim,Math.min(lim,g*dot(u,cam.Up)))*fr.dt*fr.hands;
  return own;
}
/* Is a doorway of Journey's standing, not yet gone through? Journey does not ask for another world meanwhile. */
export function doorOwed(){return !!door&&door.warp&&!door.back;}
/* A step of the frame, after the camera has moved: find a waiting doorway its place, open or close it, take the camera
   through if it has crossed the ring, and say where to draw it. Under Hold still nothing about it changes. */
export function stepDoor(fr){
  var d=door,per=fr.per,m=fr.m,rel,i,far=0;
  if(!d){
    doorU[3]=0;
    /* Journey, flying with doorways allowed, opens a strange one for itself now and then (not where less motion is asked for) */
    if(journey&&doorsOn&&fr.travel&&!still&&!calm){
      lieT+=fr.dt;
      if(lieT>lieNext&&doorOpenLie(DOOR_LIES[Math.floor(Math.random()*DOOR_LIES.length)])){lieT=0;lieNext=LIE_EVERY*(0.67+0.66*Math.random());}
    }
    return;
  }
  if(still)return;
  if(scene.world!==d.from||d.pk!==packing||stereo||landMode||!per||tgGuest()||flightPlaying()||lapOn()||(d.lie&&flightRecording())){door=null;doorU[3]=0;return;} /* the world was changed some other way, or something came on that a doorway cannot be drawn with */
  d.age+=fr.dt;
  if(d.wait){
    doorU[3]=0;
    if(d.age>DOOR_TRY){if(!d.warp&&!(d.lie&&fr.travel))toast("There is no room for a doorway here. Fly into the open and try again.");doorEnd();return;}
    doorPlace(fr);
    if(!door||door.wait)return;
  }
  rel=doorWrap([cam.pos[0]-d.p[0],cam.pos[1]-d.p[1],cam.pos[2]-d.p[2]],per);
  if(d.was){for(i=0;i<3;i++)far=Math.max(far,Math.abs(rel[i]-d.was[i])/per[i]);}
  if(d.was&&far<0.25&&d.open>0.5&&doorCross(d.was,rel,d.n,0.95*d.r*d.open)){doorThrough(fr,rel);return;}
  d.was=rel;
  d.chk+=fr.dt;
  if(d.chk>0.3){ /* the morph may have closed the space at either end */
    d.chk=0;
    if(d.from.de(d.p[0],d.p[1],d.p[2],m)<1.2*d.r||d.to.de(d.q[0],d.q[1],d.q[2],m)<1.2*d.r*d.s)d.shut=true;
  }
  if(d.age>(d.back?(fr.travel?DOOR_BACK_J:DOOR_BACK):DOOR_LIFE))d.shut=true;
  d.open+=((d.shut?0:1)-d.open)*(1-Math.exp(-fr.dt*(d.shut?5:2.5)));
  if(d.shut&&d.open<0.03){doorEnd();return;}
  doorU[0]=cam.pos[0]-rel[0];doorU[1]=cam.pos[1]-rel[1];doorU[2]=cam.pos[2]-rel[2];doorU[3]=d.r*d.open;
  doorN[0]=d.n[0];doorN[1]=d.n[1];doorN[2]=d.n[2];
}
/* For the drawing: what to draw through the ring this frame, or null if the ring is not in the picture. Gives the other
   world, where the camera would be in it, where the ring is in it (nothing nearer than the ring is drawn), and the
   part of the picture to draw: [x, y, width, height], or "all". With mirrors the ring can show anywhere, so it is all. */
export function doorView(m,fov,w,h,mirrored){
  var d=door,v,box,tv;
  if(!d||d.wait||doorU[3]<=0)return null;
  v=[doorU[0]-cam.pos[0],doorU[1]-cam.pos[1],doorU[2]-cam.pos[2]];
  box=doorBox([dot(v,cam.R),dot(v,cam.Up),dot(v,cam.F)],doorU[3],fov,w,h);
  if(!box)return null;
  tv=doorTurn(d.T,v);
  return {w:d.to,per:d.to.period(m),pos:[d.q[0]-d.s*tv[0],d.q[1]-d.s*tv[1],d.q[2]-d.s*tv[2]],at:d.q,box:mirrored?"all":box,T:d.T,s:d.s};
}
/* Open a strange doorway by hand, of a kind picked by chance. */
function lieByHand(){
  var k=DOOR_LIES[Math.floor(Math.random()*DOOR_LIES.length)];
  if(door){toast(door.wait?"Looking for room for a doorway.":"A doorway is already open. Fly through the ring.");return;}
  if(!doorOpenLie(k)){toast(flightRecording()?"A strange doorway cannot be opened while a flight is being recorded.":doorWorld(scene.world)&&!stereo&&!landMode&&!pkDeep(scene.world)?"A doorway cannot be opened just now.":"A doorway cannot be opened in this world, in the descent, over the land or in the VR viewer.");return;}
  door.say=true; /* which kind it is, is said when it has found its place */
}
/* Open a doorway by hand, to a world picked by chance. */
function doorByHand(){
  var can=[],i;
  if(door){toast(door.wait?"Looking for room for a doorway.":"A doorway is already open. Fly through the ring.");return;}
  for(i=0;i<WORLDS.length;i++)if(doorMay(i))can.push(i);
  if(!can.length){toast(doorWorld(scene.world)&&!stereo&&!landMode?"A doorway cannot be opened just now.":"A doorway cannot be opened in this world, over the land or in the VR viewer.");return;}
  i=can[Math.floor(Math.random()*can.length)];
  if(doorOpen(i,false))toast("Opening a doorway to "+WORLDS[i].name+". Fly through the ring.");
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
try{doorsOn=localStorage.getItem("mirrorfold-doors")!=="off"}catch(_){}
press($("bDoors"),doorsOn);
$("bDoors").addEventListener("click",function(){
  doorsOn=!doorsOn;press(this,doorsOn);try{localStorage.setItem("mirrorfold-doors",doorsOn?"on":"off")}catch(_){}
  toast(doorsOn?"Journey changes world through doorways, and opens a strange one now and then":"Journey changes world behind a transition");wakeHud();
});
$("bDoor").addEventListener("click",function(){doorByHand();wakeHud();});
$("bLie").addEventListener("click",function(){lieByHand();wakeHud();});
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={DOOR_LIES, DOOR_SMALL, LIE_EVERY, doorTurn, doorUnturn, doorLieTurn, doorSmall, doorMayLie, doorOpenLie, lieByHand, get lieT(){return lieT},set lieT(v){lieT=v}, get lieNext(){return lieNext},set lieNext(v){lieNext=v}, DOOR_LIFE, DOOR_BACK, DOOR_BACK_J, DOOR_TRY, doorClear, doorOwed, doorU, doorN, doorWorld, doorWrap, doorAhead, doorSpot, doorCross, doorBox, doorMay, doorOpen, doorEnd, doorPlace, doorThrough, doorSteer, stepDoor, doorView, doorByHand,
  get doorsOn(){return doorsOn},set doorsOn(v){doorsOn=v}, get door(){return door},set door(v){door=v}};
