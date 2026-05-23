#!/usr/bin/env node
/*
 * Run generateBest() N times per difficulty and report distributions.
 * Useful for sanity-checking generator changes.
 *
 *   node tools/eval-generation.js [N]
 *
 * Default N = 100.
 */

const path = require('path');
const { generateBest, CFG } = require(path.join(__dirname, '..', 'detour.js'));

const N = parseInt(process.argv[2] || '100', 10);
const difficulties = [3, 5, 6, 8];

const avg = a => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2);
const min = a => Math.min(...a);
const max = a => Math.max(...a);

console.log(`Generating ${N} levels per difficulty\n`);
console.log('p   target  pairCount       crossings        obstacles  trivial%');
console.log('--- ------  --------------  ---------------  ---------  --------');
for (const p of difficulties) {
  const pc = [], cr = [], obs = [], triv = [];
  const pool = CFG[p].shapes;
  for (let i = 0; i < N; i++) {
    const kind = pool[(Math.random() * pool.length) | 0];
    const r = generateBest(p, kind);
    pc.push(r.pairCount);
    cr.push(r.cross);
    obs.push(r.shape.obstacles ? r.shape.obstacles.length : 0);
    triv.push(r.trivial ? 1 : 0);
  }
  const pad = (s, n) => String(s).padEnd(n);
  const pctTriv = ((triv.reduce((x, y) => x + y, 0) / triv.length) * 100).toFixed(1);
  console.log(
    pad(p, 3) + ' ' +
    pad(p, 6) + '  ' +
    pad(`avg=${avg(pc)} min=${min(pc)}`, 14) + '  ' +
    pad(`avg=${avg(cr)} max=${max(cr)}`, 15) + '  ' +
    pad(`avg=${avg(obs)}`, 9) + '  ' +
    `${pctTriv}%`
  );
}
