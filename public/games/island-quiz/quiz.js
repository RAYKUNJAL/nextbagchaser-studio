(() => {
  "use strict";
  const islands = [
    ["Trinidad & Tobago","🇹🇹","Doubles","Scarlet Ibis","Steelpan",0,0,10],
    ["Jamaica","🇯🇲","Ackee & Saltfish","Doctor Bird","Julie Mango",1,1,6],
    ["Barbados","🇧🇧","Flying Fish & Cou-Cou","Pride of Barbados","Conch Shell",2,2,12],
    ["Guyana","🇬🇾","Pepperpot","Jaguar","Cacao Pod",3,3,8],
    ["Grenada","🇬🇩","Oil Down","Grenada Dove","Nutmeg",4,4,7],
    ["Saint Lucia","🇱🇨","Green Fig & Saltfish","Saint Lucia Parrot","Tropical Orchid",5,5,5],
    ["The Bahamas","🇧🇸","Conch Fritters","Caribbean Flamingo","Coconut Drink",6,6,14],
    ["Dominican Republic","🇩🇴","Mangú","Hispaniolan Parrot","Maracas",7,7,13],
    ["Haiti","🇭🇹","Griot & Pikliz","Hispaniolan Trogon","Bougainvillea",8,8,3],
    ["Puerto Rico","🇵🇷","Mofongo","Coquí Frog","Hibiscus",9,9,2],
    ["Antigua & Barbuda","🇦🇬","Ducana & Saltfish","Frigatebird","Postman Butterfly",10,10,1],
    ["Dominica","🇩🇲","Callaloo","Sisserou Parrot","Heliconia",11,11,4],
    ["St Vincent & Grenadines","🇻🇨","Breadfruit & Jackfish","Saint Vincent Parrot","Blue Morpho",12,12,0],
    ["St Kitts & Nevis","🇰🇳","Goat Water","Brown Pelican","Golden Pineapple",13,13,9],
    ["Cuba","🇨🇺","Ropa Vieja","Tocororo","Carnival Mask",14,14,11],
    ["Belize","🇧🇿","Rice, Beans & Stew Chicken","Keel-Billed Toucan","Cacao Pod",15,15,8]
  ];
  const TYPES = ["food","nature","culture","flag"];
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem("ll-island-quiz-v1") || "{}") || {}; } catch { /* recover a damaged local save */ }
  const TOTAL_LEVELS = 64;
  let level = Math.max(1, Math.min(TOTAL_LEVELS, Number(saved.level) || 1));
  let score = Number(saved.score) || 0, streak = Number(saved.streak) || 0, soundOn = saved.sound !== false, locked = false;
  const $ = id => document.getElementById(id);
  const els = {level:$("levelText"),score:$("scoreText"),streak:$("streakText"),chapter:$("chapterText"),progress:$("progressBar"),visual:$("visual"),type:$("questionType"),question:$("questionText"),answers:$("answers"),feedback:$("feedback"),feedbackTitle:$("feedbackTitle"),feedbackText:$("feedbackText"),next:$("nextButton"),sound:$("soundButton"),confetti:$("quizConfetti")};
  let audio = null;
  function roundLength(current) {
    if (current <= 3) return 6;
    return Math.min(10, 6 + Math.floor((current - 1) / 8));
  }
  let step = Math.max(0, Math.min(roundLength(level) - 1, Number(saved.step) || 0));
  function persist(){localStorage.setItem("ll-island-quiz-v1",JSON.stringify({level,step,score,streak,sound:soundOn}))}
  function rand(seed){let value=(seed*9301+49297)%233280;return()=>((value=(value*9301+49297)%233280)/233280)}
  function sampleOptions(correct, pool, seed){const random=rand(seed), options=[correct];while(options.length<4){const candidate=pool[Math.floor(random()*pool.length)];if(!options.includes(candidate))options.push(candidate)}return options.sort(()=>random()-.5)}
  function questionFor(current, questionStep){const sequence=(current-1)*10+questionStep;const islandIndex=(sequence*3)%islands.length;const type=TYPES[questionStep%TYPES.length];const island=islands[islandIndex];let question,correct,pool,image,detail,label;
    if(type==="food"){question=`Which island is famous for ${island[2]}?`;correct=island[0];pool=islands.map(i=>i[0]);image=`/games/block-carnival/assets/items/food-${String(island[5]).padStart(2,"0")}.webp`;detail=`${island[2]} is the featured island dish in our ${island[0]} collection.`;label="ISLAND FOOD"}
    if(type==="nature"){question=`Which wildlife or flower belongs with ${island[0]}?`;correct=island[3];pool=islands.map(i=>i[3]);image=`/games/block-carnival/assets/items/nature-${String(island[6]).padStart(2,"0")}.webp`;detail=`Meet the ${island[3]}, the nature collectible for ${island[0]}.`;label="ISLAND NATURE"}
    if(type==="culture"){question=`Choose the cultural treasure connected to ${island[0]}.`;correct=island[4];pool=islands.map(i=>i[4]);image=`/games/block-carnival/assets/items/culture-${String(island[7]).padStart(2,"0")}.webp`;detail=`${island[4]} is featured in the ${island[0]} passport chapter.`;label="ISLAND TREASURE"}
    if(type==="flag"){question=`Which island does this flag represent?`;correct=island[0];pool=islands.map(i=>i[0]);image=island[1];detail=`This is the flag of ${island[0]}.`;label="ISLAND FLAG"}
    return{island,type,question,correct,options:sampleOptions(correct,pool,sequence*97+13),image,detail,label};
  }
  function accessAllows(current) {
    if (current <= 3) return true;
    const check = window.LikkleLegends?.requireAccess;
    if (typeof check !== "function") return false;
    try { return check({ completedLevels: current - 1, prompt: false }) === true; }
    catch { return false; }
  }
  function render(){
    if (!accessAllows(level)) { level = 3; step = 0; if (typeof window.LikkleLegends?.openUnlock === "function") window.LikkleLegends.openUnlock(); }
    const length = roundLength(level);
    step = Math.max(0, Math.min(length - 1, step));
    locked = false;
    const q = questionFor(level, step);
    els.level.textContent = `${level} / ${TOTAL_LEVELS} · ${step + 1}/${length}`;
    els.score.textContent = score.toLocaleString();
    els.streak.textContent = streak;
    els.chapter.textContent = q.island[0];
    els.progress.style.width = `${Math.min(100, ((level - 1) + step / length) / TOTAL_LEVELS * 100)}%`;
    els.type.textContent = q.label;
    els.question.textContent = q.question;
    els.visual.innerHTML = q.type === "flag" ? `<span class="big-flag" role="img" aria-label="${q.island[0]} flag">${q.image}</span>` : `<img src="${q.image}" alt="${q.correct}">`;
    els.answers.innerHTML = "";
    els.feedback.hidden = true;
    q.options.forEach(option => { const button = document.createElement("button"); button.type = "button"; button.textContent = option; button.onclick = () => answer(button, option, q); els.answers.appendChild(button); });
  }
  function answer(button,choice,q){
    if (locked) return;
    if (choice !== q.correct) { button.classList.add("wrong"); streak = 0; score = Math.max(0, score - 10); els.score.textContent = score; els.streak.textContent = streak; tone(135); setTimeout(() => button.classList.remove("wrong"), 450); persist(); return; }
    locked = true; button.classList.add("correct"); streak++; score += 100 + Math.min(streak, 10) * 15; els.score.textContent = score.toLocaleString(); els.streak.textContent = streak;
    const length = roundLength(level);
    const finishedRound = step + 1 >= length;
    els.feedbackTitle.textContent = finishedRound ? "Round complete—passport stamp earned!" : `Correct — question ${step + 1} of ${length}`;
    els.feedbackText.textContent = q.detail;
    els.next.textContent = finishedRound ? (level >= TOTAL_LEVELS ? "Play again" : "Next level") : "Next question";
    els.feedback.hidden = false;
    [...els.answers.children].forEach(item => item.disabled = true);
    tone(620); celebrate(); persist();
    if (finishedRound) window.LikkleLegends?.recordLevel("island-quiz", level, score, level);
  }
  function next(){
    if (!locked) return;
    if (step + 1 < roundLength(level)) { step++; persist(); render(); return; }
    step = 0;
    if (level >= TOTAL_LEVELS) { level = 1; score = 0; streak = 0; }
    else level++;
    persist(); render();
  }
  function tone(freq){if(!soundOn)return;try{audio||=new(window.AudioContext||window.webkitAudioContext)();const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=freq;o.type="sine";g.gain.setValueAtTime(.08,audio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.18);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+.2)}catch{}}
  function celebrate(){const colors=["#ffd34e","#ff536d","#45ded2","#fff"];for(let i=0;i<35;i++){const bit=document.createElement("i");bit.style.left=`${Math.random()*100}%`;bit.style.background=colors[i%colors.length];bit.style.setProperty("--drift",`${-80+Math.random()*160}px`);els.confetti.appendChild(bit);setTimeout(()=>bit.remove(),1900)}}
  addEventListener("likkle:ready", event=>{if(locked)return;const cloud=event.detail?.progress?.["island-quiz"];const completed=Math.max(0,Math.min(TOTAL_LEVELS,Number(cloud?.level)||0));const restored=completed>=TOTAL_LEVELS?TOTAL_LEVELS:completed+1;if(restored>level||Number(cloud?.score)>score){level=Math.max(level,restored);step=0;score=Math.max(score,Number(cloud?.score)||0);persist();render()}});
  els.next.onclick=next;els.sound.onclick=()=>{soundOn=!soundOn;els.sound.textContent=soundOn?"♪ Sound on":"♪ Sound off";persist()};els.sound.textContent=soundOn?"♪ Sound on":"♪ Sound off";render();
})();
