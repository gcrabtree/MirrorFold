/* Site packs, opening the setup panel, the sound wave picture, Stats, and the remaining buttons. */
import { scene } from "./choose.js";
import { $, toast } from "./dom.js";
import { cycleMirrors, press, wakeHud } from "./input.js";
import { adv, openAdv } from "./journey-panel.js";
import { journey, setJourney } from "./journey.js";
import { landFx, landKind, landMode, landTint, setLand, setLandFx, setLandKind, setLandTint } from "./land.js";
import { LK } from "./landscapes.js";
import { fetchText, loadPack, sitePacks } from "./pack-io.js";
import { encodeSpot } from "./spots.js";
import { FX, sel } from "./state.js";
import { DETAIL, di, resize, setDetail } from "./targets.js";
export let orbsOn=true,morph=true,drift=true; /* the Orbs, Morph and Drift switches */
let de0;




/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
try{orbsOn=localStorage.getItem("mirrorfold-orbs")!=="off"}catch(_){}
/* packs published with the site, listed in packs/index.json. Not there when the page is opened straight from a file. */
$("advSiteAdd").addEventListener("click",function(){
  var file=$("advSite").value;
  if(!sitePacks||sitePacks.indexOf(file)<0)return;
  fetchText("packs/"+file).then(function(t){loadPack(t,"site")},function(){toast("That pack could not be fetched.")});
});
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
$("bMirror").addEventListener("click",function(){cycleMirrors();wakeHud()});
$("bLand").addEventListener("click",function(){setLand((landMode+1)%3);wakeHud()});
$("bLandKind").addEventListener("click",function(){setLandKind((landKind+1)%LK.length);wakeHud()});
$("bLandTint").addEventListener("click",function(){setLandTint((landTint+1)%3);wakeHud()});
$("bLandFx").addEventListener("click",function(){setLandFx((landFx+1)%3);wakeHud()});
$("bFx").addEventListener("click",function(){sel.fi=(sel.fi+1)%FX.length;this.textContent="FX "+FX[sel.fi].name;wakeHud()});
$("bFx").textContent="FX "+FX[sel.fi].name;
$("bDetail").addEventListener("click",function(){
  setDetail((di+1)%DETAIL.length);
  this.textContent="Detail "+DETAIL[di];resize();wakeHud();
});
$("bMorph").addEventListener("click",function(){morph=!morph;press(this,morph);wakeHud()});
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

/* for the test tools and the browser console: every name in this file, readable and (where it can change) settable */
export const __dbg={get orbsOn(){return orbsOn},set orbsOn(v){orbsOn=v}, get morph(){return morph},set morph(v){morph=v}, get drift(){return drift},set drift(v){drift=v}, get de0(){return de0},set de0(v){de0=v}};
