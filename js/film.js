/* Filming a score: the playing track, or the whole album, drawn to a video file one picture at a time, with the music in
   it. It is not a recording of the screen. Each picture is drawn for its own moment of the music however long the
   drawing takes, so a slow computer makes the same film as a fast one, only later, and nothing is ever dropped.
   For each picture: the player's time is set to that moment, so the score makes its changes exactly there; the sound
   the picture hears is worked out from the file's own samples at that moment (js/scoreanalyse.js does the analyser's
   arithmetic), in place of the loudspeakers' sound; frame() draws; and the canvas is handed to the browser's video
   encoder. The music's samples go to its sound encoder, and js/webm.js writes both into a WebM file (VP9 or VP8
   pictures, Opus sound), straight to the disc where the browser lets a page do that, or else held in memory and
   saved at the end. Journey flies as ever, so two films of one score are two flights.
   Only the user's own files are ever filmed: the music comes from the files chosen, never from a tab or a microphone. */
import { ac, pHold, pPause, plAt, plCount, plFile, plGo, plPoint, player } from "./audio.js";
import { $, canvas, toast } from "./dom.js";
import { setSoundFeed } from "./listen.js";
import { frame } from "./loop.js";
import { mediaTitle } from "./media.js";
import { anLook, anStart } from "./scoreanalyse.js";
import { scoreUse } from "./scoreplay.js";
import { setStill, still } from "./still.js";
import { setFilmSize } from "./targets.js";
import { opusHead, webmStart } from "./webm.js";
export const FILM_SIZES=[["720p",1280,720],["1080p",1920,1080],["1440p",2560,1440],["4K",3840,2160]];
export const FILM_FPS=[30,60];
export const FILM_BPP=0.14;      /* bits for each pixel of each picture: about 17 million a second at 1080p and 60 pictures a second */
export const FILM_KEY_SEC=2;     /* a whole picture this often, so that a player can jump about */
export const FILM_MEM_MAX=1.5e9; /* where the file cannot be written straight to the disc it is held in memory, and the filming ends itself at this many bytes */
let job=null;                    /* the filming going on, or null */
let lastBlob=null;               /* the last film that was held in memory, for the test tools */

export function filming(){return !!job;}
/* Can this browser film at all? It needs the encoders (Chrome and Edge on a computer have them). */
export function filmCan(){return typeof VideoEncoder==="function"&&typeof VideoFrame==="function"&&typeof AudioEncoder==="function"&&typeof AudioData==="function";}
/* the codec string for VP9 at a size and rate: its level must be high enough for them */
export function filmCodec(w,h,fps){
  var px=w*h*fps,lv=px<=1280*720*30?"31":px<=1920*1080*30?"40":px<=1920*1080*60?"41":px<=2560*1440*60?"51":"52";
  return "vp09.00."+lv+".08";
}
export function filmBitrate(w,h,fps){return Math.round(Math.max(2e6,Math.min(80e6,w*h*fps*FILM_BPP)));}
/* What to say while filming: where it has got to, and how fast it is going against the music. */
export function filmLine(i,n,t,len,rate){
  var c=function(s){s=Math.max(0,Math.floor(s));return Math.floor(s/60)+":"+("0"+s%60).slice(-2);};
  return "Filming"+(n>1?" track "+(i+1)+" of "+n:"")+": "+c(t)+" of "+c(len)+(rate>0?", "+(rate>=1?(Math.round(rate*10)/10)+" times as fast as the music":"at "+Math.round(rate*100)+" hundredths of the music's speed"):"")+". Press Stop filming to end it there; what is made so far is kept.";
}

