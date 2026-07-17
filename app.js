
const $ = id => document.getElementById(id);
const SUITS=["♠","♥","♦","♣"], RANKS=["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const SYSTEMS={
  hilo:{name:"Hi-Lo",balanced:true,values:{"2":1,"3":1,"4":1,"5":1,"6":1,"7":0,"8":0,"9":0,"10":-1,J:-1,Q:-1,K:-1,A:-1}},
  ko:{name:"KO",balanced:false,values:{"2":1,"3":1,"4":1,"5":1,"6":1,"7":1,"8":0,"9":0,"10":-1,J:-1,Q:-1,K:-1,A:-1}},
  omega2:{name:"Omega II",balanced:true,values:{"2":1,"3":1,"4":2,"5":2,"6":2,"7":1,"8":0,"9":-1,"10":-2,J:-2,Q:-2,K:-2,A:0}},
  halves:{name:"Halves",balanced:true,values:{"2":.5,"3":1,"4":1,"5":1.5,"6":1,"7":.5,"8":0,"9":-.5,"10":-1,J:-1,Q:-1,K:-1,A:-1}},
  zen:{name:"Zen Count",balanced:true,values:{"2":1,"3":1,"4":2,"5":2,"6":2,"7":1,"8":0,"9":0,"10":-2,J:-2,Q:-2,K:-2,A:-1}},
  red7:{name:"Red Seven",balanced:false,values:{"2":1,"3":1,"4":1,"5":1,"6":1,"7":.5,"8":0,"9":0,"10":-1,J:-1,Q:-1,K:-1,A:-1}}
};
const RANKS_CAREER=[
  {name:"Nováček",min:0,desc:"Nauč se hodnoty systému a první čistý balíček."},
  {name:"Pozorovatel",min:500,desc:"Udrž running count i při rychlejším rozdávání."},
  {name:"Counter",min:1500,desc:"Přidej true count a basic strategy."},
  {name:"Analytik",min:3500,desc:"Zvládni celý stůl a různé casino rules."},
  {name:"Advantage Player",min:7000,desc:"Pracuj s odchylkami a vysokou rychlostí."},
  {name:"Elite Professional",min:12000,desc:"100% přesnost, speed mode a perfektní rozhodování."}
];
const MISSIONS=[
  {id:"cards100",title:"Zahřívací balíček",target:100,key:"cards",xp:150},
  {id:"correct50",title:"Přesný count",target:50,key:"correctCounts",xp:200},
  {id:"streak25",title:"Série bez chyby",target:25,key:"bestStreak",xp:250},
  {id:"games10",title:"Deset stolů",target:10,key:"games",xp:200},
  {id:"decisions50",title:"Basic strategy",target:50,key:"correctDecisions",xp:250},
  {id:"fulltable20",title:"Celý stůl",target:20,key:"fullTableRounds",xp:300}
];
const ACHIEVEMENTS=[
  {title:"První karta",desc:"Dokonči první count",test:s=>s.cards>=1},
  {title:"Sto karet",desc:"Spočítej 100 karet",test:s=>s.cards>=100},
  {title:"Tisícovka",desc:"Spočítej 1 000 karet",test:s=>s.cards>=1000},
  {title:"Ostrostřelec",desc:"100 správných countů",test:s=>s.correctCounts>=100},
  {title:"Bez zaváhání",desc:"Série 50 správných",test:s=>s.bestStreak>=50},
  {title:"Dealer Hunter",desc:"Vyhraj 25 simulací",test:s=>s.gameWins>=25},
  {title:"Table Vision",desc:"50 kol celého stolu",test:s=>s.fullTableRounds>=50},
  {title:"Strateg",desc:"100 správných rozhodnutí",test:s=>s.correctDecisions>=100}
];

const state={
  trainer:{shoe:[],running:0,current:[],visible:false,guess:0,history:[],attempts:0,correct:0,streak:0,start:Date.now(),timer:null,lastDealTime:null},
  game:{shoe:[],running:0,player:[],dealer:[],active:false,bankroll:10000,bet:100,doubled:false,decisionExpected:null,decisionMade:null,cardsDealt:0},
  stats:loadStats(),
  sound:true,
  deferredInstall:null,
  live:{decks:6,seen:[],hands:{dealer:[],p1:[],p2:[],p3:[],p4:[],p5:[],p6:[],p7:[]},activeTarget:"dealer",selectedRank:"A",selectedSuit:"♠",history:[]},
  camera:{stream:null,frozen:false,rank:"A",suit:"♠"}
};

function defaultStats(){return {xp:0,cards:0,correctCounts:0,bestStreak:0,games:0,gameWins:0,correctDecisions:0,totalDecisions:0,fullTableRounds:0,sessions:[],daily:{},missions:{},lastDate:null,dayStreak:1}}
function loadStats(){try{return {...defaultStats(),...JSON.parse(localStorage.getItem("blackjackAcademyPro")||"{}")}}catch{return defaultStats()}}
function saveStats(){localStorage.setItem("blackjackAcademyPro",JSON.stringify(state.stats));renderAllStats()}
function todayKey(){return new Date().toISOString().slice(0,10)}
function ensureToday(){const t=todayKey();if(!state.stats.daily[t])state.stats.daily[t]={cards:0,correct:0,games:0,decisions:0};if(state.stats.lastDate!==t){if(state.stats.lastDate){const diff=Math.round((new Date(t)-new Date(state.stats.lastDate))/86400000);state.stats.dayStreak=diff===1?(state.stats.dayStreak||1)+1:1}state.stats.lastDate=t}}
function addXP(amount,reason){state.stats.xp+=amount;coach(`+${amount} XP – ${reason}`,"good");saveStats()}
function currentLevel(){let idx=0;RANKS_CAREER.forEach((r,i)=>{if(state.stats.xp>=r.min)idx=i});return idx}
function nextLevelXP(){const i=currentLevel();return RANKS_CAREER[Math.min(i+1,RANKS_CAREER.length-1)].min}
function buildShoe(n){const cards=[];for(let d=0;d<n;d++)for(const s of SUITS)for(const r of RANKS)cards.push({rank:r,suit:s});for(let i=cards.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]]}return cards}
function countValue(rank){return SYSTEMS[$("countSystem").value].values[rank]}
function signed(n){const v=Math.round(Number(n)*100)/100;return v>0?`+${v}`:`${v}`}
function sound(type="click"){if(!state.sound)return;try{const ctx=new (window.AudioContext||window.webkitAudioContext)();const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=type==="good"?620:type==="bad"?180:320;g.gain.setValueAtTime(.025,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.08);o.start();o.stop(ctx.currentTime+.08)}catch{}}

