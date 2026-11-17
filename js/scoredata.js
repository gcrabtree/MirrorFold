/* A score as data: what a journey made for a piece of music holds, how it is checked, and which of its changes are due
   at a moment of the music. Nothing here touches the page, so the test tools can run it.
   A score is a name and a list of tracks (an album's songs, in order). A track is its name, its length in seconds, the
   moments where the music changes (marks), and its cues. A cue is a time in the track, a kind and a name: the kinds and
   names Journey uses ("world" and "julia", "palette" and "Sunset"), and one kind more, "journey", whose name is a
   Journey template that makes the changes by chance from that moment on ("" for none: nothing changes but by a cue).
   So a passage may be left loose and a moment pinned exactly, and the flight itself is always flown afresh.
   A score never holds the music, and a score from someone else is a stranger's text: it goes through cleanScore, and
   what comes out is numbers in a checked range and names that are only ever compared with the app's own lists. */
import { cleanName } from "./packs.js";
export const SC_KINDS=["world","palette","mirrors","motion","filter","overlay","surface","land","packing","pulse","shapes","inside","dance","journey"];
/* these kinds are changed behind a transition, which takes SC_LEAD seconds to reach its peak: they are asked for that much early, so that the change lands on its moment */
export const SC_BEHIND=["world","mirrors","surface","packing","pulse","shapes","inside","land"];
export const SC_LEAD=0.5;
export const SC_CUTS=["door"]; /* how a change of world may be made, other than behind a transition: "door", a doorway to it opens at that moment and the flight goes through it. A fourth thing in a world's cue. */
export const SC_GAP=1;       /* two cues of one kind are at least this many seconds apart; a nearer one is dropped. Nothing may strobe. */
export const SC_NEAR=0.4;    /* and two cues of any kinds that change the picture at once are at least this far apart */
export const SC_SOFT=["palette","dance","journey"]; /* kinds that do not change the picture at once: a palette is eased in, a dance style is taken up at the next move, a template only chooses later */
export const SC_TRACKS=40;   /* the most tracks in a score */
export const SC_CUES=1500;   /* the most cues in a track */
export const SC_MARKS=300;   /* the most marks in a track */
export const SC_LEN=3*3600;  /* the longest track, in seconds */
export const SC_NEAR_LEN=1.5; /* a file is taken for a track if their lengths are within this many seconds */

function num(x,lo,hi){return typeof x==="number"&&isFinite(x)?Math.max(lo,Math.min(hi,x)):null;}
function cs(x){return Math.round(x*100)/100;} /* times are kept to a hundredth of a second */
/* A track, checked, or null. Cues come out in order of time; one too near another is dropped. */
export function cleanTrack(src){
  var len,out,i,c,t,k,v,cues=[],marks=[],lastOf={},lastHard=-1e9;
  if(!src||typeof src!=="object"||Array.isArray(src))return null;
  len=num(src.len,1,SC_LEN);
  if(len===null)return null;
  out={name:cleanName(src.name),len:cs(len),marks:marks,cues:cues};
  if(Array.isArray(src.marks)){
    for(i=0;i<src.marks.length&&marks.length<SC_MARKS;i++){t=num(src.marks[i],0,len);if(t!==null)marks.push(cs(t));}
    marks.sort(function(a,b){return a-b;});
  }
  if(Array.isArray(src.cues)){
    var raw=[];
    for(i=0;i<src.cues.length&&raw.length<SC_CUES*4;i++){
      c=src.cues[i];
      if(!Array.isArray(c)||c.length<3)continue;
      t=num(c[0],0,len);k=c[1];v=cleanName(c[2]);
      if(t===null||typeof k!=="string"||SC_KINDS.indexOf(k)<0||typeof c[2]!=="string"||c[2].length>60)continue;
      if(!v&&k!=="journey")continue;
      raw.push([cs(t),k,v,i,k==="world"&&SC_CUTS.indexOf(c[3])>=0?c[3]:""]);
    }
    raw.sort(function(a,b){return a[0]-b[0]||a[3]-b[3];}); /* by time; two at one time keep the order they came in */
    for(i=0;i<raw.length&&cues.length<SC_CUES;i++){
      c=raw[i];t=c[0];k=c[1];
      if(k in lastOf&&t-lastOf[k]<SC_GAP-1e-6)continue; /* times are in hundredths, so a gap of exactly the least is let through whatever the arithmetic makes of it */
      if(SC_SOFT.indexOf(k)<0){if(t>0&&t-lastHard<SC_NEAR-1e-6)continue;lastHard=t;} /* cues at the very start set the scene together, before anything is seen */
      lastOf[k]=t;cues.push(c[4]?[t,k,c[2],c[4]]:[t,k,c[2]]);
    }
  }
  return out;
}
/* A score, checked, or null if it is not one. */
export function cleanScore(src){
  var out,i,tr;
  if(!src||typeof src!=="object"||Array.isArray(src)||!Array.isArray(src.tracks))return null;
  out={name:cleanName(src.name)||"Untitled score",tracks:[]};
  for(i=0;i<src.tracks.length&&out.tracks.length<SC_TRACKS;i++){tr=cleanTrack(src.tracks[i]);if(tr)out.tracks.push(tr);}
  return out.tracks.length?out:null;
}
/* A track's cues as they are to be asked for: each with the moment to ask (at), which for a change made behind a
   transition is a little before its time, in order of asking. */
