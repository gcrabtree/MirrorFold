/* The composing screen, for a computer with a mouse and keys: a panel under the picture with the playing track of the
   score laid out along the music's time. From the top: a ruler, the music as it was heard (how loud, and how full),
   the moments where it changes (marks), and a lane for each kind of change with every cue as a block that lasts until
   the next.
   A score is made here mostly by doing: while Keep my changes is on, whatever is changed by hand (a world, a palette,
   anything Journey could change, from the controls, the keys or a MIDI box) is written into the score at the moment
   the music is at, playing or paused. So the same screen serves for placing a change exactly and for playing along
   live and keeping the take. A block can then be dragged to another moment (it catches on the marks), or removed.
   Every change is written through the cleaner (scoreEdit), and can be undone. */
import { pPos, pSeek, plAt, plCount, plFile, plGo, player } from "./audio.js";
import { cam } from "./camera.js";
import { scene } from "./choose.js";
import { clock, morphValue } from "./clock.js";
import { $, isTouch, toast } from "./dom.js";
import { FL_BYTES, FL_DT, flB64, flSample, flWrite } from "./flightdata.js";
import { pkDeep } from "./packing.js";
import { wakeHud } from "./input.js";
import { allT, catOf, jCur, jMade, store } from "./journey.js";
import { pickSort, thumbName } from "./picker.js";
import { filmCan, filming } from "./film.js";
import { flightPlaying } from "./flightplay.js";
import { tgGuest } from "./together.js";
import { musicMode } from "./listen.js";
import { cleanName } from "./packs.js";
import { SC_CURVES, SC_GAP, SC_KINDS, SC_NEAR, SC_SOFT, SC_TAKE_MAX, scLen, takeLen } from "./scoredata.js";
import { draftAlbum, hearFile, heardFile } from "./scoremake.js";
import { scMade, scoreEdit, scoreNow, scoreRemove, scoreRename, scoreSet, scoreUse, scores, setTakeHold } from "./scoreplay.js";
import { still } from "./still.js";
import { resize } from "./targets.js";
export const ST_GUT=96,ST_RULER=20,ST_WAVE=44,ST_LANE=22; /* the timeline's measures in CSS pixels: the lanes' names, the ruler, the music, one lane */
export const ST_ALBUM=22;    /* the strip across the top with every track of the album on it */
export const ST_CURVE=38;    /* the height of a lane with a drawn line in it */
export const ST_CURVE_NAME={morph:"Shape",speed:"Speed"};
export const ST_CURVE_HINT={morph:"Press here to draw how the world's shape changes: low is its open end, high its dense end. With no line, the shape follows the song.",speed:"Press here to draw how fast the flight goes: low is a fifth of the usual speed, high four times it. With no line, the speed is as you set it."};
export const ST_UNDO=100;    /* how many changes can be undone */
export const ST_LANE_NAME={journey:"By chance",world:"World",palette:"Palette",mirrors:"Mirrors",motion:"Motion",filter:"Filter",overlay:"Overlay",surface:"Surface",land:"Land",packing:"Packing",pulse:"Pulse",shapes:"Shapes",inside:"Inside out",dance:"Dance style",camera:"Camera"};
export let studioOpen=false;
let cv=null,cx=null;         /* the timeline's canvas and its drawing context */
const view={a:0,b:1,ti:-1,sc:null}; /* the seconds shown from left to right, the track they belong to, and the score that track is of */
let follow=true;             /* the track shown is the one playing, and changes with it; false once another has been chosen to work on */
let wantSeek=null;           /* a moment to go to in a track whose file is being started: {i, t} */
let trayKey="";              /* what the tray of pictures was last filled with */
let pickPt=null;             /* the chosen point of a drawn line: {c, i}, the line's name and the point's place in it; or null */
let pickTake=-1;             /* the chosen camera take, or -1 */
let tape=null;               /* the camera being recorded: {t0, n, bytes, worlds, last} */
let pick=-1;                 /* the chosen cue: its place in the track's list, or -1 */
let drag=null;               /* what the mouse is doing: {kind:"scrub"} or {kind:"loop",a} or {kind:"cue",i,t,moved} */
let loop=null;               /* a passage that is played round and round: {a, b} in seconds, or null */
let keep=true;               /* Keep my changes */
const undo={};               /* for each track, the states to go back to; and under "r"+track, those to go forward to */
const was={};                /* what was showing at the last frame, kind by kind */
const asked={};              /* files that have been asked to be listened to, by name */
let rows=[];                 /* the lanes drawn, top to bottom: their kinds */

/* The mathematics of the timeline, free of the page, so that the test tools can run them. */
/* the seconds between the ruler's ticks, for so many pixels to a second: the smallest round step that leaves 70 pixels between ticks */
export function stStep(pxPerSec){
  var s=[0.5,1,2,5,10,15,30,60,120,300,600],i;
  for(i=0;i<s.length;i++)if(s[i]*pxPerSec>=70)return s[i];
  return 1200;
}
/* a time as it is written on the ruler and beside a cue: 1:02.5 */
export function stClock(t){t=Math.max(0,t);var m=Math.floor(t/60),s=t-m*60;return m+":"+(s<10?"0":"")+(Math.round(s*10)/10).toFixed(1);}
/* The view after the wheel has turned: zoomed by factor f about time at, kept inside the track and no closer than 2 seconds across. */
export function stZoom(a,b,len,at,f){
  var w=Math.max(2,Math.min(len,(b-a)*f)),na=at-(at-a)*w/(b-a);
  na=Math.max(0,Math.min(len-w,na));
  return [na,na+w];
}
/* A time moved to the nearest mark if one is within reach seconds; else as it is. */
export function stSnap(t,marks,reach){
  var i,best=t,bd=reach;
  for(i=0;i<marks.length;i++)if(Math.abs(marks[i]-t)<=bd){bd=Math.abs(marks[i]-t);best=marks[i];}
  return best;
}
/* A track's cues with one more of kind k and name v at time t, as the cleaner will let it stand: any cue of that kind
   too near it gives way, and if a cue of another kind that changes the picture at once is too near, the new one is put
   just after it. Returns {cues, t}, or null if there is no room within two seconds. skip is a cue to leave out (the
   one being moved). */
