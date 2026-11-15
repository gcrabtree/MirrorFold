/* How it works: the lessons. A panel over the whole page with, for each step, a drawing to drag, a few sentences, something
   to try, and the name school gives the idea. The words come from lang/<language>.json (lang.js), the list of steps from
   lessons.js, the drawings from figures.js. A voice can read each step: sound files made ahead of time by tools/voice.py.
   While the panel is open the worlds are not drawn (frame() in loop.js draws the lesson instead). */
import { master } from "./audio.js";
import { $, toast } from "./dom.js";
import { requestWorld } from "./choose.js";
import { FIGS, snapTo } from "./figures.js";
import { LOOK_FIGS } from "./figures-look.js";
import { MORE_FIGS } from "./figures-more.js";
import { SPACE_FIGS } from "./figures-space.js";
import { WORLDS } from "./worlds.js";
import { wakeHud } from "./input.js";
import { lang, loadLang, t } from "./lang.js";
import { PARTS, TRACKS, chaptersOf, partKey, voiceName } from "./lessons.js";
export let learnOpen=false;  /* the panel is showing */
let panel,cv;                /* the panel and the drawing's canvas */
let track=0,at=-1;           /* which track, and which of its steps is showing (-1 for the index) */
let lastAt=-1;               /* the step of that track last shown, which the index marks (-1 for none yet) */
let fig=null,st=null;        /* the step's drawing and its state */
let dragging=false;
let liveAt=0;                /* when a drawing whose numbers change by themselves last had them written */
let byKey=false;             /* a slider is being moved by the keyboard, so it is not pulled to key points (it could not step past one) */
const STICK_PX=11;           /* how near a key point, in screen pixels, a dragged dot is pulled onto it */
const STICK_PART=0.02;       /* the same for a slider, as a part of its whole range */
let voiceOn=false,aud=null;  /* the voice is wanted; the player */
let ducked=-1;               /* the music's loudness before the voice turned it down (-1 when it has not) */
const VOICE_KEY="mirrorfold-voice",AT_KEY="mirrorfold-learn";

