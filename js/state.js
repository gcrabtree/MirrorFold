/* what is chosen in each list, as a position in it */
import { calm } from "./dom.js";
export const sel={pi:0,mi:0,fi:0,moi:0,lki:0,ovsi:2,ovi:0}; /* palette, mirrors, FX, motion, filter, overlay strength, overlay */

export const mirrors=[0,3,4,6,8,12];
export const FX=[{name:"glow",decay:.78,bloom:.55,ca:.004},{name:"trails",decay:.93,bloom:.75,ca:.008},{name:"clean",decay:0,bloom:0,ca:0}];
/* MilkDrop-style layers. A motion warps the previous frame before the new one is laid over it (per frame at 60 fps).
   A filter recolours or reshapes the finished picture. Wave draws the sound's waveform into the feedback so it smears. */
export const MOTIONS=[
 {name:"none"},
 {name:"Melt",decay:.965,zoom:.999,wob:.0015,dy:.004},
 {name:"Vortex",decay:.96,zoom:.992,rot:.012,swirl:.03,kick:1},
 {name:"Tunnel",decay:.955,zoom:.965,kick:1},
 {name:"Implode",decay:.95,zoom:1.03,rot:.004,kick:-1},
 {name:"Ripple",decay:.955,zoom:.996,rip:.012},
 {name:"Drift",decay:.96,zoom:.999,wob:.001,dx:.004}
];
export const LOOKS=[
 {name:"none"},
 {name:"Echo",echo:1},
 {name:"Neon",edge:1},
 {name:"Solar",solar:1},
 {name:"Negative",inv:1},
 {name:"Poster",post:4,edge:.35},
 {name:"Mosaic",mos:70},
 {name:"Liquid",liq:.012},
 {name:"Prism",hue:1,ca:.02},
 {name:"Quad",fx:1},
 {name:"Tiles",fx:2},
 {name:"Bulge",fx:3},
 {name:"Twirl",fx:4},
 {name:"Thermal",fx:5},
 {name:"CRT",fx:6},
 {name:"Halftone",fx:7},
 {name:"Contour",fx:8},
 {name:"Noir",fx:9},
 {name:"Comic",fx:10},
 {name:"Two-tone",fx:11},
 {name:"Tape",fx:12},
 {name:"Streaks",fx:13},
 {name:"Emboss",fx:14},
 {name:"Glass",fx:15}
];
export const OVS=[.15,.3,.5,.75,1];
export const OVERLAYS=[{name:"none"},{name:"Ring"},{name:"Scope"},{name:"Spectrum",spec:1},{name:"Spokes",spec:1},{name:"Rings"},{name:"Spiral"},{name:"Orbit"}];
export const TRANSITIONS=8;

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
sel.fi=calm?2:0; /* with reduced motion asked for, start with the clean look */
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={sel, mirrors, FX, MOTIONS, LOOKS, OVS, OVERLAYS, TRANSITIONS};