/* Where the bytes go. Straight into a file the user has named, where the browser can; else kept and handed over at the end. */
function diskSink(writable){
  var q=Promise.resolve(),pending=0,bad=null;
  return {
    write:function(b){pending+=b.length;q=q.then(function(){return writable.write(b);}).then(function(){pending-=b.length;},function(e){bad=e;});},
    patch:function(at,b){q=q.then(function(){return writable.write({type:"write",position:at,data:b});}).then(null,function(e){bad=e;});},
    waiting:function(){return pending;},
    failed:function(){return bad;},
    done:function(){return q.then(function(){return writable.close();});},
    size:function(){return 0;}
  };
}
function memSink(name){
  var parts=[],starts=[],n=0;
  return {
    write:function(b){starts.push(n);parts.push(b);n+=b.length;},
    patch:function(at,b){var i;for(i=0;i<parts.length;i++)if(at>=starts[i]&&at+b.length<=starts[i]+parts[i].length){parts[i].set(b,at-starts[i]);return;}},
    waiting:function(){return 0;},
    failed:function(){return null;},
    done:function(){
      var blob=new Blob(parts,{type:"video/webm"}),url=URL.createObjectURL(blob),a=document.createElement("a");
      lastBlob=blob;
      a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
      setTimeout(function(){URL.revokeObjectURL(url)},60000);
      return Promise.resolve();
    },
    size:function(){return n;}
  };
}
/* A file's sound at 48000 samples a second, which is what the sound encoder takes, whatever the page's own rate. */
function decode48(f){
  return f.arrayBuffer().then(function(buf){
    var oc=new (window.OfflineAudioContext||window.webkitOfflineAudioContext)(2,1,48000);
    return new Promise(function(ok,no){var p=oc.decodeAudioData(buf,ok,no);if(p&&p.catch)p.catch(function(){});});
  });
}
function say(text){$("stSay").textContent=text;$("stSay").title=text;}
/* put everything back as it was before the filming */
function restore(){
  var j=job,was;
  if(!j)return;
  was=j.was;job=null;
  setSoundFeed(null);pHold(false);setFilmSize(0,0);
  player.token++;player.mode=null;player.buf=null;player.offset=0;player.playing=false;
  plPoint(was.at);plGo(was.at); /* the track that was playing is loaded again, from its start */
  $("stFilm").textContent="Film this track";$("stFilmAll").textContent="Film the album";
}
function fail(msg){
  var j=job;
  if(!j)return;
  try{j.venc.close()}catch(_){}
  try{j.aenc.close()}catch(_){}
  restore();toast(msg);say(msg);
}
/* The filming is over, by its end or by Stop: let the encoders finish, close the file, and say what was made. */
function finish(){
  var j=job,ms;
  if(!j||j.ending)return;
  j.ending=true;ms=Math.round(j.n/j.fps*1000);
  Promise.all([j.venc.flush(),j.aenc.flush()]).then(function(){
    j.mux.end(ms);
    try{j.venc.close()}catch(_){}
    try{j.aenc.close()}catch(_){}
    return j.sink.done();
  }).then(function(){
    var bad=j.sink.failed(),secs=(performance.now()-j.began)/1000,msg;
    msg=bad?"The file could not be written to the end: "+(bad.message||bad):"The film is made: "+Math.floor(ms/60000)+":"+("0"+Math.floor(ms/1000)%60).slice(-2)+" of pictures at "+j.w+" by "+j.h+", "+j.fps+" a second, in "+Math.round(secs)+" seconds.";
    restore();toast(msg);say(msg);
  },function(e){fail("The film could not be finished: "+(e&&e.message||e));});
}
/* Begin on track number k of those to be filmed: read its file, and point the player and the sound at it. */
function openTrack(k){
  var j=job,it=j.list[k];
  j.loading=true;
  decode48(it.file).then(function(ab){
    var n=ab.length,c,ch,i,mono=new Float32Array(n);
    if(job!==j)return;
    for(c=0;c<ab.numberOfChannels;c++){ch=ab.getChannelData(c);for(i=0;i<n;i++)mono[i]+=ch[i]/ab.numberOfChannels;}
    j.k=k;j.ab=ab;j.S=anStart(mono,48000);j.t0=j.n/j.fps;j.fed=0;j.len=ab.duration;
    /* the player says it has this track in hand, paused at the film's moment: the score reads its time from there */
    plPoint(it.fi);player.token++;player.mode="buf";player.buf=ab;player.playing=false;player.offset=0;
    j.loading=false;step();
  },function(){fail("The file "+it.file.name+" could not be read, so the filming ended.");});
}
/* hand the sound encoder the track's samples up to second upto of it, half a second at a time */
function feedSound(upto){
  var j=job,ab=j.ab,rate=48000,end=Math.min(ab.length,Math.ceil(upto*rate)),n,data,L,R;
  while(j.fed<end){
    n=Math.min(24000,end-j.fed);data=new Float32Array(2*n);
    L=ab.getChannelData(0);R=ab.numberOfChannels>1?ab.getChannelData(1):L;
    data.set(L.subarray(j.fed,j.fed+n),0);data.set(R.subarray(j.fed,j.fed+n),n);
    j.aenc.encode(new AudioData({format:"f32-planar",sampleRate:rate,numberOfFrames:n,numberOfChannels:2,timestamp:Math.round((j.t0+j.fed/rate)*1e6),data:data}));
    j.fed+=n;
  }
}
/* One picture, and then the next: until the tracks are done, Stop is pressed, or something fails. */
function step(){
  var j=job,lt,vf,bad,rate;
  if(!j||j.loading||j.ending)return;
  bad=j.sink.failed();
  if(bad){fail("The file could not be written: "+(bad.message||bad));return;}
  if(j.stop||(j.mem&&j.sink.size()>FILM_MEM_MAX)){finish();return;}
  /* the encoders or the disc are behind: wait for them, so that nothing piles up in memory */
  if(j.venc.encodeQueueSize>4||j.aenc.encodeQueueSize>40||j.sink.waiting()>64e6){setTimeout(step,8);return;}
  lt=j.n/j.fps-j.t0;
  if(lt>=j.len-0.5/j.fps){
    feedSound(j.len);
    if(j.k+1<j.list.length)openTrack(j.k+1);else finish();
    return;
  }
  player.offset=lt;j.lt=lt;
  feedSound(lt+1);
  try{
    j.now+=1000/j.fps;frame(j.now);
    vf=new VideoFrame(canvas,{timestamp:Math.round(j.n/j.fps*1e6),duration:Math.round(1e6/j.fps)});
    j.venc.encode(vf,{keyFrame:j.n%(FILM_KEY_SEC*j.fps)===0});vf.close();
  }catch(e){fail("A picture could not be made, so the filming ended: "+(e&&e.message||e));return;}
  j.n++;
  if(j.n%15===0){
    rate=(j.n/j.fps)/Math.max(0.001,(performance.now()-j.began)/1000);
    say(filmLine(j.k,j.list.length,lt,j.len,rate));
  }
  setTimeout(step,0);
}
/* Film the playing track (all false) or every track of the album (all true), at a size and a rate of pictures. */
export function filmStart(w,h,fps,all){
  var sc=scoreUse(),list=[],i,name,begin;
  if(job){job.stop=true;return;}
  if(!filmCan()){toast("This browser cannot make a video file. Chrome and Edge on a computer can.");return;}
  if(!sc||!plCount()||!ac){toast("Choose the album's files and a score first.");return;}
  if(all){
    if(plCount()!==sc.tracks.length){toast("To film the album, choose exactly its "+sc.tracks.length+" files.");return;}
    for(i=0;i<plCount();i++)list.push({fi:i,file:plFile(i)});
  }else{
    list.push({fi:plAt(),file:plFile(plAt())});
  }
  name=mediaTitle(list[0].file.name).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,40)||"mirrorfold";
  name="mirrorfold-"+name+".webm";
  begin=function(sink,mem){
    var codec=filmCodec(w,h,fps),cfg={codec:codec,width:w,height:h,bitrate:filmBitrate(w,h,fps),framerate:fps,latencyMode:"quality"};
    VideoEncoder.isConfigSupported(cfg).then(function(r){
      if(!r.supported){cfg.codec="vp8";return VideoEncoder.isConfigSupported(cfg);}
      return r;
    }).then(function(r){
      var j;
      if(!r.supported){toast("This browser cannot encode pictures of that size. Try a smaller one.");try{sink.done()}catch(_){}return;}
      if(still)setStill(false);
      pPause();pHold(true);
      j=job={w:w,h:h,fps:fps,list:list,k:-1,n:0,t0:0,len:0,fed:0,now:performance.now(),began:performance.now(),sink:sink,mem:mem,stop:false,loading:false,ending:false,
             was:{at:plAt()},ab:null,S:null,lt:0,mux:null,venc:null,aenc:null,blob:null};
      j.mux=webmStart({w:w,h:h,fps:fps,codec:cfg.codec==="vp8"?"V_VP8":"V_VP9",audio:{channels:2,rate:48000,head:opusHead(2,312)}},sink);
      j.venc=new VideoEncoder({output:function(c){var b=new Uint8Array(c.byteLength);c.copyTo(b);j.mux.video(b,c.timestamp/1000,c.type==="key");},error:function(e){fail("The picture encoder stopped: "+e.message);}});
      j.venc.configure(cfg);
      j.aenc=new AudioEncoder({output:function(c){var b=new Uint8Array(c.byteLength);c.copyTo(b);j.mux.audio(b,c.timestamp/1000);},error:function(e){fail("The sound encoder stopped: "+e.message);}});
      j.aenc.configure({codec:"opus",sampleRate:48000,numberOfChannels:2,bitrate:160000});
      /* the picture hears the file's own sound at the film's moment, not the loudspeakers' */
      setSoundFeed({
        bins:function(fb){if(j.S){anLook(j.S,Math.round(j.lt*48000)-1024);fb.set(j.S.bins.subarray(0,fb.length));}},
        wave:function(tb){var i,at=Math.round(j.lt*48000)-tb.length,m=j.S?j.S.mono:null,x;for(i=0;i<tb.length;i++){x=m&&at+i>=0&&at+i<m.length?m[at+i]:0;tb[i]=Math.max(0,Math.min(255,Math.round(128+127*x)));}}
      });
      setFilmSize(w,h);
      $("stFilm").textContent=$("stFilmAll").textContent="Stop filming";
      say("Filming: reading the music…");
      openTrack(0);
    },function(e){toast("The picture encoder could not be started: "+(e&&e.message||e));});
  };
  /* the file is named first, while the press that asked for the film still counts as the user's */
  if(typeof window.showSaveFilePicker==="function"){
    window.showSaveFilePicker({suggestedName:name,types:[{description:"WebM video",accept:{"video/webm":[".webm"]}}]}).then(function(h){return h.createWritable();}).then(function(wr){begin(diskSink(wr),false);},
      function(e){if(e&&e.name==="AbortError")return;begin(memSink(name),true);}); /* no file was named: nothing is filmed. Any other trouble: in memory instead. */
  }else{
    toast("This browser cannot write a long film straight to the disc, so it is held in memory: keep it short.");
    begin(memSink(name),true);
  }
}
export function filmStop(){if(job)job.stop=true;}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
var size=$("stFilmSize"),rate=$("stFilmFps"),go=function(all){var s=FILM_SIZES[+size.value]||FILM_SIZES[1];filmStart(s[1],s[2],+rate.value||30,all);};
FILM_SIZES.forEach(function(s,i){var o=document.createElement("option");o.value=String(i);o.textContent=s[0]+" ("+s[1]+" by "+s[2]+")";size.appendChild(o);});
FILM_FPS.forEach(function(f){var o=document.createElement("option");o.value=String(f);o.textContent=f+" pictures a second";rate.appendChild(o);});
size.value="1";rate.value="60";
$("stFilm").addEventListener("click",function(){go(false);});
$("stFilmAll").addEventListener("click",function(){go(true);});
/* leaving the page in the middle would lose the film */
window.addEventListener("beforeunload",function(e){if(job){e.preventDefault();e.returnValue="";}});
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={FILM_SIZES, FILM_FPS, FILM_BPP, FILM_KEY_SEC, FILM_MEM_MAX, filming, filmCan, filmCodec, filmBitrate, filmLine, filmStart, filmStop, filmMemSink:memSink, get filmJob(){return job}, get filmLast(){return lastBlob}};
