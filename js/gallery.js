/* The gallery: packs that people have shared, which are the files in this site's packs folder, and offering one's own. */
import { $, toast } from "./dom.js";
import { mk } from "./journey-panel.js";
import { loadPack, packNow, packSummary, sceneNow } from "./pack-io.js";
import { NWORLD } from "./pack-worlds.js";
import { cleanAbout, cleanName } from "./packs.js";
import { WORLDS } from "./worlds.js";
export let gallery=null; /* the list from packs/index.json once it has been fetched and checked; null before */
export const fromGal={}; /* what was added from the gallery, as "palettes:Glacier". It is someone else's, so it is never offered. Kept in this browser. */
const ticked={};         /* what is ticked in the list of things to offer, as "palettes:Glacier" */
export const FROM_MAX=600;
/* the kinds of thing a pack holds, and what each is called in the list of things to offer */
export const OFFER_KINDS=[["worlds","World"],["palettes","Palette"],["motions","Motion"],["filters","Filter"],["overlays","Overlay"],["templates","Journey template"],["sets","Journey set"]];
/* which list a journey template's or a scene's field names something in */
export const NEEDS={world:"worlds",palette:"palettes",motion:"motions",filter:"filters",overlay:"overlays"};

/* The names in a pack's text, as "palettes:Glacier", each as written and as the cleaners would keep it. */
export function packNames(text){
  var raw=null,out=[];
  try{raw=JSON.parse(text)}catch(_){}
  if(!raw||typeof raw!=="object")return out;
  OFFER_KINDS.forEach(function(q){
    (Array.isArray(raw[q[0]])?raw[q[0]]:[]).forEach(function(x){
      var n=x&&typeof x.name==="string"?x.name:"",c=cleanName(n);
      if(n)out.push(q[0]+":"+n.slice(0,28));
      if(c&&c!==n.slice(0,28))out.push(q[0]+":"+c);
    });
  });
  return out;
}
/* What was read from storage, kept only if it is a short list of short strings. */
export function cleanFrom(list){
  return (Array.isArray(list)?list:[]).filter(function(x){return typeof x==="string"&&x.length<=40&&x.indexOf(":")>0}).slice(0,FROM_MAX);
}
function markGallery(text){
  packNames(text).forEach(function(k){fromGal[k]=1});
  try{localStorage.setItem("mirrorfold-from-gallery",JSON.stringify(Object.keys(fromGal).slice(0,FROM_MAX)))}catch(_){}
}
/* The pack to offer. list is everything that may be offered, each {kind, key, item, label}; picks are the places in it that
   are ticked. What a ticked thing uses comes with it if it is in the list: a set's templates, and the worlds, palettes,
   motions, filters and overlays a template or the scene names. Returns the pack and the labels of what came along. */
export function offerPick(list,picks){
  var take={},todo=[],extra=[],pack={mirrorfold:1,name:"My Mirrorfold pack",author:""},i,e,k;
  var want=function(kind,key){
    for(var j=0;j<list.length;j++)if(list[j].kind===kind&&list[j].key===key&&!take[j]){take[j]=2;todo.push(j);}
  };
  for(i=0;i<picks.length;i++)if(list[picks[i]]&&!take[picks[i]]){take[picks[i]]=1;todo.push(picks[i]);}
  while(todo.length){
    e=list[todo.pop()];
    if(e.kind==="sets")(Array.isArray(e.item.items)?e.item.items:[]).forEach(function(it){want("templates",it.tpl)});
    else if(e.kind==="templates"){for(k in NEEDS)((e.item[k]&&Array.isArray(e.item[k].set))?e.item[k].set:[]).forEach(function(n){want(NEEDS[k],n)});}
    else if(e.kind==="scene"){
      want("worlds",String(e.item.spot).split("-")[0]);
      for(k in NEEDS)if(k!=="world"&&e.item[k])want(NEEDS[k],e.item[k]);
    }
  }
  for(i=0;i<list.length;i++){
    if(!take[i])continue;
    if(list[i].kind==="scene")pack.scene=list[i].item;else (pack[list[i].kind]=pack[list[i].kind]||[]).push(list[i].item);
    if(take[i]===2)extra.push(list[i].label);
  }
  return {pack:pack,extra:extra};
}
/* "2 palettes, 1 template and the scene": what a pack made by offerPick holds */
export function offerSummary(k){
  var n={},s;OFFER_KINDS.forEach(function(q){n[q[0]]=k[q[0]]||[]});
  s=packSummary(n);
  return k.scene?(s==="nothing"?"the scene":s+", and the scene"):s;
}
/* Everything of the user's own that may be offered: the library and the journeys, less what came from the gallery, and the scene showing now. */
export function offerItems(){
  var k=packNow(),list=[],ids=WORLDS.slice(NWORLD).map(function(w){return w.id});
  OFFER_KINDS.forEach(function(q){
    k[q[0]].forEach(function(x,i){
      if(fromGal[q[0]+":"+x.name])return;
      list.push({kind:q[0],key:q[0]==="worlds"?ids[i]:x.name,item:x,label:q[1]+": "+x.name});
    });
  });
  list.push({kind:"scene",key:"now",item:sceneNow(),label:"The scene showing now: this place and its look"});
  return list;
}
/* The list of things to offer, each with a tick box. Nothing is ticked to begin with. */
export function offerFill(){
  var box=$("advOfferList");box.textContent="";
  offerItems().forEach(function(e,i){
    var id=e.kind+":"+e.key,cb=mk("input",{type:"checkbox",id:"advOf_"+i});
    cb.checked=!!ticked[id];
    cb.addEventListener("change",function(){if(cb.checked)ticked[id]=1;else delete ticked[id];});
    box.appendChild(mk("label",{"class":"advTick","for":"advOf_"+i},[cb,mk("span",{text:e.label})]));
  });
}

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
    fetchText("packs/"+e.file).then(function(t){if(loadPack(t,"site")){markGallery(t);offerFill();add.textContent="Added";add.disabled=true;}},function(){toast("That pack could not be fetched.")});
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
/* Offer what is ticked: open the repository's issue form with a pack of only those things in it. */
function offer(){
  var list=offerItems(),picks=[],repo=String($("aHelp").getAttribute("href")||"").split("#")[0];
  list.forEach(function(e,i){if(ticked[e.kind+":"+e.key])picks.push(i)});
  if(!picks.length){toast("Tick what you want to offer first.");return;}
  if(!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(repo)){toast("This copy does not know where its gallery is kept.");return;}
  var r=offerPick(list,picks),text=JSON.stringify(r.pack),o=offerUrl(repo,text,6000);
  var also=r.extra.length?" Also in it, because what you ticked uses it: "+r.extra.join(", ")+".":"";
  $("advIO").value=text;
  try{navigator.clipboard.writeText(text).catch(function(){})}catch(_){}
  window.open(o.url,"_blank","noopener");
  toast((o.filled?"A form has opened with "+offerSummary(r.pack)+" in it. You need a GitHub account to send it.":"A form has opened. Paste your pack into it: it has been copied, and it is in the text box below.")+also);
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
try{cleanFrom(JSON.parse(localStorage.getItem("mirrorfold-from-gallery")||"[]")).forEach(function(k){fromGal[k]=1})}catch(_){}
$("advOffer").addEventListener("click",offer);
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={cleanEntry, entrySummary, offerUrl, fetchText, card, loadGallery, offer, fromGal, ticked, FROM_MAX, OFFER_KINDS, NEEDS, packNames, cleanFrom, markGallery, offerPick, offerSummary, offerItems, offerFill, get gallery(){return gallery},set gallery(v){gallery=v}};