function el(tag,text,cls){var e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;}
/* the music plays more quietly while the voice speaks, and comes back afterwards */
function duck(on){
  if(!master)return;
  if(on&&ducked<0){ducked=master.gain.value;master.gain.value=ducked*.25;}
  if(!on&&ducked>=0){master.gain.value=ducked;ducked=-1;}
}
function hush(){if(aud){aud.pause();}duck(false);}
/* read the step that is showing, if the voice is wanted */
function speak(){
  hush();
  if(!voiceOn||at<0||!learnOpen)return;
  aud.src=voiceName(lang,TRACKS[track].id,TRACKS[track].steps[at]);
  var p=aud.play();
  if(p&&p.catch)p.catch(function(e){if(e&&e.name==="AbortError")return;duck(false);toast(t("learn.voiceFail"));});
}
export function setVoice(on){
  voiceOn=!!on;
  try{localStorage.setItem(VOICE_KEY,voiceOn?"on":"off")}catch(_){}
  var b=$("lnVoice");b.textContent=t(voiceOn?"learn.voiceOn":"learn.voiceOff");b.setAttribute("aria-pressed",voiceOn?"true":"false");
  speak();
}
/* the numbers under the drawing, and the words beside each slider */
function readout(){
  var i,rows=$("lnCtl").children;
  $("lnRead").textContent=fig&&fig.read?fig.read(st,t).join("\n"):"";
  for(i=0;fig&&fig.ctl&&i<fig.ctl.length;i++){rows[i].firstChild.textContent=fig.ctl[i].label(st,t);rows[i].lastChild.value=st[fig.ctl[i].k];}
  if(fig&&fig.walk){ /* which hop is being looked at, and whether there is one before it and after it */
    i=fig.walk(st);st.k=Math.max(0,Math.min(i,st.k));
    $("lnHopAt").textContent=st.k?t(fig.moves?"learn.moveAt":"learn.hopAt",st.k,i):t(fig.moves?"learn.moveAll":"learn.hopAll");
    $("lnPrevHop").disabled=st.k<=0;$("lnNextHop").disabled=st.k>=i;
    $("lnRead").textContent=fig.read(st,t).join("\n");
  }
  rows=$("lnKeys").children;
  for(i=0;fig&&fig.keys&&i<fig.keys.length;i++)rows[i].textContent=fig.keys[i].label(st,t);
}
/* Show a step of the track, or the list of steps for -1. */
export function showStep(i,tr){
  var T,id,box,k;
  if(tr!==undefined&&tr!==track){track=Math.max(0,Math.min(TRACKS.length-1,tr));lastAt=-1;}
  T=TRACKS[track];
  at=Math.max(-1,Math.min(T.steps.length-1,i));fig=null;st=null;dragging=false;
  if(at>=0)lastAt=at;
  try{localStorage.setItem(AT_KEY,track+":"+lastAt+(at<0?":index":""))}catch(_){}
  $("lnHome").hidden=at>=0;$("lnStep").hidden=at<0;panel.scrollTop=0;
  if(at<0){hush();index();return;}
  id=T.steps[at];fig=figOf(id);st=fig.init();
  $("lnCount").textContent=t("learn.count",at+1,T.steps.length);
  $("lnHead").textContent=t(partKey(T.id,id,"title"));
  $("lnText").textContent=t(partKey(T.id,id,"text"));
  $("lnDo").textContent="";$("lnDo").appendChild(el("strong",t("learn.doHead")));$("lnDo").appendChild(el("span",t(partKey(T.id,id,"do"))));
  $("lnName").textContent="";$("lnName").appendChild(el("strong",t("learn.nameHead")));$("lnName").appendChild(el("span",t(partKey(T.id,id,"name"))));
  /* the step's sliders */
  box=$("lnCtl");box.textContent="";
  (fig.ctl||[]).forEach(function(c){
    var row=el("label","","lnRow"),r=document.createElement("input");
    r.type="range";r.min=c.min;r.max=c.max;r.step=c.step;r.value=st[c.k];
    r.addEventListener("keydown",function(){byKey=true});
    r.addEventListener("pointerdown",function(){byKey=false});
    r.addEventListener("input",function(){
      var v=+r.value;
      if(c.keys&&!byKey)v=snapTo(v,c.keys,(c.max-c.min)*STICK_PART);
      st[c.k]=v;if(fig.changed)fig.changed(st);readout();
    });
    row.appendChild(el("span",""));row.appendChild(r);box.appendChild(row);
  });
  /* a button for each key point */
  box=$("lnKeys");box.textContent="";
  (fig.keys||[]).forEach(function(k){
    var b=el("button","");b.type="button";
    b.addEventListener("click",function(){k.set(st);if(fig.changed)fig.changed(st);readout();});
    box.appendChild(b);
  });
  /* a step about a world has a button that goes and flies through it */
  if(fig.world){
    k=el("button",t("learn.fly"),"advGo");k.type="button";
    k.addEventListener("click",function(){var j;for(j=0;j<WORLDS.length;j++)if(WORLDS[j].id===fig.world){closeLearn();requestWorld(j);return;}});
    box.appendChild(k);
  }
  $("lnWalk").hidden=!fig.walk;
  $("lnPrevHop").textContent=t(fig.moves?"learn.prevMove":"learn.prevHop");$("lnNextHop").textContent=t(fig.moves?"learn.nextMove":"learn.nextHop");
  $("lnBack").disabled=at===0;
  $("lnNext").textContent=t(at===T.steps.length-1?"learn.list":"learn.next");
  readout();speak();
}
/* the drawing for a step, from whichever file holds it */
export function figOf(id){return FIGS[id]||SPACE_FIGS[id]||MORE_FIGS[id]||LOOK_FIGS[id];}
/* The index: every track, with its chapters, and in each chapter a button for each step. Tracks and chapters fold shut;
   the ones holding the step last shown start open, and that step is marked. */
