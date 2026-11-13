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
  $("bJourney").click();pick("selJT","t:Everything");
  $("bJMove").click();log("movement="+jMove);$("bJMove").click();log("movement="+jMove+" help="+$("aHelp").getAttribute("href"));
  log("journey="+journey+" template="+jt.name);
  $("bAdv").click();$("advDup").click();$("advClose").click();
  log("user templates="+store.tpls.length);
  store.tpls=[];saveStore();fillJT();
},500);
setTimeout(function(){for(var k in J)J[k].t=999;},1200);
setTimeout(function(){setMusic("tap");tap();},1600);
setTimeout(tap,2100);
setTimeout(function(){tap();log("tap bpm="+(tapInt?Math.round(60/tapInt):0));setMusic("built");},2600);
setTimeout(function(){setStereo(true);setMirrors(3);log("vr="+stereo);},2750);
setTimeout(function(){stepWorld(1);},2900);
setTimeout(function(){setStereo(false);setMirrors(0);},3500);
setTimeout(function(){log("world="+world.id+" music="+musicMode+" audio="+(ac?ac.state:"none")+" glerr="+gl.getError()+" DONE")},3800);
'''
title, err, log = dump(INJECT, budget_ms=4500)
print("title :", title)
print("errbox:", repr(err))
for line in log.split(" ; "):
    if line.strip():
        print("  ", line)
ok = title == "Mirrorfold" and not err and "FAILED" not in log and "glerr=0" in log and "DONE" in log
print("PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
