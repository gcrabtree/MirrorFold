import { $, errBox } from "./dom.js";
import { wakeHud } from "./input.js";
import { toast } from "./flight.js";
import { G } from "./shared.js";
export let ac, master, analyser, filt, fbins, scrubbing;
let bus, droneGain, sendIn, noiseBuf, audioEl, elNode, objUrl, scrub, scrubFill, scrubThumb, tLabel, scrubFr, lastSeek, elErr;

const drones=[];
const seq={on:false,timer:0,next:0,step:0,idx:3,root:0};
const PENT=[0,3,5,7,10],ROOTS=[0,-4,3,-2],BPM=92;
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
    filt=ac.createBiquadFilter();filt.type="lowpass";filt.frequency.value=420;filt.Q.value=4;filt.connect(bus);
    droneGain=ac.createGain();droneGain.gain.value=0;droneGain.connect(filt);
    var dly=ac.createDelay(1);dly.delayTime.value=60/BPM*0.75;var fb=ac.createGain();fb.gain.value=0.42;
    sendIn=ac.createGain();sendIn.gain.value=0.5;sendIn.connect(dly);dly.connect(fb);fb.connect(dly);dly.connect(bus);
    [[55,"sawtooth",.09,.05],[82.5,"sawtooth",.06,.071],[110.2,"sine",.12,.043],[165.1,"triangle",.07,.093],[220.6,"sine",.05,.127]].forEach(function(v){
      var o=ac.createOscillator();o.type=v[1];o.frequency.value=v[0];
      var g=ac.createGain();g.gain.value=v[2];
      var l=ac.createOscillator();l.frequency.value=v[3];var lg=ac.createGain();lg.gain.value=v[2]*0.8;
      l.connect(lg);lg.connect(g.gain);o.connect(g);g.connect(droneGain);o.start();l.start();
      drones.push({o:o,f:v[0]});
    });
    var n=Math.floor(ac.sampleRate*0.2);noiseBuf=ac.createBuffer(1,n,ac.sampleRate);
    var ch=noiseBuf.getChannelData(0);for(var i=0;i<n;i++)ch[i]=Math.random()*2-1;
    return true;
  }catch(e){ac=null;return false;}
}
function env(g,t,peak,dur){g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.006);g.gain.exponentialRampToValueAtTime(0.0005,t+dur);}
function kick(t,v){
  var o=ac.createOscillator(),g=ac.createGain();o.type="sine";
  o.frequency.setValueAtTime(125,t);o.frequency.exponentialRampToValueAtTime(42,t+0.12);
  env(g,t,v,0.3);o.connect(g);g.connect(bus);o.start(t);o.stop(t+0.32);
}
function bass(t,f){
  var o=ac.createOscillator(),g=ac.createGain();o.type="sine";o.frequency.value=f;
  env(g,t,0.22,1.5);o.connect(g);g.connect(bus);o.start(t);o.stop(t+1.55);
}
export function pluck(t,f){
  var o=ac.createOscillator(),g=ac.createGain();o.type="triangle";o.frequency.value=f;
  env(g,t,0.06,0.5);o.connect(g);g.connect(bus);g.connect(sendIn);o.start(t);o.stop(t+0.55);
}
function hat(t){
  var s=ac.createBufferSource(),h=ac.createBiquadFilter(),g=ac.createGain();s.buffer=noiseBuf;
  h.type="highpass";h.frequency.value=7000;env(g,t,0.02,0.05);s.connect(h);h.connect(g);g.connect(bus);s.start(t);s.stop(t+0.07);
}
function playStep(n,t){
  if(n%32===0){
    seq.root=ROOTS[(n/32)%ROOTS.length];
    var r=Math.pow(2,seq.root/12);
    drones.forEach(function(d){d.o.frequency.setTargetAtTime(d.f*r,t,1.2)});
  }
  if(n%2===0)kick(t,n%8===0?0.5:0.34);else hat(t);
  if(n%8===0)bass(t,55*Math.pow(2,seq.root/12));
  if(Math.random()<0.82){
    seq.idx=Math.max(0,Math.min(9,seq.idx+[-1,1,1,-1,2,-2,0][Math.floor(Math.random()*7)]));
    var semi=seq.root+PENT[seq.idx%5]+12*Math.floor(seq.idx/5);
    pluck(t,220*Math.pow(2,semi/12));
  }
}
function tick(){
  if(!seq.on||!ac||ac.state!=="running")return;
  var spb=60/BPM/2;
  if(seq.next<ac.currentTime)seq.next=ac.currentTime+0.05;
  while(seq.next<ac.currentTime+0.35){playStep(seq.step,seq.next);seq.next+=spb;seq.step++;}
}
export function startBuilt(){
  droneGain.gain.setTargetAtTime(1,ac.currentTime,1.5);
  if(seq.on)return;
  seq.on=true;seq.next=ac.currentTime+0.15;seq.timer=setInterval(tick,90);
}
export function stopBuilt(){
  if(droneGain)droneGain.gain.setTargetAtTime(0,ac.currentTime,0.2);
  seq.on=false;clearInterval(seq.timer);
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
  if(G.musicMode==="file")pPlay();
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

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
 /* the browser drops the wake lock when the page is hidden */

/* ---------- music ----------
   Three sources feed one pair of numbers the visuals read: beat (a pulse that decays) and level (how loud the low end is).
   built: a generative track made here. file: an audio file you pick. tap: no sound from this page, tempo from your taps.
   tab: the sound of another browser tab that you share. mic: the microphone. These two are only analysed, never played or kept. */
ac=null;
master=null;
bus=null;
analyser=null;
filt=null;
droneGain=null;
sendIn=null;
noiseBuf=null;
G.musicMode="off";
G.beat=0;
G.level=0;
fbins=null;
var bmax=.08;
var bavg=0;
audioEl=null,elNode=null,objUrl=null;
G.taps=[],G.tapInt=0,G.tapAt=0;
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
elErr=false;
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

/* for the test tools and the browser console: every name in this file, readable and (where it can change) settable */
export const __dbg={get ac(){return ac},set ac(v){ac=v}, get master(){return master},set master(v){master=v}, get bus(){return bus},set bus(v){bus=v}, get analyser(){return analyser},set analyser(v){analyser=v}, get filt(){return filt},set filt(v){filt=v}, get droneGain(){return droneGain},set droneGain(v){droneGain=v},
  get sendIn(){return sendIn},set sendIn(v){sendIn=v}, get noiseBuf(){return noiseBuf},set noiseBuf(v){noiseBuf=v}, get drones(){return drones}, get fbins(){return fbins},set fbins(v){fbins=v}, get audioEl(){return audioEl},set audioEl(v){audioEl=v}, get elNode(){return elNode},set elNode(v){elNode=v},
  get objUrl(){return objUrl},set objUrl(v){objUrl=v}, get seq(){return seq}, get PENT(){return PENT}, get ROOTS(){return ROOTS}, get BPM(){return BPM}, get cap(){return cap},
  get ensureAudio(){return ensureAudio}, get env(){return env}, get kick(){return kick}, get bass(){return bass}, get pluck(){return pluck}, get hat(){return hat},
  get playStep(){return playStep}, get tick(){return tick}, get startBuilt(){return startBuilt}, get stopBuilt(){return stopBuilt}, get player(){return player}, get scrub(){return scrub},set scrub(v){scrub=v},
  get scrubFill(){return scrubFill},set scrubFill(v){scrubFill=v}, get scrubThumb(){return scrubThumb},set scrubThumb(v){scrubThumb=v}, get tLabel(){return tLabel},set tLabel(v){tLabel=v}, get scrubbing(){return scrubbing},set scrubbing(v){scrubbing=v}, get scrubFr(){return scrubFr},set scrubFr(v){scrubFr=v}, get lastSeek(){return lastSeek},set lastSeek(v){lastSeek=v},
  get mmss(){return mmss}, get pDur(){return pDur}, get pPos(){return pPos}, get pIsPlaying(){return pIsPlaying}, get pPlay(){return pPlay}, get pPause(){return pPause},
  get pSeek(){return pSeek}, get syncPlayBtn(){return syncPlayBtn}, get showScrub(){return showScrub}, get scrubAt(){return scrubAt}, get scrubEnd(){return scrubEnd}, get fileReady(){return fileReady},
  get elErr(){return elErr},set elErr(v){elErr=v}, get prepElement(){return prepElement}, get showElError(){return showElError}, get useElement(){return useElement}, get DECODE_MAX_SEC(){return DECODE_MAX_SEC}, get DECODE_MAX_BYTES(){return DECODE_MAX_BYTES},
  get decodeFile(){return decodeFile}, get showScrubIdle(){return showScrubIdle}};
