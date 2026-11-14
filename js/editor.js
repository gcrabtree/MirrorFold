/* The editor: sliders for a palette, motion or filter that you made or added. */
import { setLook, setMotion } from "./choose.js";
import { $, toast } from "./dom.js";
import { wakeHud } from "./input.js";
import { adv, advFill, mk, uniqueName } from "./journey-panel.js";
import { saveStore, store } from "./journey.js";
import { LIB_MAX, NLOOK, NMOT, saveLibrary } from "./library.js";
import { loadPack, packNow, packSummary, refreshLists } from "./pack-io.js";
import { cleanFilter, cleanMotion, cleanName, cleanPalette } from "./packs.js";
import { NPAL, PALETTES, setPalette } from "./palettes.js";
import { LOOKS, MOTIONS, sel } from "./state.js";
let ed=null; /* what the editor has open: {kind,item}, or null */
export function edClose(){ed=null;$("ed").hidden=true;}
export let ED;

/* the palette editor's plain controls, which build a whole palette from two colours */
const ED_SIMPLE=[["changes","Colour changes",1,6,1,"How many times the strip goes from one colour to the other. At 1 it goes from the first colour to the second. At 2 it goes there and back."],
               ["slide","Slide",0,1,0.01,"Moves all the colours along the strip, so a different one comes first."],
               ["rainbow","Rainbow",0,1,0.01,"At 0 the strip holds only blends of your two colours. Higher values set red, green and blue out of step, so other colours appear in between."]];
const FX_NAMES=["none","Quad","Tiles","Bulge","Twirl","Thermal","CRT","Halftone","Contour","Noir"]; /* {kind, item} while the editor is open */
/* A palette from two colours. Each of red, green and blue swings between its amount in the first colour and its amount in the second.
   "changes" is how many times, "slide" moves the whole strip along, and "rainbow" sets the three out of step. */
function palFromSimple(s){
  var out={a:[],b:[],c:[],d:[]},j,d;
  for(j=0;j<3;j++){
    out.a.push(+((s.one[j]+s.two[j])/2).toFixed(4));out.b.push(+(Math.abs(s.one[j]-s.two[j])/2).toFixed(4));out.c.push(s.changes/2);
    d=s.slide+s.rainbow*j/3+(s.one[j]<s.two[j]?0.5:0);
    out.d.push(+(d-Math.floor(d)).toFixed(4));
  }
  return out;
}
/* The other way: the two colours and three settings that give this palette. "exact" is false when no settings do,
   and then they are only the nearest guess. */
