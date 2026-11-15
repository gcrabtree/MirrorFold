/* How it works: the lessons. A panel over the whole page with, for each step, a drawing to drag, a few sentences, something
   to try, and the name school gives the idea. The words come from lang/<language>.json (lang.js), the list of steps from
   lessons.js, the drawings from figures.js. A voice can read each step: sound files made ahead of time by tools/voice.py.
   While the panel is open the worlds are not drawn (frame() in loop.js draws the lesson instead). */
import { master } from "./audio.js";
import { $, toast } from "./dom.js";
import { FIGS } from "./figures.js";
import { wakeHud } from "./input.js";
import { lang, loadLang, t } from "./lang.js";
import { PARTS, TRACKS, partKey, voiceName } from "./lessons.js";
export let learnOpen=false;  /* the panel is showing */
let panel,cv;                /* the panel and the drawing's canvas */
let track=0,at=-1;           /* which track, and which of its steps is showing (-1 for the list of steps) */
let fig=null,st=null;        /* the step's drawing and its state */
let dragging=false;
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
}
/* Show a step of the track, or the list of steps for -1. */
export function showStep(i){
  var T=TRACKS[track],id,box,k;
  at=Math.max(-1,Math.min(T.steps.length-1,i));fig=null;st=null;dragging=false;
  try{localStorage.setItem(AT_KEY,String(at))}catch(_){}
  $("lnHome").hidden=at>=0;$("lnStep").hidden=at<0;panel.scrollTop=0;
  if(at<0){hush();return;}
  id=T.steps[at];fig=FIGS[id];st=fig.init();
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
    r.addEventListener("input",function(){st[c.k]=+r.value;if(fig.changed)fig.changed(st);readout();});
    row.appendChild(el("span",""));row.appendChild(r);box.appendChild(row);
  });
  $("lnBack").disabled=at===0;
  $("lnNext").textContent=t(at===T.steps.length-1?"learn.list":"learn.next");
  readout();speak();
}
/* fill in the words that do not change from step to step, and the list of steps */
function dress(){
  var T=TRACKS[track],list=$("lnList");
  $("lnTitle").textContent=t("learn.title");$("lnClose").textContent=t("learn.close");
  $("lnIntro").textContent=t("learn.intro");$("lnTrack").textContent=t("learn.track."+T.id);
  $("lnBack").textContent=t("learn.back");$("lnAll").textContent=t("learn.list");
  cv.setAttribute("aria-label",t("learn.figure"));
  list.textContent="";
  T.steps.forEach(function(id,i){
    var b=el("button",(i+1)+". "+t(partKey(T.id,id,"title")));b.type="button";
    b.addEventListener("click",function(){showStep(i)});list.appendChild(b);
  });
  setVoice(voiceOn);
}
/* Open the lessons, at the step the reader was last on. The words are fetched the first time. */
export function openLearn(){
  loadLang(function(ok){
    var was=-1;
    if(!ok){toast("The lessons could not be loaded.");return;}
    learnOpen=true;panel.hidden=false;dress();
    try{was=parseInt(localStorage.getItem(AT_KEY),10);if(!(was>=0))was=-1;}catch(_){}
    showStep(was);
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
}
function pointerAt(e){
  var r=cv.getBoundingClientRect();
  if(!fig||!fig.drag||!r.width)return;
  fig.drag((e.clientX-r.left)/r.width*cv.width,(e.clientY-r.top)/r.height*cv.height,st,cv.width,cv.height);readout();
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
$("lnBack").addEventListener("click",function(){showStep(at-1)});
$("lnAll").addEventListener("click",function(){showStep(-1)});
$("lnNext").addEventListener("click",function(){showStep(at===TRACKS[track].steps.length-1?-1:at+1)});
cv.addEventListener("pointerdown",function(e){dragging=true;try{cv.setPointerCapture(e.pointerId)}catch(_){}pointerAt(e);e.preventDefault();});
cv.addEventListener("pointermove",function(e){if(dragging)pointerAt(e)});
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
export const __dbg={openLearn, closeLearn, showStep, setVoice, learnFrame, readout, speak, hush, duck,
  get learnOpen(){return learnOpen},set learnOpen(v){learnOpen=v}, get learnAt(){return at},set learnAt(v){at=v}, get learnFig(){return fig}, get learnSt(){return st},
  get voiceOn(){return voiceOn},set voiceOn(v){voiceOn=v}, get aud(){return aud},set aud(v){aud=v}, get ducked(){return ducked},set ducked(v){ducked=v},
  get learnTrack(){return track},set learnTrack(v){track=v}};
