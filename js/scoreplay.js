/* Playing a score: a journey made for a piece of music (js/scoredata.js). While an audio file plays that is one of the
   score's tracks, each cue is made at its moment of the music: a world, a palette and the rest exactly, and which
   Journey template makes the changes by chance in between. Journey flies, as ever, so the flight is new every time.
   The time is the file's own, so a pause holds the score and a move of the scrubber takes it to what the score asks
   for there. The scores are kept in this browser, and come and go in packs. */
import { pDur, pPos, plAt, plName, player } from "./audio.js";
import { cam } from "./camera.js";
import { scene, setWorldNow } from "./choose.js";
import { clock } from "./clock.js";
import { FL_BYTES, flAt, flUnb64 } from "./flightdata.js";
import { $, toast } from "./dom.js";
import { flightPlaying } from "./flightplay.js";
import { wakeHud } from "./input.js";
import { doorDrop, doorOpen } from "./doors.js";
import { findT, jApply, jMove, jOverNow, jUse, journey, setJourney } from "./journey.js";
import { lapOn } from "./lap.js";
import { musicMode } from "./listen.js";
import { mediaClock, mediaTitle } from "./media.js";
import { SC_KINDS, cleanScore, cleanTrack, curveAt, scChase, scMatch, scOrder, scSeek, takeAt } from "./scoredata.js";
import { still } from "./still.js";
import { tgGuest } from "./together.js";
import { WORLDS } from "./worlds.js";
export const SCORES_MAX=24;  /* the most scores kept */
export const scores=[];      /* the scores kept in this browser, each as cleanScore passed it */
let use=null;                /* the score in use, or null */
/* where the playing is: the file it was last matched to (tok, dur), the track that file is (ti, -1 for none of them),
   that track's cues in order of asking (ord) and how many have been asked for (pi), the file's time at the last frame
   (last), and the changes asked for that are waiting for a transition to end (pend) */
const st={tok:-1,dur:0,ti:-1,ord:null,pi:0,last:-10,t:0,pend:[],take:null,live:false}; /* live: the score made its step this frame */
/* Camera takes. A track may hold passages where the camera's path was recorded (the composing screen does it): while
   the music is in one, the camera is put on that path and the morph where it was, as a played flight is, and the
   moment the user steers they have the controls until the take ends. */
const takeFl={};             /* takes made ready to fly, by their letters: {bytes, n, worlds} */
let takeN=0;
let handsOff=null;           /* the take the user has taken the controls from */
let takeHold=false;          /* the composing screen is recording the camera: no take is flown meanwhile */
export function setTakeHold(v){takeHold=!!v;}
function flOf(tk){
  var f=takeFl[tk.d],b;
  if(f)return f;
  if(++takeN>80){for(b in takeFl)delete takeFl[b];takeN=1;}
  b=flUnb64(tk.d);
  return takeFl[tk.d]={bytes:b,n:Math.floor(b.length/FL_BYTES),worlds:tk.w};
}
export const scMade={};      /* for each kind, the last name the score itself asked for, so that the composing screen can tell a change made by hand (js/studio.js) */

export function scoreUse(){return use;}
/* The track of the score that is playing, and the time in it: {i, t}, or null while the file is none of them. */
export function scoreNow(){return use&&st.ti>=0&&st.ord?{i:st.ti,t:st.t}:null;}
/* Change a track of the score in use: its cues and marks are replaced by these, through the cleaner. The picture is
   then brought to what the score now asks for at this moment. False if they were refused. */
