/* Photo mode and postcards.
   Photo mode is Hold still with three sliders beside it: Zoom (how wide the view is), Brightness, and Focus (how far
   ahead Lens blur keeps sharp, nearer or further than what is in the middle of the picture). They change the picture
   only while photo mode is on, and are kept for the next time. Save large picture draws the same view on a much larger
   picture than the screen, waits for it to settle, saves it, and puts the screen back as it was.
   A postcard is the picture with a strip under it that names the world and gives the spot's code, as letters to type
   and as a QR code to scan (js/qr.js). Go to a code takes the typed letters to that spot. */
import { scene } from "./choose.js";
import { $, canvas, isTouch, toast } from "./dom.js";
import { press, wakeHud } from "./input.js";
import { loadPack, packOfScene } from "./pack-io.js";
import { PALETTES } from "./palettes.js";
import { asciiJson, pictureCard, pictureMake, pngPut } from "./picture.js";
import { qrMake } from "./qr.js";
import { encodeSpot } from "./spots.js";
import { sel } from "./state.js";
import { LENS, lensI, setLens, setStill, still, stillN, stillMost } from "./still.js";
import { setShot, shot } from "./targets.js";
import { WORLDS } from "./worlds.js";
export const PHOTO_BIG=3840;   /* the long side of a large picture, in pixels, where the device can make one that size */
export const PHOTO_BIG_TOUCH=2560; /* the same on a phone or tablet, which has less memory to make it in */
export const PHOTO_WAIT=25;    /* seconds a large picture is given to settle before it is saved as it is */
export let photoOn=false;      /* photo mode is on */
const photo={fov:0,exp:0,focus:0}; /* the three sliders, each from -100 to 100, 0 for no change */
let big=null;                  /* a large picture being made: when it was asked for, and whether it has been handed over for saving */
let held=false;                /* photo mode turned Hold still on itself, and so turns it off again */

/* what a slider's place means: a number to multiply by, 1 in the middle, most at the right end and 1/most at the left */
export function photoGain(v,most){return Math.pow(most,Math.max(-100,Math.min(100,v))/100);}
/* what the picture is multiplied by: how long the lens is (more is narrower), how bright, and how far the sharp depth is moved */
export function photoFov(){return photoOn?photoGain(photo.fov,2.6):1;}
export function photoExp(){return photoOn?photoGain(photo.exp,2.8):1;}
export function photoFocus(){return photoOn?photoGain(photo.focus,4):1;}
/* everything here that decides the picture, as text: Hold still compares it from frame to frame */
export function photoKey(){return photoOn?photo.fov+"/"+photo.exp+"/"+photo.focus:"";}

function show(){
  $("rowPhoto").hidden=!photoOn;press($("bPhoto"),photoOn);
  $("phFov").value=String(photo.fov);$("phExp").value=String(photo.exp);$("phFocus").value=String(photo.focus);
  $("bPhLens").textContent="Lens blur "+LENS[lensI].name;press($("bPhLens"),lensI>0);
}
export function setPhoto(on){
  photoOn=!!on;
  if(photoOn){held=!still;if(held)setStill(true);}
  else{if(held&&still)setStill(false);held=false;if(big)bigEnd();}
  show();
}
function keep(){try{localStorage.setItem("mirrorfold-photo",JSON.stringify(photo))}catch(_){}}
function download(bytes,name){
  var a=document.createElement("a"),url=URL.createObjectURL(new Blob([bytes],{type:"image/png"}));
  a.href=url;a.download=name;document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(function(){URL.revokeObjectURL(url)},4000);
}
function bigEnd(){big=null;setShot(0);$("bPhBig").textContent="Save large picture";}
/* Ask for a large picture: the screen's picture is made large, and photoFrame saves it once it has settled. */
function bigStart(){
  if(big)return;
  setShot(isTouch?PHOTO_BIG_TOUCH:PHOTO_BIG);
  big={t0:Date.now(),sent:false};
  $("bPhBig").textContent="Making the large picture...";
  toast("Making a large picture: "+canvas.width+" by "+canvas.height+". Hold on while it settles.");
}
/* A step of the frame, after the picture is finished: leave photo mode if Hold still has been let go, and move a large picture on. */
export function photoFrame(){
  if(photoOn&&!still){held=false;setPhoto(false);return;}
  if(!big||big.sent)return;
  if(stillN>=stillMost()||Date.now()-big.t0>PHOTO_WAIT*1000){
    big.sent=true;
    pictureMake(function(bytes){
      var w=canvas.width,h=canvas.height;
      bigEnd();
      if(!bytes){toast("The large picture could not be made on this device.");return;}
      download(bytes,"mirrorfold-"+scene.world.id+"-large.png");
      toast("Large picture saved: "+w+" by "+h+".");
    });
  }
}
/* a spot's code set out for reading: the letters after the world's name in fours */
export function cardSpaced(code){
  var i=code.indexOf("-"),t=i<0?"":code.slice(i+1),out=[],k;
  if(i<0)return code;
  for(k=0;k<t.length;k+=4)out.push(t.slice(k,k+4));
  return code.slice(0,i)+"-"+out.join(" ");
}
/* A code as someone typed it, made ready: spaces out, capitals down. "" unless it is then a world's name, a hyphen
   and 16 to 18 letters and digits, which is all a spot's code can be. */
