/*
 * Mask
 *
 * Text between ||double pipes|| renders as a solid bar in Live Preview and
 * Reading view. The words are never changed in the file, so the record stays
 * whole; only the view is masked. Source mode always shows the raw text.
 *
 * Plain CommonJS, no build step. Edit this file and reload the plugin.
 */

const { Plugin, Notice, setIcon, editorLivePreviewField } = require('obsidian');
const { ViewPlugin, Decoration } = require('@codemirror/view');
const { RangeSetBuilder } = require('@codemirror/state');
const { syntaxTree } = require('@codemirror/language');

const DELIM = '||';
// Like bold: the pipes must hug the words, so a stray || does not start a mask.
const LINE_RE = /\|\|(?!\s)(.+?)(?<!\s)\|\|/g;
const TABLE_ROW_RE = /^\s*\|/;
const SKIP_NODE_RE = /code|math|frontmatter|comment/i;
const SKIP_READING = 'code, pre, .math, .frontmatter, .mask-bar';
const BLOCK_SEL = 'p, li, h1, h2, h3, h4, h5, h6, td, th, dd, dt, .callout-title-inner, div';
// List, task, heading and quote markers stay outside the pipes.
const MARKER_RE = /^(\s*(?:(?:[-*+]|\d+[.)])\s+(?:\[.\]\s+)?|#{1,6}\s+|>\s*)*)/;

/* ---------- Live Preview ---------- */

function buildDecorations(view) {
  const { state } = view;
  // In Source mode the field is false. It is only undefined outside Obsidian's own editors.
  if (state.field(editorLivePreviewField, false) === false) return Decoration.none;

  const builder = new RangeSetBuilder();
  const tree = syntaxTree(state);
  const selection = state.selection.ranges;

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = state.doc.lineAt(pos);
      if (!TABLE_ROW_RE.test(line.text) && line.text.includes(DELIM)) {
        LINE_RE.lastIndex = 0;
        let m;
        while ((m = LINE_RE.exec(line.text)) !== null) {
          const start = line.from + m.index;
          const end = start + m[0].length;
          const name = tree.resolveInner(start + DELIM.length, 1).type.name || '';
          if (SKIP_NODE_RE.test(name)) continue;
          // With the cursor inside, show the raw text so it can be edited.
          if (selection.some((r) => r.from <= end && r.to >= start)) continue;
          builder.add(start, start + DELIM.length, Decoration.replace({}));
          builder.add(start + DELIM.length, end - DELIM.length, Decoration.mark({ class: 'mask-bar' }));
          builder.add(end - DELIM.length, end, Decoration.replace({}));
        }
      }
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

const maskExtension = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = buildDecorations(view);
    }
    update(update) {
      const modeChanged =
        update.startState.field(editorLivePreviewField, false) !==
        update.state.field(editorLivePreviewField, false);
      if (update.docChanged || update.viewportChanged || update.selectionSet || modeChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);

/* ---------- Reading view ---------- */

function maskRendered(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) {
    if (n.parentElement && n.parentElement.closest(SKIP_READING)) continue;
    nodes.push(n);
  }

  // Pass one: work out what to mask without touching the DOM. A mask only
  // counts once its closing pipes are found inside the same block.
  const plan = new Map(); // text node -> [{ start, end, type }]
  const add = (node, part) => {
    if (!plan.has(node)) plan.set(node, []);
    plan.get(node).push(part);
  };

  let open = false;
  let openBlock = null;
  let pending = [];

  for (const node of nodes) {
    const text = node.nodeValue;
    const block = node.parentElement ? node.parentElement.closest(BLOCK_SEL) : null;
    if (open && block !== openBlock) {
      open = false;
      pending = [];
    }

    let cursor = 0;
    let idx = text.indexOf(DELIM, cursor);
    while (idx !== -1) {
      if (!open) {
        const next = text[idx + DELIM.length];
        if (next === undefined || !/\s/.test(next)) {
          open = true;
          openBlock = block;
          pending = [{ node, start: idx, end: idx + DELIM.length, type: 'delim' }];
          cursor = idx + DELIM.length;
        }
      } else {
        const prev = idx > 0 ? text[idx - 1] : undefined;
        if (prev === undefined || !/\s/.test(prev)) {
          if (idx > cursor) pending.push({ node, start: cursor, end: idx, type: 'mask' });
          pending.push({ node, start: idx, end: idx + DELIM.length, type: 'delim' });
          for (const p of pending) add(p.node, p);
          pending = [];
          open = false;
        }
      }
      idx = text.indexOf(DELIM, idx + DELIM.length);
    }
    // Still open at the end of this node: the rest of it is masked, if the pipes close later.
    if (open && cursor < text.length) {
      pending.push({ node, start: cursor, end: text.length, type: 'mask' });
    }
  }

  // Pass two: rebuild each touched text node.
  for (const [node, parts] of plan) {
    const text = node.nodeValue;
    parts.sort((a, b) => a.start - b.start);
    const frag = document.createDocumentFragment();
    let at = 0;
    for (const part of parts) {
      if (part.start > at) frag.appendChild(document.createTextNode(text.slice(at, part.start)));
      if (part.type === 'mask') {
        const span = document.createElement('span');
        span.className = 'mask-bar';
        span.textContent = text.slice(part.start, part.end);
        frag.appendChild(span);
      }
      at = part.end;
    }
    if (at < text.length) frag.appendChild(document.createTextNode(text.slice(at)));
    node.parentNode.replaceChild(frag, node);
  }
}

/* ---------- Commands ---------- */

function toggleMaskOnSelection(editor) {
  const sel = editor.getSelection();
  if (!sel || !sel.trim()) {
    new Notice('Mask: select some text first.');
    return;
  }
  const lines = sel.split('\n');
  const allMasked = lines
    .filter((l) => l.trim())
    .every((l) => {
      const body = l.replace(MARKER_RE, '').trim();
      return body.startsWith(DELIM) && body.endsWith(DELIM) && body.length > DELIM.length * 2;
    });

  const out = lines.map((l) => {
    if (!l.trim()) return l;
    const marker = (l.match(MARKER_RE) || [''])[0];
    const rest = l.slice(marker.length);
    const lead = (rest.match(/^\s*/) || [''])[0];
    const trail = (rest.match(/\s*$/) || [''])[0];
    const body = rest.slice(lead.length, rest.length - trail.length);
    if (!body) return l;
    if (allMasked) return marker + lead + body.slice(DELIM.length, -DELIM.length) + trail;
    return marker + lead + DELIM + body + DELIM + trail;
  });
  editor.replaceSelection(out.join('\n'));
}

/* ---------- Plugin ---------- */

module.exports = class MaskPlugin extends Plugin {
  onload() {
    // Always start masked. Revealing is a deliberate act and never remembered.
    this.revealed = false;
    document.body.classList.remove('mask-reveal');

    // Exposed so both halves can be tested from the console without a note.
    this.extension = maskExtension;
    this.maskRendered = maskRendered;
    this.registerEditorExtension(maskExtension);
    this.registerMarkdownPostProcessor((el) => maskRendered(el));

    this.ribbon = this.addRibbonIcon('eye-off', 'Mask: show or hide masked text', () => this.toggleReveal());

    this.addCommand({
      id: 'toggle-reveal',
      name: 'Show or hide masked text',
      callback: () => this.toggleReveal(),
    });

    this.addCommand({
      id: 'mask-selection',
      name: 'Mask or unmask selection',
      editorCallback: (editor) => toggleMaskOnSelection(editor),
    });
  }

  toggleReveal() {
    this.revealed = !this.revealed;
    document.body.classList.toggle('mask-reveal', this.revealed);
    if (this.ribbon) setIcon(this.ribbon, this.revealed ? 'eye' : 'eye-off');
    new Notice(this.revealed ? 'Mask: revealed' : 'Mask: hidden');
  }

  onunload() {
    document.body.classList.remove('mask-reveal');
  }
};