function pipPositions(rank){
 const m={"2":[[2,1],[2,5]],"3":[[2,1],[2,3],[2,5]],"4":[[1,1],[3,1],[1,5],[3,5]],"5":[[1,1],[3,1],[2,3],[1,5],[3,5]],"6":[[1,1],[3,1],[1,3],[3,3],[1,5],[3,5]],"7":[[1,1],[3,1],[2,2],[1,3],[3,3],[1,5],[3,5]],"8":[[1,1],[3,1],[2,2],[1,3],[3,3],[2,4],[1,5],[3,5]],"9":[[1,1],[3,1],[1,2],[3,2],[2,3],[1,4],[3,4],[1,5],[3,5]],"10":[[1,1],[3,1],[2,2],[1,2],[3,2],[1,3],[3,3],[1,4],[3,4],[2,5]]};return m[rank]||[]
}
function cardFace(card,mini=false){
 const red=card.suit==="♥"||card.suit==="♦";let center="";
 if(card.rank==="A")center=`<div class="ace-pip">${card.suit}</div>`;
 else if(["J","Q","K"].includes(card.rank))center=`<div class="face-card">${card.rank}${card.suit}</div>`;
 else center=`<div class="pip-grid">${pipPositions(card.rank).map(([c,r])=>`<span class="pip ${r>=4?"flip":""}" style="grid-column:${c};grid-row:${r}">${card.suit}</span>`).join("")}</div>`;
 return `<div class="card3d ${mini?"mini-card":""} ${red?"red":""}">
 <div class="corner top"><span class="corner-rank">${card.rank}</span><span class="corner-suit">${card.suit}</span></div>
 <div class="pips">${center}</div>
 <div class="corner bottom"><span class="corner-rank">${card.rank}</span><span class="corner-suit">${card.suit}</span></div></div>`
}
function cardHTML(card,{mini=false,hidden=false,anim="deal",delay=0}={}){
 const cls=anim==="flip"?"flip-anim":"deal-anim";
 const body=hidden?`<div class="card3d mini-card hidden-card"></div>`:cardFace(card,mini);
 return `<div class="card3d-wrap ${cls}" style="animation-delay:${delay}ms">${body}</div>`
}

function resetTrainer(){
 const t=state.trainer;t.shoe=buildShoe(+$("trainerDecks").value);t.running=0;t.current=[];t.visible=false;t.guess=0;t.history=[];t.attempts=0;t.correct=0;t.streak=0;t.start=Date.now();t.lastDealTime=null;
 $("trainerStage").innerHTML='<div class="card3d card-back-placeholder"><div class="card-back-design">BJ</div></div>';
 setGuess(0);setTrainerFeedback("Rozdej první kartu a drž running count v hlavě.","neutral");
 clearInterval(t.timer);t.timer=setInterval(updateTrainerTimer,1000);updateTrainerUI();renderSystemMap()
}
function updateTrainerTimer(){const s=Math.floor((Date.now()-state.trainer.start)/1000);$("trainerTimer").textContent=`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`}
function setGuess(v){state.trainer.guess=Math.round(v*2)/2;$("guessValue").textContent=signed(state.trainer.guess)}
function drawTrainer(){
 const t=state.trainer;if(t.visible)return setTrainerFeedback("Nejdřív zkontroluj nebo odhal správný count.","bad");if(!t.shoe.length){finishTrainerSession();return setTrainerFeedback("Shoe je dokončený. Spusť nový trénink.","good")}
 const mode=$("trainerMode").value;const n=mode==="pairs"?2:mode==="fulltable"?6:1;t.current=[];for(let i=0;i<n&&t.shoe.length;i++)t.current.push(t.shoe.pop());t.visible=true;t.lastDealTime=Date.now();
 if(mode==="fulltable"){
   $("trainerStage").innerHTML=`<div class="table-layout">${t.current.map((c,i)=>`<div class="seat"><small>${i===5?"Dealer":`Hráč ${i+1}`}</small>${cardHTML(c,{mini:true,anim:"flip",delay:i*85})}</div>`).join("")}</div>`;
   state.stats.fullTableRounds++;
 }else $("trainerStage").innerHTML=t.current.map((c,i)=>cardHTML(c,{anim:"flip",delay:i*100})).join("");
 if(mode==="speed"||mode==="hardcore"){const ms=mode==="hardcore"?450:+$("dealSpeed").value;setTimeout(()=>{if(t.visible)$("trainerStage").innerHTML='<div class="card3d card-back-placeholder"><div class="card-back-design">COUNT?</div></div>'},ms)}
 sound()
}
function trainerTarget(){return state.trainer.running+state.trainer.current.reduce((a,c)=>a+countValue(c.rank),0)}
function checkTrainer(reveal=false){
 const t=state.trainer;if(!t.visible)return setTrainerFeedback("Nejdřív rozdej kartu.","bad");const target=trainerTarget(),correct=!reveal&&t.guess===target;t.attempts++;state.stats.cards+=t.current.length;ensureToday();state.stats.daily[todayKey()].cards+=t.current.length;
 if(correct){t.correct++;t.streak++;state.stats.correctCounts++;state.stats.daily[todayKey()].correct++;state.stats.bestStreak=Math.max(state.stats.bestStreak,t.streak);setTrainerFeedback(`Správně. Running count je ${signed(target)}.`,"good");coach(countCoachMessage(t.current,target),"good");addXP(5,"správný count");sound("good")}
 else{t.streak=0;setTrainerFeedback(`Správný running count je ${signed(target)}.` ,reveal?"neutral":"bad");coach(errorCoachMessage(t.current,t.guess,target),reveal?"neutral":"bad");sound("bad")}
 t.running=target;t.history.push(...t.current);t.current=[];t.visible=false;setGuess(0);saveStats();updateTrainerUI()
}
function countCoachMessage(cards,target){const vals=cards.map(c=>countValue(c.rank));if(vals.reduce((a,b)=>a+b,0)===0)return "Výborně. Karty se navzájem zrušily – tohle je ideální počítat po dvojicích.";return `Dobrá práce. Nový count ${signed(target)} jsi držel správně i při ${cards.length>1?"více kartách":"jedné kartě"}.`}
function errorCoachMessage(cards,guess,target){const delta=Math.abs(target-guess);if(delta<=1)return "Byl jsi velmi blízko. Zpomal o zlomek sekundy a páruj plusové a minusové karty.";if(cards.length>2)return "U celého stolu nejprve ruš + a − karty po dvojicích. Až potom přičti zbytek.";return "Chyba vznikla v hodnotě karty. Zopakuj mapu systému a drž pouze jedno průběžné číslo."}
function coach(text,type="neutral"){const div=document.createElement("div");div.className="coach-entry";div.innerHTML=`<strong>Coach:</strong><span>${text}</span>`;$("coachFeed").prepend(div);while($("coachFeed").children.length>6)$("coachFeed").lastChild.remove()}
function setTrainerFeedback(text,type){$("trainerFeedback").textContent=text;$("trainerFeedback").className=`coach-message ${type}`}
function updateTrainerUI(){const t=state.trainer,decksLeft=Math.max(t.shoe.length/52,.01),tc=SYSTEMS[$("countSystem").value].balanced?t.running/decksLeft:t.running;$("runningCount").textContent=signed(t.running);$("trueCount").textContent=signed(tc.toFixed(2));$("trainerAccuracy").textContent=t.attempts?`${Math.round(t.correct/t.attempts*100)}%`:"100%";const mins=Math.max((Date.now()-t.start)/60000,.01);$("cardsPerMinute").textContent=`${Math.round(t.history.length/mins)}/min`;$("shoeInfo").textContent=`${(t.shoe.length/52).toFixed(2)} balíčku zbývá`;const sig=$("shoeSignal");sig.className=`signal ${tc>=2?"good":tc<=0?"bad":"neutral"}`;sig.textContent=tc>=2?"Více vysokých karet":tc<=0?"Nevýhodný / neutrální shoe":"Mírně pozitivní shoe"}
function finishTrainerSession(){const t=state.trainer;if(!t.attempts)return;const duration=Math.floor((Date.now()-t.start)/1000);state.stats.sessions.unshift({date:new Date().toLocaleString("cs-CZ"),type:"Count",cards:t.history.length,accuracy:Math.round(t.correct/t.attempts*100),duration});state.stats.sessions=state.stats.sessions.slice(0,20);addXP(Math.round(t.correct*2),"dokončený trénink");saveStats()}

