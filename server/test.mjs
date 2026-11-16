/* The meeting point's rules, checked against a copy running on this computer. In one terminal, in this folder:
     npx wrangler dev --port 8799
   and in another:  node server/test.mjs
   The last check opens connections until the limit for one address is reached, so wait a minute before running it again. */
const U=(process.argv[2]||"ws://127.0.0.1:8799")+"/room/", O={headers:{Origin:"https://gcrabtree.github.io"}};
const open=(path,o=O)=>new Promise(res=>{const w=new WebSocket(U+path,o),log=[];w.log=log;w.onmessage=e=>log.push(e.data);w.onopen=()=>res(w);w.onclose=e=>{w.closed=e.code;res(w)};w.onerror=()=>{};});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let ok=0,bad=0;const say=(n,c,x)=>{c?ok++:bad++;console.log((c?"ok   ":"FAIL ")+n+(c?"":" "+JSON.stringify(x)))};
const sdp="v=0\r\n"+"a=x\r\n".repeat(300);
let w=await open("abcdefgh?role=guest");await wait(300);say("a guest in a room with no host is turned away (4404)",w.closed===4404,w.closed);
w=await open("abcdefgh?role=host&key=kkkkkkkk",{headers:{Origin:"https://evil.example"}});say("another site is refused",w.closed!==undefined&&w.closed!==4404,w.closed);
w=await open("abcdefgh?role=host");say("a host with no key is refused",w.closed!==undefined);
w=await open("ABC?role=host&key=kkkkkkkk");say("a bad code is refused",w.closed!==undefined);
const h=await open("abcdefgh?role=host&key=kkkkkkkk");say("the host is in",h.readyState===1);
const h2=await open("abcdefgh?role=host&key=zzzzzzzz");await wait(300);say("a second host with another key is turned away (4409)",h2.closed===4409,h2.closed);
h.send("p");await wait(300);say("p is answered q",h.log.includes("q"),h.log);
const g=await open("abcdefgh?role=guest");g.send(JSON.stringify({t:"o",s:sdp}));await wait(400);
const got=JSON.parse(h.log.find(x=>x!=="q")||"null");say("the host gets the guest's description and a name",got&&got.t==="o"&&got.s===sdp&&/^[a-z0-9]{1,16}$/.test(got.g),got&&got.g);
h.send(JSON.stringify({t:"a",g:got.g,s:"v=0 answer"}));await wait(400);
say("the guest gets the answer and is let go",g.log[0]===JSON.stringify({t:"a",s:"v=0 answer"})&&g.closed===1000,[g.log,g.closed]);
const g2=await open("abcdefgh?role=guest");g2.send(JSON.stringify({t:"o",s:sdp}));g2.send(JSON.stringify({t:"o",s:sdp}));await wait(400);say("a guest's second message cuts it off",g2.closed===4400,g2.closed);
const g3=await open("abcdefgh?role=guest");g3.send("x".repeat(13000));await wait(400);say("a long message cuts a guest off",g3.closed===4400,g3.closed);
const g4=await open("abcdefgh?role=guest");g4.send(JSON.stringify({t:"o",s:sdp}));await wait(300);const o4=JSON.parse(h.log[h.log.length-1]);h.send(JSON.stringify({t:"n",g:o4.g}));await wait(300);say("the host can say there is no room left",g4.log[0]==='{"t":"n"}',g4.log);
const hb=await open("abcdefgh?role=host&key=kkkkkkkk");await wait(400);say("the same host coming back takes the room again",hb.readyState===1&&h.closed===4409,[hb.readyState,h.closed]);
const g5=await open("abcdefgh?role=guest");g5.send(JSON.stringify({t:"o",s:sdp}));await wait(300);say("and gets the next guest",hb.log.length===1,hb.log.length);
const waiting=[];for(let i=0;i<7;i++)waiting.push(await open("abcdefgh?role=guest"));await wait(400);say("no more than six wait at once (4429)",waiting.filter(x=>x.closed===4429).length===2&&waiting.filter(x=>x.readyState===1).length===5,waiting.map(x=>x.closed));
hb.close();await wait(500);say("when the host goes, those waiting are told",waiting.slice(0,5).every(x=>x.log[0]==="{\"t\":\"e\"}"),waiting.map(x=>x.closed));
let n429=0;for(let i=0;i<20;i++){const x=await open("zzzzzzzz?role=guest");if(x.closed!==4404)n429++;}await wait(200);say("one address is held to thirty connections a minute",n429>0,n429);
console.log(ok+" passed, "+bad+" failed");process.exit(bad?1:0);
