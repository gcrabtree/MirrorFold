/* The built-in music: a dance track that is made up as it plays, at 126 beats a minute in a minor key.
   Nothing is recorded. Every sound is built from oscillators and noise:
     kick       a sine that drops in pitch, with a click on the front; on every beat
     pumping    each kick pushes everything else down for a moment and lets it swell back (sidechain), the sound of the style
     bass       a saw over a sine an octave down, on the off-beats or rolling in sixteenths between the kicks
     clap, hats noise through filters
     pad        the chord on stacked, slightly detuned saws, chopped into a rhythm by a gate
     arp, lead  short plucked notes running through the chord, and a tune over the top
     riser, impact   noise sweeping up before a drop, and a boom on it
   A song is 72 bars: intro, build, drop, breakdown, build, drop, outro. Then a new one starts in another key, with other
   chords and patterns. The steps are sixteenth notes; a timer wakes ten times a second and schedules the steps that
   fall in the next third of a second on the audio clock, which is what keeps the timing exact. */
import { ac, bus } from "./audio.js";

const BPM=126,STEP=60/BPM/4; /* a step is a sixteenth note */
const SCALE=[0,2,3,5,7,8,10]; /* natural minor, in semitones above the key note */
/* chords for four bars, as steps of the scale counted from 0: i VI III VII, i iv VI VII, VI VII i i, i III VII VI, i VII VI VII */
const PROGS=[[0,5,2,6],[0,3,5,6],[5,6,0,0],[0,2,6,5],[0,6,5,6]];
/* rhythms the pad is chopped into: sixteen steps, 1 open and 0 shut */
const GATES=[[1,0,1,1,0,1,1,0,1,0,1,1,0,1,1,0],[1,1,0,1,1,0,1,0,1,1,0,1,1,0,1,0],[1,0,0,1,0,0,1,0,1,0,0,1,0,0,1,1]];
/* the song's sections, each a name and a number of bars */
const PLAN=[["intro",8],["build",8],["drop",16],["break",8],["build",8],["drop",16],["outro",8]];
const seq={on:false,timer:0,next:0,step:0};
let C=null,M=null,song=null; /* the audio context in use, the nodes made for it, and the song being played */

function rnd(n){return Math.floor(Math.random()*n);}
function hz(midi){return 440*Math.pow(2,(midi-69)/12);}
function degree(k){return SCALE[((k%7)+7)%7]+12*Math.floor(k/7);} /* step k of the scale, in semitones */
function euclid(k,n,i){return (i*k)%n<k;} /* k hits spread as evenly as they will go over n steps */

/* ---- the mixer: made once for a context ---- */
function gain(v,to){var g=C.createGain();g.gain.value=v;if(to)g.connect(to);return g;}
function filter(type,f,q,to){var b=C.createBiquadFilter();b.type=type;b.frequency.value=f;b.Q.value=q;if(to)b.connect(to);return b;}
function graph(out){
  M={};
  M.out=gain(0,out); /* faded in when the music starts and out when it stops */
  M.air=filter("lowpass",9000,0.5,M.out); /* the very top, which opens as you fly faster */
  M.comp=C.createDynamicsCompressor();M.comp.threshold.value=-14;M.comp.knee.value=8;M.comp.ratio.value=4;M.comp.attack.value=0.005;M.comp.release.value=0.14;
  M.comp.connect(M.air);
  M.drums=gain(1,M.comp);
  M.duck=gain(1,M.comp);    /* what pumps with the kick */
  M.subDuck=gain(1,M.comp); /* the bass, which gets out of the kick's way further */
  M.tone=filter("lowpass",9000,0.7,M.duck); /* the top end: opened by flying fast, closed in the quiet sections */
  M.gate=gain(0,M.tone);M.padF=filter("lowpass",1200,1.2,M.gate);
  M.dlyIn=gain(1);var d=C.createDelay(1),fb=gain(0.38);d.delayTime.value=STEP*3; /* an echo three steps behind */
  M.dlyIn.connect(d);d.connect(fb);fb.connect(d);d.connect(M.tone);
  M.revIn=gain(1);var rv=C.createConvolver(),n=Math.floor(C.sampleRate*2.2),ir=C.createBuffer(2,n,C.sampleRate),ch,i,c;
  for(c=0;c<2;c++){ch=ir.getChannelData(c);for(i=0;i<n;i++)ch[i]=(Math.random()*2-1)*Math.pow(1-i/n,2.6);} /* a room: noise dying away */
  rv.buffer=ir;M.revIn.connect(rv);rv.connect(gain(0.45,M.duck));
  M.noise=C.createBuffer(1,C.sampleRate,C.sampleRate);ch=M.noise.getChannelData(0);for(i=0;i<ch.length;i++)ch[i]=Math.random()*2-1; /* a second of noise, looped wherever noise is wanted */
}

