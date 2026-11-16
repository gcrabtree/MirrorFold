/* Passing on what was made. When a postcard or a video is ready, a row offers it: Share hands the file to the device's
   own share sheet (on a phone that lists Reddit, messages and the rest; the page needs no account anywhere), Save
   keeps it as a file, and Post to Reddit opens Reddit's own page for a new post with the title and the link to the
   spot filled in, for the saved file to be added there by hand, since a web page cannot hand a file to another site.
   The file is made first and shared at a second press because a browser lets a page open the share sheet only in
   direct answer to a press. Nothing is sent by this file itself. */
import { $, toast } from "./dom.js";
import { wakeHud } from "./input.js";
let ready=null; /* what is on offer: the file's bytes or blob, its name and kind of file, what it is called in the row, a title, a line of text and a link */

/* Can this browser hand a file of this kind to the share sheet? */
export function sendCan(file){
  try{return !!(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]}));}catch(_){return false;}
}
/* the address of Reddit's page for a new post, with a title and a link filled in */
export function sendReddit(title,link){
  return "https://www.reddit.com/submit?title="+encodeURIComponent(String(title).slice(0,280))+(link?"&url="+encodeURIComponent(link):"");
}
function file(){
  try{return new File([ready.blob],ready.name,{type:ready.type});}catch(_){return null;}
}
function show(){
  var f=ready?file():null;
  $("rowSend").hidden=!ready;
  if(!ready)return;
  $("sendSay").textContent=ready.what+" ready.";
  $("bSendShare").hidden=!(f&&sendCan(f));
  $("bSendReddit").hidden=!ready.link;
}
/* Put something on offer. o = {blob, name, type, what ("Postcard", "Video"), title, text, link}. */
export function sendOffer(o){ready=o;show();wakeHud();}
export function sendSave(){
  var a,url;
  if(!ready)return;
  a=document.createElement("a");url=URL.createObjectURL(ready.blob);
  a.href=url;a.download=ready.name;document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(function(){URL.revokeObjectURL(url)},10000);
  toast(ready.what+" saved.");
}
function share(){
  var f=ready&&file(),d;
  if(!f||!sendCan(f)){toast("This browser cannot share a file. Save it and share the file yourself.");return;}
  d={files:[f],title:ready.title};
  if(ready.text)d.text=ready.text+(ready.link?" "+ready.link:"");
  try{navigator.share(d).then(function(){},function(e){if(e&&e.name!=="AbortError")toast("Sharing did not work. Save the file and share it yourself.");});}
  catch(_){toast("Sharing did not work. Save the file and share it yourself.");}
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
$("bSendShare").addEventListener("click",function(){share();wakeHud();});
$("bSendSave").addEventListener("click",function(){sendSave();wakeHud();});
$("bSendReddit").addEventListener("click",function(){
  if(!ready)return;
  sendSave(); /* Reddit's page cannot be handed the file, so it is saved first, to be added there */
  try{window.open(sendReddit(ready.title,ready.link),"_blank","noopener")}catch(_){}
  toast("Reddit's page for a new post is open with the title and link filled in. To post the picture itself, choose Images there and add the file just saved.");wakeHud();
});
$("bSendClose").addEventListener("click",function(){ready=null;show();wakeHud();});
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={sendCan, sendReddit, sendOffer, sendSave, sendShare:share, sendShow:show, get sendReady(){return ready},set sendReady(v){ready=v}};
