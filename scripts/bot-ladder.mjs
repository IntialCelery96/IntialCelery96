/**
 * Round-robin between every pair of bots, to check the roster is a real ladder.
 *
 *   npm run build -w @connect4gg/engine
 *   node scripts/bot-ladder.mjs [gamesPerPairing]
 *
 * Colours alternate each game so neither side gets the first-player advantage.
 * Run this after touching any bot's depth, style, or blunder rate.
 */
import { BOTS, createGame, applyMove, chooseMove } from '../packages/engine/dist/index.js';

function seeded(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/0x100000000;};}

function match(a, b, games){
  let aw=0, bw=0, d=0;
  for(let g=0; g<games; g++){
    const random = seeded(g*7919+13);
    const aFirst = g%2===0;
    let st = createGame();
    while(st.status==='in_progress'){
      const aToMove = (st.turn===1)===aFirst;
      st = applyMove(st, chooseMove(aToMove?a:b, st, {random, timeBudgetMs:5000}));
    }
    if(st.status==='draw') d++;
    else if((st.winner===1)===aFirst) aw++; else bw++;
  }
  return {aw,bw,d};
}

const N = Number(process.argv[2] ?? 10);
for(let i=0;i<BOTS.length;i++){
  for(let j=i+1;j<BOTS.length;j++){
    const a=BOTS[i], b=BOTS[j];
    const r=match(b,a,N); // b is the stronger one
    console.log(`${b.name}(${b.rating}) vs ${a.name}(${a.rating}): ${r.aw}-${r.bw}-${r.d}  stronger win% ${(100*r.aw/N).toFixed(0)}%`);
  }
}