export function stPut(cues,t,k,v,len,skip,cut){
  var hard=SC_SOFT.indexOf(k)<0,out,tries,i,c,clash;
  t=Math.max(0,Math.min(len,Math.round(t*100)/100));
  for(tries=0;tries<6;tries++){
    clash=-1;
    for(i=0;i<cues.length&&hard&&t>0;i++){c=cues[i];if(i!==skip&&c[1]!==k&&SC_SOFT.indexOf(c[1])<0&&c[0]>0&&Math.abs(c[0]-t)<SC_NEAR-1e-6)clash=Math.max(clash,c[0]);}
    if(clash<0)break;
    t=Math.round((clash+SC_NEAR)*100)/100;
    if(t>len)return null;
  }
  if(tries>=6)return null;
  out=cues.filter(function(c,i){return i!==skip&&!(c[1]===k&&Math.abs(c[0]-t)<SC_GAP-1e-6);});
  out.push(cut?[t,k,v,cut]:[t,k,v]);
  out.sort(function(p,q){return p[0]-q[0];});
  return {cues:out,t:t};
}
/* The kinds that get a lane: the three that every score has, and any other the track has a cue of. */
export function stLanes(cues){
  var has={journey:1,world:1,palette:1},i;
  for(i=0;i<cues.length;i++)has[cues[i][1]]=1;
  return SC_KINDS.filter(function(k){return has[k];}).sort(function(p,q){return (p==="journey"?-1:0)-(q==="journey"?-1:0);});
}

/* The track shown and worked on is not always the one playing: any track of the score can be chosen from the album
   strip and its changes moved, removed and added without its music. track() and ti() are the one shown; playI() is
   the one playing (-1 for none), and playing() says they are the same. */
function playI(){var n=scoreNow();return n?n.i:-1;}
function ti(){return view.ti;}
function track(){var sc=scoreUse();return sc&&sc.tracks[view.ti]||null;}
function playing(){return view.ti>=0&&view.ti===playI();}
function showTrack(i){
  var sc=scoreUse();
  if(!sc||!sc.tracks[i])return;
  follow=i===playI();view.ti=i;view.sc=sc;view.a=0;view.b=sc.tracks[i].len;pick=-1;pickTake=-1;pickPt=null;loop=null;
}
/* keep the track shown in step with the score in use and, while following, with the music */
function viewSync(){
  var sc=scoreUse(),p=playI();
  if(!sc){view.ti=-1;view.sc=null;return;}
  if(view.sc!==sc||!sc.tracks[view.ti]){showTrack(p>=0?p:0);follow=true;}
  else if(follow&&p>=0&&p!==view.ti){showTrack(p);}
}
/* the audio file that is a track's, where it can be told: the one playing, or by its place when the files chosen are as many as the tracks; -1 for none */
function fileI(i){
  var sc=scoreUse();
  if(i===playI())return plAt();
  return sc&&plCount()===sc.tracks.length?i:-1;
}
/* which track a place across the album strip is (part: 0 at its left end to 1 at its right): the tracks lie side by side, each as wide as it is long */
export function stAlbumAt(lens,part){
  var tot=0,i,acc=0;
  for(i=0;i<lens.length;i++)tot+=lens[i];
  for(i=0;i<lens.length;i++){acc+=lens[i];if(part*tot<acc)return i;}
  return lens.length-1;
}
function xOf(t,W){return ST_GUT+(t-view.a)/(view.b-view.a)*(W-ST_GUT);}
function tOf(x,W){return view.a+(x-ST_GUT)/(W-ST_GUT)*(view.b-view.a);}
function say(text){$("stSay").textContent=text;$("stSay").title=text;}
/* Change the playing track: fn is given copies of its cues and marks and returns the new {cues, marks}, or null for no change. */
function edit(fn){
  var tr=track(),i=ti(),got,u;
  if(!tr)return false;
  got=fn(tr.cues.map(function(c){return c.slice();}),tr.marks.slice(),(tr.takes||[]).slice(),JSON.parse(JSON.stringify(tr.curves||{})));
  if(!got)return false;
  u=undo[i]||(undo[i]=[]);u.push(JSON.stringify({cues:tr.cues,marks:tr.marks,takes:tr.takes||[],curves:tr.curves||{}}));if(u.length>ST_UNDO)u.shift();
  undo["r"+i]=[];
  return scoreEdit(i,got.cues,got.marks,got.takes,got.curves);
}
function goBack(from,to){
  var tr=track(),i=ti(),a=undo[from+i],s;
  if(!tr||!a||!a.length){toast(from?"Nothing to do again.":"Nothing to undo.");return;}
  s=JSON.parse(a.pop());
  (undo[to+i]||(undo[to+i]=[])).push(JSON.stringify({cues:tr.cues,marks:tr.marks,takes:tr.takes||[],curves:tr.curves||{}}));
  scoreEdit(i,s.cues,s.marks,s.takes||[],s.curves||{});pick=-1;pickTake=-1;pickPt=null;
}
/* Write a cue at time t. Says so if there is no room. */
function put(t,k,v){
  var at=-1;
  var ok=edit(function(cues,marks){
    var r=stPut(cues,t,k,v,track().len,-1);
    if(!r)return null;
    at=r.t;return {cues:r.cues,marks:marks};
  });
  if(!ok){toast("There is no room for a change there: two changes must be "+SC_NEAR+" seconds apart.");return;}
  findPick(at,k);
  say(ST_LANE_NAME[k]+" "+(v||"none")+" at "+stClock(at));
}
function findPick(t,k){
  var tr=track(),i;pick=-1;
  if(tr)for(i=0;i<tr.cues.length;i++)if(tr.cues[i][1]===k&&Math.abs(tr.cues[i][0]-t)<0.006)pick=i;
}
/* Begin recording the camera at the music's moment; and end it, keeping the take in place of any it lies over. */
function takeStart(){
  var tr;
  if(playI()<0){toast("There is no track of the score playing.");return;}
  if(!playing())showTrack(playI());
  tr=track();
  if(pkDeep(scene.world)){toast("The camera cannot be recorded in the descent: its places are moved outward as it goes. Choose another packing.");return;}
  tape={t0:pPos(),n:0,bytes:new Uint8Array((SC_TAKE_MAX/FL_DT+2)*FL_BYTES),worlds:[],last:pPos()};
  setTakeHold(true);
  toast("Recording the camera from "+stClock(tape.t0)+". Fly, or let Journey fly. Press again to keep the take.");
}
function takeStop(why){
  var r=tape,tk,a,b;
  if(!r)return;
  tape=null;setTakeHold(false);
  if(r.n<4){toast((why||"")+"The take was too short to keep.");return;}
  tk={t:r.t0,w:r.worlds,d:flB64(r.bytes.subarray(0,r.n*FL_BYTES))};a=tk.t;b=tk.t+(r.n-1)*FL_DT;
  if(edit(function(cues,marks,takes){return {cues:cues,marks:marks,takes:takes.filter(function(x){return x.t+takeLen(x)<=a||x.t>=b;}).concat([tk])};}))
    toast((why||"")+"Kept the camera from "+stClock(a)+" to "+stClock(b)+". When the score plays, that passage is flown this way.");
  else toast("The take could not be kept.");
}
function takeFrame(){
  var pos=pPos(),w=scene.world,wi;
  if(!playing()){tape=null;setTakeHold(false);toast("Another track was chosen, so the recording was given up.");return;}
  if(pos<tape.last-0.05||pos>tape.last+1.5){takeStop("The music moved, so the recording ended. ");return;}
  if(pkDeep(w)){takeStop("The recording ended where the descent began. ");return;}
  tape.last=pos;
  if(still)return;
  while(tape&&pos>=tape.t0+tape.n*FL_DT){
    wi=tape.worlds.indexOf(w.id);
    if(wi<0){if(tape.worlds.length>=16){takeStop("A take passes through at most sixteen worlds. ");return;}tape.worlds.push(w.id);wi=tape.worlds.length-1;}
    flWrite(tape.bytes,tape.n++,flSample(cam.pos,w.period(morphValue()),cam.F,cam.Up,clock.morphT,wi));
    if(tape.n>=SC_TAKE_MAX/FL_DT){takeStop("A take is at most ten minutes. ");return;}
  }
}
/* the drawn lines: where a height (0 to 1) is in the lane whose top is y, and the height at a place of the mouse */
function vY(v,y){return y+4+(1-v)*(ST_CURVE-8);}
function curveTop(ci){return ST_RULER+ST_WAVE+rows.length*ST_LANE+ci*ST_CURVE;}
function vOf(e,ci){var r=cv.getBoundingClientRect();return Math.max(0,Math.min(1,1-(e.clientY-r.top-ST_ALBUM-curveTop(ci)-4)/(ST_CURVE-8)));}
function removePick(){
  var tr=track(),c=tr&&tr.cues[pick],p=pickTake,q=pickPt;
  if(tr&&q&&tr.curves&&tr.curves[q.c]&&tr.curves[q.c][q.i]){
    edit(function(cues,marks,takes,curves){curves[q.c].splice(q.i,1);return {cues:cues,marks:marks,curves:curves};});
    pickPt=null;say("Removed the point from the "+ST_CURVE_NAME[q.c].toLowerCase()+" line.");return;
  }
  if(tr&&tr.takes&&tr.takes[p]){
    edit(function(cues,marks,takes){takes.splice(p,1);return {cues:cues,marks:marks,takes:takes};});
    pickTake=-1;say("Removed the camera take.");return;
  }
  if(!c){toast("Click a change on the timeline first.");return;}
  edit(function(cues,marks){cues.splice(pick,1);return {cues:cues,marks:marks};});
  pick=-1;say("Removed "+ST_LANE_NAME[c[1]]+" "+(c[2]||"none")+" at "+stClock(c[0]));
}

