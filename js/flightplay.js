/* Record flight and play it back. A recording is not a video: it is the camera's path and what was chosen along the
   way (js/flightdata.js), packed into a link. Whoever opens the link is flown along the same path through the same
   changes, drawn afresh on their own device, and has the controls the moment they move or look.
   With the built-in music the recording starts a new song, and the link carries that song's number, so the same song
   plays again. Other music is not carried: the flight then plays to whatever is on. */
import { cam } from "./camera.js";
import { scene, setWorldNow } from "./choose.js";
import { clock } from "./clock.js";
import { pkDeep } from "./packing.js";
import { $, toast } from "./dom.js";
import { FL_BYTES, FL_DT, FL_KINDS, FL_MAX, flAt, flPack, flSample, flUnpack, flWrite } from "./flightdata.js";
import { press, wakeHud } from "./input.js";
import { jApply, jCur, journey, setJourney } from "./journey.js";
import { musicMode } from "./listen.js";
import { started } from "./loop.js";
import { restartBuilt } from "./music.js";
import { still } from "./still.js";
import { tr } from "./warp.js";
import { WORLDS } from "./worlds.js";
let tape=null;      /* the recording being made: its time, samples, changes, worlds, and what was showing at the last look */
let play=null;     /* the flight being played: the flight, its time, and how many of its changes have been made */
let waiting=null;  /* a flight from the page's address, to be played once the start card has been left */
let lastText="";   /* the last flight this page put in its own address, so that it is not taken for a new one to play */

export function flightRecording(){return !!tape;}
export function flightPlaying(){return !!play;}
function worldNo(list,id){var i=list.indexOf(id);if(i<0&&list.length<64){list.push(id);i=list.length-1;}return i;}
function label(){
  var s=tape?Math.floor(tape.t):0;
  $("bFlight").textContent=tape?"Stop flight "+Math.floor(s/60)+":"+("0"+s%60).slice(-2):"Record flight";
  press($("bFlight"),!!tape);
}
/* Start recording: note everything that is showing, and with the built-in music start a new song whose number is kept. */
export function flightRecStart(){
  if(tape)return;
  if(pkDeep(scene.world)){toast("A flight cannot be recorded in the descent: its places are moved outward as it goes. Choose another packing.");return;}
  stopPlay("");
  tape={t:0,next:0,n:0,bytes:new Uint8Array((FL_MAX/FL_DT+2)*FL_BYTES),ev:[],worlds:[],was:{},seed:0};
  FL_KINDS.forEach(function(k){tape.was[k]=jCur(k);tape.ev.push([0,k,tape.was[k]]);});
  if(musicMode==="built"){tape.seed=(1+Math.floor(Math.random()*4294967294))>>>0;restartBuilt(tape.seed);}
  label();
  toast("Recording the flight"+(tape.seed?", with a new song":"")+". Press again to finish. It stops itself after four minutes.");
}
/* Finish recording and hand out the link. */
export function flightRecStop(){
  if(!tape)return;
  var r=tape,text,url,fail;
  tape=null;label();
  if(r.n<4){toast("The flight was too short to keep.");return;}
  r.ev.sort(function(a,b){return a[0]-b[0];});
  text=flPack({seed:r.seed,worlds:r.worlds,ev:r.ev,n:r.n,bytes:r.bytes});
  url=location.href.split("#")[0]+"#flight="+text;
  fail=function(){lastText=text;try{location.hash="flight="+text}catch(_){}toast("The flight is in this page's address. Copy it from the address bar.");};
  try{navigator.clipboard.writeText(url).then(function(){toast("Link to this flight copied: "+Math.round(r.n*FL_DT)+" seconds, "+Math.round(url.length/100)/10+" thousand letters.");},fail);}catch(_){fail();}
}
/* One frame of recording, after the camera has moved: note any change in what is showing, and twice a second the camera. */
function recFrame(fr){
  var w=scene.world,i,k,now;
  if(still)return;
  if(pkDeep(w)){flightRecStop();toast("The recording ended where the descent began: a flight cannot be recorded in it.");return;}
  for(i=0;i<FL_KINDS.length;i++){
    k=FL_KINDS[i];now=jCur(k);
    /* a change made behind a transition happened at the transition's peak, half a second after it was asked for; it is noted at the asking, so that played back it lands at the same moment */
    if(now!==tape.was[k]){tape.was[k]=now;tape.ev.push([Math.max(0,tape.t-(tr.warp>0.5?0.5:0)),k,now]);}
  }
  if(tape.t>=tape.next){
    flWrite(tape.bytes,tape.n++,flSample(cam.pos,fr.per||w.period(fr.m),cam.F,cam.Up,clock.morphT,worldNo(tape.worlds,w.id)));
    tape.next+=FL_DT;
  }
  tape.t+=fr.dt;
  if((tape.t|0)!==((tape.t-fr.dt)|0))label();
  if(tape.t>=FL_MAX){flightRecStop();}
}
function worldIndex(id){for(var i=0;i<WORLDS.length;i++)if(WORLDS[i].id===id)return i;return -1;}
/* Begin playing a flight: Journey off, the first world in place at once, the song started again if the flight has one. */
function beginPlay(fl){
  var wi=worldIndex(fl.worlds[fl.bytes[14]]);
  stopPlay("");
  if(tape){tape=null;label();}
  if(journey)setJourney(false);
  if(wi>=0&&WORLDS[wi]!==scene.world)setWorldNow(wi,true);
  if(fl.seed&&musicMode==="built")restartBuilt(fl.seed);
  play={fl:fl,t:0,ei:0};cam.hand=1; /* a flight was recorded unmirrored */
  toast("Playing a recorded flight. Move or look to take the controls.");
}
function stopPlay(msg){
  if(!play)return;
  play=null;cam.vel=[0,0,0];
  if(msg)toast(msg);
}
/* Play a flight given as a link's text. False if the text is not a flight. */
export function flightPlay(text){
  var fl=flUnpack(text);
  if(!fl)return false;
  if(started)beginPlay(fl);else waiting=fl;
  return true;
}
/* A step of the frame, after the clocks: move the flight's time on, make the changes that have come due, and put the
   morph's clock where the flight had it, so that the world has the shape the path was flown through. */
