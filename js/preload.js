/* Getting ready ahead of need: the land's and the worlds' programs are made one at a time while the pictures go on,
   so that choosing one later does not make the page wait. */
import { scene } from "./choose.js";
import { $ } from "./dom.js";
import { landFinish, landKind, landReady, landStart } from "./land.js";
import { LK } from "./landscapes.js";
import { NWORLD } from "./pack-worlds.js";
import { build, buildReady, buildStart, par } from "./programs.js";
import { recording } from "./record.js";
import { still } from "./still.js";
import { WORLDS } from "./worlds.js";
export let preOn=false;      /* there is something left to get ready, and this browser can do it without the page waiting */
export let preSlow=false;    /* on this device the pictures stop while a program is made, so nothing more is made once the start card is left */
let list=[],at=0,cur=null,stalls=0;
const PRE_KEY="mirrorfold-preload"; /* kept while programs are being made; found still there at the next visit, the last visit ended in the middle */

/* The order things are got ready in, as ["land", number] and ["world", number]. The land comes first, because it takes
   the longest: the landscape in use, then the others in the order the button goes through them. Then the worlds, from the
   one after the world in use round to the one before it. */
export function preloadOrder(nLand,kind,nWorld,world){
  var out=[],i;
  for(i=0;i<nLand;i++)out.push(["land",(kind+i)%nLand]);
  for(i=1;i<nWorld;i++)out.push(["world",(world+i)%nWorld]);
  return out;
}
function note(){
  var el=$("preNote");
  el.hidden=!preOn;
  if(preOn)el.textContent="Getting the land and the other worlds ready: "+at+" of "+list.length+". You can enter now; it goes on in the background.";
}
function finish(){preOn=false;cur=null;try{localStorage.removeItem(PRE_KEY)}catch(_){}note();}
/* One step of a frame. rawDt is the true time since the last frame; started is whether the start card has been left. */
export function preloadFrame(rawDt,started){
  var it;
  if(!preOn)return;
  if(cur){
    /* a long gap between pictures while a program is being made means this chip cannot do both at once */
    if(started&&rawDt>0.25&&++stalls>=2)preSlow=true;
    if(!(cur[0]==="land"?landReady(cur[1]):buildReady(WORLDS[cur[1]])))return;
    try{if(cur[0]==="land")landFinish(cur[1]);else build(WORLDS[cur[1]]);}catch(_){} /* one that fails here is tried again, and reported, when it is chosen */
    cur=null;at++;note();
    return;
  }
  if(at>=list.length){finish();return;}
  if(started&&(preSlow||still||recording()))return; /* nothing that could make a recording or a held picture stutter */
  it=list[at];
  try{if(it[0]==="land"?landStart(it[1]):buildStart(WORLDS[it[1]]))cur=it;else{at++;note();}}catch(_){at++;}
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
/* Start getting things ready, if this browser and the last visit allow it. */
export function preloadBegin(){
  var died=false;
  if(!par||preOn)return; /* without the browser's help, making a program ahead of need would stop the pictures just as making it later does */
  try{died=localStorage.getItem(PRE_KEY)==="1";localStorage.removeItem(PRE_KEY);}catch(_){}
  if(died)return; /* the last visit ended while this was going on: leave it out this once */
  list=preloadOrder(LK.length,landKind,NWORLD,Math.max(0,WORLDS.indexOf(scene.world))%NWORLD);at=0;
  preOn=true;
  try{localStorage.setItem(PRE_KEY,"1")}catch(_){}
  note();
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
window.addEventListener("pagehide",function(){try{localStorage.removeItem(PRE_KEY)}catch(_){}}); /* leaving the page is not a crash */
preloadBegin();
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={preloadOrder, preloadFrame, preloadBegin, PRE_KEY, get preOn(){return preOn},set preOn(v){preOn=v}, get preSlow(){return preSlow},set preSlow(v){preSlow=v},
  get preList(){return list},set preList(v){list=v}, get preAt(){return at},set preAt(v){at=v}, get preCur(){return cur},set preCur(v){cur=v}, get preStalls(){return stalls},set preStalls(v){stalls=v}};