function palToSimple(q){
  var fr=function(x){return x-Math.floor(x)},near=function(x){x=fr(x);return Math.min(x,1-x)<0.012};
  var cl=function(x){return Math.max(0,Math.min(1,x))};
  var make=function(f,slide,rainbow,exact){
    var s={one:[],two:[],changes:Math.max(1,Math.min(6,Math.round((q.c[0]+q.c[1]+q.c[2])/1.5))),slide:slide,rainbow:rainbow,exact:exact},j;
    for(j=0;j<3;j++){s.one.push(cl(q.a[j]+(f[j]?-1:1)*q.b[j]));s.two.push(cl(q.a[j]-(f[j]?-1:1)*q.b[j]));}
    return s;
  };
  var fits=Math.abs(q.c[0]-q.c[1])<0.004&&Math.abs(q.c[0]-q.c[2])<0.004&&near(q.c[0]*2)&&q.c[0]>0.49,m,f,slide,rainbow,j;
  for(j=0;j<3;j++)if(q.a[j]+q.b[j]>1.004||q.a[j]-q.b[j]<-0.004)fits=false;
  if(fits)for(m=0;m<8;m++){ /* each colour may run from the first colour's amount to the second's, or the other way */
    f=[m&1,m>>1&1,m>>2&1];
    slide=fr(q.d[0]-f[0]/2);rainbow=3*fr(q.d[1]-f[1]/2-slide);
    if(rainbow>2.98)rainbow=0;
    if(rainbow<1.02&&near(q.d[2]-f[2]/2-slide-2*rainbow/3))return make(f,slide,Math.min(1,rainbow),true);
  }
  return make([0,0,0],fr(q.d[0]),Math.min(1,3*fr(q.d[1]-q.d[0])),false);
}
function edShow(v,row){return row[0]==="fx"?FX_NAMES[v|0]:String(+(+v).toFixed(row[4]<0.001?4:row[4]<0.01?3:2));}
function edHex(c){return "#"+c.map(function(x){return ("0"+Math.round(255*x).toString(16)).slice(-2)}).join("");}
function edRgb(h){return [1,3,5].map(function(i){return parseInt(h.substr(i,2),16)/255});}
function edSwatch(){ /* the palette from one end to the other */
  var cv=$("edSwatch");cv.hidden=ed.kind!=="p";if(cv.hidden)return;
  var x2=cv.getContext("2d"),q=ed.item,im=x2.createImageData(256,1),i,j;
  for(i=0;i<256;i++){for(j=0;j<3;j++)im.data[i*4+j]=255*Math.min(1,Math.max(0,q.a[j]+q.b[j]*Math.cos(6.28318*(q.c[j]*i/255+q.d[j]))));im.data[i*4+3]=255;}
  x2.putImageData(im,0,0);
}
function edRead(){ /* sliders to the item, by way of the cleaner */
  var E=ED[ed.kind],src={name:ed.item.name},k;
  if(ed.item.code)src.code=ed.item.code;
  E.rows.forEach(function(r){
    if(E.rgb)src[r[0]]=[0,1,2].map(function(j){return +$("ed_"+r[0]+j).value});
    else src[r[0]]=+$("ed_"+r[0]).value;
  });
  var out=E.clean(src);if(!out)return;
  for(k in out)if(out[k]===0)delete out[k]; /* a control at nothing is left out, as in a hand-written pack */
  E.rows.forEach(function(r){delete ed.item[r[0]]});
  for(k in out)ed.item[k]=out[k];
  E.rows.forEach(function(r){ /* show what was kept, which can differ from where the slider sits */
    var v=ed.item[r[0]];
    if(E.rgb)[0,1,2].forEach(function(j){$("ev_"+r[0]+j).textContent=edShow(v[j],r)});
    else $("ev_"+r[0]).textContent=edShow(v||0,r);
  });
  edSwatch();saveLibrary();
}
function edSimpleShow(){ /* set the plain palette controls to match the palette, without changing it */
  var s=palToSimple(ed.item);
  $("es_one").value=edHex(s.one);$("es_two").value=edHex(s.two);
  ED_SIMPLE.forEach(function(r){$("es_"+r[0]).value=String(s[r[0]]);$("esv_"+r[0]).textContent=edShow($("es_"+r[0]).value,r)});
  $("edNote").hidden=s.exact;
}
function edSimpleRead(){ /* the plain palette controls rebuild the whole palette */
  var s={one:edRgb($("es_one").value),two:edRgb($("es_two").value)},q;
  ED_SIMPLE.forEach(function(r){s[r[0]]=+$("es_"+r[0]).value;$("esv_"+r[0]).textContent=edShow(s[r[0]],r)});
  q=palFromSimple(s);
  ED.p.rows.forEach(function(r){[0,1,2].forEach(function(j){$("ed_"+r[0]+j).value=String(q[r[0]][j])})});
  $("edNote").hidden=true;edRead();
}
function edSlider(r,id,val,label,onIn){ /* one slider: its name and its value above it */
  var sl=mk("input",{type:"range",id:"ed_"+id,min:String(r[2]),max:String(r[3]),step:String(r[4])});
  sl.value=String(val);sl.addEventListener("input",onIn);
  return mk("div",{"class":"edRow"},[mk("label",{"for":"ed_"+id,text:label}),mk("span",{"class":"edVal",id:"ev_"+id}),sl]);
}
function edHelpFill(){ /* what each control does, in the order they appear */
  var E=ED[ed.kind],box=$("edHelp"),line=function(name,text){box.appendChild(mk("p",{},[mk("b",{text:name+". "}),document.createTextNode(text)]))};
  box.textContent="";box.appendChild(mk("p",{text:E.help}));
  if(ed.kind==="p"){
    line("First colour, Second colour","The two colours the palette runs between. Tap one to choose it.");
    ED_SIMPLE.forEach(function(r){line(r[1],r[5])});
    line("Fine tuning","Opens twelve more sliders, for people who want them. A palette is made of three waves, one each for red, green and blue, and these set each wave by itself. Moving one of the controls above sets all twelve again.");
  }
  E.rows.forEach(function(r){line(r[1],r[5])});
  if(ed.item.code)line("Program","This filter also has a program from its pack. The sliders are added to what the program does and do not change it.");
  box.appendChild(mk("p",{text:"Every change is saved as you make it. Sliders stop at the limits a pack is held to. Done closes the editor."}));
}
export function edOpen(kind,i){
  var E=ED[kind],item=E.list[i],box=$("edRows"),fine;
  if(!item||i<E.built)return;
  ed={kind:kind,item:item};
  if(kind==="p")setPalette(i);else if(kind==="m")setMotion(i);else setLook(i);
  $("edKind").textContent=E.word.charAt(0).toUpperCase()+E.word.slice(1);$("edName").value=item.name;
  box.textContent="";$("edFineRows").textContent="";
  $("edSimple").hidden=$("edFine").hidden=kind!=="p";$("edFineRows").hidden=true;$("edFine").setAttribute("aria-expanded","false");
  if(E.rgb)E.rows.forEach(function(r){ /* fine tuning: one group for each row, with a slider each for red, green and blue */
    var kids=[mk("span",{"class":"edGroupName",text:r[1]})];
    ["Red","Green","Blue"].forEach(function(c,j){
      var row=edSlider(r,r[0]+j,item[r[0]][j],c,function(){edRead();edSimpleShow()});
      row.className="edRow ed"+c;row.lastChild.setAttribute("aria-label",r[1]+", "+c.toLowerCase());kids.push(row);
    });
    $("edFineRows").appendChild(mk("div",{"class":"edGroup"},kids));
  });
  else E.rows.forEach(function(r){box.appendChild(edSlider(r,r[0],item[r[0]]!==undefined?item[r[0]]:(r[0]==="zoom"?0.994:0),r[1],edRead))});
  $("edHelp").hidden=true;$("edHelpBtn").setAttribute("aria-expanded","false");edHelpFill();
  adv.hidden=true;$("ed").hidden=false;$("ed").scrollTop=0;edRead();
  if(kind==="p")edSimpleShow();
}
function edNew(kind){
  var E=ED[kind],cur=kind==="p"?PALETTES[sel.pi]:kind==="m"?MOTIONS[sel.moi]:LOOKS[sel.lki],src=JSON.parse(JSON.stringify(cur,function(k,v){return k==="prog"?undefined:v}));
  if(E.list.length-E.built>=LIB_MAX){toast("You have "+LIB_MAX+" added "+E.word+"s. Remove one first.");return;}
  delete src.code; /* a copy takes the slider settings, not the program */
  if(kind==="m"&&sel.moi===0)src={decay:0.96,zoom:0.998};
  if(kind==="f"){src.name="x";var mix=cleanFilter(src);src=mix&&Object.keys(mix).length>1?mix:{edge:0.5};}
  src.name=uniqueName("My "+E.word,E.list.map(function(q){return q.name}));
  var item=E.clean(src);if(!item)return;
  E.list.push(item);saveLibrary();refreshLists();
  edOpen(kind,E.list.length-1);
  toast("Made "+item.name+". Change it and watch.");
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
/* ---------- the editor: controls for an added palette, motion or filter ----------
   Each slider row is [field, label, lowest, highest, step, help]. What the controls say goes through the same cleaners as a pack. */
ED={
 p:{word:"palette",cat:"palette",list:PALETTES,built:NPAL,clean:cleanPalette,rgb:true,
    help:"A palette is the strip of colours a world is painted with. The strip at the top shows it from one end to the other. Pick two colours and the palette runs between them.",
    rows:[["a","Level",0,1,0.01,"How much of that colour there is on average."],
          ["b","Range",0,1,0.01,"How far it rises above and falls below its level along the strip. At 0 it stays the same all the way."],
          ["c","Waves",0,3,0.05,"How many times it rises and falls along the strip."],
          ["d","Offset",-2,2,0.01,"Where along the strip its rise starts. 1 is one whole wave."]]},
 m:{word:"motion",cat:"motion",list:MOTIONS,built:NMOT,clean:cleanMotion,
    help:"A motion says how the trails behind the picture move. Each frame, what was on screen a moment ago is drawn again, a little dimmer and a little moved.",
    rows:[["decay","Trail length",0,0.98,0.005,"How long trails last. At 0 there are none, and the other controls have nothing to move."],
          ["zoom","Zoom",0.95,1.05,0.001,"Below 1 the trails spread outward from the middle. Above 1 they shrink into it. At 1 they stay the same size."],
          ["rot","Turn",-0.025,0.025,0.0005,"Turns the trails about the middle, one way or the other. Middle notes in the music turn them faster."],
          ["swirl","Swirl",-0.08,0.08,0.002,"Turns the middle and the edges by different amounts, which twists the trails into a spiral."],
          ["wob","Wobble",0,0.006,0.0002,"Bends the trails in slow waves."],
          ["rip","Ripple",0,0.03,0.001,"Sends rings outward through the trails. Beats make them stronger."],
          ["dx","Slide sideways",-0.012,0.012,0.0005,"Moves the trails left or right."],
          ["dy","Slide up or down",-0.012,0.012,0.0005,"Moves the trails up or down."],
          ["kick","Beat push",-1,1,0.05,"On each beat, pushes the trails outward (above 0) or pulls them inward (below 0)."]]},
 f:{word:"filter",cat:"filter",list:LOOKS,built:NLOOK,clean:cleanFilter,
    help:"A filter changes the finished picture. Each control adds one effect, and at 0 that effect is off. They can be mixed.",
    rows:[["edge","Outlines",0,1,0.01,"Draws glowing lines where the picture changes sharply, and darkens the rest."],
          ["post","Brightness steps",0,16,1,"Cuts the smooth shading into this many flat steps. Small numbers look like a poster."],
          ["solar","Solarise",0,1,0.01,"Turns the brightest parts dark, as in an over-exposed photograph."],
          ["inv","Negative",0,1,0.01,"Swaps light for dark and each colour for its opposite."],
          ["echo","Echo",0,1,0.01,"Lays a second copy of the picture over it, turned upside down."],
          ["mos","Mosaic blocks",0,400,4,"Builds the picture from square blocks. The number is how many blocks fit from top to bottom, so small numbers give big blocks."],
          ["liq","Liquid",0,0.03,0.001,"Makes the picture waver as if seen through water."],
          ["hue","Colour turn",0,1,0.01,"Shifts every colour round the colour wheel, in slowly moving rings."],
          ["ca","Colour fringing",0,0.04,0.001,"Pulls red and blue apart toward the edges of the screen."],
          ["fx","Built-in effect",0,9,1,"Adds one of the nine ready-made effects."]]}
};
$("edName").addEventListener("change",function(){
  var E=ED[ed.kind],old=ed.item.name,nn=uniqueName(cleanName(this.value)||"My "+E.word,E.list.filter(function(q){return q!==ed.item}).map(function(q){return q.name}));
  ed.item.name=nn;this.value=nn;
  store.tpls.forEach(function(t){var st=t[E.cat].set;if(st){var ix=st.indexOf(old);if(ix>=0)st[ix]=nn;}}); /* templates keep pointing at it */
  saveLibrary();saveStore();refreshLists();
});
$("edDone").addEventListener("click",function(){
  var nm=ed.item.name;ed=null;$("ed").hidden=true;advFill();toast("Saved "+nm+".");wakeHud();
});
$("edHelpBtn").addEventListener("click",function(){
  var h=$("edHelp");h.hidden=!h.hidden;this.setAttribute("aria-expanded",String(!h.hidden));if(!h.hidden)$("ed").scrollTop=0;
});
$("edFine").addEventListener("click",function(){
  var f=$("edFineRows");f.hidden=!f.hidden;this.setAttribute("aria-expanded",String(!f.hidden));
});
["es_one","es_two"].concat(ED_SIMPLE.map(function(r){return "es_"+r[0]})).forEach(function(id){$(id).addEventListener("input",edSimpleRead)});
$("advNewP").addEventListener("click",function(){edNew("p")});
$("advNewM").addEventListener("click",function(){edNew("m")});
$("advNewF").addEventListener("click",function(){edNew("f")});
$("advCopy").addEventListener("click",function(){
  var k=packNow(),txt=JSON.stringify(k);$("advIO").value=txt;
  var fail=function(){toast("Copy was blocked. Select the text in the box and copy it.")};
  try{navigator.clipboard.writeText(txt).then(function(){toast("Copied "+packSummary(k)+".")},fail);}catch(_){fail();}
});
$("advLoad").addEventListener("click",function(){loadPack($("advIO").value)});
$("advSave").addEventListener("click",function(){
  var k=packNow(),a=document.createElement("a"),url=URL.createObjectURL(new Blob([JSON.stringify(k,null,1)],{type:"application/json"}));
  a.href=url;a.download="mirrorfold-pack.json";document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(function(){URL.revokeObjectURL(url)},2000);
  toast("Saved "+packSummary(k)+".");
});
$("advFile").addEventListener("click",function(){$("packIn").click()});
$("packIn").addEventListener("change",function(){
  var f=this.files&&this.files[0];this.value="";
  if(!f)return;
  if(f.size>200000){toast("That file is too big to be a Mirrorfold pack.");return;}
  var rd=new FileReader();
  rd.onload=function(){loadPack(String(rd.result))};
  rd.onerror=function(){toast("That file could not be read.")};
  rd.readAsText(f);
});
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={edClose, ED_SIMPLE, FX_NAMES, palFromSimple, palToSimple, edShow, edHex, edRgb, edSwatch, edRead,
  edSimpleShow, edSimpleRead, edSlider, edHelpFill, edOpen, edNew, get ed(){return ed},set ed(v){ed=v}, get ED(){return ED},set ED(v){ED=v}};
