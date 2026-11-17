/* The groups of controls that open one at a time, opening the setup panel, and the remaining buttons. */
import { progSync, scene } from "./choose.js";
import { $, toast } from "./dom.js";
import { press, wakeHud } from "./input.js";
import { adv, openAdv } from "./journey-panel.js";
import { journey, setJourney } from "./journey.js";
import { landFx, landMode, landTint, setLand, setLandFx, setLandTint } from "./land.js";
import { encodeSpot } from "./spots.js";
import { FX, SURFACES, sel } from "./state.js";
import { DETAIL, di, resize, setDetail } from "./targets.js";
export let orbsOn=true,drift=true; /* the Orbs and Drift switches */
export let morph=2;       /* Morph: 0 off, 1 the worlds change shape slowly by themselves, 2 their shape follows the song (and by themselves while there is no sound to follow) */
export const MORPHS=["off","drifts","follows song"];
export function setMorph(i){morph=((i%3)+3)%3;press($("bMorph"),morph>0);$("bMorph").textContent="Morph "+MORPHS[morph];}
let de0;
export let panelOpen=false; /* the panel of controls is showing */
/* The panel: every control that is not in the bar, under headings that fold. It stays until it is shut. */
export function setPanel(on){
  panelOpen=!!on;$("panel").hidden=!panelOpen;$("bPanel").setAttribute("aria-expanded",panelOpen?"true":"false");
  document.body.classList.toggle("panelOpen",panelOpen);
  if(!panelOpen&&$("panFind").value){$("panFind").value="";panFilter("");}
}
function secSet(sec,open){
  if(open)sec.setAttribute("data-open","1");else sec.removeAttribute("data-open");
  sec.querySelector(".secHead").setAttribute("aria-expanded",open?"true":"false");
}
function secSave(){
  var open=[];
  Array.prototype.forEach.call(document.querySelectorAll("#panel .sec"),function(s){if(s.hasAttribute("data-open"))open.push(s.getAttribute("data-name"));});
  try{localStorage.setItem("mirrorfold-panel",JSON.stringify(open))}catch(_){}
}
/* Does a control's name hold every word asked for? Free of the page. */
export function panMatch(text,q){
  var t=String(text).toLowerCase(),w=String(q).toLowerCase().split(/\s+/).filter(function(x){return x;}),i;
  for(i=0;i<w.length;i++)if(t.indexOf(w[i])<0)return false;
  return true;
}
/* Show only the controls whose names hold the words typed, whatever heading they are under; with nothing typed, everything as it was. */
function panFilter(q){
  var any=false,on=!!q.trim();
  $("panel").classList.toggle("finding",on);
  Array.prototype.forEach.call(document.querySelectorAll("#panel .sec"),function(sec){
    var some=false;
    Array.prototype.forEach.call(sec.querySelector(".secBody").children,function(el){
      var hit=!on||(el.tagName!=="SELECT"&&panMatch(el.textContent+" "+sec.getAttribute("data-name"),q));
      el.classList.toggle("nf",!hit);if(hit&&el.tagName!=="SELECT"&&!el.hidden)some=true;
    });
    sec.classList.toggle("nf",on&&!some);if(some)any=true;
  });
  $("panNone").hidden=!on||any;
}
/* Bring a control into sight: the panel open, its heading unfolded. For when something elsewhere needs the user to press it. */
export function showControl(id){
  var el=$(id),sec=el&&el.closest?el.closest(".sec"):null;
  setPanel(true);
  if(sec)secSet(sec,true);
  if(el&&el.scrollIntoView)el.scrollIntoView({block:"center"});
}
export function setFx(i){sel.fi=FX[i]?i:0;$("bFx").textContent="FX "+FX[sel.fi].name;}
export function setSurface(i){
  sel.si=SURFACES[i]?i:0;
  if(!progSync()){sel.si=0;progSync();toast("The chrome surface does not work on this device.");} /* chrome is in a set of programs of its own (js/programs.js) */
  $("bSurf").textContent="Surface "+SURFACES[sel.si].name;
}