export function flightClock(fr){
  var e,at;
  if(waiting&&started){e=waiting;waiting=null;beginPlay(e);}
  if(!play||still)return;
  play.t+=fr.dt;
  while(play.ei<play.fl.ev.length&&play.fl.ev[play.ei][0]<=play.t){
    e=play.fl.ev[play.ei];
    if(!jApply(e[1],e[2],e[0]===0))break; /* a transition is running: this change waits for it, and those after wait behind it */
    play.ei++;
  }
  at=flAt(play.fl,play.t,play.fl.worlds.indexOf(scene.world.id),function(){return [1,1,1];});
  if(at)clock.morphT=at.mt;
}
/* A step of the frame, after the camera has moved: while a flight plays, put the camera on its path; while one is being
   recorded, note it. Any steering by the user ends the playing and leaves them where they are. */
export function flightFrame(fr){
  var at,w=scene.world;
  if(play&&!still){
    if(!fr.idle||fr.mx!==0||fr.my!==0||fr.uz!==0||cam.lookAct>0.05){stopPlay("You have the controls.");}
    else if(play.t>=(play.fl.n-1)*FL_DT){stopPlay("The flight is over. You have the controls.");}
    else{
      at=flAt(play.fl,play.t,play.fl.worlds.indexOf(w.id),function(c,mt){return w.period(Math.sin(mt*0.09)+0.15*Math.sin(mt*0.31));});
      if(at){cam.pos=at.pos;cam.F=at.F;cam.Up=at.Up;cam.R=at.R;cam.vel=[0,0,0];}
    }
  }
  if(tape)recFrame(fr);
}
function fromAddress(){
  var h=(location.hash||"").replace("#",""),t;
  if(h.indexOf("flight=")!==0)return;
  t=h.slice(7);
  if(t===lastText)return;
  lastText=t;
  if(!flightPlay(t))toast("That link is not a flight this page can read.");
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
label();
$("bFlight").addEventListener("click",function(){if(tape)flightRecStop();else flightRecStart();wakeHud();});
fromAddress();
window.addEventListener("hashchange",fromAddress);
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={flightLabel:label, flightFromAddress:fromAddress, flightRecording, flightPlaying, worldNo, flightRecStart, flightRecStop, recFrame, worldIndex, beginPlay, stopPlay, flightPlay, flightClock, flightFrame,
  get tape(){return tape},set tape(v){tape=v}, get flightNow(){return play},set flightNow(v){play=v}, get waiting(){return waiting},set waiting(v){waiting=v}, get lastText(){return lastText},set lastText(v){lastText=v}};