/* ---- the sounds ---- */
function env(g,t,peak,dur){g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+0.004);g.gain.exponentialRampToValueAtTime(0.0005,t+dur);}
function osc(type,f,t,dur,to,cents){var o=C.createOscillator();o.type=type;o.frequency.value=f;if(cents)o.detune.value=cents;o.connect(to);o.start(t);o.stop(t+dur);return o;}
function hiss(t,dur,to){var s=C.createBufferSource();s.buffer=M.noise;s.loop=true;s.connect(to);s.start(t,Math.random()*0.1);s.stop(t+dur);return s;}
function kick(t,v){
  var g=gain(0,M.drums),o=osc("sine",165,t,0.4,g);
  o.frequency.setValueAtTime(165,t);o.frequency.exponentialRampToValueAtTime(54,t+0.07);o.frequency.exponentialRampToValueAtTime(44,t+0.3);
  g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(v,t+0.002);g.gain.exponentialRampToValueAtTime(0.001,t+0.36);
  var cg=gain(0,M.drums);env(cg,t,0.22*v,0.02);hiss(t,0.03,filter("highpass",3000,0.7,cg));
  /* the pump: down quickly, back up over about a fifth of a second */
  M.duck.gain.setTargetAtTime(0.42,t,0.006);M.duck.gain.setTargetAtTime(1,t+0.03,0.085);
  M.subDuck.gain.setTargetAtTime(0.2,t,0.005);M.subDuck.gain.setTargetAtTime(1,t+0.03,0.07);
}
function clap(t,v){ /* three quick bursts and a tail */
  var g=gain(0,M.drums),k;g.connect(gain(0.3,M.revIn));
  g.gain.setValueAtTime(0.0001,t);
  for(k=0;k<3;k++){g.gain.setValueAtTime(v,t+k*0.011);g.gain.exponentialRampToValueAtTime(v*0.2,t+k*0.011+0.009);}
  g.gain.setValueAtTime(v,t+0.033);g.gain.exponentialRampToValueAtTime(0.0005,t+0.21);
  hiss(t,0.23,filter("bandpass",1500,1.1,g));
}
function hat(t,v,open){
  var g=gain(0,open?M.duck:M.drums);env(g,t,v,open?0.2:0.035);
  hiss(t,open?0.22:0.05,filter("highpass",open?6500:8500,0.7,g));
}
function bass(t,f,dur,v,bright){
  var g=gain(0,M.subDuck),lp=filter("lowpass",200,3,g);
  g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(1,t+0.005);g.gain.setValueAtTime(1,t+dur*0.7);g.gain.linearRampToValueAtTime(0.0001,t+dur);
  lp.frequency.setValueAtTime(200+1300*bright,t);lp.frequency.exponentialRampToValueAtTime(160+200*bright,t+dur);
  osc("sawtooth",f*2,t,dur+0.02,gain(0.2*v,lp));osc("sine",f,t,dur+0.02,gain(0.26*v,g));
}
function arp(t,f,v){
  var g=gain(0,M.tone),lp=filter("lowpass",3200,3,g);
  g.connect(gain(0.4,M.dlyIn));g.connect(gain(0.2,M.revIn));
  env(g,t,v,0.24);lp.frequency.setValueAtTime(3600,t);lp.frequency.exponentialRampToValueAtTime(500,t+0.2);
  osc("sawtooth",f,t,0.26,lp);osc("square",f,t,0.26,gain(0.5,lp),7);
}
function lead(t,f,dur,v){
  var g=gain(0,M.tone),lp=filter("lowpass",2600,1.5,g);
  g.connect(gain(0.45,M.dlyIn));g.connect(gain(0.35,M.revIn));
  g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(v,t+0.012);g.gain.setValueAtTime(v,t+dur*0.6);g.gain.exponentialRampToValueAtTime(0.0005,t+dur+0.12);
  osc("sawtooth",f,t,dur+0.14,lp,-9);osc("sawtooth",f,t,dur+0.14,lp,9);osc("triangle",f*2,t,dur+0.14,gain(0.3,lp));
}
function pad(t,notes,dur,v){ /* one bar of the chord: three detuned saws to a note */
  var g=gain(0,M.padF),i;
  g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(v,t+0.03);g.gain.setValueAtTime(v,t+dur-0.03);g.gain.linearRampToValueAtTime(0.0001,t+dur+0.04);
  for(i=0;i<notes.length;i++){osc("sawtooth",hz(notes[i]),t,dur+0.06,g,-13);osc("sawtooth",hz(notes[i]),t,dur+0.06,g,0);osc("sawtooth",hz(notes[i]),t,dur+0.06,g,12);}
}
function riser(t,dur){ /* noise and a tone sweeping upward into a drop */
  var g=gain(0,M.tone),bp=filter("bandpass",400,1.6,g),tg=gain(0,M.tone),o;
  g.connect(gain(0.5,M.revIn));
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.2,t+dur);g.gain.linearRampToValueAtTime(0.0001,t+dur+0.05);
  bp.frequency.setValueAtTime(400,t);bp.frequency.exponentialRampToValueAtTime(9000,t+dur);hiss(t,dur+0.06,bp);
  tg.gain.setValueAtTime(0.0001,t);tg.gain.exponentialRampToValueAtTime(0.035,t+dur);tg.gain.linearRampToValueAtTime(0.0001,t+dur+0.05);
  o=osc("sawtooth",220,t,dur+0.06,filter("lowpass",2500,1,tg));o.frequency.setValueAtTime(220,t);o.frequency.exponentialRampToValueAtTime(1760,t+dur);
}
function impact(t,f){ /* the boom on a drop */
  var g=gain(0,M.drums),lp=filter("lowpass",1400,0.7,g),sg=gain(0,M.drums),o;
  g.connect(gain(0.6,M.revIn));env(g,t,0.32,1.6);lp.frequency.setValueAtTime(1400,t);lp.frequency.exponentialRampToValueAtTime(180,t+1.4);hiss(t,1.7,lp);
  env(sg,t,0.5,0.9);o=osc("sine",f*2,t,0.95,sg);o.frequency.setValueAtTime(f*2,t);o.frequency.exponentialRampToValueAtTime(f,t+0.5);
}

