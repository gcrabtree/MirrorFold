/* Ribbons: the camera leaves a line of light behind it, which fades along its length and with time. Anyone flying with
   you leaves one too, drawn from where their marker has been seen here, so nothing more is sent between friends.
   The scene shader draws them at their true places (js/shaders.js), so a wall in front of one hides it. A world
   repeats, so a ribbon is drawn at the copy of each of its points nearest the camera: fly on far enough and your own
   ribbon is there ahead of you. */
import { cam } from "./camera.js";
import { $, toast } from "./dom.js";
import { press, wakeHud } from "./input.js";
import { landMode } from "./land.js";
import { lapOn } from "./lap.js";
import { started } from "./loop.js";
import { packing } from "./packing.js";
import { still } from "./still.js";
import { peerU } from "./together.js";
import { vidAlone } from "./video.js";
export const RB_OWN=32;     /* how many points the camera's ribbon has */
export const RB_PEER=8;     /* how many each friend's has */
export const RB_PEERS=3;    /* how many friends (TG_MAX in js/together.js; a test holds the two equal) */
export const RB_N=RB_OWN+RB_PEERS*RB_PEER; /* all the points the shader is given */
export const RB_LIFE=45;    /* seconds a point lasts */
export let ribbonsOn=false; /* the Ribbons switch */
export let rbU;             /* for the shader: each point's place, and how brightly the ribbon shows from it to the next (0 for no point; below 0 for a point with no line on to the next) */
export let rbNone;         /* no ribbons, for the world beyond a doorway */
export let rbW=0;           /* for the shader: how wide the ribbons are; 0 for none */
const own=[];               /* the camera's ribbon, newest first: each point's place (p), its age, and how far it was from the one before when it was added (d) */
const peers=[[],[],[]];     /* the same for each friend */
let key="",wide=0;

/* Add a place to the front of a ribbon if it is at least step from the newest point (the short way round the world's
   repeat, per, which is null where the world does not repeat), and keep at most n points. A jump of more than eight
   steps is not a flight: the ribbon starts again from there. */
export function rbAdd(list,p,step,n,per){
  var g=0,i,q;
  if(list.length){
    for(i=0;i<3;i++){q=p[i]-list[0].p[i];if(per)q-=per[i]*Math.floor(q/per[i]+.5);g+=q*q;}
    g=Math.sqrt(g);
    if(g<step)return;
    if(g>8*step)list.length=0;
  }
  list.unshift({p:[p[0],p[1],p[2]],age:0,d:g});
  if(list.length>n)list.length=n;
}
/* Write a ribbon into out from slot at, n slots: head (a place, or null) first if given, then the points. Each is put
   at its copy nearest the camera. A point's brightness falls along the ribbon and with its age; it is made negative
   where the line must not go on to the next point: at the ribbon's end, and where the next point's nearest copy is
   another copy of the world. */
export function rbFill(out,at,n,list,head,camPos,per,life){
  var pts=[],k,i,q,a,b,g,br;
  for(k=0;k<4*n;k++)out[4*at+k]=0;
  if(head)pts.push({p:head,age:0,d:-1});
  for(k=0;k<list.length&&pts.length<n;k++)pts.push(list[k]);
  for(k=0;k<pts.length;k++){
    for(i=0;i<3;i++){q=pts[k].p[i]-camPos[i];if(per)q-=per[i]*Math.floor(q/per[i]+.5);out[4*(at+k)+i]=camPos[i]+q;}
  }
  for(k=0;k<pts.length;k++){
    br=Math.max(0.02,(1-pts[k].age/life))*Math.sqrt(1-k/n);
    if(k===pts.length-1)br=-br;
    else{
      a=4*(at+k);b=a+4;g=Math.hypot(out[b]-out[a],out[b+1]-out[a+1],out[b+2]-out[a+2]);
      if(pts[k].d>=0&&Math.abs(g-pts[k].d)>0.5*pts[k].d+1e-6)br=-br;
    }
    out[4*(at+k)+3]=br;
  }
}
function clearAll(){own.length=0;peers[0].length=0;peers[1].length=0;peers[2].length=0;}
/* A step of the frame, after the camera and the friends' markers are placed: add to the ribbons and fill rbU. Under
   Hold still nothing is added and nothing ages. */