function handValue(hand){let total=0,aces=0;hand.forEach(c=>{if(c.rank==="A"){total+=11;aces++}else if(["K","Q","J"].includes(c.rank))total+=10;else total+=+c.rank});while(total>21&&aces){total-=10;aces--}return{total,soft:aces>0}}
function gameCountValue(rank){return SYSTEMS.hilo.values[rank]}
function resetGameShoe(){state.game.shoe=buildShoe(+$("gameDecks").value);state.game.running=0;state.game.cardsDealt=0;renderGame()}
function drawGameCard(){const g=state.game,totalCards=+$("gameDecks").value*52,cut=totalCards*(1-(+$("penetration").value));if(g.shoe.length<=cut)resetGameShoe();const c=g.shoe.pop();g.running+=gameCountValue(c.rank);g.cardsDealt++;return c}
function renderGame(showDealer=false){const g=state.game;$("playerHand").innerHTML=g.player.map((c,i)=>cardHTML(c,{mini:true,anim:"deal",delay:i*85})).join("");$("dealerHand").innerHTML=g.dealer.map((c,i)=>cardHTML(c,{mini:true,hidden:!showDealer&&i===1,anim:"deal",delay:i*85})).join("");$("playerTotal").textContent=handValue(g.player).total;$("dealerTotal").textContent=showDealer?handValue(g.dealer).total:"?";$("bankroll").textContent=g.bankroll.toLocaleString("cs-CZ");$("betAmount").textContent=g.bet.toLocaleString("cs-CZ");$("gameRunning").textContent=signed(g.running);$("gameTrue").textContent=signed((g.running/Math.max(g.shoe.length/52,.01)).toFixed(2))}
function normalizeRank(r){return ["J","Q","K"].includes(r)?10:r==="A"?11:+r}
function recommendAction(cards,dealerCard){
 const d=normalizeRank(dealerCard.rank),v=handValue(cards),t=v.total,pair=cards.length===2&&normalizeRank(cards[0].rank)===normalizeRank(cards[1].rank);
 if(pair){const r=normalizeRank(cards[0].rank);if(r===11||r===8)return["SPLIT","A-A a 8-8 se standardně rozdělují."];if(r===10)return["STAND","Dvacítku nerozděluj."];if(r===9)return((d>=2&&d<=6)||d===8||d===9)?["SPLIT","Výhodný split proti této kartě."]:["STAND","Proti 7, 10 nebo A je lepší stát."];if(r===7)return d<=7?["SPLIT","Split proti 2–7."]:["HIT","Proti silné kartě vezmi kartu."];if(r===6)return d<=6?["SPLIT","Split proti slabému dealerovi."]:["HIT","Jinak hit."];if(r===5)return d<=9?["DOUBLE","Pár pětek hraj jako tvrdou desítku."]:["HIT","Proti 10/A hit."];if(r===4)return(d===5||d===6)?["SPLIT","Split pouze proti 5 nebo 6."]:["HIT","Jinak hit."];if(r===2||r===3)return d<=7?["SPLIT","Split proti 2–7."]:["HIT","Jinak hit."]}
 if(v.soft){if(t>=19)return["STAND","Soft 19 nebo více."];if(t===18){if(d>=3&&d<=6)return["DOUBLE","Soft 18 proti 3–6."];if(d===2||d===7||d===8)return["STAND","Tady stoj."];return["HIT","Proti 9, 10 nebo A hit."]}if(t===17)return d>=3&&d<=6?["DOUBLE","Soft 17 proti 3–6."]:["HIT","Jinak hit."];if(t===15||t===16)return d>=4&&d<=6?["DOUBLE","Double proti 4–6."]:["HIT","Jinak hit."];if(t===13||t===14)return d>=5&&d<=6?["DOUBLE","Double proti 5–6."]:["HIT","Jinak hit."]}
 if(t>=17)return["STAND","Tvrdých 17 nebo více."];if(t>=13)return d<=6?["STAND","Dealer má slabou kartu."]:["HIT","Proti 7–A hit."];if(t===12)return d>=4&&d<=6?["STAND","Dealer 4–6 má vyšší bust šanci."]:["HIT","Jinak hit."];if(t===11)return["DOUBLE","Jedenáctka je silný double."];if(t===10)return d<=9?["DOUBLE","Desítka proti 2–9."]:["HIT","Proti 10/A hit."];if(t===9)return d>=3&&d<=6?["DOUBLE","Devítka proti 3–6."]:["HIT","Jinak hit."];return["HIT","Nízký součet."]
}
function setGameButtons(active){$("dealGame").disabled=active;$("hitGame").disabled=!active;$("standGame").disabled=!active;$("doubleGame").disabled=!active;$("surrenderGame").disabled=!active}
function gameMessage(text,type="neutral"){$("gameFeedback").textContent=text;$("gameFeedback").className=`coach-message ${type}`}
function dealGame(){const g=state.game;if(g.active)return;if(g.bet>g.bankroll)return gameMessage("Nemáš dost bankrollu.","bad");g.player=[drawGameCard(),drawGameCard()];g.dealer=[drawGameCard(),drawGameCard()];g.active=true;g.doubled=false;g.decisionMade=null;g.decisionExpected=recommendAction(g.player,g.dealer[0]);setGameButtons(true);renderGame(false);$("decisionAnalysis").textContent=`Basic strategy doporučuje ${g.decisionExpected[0]}: ${g.decisionExpected[1]}`;if(handValue(g.player).total===21||handValue(g.dealer).total===21)settleGame();else gameMessage("Jsi na tahu.")}
function recordDecision(action){const g=state.game;if(!g.active)return;state.stats.totalDecisions++;ensureToday();state.stats.daily[todayKey()].decisions++;const expected=g.decisionExpected?.[0];const normalized=action==="SURRENDER"?"SURRENDER":action;if(expected===normalized){state.stats.correctDecisions++;addXP(8,"správné rozhodnutí");$("decisionAnalysis").textContent=`Správně: ${expected}. ${g.decisionExpected[1]}`}else $("decisionAnalysis").textContent=`Odchylka od basic strategy. Doporučeno bylo ${expected}: ${g.decisionExpected[1]}`;saveStats()}
function hitGame(){const g=state.game;recordDecision("HIT");g.player.push(drawGameCard());renderGame(false);if(handValue(g.player).total>21)settleGame();else{g.decisionExpected=recommendAction(g.player,g.dealer[0]);$("decisionAnalysis").textContent=`Další doporučení: ${g.decisionExpected[0]} – ${g.decisionExpected[1]}`}}
function standGame(){recordDecision("STAND");dealerPlay()}
function doubleGame(){const g=state.game;if(g.player.length!==2)return;if($("doubleRule").value==="9to11"&&![9,10,11].includes(handValue(g.player).total))return gameMessage("Pravidla tohoto stolu double nedovolují.","bad");if(g.bet*2>g.bankroll)return gameMessage("Nedostatek bankrollu.","bad");recordDecision("DOUBLE");g.bet*=2;g.doubled=true;g.player.push(drawGameCard());renderGame(false);handValue(g.player).total>21?settleGame():dealerPlay()}
function surrenderGame(){const g=state.game;if($("surrenderRule").value==="none"||g.player.length!==2)return gameMessage("Surrender není dostupný.","bad");recordDecision("SURRENDER");g.bankroll-=g.bet/2;g.active=false;state.stats.games++;gameMessage("Surrender – ztrácíš polovinu sázky.","neutral");setGameButtons(false);renderGame(true);g.bet=100;saveStats()}
function dealerPlay(){const g=state.game;while(true){const v=handValue(g.dealer);const hitSoft17=$("soft17Rule").value==="hit"&&v.total===17&&v.soft;if(v.total<17||hitSoft17)g.dealer.push(drawGameCard());else break}settleGame()}
function settleGame(){const g=state.game,p=handValue(g.player).total,d=handValue(g.dealer).total,pBJ=g.player.length===2&&p===21,dBJ=g.dealer.length===2&&d===21;let result="push";if(p>21||(!pBJ&&dBJ)||d<=21&&p<d)result="lose";else if(d>21||p>d||pBJ&&!dBJ)result="win";
 if(result==="win"){const payout=pBJ?+$("blackjackPayout").value:1;g.bankroll+=g.bet*payout;state.stats.gameWins++;gameMessage(pBJ?"Blackjack!":"Výhra.","good");addXP(pBJ?30:15,pBJ?"blackjack":"výhra")}else if(result==="lose"){g.bankroll-=g.bet;gameMessage("Prohra.","bad")}else gameMessage("Push – remíza.","neutral");
 state.stats.games++;ensureToday();state.stats.daily[todayKey()].games++;g.active=false;setGameButtons(false);renderGame(true);g.bet=100;saveStats()
}

