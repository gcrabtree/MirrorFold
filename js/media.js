/* What was playing: the name of the music or video and the moment in it, noted when a picture, postcard or video is
   made, so that the scene can be had again with the same music at the same point.
   The page knows this only for what it plays itself: the built-in music (the song's number and the time in it), an
   audio file and a video file (the file's name and the time in it). Sound it only listens to, from another tab or app
   or the microphone, comes with no name, so there is a box to type one in (What's playing?); the time is then counted
   from when it was typed. A typed name is used in place of a file's name whenever there is one.
   Nothing here is sent anywhere. It goes only into what the user saves or shares, and not at all with the switch off. */
import { pPos, pSeek, player } from "./audio.js";
import { $, toast } from "./dom.js";
import { press, wakeHud } from "./input.js";
import { musicMode, tapBpm } from "./listen.js";
import { builtGo, builtNow } from "./music.js";
import { MEDIA_KINDS, cleanMedia, mediaLine } from "./packs.js";
import { vidOn, vidTime } from "./video.js";
export let mediaShare=true;  /* what was playing goes into what is saved and shared */
let note="",noteAt=0;        /* what the user typed for What's playing?, and when */
let fileName="",videoName=""; /* the audio file and the video file in use */
let due=null;                /* a moment in a file, waiting for that file to be chosen: its name and the time */

/* a file's name without its folder or its ending */
export function mediaTitle(name){return mediaLine(String(name||"").replace(/^.*[\\/]/,"").replace(/\.[A-Za-z0-9]{1,5}$/,""));}
export function mediaClock(s){s=Math.max(0,Math.floor(s||0));return Math.floor(s/60)+":"+("0"+s%60).slice(-2);}
/* What was playing, as a line to read: "Weird Fishes at 2:14", "the built-in music, song 123 at 0:40", "music at 96 beats a minute". "" for nothing worth saying. */
export function mediaText(m){
  var t="";
  if(!m)return "";
  if(m.title)t=m.title+(m.at!==undefined?" at "+mediaClock(m.at):"");
  else if(m.kind==="built"&&m.seed)t="the built-in music, song "+m.seed+" at "+mediaClock(m.at);
  else if(m.kind==="tap"&&m.bpm)t="music at "+m.bpm+" beats a minute";
  if(m.kind==="tap"&&m.bpm&&m.title)t+=", "+m.bpm+" beats a minute";
  if(m.video&&m.video.title&&m.video.title!==m.title)t+=(t?", with ":"")+"the video "+m.video.title+" at "+mediaClock(m.video.at);
  return t;
}
/* What was playing, as a piece of a file's name: lower-case letters, digits and hyphens, at most 48, with the time. "" for nothing. */
export function mediaSlug(m){
  var t=m&&m.title?m.title:m&&m.kind==="built"&&m.seed?"song "+m.seed:"";
  t=t.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,36).replace(/-+$/,"");
  if(!t)return "";
  return t+(m.at!==undefined?"-"+Math.floor(m.at/60)+"m"+("0"+Math.floor(m.at%60)).slice(-2)+"s":"");
}
/* What is playing now, or null if the switch is off or there is nothing to say. */
export function mediaNow(){
  var m=null,b,since=(Date.now()-noteAt)/1000;
  if(!mediaShare)return null;
  if(musicMode==="built"){b=builtNow();if(b)m={kind:"built",seed:b.seed,at:b.at};}
  else if(musicMode==="file"&&player.mode)m={kind:"file",title:mediaTitle(fileName),at:pPos()};
  else if(musicMode==="video"&&vidOn)m={kind:"video",title:mediaTitle(videoName),at:vidTime()};
  else if(musicMode==="tap"&&tapBpm()>0)m={kind:"tap",bpm:tapBpm()};
  if(note){
    if(!m||m.kind==="tap")m={kind:m?"tap":"note",title:note,at:Math.min(86400,since),bpm:m?m.bpm:undefined};
    else if(m.kind!=="built")m.title=note; /* a typed name stands in place of a file's, with the file's own time; the built-in music is its own */
  }
  if(m&&vidOn&&m.kind!=="video")m.video={title:mediaTitle(videoName),at:vidTime()};
  return cleanMedia(m);
}
/* the audio file and the video file tell this file their names as they are chosen */
export function mediaFile(name){
  fileName=String(name||"");
  if(due&&due.title&&mediaTitle(fileName)===due.title){var t=due.at;due=null;setTimeout(function(){pSeek(t);toast("Started the file at "+mediaClock(t)+", where the picture was made.");},1200);}
}
export function mediaVideo(name){videoName=String(name||"");}
/* A scene has been opened that says what was playing: say so, and where the page can, put the music at that moment.
   The built-in music is started again as that song at that time. A file is moved to the time if it is the one in
   use; if not, the time waits for a file of that name to be chosen. */
export function mediaGo(m){
  var t=mediaText(m);
  if(!m||!t)return;
  if(m.kind==="built"&&m.seed&&musicMode==="built"){builtGo(m.seed,m.at||0);toast("Made to "+t+". The same song is playing from there.");return;}
  if(m.kind==="file"&&m.title&&m.at!==undefined){
    if(musicMode==="file"&&player.mode&&mediaTitle(fileName)===m.title){pSeek(m.at);toast("Made to "+t+". The file is playing from there.");return;}
    due={title:m.title,at:m.at};
    toast("Made to "+t+". Choose that file under Music and it starts there.");return;
  }
  toast("Made to "+t+".");
}
function label(){
  $("bPlaying").textContent=note?"Playing: "+(note.length>24?note.slice(0,23)+"…":note):"What's playing?";
  $("bMediaShare").textContent="Music named in what I share: "+(mediaShare?"yes":"no");press($("bMediaShare"),mediaShare);
}
export function setNote(t){note=mediaLine(t);noteAt=Date.now();try{localStorage.setItem("mirrorfold-playing",note)}catch(_){}label();}
export function setMediaShare(on){mediaShare=!!on;try{localStorage.setItem("mirrorfold-media",mediaShare?"on":"off")}catch(_){}label();}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
var a="",b="";
try{a=localStorage.getItem("mirrorfold-playing")||"";b=localStorage.getItem("mirrorfold-media")||""}catch(_){}
note=mediaLine(a);noteAt=Date.now();mediaShare=b!=="off";label();
$("bPlaying").addEventListener("click",function(){
  var t=null;
  try{t=window.prompt("What is playing? Type it as you want it shown, for example the artist and the song. Press OK just as the song starts and the time in it is kept too. Leave it empty for nothing.",note)}catch(_){}
  if(t===null){wakeHud();return;}
  setNote(t);
  toast(note?"Noted: "+note+". It goes with the pictures, postcards and videos you make, timed from now.":"Nothing is noted as playing.");wakeHud();
});
$("bMediaShare").addEventListener("click",function(){
  setMediaShare(!mediaShare);
  toast(mediaShare?"What is playing, and the moment in it, goes into the pictures, postcards and videos you make.":"Nothing about the music goes into what you make.");wakeHud();
});
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={mediaTitle, mediaClock, mediaText, mediaSlug, mediaNow, mediaFile, mediaVideo, mediaGo, mediaLabel:label, setNote, setMediaShare,
  get mediaShare(){return mediaShare},set mediaShare(v){mediaShare=v}, get mediaNote(){return note},set mediaNote(v){note=v}, get mediaNoteAt(){return noteAt},set mediaNoteAt(v){noteAt=v},
  get mediaDue(){return due},set mediaDue(v){due=v}};