export function scoreEdit(ti,cues,marks,takes,curves){
  var tr=use&&use.tracks[ti],got;
  if(!tr)return false;
  got=cleanTrack({name:tr.name,len:tr.len,marks:marks,cues:cues,takes:takes===undefined?tr.takes:takes,curves:curves===undefined?tr.curves:curves});
  if(!got)return false;
  use.tracks[ti]=got;scoresSave();
  if(ti===st.ti){st.ord=scOrder(got.cues);st.last=-10;st.pend=[];}
  return true;
}
/* Give the score in use another name (one no other score has). */
export function scoreRename(name){
  var i;
  if(!use||!name)return false;
  for(i=0;i<scores.length;i++)if(scores[i]!==use&&scores[i].name===name)return false;
  use.name=name;scoresSave();label();
  return true;
}
function label(){
  var b=$("bScore");
  b.hidden=!scores.length;b.textContent=use?"Score: "+use.name:"Score off";
  b.setAttribute("aria-pressed",use?"true":"false");
}
export function scoresSave(){
  try{localStorage.setItem("mirrorfold-scores",JSON.stringify({list:scores,sel:use?use.name:""}))}catch(_){}
}
/* Keep a score (one of the same name is replaced). It must have been through cleanScore. False if there is no room. */
export function scoreAdd(sc){
  var i;
  for(i=0;i<scores.length;i++)if(scores[i].name===sc.name){scores[i]=sc;if(use&&use.name===sc.name){use=sc;st.tok=-1;}scoresSave();label();return true;}
  if(scores.length>=SCORES_MAX)return false;
  scores.push(sc);scoresSave();label();
  return true;
}
export function scoreRemove(name){
  var i;
  for(i=0;i<scores.length;i++)if(scores[i].name===name){if(use===scores[i])scoreSet(null);scores.splice(i,1);scoresSave();label();return;}
}
/* Put a score in use, or with null none. In use it has the say over Journey's template, and Journey is turned on to fly. */
export function scoreSet(sc){
  use=sc||null;st.tok=-1;st.ti=-1;st.ord=null;st.pend=[];
  if(use){if(!journey)setJourney(true);jUse(null);}
  else jUse(undefined);
  scoresSave();label();
}
function worldIndex(id){for(var i=0;i<WORLDS.length;i++)if(WORLDS[i].id===id)return i;return -1;}
/* Make one change. False if it must wait (a transition is running). With now it is made at once, with nothing to cover it: after a jump in the music. */
function apply(k,v,now,cut){
  var i;
  if(k==="journey"){i=v?findT(v):null;if(jOverNow()!==i)jUse(i);return true;} /* a template that is not here is none: nothing changes by chance. One already in use is left running. */
  scMade[k]=v;
  if(k==="world")doorDrop(); /* a doorway an earlier cue opened and nobody has gone through is overtaken by this one */
  if(k==="world"&&now){i=worldIndex(v);if(i>=0&&WORLDS[i]!==scene.world)setWorldNow(i,true);return true;}
  /* through a doorway, while Journey is flying to go through it; where there cannot be one, or it is not gone through, the world changes the old way */
  if(k==="world"&&cut==="door"&&journey&&jMove==="travel"){i=worldIndex(v);if(i>=0&&WORLDS[i]!==scene.world&&doorOpen(i,true))return true;}
  return jApply(k,v,now);
}
/* The file is another one, or the first: find which track it is. */
function match(d){
  var n=plAt(),was=st.ti;
  st.tok=player.token;st.dur=d;
  st.ti=scMatch(use,d,mediaTitle(plName(n)),n);
  st.ord=st.ti>=0?scOrder(use.tracks[st.ti].cues):null;st.pi=0;st.last=-10;st.pend=[];
  if(st.ti<0){jUse(null);toast("This file is "+mediaClock(d)+" long, and no track of the score "+use.name+" is. The score waits for one of its own.");}
  else if(st.ti!==was)toast("Score "+use.name+": track "+(st.ti+1)+(use.tracks[st.ti].name?", "+use.tracks[st.ti].name:"")+".");
}
/* A step of the frame, after the clocks: make the score's changes that have come due in the music. */
/* Where the score's drawn line for the world's shape puts the morph now, -0.98 to 0.98, or null if the playing track has
   no such line (then the morph is left to the song or to itself). The frame hands it to the morph's clock as the song's
   aim is handed, so the shape is gone toward and never jumps. */