/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
$("bPanel").addEventListener("click",function(){setPanel(!panelOpen);wakeHud()});
$("panClose").addEventListener("click",function(){setPanel(false)});
$("panFind").addEventListener("input",function(){panFilter(this.value)});
window.addEventListener("keydown",function(e){if(e.code==="Escape"&&panelOpen&&$("pick").hidden)setPanel(false)});
(function(){
  var open=null;
  try{open=JSON.parse(localStorage.getItem("mirrorfold-panel")||"null")}catch(_){}
  Array.prototype.forEach.call(document.querySelectorAll("#panel .sec"),function(sec){
    if(Array.isArray(open))secSet(sec,open.indexOf(sec.getAttribute("data-name"))>=0);
    sec.querySelector(".secHead").addEventListener("click",function(){secSet(sec,!sec.hasAttribute("data-open"));secSave();});
  });
})();
try{orbsOn=localStorage.getItem("mirrorfold-orbs")!=="off"}catch(_){}
$("bAdv").addEventListener("click",function(){openAdv(false)});
$("bLib").addEventListener("click",function(){openAdv(true)});
$("advClose").addEventListener("click",function(){adv.hidden=true;wakeHud()});
$("bOrbs").addEventListener("click",function(){
  orbsOn=!orbsOn;press(this,orbsOn);try{localStorage.setItem("mirrorfold-orbs",orbsOn?"on":"off")}catch(_){}
  toast(orbsOn?"Orbs on":"Orbs hidden");wakeHud();
});
press($("bOrbs"),orbsOn);
$("bShare").addEventListener("click",function(){
  var h=encodeSpot(),url=location.href.split("#")[0]+"#"+h;
  scene.lastHash=h;try{location.hash=h}catch(_){}
  var fail=function(){toast("Spot saved to this page's address. Copy it from the address bar.")};
  try{navigator.clipboard.writeText(url).then(function(){toast("Link to this exact spot copied.")},fail);}catch(_){fail();}
  wakeHud();
});
$("bJourney").addEventListener("click",function(){setJourney(!journey);wakeHud()});
$("bLand").addEventListener("click",function(){setLand((landMode+1)%3);wakeHud()});
$("bLandTint").addEventListener("click",function(){setLandTint((landTint+1)%3);wakeHud()});
$("bLandFx").addEventListener("click",function(){setLandFx((landFx+1)%3);wakeHud()});
setFx(sel.fi);
$("bDetail").addEventListener("click",function(){
  setDetail((di+1)%DETAIL.length);
  this.textContent="Detail "+DETAIL[di];resize();wakeHud();
});
setMorph(morph);
$("bMorph").addEventListener("click",function(){setMorph(morph+1);toast(morph===2?"The worlds' shape follows the song":morph?"The worlds change shape by themselves":"The worlds keep their shape");wakeHud()});
$("bDrift").addEventListener("click",function(){drift=!drift;press(this,drift);wakeHud()});
de0=document.documentElement;
if(!(de0.requestFullscreen||de0.webkitRequestFullscreen))$("bFull").style.display="none";
$("bFull").addEventListener("click",function(){
  try{
    if(document.fullscreenElement||document.webkitFullscreenElement){(document.exitFullscreen||document.webkitExitFullscreen).call(document);}
    else{var p=(de0.requestFullscreen||de0.webkitRequestFullscreen).call(de0);if(p&&p.catch)p.catch(function(){});}
  }catch(_){}
  wakeHud();
});
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={MORPHS, setMorph, setFx, setSurface, setPanel, panMatch, panFilter, showControl, secSet, get panelOpen(){return panelOpen}, get orbsOn(){return orbsOn},set orbsOn(v){orbsOn=v}, get morph(){return morph},set morph(v){morph=v}, get drift(){return drift},set drift(v){drift=v}, get de0(){return de0},set de0(v){de0=v}};
