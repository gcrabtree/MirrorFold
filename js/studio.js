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
import { $, isTouch, toast } from "./dom.js";
import { wakeHud } from "./input.js";
import { allT, jCur, jMade, store } from "./journey.js";
import { musicMode } from "./listen.js";
import { cleanName } from "./packs.js";
import { SC_GAP, SC_KINDS, SC_NEAR, SC_SOFT } from "./scoredata.js";
import { draftAlbum, hearFile, heardFile } from "./scoremake.js";
import { scMade, scoreEdit, scoreNow, scoreRemove, scoreRename, scoreUse } from "./scoreplay.js";
import { still } from "./still.js";
import { resize } from "./targets.js";
export const ST_GUT=96,ST_RULER=20,ST_WAVE=56,ST_LANE=22; /* the timeline's measures in CSS pixels: the lanes' names, the ruler, the music, one lane */
export const ST_UNDO=100;    /* how many changes can be undone */
export const ST_LANE_NAME={journey:"By chance",world:"World",palette:"Palette",mirrors:"Mirrors",motion:"Motion",filter:"Filter",overlay:"Overlay",surface:"Surface",land:"Land",packing:"Packing",pulse:"Pulse",shapes:"Shapes",inside:"Inside out",dance:"Dance style"};
export let studioOpen=false;
let cv=null,cx=null;         /* the timeline's canvas and its drawing context */
const view={a:0,b:1,ti:-1};  /* the seconds shown from left to right, and the track they belong to */
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