function renderSystemMap(){const sys=SYSTEMS[$("countSystem").value],groups={};Object.entries(sys.values).forEach(([r,v])=>(groups[v]??=[]).push(r));$("systemMap").innerHTML=Object.entries(groups).sort((a,b)=>+b[0]-+a[0]).map(([v,r])=>`<div><strong>${+v>0?"+":""}${v}</strong><span>${r.join(", ")}</span></div>`).join("")}
function parseCards(text){return text.toUpperCase().split(/[,\s]+/).filter(Boolean).map(rank=>({rank,suit:"♠"}))}
function calculateStrategy(){const cards=parseCards($("strategyCards").value);if(cards.length<2||cards.some(c=>!RANKS.includes(c.rank)))return strategyOutput("Neplatné","Použij například A,7 nebo 10,6.");const action=recommendAction(cards,{rank:$("strategyDealer").value,suit:"♠"});strategyOutput(action[0],action[1])}
function strategyOutput(result,reason){$("strategyResult").textContent=result;$("strategyReason").textContent=reason}

function renderCareer(){const i=currentLevel(),r=RANKS_CAREER[i],next=RANKS_CAREER[Math.min(i+1,RANKS_CAREER.length-1)],base=r.min,span=Math.max(next.min-base,1),progress=Math.min(100,(state.stats.xp-base)/span*100);$("heroLevel").textContent=i+1;$("careerLevel").textContent=i+1;$("heroRank").textContent=r.name;$("careerRank").textContent=r.name;$("careerDescription").textContent=r.desc;$("heroXP").textContent=i===RANKS_CAREER.length-1?`${state.stats.xp} XP`:`${state.stats.xp} / ${next.min} XP`;$("xpLabel").textContent=$("heroXP").textContent;$("xpFill").style.width=`${progress}%`;
 $("missionGrid").innerHTML=MISSIONS.map(m=>{const value=state.stats[m.key]||0,done=value>=m.target;if(done&&!state.stats.missions[m.id]){state.stats.missions[m.id]=true;state.stats.xp+=m.xp}return `<div class="mission ${done?"done":""}"><strong>${done?"✅":"🎯"} ${m.title}</strong><span>${Math.min(value,m.target)} / ${m.target} · ${m.xp} XP</span><div class="mission-progress"><div style="width:${Math.min(100,value/m.target*100)}%"></div></div></div>`}).join("");
 $("achievementGrid").innerHTML=ACHIEVEMENTS.map(a=>`<div class="achievement ${a.test(state.stats)?"unlocked":""}"><strong>${a.test(state.stats)?"🏆":"🔒"} ${a.title}</strong><span>${a.desc}</span></div>`).join("")
}
function renderDaily(){ensureToday();const d=state.stats.daily[todayKey()],progress=Math.min(d.cards,50),pct=Math.round(progress/50*100);$("dailyProgressText").textContent=`${progress} / 50`;$("dailyPercent").textContent=`${pct}%`;$("dailyRing").style.background=`conic-gradient(var(--amber) ${pct*3.6}deg,#1a2a40 0deg)`}
function drawLineChart(canvasId,points,labelKey){const c=$(canvasId),ctx=c.getContext("2d");ctx.clearRect(0,0,c.width,c.height);ctx.strokeStyle="#243d5e";ctx.lineWidth=1;for(let i=1;i<5;i++){const y=i*c.height/5;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(c.width,y);ctx.stroke()}if(!points.length)return;const vals=points.map(p=>p[labelKey]),max=Math.max(...vals,1);ctx.strokeStyle="#4ed7ff";ctx.lineWidth=4;ctx.beginPath();vals.forEach((v,i)=>{const x=points.length===1?0:i/(points.length-1)*c.width,y=c.height-30-(v/max)*(c.height-60);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();ctx.fillStyle="#90a6c0";ctx.font="18px system-ui";points.forEach((p,i)=>{const x=points.length===1?10:i/(points.length-1)*(c.width-60)+20;ctx.fillText(p.label,x,c.height-8)})}
function renderAnalytics(){const s=state.stats;$("statsCards").textContent=s.cards;$("statsCorrect").textContent=s.correctCounts;$("statsGames").textContent=s.games;$("statsDecisions").textContent=s.totalDecisions?`${Math.round(s.correctDecisions/s.totalDecisions*100)}%`:"0%";const days=Object.entries(s.daily).slice(-7).map(([date,v])=>({label:date.slice(5),value:v.cards}));drawLineChart("dailyChart",days,"value");const weeks=[];for(let i=0;i<4;i++){const slice=Object.values(s.daily).slice(-(i+1)*7,-i*7||undefined);weeks.unshift({label:`T${4-i}`,value:slice.reduce((a,b)=>a+b.cards,0)})}drawLineChart("weeklyChart",weeks,"value");$("sessionHistory").innerHTML=s.sessions.length?s.sessions.map(x=>`<div class="session-item"><div><strong>${x.type}</strong><br><span>${x.date}</span></div><div><strong>${x.accuracy}%</strong><br><span>${x.cards} karet</span></div></div>`).join(""):'<div class="session-item"><span>Zatím žádné dokončené tréninky.</span></div>'}
function renderAllStats(){renderCareer();renderDaily();renderAnalytics()}



function renderCameraPicker(){
 $("cameraRankPicker").innerHTML=RANKS.map(r=>`<button data-camera-rank="${r}" class="${state.camera.rank===r?"active":""}">${r}</button>`).join("");
 $("cameraSuitPicker").innerHTML=SUITS.map(s=>`<button data-camera-suit="${s}" class="${state.camera.suit===s?"active":""} ${s==="♥"||s==="♦"?"red-suit":""}">${s}</button>`).join("");
 document.querySelectorAll("[data-camera-rank]").forEach(b=>b.onclick=()=>{state.camera.rank=b.dataset.cameraRank;renderCameraPicker()});
 document.querySelectorAll("[data-camera-suit]").forEach(b=>b.onclick=()=>{state.camera.suit=b.dataset.cameraSuit;renderCameraPicker()});
}
function cameraMessage(text,type="neutral"){$("cameraFeedback").textContent=text;$("cameraFeedback").className=`coach-message ${type}`}
async function startCamera(){try{if(state.camera.stream)return;const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});state.camera.stream=stream;$("cameraPreview").srcObject=stream;await $("cameraPreview").play();$("cameraPreview").classList.remove("hidden");$("cameraSnapshot").classList.add("hidden");$("cameraPlaceholder").classList.add("hidden");$("cameraStatus").textContent="Aktivní";$("cameraStatus").className="signal good";$("startCamera").disabled=true;$("freezeCamera").disabled=false;$("stopCamera").disabled=false;cameraMessage("Kamera běží. Umísti kartu do rámečku a zmraz obraz.","good")}catch(e){cameraMessage("Kameru se nepodařilo spustit. Otevři stránku přes HTTPS a povol kameru.","bad")}}
function freezeCamera(){if(!state.camera.stream)return;const v=$("cameraPreview"),c=$("cameraSnapshot"),x=c.getContext("2d");c.width=v.videoWidth||1280;c.height=v.videoHeight||720;x.drawImage(v,0,0,c.width,c.height);c.classList.remove("hidden");v.classList.add("hidden");state.camera.frozen=true;$("freezeCamera").disabled=true;$("resumeCamera").disabled=false;cameraMessage("Obraz je zmrazený. Vyber kartu a potvrď ji.","neutral")}
function resumeCamera(){if(!state.camera.stream)return;$("cameraSnapshot").classList.add("hidden");$("cameraPreview").classList.remove("hidden");state.camera.frozen=false;$("freezeCamera").disabled=false;$("resumeCamera").disabled=true;cameraMessage("Kamera znovu běží.","good")}
function stopCamera(){if(state.camera.stream)state.camera.stream.getTracks().forEach(t=>t.stop());state.camera.stream=null;state.camera.frozen=false;$("cameraPreview").srcObject=null;$("cameraPreview").classList.add("hidden");$("cameraSnapshot").classList.add("hidden");$("cameraPlaceholder").classList.remove("hidden");$("cameraStatus").textContent="Vypnuto";$("cameraStatus").className="signal neutral";$("startCamera").disabled=false;$("freezeCamera").disabled=true;$("resumeCamera").disabled=true;$("stopCamera").disabled=true;cameraMessage("Kamera byla vypnuta.","neutral")}
function confirmCameraCard(){const target=$("cameraTarget").value;state.live.activeTarget=target;state.live.selectedRank=state.camera.rank;state.live.selectedSuit=state.camera.suit;addLiveCard();setLiveTarget(target);cameraMessage(`${state.camera.rank}${state.camera.suit} byla přidána pro ${liveTargetName(target).toLowerCase()}.`,"good")}

