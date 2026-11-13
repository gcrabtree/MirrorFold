import { $, errBox, isTouch } from "./dom.js";
import { selMusic } from "./choose.js";
import { ac, analyser, cap, ensureAudio, fbins, master, pPause, pPlay, player, startBuilt, stopBuilt } from "./audio.js";
import { toast } from "./flight.js";
import { wakeHud } from "./input.js";
import { G } from "./shared.js";
export let soundChanged;
let canTab, canMic, detectChange;

function stopListening(){
  cap.tok++;
  if(cap.node){try{cap.node.disconnect()}catch(_){}}
  if(cap.stream){cap.stream.getTracks().forEach(function(t){t.onended=null;try{t.stop()}catch(_){}});}
  cap.node=null;cap.stream=null;
  if(master)master.gain.value=0.5;
}
function startListening(mode){
  var tk=++cap.tok,plain={echoCancellation:false,noiseSuppression:false,autoGainControl:false},ask;
  var fail=function(msg){if(tk!==cap.tok)return;setMusic("off");toast(msg);};
  try{
    if(mode==="tab")ask=navigator.mediaDevices.getDisplayMedia({video:{width:{max:320},height:{max:180},frameRate:{max:1}},audio:plain,systemAudio:"include",selfBrowserSurface:"exclude"});
    else ask=navigator.mediaDevices.getUserMedia({audio:plain});
  }catch(e){fail(mode==="tab"?"This browser cannot share a tab's sound.":"This browser cannot use the microphone here.");return;}
  ask.then(function(stream){
    if(tk!==cap.tok){stream.getTracks().forEach(function(t){t.stop()});return;} /* the music setting changed while the browser was asking */
    if(!stream.getAudioTracks().length){
      stream.getTracks().forEach(function(t){t.stop()});
      fail("That share has no sound. Choose a tab and turn on \"Also share tab audio\".");return;
    }
    cap.stream=stream;
    stream.getTracks().forEach(function(t){t.onended=function(){fail(mode==="tab"?"Stopped listening to the tab":"The microphone stopped")};});
    if(!cap.gain){cap.gain=ac.createGain();cap.gain.connect(analyser);}
    cap.gain.gain.value=mode==="mic"?3:1; /* a microphone across a room is much quieter than a tab */
    master.gain.value=0;
    cap.node=ac.createMediaStreamSource(stream);cap.node.connect(cap.gain);
    try{ac.resume()}catch(_){}
    toast(mode==="tab"?"Listening to the shared tab":"Listening to the microphone");
  }).catch(function(){fail(mode==="tab"?"No tab was shared":"Microphone access was refused")});
}
function listening(){return (G.musicMode==="tab"||G.musicMode==="mic")&&!!cap.node;}
export function setMusic(mode){
  if((mode==="tab"&&!canTab)||(mode==="mic"&&!canMic))mode="off";
  if(mode!=="off"&&mode!=="tap"&&!ensureAudio()){mode="off";errBox.textContent="This browser cannot play audio here.";}
  if(cap.stream||G.musicMode==="tab"||G.musicMode==="mic")stopListening();
  G.musicMode=mode;selMusic.value=mode;
  $("rowTap").hidden=mode!=="tap";$("rowFile").hidden=mode!=="file";
  try{
    if(mode==="built"){pPause();ac.resume();startBuilt();}
    else if(mode==="file"){stopBuilt();ac.resume();if(player.mode)pPlay();}
    else if(mode==="tab"||mode==="mic"){stopBuilt();pPause();ac.resume();startListening(mode);}
    else{ /* off and tap make no sound: release the audio session so music from another app keeps playing */
      if(ac){stopBuilt();pPause();ac.suspend();}
    }
  }catch(_){}
  if(mode!=="tap"){G.taps=[];G.tapInt=0;$("bTap").textContent="Tap the beat";}
  G.beat=0;G.level=0;
}
export function tap(){
  var now=performance.now()/1000;
  if(G.taps.length&&now-G.taps[G.taps.length-1]>2.2)G.taps=[];
  G.taps.push(now);if(G.taps.length>6)G.taps.shift();
  G.tapAt=now;bands.b.p=1;
  if(G.taps.length>=2){
    var iv=(G.taps[G.taps.length-1]-G.taps[0])/(G.taps.length-1);
    while(iv<0.36)iv*=2; /* keep pulses slow: faster than about 165 bpm is halved */
    G.tapInt=iv;$("bTap").textContent=Math.round(60/iv)+" bpm, tap to adjust";
  }else{$("bTap").textContent="Keep tapping";}
}
/* Three bands, each with a level (how loud, smoothed) and a pulse (a hit that decays).
   Bass drives zoom kicks, bloom and field of view. Mids drive morphing, rotation, wobble and the glowing bands.
   Treble drives highlights, colour fringing, colour drift and the small overlay lights. */