export function stepRibbons(fr){
  var w=fr.w,per=fr.per,deep=fr.jump!==1,s,step,k,j,i,L,head,kk;
  rbW=0;
  if(!ribbonsOn||!started||!w||w.flat||!per||landMode===1||vidAlone()||lapOn()){clearAll();return;}
  kk=w.id+","+packing;if(kk!==key){key=kk;clearAll();wide=0;}
  if(deep)for(k=-1;k<RB_PEERS;k++){L=k<0?own:peers[k];for(j=0;j<L.length;j++){for(i=0;i<3;i++)L[j].p[i]*=fr.jump;L[j].d*=fr.jump;}} /* the descent: they are moved out with the camera */
  s=Math.max(0.01,Math.min(0.6,fr.dist));
  if(deep)wide*=fr.jump;
  if(!still){
    wide=wide>0?wide+(0.035*s-wide)*(1-Math.exp(-fr.dt*0.5)):0.035*s; /* the width follows the open space round the camera, slowly */
    step=14*wide;
    rbAdd(own,cam.pos,step,RB_OWN,per);
    for(j=0;j<own.length;j++)own[j].age+=fr.dt;
    while(own.length&&own[own.length-1].age>RB_LIFE)own.pop();
    for(k=0;k<RB_PEERS;k++){
      L=peers[k];
      if(peerU[4*k+3]>0)rbAdd(L,[peerU[4*k],peerU[4*k+1],peerU[4*k+2]],step,RB_PEER-1,per);else L.length=0;
      for(j=0;j<L.length;j++)L[j].age+=fr.dt;
      while(L.length&&L[L.length-1].age>RB_LIFE)L.pop();
    }
  }
  rbFill(rbU,0,RB_OWN,own,null,cam.pos,per,RB_LIFE);
  for(k=0;k<RB_PEERS;k++){
    head=peerU[4*k+3]>0?[peerU[4*k],peerU[4*k+1],peerU[4*k+2]]:null; /* a friend's ribbon starts at their marker */
    rbFill(rbU,RB_OWN+k*RB_PEER,RB_PEER,peers[k],head,cam.pos,per,RB_LIFE);
  }
  rbW=wide;
}
export function setRibbons(on){
  ribbonsOn=!!on;press($("bRibbon"),ribbonsOn);
  if(!ribbonsOn)clearAll();
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
var sv=null;
rbU=new Float32Array(4*RB_N);rbNone=new Float32Array(4*RB_N);
try{sv=localStorage.getItem("mirrorfold-ribbons")}catch(_){}
setRibbons(sv==="on");
$("bRibbon").addEventListener("click",function(){
  setRibbons(!ribbonsOn);try{localStorage.setItem("mirrorfold-ribbons",ribbonsOn?"on":"off")}catch(_){}
  toast(ribbonsOn?"Ribbons on. Your flight leaves a line of light behind it: turn round to see it.":"Ribbons off");wakeHud();
});
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={RB_OWN, RB_PEER, RB_PEERS, RB_N, RB_LIFE, rbAdd, rbFill, rbClear:clearAll, stepRibbons, setRibbons, rbOwn:own, rbPeers:peers,
  get ribbonsOn(){return ribbonsOn},set ribbonsOn(v){ribbonsOn=v}, get rbU(){return rbU},set rbU(v){rbU=v}, get rbW(){return rbW},set rbW(v){rbW=v}, get rbNone(){return rbNone},
  get rbKey(){return key},set rbKey(v){key=v}, get rbWide(){return wide},set rbWide(v){wide=v}};
