/* Sound out: the audio graph, the built-in music, and the player and scrubber for a file of your own. */
import { $, errBox, toast } from "./dom.js";
import { wakeHud } from "./input.js";
import { musicMode } from "./listen.js";
export let ac=null, master=null, analyser=null, fbins=null, scrubbing;
export let bus=null, audioEl=null, elNode=null, objUrl=null, scrub, scrubFill, scrubThumb,
  tLabel, scrubFr, lastSeek, elErr=false;

export const cap={stream:null,node:null,gain:null,tok:0};

export function ensureAudio(){
  if(ac)return true;
  var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;
  try{
    ac=new AC();
    master=ac.createGain();master.gain.value=0.5;master.connect(ac.destination);
    analyser=ac.createAnalyser();analyser.fftSize=1024;analyser.smoothingTimeConstant=0.6;analyser.connect(master);
    fbins=new Uint8Array(analyser.frequencyBinCount);
    bus=ac.createGain();bus.gain.value=1;bus.connect(analyser);
    return true;
  }catch(e){ac=null;return false;}
}
/* a short soft note: the chime when an orb is found */
export function pluck(t,f){
  var o=ac.createOscillator(),g=ac.createGain();o.type="triangle";o.frequency.value=f;
  g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(0.06,t+0.006);g.gain.exponentialRampToValueAtTime(0.0005,t+0.5);
  o.connect(g);g.connect(bus);o.start(t);o.stop(t+0.55);
}
/* File playback. The file is decoded into memory and played from a buffer, so seeking is exact and instant.
   Very large files, or ones that fail to decode, fall back to a streaming audio element. */
export const player={mode:null,buf:null,src:null,offset:0,startAt:0,playing:false,token:0};
function mmss(x){x=Math.max(0,Math.floor(x||0));var sec=x%60;return Math.floor(x/60)+":"+(sec<10?"0":"")+sec;}
export function pDur(){
  if(player.mode==="buf")return player.buf.duration;
  if(player.mode==="el"&&audioEl&&isFinite(audioEl.duration))return audioEl.duration;
  return 0;
}
export function pPos(){
  if(player.mode==="buf"){var d=player.buf.duration;return player.playing?((player.offset+ac.currentTime-player.startAt)%d):player.offset;}
  if(player.mode==="el"&&audioEl)return audioEl.currentTime||0;
  return 0;
}
function pIsPlaying(){return player.mode==="buf"?player.playing:(player.mode==="el"&&audioEl&&!audioEl.paused);}
export function pPlay(){
  if(player.mode==="buf"){
    if(player.playing)return;
    var src=ac.createBufferSource();src.buffer=player.buf;src.loop=true;src.connect(bus);
    src.start(0,player.offset%player.buf.duration);
    player.src=src;player.startAt=ac.currentTime;player.playing=true;
  }else if(player.mode==="el"&&audioEl){
    var pr=audioEl.play();if(pr&&pr.then)pr.then(syncPlayBtn,syncPlayBtn);
  }
  syncPlayBtn();
}
export function pPause(){
  if(player.mode==="buf"){
    if(!player.playing)return;
    player.offset=pPos();player.playing=false;
    try{player.src.stop()}catch(_){}
    try{player.src.disconnect()}catch(_){}
    player.src=null;
  }else if(player.mode==="el"&&audioEl){audioEl.pause();}
  syncPlayBtn();
}
function pSeek(t){
  var d=pDur();if(!(d>0))return;
  t=Math.max(0,Math.min(d-0.05,t));
  if(player.mode==="buf"){
    var was=player.playing;
    if(was)pPause();
    player.offset=t;
    if(was)pPlay();
  }else if(audioEl){try{audioEl.currentTime=t}catch(_){}}
}
function syncPlayBtn(){$("bPlay").textContent=pIsPlaying()?"Pause":"Play";}
export function showScrub(fr){
  var d=pDur(),pc=(Math.max(0,Math.min(1,fr))*100);
  scrubFill.style.width=pc+"%";scrubThumb.style.left=pc+"%";
  scrub.setAttribute("aria-valuenow",String(Math.round(pc)));
  tLabel.textContent=mmss(fr*d)+" / "+mmss(d);
}
function scrubAt(e){var r=scrub.getBoundingClientRect();return Math.max(0,Math.min(1,(e.clientX-r.left)/Math.max(1,r.width)));}
function scrubEnd(){
  if(!scrubbing)return;
  scrubbing=false;pSeek(scrubFr*pDur());wakeHud();
}
function fileReady(){
  $("bPlay").hidden=false;$("scrubWrap").hidden=false;showScrub(0);
  if(musicMode==="file")pPlay();
  syncPlayBtn();wakeHud();
}
function prepElement(f){
  if(!audioEl){
    audioEl=new Audio();audioEl.loop=true;audioEl.preload="auto";
    audioEl.addEventListener("error",function(){elErr=true;if(player.mode==="el")showElError();});
    audioEl.addEventListener("loadedmetadata",function(){if(player.mode==="el")showScrub(0)});
    audioEl.addEventListener("durationchange",function(){if(player.mode==="el"&&!scrubbing&&pDur()>0)showScrub(pPos()/pDur())});
    try{elNode=ac.createMediaElementSource(audioEl);elNode.connect(bus);}catch(e){}
  }
  if(objUrl){try{URL.revokeObjectURL(objUrl)}catch(_){}}
  elErr=false;objUrl=URL.createObjectURL(f);audioEl.src=objUrl;
  try{audioEl.load()}catch(_){}
}
function showElError(){errBox.textContent="That file would not play. Use an MP3 or M4A you own. Apple Music downloads are locked and will not load.";}
function useElement(tk,why){
  if(tk!==player.token)return;
  player.mode="el";
  if(elErr){showElError();tLabel.textContent="0:00 / 0:00";return;}
  if(why)toast(why);
  fileReady();
}
/* Decoding a whole file into memory makes seeking exact, but a long recording is far too big to hold that way:
   an hour of stereo sound is over a gigabyte once decoded, and the browser quietly cuts it short.
   So the length is read first; anything over 15 minutes plays as a stream instead. */