export const bands={b:{lv:0,p:0,mx:.08,av:0,fl:.08},m:{lv:0,p:0,mx:.05,av:0,fl:.05},t:{lv:0,p:0,mx:.03,av:0,fl:.03}};
function bandStep(o,raw,dt,gain){
  o.mx=Math.max(o.mx*0.9995,raw,o.fl);var x=raw/o.mx;
  o.av+=(x-o.av)*Math.min(1,dt*1.2);
  o.p=Math.max(o.p*Math.exp(-dt*5),Math.min(1,Math.max(0,(x-o.av)*gain)));
  o.lv+=(x-o.lv)*Math.min(1,dt*(x>o.lv?10:2));
}
function bandAvg(a,b){var t=0;for(var i=a;i<=b;i++)t+=fbins[i];return t/((b-a+1)*255);}
export function liveAudio(){return (G.musicMode==="built"||G.musicMode==="file"||listening())&&!!analyser&&!!ac&&ac.state==="running";}
/* A major change in the sound: the last second or so differs sharply from the last several, in loudness or in
   the balance of low to high. It fires once, then takes the new sound as normal. */
function makeChangeDetector(){
  var sE=0,lE=0,sB=0,lB=0,age=0,hold=0,first=true;
  return function(dt,e,bal){
    if(first){sE=lE=e;sB=lB=bal;first=false;}
    age+=dt;
    var a=Math.min(1,dt/0.8),b=Math.min(1,dt/8);
    sE+=(e-sE)*a;sB+=(bal-sB)*a;
    if(hold>0){hold-=dt;lE=sE;lB=sB;return false;} /* just fired: let the new sound settle in as the baseline */
    lE+=(e-lE)*b;lB+=(bal-lB)*b;
    if(age<5)return false;
    var nov=Math.abs(sE-lE)/Math.max(sE,lE,0.03)+2.2*Math.abs(sB-lB);
    if(nov>0.45){hold=4;return true;}
    return false;
  };
}
export function readMusic(dt){
  soundChanged=false;var k,o;
  if(G.musicMode==="tap"&&G.tapInt>0){ /* no sound to read: bass on the beat, mids between beats, treble twice a beat */
    var ph=((performance.now()/1000-G.tapAt)/G.tapInt)%1;
    bands.b.p=Math.exp(-ph*4.5);bands.b.lv=0.45;
    bands.m.p=0.7*Math.exp(-((ph+0.5)%1)*5);bands.m.lv=0.35;
    bands.t.p=0.5*Math.exp(-((ph*2)%1)*6);bands.t.lv=0.3;
  }else if(liveAudio()){
    analyser.getByteFrequencyData(fbins);
    var rb=bandAvg(1,4),rm=bandAvg(6,45),rt=bandAvg(60,250); /* roughly below 200 Hz, 250 Hz to 2 kHz, above 2.5 kHz */
    bandStep(bands.b,rb,dt,3.2);bandStep(bands.m,rm,dt,4);bandStep(bands.t,rt,dt,4.5);
    soundChanged=detectChange(dt,0.5*rb+0.35*rm+0.15*rt,(rt+0.5*rm)/(rb+rm+rt+0.001));
  }else{for(k in bands){o=bands[k];o.p*=Math.exp(-dt*5);o.lv*=Math.exp(-dt*2);}}
  G.beat=bands.b.p;G.level=bands.b.lv;
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
/* ---------- listening: another tab's sound, or the microphone ----------
   The sound goes into the analyser so the picture can react. The output is muted while listening, so it is never
   played back: a shared tab keeps playing from its own tab, and a microphone would howl. */
canTab=!isTouch&&!!(navigator.mediaDevices&&navigator.mediaDevices.getDisplayMedia);
canMic=!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia);
(function(){
  var o=selMusic.options,i;
  for(i=o.length-1;i>=0;i--){if((o[i].value==="tab"&&!canTab)||(o[i].value==="mic"&&!canMic))selMusic.remove(i);}
})();
selMusic.addEventListener("change",function(){setMusic(this.value);wakeHud()});
/* a dropdown change may not count as a tap for the browser's audio rules, so any later tap unlocks sound */
document.addEventListener("pointerdown",function(){
  if(ac&&ac.state==="suspended"&&G.musicMode!=="off"&&G.musicMode!=="tap"){try{ac.resume()}catch(_){}}
},true);
$("bTap").addEventListener("pointerdown",function(e){e.preventDefault();tap();wakeHud()});
soundChanged=false,detectChange=makeChangeDetector();
}

/* for the test tools and the browser console: every name in this file, readable and (where it can change) settable */
export const __dbg={get canTab(){return canTab},set canTab(v){canTab=v}, get canMic(){return canMic},set canMic(v){canMic=v}, get stopListening(){return stopListening}, get startListening(){return startListening}, get listening(){return listening}, get setMusic(){return setMusic},
  get tap(){return tap}, get bands(){return bands}, get bandStep(){return bandStep}, get bandAvg(){return bandAvg}, get liveAudio(){return liveAudio}, get makeChangeDetector(){return makeChangeDetector},
  get soundChanged(){return soundChanged},set soundChanged(v){soundChanged=v}, get detectChange(){return detectChange},set detectChange(v){detectChange=v}, get readMusic(){return readMusic}};