function liveTargetName(target){return target==="dealer"?"Dealer":`Hráč ${target.slice(1)}`}
function resetLiveTable(){
 const decks=+$("liveDecks").value;state.live.decks=decks;state.live.seen=[];state.live.history=[];
 state.live.hands={dealer:[],p1:[],p2:[],p3:[],p4:[],p5:[],p6:[],p7:[]};state.live.activeTarget="dealer";
 renderLivePicker();renderLiveSeats();renderLiveTable();
}
function setLiveTarget(target){
 state.live.activeTarget=target;
 document.querySelectorAll(".live-seat").forEach(x=>x.classList.toggle("active",x.dataset.target===target));
 $("livePickerTitle").textContent=`Vyber kartu pro ${liveTargetName(target).toLowerCase()}`;
 $("liveActiveTarget").textContent=liveTargetName(target);
}
function renderLiveSeats(){
 const seats=+$("liveSeats").value,root=$("livePlayerSeats");
 root.innerHTML=Array.from({length:seats},(_,i)=>{const id=`p${i+1}`;return `<div class="live-seat ${state.live.activeTarget===id?"active":""}" data-target="${id}"><span class="seat-label">HRÁČ ${i+1}</span><div id="liveHand_${id}" class="live-hand"></div><div class="seat-controls"><button class="secondary-btn live-add-card" data-target="${id}">Přidat kartu</button><button class="secondary-btn live-remove-card" data-target="${id}">Zpět</button></div></div>`}).join("");
 document.querySelectorAll(".live-seat").forEach(seat=>seat.onclick=e=>{if(!e.target.closest("button"))setLiveTarget(seat.dataset.target)});
 document.querySelectorAll(".live-add-card").forEach(btn=>btn.onclick=()=>setLiveTarget(btn.dataset.target));
 document.querySelectorAll(".live-remove-card").forEach(btn=>btn.onclick=()=>removeLiveCard(btn.dataset.target));
 const dealer=document.querySelector(".dealer-seat");dealer.onclick=e=>{if(!e.target.closest("button"))setLiveTarget("dealer")};
 document.querySelector(".dealer-seat .live-add-card").onclick=()=>setLiveTarget("dealer");
 document.querySelector(".dealer-seat .live-remove-card").onclick=()=>removeLiveCard("dealer");
}
function renderLivePicker(){
 $("liveRankPicker").innerHTML=RANKS.map(r=>`<button data-rank="${r}" class="${state.live.selectedRank===r?"active":""}">${r}</button>`).join("");
 $("liveSuitPicker").innerHTML=SUITS.map(s=>`<button data-suit="${s}" class="${state.live.selectedSuit===s?"active":""} ${s==="♥"||s==="♦"?"red-suit":""}">${s}</button>`).join("");
 document.querySelectorAll("[data-rank]").forEach(b=>b.onclick=()=>{state.live.selectedRank=b.dataset.rank;renderLivePicker()});
 document.querySelectorAll("[data-suit]").forEach(b=>b.onclick=()=>{state.live.selectedSuit=b.dataset.suit;renderLivePicker()});
}
function addLiveCard(){
 const card={rank:state.live.selectedRank,suit:state.live.selectedSuit};
 const used=state.live.seen.filter(c=>c.rank===card.rank&&c.suit===card.suit).length;
 if(used>=state.live.decks){$("liveCoach").textContent=`Tato konkrétní karta už byla zadána ${used}×.`;$("liveCoach").className="coach-message bad";return}
 state.live.hands[state.live.activeTarget].push(card);state.live.seen.push(card);state.live.history.push({target:state.live.activeTarget,card});renderLiveTable();sound();
}
function removeLiveCard(target){
 const hand=state.live.hands[target];if(!hand.length)return;const card=hand.pop();
 const idx=state.live.seen.findLastIndex(c=>c.rank===card.rank&&c.suit===card.suit);if(idx>=0)state.live.seen.splice(idx,1);
 const hidx=state.live.history.findLastIndex(x=>x.target===target&&x.card.rank===card.rank&&x.card.suit===card.suit);if(hidx>=0)state.live.history.splice(hidx,1);renderLiveTable();
}
function undoLive(){const last=state.live.history.pop();if(!last)return;state.live.hands[last.target].pop();const idx=state.live.seen.findLastIndex(c=>c.rank===last.card.rank&&c.suit===last.card.suit);if(idx>=0)state.live.seen.splice(idx,1);renderLiveTable()}
function clearLiveRound(){Object.keys(state.live.hands).forEach(k=>state.live.hands[k]=[]);renderLiveTable()}
function liveCounts(){
 const total=state.live.decks*52,seen=state.live.seen.length,remaining=Math.max(total-seen,1);
 const running=state.live.seen.reduce((a,c)=>a+SYSTEMS.hilo.values[c.rank],0);
 const override=$("liveDeckEstimate").value,decksLeft=override==="auto"?remaining/52:+override,trueCount=running/Math.max(decksLeft,.25);
 const rankCounts={};for(const r of RANKS)rankCounts[r]=state.live.decks*4;for(const c of state.live.seen)rankCounts[c.rank]--;
 const low=["2","3","4","5","6"].reduce((a,r)=>a+rankCounts[r],0),neutral=["7","8","9"].reduce((a,r)=>a+rankCounts[r],0);
 const tens=["10","J","Q","K"].reduce((a,r)=>a+rankCounts[r],0),aces=rankCounts.A,high=tens+aces;
 return {seen,remaining,running,decksLeft,trueCount,rankCounts,low,neutral,tens,aces,high};
}
function dealerBustProbability(){
 const dealer=state.live.hands.dealer;if(!dealer.length)return null;const up=normalizeRank(dealer[0].rank),rule=$("liveSoft17").value;
 const s17={2:.353,3:.374,4:.400,5:.429,6:.423,7:.262,8:.245,9:.228,10:.230,11:.170};
 const h17={2:.356,3:.376,4:.403,5:.431,6:.439,7:.262,8:.245,9:.228,10:.230,11:.202};
 return Math.min(.65,Math.max(.05,(rule==="hit"?h17:s17)[up]+liveCounts().trueCount*.006));
}
function renderLiveTable(){
 const c=liveCounts(),seats=+$("liveSeats").value;
 $("liveDealerHand").innerHTML=state.live.hands.dealer.map(card=>cardHTML(card,{mini:true,anim:"deal"})).join("");
 for(let i=1;i<=seats;i++){const el=$(`liveHand_p${i}`);if(el)el.innerHTML=state.live.hands[`p${i}`].map(card=>cardHTML(card,{mini:true,anim:"deal"})).join("")}
 $("liveRunning").textContent=signed(c.running);$("liveTrue").textContent=signed(c.trueCount.toFixed(2));$("liveDecksLeft").textContent=c.decksLeft.toFixed(2);$("liveSeen").textContent=c.seen;
 $("liveHighChance").textContent=`${(c.high/c.remaining*100).toFixed(1)}%`;$("liveAceChance").textContent=`${(c.aces/c.remaining*100).toFixed(1)}%`;$("liveTensLeft").textContent=c.tens;
 const bust=dealerBustProbability();$("liveDealerBust").textContent=bust===null?"—":`${(bust*100).toFixed(1)}%`;
 const low=c.low/c.remaining*100,neu=c.neutral/c.remaining*100,high=c.high/c.remaining*100;
 $("probLow").textContent=`${low.toFixed(1)}%`;$("probNeutral").textContent=`${neu.toFixed(1)}%`;$("probHigh").textContent=`${high.toFixed(1)}%`;
 $("probLowBar").style.width=`${low}%`;$("probNeutralBar").style.width=`${neu}%`;$("probHighBar").style.width=`${high}%`;
 $("liveComposition").innerHTML=RANKS.map(r=>`<div class="composition-card"><strong>${r}</strong><span>${c.rankCounts[r]} zbývá</span></div>`).join("");
 const coach=$("liveCoach");
 if(!c.seen){coach.textContent="Přidej odkryté karty ze stolu. Výpočty se budou aktualizovat okamžitě.";coach.className="coach-message neutral"}
 else if(c.trueCount>=2){coach.textContent=`Pozitivní shoe: true count ${signed(c.trueCount.toFixed(2))}. Ve zbývajících kartách je relativně více desítek a es.`;coach.className="coach-message good"}
 else if(c.trueCount<=-1){coach.textContent=`Záporný shoe: true count ${signed(c.trueCount.toFixed(2))}. Ve zbývajících kartách je relativně více malých karet.`;coach.className="coach-message bad"}
 else{coach.textContent=`Shoe je přibližně neutrální. Pravděpodobnost další vysoké karty je ${high.toFixed(1)} %.`;coach.className="coach-message neutral"}
}

