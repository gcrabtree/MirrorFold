/* The gallery: packs that people have shared, which are the files in this site's packs folder, and offering one's own. */
import { $, toast } from "./dom.js";
import { mk } from "./journey-panel.js";
import { loadPack, packNow, packSummary } from "./pack-io.js";
import { cleanAbout, cleanName } from "./packs.js";
export let gallery=null; /* the list from packs/index.json once it has been fetched and checked; null before */

/* One line of packs/index.json, checked: a plain file name in the packs folder, plain text, small whole numbers. Null if it will not do. */
export function cleanEntry(e){
  if(!e||typeof e!=="object")return null;
  var file=typeof e.file==="string"?e.file:"",name=cleanName(e.name),out,has={},k,v;
  var kinds=["worlds","palettes","motions","filters","overlays","templates","sets","scene"];
  if(!/^[a-z0-9][a-z0-9_-]{0,60}\.json$/.test(file)||!name)return null;
  out={file:file,name:name,author:cleanName(e.author),about:cleanAbout(e.about)};
  for(k=0;k<kinds.length;k++){v=e.has&&e.has[kinds[k]];has[kinds[k]]=typeof v==="number"&&v>0&&v<100?Math.floor(v):0;}
  out.has=has;
  return out;
}
/* "2 palettes and 1 template": what a gallery entry says it holds */
export function entrySummary(e){
  var k={},n;for(n in e.has)k[n]={length:e.has[n]};
  var s=packSummary(k);
  return e.has.scene?(s==="nothing"?"a scene":s+", and a scene"):s;
}
/* The address of the issue form with the pack filled in. Past most characters the pack is left out, and the user pastes it. */
export function offerUrl(repo,text,most){
  var base=repo+"/issues/new?template=pack.yml&title="+encodeURIComponent("Pack: "),full=base+"&pack="+encodeURIComponent(text);
  return full.length<=most?{url:full,filled:true}:{url:base,filled:false};
}
export function fetchText(url){return fetch(url,{cache:"no-cache"}).then(function(r){if(!r.ok)throw new Error("missing");return r.text()})}
function card(e){
  var add=mk("button",{type:"button",text:"Add"});
  add.addEventListener("click",function(){
    fetchText("packs/"+e.file).then(function(t){if(loadPack(t,"site")){add.textContent="Added";add.disabled=true;}},function(){toast("That pack could not be fetched.")});
  });
  var kids=[mk("div",{"class":"galName"},[mk("strong",{text:e.name}),mk("span",{text:e.author?" by "+e.author:""})])];
  if(e.about)kids.push(mk("p",{"class":"advNote",text:e.about}));
  kids.push(mk("div",{"class":"advRow"},[mk("span",{"class":"advItem",text:entrySummary(e)}),add]));
  return mk("div",{"class":"gal"},kids);
}
/* Fetch the list once, when the setup panel first opens. Not when the page was opened straight from a file. */
export function loadGallery(){
  var box=$("advGal"),note=$("advGalNote");
  if(gallery)return;
  if(typeof fetch!=="function"||location.protocol==="file:"){note.textContent="The gallery is there when the page is opened from a web address, not from a file.";return;}
  gallery=[];
  fetchText("packs/index.json").then(function(t){
    var list=JSON.parse(t);
    (Array.isArray(list)?list:[]).slice(0,200).forEach(function(x){var e=cleanEntry(x);if(e)gallery.push(e);});
    box.textContent="";gallery.forEach(function(e){box.appendChild(card(e))});
    if(!gallery.length)note.textContent="The gallery is empty.";
  }).catch(function(){gallery=null;note.textContent="The gallery could not be fetched. Close this panel and open it again to retry.";});
}
/* Offer mine to the gallery: open the repository's issue form with the user's pack in it. */
function offer(){
  var k=packNow(),text=JSON.stringify(k),repo=String($("aHelp").getAttribute("href")||"").split("#")[0];
  if(packSummary(k)==="nothing"){toast("You have made nothing of your own to offer yet.");return;}
  if(!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(repo)){toast("This copy does not know where its gallery is kept.");return;}
  var o=offerUrl(repo,text,6000);
  $("advIO").value=text;
  try{navigator.clipboard.writeText(text).catch(function(){})}catch(_){}
  window.open(o.url,"_blank","noopener");
  toast(o.filled?"A form has opened with "+packSummary(k)+" in it. You need a GitHub account to send it.":"A form has opened. Paste your pack into it: it has been copied, and it is in the text box below.");
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
$("advOffer").addEventListener("click",offer);
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={cleanEntry, entrySummary, offerUrl, fetchText, card, loadGallery, offer, get gallery(){return gallery},set gallery(v){gallery=v}};
