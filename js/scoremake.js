/* Making a score from the audio files chosen: each is listened to whole, ahead of playing (js/scoreanalyse.js), and a
   first draft is written from what was heard. The listening is done a slice at a time between frames, so the picture
   keeps moving. What was heard is kept while the page is open, for the composing screen to draw. Nothing of the music
   goes into the score but each track's name and length. */
import { ac, plCount, plFile } from "./audio.js";
import { $, toast } from "./dom.js";
import { wakeHud } from "./input.js";
import { findT, jPool } from "./journey.js";
import { mediaTitle } from "./media.js";
import { anDone, anStart, anStep, scDraft } from "./scoreanalyse.js";
import { cleanScore } from "./scoredata.js";
import { scoreAdd, scoreSet } from "./scoreplay.js";
export const HEAR_MAX_SEC=1500,HEAR_MAX_BYTES=120e6; /* a file longer or larger than this is not listened to ahead: decoded whole it would not fit in memory */
export const DRAFT_TPL={quiet:"Calm",mid:"Classic",full:"MilkDrop"}; /* the template a draft gives the quiet, middling and full parts of the music */
const heardOf={};   /* what was heard in each file, by its name and size */
let busy=false;     /* a draft is being made */
let stop=false;     /* the user has asked for it to be given up */

function key(f){return f.name+"|"+f.size;}
/* What was heard in a file, if it has been listened to: see anDone. */
export function heardFile(f){return f&&heardOf[key(f)]||null;}
/* A file's length in seconds without decoding it, or 0. */
function lengthOf(f){
  return new Promise(function(done){
    var a=new Audio(),url=URL.createObjectURL(f),end=function(d){try{URL.revokeObjectURL(url)}catch(_){}done(d>0&&isFinite(d)?d:0);};
    a.preload="metadata";
    a.addEventListener("loadedmetadata",function(){end(a.duration);});
    a.addEventListener("error",function(){end(0);});
    setTimeout(function(){end(0);},6000);
    a.src=url;
  });
}
function decode(f){
  return f.arrayBuffer().then(function(buf){
    return new Promise(function(ok,no){var p=ac.decodeAudioData(buf,ok,no);if(p&&p.catch)p.catch(function(){});});
  });
}
/* Listen to one file whole. say(part) is told how far it has got, 0 to 1. Gives what was heard, or {len} alone for a file too long to hear ahead, or null for one that cannot be read. */
export function hearFile(f,say){
  var k=key(f);
  if(heardOf[k])return Promise.resolve(heardOf[k]);
  return lengthOf(f).then(function(len){
    if(len>HEAR_MAX_SEC||f.size>HEAR_MAX_BYTES)return {len:len,far:true};
    return decode(f).then(function(ab){
      var n=ab.length,mono=new Float32Array(n),c,ch,i,S;
      for(c=0;c<ab.numberOfChannels;c++){ch=ab.getChannelData(c);for(i=0;i<n;i++)mono[i]+=ch[i]/ab.numberOfChannels;}
      S=anStart(mono,ab.sampleRate);
      return new Promise(function(done){
        (function slice(){
          var t0=performance.now();
          if(stop){done(null);return;}
          while(performance.now()-t0<12){if(anStep(S,40)){heardOf[k]=anDone(S);done(heardOf[k]);return;}}
          say(S.i/S.n);setTimeout(slice,0);
        })();
      });
    },function(){return len>0?{len:len,far:true}:null;});
  });
}
function pool(tier){var t=findT(DRAFT_TPL[tier]);return t?jPool("world",t.world):[];}
/* Draft a score for every file chosen, keep it and put it in use. */
export function draftAlbum(empty){
  var n=plCount(),tracks=[],used=[],i=0,b=$("bDraft"),name;
  if(busy){stop=true;return;}
  if(!n||!ac){toast("Choose the audio files first.");return;}
  busy=true;stop=false;
  var end=function(msg){busy=false;stop=false;b.textContent=$("stDraft").textContent="Draft a score";toast(msg);};
  (function next(){
    var f=plFile(i);
    if(stop){end("The draft was given up.");return;}
    if(i>=n){
      name=mediaTitle(plFile(0).name);
      var sc=cleanScore({name:n>1?("Album: "+name).slice(0,28):name,tracks:tracks});
      if(!sc){end("None of the files could be read, so there is no draft.");return;}
      if(!scoreAdd(sc)){end("There is no room for another score. Remove one first.");return;}
      scoreSet(sc);
      end((empty?"Started the score ":"Drafted the score ")+sc.name+": "+sc.tracks.length+(sc.tracks.length===1?" track, ":" tracks, ")+sc.tracks.reduce(function(a,t){return a+t.cues.length;},0)+" changes. It is in use.");
      return;
    }
    hearFile(f,function(part){b.textContent=$("stDraft").textContent="Listening: "+(i+1)+" of "+n+", "+Math.round(part*100)+"%. Press to give up";}).then(function(an){
      var d;
      if(an&&an.far)tracks.push({name:mediaTitle(f.name),len:an.len,cues:empty?[]:[[0,"journey",DRAFT_TPL.mid]]}); /* not heard ahead: left to the middling template all through */
      else if(an){d=scDraft(an,DRAFT_TPL,pool,Math.random,used);used=d.used;tracks.push({name:mediaTitle(f.name),len:an.len,marks:d.marks,cues:empty?[]:d.cues});}
      i++;next();
    },function(){i++;next();});
  })();
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
$("bDraft").addEventListener("click",function(){draftAlbum(false);wakeHud();});
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={HEAR_MAX_SEC, HEAR_MAX_BYTES, DRAFT_TPL, heardOf, heardFile, hearFile, draftAlbum, draftPool:pool, draftLengthOf:lengthOf,
  get draftBusy(){return busy},set draftBusy(v){busy=v}};
