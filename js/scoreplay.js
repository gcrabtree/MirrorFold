/* Playing a score: a journey made for a piece of music (js/scoredata.js). While an audio file plays that is one of the
   score's tracks, each cue is made at its moment of the music: a world, a palette and the rest exactly, and which
   Journey template makes the changes by chance in between. Journey flies, as ever, so the flight is new every time.
   The time is the file's own, so a pause holds the score and a move of the scrubber takes it to what the score asks
   for there. The scores are kept in this browser, and come and go in packs. */
import { pDur, pPos, plAt, plName, player } from "./audio.js";
import { scene, setWorldNow } from "./choose.js";
import { $, toast } from "./dom.js";
import { flightPlaying } from "./flightplay.js";
import { wakeHud } from "./input.js";
import { findT, jApply, jUse, journey, setJourney } from "./journey.js";
import { lapOn } from "./lap.js";
import { musicMode } from "./listen.js";
import { mediaClock, mediaTitle } from "./media.js";
import { SC_KINDS, cleanScore, scChase, scMatch, scOrder, scSeek } from "./scoredata.js";
import { still } from "./still.js";
import { tgGuest } from "./together.js";
import { WORLDS } from "./worlds.js";
export const SCORES_MAX=24;  /* the most scores kept */
export const scores=[];      /* the scores kept in this browser, each as cleanScore passed it */
let use=null;                /* the score in use, or null */
/* where the playing is: the file it was last matched to (tok, dur), the track that file is (ti, -1 for none of them),
   that track's cues in order of asking (ord) and how many have been asked for (pi), the file's time at the last frame
   (last), and the changes asked for that are waiting for a transition to end (pend) */
const st={tok:-1,dur:0,ti:-1,ord:null,pi:0,last:-10,pend:[]};

export function scoreUse(){return use;}
/* The track of the score that is playing, and the time in it: {i, t}, or null while the file is none of them. */
export function scoreNow(){return use&&st.ti>=0&&st.ord?{i:st.ti,t:st.last}:null;}
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
function apply(k,v,now){
  var i;
  if(k==="journey"){jUse(v?findT(v):null);return true;} /* a template that is not here is none: nothing changes by chance */
  if(k==="world"&&now){i=worldIndex(v);if(i>=0&&WORLDS[i]!==scene.world)setWorldNow(i,true);return true;}
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
export function scoreClock(){
  var d,pos,c,want,i,k;
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
  st.last=pos;
  while(st.pend.length){c=st.pend[0];if(!apply(c.k,c.v,c.now))break;st.pend.shift();}
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
export const __dbg={SCORES_MAX, scores, scoreUse, scoreNow, scoreLabel:label, scoresSave, scoreAdd, scoreRemove, scoreSet, scoreWorldIndex:worldIndex, scoreApply:apply, scoreMatch:match, scoreClock, scoresAdopt, scoreSt:st};
