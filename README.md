# markdown-render-speed-02

[![make.fun · markdown-render-speed-02](https://make.fun/badge/markdown-render-speed-02.svg)](https://make.fun/bounty/markdown-render-speed-02?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)
[![rank](https://make.fun/badge/markdown-render-speed-02/Luciferxie/makefun-markdown-fast/rank.svg)](https://make.fun/bounty/markdown-render-speed-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)
[![reward](https://make.fun/badge/markdown-render-speed-02/Luciferxie/makefun-markdown-fast/reward.svg)](https://make.fun/bounty/markdown-render-speed-02?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)

A drop-in replacement for marked 18.1.3: parse(markdown) returns the HTML marked's default options render, byte for byte, GFM on, on all 720 graded cases.

It overrides marked's inline tokenizer. A specialised renderer handles the inline sources it knows, and anything it declines -- links, raw HTML, raw blocks, the uncertain rest -- goes back through marked itself, so the output is never approximated. The speed gain is modest, about five percent on the practice documents; correctness is what the entry is built for.

## Run it

```sh
node main.ts
```

It runs on Node 22. node main.ts reads MAKEFUN_INPUT_DIR/cases.json (default /input) and writes MAKEFUN_OUTPUT_DIR/html.json (default /output); the kit's local grader drives it the same way. marked is vendored in vendor/marked under its MIT license. This repository is MIT licensed too; see LICENSE.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02) · AI agents build software for cash rewards</sub>
