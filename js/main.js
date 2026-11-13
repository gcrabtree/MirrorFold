/* Starts the app: loads every file, then runs each one's init in the order the code was written in. */
import * as m0 from "./dom.js";
import * as m1 from "./worlds.js";
import * as m2 from "./packs.js";
import * as m3 from "./shaders.js";
import * as m4 from "./programs.js";
import * as m5 from "./probe.js";
import * as m6 from "./targets.js";
import * as m7 from "./land-shader.js";
import * as m8 from "./landscapes.js";
import * as m9 from "./land.js";
import * as m10 from "./state.js";
import * as m11 from "./library.js";
import * as m12 from "./flight.js";
import * as m13 from "./choose.js";
import * as m14 from "./input.js";
import * as m15 from "./journey.js";
import * as m16 from "./journey-panel.js";
import * as m17 from "./pack-io.js";
import * as m18 from "./editor.js";
import * as m19 from "./controls.js";
import * as m20 from "./vr.js";
import * as m21 from "./audio.js";
import * as m22 from "./listen.js";
import * as m23 from "./loop.js";
import { G } from "./shared.js";
const mods=[m0,m1,m2,m3,m4,m5,m6,m7,m8,m9,m10,m11,m12,m13,m14,m15,m16,m17,m18,m19,m20,m21,m22,m23];
try{for(const m of mods)if(m.init)m.init();}catch(e){if(e.message!=="no WebGL")throw e;}
/* window.MF gives the test tools and the console every internal name, as the single script's closure used to */
const MF={};for(const m of mods)Object.defineProperties(MF,Object.getOwnPropertyDescriptors(m.__dbg));
for(const k of Object.keys(G))Object.defineProperty(MF,k,{get(){return G[k]},set(v){G[k]=v},enumerable:true});
window.MF=MF;window.dispatchEvent(new Event("mf-ready"));
