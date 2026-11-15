/* The song shapes the world. This file listens to how full the music is over the last minute or so, and says where a
   world's morph should be for it: at the world's open end while the music is quiet, at its dense end while it is full.
   It also says when a drop lands (the music suddenly much fuller than it was a few seconds ago).
   Nothing here touches the page, so the test tools can run it. */
/* The sound's energy here is the analyser's own measure, which counts in decibels: 0.1 of it is about 7 decibels. */
export const SONG_HI=0.6;    /* the fullest the sound is taken to get, until a louder passage says otherwise */
export const SONG_SPAN=0.06; /* the quiet mark is kept at least this far under the full one (about 4 decibels), so a song that is equally loud all through counts as full */
export const SONG_QUIET=0.03; /* energy under this is silence, not music */
export const SONG_DROP=0.08; /* a drop: the last half second this far above the last several (about 6 decibels) */
export const heard={
  level:0,     /* how full the music is now, 0 (its quietest passages, or silence) to 1 (its fullest) */
  drop:false,  /* true for the one frame in which a drop lands */
  live:false   /* there is sound to follow */
};
const sides={}; /* for each world that has been asked about, by id: 1 if its dense end is the morph's high end, -1 if the low end */
let track;

/* Follows one stream of sound. Each frame it is given the seconds passed and the sound's energy, and gives back
   {level, drop}. Level is the energy of the last few seconds, placed between a quiet mark and a full mark. The full
   mark jumps up to a louder passage and sinks toward the present sound over about a minute; the quiet mark jumps down
   to a quieter passage and rises over about twenty seconds. So each song finds its own range, and a song whose verse
   is only a little under its chorus still goes from one end to the other. Silence moves neither mark, and music that
   starts after silence is taken up from its first sound. A drop is the last half second standing well above the last
   several, while the music was already playing. */
export function makeSongTracker(){
  var f=0,s=0,hi=SONG_HI,lo=SONG_HI-SONG_SPAN,age=0,hold=0,quiet=true,out={level:0,drop:false};
  return function(dt,e){
    var was;
    out.drop=false;
    if(hold>0)hold-=dt;
    if(e<SONG_QUIET&&s<SONG_QUIET){quiet=true;f=s=e;age=0;out.level*=Math.exp(-dt/3);return out;}
    if(quiet){f=s=e;quiet=false;lo=Math.min(lo,Math.max(0,e-SONG_SPAN));}
    age+=dt;
    was=s;
    f+=(e-f)*Math.min(1,dt/0.5);s+=(e-s)*Math.min(1,dt/3);
    if(s>hi)hi=s;else hi+=(s-hi)*Math.min(1,dt/60);
    if(s<lo)lo=s;else lo+=(s-lo)*Math.min(1,dt/20);
    lo=Math.max(0,Math.min(lo,hi-SONG_SPAN));
    out.level=Math.max(0,Math.min(1,(s-lo)/(hi-lo)));
    if(hold<=0&&age>5&&f-was>SONG_DROP){out.drop=true;hold=8;}
    return out;
  };
}
/* One frame of listening: e is the sound's energy, live whether there is any sound to read. With none, the level falls away. */
export function songStep(dt,e,live){
  var o;
  heard.live=live;heard.drop=false;
  if(!live){heard.level*=Math.exp(-dt/3);return;}
  o=track(dt,e);heard.level=o.level;heard.drop=o.drop;
}
/* Which end of a world's morph is the dense one: 1 for the high end, -1 for the low. The open space is measured at the
   same forty places in one repeat of the world, at three morphs each side of the middle, and the side with less of it
   is the dense one. A world with no distance to ask here (a pack world, a cloud, a zoom) gets 1. */
export function denseSide(w){
  var ms=[0.3,0.65,1],sum=[0,0],h,i,j,m,per,sc,d;
  if(w.pack||w.volume||w.flat||!w.de)return 1;
  for(h=0;h<2;h++)for(j=0;j<3;j++){
    m=(h?1:-1)*ms[j];per=w.period(m);sc=Math.min(per[0],per[1],per[2]);
    for(i=1;i<=40;i++){ /* places spread evenly through the repeat: each coordinate counts up in its own base */
      d=w.de((spreadAt(i,2)-0.5)*per[0],(spreadAt(i,3)-0.5)*per[1],(spreadAt(i,5)-0.5)*per[2],m);
      sum[h]+=Math.max(0,Math.min(d,0.25*sc))/sc;
    }
  }
  return sum[1]<=sum[0]?1:-1;
}
function spreadAt(i,b){var f=1,r=0;while(i>0){f/=b;r+=f*(i%b);i=Math.floor(i/b);}return r;}
/* Where the morph should be for a level of the music, -1 to 1: the world's open end at 0, its dense end at 1, and a
   slow sway of its own on top (time is the app's clock) so that a steady passage does not leave the world standing. */
export function songMorph(level,side,time){
  return Math.max(-0.98,Math.min(0.98,side*0.85*(2*level-1)+0.12*Math.sin(time*0.07)));
}
/* The morph the song asks for in this world now, or null if there is no sound to follow. */
export function songAim(w,time){
  if(!heard.live)return null;
  var id=w.id||"";
  if(!(id in sides))sides[id]=denseSide(w);
  return songMorph(heard.level,sides[id],time);
}
/* Move the morph's clock t toward the nearest time at which the morph's main wave (the sine of 0.09 t) equals aim.
   It goes no faster than rate (clock seconds a second), and slows as it gets there, so the world never jumps. */
export function morphSteer(t,aim,dt,rate){
  var a=Math.asin(Math.max(-1,Math.min(1,aim))),turn=2*Math.PI/0.09;
  var t1=a/0.09,t2=(Math.PI-a)/0.09,g1,g2,g,st;
  g1=t1-t;g1-=turn*Math.round(g1/turn);g2=t2-t;g2-=turn*Math.round(g2/turn);
  g=Math.abs(g1)<=Math.abs(g2)?g1:g2;
  st=Math.min(Math.abs(g),Math.min(rate,0.15+1.2*Math.abs(g))*dt);
  return t+(g<0?-st:st);
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
track=makeSongTracker();
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={SONG_HI, SONG_SPAN, SONG_QUIET, SONG_DROP, heard, sides, makeSongTracker, songStep, denseSide, spreadAt, songMorph, songAim, morphSteer,
  get track(){return track},set track(v){track=v}};