const DECODE_MAX_SEC=900,DECODE_MAX_BYTES=80e6;
function decodeFile(f,tk,dur){
  var rd=new FileReader();
  rd.onerror=function(){useElement(tk)};
  rd.onload=function(){
    if(tk!==player.token)return;
    try{
      var pr=ac.decodeAudioData(rd.result,function(ab){
        if(tk!==player.token)return;
        if(dur>0&&ab.duration<dur*0.97){useElement(tk,"Streaming this file so none of it is cut off.");return;} /* decoded short: do not trust it */
        player.mode="buf";player.buf=ab;player.offset=0;player.playing=false;fileReady();
      },function(){useElement(tk)});
      if(pr&&pr.catch)pr.catch(function(){});
    }catch(e){useElement(tk);}
  };
  rd.readAsArrayBuffer(f);
}
function showScrubIdle(){scrubFill.style.width="0%";scrubThumb.style.left="0%";}

/* While a file plays, keep the scrubber at the playing position. */
export function scrubFollow(){
  if(musicMode==="file"&&player.mode&&!scrubbing&&pDur()>0)showScrub(pPos()/pDur());
}



/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
 /* the browser drops the wake lock when the page is hidden */

/* ---------- music ----------
   Three sources feed one pair of numbers the visuals read: beat (a pulse that decays) and level (how loud the low end is).
   built: a generative track made here. file: an audio file you pick. tap: no sound from this page, tempo from your taps.
   tab: the sound of another browser tab that you share. mic: the microphone. These two are only analysed, never played or kept. */

