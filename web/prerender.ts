// Runs before the editor's bundle has even parsed: draws the text once with marked (the
// same parser @tiptap/markdown uses) in the editor's CSS, so the note is on screen in the
// first frame. The editor then takes the element over. Raw HTML in the text is shown as
// text here: this is a drawing, not the editor.

import { marked } from "marked";

declare global {
  interface Window {
    /** Set here, read by the editor script: ../src/bridge.ts Timing. */
    __timing?: { page: number; drawn: number };
  }
}

const page = performance.now();
const initial = window.__initial;
const element = document.getElementById("editor");
if (initial && element && initial.markdown) {
  // Underline is Tiptap's own `++text++`, which marked does not know.
  const safe = initial.markdown.replace(/</g, "&lt;").replace(/\+\+([^+\n]+)\+\+/g, "<u>$1</u>");
  element.innerHTML = `<div class="tiptap ProseMirror">${marked.parse(safe, { async: false })}</div>`;
  window.ReactNativeWebView?.postMessage(
    JSON.stringify({ type: "height", height: document.documentElement.scrollHeight })
  );
}
window.__timing = { page, drawn: performance.now() };
