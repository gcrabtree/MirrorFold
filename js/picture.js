/* Save picture: the frame as a PNG file with a small pack inside it, so that loading the picture goes back to the scene. */
import { scene } from "./choose.js";
import { $, canvas, toast } from "./dom.js";
import { wakeHud } from "./input.js";
import { loadPack, packOfScene } from "./pack-io.js";
let wanted=null; /* what to do with the next finished frame's PNG bytes, or null */

/* the check number PNG keeps at the end of each of its parts */
export function crc32(b,from,to){
  var c=0xffffffff,i,k;
  for(i=from;i<to;i++){c^=b[i];for(k=0;k<8;k++)c=(c>>>1)^(0xedb88320&-(c&1));}
  return (c^0xffffffff)>>>0;
}
/* JSON in plain ASCII: any other character is written as \uXXXX, which a PNG text part can always hold */
export function asciiJson(o){
  return JSON.stringify(o).replace(/[\u007f-￿]/g,function(ch){return "\\u"+("000"+ch.charCodeAt(0).toString(16)).slice(-4)});
}
function isPng(b){return b.length>=45&&b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71&&b[4]===13&&b[5]===10&&b[6]===26&&b[7]===10;}
function u32(b,i){return ((b[i]<<24)|(b[i+1]<<16)|(b[i+2]<<8)|b[i+3])>>>0;}
/* a copy of a PNG with a text part added straight after its header: word is its name, text what it says. Null if b is not a PNG. */
export function pngPut(b,word,text){
  if(!isPng(b)||u32(b,8)!==13||!/^[\x20-\x7e]{1,79}$/.test(word)||/[^\x20-\x7e]/.test(text))return null;
  var n=word.length+1+text.length,out=new Uint8Array(b.length+12+n),at=33,i,p,c; /* 33: the signature and the header part */
  out.set(b.subarray(0,at),0);
  out[at]=n>>>24;out[at+1]=(n>>>16)&255;out[at+2]=(n>>>8)&255;out[at+3]=n&255;
  out[at+4]=116;out[at+5]=69;out[at+6]=88;out[at+7]=116; /* "tEXt" */
  p=at+8;
  for(i=0;i<word.length;i++)out[p++]=word.charCodeAt(i);
  out[p++]=0;
  for(i=0;i<text.length;i++)out[p++]=text.charCodeAt(i);
  c=crc32(out,at+4,p);
  out[p]=c>>>24;out[p+1]=(c>>>16)&255;out[p+2]=(c>>>8)&255;out[p+3]=c&255;
  out.set(b.subarray(at),p+4);
  return out;
}
/* the text of the PNG's text part called word, or null. Nothing is trusted: every length is checked against the file. */
export function pngGet(b,word,most){
  if(!isPng(b))return null;
  var at=8,n,i,ok,p,s;
  while(at+12<=b.length){
    n=u32(b,at);
    if(n>b.length-at-12)return null;
    if(b[at+4]===116&&b[at+5]===69&&b[at+6]===88&&b[at+7]===116&&n>word.length&&b[at+8+word.length]===0){
      ok=true;for(i=0;i<word.length;i++)if(b[at+8+i]!==word.charCodeAt(i))ok=false;
      if(ok){
        p=at+8+word.length+1;n-=word.length+1;
        if(n>(most||200000))return null;
        s="";for(i=0;i<n;i+=8192)s+=String.fromCharCode.apply(null,b.subarray(p+i,Math.min(p+n,p+i+8192)));
        return s;
      }
    }
    if(b[at+4]===73&&b[at+5]===69&&b[at+6]===78&&b[at+7]===68)return null; /* "IEND" */
    at+=12+n;
  }
  return null;
}

/* Ask for the next finished frame as PNG bytes with the scene inside. The frame loop calls pictureFrame when the frame is on the canvas. */
export function pictureMake(then){wanted=then;}
export function pictureFrame(){
  if(!wanted)return;
  var then=wanted,text=asciiJson(packOfScene());wanted=null;
  if(!canvas.toBlob){then(null);return;}
  canvas.toBlob(function(blob){
    if(!blob){then(null);return;}
    var rd=new FileReader();
    rd.onload=function(){then(pngPut(new Uint8Array(rd.result),"mirrorfold",text))};
    rd.onerror=function(){then(null)};
    rd.readAsArrayBuffer(blob);
  },"image/png");
}
function save(bytes){
  if(!bytes){toast("The picture could not be made in this browser.");return;}
  var a=document.createElement("a"),url=URL.createObjectURL(new Blob([bytes],{type:"image/png"}));
  a.href=url;a.download="mirrorfold-"+scene.world.id+".png";document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(function(){URL.revokeObjectURL(url)},2000);
  toast("Picture saved. Loading it in Mirrorfold comes back to this place.");
}
/* A file the user chose or dropped: a pack, or a picture with a pack inside. */
export function loadFile(f){
  if(!f)return;
  var png=/\.png$/i.test(f.name||"")||f.type==="image/png",rd=new FileReader();
  if(f.size>(png?40000000:200000)){toast(png?"That picture is too big.":"That file is too big to be a Mirrorfold pack.");return;}
  rd.onerror=function(){toast("That file could not be read.")};
  if(png){
    rd.onload=function(){
      var t=pngGet(new Uint8Array(rd.result),"mirrorfold");
      if(t)loadPack(t);else toast("That picture has no Mirrorfold scene in it. Some sites remove it when a picture is uploaded.");
    };
    rd.readAsArrayBuffer(f);
  }else{
    rd.onload=function(){loadPack(String(rd.result))};
    rd.readAsText(f);
  }
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
$("bShot").addEventListener("click",function(){pictureMake(save);wakeHud()});
/* a pack or a picture dropped anywhere on the page */
window.addEventListener("dragover",function(e){e.preventDefault()});
window.addEventListener("drop",function(e){e.preventDefault();loadFile(e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0])});
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={crc32, asciiJson, isPng, u32, pngPut, pngGet, pictureMake, pictureFrame, save, loadFile, get wanted(){return wanted},set wanted(v){wanted=v}};
