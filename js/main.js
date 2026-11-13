/* Starts the app: loads every file, then runs each file's init, if it has one, in this order. The order matters only for
   the start-up work: a file's init may use what the files before it have set up. */
import * as m0 from "./dom.js";
import * as m1 from "./worlds.js";
import * as m2 from "./palettes.js";
import * as m3 from "./packs.js";
import * as m4 from "./shaders.js";
import * as m5 from "./programs.js";
import * as m6 from "./probe.js";
import * as m7 from "./pack-worlds.js";
import * as m8 from "./targets.js";
import * as m9 from "./land-shader.js";
import * as m10 from "./landscapes.js";
import * as m11 from "./land.js";
import * as m12 from "./state.js";
import * as m13 from "./library.js";
import * as m14 from "./flight.js";
import * as m15 from "./choose.js";
import * as m16 from "./orbs.js";
import * as m17 from "./spots.js";
import * as m18 from "./input.js";
import * as m19 from "./journey.js";
import * as m20 from "./journey-panel.js";
import * as m21 from "./pack-io.js";
import * as m22 from "./editor.js";
import * as m23 from "./controls.js";
import * as m24 from "./stats.js";
import * as m25 from "./vr.js";
import * as m26 from "./audio.js";
import * as m27 from "./listen.js";
import * as m28 from "./camera.js";
import * as m29 from "./clock.js";
import * as m30 from "./warp.js";
import * as m31 from "./render.js";
import * as m32 from "./loop.js";
const mods=[m0,m1,m2,m3,m4,m5,m6,m7,m8,m9,m10,m11,m12,m13,m14,m15,m16,m17,m18,m19,m20,m21,m22,m23,m24,m25,m26,m27,m28,m29,m30,m31,m32];
/* an init that cannot go on (no WebGL, or no shader compiles) has already put a message on the page, and stops start-up by throwing "stop" */
try{for(const m of mods)if(m.init)m.init();}catch(e){if(e.message!=="stop")throw e;}
/* window.MF gives the test tools and the console every internal name, as the single script's closure used to */
const MF={};for(const m of mods)Object.defineProperties(MF,Object.getOwnPropertyDescriptors(m.__dbg));
/* the fields of the state objects can also be named bare (MF.pos for MF.cam.pos), which keeps test code short */
for(const o of [MF.cam,MF.tr,MF.clock,MF.scene,MF.sel,MF.flip])for(const k of Object.keys(o))Object.defineProperty(MF,k,{get(){return o[k]},set(v){o[k]=v},enumerable:true,configurable:true});
window.MF=MF;window.dispatchEvent(new Event("mf-ready"));