function draw(){
  var tr=track(),dpr=window.devicePixelRatio||1,W=cv.clientWidth,H,i,k,x,x1,t,step,an,y,c,n,lane,list,pos,j,nx,css=getComputedStyle(document.body),sc=scoreUse(),tot,acc,f;
  rows=tr?stLanes(tr.cues):[];
  if(tr&&((tr.takes&&tr.takes.length)||tape))rows.push("camera");
  H=ST_ALBUM+ST_RULER+ST_WAVE+rows.length*ST_LANE+SC_CURVES.length*ST_CURVE+2;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);cv.style.height=H+"px";}
  cx.setTransform(dpr,0,0,dpr,0,0);
  cx.fillStyle="#0b0716";cx.fillRect(0,0,W,H);
  cx.font="11px "+(css.getPropertyValue("--body")||"monospace");cx.textBaseline="middle";
  if(!tr){
    cx.fillStyle="rgba(243,236,255,.62)";
    cx.fillText("The timeline appears here once there is a score.",12,H/2);
    return;
  }
  /* the album: every track side by side, each as wide as it is long, with its changes of world as ticks; the one shown is lit, and the music's place is a white line */
  tot=scLen(sc);acc=0;
  cx.fillStyle="rgba(243,236,255,.62)";cx.fillText("Album",8,ST_ALBUM/2);
  for(i=0;i<sc.tracks.length;i++){
    x=ST_GUT+acc/tot*(W-ST_GUT);x1=ST_GUT+(acc+sc.tracks[i].len)/tot*(W-ST_GUT);
    cx.fillStyle=i===view.ti?"rgba(95,240,255,.3)":i%2?"rgba(243,236,255,.07)":"rgba(243,236,255,.12)";cx.fillRect(x,2,x1-x-1,ST_ALBUM-4);
    cx.fillStyle="rgba(255,95,210,.8)";
    for(j=0;j<sc.tracks[i].cues.length;j++)if(sc.tracks[i].cues[j][1]==="world")cx.fillRect(x+sc.tracks[i].cues[j][0]/sc.tracks[i].len*(x1-x-1),ST_ALBUM-6,1,4);
    if(i===playI()){cx.fillStyle="#fff";cx.fillRect(x+Math.min(1,pPos()/sc.tracks[i].len)*(x1-x-1),2,1,ST_ALBUM-4);}
    cx.save();cx.beginPath();cx.rect(x,0,Math.max(0,x1-x-3),ST_ALBUM);cx.clip();
    cx.fillStyle=i===view.ti?"#f3ecff":"rgba(243,236,255,.62)";cx.fillText((i+1)+(sc.tracks[i].name?" "+sc.tracks[i].name:""),x+4,ST_ALBUM/2-1);
    cx.restore();acc+=sc.tracks[i].len;
  }
  cx.save();cx.translate(0,ST_ALBUM);H-=ST_ALBUM; /* everything below is drawn as if the album strip were not there */
  /* the ruler */
  step=stStep((W-ST_GUT)/(view.b-view.a));
  cx.fillStyle="rgba(243,236,255,.62)";cx.strokeStyle="rgba(243,236,255,.22)";cx.lineWidth=1;
  for(t=Math.ceil(view.a/step)*step;t<=view.b;t+=step){x=Math.round(xOf(t,W))+0.5;cx.beginPath();cx.moveTo(x,ST_RULER-6);cx.lineTo(x,ST_RULER);cx.stroke();cx.fillText(stClock(t).replace(/\.0$/,""),x+3,ST_RULER/2);}
  /* the music as it was heard: loudness as bars, fullness as a line */
  f=plFile(fileI(view.ti));an=heardFile(f);y=ST_RULER;
  cx.fillStyle="rgba(95,240,255,.08)";cx.fillRect(ST_GUT,y,W-ST_GUT,ST_WAVE);
  if(an){
    cx.fillStyle="rgba(95,240,255,.55)";
    for(x=ST_GUT;x<W;x++){i=Math.floor(tOf(x,W)*an.hz);if(i>=0&&i<an.en.length){n=an.en[i]/255*(ST_WAVE-4);cx.fillRect(x,y+ST_WAVE-n,1,n);}}
    cx.strokeStyle="#ff5fd2";cx.lineWidth=1.5;cx.beginPath();
    for(x=ST_GUT;x<W;x+=2){i=Math.floor(tOf(x,W)*an.hz);if(i>=0&&i<an.lv.length){n=y+ST_WAVE-2-an.lv[i]/255*(ST_WAVE-6);if(x===ST_GUT)cx.moveTo(x,n);else cx.lineTo(x,n);}}
    cx.stroke();
  }else{cx.fillStyle="rgba(243,236,255,.62)";cx.fillText(f&&asked[f.name]?"Listening to this track\u2026":f?"This track has not been listened to.":"This track's music is not among the files chosen. Its changes can still be moved, removed and added.",ST_GUT+8,y+ST_WAVE/2);}
  cx.fillStyle="rgba(243,236,255,.62)";cx.fillText("Music",8,y+ST_WAVE/2);
  /* a passage played round and round */
  if(loop){cx.fillStyle="rgba(255,95,210,.16)";x=xOf(loop.a,W);cx.fillRect(Math.max(ST_GUT,x),0,xOf(loop.b,W)-Math.max(ST_GUT,x),H);}
  /* the lanes: each cue a block that lasts until the next of its kind */
  for(lane=0;lane<rows.length;lane++){
    k=rows[lane];y=ST_RULER+ST_WAVE+lane*ST_LANE;
    cx.fillStyle=lane%2?"rgba(243,236,255,.03)":"rgba(243,236,255,.06)";cx.fillRect(0,y,W,ST_LANE);
    cx.fillStyle="rgba(243,236,255,.8)";cx.fillText(ST_LANE_NAME[k],8,y+ST_LANE/2);
    if(k==="camera"){ /* the passages where the camera's path is kept, and the one being recorded */
      list=tr.takes||[];
      for(j=0;j<list.length;j++){
        x=Math.max(ST_GUT,xOf(list[j].t,W));x1=xOf(list[j].t+takeLen(list[j]),W);if(x1<ST_GUT)continue;
        cx.fillStyle=j===pickTake?"hsla(150,60%,42%,.9)":"hsla(150,60%,26%,.9)";cx.fillRect(x,y+2,Math.max(3,x1-x),ST_LANE-4);
        cx.fillStyle="#f3ecff";if(x1-x>40)cx.fillText("take",x+6,y+ST_LANE/2);
      }
      if(tape){x=Math.max(ST_GUT,xOf(tape.t0,W));x1=xOf(tape.t0+tape.n*FL_DT,W);cx.fillStyle="hsla(0,80%,50%,.9)";cx.fillRect(x,y+2,Math.max(3,x1-x),ST_LANE-4);}
      continue;
    }
    list=[];for(i=0;i<tr.cues.length;i++)if(tr.cues[i][1]===k)list.push(i);
    for(j=0;j<list.length;j++){
      c=tr.cues[list[j]];t=drag&&drag.kind==="cue"&&drag.i===list[j]?drag.t:c[0];
      nx=j+1<list.length?tr.cues[list[j+1]][0]:tr.len;
      x=xOf(t,W);x1=xOf(Math.max(nx,t),W);
      if(x1<ST_GUT||x>W)continue;
      cx.save();cx.beginPath();cx.rect(ST_GUT,y,W-ST_GUT,ST_LANE);cx.clip();
      n=SC_KINDS.indexOf(k)*47%360;
      cx.fillStyle=k==="journey"&&!c[2]?"rgba(243,236,255,.07)":"hsla("+n+",70%,"+(list[j]===pick?"46%":"30%")+",.9)";
      cx.fillRect(x,y+2,Math.max(3,x1-x-1),ST_LANE-4);
      cx.fillStyle="hsl("+n+",90%,75%)";cx.fillRect(x,y+2,2,ST_LANE-4);
      if(list[j]===pick){cx.strokeStyle="#fff";cx.lineWidth=1;cx.strokeRect(x+0.5,y+2.5,Math.max(3,x1-x-1)-1,ST_LANE-5);}
      cx.beginPath();cx.rect(Math.max(ST_GUT,x),y,Math.max(0,x1-Math.max(ST_GUT,x)-2),ST_LANE);cx.clip();
      cx.fillStyle="#f3ecff";cx.fillText((c[2]||"none")+(c[3]==="door"?" (doorway)":""),Math.max(ST_GUT,x)+6,y+ST_LANE/2);
      cx.restore();
    }
  }
  /* the drawn lines: one lane each, the line straight from point to point and level before the first and after the last */
  SC_CURVES.forEach(function(name,ci){
    var y0=curveTop(ci),pts=((tr.curves&&tr.curves[name])||[]).map(function(p,pi){return drag&&drag.kind==="pt"&&drag.c===name&&drag.i===pi?[drag.t,drag.v]:p;}).slice().sort(function(p,q){return p[0]-q[0];}),pi,px;
    cx.fillStyle=ci%2?"rgba(95,240,255,.04)":"rgba(95,240,255,.07)";cx.fillRect(0,y0,W,ST_CURVE);
    cx.fillStyle="rgba(243,236,255,.8)";cx.fillText(ST_CURVE_NAME[name],8,y0+ST_CURVE/2);
    if(!pts.length){cx.fillStyle="rgba(243,236,255,.45)";cx.fillText(ST_CURVE_HINT[name],ST_GUT+8,y0+ST_CURVE/2);return;}
    cx.save();cx.beginPath();cx.rect(ST_GUT,y0,W-ST_GUT,ST_CURVE);cx.clip();
    cx.strokeStyle="#5ff0ff";cx.lineWidth=1.5;cx.beginPath();cx.moveTo(ST_GUT,vY(pts[0][1],y0));
    for(pi=0;pi<pts.length;pi++)cx.lineTo(xOf(pts[pi][0],W),vY(pts[pi][1],y0));
    cx.lineTo(W,vY(pts[pts.length-1][1],y0));cx.stroke();
    for(pi=0;pi<pts.length;pi++){
      px=pickPt&&pickPt.c===name&&tr.curves&&tr.curves[name]&&tr.curves[name][pickPt.i]&&(drag&&drag.kind==="pt"?pts[pi][0]===drag.t:pts[pi][0]===tr.curves[name][pickPt.i][0]);
      cx.fillStyle=px?"#fff":"#5ff0ff";cx.beginPath();cx.arc(xOf(pts[pi][0],W),vY(pts[pi][1],y0),px?5:3.5,0,6.2832);cx.fill();
    }
    cx.restore();
  });
  /* the marks, over the music and the lanes */
  cx.strokeStyle="rgba(243,236,255,.35)";cx.lineWidth=1;cx.setLineDash([3,3]);
  for(i=0;i<tr.marks.length;i++){x=Math.round(xOf(drag&&drag.kind==="mark"&&drag.i===i?drag.t:tr.marks[i],W))+0.5;if(x<ST_GUT||x>W)continue;cx.beginPath();cx.moveTo(x,ST_RULER);cx.lineTo(x,H);cx.stroke();}
  cx.setLineDash([]);
  /* where the music is */
  pos=pPos();x=Math.round(xOf(pos,W))+0.5;
  if(playing()&&x>=ST_GUT){cx.strokeStyle="#fff";cx.lineWidth=1;cx.beginPath();cx.moveTo(x,0);cx.lineTo(x,H);cx.stroke();}
  cx.fillStyle="#0b0716";cx.fillRect(0,0,ST_GUT,ST_RULER);cx.fillStyle="#f3ecff";cx.fillText((playing()?stClock(pos):"not playing")+" / "+stClock(tr.len).replace(/\.\d$/,""),8,ST_RULER/2);
  cx.restore();
}
/* What is under a place on the timeline: {zone, t, k, i} with zone "top" (the ruler and the music) or "lane", the kind of that lane and the cue there (-1 for none). */
function under(e){
  var r=cv.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top-ST_ALBUM,W=r.width,tr=track(),o={zone:"",t:0,k:"",i:-1,W:W,wave:false,mark:-1},lane,i,j,list,nx,sc=scoreUse();
  if(!tr)return o;
  o.t=Math.max(0,Math.min(tr.len,tOf(Math.max(ST_GUT,x),W)));
  if(y<0){o.zone="album";o.i=stAlbumAt(sc.tracks.map(function(q){return q.len;}),Math.max(0,Math.min(0.999999,(x-ST_GUT)/(W-ST_GUT))));return o;}
  if(y<ST_RULER+ST_WAVE){
    o.zone="top";o.wave=y>=ST_RULER;
    for(i=0;o.wave&&i<tr.marks.length;i++)if(Math.abs(xOf(tr.marks[i],W)-x)<=5)o.mark=i; /* a mark is taken hold of in the music, within five pixels of its line */
    return o;
  }
  lane=Math.floor((y-ST_RULER-ST_WAVE)/ST_LANE);
  if(lane>=rows.length){ /* below the lanes of cues: the lanes of drawn lines. A point is taken hold of within seven pixels. */
    i=Math.floor((y-curveTop(0))/ST_CURVE);
    if(i<0||i>=SC_CURVES.length)return o;
    o.zone="curve";o.k=SC_CURVES[i];o.ci=i;list=(tr.curves&&tr.curves[o.k])||[];
    for(j=0;j<list.length;j++)if(Math.abs(xOf(list[j][0],W)-x)<=7&&Math.abs(vY(list[j][1],curveTop(i))-y)<=7)o.i=j;
    return o;
  }
  if(lane<0)return o;
  if(rows[lane]==="camera"){o.zone="take";for(i=0;tr.takes&&i<tr.takes.length;i++)if(o.t>=tr.takes[i].t&&o.t<tr.takes[i].t+takeLen(tr.takes[i]))o.i=i;return o;}
  o.zone="lane";o.k=rows[lane];
  list=[];for(i=0;i<tr.cues.length;i++)if(tr.cues[i][1]===o.k)list.push(i);
  for(j=0;j<list.length;j++){nx=j+1<list.length?tr.cues[list[j+1]][0]:tr.len;if(o.t>=tr.cues[list[j]][0]-3*(view.b-view.a)/(W-ST_GUT)&&o.t<nx)o.i=list[j];}
  return o;
}
/* Go to a moment of the track shown. If it is not the one playing, its file is started first. */
function seek(t){
  var fi;
  wakeHud();
  if(playing()){pSeek(t);return;}
  fi=fileI(view.ti);
  if(fi<0||!plFile(fi)){toast("This track's music is not among the files chosen, so it cannot be played.");return;}
  wantSeek={i:view.ti,t:t};follow=true;plGo(fi);
}
function down(e){
  var u=under(e),tr=track();
  if(!tr||e.button!==0)return;
  e.preventDefault();try{cv.setPointerCapture(e.pointerId)}catch(_){}
  if(u.zone==="lane"&&u.i>=0){pick=u.i;pickTake=-1;drag={kind:"cue",i:u.i,t:tr.cues[u.i][0],from:u.t,moved:false};say(ST_LANE_NAME[u.k]+" "+(tr.cues[u.i][2]||"none")+" at "+stClock(tr.cues[u.i][0])+". Drag to move it, Delete to remove it.");return;}
  pick=-1;pickTake=-1;pickPt=null;
  if(u.zone==="curve"){
    /* on a point: take hold of it. Elsewhere in the lane: a new point there, held at once, so that one press and a drag places it. */
    var pv=vOf(e,u.ci),pi=u.i;
    if(pi<0){
      edit(function(cues,marks,takes,curves){(curves[u.k]=curves[u.k]||[]).push([u.t,pv]);return {cues:cues,marks:marks,curves:curves};});
      tr=track();pi=-1;
      ((tr.curves&&tr.curves[u.k])||[]).forEach(function(p,j){if(Math.abs(p[0]-u.t)<0.006)pi=j;});
      if(pi<0){toast("There is no room for a point there: two points must be a twentieth of a second apart.");return;}
    }
    pickPt={c:u.k,i:pi};drag={kind:"pt",c:u.k,ci:u.ci,i:pi,t:tr.curves[u.k][pi][0],v:tr.curves[u.k][pi][1],moved:false};
    say(ST_CURVE_NAME[u.k]+" at "+stClock(drag.t)+". Drag the point to move it; Delete, or two presses on it, removes it.");return;
  }
  if(u.zone==="album"){showTrack(u.i);say("Track "+(u.i+1)+(playing()?"":". It is not the one playing: click its ruler to play it from there, or work on its changes as they are."));return;}
  if(u.zone==="top"&&u.mark>=0&&!e.shiftKey){drag={kind:"mark",i:u.mark,t:tr.marks[u.mark]};say("A mark at "+stClock(tr.marks[u.mark])+". Drag to move it; press twice to remove it.");return;}
  if(u.zone==="take"&&u.i>=0){pickTake=u.i;say("A camera take from "+stClock(tr.takes[u.i].t)+", "+Math.round(takeLen(tr.takes[u.i]))+" seconds. Delete removes it.");return;}
  if(u.zone==="top"&&e.shiftKey){drag={kind:"loop",a:u.t};loop={a:u.t,b:u.t};return;}
  if(!playing()){drag={kind:"jump"};return;} /* another track: its file is started once, when the mouse is let go */
  drag={kind:"scrub",at:0};seek(u.t);
}
function move(e){
  var u,tr=track(),now,reach;
  if(!drag||!tr)return;
  u=under(e);reach=8*(view.b-view.a)/(u.W-ST_GUT);
  if(drag.kind==="scrub"){now=performance.now();if(now-drag.at>120){drag.at=now;seek(u.t);}}
  else if(drag.kind==="loop"){loop={a:Math.min(drag.a,u.t),b:Math.max(drag.a,u.t)};}
  else if(drag.kind==="mark"){drag.t=u.t;}
  else if(drag.kind==="pt"){drag.t=e.altKey?u.t:stSnap(u.t,tr.marks,reach);drag.v=vOf(e,drag.ci);drag.moved=true;}
  else if(drag.kind==="cue"){
    if(Math.abs(u.t-drag.from)>reach/2)drag.moved=true;
    if(drag.moved)drag.t=Math.max(0,Math.min(tr.len,e.altKey?u.t:stSnap(tr.cues[drag.i][0]+u.t-drag.from,tr.marks,reach)));
  }
}
function up(e){
  var d=drag,tr=track(),c;
  drag=null;
  if(!d||!tr)return;
  if(d.kind==="scrub"||d.kind==="jump")seek(under(e).t);
  else if(d.kind==="pt"){
    if(!d.moved)return;
    edit(function(cues,marks,takes,curves){if(!curves[d.c]||!curves[d.c][d.i])return null;curves[d.c][d.i]=[d.t,d.v];return {cues:cues,marks:marks,curves:curves};});
    tr=track();pickPt=null;
    ((tr.curves&&tr.curves[d.c])||[]).forEach(function(p,j){if(Math.abs(p[0]-d.t)<0.006)pickPt={c:d.c,i:j};});
  }
  else if(d.kind==="mark"){
    edit(function(cues,marks){marks[d.i]=d.t;return {cues:cues,marks:marks};});
    say("Mark moved to "+stClock(d.t));
  }
  else if(d.kind==="loop"){if(loop&&loop.b-loop.a<1){loop=null;say("No passage is played round.");}else{say("Playing round "+stClock(loop.a)+" to "+stClock(loop.b)+". Shift and click the ruler to let go.");seek(loop.a);}}
  else if(d.kind==="cue"&&d.moved){
    c=tr.cues[d.i];
    var at=-1,ok=edit(function(cues,marks){var r=stPut(cues,d.t,c[1],c[2],tr.len,d.i,c[3]);if(!r)return null;at=r.t;return {cues:r.cues,marks:marks};});
    if(ok){findPick(at,c[1]);say(ST_LANE_NAME[c[1]]+" "+(c[2]||"none")+" moved to "+stClock(at));}else toast("There is no room for it there.");
  }
}
function wheel(e){
  var u=under(e),tr=track(),z,w;
  if(!tr)return;
  e.preventDefault();
  if(e.shiftKey||Math.abs(e.deltaX)>Math.abs(e.deltaY)){w=view.b-view.a;z=(e.deltaX||e.deltaY)*w/800;z=Math.max(-view.a,Math.min(tr.len-view.b,z));view.a+=z;view.b+=z;}
  else{z=stZoom(view.a,view.b,tr.len,u.t,Math.exp(e.deltaY*0.0015));view.a=z[0];view.b=z[1];}
}
/* A press twice in a lane: a cue there of what is showing now (for By chance, the template chosen in the list beside it). */
function twice(e){
  var u=under(e),tr=track();
  if(u.zone==="album"){showTrack(u.i);seek(0);return;}
  if(u.zone==="curve"){if(pickPt)removePick();return;} /* the first press took hold of the point, or made one: the second takes it away */
  /* in the music: a mark there is removed, and where there is none one is made */
  if(u.zone==="top"&&u.wave&&tr){
    edit(function(cues,marks){if(u.mark>=0)marks.splice(u.mark,1);else marks.push(u.t);return {cues:cues,marks:marks};});
    say(u.mark>=0?"Mark removed.":"Mark made at "+stClock(u.t)+". Changes that are dragged catch on it.");return;
  }
  if(u.zone==="lane")put(u.t,u.k,u.k==="journey"?$("stTpl").value:jCur(u.k));
}
function fillTpl(){
  var s=$("stTpl"),v=s.value,o;
  s.textContent="";
  o=document.createElement("option");o.value="";o.textContent="By chance: nothing";s.appendChild(o);
  allT().forEach(function(t){o=document.createElement("option");o.value=t.name;o.textContent="By chance: "+t.name;s.appendChild(o);});
  s.value=v;if(s.value!==v)s.value="";
}
let scoreList="\u0000";       /* the names in the list of scores as it was last filled */
let hint="";                 /* the last thing said by the screen itself about what to do next */
/* The tray: a row of pictures of one kind of thing (worlds, palettes and so on), by name. One is dragged onto the
   timeline to write it at that moment of the track shown, or pressed to write it where the music is. */
