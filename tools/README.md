# tools

Developer-only Node scripts. Not loaded by the game.

`detour.js` exports its pure internals (geometry, generation, scoring,
copy) when required in Node — the browser-touching code is gated behind a
`typeof window` check, so importing it doesn't try to read the DOM.

## eval-generation.js

Runs `generateBest` N times per difficulty and reports pair count,
crossings, and obstacle count distributions.

```
node tools/eval-generation.js          # 100 per difficulty
node tools/eval-generation.js 500      # 500 per difficulty
```

A healthy run has `pairCount min == target` for every row.