export function scOrder(cues){
  var o=cues.map(function(c,i){return {at:Math.max(0,c[0]-(SC_BEHIND.indexOf(c[1])>=0&&!c[3]?SC_LEAD:0)),t:c[0],k:c[1],v:c[2],cut:c[3]||"",i:i};}); /* a doorway opens on the moment itself */
  o.sort(function(a,b){return a.at-b.at||a.i-b.i;});
  return o;
}
/* What a track asks to be showing at time t: for each kind that has a cue at or before t, the name of the last such cue. */
export function scChase(cues,t){
  var o={},i;
  for(i=0;i<cues.length&&cues[i][0]<=t;i++)o[cues[i][1]]=cues[i][2];
  return o;
}
/* Where to go on from in an ordered list after a jump to time t: the first cue whose own time is after t. One or two
   before it may be asked for again (their asking came early), which changes nothing. */
export function scSeek(ord,t){
  var i=0;while(i<ord.length&&ord[i].t<=t)i++;
  return i;
}
/* Which of a score's tracks a file is: the one of its length (within SC_NEAR_LEN), and among several of that length the
   one of its name, or else the one nearest place number at in the album. -1 for none. */
export function scMatch(score,len,name,at){
  var i,d,best=-1,bd=1e9,tr;
  if(!score||!(len>0))return -1;
  name=cleanName(name||"");
  for(i=0;i<score.tracks.length;i++){
    tr=score.tracks[i];d=Math.abs(tr.len-len);
    if(d>SC_NEAR_LEN)continue;
    d=d/SC_NEAR_LEN+(name&&tr.name===name?-4:0)+(i===at?-2:0)+Math.abs(i-(at>=0?at:i))*0.001;
    if(d<bd){bd=d;best=i;}
  }
  return best;
}
/* Where a second of the whole album falls: {i, t}, the track and the time in it. Past the end it is the end of the last track. */
export function scAt(score,sec){
  var i,n=score.tracks.length;
  for(i=0;i<n;i++){if(sec<score.tracks[i].len||i===n-1)return {i:i,t:Math.max(0,Math.min(score.tracks[i].len,sec))};sec-=score.tracks[i].len;}
  return {i:0,t:0};
}
/* The length of the whole album, in seconds. */
export function scLen(score){var s=0,i;for(i=0;i<score.tracks.length;i++)s+=score.tracks[i].len;return s;}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={SC_CUTS, SC_KINDS, SC_BEHIND, SC_LEAD, SC_GAP, SC_NEAR, SC_SOFT, SC_TRACKS, SC_CUES, SC_MARKS, SC_LEN, SC_NEAR_LEN, cleanTrack, cleanScore, scOrder, scChase, scSeek, scMatch, scAt, scLen};