document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>{

function renderCameraPicker(){
 $("cameraRankPicker").innerHTML=RANKS.map(r=>`<button data-camera-rank="${r}" class="${state.camera.rank===r?"active":""}">${r}</button>`).join("");
 $("cameraSuitPicker").innerHTML=SUITS.map(s=>`<button data-camera-suit="${s}" class="${state.camera.suit===s?"active":""} ${s==="♥"||s==="♦"?"red-suit":""}">${s}</button>`).join("");
 document.querySelectorAll("[data-camera-rank]").forEach(b=>b.onclick=()=>{state.camera.rank=b.dataset.cameraRank;renderCameraPicker()});
 document.querySelectorAll("[data-camera-suit]").forEach(b=>b.onclick=()=>{state.camera.suit=b.dataset.cameraSuit;renderCameraPicker()});
}
function cameraMessage(text,type="neutral"){$("cameraFeedback").textContent=text;$("cameraFeedback").className=`coach-message ${type}`}
async function startCamera(){try{if(state.camera.stream)return;const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});state.camera.stream=stream;$("cameraPreview").srcObject=stream;await $("cameraPreview").play();$("cameraPreview").classList.remove("hidden");$("cameraSnapshot").classList.add("hidden");$("cameraPlaceholder").classList.add("hidden");$("cameraStatus").textContent="Aktivní";$("cameraStatus").className="signal good";$("startCamera").disabled=true;$("freezeCamera").disabled=false;$("stopCamera").disabled=false;cameraMessage("Kamera běží. Umísti kartu do rámečku a zmraz obraz.","good")}catch(e){cameraMessage("Kameru se nepodařilo spustit. Otevři stránku přes HTTPS a povol kameru.","bad")}}
function freezeCamera(){if(!state.camera.stream)return;const v=$("cameraPreview"),c=$("cameraSnapshot"),x=c.getContext("2d");c.width=v.videoWidth||1280;c.height=v.videoHeight||720;x.drawImage(v,0,0,c.width,c.height);c.classList.remove("hidden");v.classList.add("hidden");state.camera.frozen=true;$("freezeCamera").disabled=true;$("resumeCamera").disabled=false;cameraMessage("Obraz je zmrazený. Vyber kartu a potvrď ji.","neutral")}
function resumeCamera(){if(!state.camera.stream)return;$("cameraSnapshot").classList.add("hidden");$("cameraPreview").classList.remove("hidden");state.camera.frozen=false;$("freezeCamera").disabled=false;$("resumeCamera").disabled=true;cameraMessage("Kamera znovu běží.","good")}
function stopCamera(){if(state.camera.stream)state.camera.stream.getTracks().forEach(t=>t.stop());state.camera.stream=null;state.camera.frozen=false;$("cameraPreview").srcObject=null;$("cameraPreview").classList.add("hidden");$("cameraSnapshot").classList.add("hidden");$("cameraPlaceholder").classList.remove("hidden");$("cameraStatus").textContent="Vypnuto";$("cameraStatus").className="signal neutral";$("startCamera").disabled=false;$("freezeCamera").disabled=true;$("resumeCamera").disabled=true;$("stopCamera").disabled=true;cameraMessage("Kamera byla vypnuta.","neutral")}
function confirmCameraCard(){const target=$("cameraTarget").value;state.live.activeTarget=target;state.live.selectedRank=state.camera.rank;state.live.selectedSuit=state.camera.suit;addLiveCard();setLiveTarget(target);cameraMessage(`${state.camera.rank}${state.camera.suit} byla přidána pro ${liveTargetName(target).toLowerCase()}.`,"good")}