export function cardCode(text){
  var t=typeof text==="string"?text.replace(/\s+/g,"").toLowerCase().replace(/^.*#/,""):"";
  return /^[a-z]{1,40}-[0-9a-z]{16,18}$/.test(t)?t:"";
}
/* Draw a postcard from the finished picture: the picture, and under it a dark strip with the world's name, the code,
   and the QR code of the link. Returns the new canvas. */
function cardDraw(src,code,url,name,line){
  var W=src.width,H=src.height,q=qrMake(url),s=Math.max(72,Math.round(0.13*Math.min(W,H)),q?Math.ceil(3*(q.n+4)/0.76):0),c=document.createElement("canvas"),g,px,qs,x0,y0,x,y,pad=Math.round(s*0.12),tx; /* the strip is tall enough for the QR code's squares to be three pixels each, which a phone's camera can read */
  c.width=W;c.height=H+s;g=c.getContext("2d");
  g.drawImage(src,0,0);
  g.fillStyle="#0b0714";g.fillRect(0,H,W,s);
  tx=pad;
  if(q){
    px=Math.max(1,Math.floor((s-2*pad)/(q.n+4)));qs=px*(q.n+4);x0=W-pad-qs;y0=H+Math.round((s-qs)/2);
    g.fillStyle="#ffffff";g.fillRect(x0,y0,qs,qs);
    g.fillStyle="#000000";
    for(y=0;y<q.n;y++)for(x=0;x<q.n;x++)if(q.m[y*q.n+x])g.fillRect(x0+(x+2)*px,y0+(y+2)*px,px,px);
  }
  g.textBaseline="alphabetic";g.fillStyle="#f3eefc";
  g.font="600 "+Math.round(s*0.30)+"px system-ui, -apple-system, 'Segoe UI', sans-serif";
  g.fillText(name,tx,H+Math.round(s*0.40),q?x0-2*pad:W-2*pad);
  g.fillStyle="#b9add4";
  g.font=Math.round(s*0.17)+"px system-ui, -apple-system, 'Segoe UI', sans-serif";
  g.fillText(line,tx,H+Math.round(s*0.63),q?x0-2*pad:W-2*pad);
  g.fillStyle="#f3eefc";
  g.font=Math.round(s*0.17)+"px ui-monospace, Menlo, Consolas, monospace";
  g.fillText(cardSpaced(code),tx,H+Math.round(s*0.88),q?x0-2*pad:W-2*pad);
  return c;
}
/* Save a postcard of the next finished frame. The file also holds the scene, as Save picture's does, so loading it comes back here too. */
function cardSave(){
  var code=encodeSpot(),url=location.href.split("#")[0]+"#"+code,w=scene.world,text=asciiJson(packOfScene());
  pictureCard(function(src){
    var c=cardDraw(src,code,url,w.name,"Mirrorfold, palette "+PALETTES[sel.pi].name+". Scan, or type this under Go to a code:");
    if(!c.toBlob){toast("The postcard could not be made in this browser.");return;}
    c.toBlob(function(blob){
      var rd;
      if(!blob){toast("The postcard could not be made in this browser.");return;}
      rd=new FileReader();
      rd.onload=function(){var b=new Uint8Array(rd.result);download(pngPut(b,"mirrorfold",text)||b,"mirrorfold-"+w.id+"-postcard.png");toast("Postcard saved. Its code is "+cardSpaced(code)+".");};
      rd.onerror=function(){toast("The postcard could not be made in this browser.")};
      rd.readAsArrayBuffer(blob);
    },"image/png");
  });
}
/* Go to the spot a typed code names. The code is checked, and then goes the way a link's does. */
function cardGo(){
  var t=null,c,i,ok=false;
  try{t=window.prompt("Type the code from a postcard. Spaces and capitals do not matter.","")}catch(_){}
  if(t===null||t==="")return;
  c=cardCode(t);
  for(i=0;i<WORLDS.length;i++)if(c&&WORLDS[i].id===c.slice(0,c.indexOf("-")))ok=true;
  if(!ok){toast(c?"That code is for a world this page does not have.":"That is not a code this page can read. It is a world's name, a hyphen, and 16 to 18 letters and digits.");return;}
  try{location.hash=c}catch(_){}
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
var sv=null,k,bind=function(id,key){$(id).addEventListener("input",function(){photo[key]=Math.max(-100,Math.min(100,Math.round(+this.value)||0));keep();wakeHud();});};
try{sv=JSON.parse(localStorage.getItem("mirrorfold-photo")||"null")}catch(_){}
if(sv&&typeof sv==="object")for(k in photo)if(typeof sv[k]==="number"&&isFinite(sv[k]))photo[k]=Math.max(-100,Math.min(100,Math.round(sv[k])));
show();
$("bPhoto").addEventListener("click",function(){
  setPhoto(!photoOn);
  toast(photoOn?"Photo mode. The picture is held still. Set the view, then save it.":"Photo mode off");wakeHud();
});
bind("phFov","fov");bind("phExp","exp");bind("phFocus","focus");
$("bPhLens").addEventListener("click",function(){setLens((lensI+1)%LENS.length);try{localStorage.setItem("mirrorfold-lens",LENS[lensI].name)}catch(_){}show();wakeHud();});
$("bPhReset").addEventListener("click",function(){photo.fov=photo.exp=photo.focus=0;keep();show();wakeHud();});
$("bPhBig").addEventListener("click",function(){bigStart();wakeHud();});
$("bCard").addEventListener("click",function(){cardSave();wakeHud();});
$("bCode").addEventListener("click",function(){cardGo();wakeHud();});
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={PHOTO_BIG, PHOTO_BIG_TOUCH, PHOTO_WAIT, photo, photoGain, photoFov, photoExp, photoFocus, photoKey, setPhoto, photoShow:show, photoFrame, photoBigStart:bigStart, photoBigEnd:bigEnd, cardSpaced, cardCode, cardDraw, cardSave, cardGo, photoDownload:download,
  get photoOn(){return photoOn},set photoOn(v){photoOn=v}, get photoBig(){return big},set photoBig(v){big=v}};
