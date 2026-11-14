/* Record video: the picture as it plays, and the sound the app itself is making, saved as a video file when stopped. */
import { ac, master } from "./audio.js";
import { scene } from "./choose.js";
import { $, canvas, toast } from "./dom.js";
import { press, wakeHud } from "./input.js";
export const REC_MAX=300;  /* seconds: the recording is held in memory until it is saved, so it stops itself after five minutes */
export const REC_TYPES=["video/mp4;codecs=avc1.42E01E,mp4a.40.2","video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm","video/mp4"];
let rec=null,parts=[],t0=0,timer=0,sndTap=null;

/* the first kind of video file this browser can record, or "" */
export function recType(can){for(var i=0;i<REC_TYPES.length;i++)if(can(REC_TYPES[i]))return REC_TYPES[i];return "";}
export function recClock(s){s=Math.max(0,Math.floor(s));return Math.floor(s/60)+":"+("0"+s%60).slice(-2);}
export function recording(){return !!rec;}
function recLabel(){
  var s=(performance.now()-t0)/1000;
  $("bRec").textContent=rec?"Stop recording "+recClock(s):"Record video";
  if(rec&&s>=REC_MAX){recStop();toast("Recording stopped at five minutes and saved.");}
}
export function recStart(){
  if(rec)return true;
  var type=recType(function(t){return MediaRecorder.isTypeSupported(t)}),stream;
  try{
    stream=canvas.captureStream(30);
    /* the app's own sound, if it is playing: the built-in music, the user's file or their video. Sound it only listens to (a tab, the microphone) is not played, so it is not recorded either. */
    if(ac&&ac.state==="running"&&master&&ac.createMediaStreamDestination){
      sndTap=ac.createMediaStreamDestination();master.connect(sndTap);
      sndTap.stream.getAudioTracks().forEach(function(tk){stream.addTrack(tk)});
    }
    rec=new MediaRecorder(stream,type?{mimeType:type,videoBitsPerSecond:8000000}:{videoBitsPerSecond:8000000});
  }catch(e){rec=null;untap();toast("This browser cannot record the picture.");return false;}
  parts=[];
  rec.ondataavailable=function(e){if(e.data&&e.data.size)parts.push(e.data)};
  rec.onstop=function(){recSave(new Blob(parts,{type:(rec&&rec.mimeType)||type||"video/webm"}));parts=[];rec=null;untap();clearInterval(timer);press($("bRec"),false);recLabel();};
  rec.onerror=function(){toast("The recording failed.");recStop();};
  rec.start(1000);t0=performance.now();timer=setInterval(recLabel,500);press($("bRec"),true);recLabel();
  return true;
}
export function recStop(){if(rec&&rec.state!=="inactive")rec.stop();}
function untap(){if(sndTap){try{master.disconnect(sndTap)}catch(_){}sndTap=null;}}
function recSave(blob){
  if(!blob.size){toast("Nothing was recorded.");return;}
  var a=document.createElement("a"),url=URL.createObjectURL(blob);
  a.href=url;a.download="mirrorfold-"+scene.world.id+(/mp4/.test(blob.type)?".mp4":".webm");document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(function(){URL.revokeObjectURL(url)},10000);
  toast("Video saved: "+recClock((performance.now()-t0)/1000)+".");
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
var b=$("bRec");
if(!(canvas.captureStream&&window.MediaRecorder)){b.hidden=true;return;} /* no recorder in this browser: no button */
b.addEventListener("click",function(){
  if(rec)recStop();else if(recStart())toast("Recording. The controls are not in the video. It stops itself after five minutes.");
  wakeHud();
});
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={REC_MAX, REC_TYPES, recType, recClock, recording, recLabel, recStart, recStop, untap, recSave,
  get rec(){return rec},set rec(v){rec=v}, get parts(){return parts},set parts(v){parts=v}, get t0(){return t0},set t0(v){t0=v}, get timer(){return timer},set timer(v){timer=v}, get sndTap(){return sndTap},set sndTap(v){sndTap=v}};