function trayPic(k,key){
  if(k==="land")return key==="none"?"":thumbName("land",key.split(" ")[0]);
  return ["world","palette","motion","filter","overlay","surface","packing","mirrors"].indexOf(k)>=0?thumbName(k,key):"";
}
function fillTray(force){
  var k=$("stTrayKind").value||"world",c=catOf(k),box=$("stTiles"),sig,order;
  if(!c)return;
  sig=k+":"+c.opts.map(function(o){return o[0];}).join("\u0001");
  if(!force&&sig===trayKey)return; /* filled again only when the kind or the list has changed (a pack was added) */
  trayKey=sig;box.textContent="";
  order=pickSort(c.opts.map(function(o){return o[1];}));
  order.forEach(function(i){
    var o=c.opts[i],b=document.createElement("button"),pic=trayPic(k,o[0]),im,t=document.createElement("span");
    b.type="button";b.className="stTile";b.draggable=true;b.title=o[1];
    if(pic){im=document.createElement("img");im.alt="";im.loading="lazy";im.draggable=false;im.addEventListener("error",function(){im.remove();});im.src=pic;b.appendChild(im);} /* what came from a pack has no picture */
    t.textContent=o[1];b.appendChild(t);
    b.addEventListener("dragstart",function(e){try{e.dataTransfer.setData("text/plain","mirrorfold\u0001"+k+"\u0001"+o[0]);e.dataTransfer.effectAllowed="copy";}catch(_){}});
    b.addEventListener("click",function(){
      if(!track())return;
      if(playI()<0){toast("Nothing is playing. Drag it onto the timeline to write it at a moment of this track.");return;}
      if(!playing())showTrack(playI());
      put(pPos(),k,o[0]);
    });
    box.appendChild(b);
  });
}
/* something from the tray let go over the timeline: written at that moment (on a near mark, unless Alt is held) */
function drop(e){
  var d="",p,c,u=under(e),tr=track(),t,ok=false,i;
  e.preventDefault();
  try{d=e.dataTransfer.getData("text/plain");}catch(_){}
  p=String(d).split("\u0001");
  if(!tr||p.length!==3||p[0]!=="mirrorfold"||SC_KINDS.indexOf(p[1])<0||p[1]==="journey"||u.zone==="album"||!u.zone)return;
  c=catOf(p[1]);for(i=0;c&&i<c.opts.length;i++)if(c.opts[i][0]===p[2])ok=true; /* only what is in the app's own lists */
  if(!ok)return;
  t=e.altKey?u.t:stSnap(u.t,tr.marks,8*(view.b-view.a)/(u.W-ST_GUT));
  put(t,p[1],p[2]);
}
function sync(){
  var sc=scoreUse(),n=$("stName"),files=plCount()>0,tr=track(),s=$("stScore"),names=scores.map(function(x){return x.name;}).join("\u0001"),o,h;
  /* each group shows only what can be done now, so the next thing to do is always in sight */
  $("stPlay").hidden=$("stPrev").hidden=$("stNext").hidden=!files;
  $("stFiles").classList.toggle("advGo",!files);
  $("stGrpScore").hidden=!files&&!scores.length;
  $("stDraft").hidden=$("stEmpty").hidden=!files;$("stDraft").classList.toggle("advGo",files&&!tr);
  s.hidden=!scores.length;n.hidden=$("stSave").hidden=$("stRemove").hidden=!sc;
  $("stGrpEdit").hidden=$("stTray").hidden=!tr;$("stGrpCam").hidden=playI()<0||filming();
  $("stGrpFilm").hidden=!filmCan()||(playI()<0&&!filming());$("stFilmAll").hidden=!sc||plCount()!==sc.tracks.length;
  $("stFilmSize").disabled=$("stFilmFps").disabled=filming();
  if(tr)fillTray(false);
  if(names!==scoreList){
    scoreList=names;s.textContent="";
    o=document.createElement("option");o.value="";o.textContent="No score";s.appendChild(o);
    scores.forEach(function(x,i){o=document.createElement("option");o.value=String(i);o.textContent=x.name;s.appendChild(o);});
  }
  s.value=sc?String(scores.indexOf(sc)):"";
  h=!files?"Step 1: choose the audio files of your album. They play in the order of their names.":
    !tr&&!sc?"Step 2: press Draft a score to have a first one written from the music, or Start empty.":
    !tr?"There is no score in use. Draft one for these files, or choose one from the list.":
    playI()<0?"None of this score's tracks is playing, so nothing is heard. Its changes can still be moved, removed and added: click a track in the album strip.":
    "Change anything while the music plays or is paused, and it is written here at that moment. Click the ruler to move the music; Shift and drag to play a passage round. Drag a change to move it; press twice in a lane to write what is showing now.";
  if(h!==hint&&!filming()){hint=h;say(h);}
  $("stKeep").setAttribute("aria-pressed",keep?"true":"false");$("stKeep").textContent="Keep my changes: "+(keep?"on":"off");
  $("stTake").textContent=tape?"Stop and keep the take":"Record the camera";$("stTake").setAttribute("aria-pressed",tape?"true":"false");
  if(document.activeElement!==n)n.value=sc?sc.name:"";
  n.disabled=!sc;
}
export function setStudio(on){
  on=!!on;
  if(on===studioOpen)return;
  studioOpen=on;$("studio").hidden=!on;document.body.classList.toggle("studio",on);
  $("bStudio").setAttribute("aria-pressed",on?"true":"false");
  if(!on&&tape)takeStop("");
  if(on){SC_KINDS.forEach(function(k){if(k!=="journey")was[k]=jCur(k);delete scMade[k];delete jMade[k];}); /* notes from before the screen was open would be taken for this moment's */
    view.ti=-1;view.sc=null;follow=true;viewSync();fillTpl();sync();}
  resize(); /* the picture is given the room the panel leaves */
}
/* A step of the frame, last of all: write down what was changed by hand, keep a passage going round, and draw the timeline. */
export function studioFrame(){
  var i,k,now,n,f,pos,tr;
  if(!studioOpen)return;
  viewSync();
  if(wantSeek&&playI()===wantSeek.i&&player.mode){pSeek(wantSeek.t);wantSeek=null;} /* the file asked for has started: go to the moment that was clicked */
  n=scoreNow();tr=track();
  for(i=0;i<SC_KINDS.length;i++){
    k=SC_KINDS[i];if(k==="journey")continue;
    now=jCur(k);
    if(now===was[k])continue;
    was[k]=now;
    /* the score asked for it, or Journey chose it: not the user's doing */
    if(scMade[k]===now){delete scMade[k];continue;}
    if(jMade[k]===now){delete jMade[k];continue;}
    if(keep&&playI()>=0&&!still&&musicMode==="file"&&!tgGuest()&&!flightPlaying()&&!filming()){if(!playing())showTrack(playI());put(pPos(),k,now);} /* written into the track that is playing, which is brought into view */
  }
  if(tape)takeFrame();
  if(loop&&playing()&&player.mode&&pPos()>=loop.b)pSeek(loop.a);
  /* a track that has not been listened to is, once, so that its music can be drawn */
  f=plFile(fileI(view.ti));
  if(tr&&f&&!heardFile(f)&&!asked[f.name]){asked[f.name]=1;hearFile(f,function(){}).then(function(){},function(){});}
  sync();draw();
}
function savePack(){
  var sc=scoreUse(),names={},a,url,k;
  if(!sc){toast("There is no score to save.");return;}
  sc.tracks.forEach(function(t){t.cues.forEach(function(c){if(c[1]==="journey"&&c[2])names[c[2]]=1;});});
  k={mirrorfold:1,name:sc.name,author:"",scores:[sc],templates:JSON.parse(JSON.stringify(store.tpls.filter(function(t){return names[t.name];}))).map(function(t){delete t.builtin;return t;})};
  url=URL.createObjectURL(new Blob([JSON.stringify(k,null,1)],{type:"application/json"}));
  a=document.createElement("a");a.href=url;a.download="mirrorfold-score.json";document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(url)},2000);
  toast("Saved the score "+sc.name+" as a pack file. It holds no music: whoever opens it plays their own copy of the album.");
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
var b=$("bStudio"),sure=0;
cv=$("stCv");cx=cv.getContext("2d");
/* the composing screen needs a mouse, keys and room: it is not offered on a touch screen or in a narrow window */
b.hidden=isTouch||window.innerWidth<900;
b.addEventListener("click",function(){setStudio(!studioOpen);wakeHud();});
$("stClose").addEventListener("click",function(){setStudio(false);});
$("stPlay").addEventListener("click",function(){$("bPlay").click();});
$("stPrev").addEventListener("click",function(){plGo(pPos()>3?plAt():plAt()-1);});
$("stNext").addEventListener("click",function(){plGo(plAt()+1);});
$("stKeep").addEventListener("click",function(){keep=!keep;sync();toast(keep?"What you change by hand is written into the score at the moment the music is at.":"Your changes are not written into the score.");});
$("stTpl").addEventListener("change",function(){if(playI()<0){toast("Nothing is playing. Press twice in the By chance lane to write this at a moment.");return;}if(!playing())showTrack(playI());put(pPos(),"journey",this.value);});
SC_KINDS.forEach(function(k){var o;if(k==="journey")return;o=document.createElement("option");o.value=k;o.textContent=ST_LANE_NAME[k];$("stTrayKind").appendChild(o);});
$("stTrayKind").addEventListener("change",function(){fillTray(true);});
cv.addEventListener("dragover",function(e){if(track())e.preventDefault();});cv.addEventListener("drop",drop);
$("stDel").addEventListener("click",removePick);
/* how the chosen change of world is made: behind a transition, or through a doorway that opens at that moment */
$("stCut").addEventListener("click",function(){
  var tr=track(),c=tr&&tr.cues[pick],p=pick;
  if(!c||c[1]!=="world"){toast("Click a change of world on the timeline first.");return;}
  edit(function(cues,marks){cues[p]=c[3]?[c[0],c[1],c[2]]:[c[0],c[1],c[2],"door"];return {cues:cues,marks:marks};});
  pick=p;say("World "+c[2]+" at "+stClock(c[0])+(c[3]?": behind a transition.":": a doorway to it opens at that moment, and the flight goes through. Where there cannot be a doorway, a transition."));
});
$("stTake").addEventListener("click",function(){if(tape)takeStop("");else takeStart();});
$("stScore").addEventListener("change",function(){scoreSet(this.value===""?null:scores[+this.value]||null);});
$("stUndo").addEventListener("click",function(){goBack("","r");});
$("stRedo").addEventListener("click",function(){goBack("r","");});
$("stDraft").addEventListener("click",function(){draftAlbum(false);});
$("stEmpty").addEventListener("click",function(){draftAlbum(true);});
$("stSave").addEventListener("click",savePack);
$("stRemove").addEventListener("click",function(){
  var sc=scoreUse(),now=performance.now();
  if(!sc){toast("There is no score in use.");return;}
  if(now-sure>4000){sure=now;toast("Press again to remove the score "+sc.name+" for good.");return;}
  sure=0;scoreRemove(sc.name);toast("Removed.");
});
$("stName").addEventListener("change",function(){
  var v=cleanName(this.value);
  if(!scoreRename(v))toast("Another score has that name, or it is empty.");
  this.value=scoreUse()?scoreUse().name:"";
});
cv.addEventListener("pointerdown",down);cv.addEventListener("pointermove",move);cv.addEventListener("pointerup",up);cv.addEventListener("pointercancel",function(){drag=null;});
cv.addEventListener("wheel",wheel,{passive:false});cv.addEventListener("dblclick",twice);
/* keys, while the screen is open and no box is being typed in. They are taken before the flying keys see them. */
window.addEventListener("keydown",function(e){
  var t=e.target&&e.target.tagName;
  if(!studioOpen||t==="INPUT"||t==="TEXTAREA"||t==="SELECT")return;
  if(e.code==="Delete"||e.code==="Backspace"){if(pick>=0||pickTake>=0||pickPt){e.preventDefault();e.stopImmediatePropagation();removePick();}}
  else if(e.code==="KeyZ"&&(e.ctrlKey||e.metaKey)){e.preventDefault();e.stopImmediatePropagation();if(e.shiftKey)goBack("r","");else goBack("","r");}
  else if(e.code==="KeyY"&&(e.ctrlKey||e.metaKey)){e.preventDefault();e.stopImmediatePropagation();goBack("r","");}
  else if(e.code==="Enter"){e.preventDefault();e.stopImmediatePropagation();$("bPlay").click();}
},true);
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={ST_CURVE, ST_CURVE_NAME, ST_CURVE_HINT, get stPickPt(){return pickPt},set stPickPt(v){pickPt=v},
  ST_ALBUM, stAlbumAt, stShowTrack:showTrack, stFillTray:fillTray, stDrop:drop, stPlayI:playI, get stFollow(){return follow},set stFollow(v){follow=v},
  ST_GUT, ST_RULER, ST_WAVE, ST_LANE, ST_UNDO, ST_LANE_NAME, stStep, stClock, stZoom, stSnap, stPut, stLanes, setStudio, studioFrame, stView:view, stUndoList:undo, stWas:was,
  stTakeStart:takeStart, stTakeStop:takeStop, get stTape(){return tape}, get stPickTake(){return pickTake},set stPickTake(v){pickTake=v},
  stTrack:track, stEdit:edit, stGoBack:goBack, stPutCue:put, stRemovePick:removePick, stDraw:draw, stUnder:under, stSavePack:savePack, stFillTpl:fillTpl,
  get studioOpen(){return studioOpen}, get stPick(){return pick},set stPick(v){pick=v}, get stLoop(){return loop},set stLoop(v){loop=v}, get stKeep(){return keep},set stKeep(v){keep=v}, get stRows(){return rows}};
