/* The lessons' words. They are kept in one flat file for each language, lang/en.json: a name for each piece of text and
   the text itself, nothing nested. Text from the file is only ever put on the page as plain text. */
export const LANGS=["en"];   /* the languages that have a file in lang/ and voices in voice/ */
export let lang="en";        /* the one in use */
let words={};                /* its text, by name */
let wordsFor="";             /* which language words holds ("" for none yet) */

/* keep only the entries that are text */
export function cleanLang(o){
  var out={},k;
  if(!o||typeof o!=="object"||Array.isArray(o))return out;
  for(k in o)if(Object.prototype.hasOwnProperty.call(o,k)&&typeof o[k]==="string")out[k]=o[k];
  return out;
}
/* the text with a name, from a table of words; {0}, {1} and so on are replaced by what follows. A name with no text gives the name. */
export function fill(table,key,args){
  var s=Object.prototype.hasOwnProperty.call(table,key)?table[key]:key;
  return s.replace(/\{(\d)\}/g,function(m,i){return args&&args[+i]!==undefined?String(args[+i]):m;});
}
/* the text with a name, in the language in use */
export function t(key){return fill(words,key,Array.prototype.slice.call(arguments,1));}
/* which of the languages we have suits a browser's list of wanted ones: the first whose first part matches, else English */
export function pickLang(wanted){
  var i,c;
  for(i=0;i<(wanted||[]).length;i++){c=String(wanted[i]).toLowerCase().split("-")[0];if(LANGS.indexOf(c)>=0)return c;}
  return "en";
}
/* Fetch the words, then call done(true), or done(false) if they could not be had. Asked for once; later calls answer at once.
   (XMLHttpRequest, not fetch: the test tools open the page from a file, where fetch refuses.) */
export function loadLang(done){
  var x;
  if(wordsFor===lang){done(true);return;}
  x=new XMLHttpRequest();
  x.onload=function(){
    var got=null;
    try{got=cleanLang(JSON.parse(x.responseText))}catch(_){}
    if(got&&Object.keys(got).length){words=got;wordsFor=lang;done(true);}else done(false);
  };
  x.onerror=function(){done(false)};
  x.open("GET","lang/"+lang+".json");x.send();
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
lang=pickLang(navigator.languages||[navigator.language]);
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={LANGS, cleanLang, fill, t, pickLang, loadLang, get lang(){return lang},set lang(v){lang=v}, get words(){return words},set words(v){words=v},
  get wordsFor(){return wordsFor},set wordsFor(v){wordsFor=v}};