function liveTargetName(target){return target==="dealer"?"Dealer":`Hráč ${target.slice(1)}`}
function resetLiveTable(){
 const decks=+$("liveDecks").value;state.live.decks=decks;state.live.seen=[];state.live.history=[];
 state.live.hands={dealer:[],p1:[],p2:[],p3:[],p4:[],p5:[],p6:[],p7:[]};state.live.activeTarget="dealer";
 renderLivePicker();renderLiveSeats();renderLiveTable();
}
function setLiveTarget(target){
 state.live.activeTarget=target;
 document.querySelectorAll(".live-seat").forEach(x=>x.classList.toggle("active",x.dataset.target===target));
 $("livePickerTitle").textContent=`Vyber kartu pro ${liveTargetName(target).toLowerCase()}`;
 $("liveActiveTarget").textContent=liveTargetName(target);
}
function renderLiveSeats(){
 const seats=+$("liveSeats").value,root=$("livePlayerSeats");
 root.innerHTML=Array.from({length:seats},(_,i)=>{const id=`p${i+1}`;return `<div class="live-seat ${state.live.activeTarget===id?"active":""}" data-target="${id}"><span class="seat-label">HRÁČ ${i+1}</span><div id="liveHand_${id}" class="live-hand"></div><div class="seat-controls"><button class="secondary-btn live-add-card" data-target="${id}">Přidat kartu</button><button class="secondary-btn live-remove-card" data-target="${id}">Zpět</button></div></div>`}).join("");
 document.querySelectorAll(".live-seat").forEach(seat=>seat.onclick=e=>{if(!e.target.closest("button"))setLiveTarget(seat.dataset.target)});
 document.querySelectorAll(".live-add-card").forEach(btn=>btn.onclick=()=>setLiveTarget(btn.dataset.target));
 document.querySelectorAll(".live-remove-card").forEach(btn=>btn.onclick=()=>removeLiveCard(btn.dataset.target));
 const dealer=document.querySelector(".dealer-seat");dealer.onclick=e=>{if(!e.target.closest("button"))setLiveTarget("dealer")};
 document.querySelector(".dealer-seat .live-add-card").onclick=()=>setLiveTarget("dealer");
 document.querySelector(".dealer-seat .live-remove-card").onclick=()=>removeLiveCard("dealer");
}
function renderLivePicker(){
 $("liveRankPicker").innerHTML=RANKS.map(r=>`<button data-rank="${r}" class="${state.live.selectedRank===r?"active":""}">${r}</button>`).join("");
 $("liveSuitPicker").innerHTML=SUITS.map(s=>`<button data-suit="${s}" class="${state.live.selectedSuit===s?"active":""} ${s==="♥"||s==="♦"?"red-suit":""}">${s}</button>`).join("");
 document.querySelectorAll("[data-rank]").forEach(b=>b.onclick=()=>{state.live.selectedRank=b.dataset.rank;renderLivePicker()});
 document.querySelectorAll("[data-suit]").forEach(b=>b.onclick=()=>{state.live.selectedSuit=b.dataset.suit;renderLivePicker()});
}
function addLiveCard(){
 const card={rank:state.live.selectedRank,suit:state.live.selectedSuit};
 const used=state.live.seen.filter(c=>c.rank===card.rank&&c.suit===card.suit).length;
 if(used>=state.live.decks){$("liveCoach").textContent=`Tato konkrétní karta už byla zadána ${used}×.`;$("liveCoach").className="coach-message bad";return}
 state.live.hands[state.live.activeTarget].push(card);state.live.seen.push(card);state.live.history.push({target:state.live.activeTarget,card});renderLiveTable();sound();
}
function removeLiveCard(target){
 const hand=state.live.hands[target];if(!hand.length)return;const card=hand.pop();
 const idx=state.live.seen.findLastIndex(c=>c.rank===card.rank&&c.suit===card.suit);if(idx>=0)state.live.seen.splice(idx,1);
 const hidx=state.live.history.findLastIndex(x=>x.target===target&&x.card.rank===card.rank&&x.card.suit===card.suit);if(hidx>=0)state.live.history.splice(hidx,1);renderLiveTable();
}
function undoLive(){const last=state.live.history.pop();if(!last)return;state.live.hands[last.target].pop();const idx=state.live.seen.findLastIndex(c=>c.rank===last.card.rank&&c.suit===last.card.suit);if(idx>=0)state.live.seen.splice(idx,1);renderLiveTable()}
function clearLiveRound(){Object.keys(state.live.hands).forEach(k=>state.live.hands[k]=[]);renderLiveTable()}
function liveCounts(){
 const total=state.live.decks*52,seen=state.live.seen.length,remaining=Math.max(total-seen,1);
 const running=state.live.seen.reduce((a,c)=>a+SYSTEMS.hilo.values[c.rank],0);
 const override=$("liveDeckEstimate").value,decksLeft=override==="auto"?remaining/52:+override,trueCount=running/Math.max(decksLeft,.25);
 const rankCounts={};for(const r of RANKS)rankCounts[r]=state.live.decks*4;for(const c of state.live.seen)rankCounts[c.rank]--;
 const low=["2","3","4","5","6"].reduce((a,r)=>a+rankCounts[r],0),neutral=["7","8","9"].reduce((a,r)=>a+rankCounts[r],0);
 const tens=["10","J","Q","K"].reduce((a,r)=>a+rankCounts[r],0),aces=rankCounts.A,high=tens+aces;
 return {seen,remaining,running,decksLeft,trueCount,rankCounts,low,neutral,tens,aces,high};
}
function dealerBustProbability(){
 const dealer=state.live.hands.dealer;if(!dealer.length)return null;const up=normalizeRank(dealer[0].rank),rule=$("liveSoft17").value;
 const s17={2:.353,3:.374,4:.400,5:.429,6:.423,7:.262,8:.245,9:.228,10:.230,11:.170};
 const h17={2:.356,3:.376,4:.403,5:.431,6:.439,7:.262,8:.245,9:.228,10:.230,11:.202};
 return Math.min(.65,Math.max(.05,(rule==="hit"?h17:s17)[up]+liveCounts().trueCount*.006));
}
function renderLiveTable(){
 const c=liveCounts(),seats=+$("liveSeats").value;
 $("liveDealerHand").innerHTML=state.live.hands.dealer.map(card=>cardHTML(card,{mini:true,anim:"deal"})).join("");
 for(let i=1;i<=seats;i++){const el=$(`liveHand_p${i}`);if(el)el.innerHTML=state.live.hands[`p${i}`].map(card=>cardHTML(card,{mini:true,anim:"deal"})).join("")}
 $("liveRunning").textContent=signed(c.running);$("liveTrue").textContent=signed(c.trueCount.toFixed(2));$("liveDecksLeft").textContent=c.decksLeft.toFixed(2);$("liveSeen").textContent=c.seen;
 $("liveHighChance").textContent=`${(c.high/c.remaining*100).toFixed(1)}%`;$("liveAceChance").textContent=`${(c.aces/c.remaining*100).toFixed(1)}%`;$("liveTensLeft").textContent=c.tens;
 const bust=dealerBustProbability();$("liveDealerBust").textContent=bust===null?"—":`${(bust*100).toFixed(1)}%`;
 const low=c.low/c.remaining*100,neu=c.neutral/c.remaining*100,high=c.high/c.remaining*100;
 $("probLow").textContent=`${low.toFixed(1)}%`;$("probNeutral").textContent=`${neu.toFixed(1)}%`;$("probHigh").textContent=`${high.toFixed(1)}%`;
 $("probLowBar").style.width=`${low}%`;$("probNeutralBar").style.width=`${neu}%`;$("probHighBar").style.width=`${high}%`;
 $("liveComposition").innerHTML=RANKS.map(r=>`<div class="composition-card"><strong>${r}</strong><span>${c.rankCounts[r]} zbývá</span></div>`).join("");
 const coach=$("liveCoach");
 if(!c.seen){coach.textContent="Přidej odkryté karty ze stolu. Výpočty se budou aktualizovat okamžitě.";coach.className="coach-message neutral"}
 else if(c.trueCount>=2){coach.textContent=`Pozitivní shoe: true count ${signed(c.trueCount.toFixed(2))}. Ve zbývajících kartách je relativně více desítek a es.`;coach.className="coach-message good"}
 else if(c.trueCount<=-1){coach.textContent=`Záporný shoe: true count ${signed(c.trueCount.toFixed(2))}. Ve zbývajících kartách je relativně více malých karet.`;coach.className="coach-message bad"}
 else{coach.textContent=`Shoe je přibližně neutrální. Pravděpodobnost další vysoké karty je ${high.toFixed(1)} %.`;coach.className="coach-message neutral"}
}