function index(){
  var list=$("lnList");
  list.textContent="";
  TRACKS.forEach(function(T,ti){
    var D=el("details","","lnTrack"),S=el("summary","");
    S.appendChild(el("span",(ti+1)+". "+t("learn.track."+T.id)));S.appendChild(el("small",t("learn.steps",T.steps.length)));
    D.appendChild(S);D.open=ti===track;
    chaptersOf(T).forEach(function(C){
      var d=el("details","","lnChap"),s=el("summary",""),i;
      s.appendChild(el("span",t("learn.chapter."+T.id+"."+C.id)));s.appendChild(el("small",(C.from+1)+" – "+(C.from+C.n)));
      d.appendChild(s);d.open=ti===track&&lastAt>=C.from&&lastAt<C.from+C.n;
      for(i=C.from;i<C.from+C.n;i++)(function(i){
        var here=ti===track&&i===lastAt,b=el("button",(i+1)+". "+t(partKey(T.id,T.steps[i],"title"))+(here?"  ("+t("learn.here")+")":""));
        b.type="button";if(here)b.setAttribute("aria-current","step");
        b.addEventListener("click",function(){showStep(i,ti)});d.appendChild(b);
      })(i);
      D.appendChild(d);
    });
    list.appendChild(D);
  });
}
/* fill in the words that do not change from step to step */
function dress(){
  $("lnTitle").textContent=t("learn.title");$("lnClose").textContent=t("learn.close");
  $("lnIntro").textContent=t("learn.intro");
  $("lnBack").textContent=t("learn.back");$("lnAll").textContent=t("learn.list");
  cv.setAttribute("aria-label",t("learn.figure"));
  setVoice(voiceOn);
}
/* Open the lessons, at the step the reader was last on. The words are fetched the first time. */
export function openLearn(){
  loadLang(function(ok){
    var was=-1,tr=0,m,home=true;
    if(!ok){toast("The lessons could not be loaded.");return;}
    learnOpen=true;panel.hidden=false;dress();
    try{m=/^(\d+):(-?\d+)(:index)?$/.exec(localStorage.getItem(AT_KEY)||"");if(m){tr=Math.min(TRACKS.length-1,+m[1]);was=+m[2];home=!!m[3]||was<0;}}catch(_){}
    track=tr;lastAt=Math.min(was,TRACKS[tr].steps.length-1);
    showStep(home?-1:lastAt,tr);
  });
}
export function closeLearn(){if(!learnOpen)return;hush();learnOpen=false;panel.hidden=true;wakeHud();}
/* a step of frame(), taken in place of all the others while the panel is open: draw the step's drawing */
export function learnFrame(now){
  var r,d,W,H;
  if(!fig)return;
  r=cv.getBoundingClientRect();d=Math.min(2,window.devicePixelRatio||1);W=Math.round(r.width*d);H=Math.round(r.height*d);
  if(W<2||H<2)return;
  if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H;}
  fig.draw(cv.getContext("2d"),W,H,st,now,t,d);
  if(fig.live&&now-liveAt>150){liveAt=now;$("lnRead").textContent=fig.read(st,t).join("\n");} /* numbers that change by themselves */
}
function pointerAt(e,first){
  var r=cv.getBoundingClientRect();
  if(!fig||!fig.drag||!r.width)return;
  fig.drag((e.clientX-r.left)/r.width*cv.width,(e.clientY-r.top)/r.height*cv.height,st,cv.width,cv.height,STICK_PX*cv.width/r.width,first);readout();
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
panel=$("learn");cv=$("lnCv");
aud=new Audio();aud.preload="none";
aud.addEventListener("playing",function(){duck(true)});
aud.addEventListener("ended",function(){duck(false)});
aud.addEventListener("pause",function(){duck(false)});
try{voiceOn=localStorage.getItem(VOICE_KEY)==="on"}catch(_){}
$("bLearn").addEventListener("click",openLearn);
$("lnClose").addEventListener("click",closeLearn);
$("lnVoice").addEventListener("click",function(){setVoice(!voiceOn)});
$("lnPrevHop").addEventListener("click",function(){if(st){st.k--;readout();}});
$("lnNextHop").addEventListener("click",function(){if(st){st.k++;readout();}});
$("lnBack").addEventListener("click",function(){showStep(at-1)});
$("lnAll").addEventListener("click",function(){showStep(-1)});
$("lnNext").addEventListener("click",function(){showStep(at===TRACKS[track].steps.length-1?-1:at+1)});
cv.addEventListener("pointerdown",function(e){dragging=true;try{cv.setPointerCapture(e.pointerId)}catch(_){}pointerAt(e,true);e.preventDefault();});
cv.addEventListener("pointermove",function(e){if(dragging)pointerAt(e,false)});
cv.addEventListener("pointerup",function(){dragging=false});
cv.addEventListener("pointercancel",function(){dragging=false});
/* While the panel is open the keys are the lesson's: Escape shuts it, the arrows move what the drawing lets you drag, and
   none of them reaches the flying controls (this listener runs before theirs and stops the key there). */
window.addEventListener("keydown",function(e){
  var dx,dy;
  if(!learnOpen)return;
  e.stopPropagation();
  if(e.code==="Escape"){closeLearn();return;}
  if(document.activeElement!==cv||!fig||!fig.key)return;
  dx=e.code==="ArrowRight"?1:e.code==="ArrowLeft"?-1:0;dy=e.code==="ArrowUp"?1:e.code==="ArrowDown"?-1:0;
  if(dx||dy){fig.key(dx,dy,st);readout();e.preventDefault();}
},true);
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={figOf, index, openLearn, closeLearn, showStep, setVoice, learnFrame, readout, speak, hush, duck,
  get learnOpen(){return learnOpen},set learnOpen(v){learnOpen=v}, get learnAt(){return at},set learnAt(v){at=v}, get learnFig(){return fig}, get learnSt(){return st},
  get voiceOn(){return voiceOn},set voiceOn(v){voiceOn=v}, get aud(){return aud},set aud(v){aud=v}, get ducked(){return ducked},set ducked(v){ducked=v},
  get learnTrack(){return track},set learnTrack(v){track=v}};
