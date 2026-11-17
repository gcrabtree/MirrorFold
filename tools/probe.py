#!/usr/bin/env python3
"""Distance probe test: for every world, ask the graphics chip for the distance (GLSL "map") at random points
and compare it with the JavaScript distance function ("de") at the same points. The worlds made of one shape
repeated are compared once in each packing (js/packing.js), and again in each packing but the grid with the shapes
mixed and the pulse a wave.

  python3 tools/probe.py

This checks two things at once: that the probe reads distances back correctly, and that each world's two copies
of its distance function agree. A world passes if no point differs by more than 0.002 units plus 0.3% of the distance
(the chip works in 32-bit numbers and JavaScript in 64-bit, so deep folds drift apart a little).
In a packing other than the grid one point in a run may differ: the packing changes its way of working at set
distances from a copy, and a point that lies on such a line to seven places can fall either side of it.
The descent is asked only about places near where its camera is kept; further out its copies are many times larger,
and the same drift is that many times more.
It runs on software rendering, so it says nothing about how long the probe takes on a real graphics chip:
for that, press Stats in the app.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import dump

INJECT = r'''
var dbgEl=document.createElement("i");dbgEl.id="dbg";document.body.appendChild(dbgEl);
setTimeout(function(){
  setPkPlain(true); /* JavaScript is to answer as the shader does in the packings, not with its own wider look at the open space */
  var out=[],sd=12345,rnd=function(){sd=(Math.imul(sd,1664525)+1013904223)>>>0;return sd/4294967296};
  [0,1,2].forEach(function(opt){
  if(opt===1){setMix(true);setPulse(true);}
  if(opt===2){setMix(false);setPulse(false);setInOutNow(true);} /* and once more inside out, in the grid */
  WORLDS.forEach(function(w){
    if(w.volume){if(!opt)out.push(w.id+" volume");return;}
    if(opt===2&&!w.de0)return;
    PACKINGS.forEach(function(pkg,pi){
    if((pi||opt)&&!w.packs)return;
    if(opt===1&&!pi)return;
    if(opt===2&&pi)return;
    setPackingNow(pi);
    var keep=sd;if(w.sheet)sd=24680; /* the Fabric has a run of numbers of its own, put back after it: the worlds after it are then asked about the same places as before it was added (two of them pass only by which places they are asked about, inside their shapes, where a distance means little) */
    var name=w.id+(pi?"/"+pkg.name:"")+(opt===1?"/mixed,wave":opt===2?"/inside-out":""),per=w.period(0).map(function(v){return pi===PK_DEEP?v/4:v}),worst=0,at="",n=0,bad=0,ms=[-0.9,0,0.9];
    for(var b=0;b<24;b++){
      var m=ms[b%3],k,d;
      for(k=0;k<16;k++){probePts[3*k]=(rnd()-0.5)*2*per[0];probePts[3*k+1]=(rnd()-0.5)*2*per[1];probePts[3*k+2]=(rnd()-0.5)*2*per[2];}
      if(!probe(w,m,16)){out.push(name+" NOPROBE");return;}
      for(k=0;k<16;k++){
        var js=w.de(probePts[3*k],probePts[3*k+1],probePts[3*k+2],m);
        if(opt===2&&probeOut[k]<0)probeOut[k]=0; /* inside a wall the script answers nothing where the shader goes below it */
        if(Math.abs(js)>7.5)continue; /* outside what the probe can carry */
        d=Math.abs(probeOut[k]-js);n++;if(d>0.002+0.003*Math.abs(js))bad++;
        if(d>worst){worst=d;at="chip "+probeOut[k].toFixed(4)+" script "+js.toFixed(4)+" m "+m;}
      }
    }
    out.push(name+" "+worst.toFixed(5)+" "+bad+"/"+n+" ("+at+")");
    if(w.sheet)sd=keep;
    });
    setPackingNow(0);
  });
  });
  dbgEl.textContent=out.join(" ; ")+" ; glerr="+gl.getError()+" DONE";
},600);
'''
title, err, dbg = dump(INJECT, budget_ms=40000)
ok = "DONE" in dbg and not title.startswith("ERR") and "glerr=0" in dbg
print("title :", title)
for line in dbg.split(" ; "):
    parts = line.split(" ", 3)
    if len(parts) >= 3 and parts[1] not in ("volume",) and not parts[0].startswith("glerr"):
        loose = parts[0].count("/") > 0 and not parts[0].endswith("/inside-out")  # a packing other than the grid
        if not (parts[2].startswith("0/") or (loose and parts[2].startswith("1/"))): ok = False; line = "DIFFERS  " + line
    print("  ", line)
print("PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