scrub=$("scrub"),scrubFill=$("scrubFill"),scrubThumb=$("scrubThumb"),tLabel=$("tLabel"),scrubbing=false,scrubFr=0,lastSeek=0;
scrub.addEventListener("pointerdown",function(e){
  if(!(pDur()>0))return;
  e.preventDefault();e.stopPropagation();
  scrubbing=true;try{scrub.setPointerCapture(e.pointerId)}catch(_){}
  scrubFr=scrubAt(e);showScrub(scrubFr);wakeHud();
});
scrub.addEventListener("pointermove",function(e){
  if(!scrubbing)return;
  e.preventDefault();scrubFr=scrubAt(e);showScrub(scrubFr);wakeHud();
  var now=performance.now();
  if(now-lastSeek>150){lastSeek=now;pSeek(scrubFr*pDur());} /* you hear where you are while dragging */
});
scrub.addEventListener("pointerup",scrubEnd);
scrub.addEventListener("pointercancel",scrubEnd);
scrub.addEventListener("lostpointercapture",scrubEnd);
scrub.addEventListener("keydown",function(e){
  var stp=e.code==="ArrowRight"?5:(e.code==="ArrowLeft"?-5:0);
  if(!stp)return;
  e.preventDefault();e.stopPropagation();pSeek(pPos()+stp);wakeHud();
});
$("fileIn").addEventListener("change",function(){
  var f=this.files&&this.files[0];if(!f)return;
  if(!ensureAudio()){errBox.textContent="This browser cannot play audio here.";return;}
  errBox.textContent="";
  pPause();if(audioEl)audioEl.pause();
  var tk=++player.token;player.mode=null;player.buf=null;player.offset=0;
  $("scrubWrap").hidden=false;$("bPlay").hidden=true;tLabel.textContent="Loading\u2026";showScrubIdle();
  try{ac.resume()}catch(_){}
  prepElement(f);
  var decided=false;
  var decide=function(){
    if(decided||tk!==player.token)return;decided=true;
    var dur=(audioEl&&isFinite(audioEl.duration)&&audioEl.duration>0)?audioEl.duration:0;
    var tooLong=dur>0?dur>DECODE_MAX_SEC:f.size>25e6;
    if(tooLong||f.size>DECODE_MAX_BYTES)useElement(tk,"Long file: streaming it rather than loading it whole.");
    else decodeFile(f,tk,dur);
  };
  audioEl.addEventListener("loadedmetadata",decide,{once:true});
  audioEl.addEventListener("error",decide,{once:true});
  setTimeout(decide,4000);
  wakeHud();
});
$("bPlay").addEventListener("click",function(){
  try{ac.resume()}catch(_){}
  if(pIsPlaying())pPause();else pPlay();
  wakeHud();
});
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={cap, ensureAudio, pluck, player, mmss, pDur, pPos, pIsPlaying, pPlay, pPause,
  pSeek, syncPlayBtn, showScrub, scrubAt, scrubEnd, fileReady, prepElement, showElError, useElement, DECODE_MAX_SEC,
  DECODE_MAX_BYTES, decodeFile, showScrubIdle, scrubFollow, get ac(){return ac},set ac(v){ac=v}, get master(){return master},set master(v){master=v}, get analyser(){return analyser},set analyser(v){analyser=v}, get fbins(){return fbins},set fbins(v){fbins=v}, get scrubbing(){return scrubbing},set scrubbing(v){scrubbing=v}, get bus(){return bus},set bus(v){bus=v},
  get audioEl(){return audioEl},set audioEl(v){audioEl=v}, get elNode(){return elNode},set elNode(v){elNode=v}, get objUrl(){return objUrl},set objUrl(v){objUrl=v}, get scrub(){return scrub},set scrub(v){scrub=v}, get scrubFill(){return scrubFill},set scrubFill(v){scrubFill=v}, get scrubThumb(){return scrubThumb},set scrubThumb(v){scrubThumb=v}, get tLabel(){return tLabel},set tLabel(v){tLabel=v}, get scrubFr(){return scrubFr},set scrubFr(v){scrubFr=v}, get lastSeek(){return lastSeek},set lastSeek(v){lastSeek=v}, get elErr(){return elErr},set elErr(v){elErr=v}};
