/* Listening to a whole piece of music at once, and drafting a score from what was heard. Nothing here touches the page,
   so the test tools can run it.
   The app hears music a frame at a time through the browser's analyser. To hear a whole file ahead of playing it, this
   file does the analyser's arithmetic itself (the same window, the same smoothing, the same scale of 0 to 255 over 70
   decibels), sixty times for each second of the music, and hands each frame to the very listeners the app uses while
   it plays: the change detector (js/listen.js), the song's fullness and its drops (js/song.js), and the beat's four
   clocks (js/dance.js). So what a draft is made from is what the picture will do when the music is played. */
import { makeBeatBank } from "./dance.js";
import { makeChangeDetector, onsetStep } from "./listen.js";
import { makeSongTracker } from "./song.js";
export const AN_N=1024;      /* samples in a look at the sound, as the app's analyser has */
export const AN_FPS=60;      /* looks a second */
export const AN_HZ=5;        /* numbers kept for each second of the music's curves */
export const AN_SMOOTH=0.6;  /* the analyser's smoothing from one look to the next (js/audio.js sets the same) */
export const DRAFT_GAP=14;   /* a draft's sections are at least this many seconds long */

let tabs=null; /* the window and the tables of sines, made at first need */
function tables(){
  var i,N=AN_N;
  if(tabs)return tabs;
  tabs={win:new Float32Array(N),cos:new Float32Array(N/2),sin:new Float32Array(N/2),rev:new Uint16Array(N)};
  for(i=0;i<N;i++)tabs.win[i]=0.42-0.5*Math.cos(2*Math.PI*i/N)+0.08*Math.cos(4*Math.PI*i/N); /* Blackman's window, which the analyser uses */
  for(i=0;i<N/2;i++){tabs.cos[i]=Math.cos(2*Math.PI*i/N);tabs.sin[i]=Math.sin(2*Math.PI*i/N);}
  for(i=0;i<N;i++){var r=0,b,x=i;for(b=1;b<N;b<<=1){r=(r<<1)|(x&1);x>>=1;}tabs.rev[i]=r;}
  return tabs;
}
/* The spectrum of AN_N numbers, in place: re and im in, re and im out. */
export function anFft(re,im){
  var T=tables(),N=AN_N,i,j,k,len,half,step,c,s,xr,xi,t;
  for(i=0;i<N;i++){j=T.rev[i];if(j>i){t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t;}}
  for(len=2;len<=N;len<<=1){
    half=len>>1;step=N/len;
    for(i=0;i<N;i+=len)for(k=0;k<half;k++){
      c=T.cos[k*step];s=-T.sin[k*step];j=i+k+half;
      xr=re[j]*c-im[j]*s;xi=re[j]*s+im[j]*c;
      re[j]=re[i+k]-xr;im[j]=im[i+k]-xi;re[i+k]+=xr;im[i+k]+=xi;
    }
  }
}
function avg(b,a,z){var t=0,i;for(i=a;i<=z;i++)t+=b[i];return t/((z-a+1)*255);}
/* Begin listening to a piece: mono is its samples (the channels' average), rate its samples a second. */
export function anStart(mono,rate){
  var n=Math.max(1,Math.floor(mono.length/rate*AN_FPS));
  return {mono:mono,rate:rate,len:mono.length/rate,n:n,i:0,re:new Float32Array(AN_N),im:new Float32Array(AN_N),sm:new Float32Array(AN_N/2),
    bins:new Uint8Array(AN_N/2),was:new Uint8Array(AN_N/2),on:new Float32Array(4),first:true,
    det:makeChangeDetector(),song:makeSongTracker(),bank:makeBeatBank(),
    e:new Float32Array(n),lv:new Float32Array(n),fired:[],drops:[],beats:[],beatN:0};
}
/* Listen to up to count more looks of it. True once the whole piece has been heard. */
export function anStep(S,count){
  var T=tables(),N=AN_N,dt=1/AN_FPS,end=Math.min(S.n,S.i+count),f,i,at,x,m,db,rb,rm,rt,e,o,b,u;
  for(f=S.i;f<end;f++){
    at=Math.round((f+1)*S.rate/AN_FPS)-N; /* the look ends at this frame's moment, as the analyser's last 1024 samples do */
    for(i=0;i<N;i++){x=at+i;S.re[i]=(x>=0&&x<S.mono.length?S.mono[x]:0)*T.win[i];S.im[i]=0;}
    anFft(S.re,S.im);
    for(i=0;i<N/2;i++){
      m=Math.hypot(S.re[i],S.im[i])/N;
      S.sm[i]=AN_SMOOTH*S.sm[i]+(1-AN_SMOOTH)*m;
      db=S.sm[i]>0?20*Math.log10(S.sm[i]):-1000;
      S.bins[i]=Math.max(0,Math.min(255,Math.floor(255/70*(db+100)))); /* -100 to -30 decibels, as the analyser counts */
    }
    rb=avg(S.bins,1,4);rm=avg(S.bins,6,45);rt=avg(S.bins,60,250); /* the three bands of readMusic (js/listen.js) */
    e=0.5*rb+0.35*rm+0.15*rt;
    if(S.first){for(i=0;i<N/2;i++)S.was[i]=S.bins[i];S.first=false;}else onsetStep(S.bins,S.was,S.on,dt);
    if(S.det(dt,e,(rt+0.5*rm)/(rb+rm+rt+0.001)))S.fired.push(f*dt);
    o=S.song(dt,e);if(o.drop)S.drops.push(f*dt);
    b=S.bank(dt,S.on);u=Math.floor(b.u);
    if(u!==S.beatN){S.beatN=u;if(b.sure>0.7)S.beats.push(f*dt);}
    S.e[f]=e;S.lv[f]=o.level;
  }
  S.i=end;
  return end>=S.n;
}
/* Where between two times the sound changed most: the moment with the greatest difference between the 0.4 seconds after it and the 0.4 before. */
function sharpest(e,t0,t1){
  var w=Math.round(0.4*AN_FPS),a=Math.max(w,Math.round(t0*AN_FPS)),z=Math.min(e.length-w-1,Math.round(t1*AN_FPS)),i,k,best=-1,bi=-1,d,sa=0,sb=0;
  if(z<a)return Math.max(0,t1);
  for(k=0;k<w;k++){sb+=e[a-1-k];sa+=e[a+k];}
  for(i=a;i<=z;i++){
    d=Math.abs(sa-sb);if(d>best){best=d;bi=i;}
    sb+=e[i]-e[i-w];sa+=e[i+w]-e[i];
  }
  return bi/AN_FPS;
}
/* What was heard, once the whole piece has been: its length; the energy and the fullness as curves of AN_HZ numbers a
   second (0 to 255); the moments the music changed (marks, each {t, drop}) set back to where the change itself was,
   since a listener only knows a change a second or so after it; and the beats that were sure (the count of the
   beat's clocks: their spacing is the tempo, but they may lie a part of a beat off the drum, so nothing is moved
   to them). */