export function scoreMorph(){
  var v=st.live&&use&&use.tracks[st.ti]&&use.tracks[st.ti].curves?curveAt(use.tracks[st.ti].curves.morph,st.t):null;
  return v===null?null:(2*v-1)*0.98;
}
export function scoreClock(fr){
  var d,pos,c,want,i,k,tk,at,v;
  st.take=null;st.live=false;
  if(!use||musicMode!=="file"||!player.mode||still||lapOn()||flightPlaying()||tgGuest())return;
  d=pDur();
  if(!(d>0))return;
  if(player.token!==st.tok||Math.abs(d-st.dur)>0.01)match(d);
  if(!st.ord)return;
  pos=pPos();
  if(pos<st.last-0.05||pos>st.last+1.5){
    /* the music is somewhere else (the start, a move of the scrubber, the track gone round, Hold still let go): show at once what the score asks for there */
    want=scChase(use.tracks[st.ti].cues,pos);st.pend=[];
    if(!("journey" in want))want.journey="";
    for(i=0;i<SC_KINDS.length;i++){k=SC_KINDS[i];if(k in want)st.pend.push({k:k,v:want[k],now:true});}
    st.pi=scSeek(st.ord,pos);
  }else while(st.pi<st.ord.length&&st.ord[st.pi].at<=pos)st.pend.push(st.ord[st.pi++]);
  st.last=st.t=pos;st.live=true;
  /* the drawn line for the speed of flight: 0 is a fifth of the usual speed and 1 four times it, as the wheel gives, gone toward over half a second */
  v=use.tracks[st.ti].curves?curveAt(use.tracks[st.ti].curves.speed,pos):null;
  if(v!==null)cam.baseSpeed+=(0.2*Math.pow(20,v)-cam.baseSpeed)*Math.min(1,(fr?fr.dt:0.016)/0.5);
  while(st.pend.length){c=st.pend[0];if(!apply(c.k,c.v,c.now,c.cut))break;st.pend.shift();}
  /* a camera take over this moment: the morph is put where it was when the path was flown, so that the path is through open space again */
  tk=takeHold?null:takeAt(use.tracks[st.ti],pos);
  if(handsOff&&tk!==handsOff)handsOff=null;
  if(tk&&tk!==handsOff&&cam.hand===1){
    st.take=tk;
    at=flAt(flOf(tk),pos-tk.t,tk.w.indexOf(scene.world.id),function(){return [1,1,1];});
    if(at)clock.morphT=at.mt;
  }
}
/* A step of the frame, after the camera has moved: in a camera take, put the camera on its path. Steering takes the controls until the take ends. */
export function scoreFrame(fr){
  var tk=st.take,w=scene.world,at;
  if(!tk)return;
  if(!fr.idle||fr.mx!==0||fr.my!==0||fr.uz!==0||cam.lookAct>0.05){handsOff=tk;st.take=null;toast("You have the controls until this take ends.");return;}
  at=flAt(flOf(tk),st.t-tk.t,tk.w.indexOf(w.id),function(c,mt){return w.period(Math.sin(mt*0.09)+0.15*Math.sin(mt*0.31));});
  if(at){cam.pos=at.pos;cam.F=at.F;cam.Up=at.Up;cam.R=at.R;cam.vel=[0,0,0];}
}
/* Scores from a pack or from what was kept: each through cleanScore. How many were taken. */
export function scoresAdopt(list){
  var n=0,i,sc;
  if(!Array.isArray(list))return 0;
  for(i=0;i<list.length&&i<SCORES_MAX;i++){sc=cleanScore(list[i]);if(sc&&scoreAdd(sc))n++;}
  return n;
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
var raw,i;
try{
  raw=JSON.parse(localStorage.getItem("mirrorfold-scores")||"{}");
  if(raw&&Array.isArray(raw.list))for(i=0;i<raw.list.length&&scores.length<SCORES_MAX;i++){var sc=cleanScore(raw.list[i]);if(sc)scores.push(sc);}
  /* a score that was in use is in use again, but Journey is not turned on by the page itself: it waits for the user */
  if(raw&&typeof raw.sel==="string")for(i=0;i<scores.length;i++)if(scores[i].name===raw.sel)use=scores[i];
}catch(_){}
if(use)jUse(null);
label();
/* each press takes the next score, and after the last, none */
$("bScore").addEventListener("click",function(){
  var i=use?scores.indexOf(use)+1:0;
  scoreSet(i<scores.length?scores[i]:null);
  toast(use?"Score "+use.name+" is in use: it makes its changes as its music plays.":"No score is in use.");wakeHud();
});
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={scoreMorph, setTakeHold, scoreFrame, scoreFlOf:flOf, get takeHold(){return takeHold}, get scoreHandsOff(){return handsOff},set scoreHandsOff(v){handsOff=v}, scMade, scoreEdit, scoreRename, SCORES_MAX, scores, scoreUse, scoreNow, scoreLabel:label, scoresSave, scoreAdd, scoreRemove, scoreSet, scoreWorldIndex:worldIndex, scoreApply:apply, scoreMatch:match, scoreClock, scoresAdopt, scoreSt:st};