document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".panel").forEach(x=>x.classList.remove("active-panel"));btn.classList.add("active");$(btn.dataset.tab).classList.add("active-panel");if(btn.dataset.tab==="analytics")renderAnalytics()}));
$("guessMinus").onclick=()=>setGuess(state.trainer.guess-1);$("guessPlus").onclick=()=>setGuess(state.trainer.guess+1);$("guessZero").onclick=()=>setGuess(0);document.querySelectorAll("[data-delta]").forEach(b=>b.onclick=()=>setGuess(state.trainer.guess+ +b.dataset.delta));
$("drawTrainerCard").onclick=drawTrainer;$("checkTrainerGuess").onclick=()=>checkTrainer(false);$("revealTrainerCount").onclick=()=>checkTrainer(true);$("resetTrainer").onclick=()=>{finishTrainerSession();resetTrainer()};$("trainerDecks").onchange=resetTrainer;$("countSystem").onchange=()=>{renderSystemMap();resetTrainer()};
$("newShoe").onclick=resetGameShoe;$("dealGame").onclick=dealGame;$("hitGame").onclick=hitGame;$("standGame").onclick=standGame;$("doubleGame").onclick=doubleGame;$("surrenderGame").onclick=surrenderGame;document.querySelectorAll("[data-chip]").forEach(b=>b.onclick=()=>{if(!state.game.active&&state.game.bet+ +b.dataset.chip<=state.game.bankroll){state.game.bet+=+b.dataset.chip;renderGame()}});


$("startCamera").onclick=startCamera;$("freezeCamera").onclick=freezeCamera;$("resumeCamera").onclick=resumeCamera;$("stopCamera").onclick=stopCamera;$("cameraConfirmCard").onclick=confirmCameraCard;
$("resetLiveTable").onclick=resetLiveTable;
$("liveDecks").onchange=resetLiveTable;
$("liveSeats").onchange=()=>{renderLiveSeats();renderLiveTable()};
$("liveDeckEstimate").onchange=renderLiveTable;
$("liveSoft17").onchange=renderLiveTable;
$("liveAddSelected").onclick=addLiveCard;
$("liveUndo").onclick=undoLive;
$("liveClearRound").onclick=clearLiveRound;

$("calculateStrategy").onclick=calculateStrategy;$("clearStats").onclick=()=>{if(confirm("Opravdu vymazat všechny statistiky?")){state.stats=defaultStats();saveStats()}};
$("soundToggle").onclick=()=>{state.sound=!state.sound;$("soundToggle").textContent=state.sound?"🔊":"🔇"};
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();state.deferredInstall=e;$("installBtn").classList.remove("hidden")});$("installBtn").onclick=async()=>{if(!state.deferredInstall)return;state.deferredInstall.prompt();await state.deferredInstall.userChoice;$("installBtn").classList.add("hidden")};
let lastTouch=0;document.addEventListener("touchend",e=>{const now=Date.now();if(now-lastTouch<350){e.preventDefault();e.stopPropagation()}lastTouch=now},{passive:false,capture:true});["gesturestart","gesturechange","gestureend"].forEach(t=>document.addEventListener(t,e=>e.preventDefault(),{passive:false}));
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js?v=10"));
ensureToday();resetTrainer();resetGameShoe();renderSystemMap();renderAllStats();resetLiveTable();renderCameraPicker();saveStats();
