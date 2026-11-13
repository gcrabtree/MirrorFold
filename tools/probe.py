#!/usr/bin/env python3
"""Distance probe test: for every world, ask the graphics chip for the distance (GLSL "map") at random points
and compare it with the JavaScript distance function ("de") at the same points.

  python3 tools/probe.py

This checks two things at once: that the probe reads distances back correctly, and that each world's two copies
of its distance function agree. A world passes if no point differs by more than 0.002 units plus 0.3% of the distance
(the chip works in 32-bit numbers and JavaScript in 64-bit, so deep folds drift apart a little).
It runs on software rendering, so it says nothing about how long the probe takes on a real graphics chip:
for that, press Stats in the app.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import dump

INJECT = r'''
var dbgEl=document.createElement("i");dbgEl.id="dbg";document.body.appendChild(dbgEl);
setTimeout(function(){
  var out=[],sd=12345,rnd=function(){sd=(Math.imul(sd,1664525)+1013904223)>>>0;return sd/4294967296};
  WORLDS.forEach(function(w){
    if(w.volume){out.push(w.id+" volume");return;}
    var per=w.period(0),worst=0,at="",n=0,bad=0,ms=[-0.9,0,0.9];
    for(var b=0;b<24;b++){
      var m=ms[b%3],k,d;
      for(k=0;k<16;k++){probePts[3*k]=(rnd()-0.5)*2*per[0];probePts[3*k+1]=(rnd()-0.5)*2*per[1];probePts[3*k+2]=(rnd()-0.5)*2*per[2];}
      if(!probe(w,m,16)){out.push(w.id+" NOPROBE");return;}
      for(k=0;k<16;k++){
        var js=w.de(probePts[3*k],probePts[3*k+1],probePts[3*k+2],m);
        if(Math.abs(js)>7.5)continue; /* outside what the probe can carry */
        d=Math.abs(probeOut[k]-js);n++;if(d>0.002+0.003*Math.abs(js))bad++;
        if(d>worst){worst=d;at="chip "+probeOut[k].toFixed(4)+" script "+js.toFixed(4)+" m "+m;}
      }
    }
    out.push(w.id+" "+worst.toFixed(5)+" "+bad+"/"+n+" ("+at+")");
  });
  dbgEl.textContent=out.join(" ; ")+" ; glerr="+gl.getError()+" DONE";
},600);
'''
title, err, dbg = dump(INJECT, budget_ms=6000)
ok = "DONE" in dbg and not title.startswith("ERR") and "glerr=0" in dbg
print("title :", title)
for line in dbg.split(" ; "):
    parts = line.split(" ", 3)
    if len(parts) >= 3 and parts[1] not in ("volume",) and not parts[0].startswith("glerr"):
        if not parts[2].startswith("0/"): ok = False; line = "DIFFERS  " + line
    print("  ", line)
print("PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