/* ---- the song ---- */
function newSong(){
  var s={root:[45,48,50,52,43,47][rnd(6)],prog:PROGS[rnd(PROGS.length)],gate:GATES[rnd(GATES.length)],rolling:Math.random()<0.5,
    arpHits:[9,11,13][rnd(3)],arpShape:rnd(3),tune:[],bars:[]},i,d=4+rnd(3);
  PLAN.forEach(function(p){for(i=0;i<p[1];i++)s.bars.push({sec:p[0],i:i,n:p[1]});});
  /* the tune: one bar of notes that wanders by small steps of the scale, then the same bar ending elsewhere */
  for(i=0;i<16;i++){if(euclid(5,16,(i+3)%16)){d=Math.max(2,Math.min(9,d+[-2,-1,-1,1,1,2][rnd(6)]));s.tune.push([i,d]);}}
  return s;
}
function chordAt(bar){ /* the chord of a bar: its scale step, its bass note, and its notes for the pad and the arp */
  var k=song.prog[bar%4],b=song.root-12+degree(k);while(b<28)b+=12;while(b>=40)b-=12;
  return {k:k,bass:b,notes:[song.root+12+degree(k),song.root+12+degree(k+2),song.root+12+degree(k+4)]};
}
function playStep(n,t){
  var total=song.bars.length*16;
  if(n>0&&n%total===0)song=newSong();
  var bn=Math.floor(n/16)%song.bars.length,s=n%16,B=song.bars[bn],sec=B.sec,ch=chordAt(bn),last=B.i===B.n-1,beat=s%4===0,p=(B.i+s/16)/B.n,i,v;
  var gap=sec==="build"&&last&&s>=8; /* the half bar of quiet before a drop */
  /* once a bar: the pad's chord, and where the filters are heading */
  if(s===0){
    var bright=sec==="drop"?1:sec==="break"?0.25+0.45*p:sec==="build"?0.3+0.7*p:sec==="intro"?0.15+0.3*p:0.5-0.4*p;
    M.padF.frequency.setTargetAtTime(500+5200*bright,t,0.4);M.tone.frequency.setTargetAtTime((sec==="break"?5000:9000)*(1+0.6*bright),t,0.6);
    if(sec!=="intro"||B.i>=4)pad(t,ch.notes,STEP*16,sec==="drop"?0.075:sec==="outro"?0.045*(1-p):0.055);
    if(sec==="drop"&&B.i===0)impact(t,hz(ch.bass));
    if(sec==="build"&&B.i===B.n-4)riser(t,STEP*56);
  }
  /* the gate chops the pad; in the breakdown it stays open */
  M.gate.gain.setTargetAtTime(gap?0:sec==="break"?0.8:song.gate[s]?1:0.08,t,0.008);
  if(gap)return;
  /* drums */
  var second=bn>=40; /* past the breakdown */
  var kickOn=sec==="intro"||sec==="drop"||sec==="outro"||(sec==="build"&&(!second||B.i>=4));
  if(kickOn&&beat)kick(t,sec==="drop"?0.85:0.72);
  if(sec==="drop"&&(s===4||s===12))clap(t,0.5);
  if(sec==="build"){ /* claps gather pace toward the drop: on the beat, then eighths, then sixteenths */
    v=0.2+0.3*p;
    if(last?true:B.i===B.n-2?s%2===0:(B.i>=4&&(s===4||s===12)))clap(t,v);
  }
  if(sec!=="break"&&(sec!=="intro"||B.i>=2)){
    if(s%4===2&&sec!=="intro")hat(t,sec==="drop"?0.22:0.14,true);
    else if(s%2===1||sec==="drop")hat(t,(s%4===3?0.12:0.08)*(sec==="drop"?1:0.7),false);
  }
  /* bass: on the off-beats, or rolling through the three sixteenths between kicks */
  if(sec!=="break"&&(sec!=="intro"||B.i>=4)&&!(sec==="build"&&second&&B.i<4)){
    v=sec==="drop"?1:sec==="outro"?0.8*(1-0.6*p):0.75;
    if(song.rolling){if(!beat)bass(t,hz(ch.bass+(s%4===2&&s>8?12:0)),STEP*0.9,v,sec==="drop"?0.8:0.3+0.4*p);}
    else if(s%4===2)bass(t,hz(ch.bass+(s===14?12:0)),STEP*1.7,v,sec==="drop"?0.8:0.3+0.4*p);
  }
  /* the arp: the chord's notes over two octaves, with gaps */
  if((sec==="drop"||sec==="build"||sec==="break")&&euclid(song.arpHits,16,s)){
    i=song.arpShape===0?s%6:song.arpShape===1?[0,2,1,3,2,4,3,5][s%8]:[0,3,1,4,2,5,4,2][s%8];
    arp(t,hz(ch.notes[i%3]+12*Math.floor(i/3)),(sec==="drop"?0.13:sec==="build"?0.04+0.09*p:0.08)*(s%4===0?1.2:1));
  }
  /* the tune: in the second drop, and quietly through the second half of the breakdown */
  if((sec==="drop"&&second)||(sec==="break"&&B.i>=4)){
    for(i=0;i<song.tune.length;i++)if(song.tune[i][0]===s){
      var dg=song.tune[i][1]+(bn%4===3&&i===song.tune.length-1?-song.tune[i][1]+7:bn%2===1&&i===song.tune.length-1?1:0);
      lead(t,hz(song.root+12+degree(dg)),STEP*2.2,sec==="drop"?0.15:0.09);
    }
  }
}
function tick(){
  if(!seq.on||!C||C.state!=="running")return;
  if(seq.next<C.currentTime)seq.next=C.currentTime+0.05;
  while(seq.next<C.currentTime+0.35){playStep(seq.step,seq.next);seq.next+=STEP;seq.step++;}
}
export function startBuilt(){
  if(!M){C=ac;graph(bus);}
  M.out.gain.setTargetAtTime(0.85,C.currentTime,0.4);
  if(seq.on)return;
  if(!song)song=newSong();
  seq.on=true;seq.next=C.currentTime+0.15;seq.timer=setInterval(tick,90);
}
export function stopBuilt(){
  if(M)M.out.gain.setTargetAtTime(0,C.currentTime,0.15);
  seq.on=false;clearInterval(seq.timer);
}
/* the top end opens up a little as you fly faster */
export function musicFollowsSpeed(spN){
  if(M&&seq.on&&C.state==="running")M.air.frequency.setTargetAtTime(6000+12000*spN,C.currentTime,0.6);
}
/* For testing: play `bars` bars of a song into another context (one that renders without playing) and return when all is scheduled. */
export function musicRender(ctx,bars){
  var keepC=C,keepM=M,keepSong=song,n;
  C=ctx;graph(ctx.destination);M.out.gain.value=0.85;song=newSong();
  for(n=0;n<bars*16;n++)playStep(n,0.1+n*STEP);
  C=keepC;M=keepM;song=keepSong;
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={BPM, STEP, SCALE, PROGS, GATES, PLAN, seq, rnd, hz, degree,
  euclid, gain, filter, graph, env, osc, hiss, kick, clap, hat,
  bass, arp, lead, pad, riser, impact, newSong, chordAt, playStep, tick,
  startBuilt, stopBuilt, musicFollowsSpeed, musicRender, get C(){return C},set C(v){C=v}, get M(){return M},set M(v){M=v}, get song(){return song},set song(v){song=v}};
