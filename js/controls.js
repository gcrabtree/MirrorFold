/* Site packs, opening the setup panel, the sound wave picture, Stats, and the remaining buttons. */
import { $, gl } from "./dom.js";
import { cleanName } from "./packs.js";
import { adv, advFill, mk } from "./journey-panel.js";
import { loadPack } from "./pack-io.js";
import { toast, waveBuf } from "./flight.js";
import { findS, findT, setJourney, store } from "./journey.js";
import { cycleMirrors, press, wakeHud } from "./input.js";
import { liveAudio } from "./listen.js";
import { FX, OVERLAYS } from "./state.js";
import { analyser, fbins } from "./audio.js";
import { encodeSpot } from "./choose.js";
import { landFx, landKind, landMode, landTint, setLand, setLandFx, setLandKind, setLandTint } from "./land.js";
import { LK } from "./landscapes.js";
import { DETAIL, resize, tA } from "./targets.js";
import { G } from "./shared.js";
export let statsOn;
let sitePacks, gpuName, de0;

function fetchText(url){return fetch(url,{cache:"no-cache"}).then(function(r){if(!r.ok)throw new Error("missing");return r.text()})}
function loadSitePacks(){
  if(sitePacks||typeof fetch!=="function"||location.protocol==="file:")return;
  sitePacks=[];
  fetchText("packs/index.json").then(function(t){
    var list=JSON.parse(t),sel=$("advSite");
    (Array.isArray(list)?list:[]).slice(0,200).forEach(function(e){
      var file=e&&String(e.file||""),name=cleanName(e&&e.name),by=cleanName(e&&e.author);
      if(!/^[a-z0-9][a-z0-9_-]*\.json$/.test(file)||!name)return; /* a plain file name in the packs folder, nothing else */
      sitePacks.push(file);sel.appendChild(mk("option",{value:file,text:name+(by?" by "+by:"")}));
    });
    $("advSiteRow").hidden=!sitePacks.length;
  }).catch(function(){sitePacks=null});
}
function openAdv(toLibrary){
  var cur=store.sel.charAt(0)==="t"?findT(store.sel.slice(2)):null,cs=store.sel.charAt(0)==="s"?findS(store.sel.slice(2)):null;
  if(cur)G.advT=cur;if(cs)G.advS=cs;
  G.ed=null;$("ed").hidden=true;
  advFill();loadSitePacks();adv.hidden=false;adv.scrollTop=toLibrary?$("advLibHead").offsetTop-12:0;
}
export function updateWave(){
  var i,live=liveAudio();
  if(OVERLAYS[G.ovi].spec||OVERLAYS[G.ovi].sound==="bands"){ /* frequency bands, low to high */
    if(live){for(i=0;i<128;i++)waveBuf[i]=fbins[1+i*2];}
    else{for(i=0;i<128;i++)waveBuf[i]=255*(0.18+0.6*G.beat)*Math.abs(Math.sin(i*0.21+G.time*1.3)*Math.sin(i*0.047-G.time*0.6));}
  }else if(live){
    if(!G.tbins)G.tbins=new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(G.tbins);
    for(i=0;i<128;i++)waveBuf[i]=Math.max(0,Math.min(255,128+(G.tbins[i*4]-128)*2.2));
  }else{ /* no sound to read: a soft shape that swells on the beat */
    for(i=0;i<128;i++)waveBuf[i]=128+(18+80*G.beat)*Math.sin(i*0.33+G.time*3.1)*Math.sin(i*0.05+G.time*0.7);
  }
  if(!G.waveTex){
    G.waveTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,G.waveTex);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  }else gl.bindTexture(gl.TEXTURE_2D,G.waveTex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.LUMINANCE,128,1,0,gl.LUMINANCE,gl.UNSIGNED_BYTE,waveBuf);
}
export const ST={n:0,worst:0,js:0,pr:0,pn:0,gd:0,jd:0,t:0};
export function statsShow(){
  var fps=ST.n/ST.t,lines=[
    Math.round(fps)+" pictures a second, slowest "+Math.round(ST.worst*1000)+" ms",
    "script "+(ST.js/ST.n).toFixed(1)+" ms a picture",
    "sharpness "+Math.round(G.q*100)+"%, "+tA.w+" x "+tA.h+" points",
    "drawn by: "+gpuName.slice(0,70)];
  if(ST.pn)lines.push("distance probe, waiting for the chip "+(ST.pr/ST.pn).toFixed(2)+" ms: chip "+ST.gd.toFixed(4)+(ST.jd===ST.jd?", script "+ST.jd.toFixed(4):", no script for this world"));
  else lines.push("distance probe: not for this world");
  $("stats").textContent=lines.join("\n");
  ST.n=0;ST.t=0;ST.worst=0;ST.js=0;ST.pr=0;ST.pn=0;
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
/* packs published with the site, listed in packs/index.json. Not there when the page is opened straight from a file. */
sitePacks=null;
$("advSiteAdd").addEventListener("click",function(){
  var file=$("advSite").value;
  if(!sitePacks||sitePacks.indexOf(file)<0)return;
  fetchText("packs/"+file).then(function(t){loadPack(t,"site")},function(){toast("That pack could not be fetched.")});
});
$("bAdv").addEventListener("click",function(){openAdv(false)});
$("bLib").addEventListener("click",function(){openAdv(true)});
$("advClose").addEventListener("click",function(){adv.hidden=true;wakeHud()});
$("bOrbs").addEventListener("click",function(){
  G.orbsOn=!G.orbsOn;press(this,G.orbsOn);try{localStorage.setItem("mirrorfold-orbs",G.orbsOn?"on":"off")}catch(_){}
  toast(G.orbsOn?"Orbs on":"Orbs hidden");wakeHud();
});
press($("bOrbs"),G.orbsOn);
$("bShare").addEventListener("click",function(){
  var h=encodeSpot(),url=location.href.split("#")[0]+"#"+h;
  G.lastHash=h;try{location.hash=h}catch(_){}
  var fail=function(){toast("Spot saved to this page's address. Copy it from the address bar.")};
  try{navigator.clipboard.writeText(url).then(function(){toast("Link to this exact spot copied.")},fail);}catch(_){fail();}
  wakeHud();
});
$("bJourney").addEventListener("click",function(){setJourney(!G.journey);wakeHud()});
$("bMirror").addEventListener("click",function(){cycleMirrors();wakeHud()});
$("bLand").addEventListener("click",function(){setLand((landMode+1)%3);wakeHud()});
$("bLandKind").addEventListener("click",function(){setLandKind((landKind+1)%LK.length);wakeHud()});
$("bLandTint").addEventListener("click",function(){setLandTint((landTint+1)%3);wakeHud()});
$("bLandFx").addEventListener("click",function(){setLandFx((landFx+1)%3);wakeHud()});
$("bFx").addEventListener("click",function(){G.fi=(G.fi+1)%FX.length;this.textContent="FX "+FX[G.fi].name;wakeHud()});
$("bFx").textContent="FX "+FX[G.fi].name;
$("bDetail").addEventListener("click",function(){
  G.di=(G.di+1)%DETAIL.length;G.q=DETAIL[G.di]==="fast"?0.5:(DETAIL[G.di]==="sharp"?1:0.85);
  this.textContent="Detail "+DETAIL[G.di];resize();wakeHud();
});
/* Stats: a readout of how fast the picture is drawn and what is drawing it, and a trial of the distance probe */
statsOn=false;
gpuName="";
$("bStats").addEventListener("click",function(){
  statsOn=!statsOn;press(this,statsOn);$("stats").hidden=!statsOn;ST.n=0;ST.t=0;
  if(statsOn&&!gpuName){var dx=gl.getExtension("WEBGL_debug_renderer_info");gpuName=String(dx?gl.getParameter(dx.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER));}
  wakeHud();
});
$("bMorph").addEventListener("click",function(){G.morph=!G.morph;press(this,G.morph);wakeHud()});
$("bDrift").addEventListener("click",function(){G.drift=!G.drift;press(this,G.drift);wakeHud()});
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
export const __dbg={get sitePacks(){return sitePacks},set sitePacks(v){sitePacks=v}, get fetchText(){return fetchText}, get loadSitePacks(){return loadSitePacks}, get openAdv(){return openAdv}, get updateWave(){return updateWave}, get statsOn(){return statsOn},set statsOn(v){statsOn=v},
  get ST(){return ST}, get gpuName(){return gpuName},set gpuName(v){gpuName=v}, get statsShow(){return statsShow}, get de0(){return de0},set de0(v){de0=v}};
