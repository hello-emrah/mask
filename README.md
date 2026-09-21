# Mask

Hide text behind black bars in Obsidian with `||double pipes||`. The words stay in the file; only the view is masked. Made for screenshots and screen shares of notes whose record has to stay whole.

## How it works

- `||words||` renders as a solid bar in Live Preview and Reading view. Source mode always shows the raw text.
- Wikilinks inside a mask stay links, so the graph loses nothing.
- In Live Preview a mask the cursor is inside shows its raw text, so it can be edited. Click away before a screenshot.
- Table rows, code, maths, comments and frontmatter are left alone. The pipes must hug the words, like bold, so `|| this ||` is not a mask.
- A mask has to open and close inside one block. An unclosed `||` masks nothing.

## Commands

- **Mask or unmask selection.** Wraps the selection line by line, keeping list, task, heading and quote markers outside the pipes.
- **Show or hide masked text**, also on the ribbon. Always starts hidden; revealing is never remembered.

## What it is not

Not secrets management. The words are in the file, in the DOM and on the clipboard if copied out of Reading view. It masks the view and nothing else.

## Install

No build step, plain CommonJS. Copy `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/mask/` and enable Mask under Settings, Community plugins.

## Licence

MIT
