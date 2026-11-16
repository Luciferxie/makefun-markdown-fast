# markdown-render-speed-02

A drop-in replacement for marked 18.1.3. The parse(markdown) function returns byte-identical HTML with marked's default options.

It uses a specialised inline renderer for inputs it handles and sends anything uncertain to marked, so output is never approximated.

Run with Node 22 using node main.ts. It reads MAKEFUN_INPUT_DIR/cases.json (default /input) and writes MAKEFUN_OUTPUT_DIR/html.json (default /output).

MIT licensed; see LICENSE.