export function anDone(S){
  var n=Math.ceil(S.len*AN_HZ),en=new Uint8Array(n),lv=new Uint8Array(n),step=AN_FPS/AN_HZ,i,k,a,b,c,marks=[],all=[],t;
  for(i=0;i<n;i++){
    a=0;b=0;c=0;
    for(k=Math.floor(i*step);k<(i+1)*step&&k<S.n;k++){a=Math.max(a,S.e[k]);b+=S.lv[k];c++;}
    en[i]=Math.min(255,Math.round(a*255));lv[i]=c?Math.round(b/c*255):0;
  }
  for(i=0;i<S.drops.length;i++)all.push({t:S.drops[i],drop:true});
  for(i=0;i<S.fired.length;i++)all.push({t:S.fired[i],drop:false});
  all.sort(function(p,q){return p.t-q.t;});
  for(i=0;i<all.length;i++){
    t=sharpest(S.e,all[i].t-2.5,all[i].t);
    if(marks.length&&t-marks[marks.length-1].t<1.5){if(all[i].drop)marks[marks.length-1].drop=true;continue;} /* a drop and a change heard together are one moment */
    marks.push({t:Math.round(t*100)/100,drop:all[i].drop});
  }
  return {len:S.len,hz:AN_HZ,en:en,lv:lv,marks:marks,beats:S.beats.slice()};
}
/* The whole of it in one go, for the tests and for short pieces. */
export function analyse(mono,rate){var S=anStart(mono,rate);anStep(S,S.n);return anDone(S);}

/* How full a stretch of the music is, 0 to 1: the mean of its fullness curve. */
export function anLevel(an,t0,t1){
  var a=Math.max(0,Math.floor(t0*an.hz)),z=Math.min(an.lv.length,Math.ceil(t1*an.hz)),s=0,i;
  if(z<=a)return 0;
  for(i=a;i<z;i++)s+=an.lv[i];
  return s/((z-a)*255);
}
export function draftTier(level){return level<0.35?"quiet":level<0.7?"mid":"full";}
/* A first draft of a track's part of a score, from what was heard: {marks, cues}, to go through cleanTrack.
   The music is cut into sections at its marks (none shorter than DRAFT_GAP; a drop is kept in preference to a change
   beside it). Each section is quiet, middling or full, and is given that tier's template (opts.quiet, opts.mid,
   opts.full: names) to make its changes by chance; and each begins in a new world, on the moment, taken by chance
   from pool(tier), a list of world ids, and never one of the last two. rnd gives the chance numbers. was is the
   worlds just used, so that an album does not begin a track where the last one ended. */
export function scDraft(an,opts,pool,rnd,was){
  var cuts=[{t:0,drop:false}],i,m,last,cues=[],marks=[],used=(was||[]).slice(-2),tier,tpl="\u0000",t1,p,w,k;
  for(i=0;i<an.marks.length;i++){
    m=an.marks[i];last=cuts[cuts.length-1];
    if(m.t<4||m.t>an.len-DRAFT_GAP/2)continue; /* nothing is changed in the first moments or as the track ends */
    if(m.t-last.t>=DRAFT_GAP)cuts.push({t:m.t,drop:m.drop});
    else if(m.drop&&!last.drop&&cuts.length>1&&(cuts.length<3||m.t-cuts[cuts.length-2].t>=DRAFT_GAP))cuts[cuts.length-1]={t:m.t,drop:true};
  }
  for(i=0;i<cuts.length;i++){
    t1=i+1<cuts.length?cuts[i+1].t:an.len;
    tier=draftTier(anLevel(an,cuts[i].t,t1));
    if(i)marks.push(cuts[i].t);
    p=(pool(tier)||[]).filter(function(x){return used.indexOf(x)<0;});
    if(!p.length)p=(pool(tier)||[]).filter(function(x){return x!==used[used.length-1];});
    if(p.length){
      k=Math.min(p.length-1,Math.floor(rnd()*p.length));w=p[k];
      cues.push([cuts[i].t,"world",w]);used.push(w);if(used.length>2)used.shift();
    }
    if(opts[tier]!==tpl){tpl=opts[tier];cues.push([cuts[i].t,"journey",tpl||""]);}
  }
  return {marks:marks,cues:cues,used:used};
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={AN_N, AN_FPS, AN_HZ, AN_SMOOTH, DRAFT_GAP, anFft, anStart, anStep, anDone, analyse, anLevel, draftTier, scDraft, anSharpest:sharpest};