function track(){var n=scoreNow(),sc=scoreUse();return sc&&n?sc.tracks[n.i]:null;}
function ti(){var n=scoreNow();return n?n.i:-1;}
function xOf(t,W){return ST_GUT+(t-view.a)/(view.b-view.a)*(W-ST_GUT);}
function tOf(x,W){return view.a+(x-ST_GUT)/(W-ST_GUT)*(view.b-view.a);}
function say(text){$("stSay").textContent=text;}
/* Change the playing track: fn is given copies of its cues and marks and returns the new {cues, marks}, or null for no change. */
function edit(fn){
  var tr=track(),i=ti(),got,u;
  if(!tr)return false;
  got=fn(tr.cues.map(function(c){return c.slice();}),tr.marks.slice());
  if(!got)return false;
  u=undo[i]||(undo[i]=[]);u.push(JSON.stringify({cues:tr.cues,marks:tr.marks}));if(u.length>ST_UNDO)u.shift();
  undo["r"+i]=[];
  return scoreEdit(i,got.cues,got.marks);
}
function goBack(from,to){
  var tr=track(),i=ti(),a=undo[from+i],s;
  if(!tr||!a||!a.length){toast(from?"Nothing to do again.":"Nothing to undo.");return;}
  s=JSON.parse(a.pop());
  (undo[to+i]||(undo[to+i]=[])).push(JSON.stringify({cues:tr.cues,marks:tr.marks}));
  scoreEdit(i,s.cues,s.marks);pick=-1;
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
function removePick(){
  var tr=track(),c=tr&&tr.cues[pick];
  if(!c){toast("Click a change on the timeline first.");return;}
  edit(function(cues,marks){cues.splice(pick,1);return {cues:cues,marks:marks};});
  pick=-1;say("Removed "+ST_LANE_NAME[c[1]]+" "+(c[2]||"none")+" at "+stClock(c[0]));
}

function draw(){
  var tr=track(),dpr=window.devicePixelRatio||1,W=cv.clientWidth,H,i,k,x,x1,t,step,an,y,c,n,lane,list,pos,j,nx,css=getComputedStyle(document.body);
  rows=tr?stLanes(tr.cues):[];
  H=ST_RULER+ST_WAVE+Math.max(3,rows.length)*ST_LANE+2;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);cv.style.height=H+"px";}
  cx.setTransform(dpr,0,0,dpr,0,0);
  cx.fillStyle="#0b0716";cx.fillRect(0,0,W,H);
  cx.font="11px "+(css.getPropertyValue("--body")||"monospace");cx.textBaseline="middle";
  if(!tr){
    cx.fillStyle="rgba(243,236,255,.62)";
    cx.fillText(!plCount()?"Choose the audio files of your album (Music: My audio file), then press Draft a score or Start empty.":!scoreUse()?"Press Draft a score to have a first one written from the music, or Start empty.":"The file that is playing is not one of this score's tracks.",12,H/2);
    return;
  }
  if(view.ti!==ti()){view.ti=ti();view.a=0;view.b=tr.len;pick=-1;loop=null;}
  /* the ruler */
  step=stStep((W-ST_GUT)/(view.b-view.a));
  cx.fillStyle="rgba(243,236,255,.62)";cx.strokeStyle="rgba(243,236,255,.22)";cx.lineWidth=1;
  for(t=Math.ceil(view.a/step)*step;t<=view.b;t+=step){x=Math.round(xOf(t,W))+0.5;cx.beginPath();cx.moveTo(x,ST_RULER-6);cx.lineTo(x,ST_RULER);cx.stroke();cx.fillText(stClock(t).replace(/\.0$/,""),x+3,ST_RULER/2);}
  /* the music as it was heard: loudness as bars, fullness as a line */
  an=heardFile(plFile(plAt()));y=ST_RULER;
  cx.fillStyle="rgba(95,240,255,.08)";cx.fillRect(ST_GUT,y,W-ST_GUT,ST_WAVE);
  if(an){
    cx.fillStyle="rgba(95,240,255,.55)";
    for(x=ST_GUT;x<W;x++){i=Math.floor(tOf(x,W)*an.hz);if(i>=0&&i<an.en.length){n=an.en[i]/255*(ST_WAVE-4);cx.fillRect(x,y+ST_WAVE-n,1,n);}}
    cx.strokeStyle="#ff5fd2";cx.lineWidth=1.5;cx.beginPath();
    for(x=ST_GUT;x<W;x+=2){i=Math.floor(tOf(x,W)*an.hz);if(i>=0&&i<an.lv.length){n=y+ST_WAVE-2-an.lv[i]/255*(ST_WAVE-6);if(x===ST_GUT)cx.moveTo(x,n);else cx.lineTo(x,n);}}
    cx.stroke();
  }else{cx.fillStyle="rgba(243,236,255,.62)";cx.fillText(asked[plFile(plAt())&&plFile(plAt()).name]?"Listening to this track…":"This track has not been listened to.",ST_GUT+8,y+ST_WAVE/2);}
  cx.fillStyle="rgba(243,236,255,.62)";cx.fillText("Music",8,y+ST_WAVE/2);
  /* a passage played round and round */
  if(loop){cx.fillStyle="rgba(255,95,210,.16)";x=xOf(loop.a,W);cx.fillRect(Math.max(ST_GUT,x),0,xOf(loop.b,W)-Math.max(ST_GUT,x),H);}
  /* the lanes: each cue a block that lasts until the next of its kind */
  for(lane=0;lane<rows.length;lane++){
    k=rows[lane];y=ST_RULER+ST_WAVE+lane*ST_LANE;
    cx.fillStyle=lane%2?"rgba(243,236,255,.03)":"rgba(243,236,255,.06)";cx.fillRect(0,y,W,ST_LANE);
    cx.fillStyle="rgba(243,236,255,.8)";cx.fillText(ST_LANE_NAME[k],8,y+ST_LANE/2);
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
  /* the marks, over the music and the lanes */
  cx.strokeStyle="rgba(243,236,255,.35)";cx.lineWidth=1;cx.setLineDash([3,3]);
  for(i=0;i<tr.marks.length;i++){x=Math.round(xOf(tr.marks[i],W))+0.5;if(x<ST_GUT||x>W)continue;cx.beginPath();cx.moveTo(x,ST_RULER);cx.lineTo(x,H);cx.stroke();}
  cx.setLineDash([]);
  /* where the music is */
  pos=pPos();x=Math.round(xOf(pos,W))+0.5;
  if(x>=ST_GUT){cx.strokeStyle="#fff";cx.lineWidth=1;cx.beginPath();cx.moveTo(x,0);cx.lineTo(x,H);cx.stroke();}
  cx.fillStyle="#0b0716";cx.fillRect(0,0,ST_GUT,ST_RULER);cx.fillStyle="#f3ecff";cx.fillText(stClock(pos)+" / "+stClock(tr.len).replace(/\.\d$/,""),8,ST_RULER/2);
}
/* What is under a place on the timeline: {zone, t, k, i} with zone "top" (the ruler and the music) or "lane", the kind of that lane and the cue there (-1 for none). */
function under(e){
  var r=cv.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,W=r.width,tr=track(),o={zone:"",t:0,k:"",i:-1,W:W},lane,i,j,list,nx;
  if(!tr)return o;
  o.t=Math.max(0,Math.min(tr.len,tOf(Math.max(ST_GUT,x),W)));
  if(y<ST_RULER+ST_WAVE){o.zone="top";return o;}
  lane=Math.floor((y-ST_RULER-ST_WAVE)/ST_LANE);
  if(lane<0||lane>=rows.length)return o;
  o.zone="lane";o.k=rows[lane];
  list=[];for(i=0;i<tr.cues.length;i++)if(tr.cues[i][1]===o.k)list.push(i);
  for(j=0;j<list.length;j++){nx=j+1<list.length?tr.cues[list[j+1]][0]:tr.len;if(o.t>=tr.cues[list[j]][0]-3*(view.b-view.a)/(W-ST_GUT)&&o.t<nx)o.i=list[j];}
  return o;
}
function seek(t){pSeek(t);wakeHud();}
function down(e){
  var u=under(e),tr=track();
  if(!tr||e.button!==0)return;
  e.preventDefault();try{cv.setPointerCapture(e.pointerId)}catch(_){}
  if(u.zone==="lane"&&u.i>=0){pick=u.i;drag={kind:"cue",i:u.i,t:tr.cues[u.i][0],from:u.t,moved:false};say(ST_LANE_NAME[u.k]+" "+(tr.cues[u.i][2]||"none")+" at "+stClock(tr.cues[u.i][0])+". Drag to move it, Delete to remove it.");return;}
  pick=-1;
  if(u.zone==="top"&&e.shiftKey){drag={kind:"loop",a:u.t};loop={a:u.t,b:u.t};return;}
  drag={kind:"scrub",at:0};seek(u.t);
}
function move(e){
  var u,tr=track(),now,reach;
  if(!drag||!tr)return;
  u=under(e);reach=8*(view.b-view.a)/(u.W-ST_GUT);
  if(drag.kind==="scrub"){now=performance.now();if(now-drag.at>120){drag.at=now;seek(u.t);}}
  else if(drag.kind==="loop"){loop={a:Math.min(drag.a,u.t),b:Math.max(drag.a,u.t)};}
  else if(drag.kind==="cue"){
    if(Math.abs(u.t-drag.from)>reach/2)drag.moved=true;
    if(drag.moved)drag.t=Math.max(0,Math.min(tr.len,e.altKey?u.t:stSnap(tr.cues[drag.i][0]+u.t-drag.from,tr.marks,reach)));
  }
}
function up(e){
  var d=drag,tr=track(),c;
  drag=null;
  if(!d||!tr)return;
  if(d.kind==="scrub")seek(under(e).t);
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
  var u=under(e);
  if(u.zone==="lane")put(u.t,u.k,u.k==="journey"?$("stTpl").value:jCur(u.k));
}
function fillTpl(){
  var s=$("stTpl"),v=s.value,o;
  s.textContent="";
  o=document.createElement("option");o.value="";o.textContent="By chance: nothing";s.appendChild(o);
  allT().forEach(function(t){o=document.createElement("option");o.value=t.name;o.textContent="By chance: "+t.name;s.appendChild(o);});
  s.value=v;if(s.value!==v)s.value="";
}
function sync(){
  var sc=scoreUse(),n=$("stName");
  $("stKeep").setAttribute("aria-pressed",keep?"true":"false");$("stKeep").textContent="Keep my changes: "+(keep?"on":"off");
  if(document.activeElement!==n)n.value=sc?sc.name:"";
  n.disabled=!sc;
}
export function setStudio(on){
  on=!!on;
  if(on===studioOpen)return;
  studioOpen=on;$("studio").hidden=!on;document.body.classList.toggle("studio",on);
  $("bStudio").setAttribute("aria-pressed",on?"true":"false");
  if(on){SC_KINDS.forEach(function(k){if(k!=="journey")was[k]=jCur(k);delete scMade[k];delete jMade[k];}); /* notes from before the screen was open would be taken for this moment's */
    fillTpl();sync();view.ti=-1;}
  resize(); /* the picture is given the room the panel leaves */
}
/* A step of the frame, last of all: write down what was changed by hand, keep a passage going round, and draw the timeline. */
export function studioFrame(){
  var i,k,now,n,f,pos,tr;
  if(!studioOpen)return;
  n=scoreNow();tr=track();
  for(i=0;i<SC_KINDS.length;i++){
    k=SC_KINDS[i];if(k==="journey")continue;
    now=jCur(k);
    if(now===was[k])continue;
    was[k]=now;
    /* the score asked for it, or Journey chose it: not the user's doing */
    if(scMade[k]===now){delete scMade[k];continue;}
    if(jMade[k]===now){delete jMade[k];continue;}
    if(keep&&tr&&!still&&musicMode==="file")put(pPos(),k,now);
  }
  if(loop&&tr&&player.mode&&pPos()>=loop.b)pSeek(loop.a);
  /* a track that has not been listened to is, once, so that its music can be drawn */
  f=plFile(plAt());
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
$("stTpl").addEventListener("change",function(){if(track())put(pPos(),"journey",this.value);});
$("stDel").addEventListener("click",removePick);
/* how the chosen change of world is made: behind a transition, or through a doorway that opens at that moment */
$("stCut").addEventListener("click",function(){
  var tr=track(),c=tr&&tr.cues[pick],p=pick;
  if(!c||c[1]!=="world"){toast("Click a change of world on the timeline first.");return;}
  edit(function(cues,marks){cues[p]=c[3]?[c[0],c[1],c[2]]:[c[0],c[1],c[2],"door"];return {cues:cues,marks:marks};});
  pick=p;say("World "+c[2]+" at "+stClock(c[0])+(c[3]?": behind a transition.":": a doorway to it opens at that moment, and the flight goes through. Where there cannot be a doorway, a transition."));
});
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
  if(e.code==="Delete"||e.code==="Backspace"){if(pick>=0){e.preventDefault();e.stopImmediatePropagation();removePick();}}
  else if(e.code==="KeyZ"&&(e.ctrlKey||e.metaKey)){e.preventDefault();e.stopImmediatePropagation();if(e.shiftKey)goBack("r","");else goBack("","r");}
  else if(e.code==="KeyY"&&(e.ctrlKey||e.metaKey)){e.preventDefault();e.stopImmediatePropagation();goBack("r","");}
  else if(e.code==="Enter"){e.preventDefault();e.stopImmediatePropagation();$("bPlay").click();}
},true);
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={ST_GUT, ST_RULER, ST_WAVE, ST_LANE, ST_UNDO, ST_LANE_NAME, stStep, stClock, stZoom, stSnap, stPut, stLanes, setStudio, studioFrame, stView:view, stUndoList:undo, stWas:was,
  stTrack:track, stEdit:edit, stGoBack:goBack, stPutCue:put, stRemovePick:removePick, stDraw:draw, stUnder:under, stSavePack:savePack, stFillTpl:fillTpl,
  get studioOpen(){return studioOpen}, get stPick(){return pick},set stPick(v){pick=v}, get stLoop(){return loop},set stLoop(v){loop=v}, get stKeep(){return keep},set stKeep(v){keep=v}, get stRows(){return rows}};
