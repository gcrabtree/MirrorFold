/* Knobs: a MIDI controller's knobs and pads, where the browser has Web MIDI. Nothing is sent to the controller. */
import { cam, userLook } from "./camera.js";
import { setLook, setMotion, setOvS } from "./choose.js";
import { $, toast } from "./dom.js";
import { press, stepWorld, wakeHud } from "./input.js";
import { started } from "./loop.js";
import { setPalette } from "./palettes.js";
import { LOOKS, MOTIONS, OVS, sel } from "./state.js";
export const KNOBS=["Speed","Overlay strength","Look left and right","Look up and down"]; /* what the first four knobs turned are given, in that order */
export const PADS=["Next world","Next palette","Next motion","Next filter"];                 /* what a pad or key does, by its note number's remainder on dividing by four */
export const knobs=[];          /* the controller numbers of the knobs turned so far, in the order they were first turned */
export const turn2={x:0,y:0};   /* how fast the two look knobs are turning the view, -1 to 1 each */
let access=null,on=false;

/* A MIDI message as what it means here: a knob (controller number and 0..1), a pad press (note number), or null. */
export function midiRead(d){
  if(!d||d.length<3)return null;
  var kind=d[0]&0xf0;
  if(kind===0xb0)return {knob:d[1]&127,v:(d[2]&127)/127};
  if(kind===0x90&&(d[2]&127)>0)return {pad:d[1]&127};
  return null;
}
/* which of the four jobs a knob has: the first four different knobs turned get them in order; any more get none (-1) */
export function knobSlot(list,cc){
  var i=list.indexOf(cc);
  if(i<0&&list.length<KNOBS.length){list.push(cc);i=list.length-1;}
  return i;
}
/* a look knob's position as a turning rate: nothing near the middle, so a knob left about centre does not creep */
export function knobRate(v){var x=(v-0.5)*2;return Math.abs(x)<0.12?0:(x-0.12*(x<0?-1:1))/0.88;}
export function midiMsg(d){
  var m=midiRead(d),slot;
  if(!m||!started)return;
  if(m.pad!==undefined){
    slot=m.pad%4;
    if(slot===0)stepWorld(1);else if(slot===1)setPalette(sel.pi+1);else if(slot===2)setMotion((sel.moi+1)%MOTIONS.length);else setLook((sel.lki+1)%LOOKS.length);
    return;
  }
  slot=knobSlot(knobs,m.knob);
  if(slot===0)cam.baseSpeed=0.2*Math.pow(20,m.v); /* 0.2x to 4x, as the wheel and the pinch give */
  else if(slot===1)setOvS(Math.min(OVS.length-1,Math.floor(m.v*OVS.length)));
  else if(slot===2)turn2.x=knobRate(m.v);
  else if(slot===3)turn2.y=knobRate(m.v);
}
/* each frame: the look knobs turn the view at a steady rate, through userLook, so the autopilot stands back as for a hand */
export function midiFrame(fr){
  if(on&&(turn2.x||turn2.y))userLook(turn2.x*1.2*fr.dt,turn2.y*1.2*fr.dt);
}
function listen(){access.inputs.forEach(function(inp){inp.onmidimessage=function(e){midiMsg(e.data)}});}
export function setMidi(want){
  if(!want){on=false;turn2.x=turn2.y=0;press($("bMidi"),false);if(access)access.inputs.forEach(function(inp){inp.onmidimessage=null});return;}
  navigator.requestMIDIAccess().then(function(a){
    access=a;on=true;knobs.length=0;press($("bMidi"),true);listen();a.onstatechange=function(){if(on)listen()};
    toast(a.inputs.size?"Knobs on. The first four knobs you turn set speed, overlay strength, and look across and up. Pads change world, palette, motion and filter.":"Knobs on, but no MIDI controller is connected yet.");
  },function(){toast("The browser did not allow MIDI.")});
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
var b=$("bMidi");
if(!navigator.requestMIDIAccess){b.hidden=true;return;} /* no Web MIDI in this browser (Safari, for one): no button */
b.addEventListener("click",function(){setMidi(!on);wakeHud()});
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={KNOBS, PADS, knobs, turn2, midiRead, knobSlot, knobRate, midiMsg, midiFrame, listen, setMidi,
  get access(){return access},set access(v){access=v}, get on(){return on},set on(v){on=v}};
