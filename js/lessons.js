/* The lessons: which tracks there are and which steps each has, in order. A step's words are in lang/<language>.json
   under learn.<track>.<step>.title, .text, .do and .name; its drawing is the entry of FIGS (figures.js) with the step's name;
   its voice is one sound file, made ahead of time by tools/voice.py from those same words. Nothing here needs the page. */
export const TRACKS=[
  {id:"mandel",steps:["once","minus","again","addc","cycles","bar","point","polar","sqpt","add","onehop","ring","shapes","ask","count","finer","patience"]}
];
/* the four pieces of text a step has, in the order they are shown and spoken */
export const PARTS=["title","text","do","name"];
export function partKey(track,step,part){return "learn."+track+"."+step+"."+part;}
/* what the voice says for a step: its four pieces of text, from a table of words. A piece with no text is left out. */
export function narration(table,track,step){
  var out=[],i,k;
  for(i=0;i<PARTS.length;i++){k=partKey(track,step,PARTS[i]);if(typeof table[k]==="string"&&table[k])out.push(table[k]);}
  return out;
}
/* the address of a step's voice. It is made only from the names in this file and the language's two letters. */
export function voiceName(lg,track,step){return "voice/"+lg+"/"+track+"-"+step+".mp3";}
/* a short mark of a text (FNV-1a, eight hex digits). voice/<language>/index.json keeps the mark of the words each sound file
   was made from, so a test can tell when the words have changed and the voice has not. */
export function sayHash(s){
  var h=0x811c9dc5,i;
  for(i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193);}
  return ("0000000"+(h>>>0).toString(16)).slice(-8);
}

/* for the test tools and the browser console: every name in this file */
export const __dbg={TRACKS, PARTS, partKey, narration, voiceName, sayHash};
