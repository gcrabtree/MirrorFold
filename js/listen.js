/* Sound in: choosing where the music comes from, listening to a tab or the microphone, tap tempo, and reading the sound each frame. */
import { ac, analyser, cap, ensureAudio, fbins, master, pPause, pPlay, player, startBuilt, stopBuilt } from "./audio.js";
import { selMusic } from "./choose.js";
import { clock } from "./clock.js";
import { $, calm, errBox, gl, isTouch, toast } from "./dom.js";
import { wakeHud } from "./input.js";
import { OVERLAYS, sel } from "./state.js";
export let musicMode="off",beat=0,level=0; /* where the sound comes from, and the two numbers the picture reads: a pulse that decays, and how loud the low end is */
let taps=[],tapInt=0,tapAt=0;
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
function listening(){return (musicMode==="tab"||musicMode==="mic")&&!!cap.node;}
export function setMusic(mode){
  if((mode==="tab"&&!canTab)||(mode==="mic"&&!canMic))mode="off";
  if(mode!=="off"&&mode!=="tap"&&!ensureAudio()){mode="off";errBox.textContent="This browser cannot play audio here.";}
  if(cap.stream||musicMode==="tab"||musicMode==="mic")stopListening();
  musicMode=mode;selMusic.value=mode;
  $("rowTap").hidden=mode!=="tap";$("rowFile").hidden=mode!=="file";
  try{
    if(mode==="built"){pPause();ac.resume();startBuilt();}
    else if(mode==="file"){stopBuilt();ac.resume();if(player.mode)pPlay();}
    else if(mode==="tab"||mode==="mic"){stopBuilt();pPause();ac.resume();startListening(mode);}
    else{ /* off and tap make no sound: release the audio session so music from another app keeps playing */
      if(ac){stopBuilt();pPause();ac.suspend();}
    }
  }catch(_){}
  if(mode!=="tap"){taps=[];tapInt=0;$("bTap").textContent="Tap the beat";}
  beat=0;level=0;
}
export function tap(){
  var now=performance.now()/1000;
  if(taps.length&&now-taps[taps.length-1]>2.2)taps=[];
  taps.push(now);if(taps.length>6)taps.shift();
  tapAt=now;bands.b.p=1;
  if(taps.length>=2){
    var iv=(taps[taps.length-1]-taps[0])/(taps.length-1);
    while(iv<0.36)iv*=2; /* keep pulses slow: faster than about 165 bpm is halved */
    tapInt=iv;$("bTap").textContent=Math.round(60/iv)+" bpm, tap to adjust";
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
export function liveAudio(){return (musicMode==="built"||musicMode==="file"||listening())&&!!analyser&&!!ac&&ac.state==="running";}
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
  if(musicMode==="tap"&&tapInt>0){ /* no sound to read: bass on the beat, mids between beats, treble twice a beat */
    var ph=((performance.now()/1000-tapAt)/tapInt)%1;
    bands.b.p=Math.exp(-ph*4.5);bands.b.lv=0.45;
    bands.m.p=0.7*Math.exp(-((ph+0.5)%1)*5);bands.m.lv=0.35;
    bands.t.p=0.5*Math.exp(-((ph*2)%1)*6);bands.t.lv=0.3;
  }else if(liveAudio()){
    analyser.getByteFrequencyData(fbins);
    var rb=bandAvg(1,4),rm=bandAvg(6,45),rt=bandAvg(60,250); /* roughly below 200 Hz, 250 Hz to 2 kHz, above 2.5 kHz */
    bandStep(bands.b,rb,dt,3.2);bandStep(bands.m,rm,dt,4);bandStep(bands.t,rt,dt,4.5);
    soundChanged=detectChange(dt,0.5*rb+0.35*rm+0.15*rt,(rt+0.5*rm)/(rb+rm+rt+0.001));
  }else{for(k in bands){o=bands[k];o.p*=Math.exp(-dt*5);o.lv*=Math.exp(-dt*2);}}
  beat=bands.b.p;level=bands.b.lv;
}

/* Read the sound for this frame into fr: the beat pulse and low-end level, the mids' pulse and level, the treble's pulse and level. Turned down when reduced motion is asked for. */
export function soundFrame(fr){
  readMusic(fr.dt);
  var react=calm?0.25:1;
  fr.bt=beat*react;fr.lv=level*react;
  fr.mp=bands.m.p*react;fr.mv=bands.m.lv*react;fr.hp=bands.t.p*react;fr.hv=bands.t.lv*react;
}
export let waveTex=null,tbins=null;        /* the sound's wave as a small picture for the overlays, and the samples it is made from */
export const waveBuf=new Uint8Array(128);
export function updateWave(){
  var i,live=liveAudio();
  if(OVERLAYS[sel.ovi].spec||OVERLAYS[sel.ovi].sound==="bands"){ /* frequency bands, low to high */
    if(live){for(i=0;i<128;i++)waveBuf[i]=fbins[1+i*2];}
    else{for(i=0;i<128;i++)waveBuf[i]=255*(0.18+0.6*beat)*Math.abs(Math.sin(i*0.21+clock.time*1.3)*Math.sin(i*0.047-clock.time*0.6));}
  }else if(live){
    if(!tbins)tbins=new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(tbins);
    for(i=0;i<128;i++)waveBuf[i]=Math.max(0,Math.min(255,128+(tbins[i*4]-128)*2.2));
  }else{ /* no sound to read: a soft shape that swells on the beat */
    for(i=0;i<128;i++)waveBuf[i]=128+(18+80*beat)*Math.sin(i*0.33+clock.time*3.1)*Math.sin(i*0.05+clock.time*0.7);
  }
  if(!waveTex){
    waveTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,waveTex);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  }else gl.bindTexture(gl.TEXTURE_2D,waveTex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.LUMINANCE,128,1,0,gl.LUMINANCE,gl.UNSIGNED_BYTE,waveBuf);
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
  if(ac&&ac.state==="suspended"&&musicMode!=="off"&&musicMode!=="tap"){try{ac.resume()}catch(_){}}
},true);
$("bTap").addEventListener("pointerdown",function(e){e.preventDefault();tap();wakeHud()});
soundChanged=false,detectChange=makeChangeDetector();
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={stopListening, startListening, listening, setMusic, tap, bands, bandStep, bandAvg, liveAudio, makeChangeDetector,
  readMusic, soundFrame, waveBuf, updateWave, get musicMode(){return musicMode},set musicMode(v){musicMode=v}, get beat(){return beat},set beat(v){beat=v}, get level(){return level},set level(v){level=v}, get taps(){return taps},set taps(v){taps=v}, get tapInt(){return tapInt},set tapInt(v){tapInt=v}, get tapAt(){return tapAt},set tapAt(v){tapAt=v},
  get soundChanged(){return soundChanged},set soundChanged(v){soundChanged=v}, get canTab(){return canTab},set canTab(v){canTab=v}, get canMic(){return canMic},set canMic(v){canMic=v}, get detectChange(){return detectChange},set detectChange(v){detectChange=v}, get waveTex(){return waveTex},set waveTex(v){waveTex=v}, get tbins(){return tbins},set tbins(v){tbins=v}};
