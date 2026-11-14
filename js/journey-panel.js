/* The setup panel: making and changing Journey templates and sets. */
import { $, toast } from "./dom.js";
import { edClose } from "./editor.js";
import { wakeHud } from "./input.js";
import { BUILTIN_S, BUILTIN_T, CATS, MODE_LABEL, allS, allT, applyTemplate, fillJT, findS, findT, journey, jt,
  jtReset, normS, normT, saveStore, selectJourney, setJourney, store } from "./journey.js";
import { advRenderLib, loadSitePacks } from "./pack-io.js";
export let advT,advS; /* the template and the set the panel is showing */
export function advPick(t,s){if(t)advT=t;if(s)advS=s;} /* choose which template and set the panel shows */
export let adv;
let advTpl, advSet;

export function mk(tag,props,kids){var e=document.createElement(tag),k;for(k in props){if(k==="text")e.textContent=props[k];else e.setAttribute(k,props[k]);}(kids||[]).forEach(function(c){e.appendChild(c)});return e;}
export function uniqueName(base,taken){var n=base.slice(0,28),i=2;while(taken.indexOf(n)>=0){n=(base.slice(0,24)+" "+i);i++;}return n;}
export function advFill(){
  advTpl.textContent="";allT().forEach(function(t){advTpl.appendChild(mk("option",{value:t.name,text:t.name+(t.builtin?" (built-in)":"")}))});
  advTpl.value=advT.name;
  advSet.textContent="";allS().forEach(function(x){advSet.appendChild(mk("option",{value:x.name,text:x.name+(x.builtin?" (built-in)":"")}))});
  advSet.value=advS.name;
  advRenderT();advRenderS();advRenderLib();
}
function advRenderT(){
  var t=advT,ro=t.builtin,box=$("advCats");
  $("advName").value=t.name;$("advName").disabled=ro;$("advDel").disabled=ro;$("advDel").textContent="Delete";
  $("advLock").textContent=ro?"Built-in templates cannot be changed. Duplicate one to make your own.":"";
  box.textContent="";
  CATS.forEach(function(c){
    var cfg=t[c.k];
    var sel=mk("select",{id:"advM_"+c.k,"aria-label":c.label+" mode"},c.modes.map(function(m){return mk("option",{value:m,text:c.label+": "+MODE_LABEL[m]})}));
    sel.value=cfg.mode;sel.disabled=ro;
    sel.addEventListener("change",function(){cfg.mode=this.value;advChanged();advRenderT()});
    var num=mk("input",{id:"advE_"+c.k,type:"number",min:"4",max:"600",step:"1",inputmode:"numeric",value:String(cfg.every)});num.disabled=ro;
    num.addEventListener("change",function(){cfg.every=Math.max(4,Math.min(600,+this.value||c.every));this.value=String(cfg.every);advChanged()});
    var row=mk("div",{"class":"advRow"},[sel,mk("label",{"for":"advE_"+c.k,text:"about every"}),num,mk("label",{"for":"advE_"+c.k,text:"sec"})]);
    var kids=[mk("legend",{text:c.label}),row];
    if(c.k==="world"){
      var tr=mk("select",{id:"advTrig","aria-label":"What triggers a world change"},[mk("option",{value:"timer",text:"Change on the clock"}),mk("option",{value:"sound",text:"Change when the music shifts"})]);
      tr.value=cfg.trigger;tr.disabled=ro;tr.addEventListener("change",function(){cfg.trigger=this.value;advChanged()});
      kids.push(mk("div",{"class":"advRow"},[tr]));
    }
    if(c.k==="mirrors"){
      var nw=mk("select",{id:"advNone","aria-label":"Chance of no mirrors"},[mk("option",{value:"even",text:"All options equally likely"}),mk("option",{value:"50",text:"50% chance of none"}),mk("option",{value:"75",text:"75% chance of none"})]);
      nw.value=cfg.none;nw.disabled=ro;nw.addEventListener("change",function(){cfg.none=this.value;advChanged()});
      kids.push(mk("div",{"class":"advRow"},[nw]));
    }
    var chips=mk("div",{"class":"chips"+(cfg.mode==="random"?"":" dim")});
    c.opts.forEach(function(o){
      var on=!cfg.set||cfg.set.indexOf(o[0])>=0,bt2=mk("button",{type:"button","aria-pressed":on?"true":"false",text:o[1]});bt2.disabled=ro;
      bt2.addEventListener("click",function(){
        var cur=cfg.set?cfg.set.slice():c.opts.map(function(x){return x[0]}),ix=cur.indexOf(o[0]);
        if(ix>=0)cur.splice(ix,1);else cur.push(o[0]);
        cfg.set=cur.length===c.opts.length?null:cur;advChanged();advRenderT();
      });
      chips.appendChild(bt2);
    });
    var all=mk("button",{type:"button",text:"All"}),none=mk("button",{type:"button",text:"Clear"});all.disabled=none.disabled=ro;
    all.addEventListener("click",function(){cfg.set=null;advChanged();advRenderT()});
    none.addEventListener("click",function(){cfg.set=[];advChanged();advRenderT()});
    kids.push(chips,mk("div",{"class":"advRow"},[all,none]));
    box.appendChild(mk("fieldset",{},kids));
  });
}
function advChanged(){saveStore();if(journey&&jt===advT)applyTemplate(advT);}
function advRenderS(){
  var x=advS,ro=x.builtin,box=$("advSetBody");
  $("advSetDel").disabled=ro;$("advSetDel").textContent="Delete";
  $("advSetLock").textContent=ro?"Built-in sets cannot be changed. New set starts from a copy of this one.":"";
  box.textContent="";
  var nm=mk("input",{id:"advSetName",type:"text",maxlength:"28",autocomplete:"off",value:x.name});nm.disabled=ro;
  nm.addEventListener("change",function(){
    var old=x.name,nn=uniqueName(this.value.trim()||"My set",allS().filter(function(q){return q!==x}).map(function(q){return q.name}));
    x.name=nn;this.value=nn;if(store.sel==="s:"+old)store.sel="s:"+nn;saveStore();fillJT();advFill();
  });
  var ord=mk("select",{id:"advSetOrder","aria-label":"Order"},[mk("option",{value:"cycle",text:"Play in order, then repeat"}),mk("option",{value:"random",text:"Play in random order"})]);
  ord.value=x.order;ord.disabled=ro;ord.addEventListener("change",function(){x.order=this.value;saveStore()});
  box.appendChild(mk("div",{"class":"advRow"},[mk("label",{"for":"advSetName",text:"Name"}),nm]));
  box.appendChild(mk("div",{"class":"advRow"},[ord]));
  x.items.forEach(function(it,ix){
    var ts=mk("select",{id:"advSt_"+ix,"aria-label":"Template for step "+(ix+1)},allT().map(function(t){return mk("option",{value:t.name,text:(ix+1)+". "+t.name})}));
    ts.value=it.tpl;ts.disabled=ro;ts.addEventListener("change",function(){it.tpl=this.value;saveStore()});
    var mn=mk("input",{id:"advSm_"+ix,type:"number",min:"0.25",max:"120",step:"0.25",inputmode:"decimal",value:String(it.min)});mn.disabled=ro;
    mn.addEventListener("change",function(){it.min=Math.max(0.25,Math.min(120,+this.value||2));this.value=String(it.min);saveStore()});
    var rm=mk("button",{type:"button",text:"Remove"});rm.disabled=ro;
    rm.addEventListener("click",function(){x.items.splice(ix,1);saveStore();advRenderS()});
    box.appendChild(mk("div",{"class":"advRow"},[ts,mk("label",{"for":"advSm_"+ix,text:"for"}),mn,mk("label",{"for":"advSm_"+ix,text:"min"}),rm]));
  });
  var add=mk("button",{type:"button",text:"Add a step"});add.disabled=ro;
  add.addEventListener("click",function(){x.items.push({tpl:advT.name,min:2});saveStore();advRenderS()});
  box.appendChild(mk("div",{"class":"advRow"},[add]));
}
function twoTap(btn,fn){ /* deleting takes a second tap */
  if(btn.textContent!=="Tap again to delete"){btn.textContent="Tap again to delete";setTimeout(function(){btn.textContent="Delete"},3000);return;}
  fn();
}
function useJourney(sel,label){
  store.sel=sel;saveStore();fillJT();
  if(!journey)setJourney(true);else selectJourney(sel);
  adv.hidden=true;toast("Journey: "+label);wakeHud();
}
export function openAdv(toLibrary){
  var cur=store.sel.charAt(0)==="t"?findT(store.sel.slice(2)):null,cs=store.sel.charAt(0)==="s"?findS(store.sel.slice(2)):null;
  advPick(cur,cs);
  edClose();
  advFill();loadSitePacks();adv.hidden=false;adv.scrollTop=toLibrary?$("advLibHead").offsetTop-12:0;
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
adv=$("adv"),advTpl=$("advTpl"),advSet=$("advSet"),advT=BUILTIN_T[0],advS=BUILTIN_S[0];
advTpl.addEventListener("change",function(){advT=findT(this.value)||BUILTIN_T[0];advRenderT()});
advSet.addEventListener("change",function(){advS=findS(this.value)||BUILTIN_S[0];advRenderS()});
$("advName").addEventListener("change",function(){
  if(advT.builtin)return;
  var old=advT.name,nn=uniqueName(this.value.trim()||"My template",allT().filter(function(q){return q!==advT}).map(function(q){return q.name}));
  advT.name=nn;
  allS().forEach(function(x){x.items.forEach(function(it){if(it.tpl===old)it.tpl=nn})});
  if(store.sel==="t:"+old)store.sel="t:"+nn;
  saveStore();fillJT();advFill();
});
$("advDup").addEventListener("click",function(){
  var c=normT(JSON.parse(JSON.stringify(advT)),false);
  c.name=uniqueName(advT.name+" copy",allT().map(function(q){return q.name}));
  store.tpls.push(c);advT=c;saveStore();fillJT();advFill();toast("Made "+c.name+". Edit it below.");
});
$("advDel").addEventListener("click",function(){
  if(advT.builtin)return;var b=this;
  twoTap(b,function(){
    var gone=advT;store.tpls=store.tpls.filter(function(q){return q!==gone});
    if(store.sel==="t:"+gone.name)store.sel="t:Classic";
    if(jt===gone){jtReset();if(journey)selectJourney(store.sel);}
    advT=BUILTIN_T[0];saveStore();fillJT();advFill();
  });
});
$("advSetNew").addEventListener("click",function(){
  var c=normS(JSON.parse(JSON.stringify(advS)),false);
  c.name=uniqueName("My set",allS().map(function(q){return q.name}));
  store.sets.push(c);advS=c;saveStore();fillJT();advFill();toast("Made "+c.name+". Edit it below.");
});
$("advSetDel").addEventListener("click",function(){
  if(advS.builtin)return;var b=this;
  twoTap(b,function(){
    var gone=advS;store.sets=store.sets.filter(function(q){return q!==gone});
    if(store.sel==="s:"+gone.name){store.sel="t:Classic";if(journey)selectJourney(store.sel);}
    advS=BUILTIN_S[0];saveStore();fillJT();advFill();
  });
});
$("advUseT").addEventListener("click",function(){useJourney("t:"+advT.name,advT.name)});
$("advUseS").addEventListener("click",function(){useJourney("s:"+advS.name,advS.name)});
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={advPick, mk, uniqueName, advFill, advRenderT, advChanged, advRenderS, twoTap, useJourney, openAdv,
  get advT(){return advT},set advT(v){advT=v}, get advS(){return advS},set advS(v){advS=v}, get adv(){return adv},set adv(v){adv=v}, get advTpl(){return advTpl},set advTpl(v){advTpl=v}, get advSet(){return advSet},set advSet(v){advSet=v}};
