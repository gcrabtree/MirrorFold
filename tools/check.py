#!/usr/bin/env python3
"""Smoke test: load the page, compile every shader, exercise the main controls, report errors.

  python3 tools/check.py

Exit code 0 means no script error, no WebGL error and every world compiled.
This does not test audio output, real touch input, or frame rate.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import dump

INJECT = r'''
var dbgEl=document.createElement("i");dbgEl.id="dbg";document.body.appendChild(dbgEl);
function log(x){dbgEl.textContent+=x+" ; "}
function pick(id,v){$(id).value=v;$(id).dispatchEvent(new Event("change"))}
setTimeout(function(){$("enter").click()},200);
setTimeout(function(){
  var n=0,bad=[];
  for(var k=0;k<WORLDS.length;k++){try{build(WORLDS[k]);n++}catch(e){bad.push(WORLDS[k].id+": "+e.message.slice(0,120))}}
  log("worlds="+n+"/"+WORLDS.length);if(bad.length)log("FAILED "+bad.join(" | "));
  for(var i=0;i<MOTIONS.length;i++)setMotion(i);
  for(i=0;i<LOOKS.length;i++)setLook(i);
  for(i=0;i<OVERLAYS.length;i++)setOverlay(i);
  for(i=0;i<mirrors.length;i++)setMirrors(i);
  setMotion(2);setLook(5);setOverlay(3);
  /* the land: its shaders compile, each mode and effect target can be chosen, and the JavaScript height is sane */
  setLand(1);setLand(2);setLandTint(1);setLandFx(1);
  log("land="+landMode+" built="+!!pLand+" height="+landH(412,300,6).toFixed(3)+" buttons="+$("bLand").textContent+"|"+$("bLandFx").textContent);
  $("bJourney").click();pick("selJT","t:Everything");
  $("bJMove").click();log("movement="+jMove);$("bJMove").click();log("movement="+jMove+" help="+$("aHelp").getAttribute("href"));
  log("journey="+journey+" template="+jt.name);
  $("bAdv").click();$("advDup").click();$("advClose").click();
  log("user templates="+store.tpls.length);
  store.tpls=[];saveStore();fillJT();
  /* packs: a good one loads and is usable, bad parts are refused, and removing puts everything back */
  var np=PALETTES.length,nm=MOTIONS.length;
  var okp=loadPack(JSON.stringify({mirrorfold:1,palettes:[{name:"Test ice",a:[.4,.6,.7],b:[.3,.3,.3],c:[1,1,1],d:[.5,.5,.6]},{name:"Spectrum",a:[0,0,0],b:[0,0,0],c:[0,0,0],d:[0,0,0]},{name:"Broken",a:[1,2]}],
    motions:[{name:"Test spin",decay:5,zoom:.998,rot:.006},{name:"none",zoom:1}],
    templates:[{name:"Test tour",palette:{mode:"random",set:["Test ice","Nope"]},motion:{mode:"random",set:["Test spin"]}}]}));
  var tt=findT("Test tour");
  log("pack="+okp+" palettes+"+(PALETTES.length-np)+" motions+"+(MOTIONS.length-nm)+" decay="+MOTIONS[nm].decay+" tplset="+(tt?tt.palette.set.join("|")+"/"+tt.motion.set.join("|"):"none"));
  setPalette(np);setMotion(nm);log("using="+PALETTES[pi].name+"/"+MOTIONS[moi].name+" options="+selPal.options.length+"/"+selMotion.options.length);
  log("badpack="+loadPack("{not json")+","+loadPack("[1]")+","+loadPack(JSON.stringify({mirrorfold:2,palettes:[]})));
  $("bLib").click();log("library rows="+$("advMine").children.length);$("advClose").click();
  /* pack filters: every published pack loads whole, its filter code compiles, and bad code is refused */
  var nl=LOOKS.length,sp=SITE_PACKS.map(function(t){var k=JSON.parse(t),b=LOOKS.length+OVERLAYS.length;var ok=loadPack(t,"site");return k.name+":"+ok+":"+(LOOKS.length+OVERLAYS.length-b)+"/"+((k.filters||[]).length+(k.overlays||[]).length)}).join(",");
  log("site packs="+sp);
  loadPack(JSON.stringify({mirrorfold:1,filters:[{name:"Test code",code:"col=col.gbr;"},{name:"Bad clock",code:"col*=uTime;"},{name:"Bad glsl",code:"col=nothing(col);"},{name:"Test mix",edge:.5,post:5}],
    overlays:[{name:"Test ring",code:"ln=1.0-smoothstep(0.0,0.02,abs(length(p)-0.2-0.1*beat));"},{name:"Bad overlay",code:"ln=uOvBeat;"}]}));
  log("overlays+"+(OVERLAYS.length-NOV)+" "+OVERLAYS.slice(NOV).map(function(f){return f.name+(f.reviewed?"":"*")}).join("|"));
  /* the editor: a new palette from sliders, clamped by the cleaner, renamed, then removed */
  $("bLib").click();$("advNewP").click();
  var sl=$("ed_a0");sl.value="0.9";sl.dispatchEvent(new Event("input"));
  $("edName").value="Test made";$("edName").dispatchEvent(new Event("change"));
  log("editor open="+!$("ed").hidden+" made="+PALETTES[pi].name+" a0="+PALETTES[pi].a[0]+" shown="+$("ev_a0").textContent);
  $("es_one").value="#ff0000";$("es_two").value="#0000ff";$("es_changes").value="1";$("es_slide").value="0";$("es_rainbow").value="0";$("es_one").dispatchEvent(new Event("input"));
  $("edHelpBtn").click();
  log("two colours="+JSON.stringify([PALETTES[pi].a,PALETTES[pi].b,PALETTES[pi].c,PALETTES[pi].d])+" help lines="+$("edHelp").children.length+" note hidden="+$("edNote").hidden);
  $("edDone").click();$("bLib").click();$("advNewM").click();
  sl=$("ed_rot");sl.value="0.02";sl.dispatchEvent(new Event("input"));
  log("motion made="+MOTIONS[moi].name+" "+JSON.stringify(MOTIONS[moi]));
  $("edDone").click();$("bLib").click();$("advNewF").click();
  sl=$("ed_post");sl.value="1";sl.dispatchEvent(new Event("input"));
  log("filter made="+JSON.stringify(LOOKS[lki])+" editor closed="+($("edDone").click(),$("ed").hidden));
  var tc2=LOOKS.filter(function(f){return f.name==="Test code"})[0];
  log("filters+"+(LOOKS.length-nl)+" unreviewed="+(tc2&&!tc2.reviewed)+" names="+LOOKS.slice(nl).map(function(f){return f.name}).join("|"));
  window.__nl=nl;
  libRemove("p",np);libRemove("m",nm);store.tpls=[];saveStore();fillJT();
  log("after remove="+PALETTES.length+"/"+MOTIONS.length+" pi="+pi+" moi="+moi);
  setMotion(2);
},500);
setTimeout(function(){setJourney(false);for(var i=window.__nl;i<LOOKS.length;i++)(function(i){setTimeout(function(){setLook(i)},(i-window.__nl)*50)})(i);
  for(i=NOV;i<OVERLAYS.length;i++)(function(i){setTimeout(function(){setOverlay(i)},(i-NOV)*110)})(i);},700);
setTimeout(function(){log("code filters drawn="+LOOKS.slice(window.__nl).filter(function(f){return f.code&&f.prog}).length+" overlays drawn="+OVERLAYS.slice(NOV).filter(function(f){return f.prog}).length);
  while(OVERLAYS.length>NOV)libRemove("o",NOV);
  while(LOOKS.length>window.__nl)libRemove("f",LOOKS.length-1);while(PALETTES.length>NPAL)libRemove("p",NPAL);while(MOTIONS.length>NMOT)libRemove("m",NMOT);
  store.tpls=[];saveStore();fillJT();setLook(5);setJourney(true);},1150);
setTimeout(function(){for(var k in J)J[k].t=999;},1200);
setTimeout(function(){setMusic("tap");tap();},1600);
setTimeout(tap,2100);
setTimeout(function(){tap();log("tap bpm="+(tapInt?Math.round(60/tapInt):0));setMusic("built");},2600);
setTimeout(function(){setStereo(true);setMirrors(3);log("vr="+stereo);},2750);
setTimeout(function(){stepWorld(1);},2900);
setTimeout(function(){setStereo(false);setMirrors(0);},3500);
setTimeout(function(){log("world="+world.id+" music="+musicMode+" audio="+(ac?ac.state:"none")+" glerr="+gl.getError()+" DONE")},3800);
'''
# every pack published in packs/, as text, so the page can load them the way the site would
import glob, json
PACKS = [open(f, encoding="utf-8").read() for f in sorted(glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "packs", "*.json"))) if not f.endswith("index.json")]
INJECT = "var SITE_PACKS=" + json.dumps(PACKS) + ";\n" + INJECT
title, err, log = dump(INJECT, budget_ms=4500)
print("title :", title)
print("errbox:", repr(err))
for line in log.split(" ; "):
    if line.strip():
        print("  ", line)
packs_ok = all(json.loads(t)["name"] + ":true:%d/%d" % ((len(json.loads(t).get("filters", [])) + len(json.loads(t).get("overlays", [])),) * 2) in log for t in PACKS)
if not packs_ok:
    print("   a published pack did not load whole, or one of its filters did not compile")
ok = title == "Mirrorfold" and not err and "FAILED" not in log and "glerr=0" in log and "DONE" in log and packs_ok
print("PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
