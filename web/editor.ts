// The editor page: Tiptap (ProseMirror) in the WebView. It talks to the native side only
// through postMessage and the `richText` global (../src/bridge.ts); it loads nothing and
// stores nothing.

import { Editor } from "@tiptap/core";
import { Bold } from "@tiptap/extension-bold";
import { CodeBlock } from "@tiptap/extension-code-block";
import { Document } from "@tiptap/extension-document";
import { HardBreak } from "@tiptap/extension-hard-break";
import { Heading } from "@tiptap/extension-heading";
import { Italic } from "@tiptap/extension-italic";
import { Link } from "@tiptap/extension-link";
import { BulletList, ListItem, ListKeymap, OrderedList } from "@tiptap/extension-list";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Strike } from "@tiptap/extension-strike";
import { Text } from "@tiptap/extension-text";
import { Underline } from "@tiptap/extension-underline";
import { Placeholder, TrailingNode, UndoRedo } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import { PAGE_GLOBAL, type Active, type Command, type Message, type Theme } from "../src/bridge";

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage(message: string): void };
    /** Put into the page by the component before any script runs. */
    __initial?: { markdown: string; theme: Theme; debug?: boolean };
  }
}

function post(message: Message): void {
  window.ReactNativeWebView?.postMessage(JSON.stringify(message));
}

// This runs once the bundle has parsed: the gap after `drawn` is the parse.
const parsed = performance.now();
let placeholder = "";
const initial = window.__initial;
if (initial) applyTheme(initial.theme, false);

// The element may hold the prerendered text (./prerender.ts); the editor replaces it.
const element = document.getElementById("editor")!;
element.innerHTML = "";

const editor = new Editor({
  element,
  // Only what the editor offers, instead of StarterKit: it would bundle blockquote, the
  // horizontal rule and the drop and gap cursors even when turned off.
  extensions: [
    Document,
    Paragraph,
    Text,
    HardBreak,
    Heading.configure({ levels: [1, 2, 3] }),
    Bold,
    Italic,
    Strike,
    Underline,
    CodeBlock,
    // A typed or pasted URL becomes a link; a tap on it moves the caret, nothing opens:
    // the page cannot navigate (../src/index.tsx) and the editor is for editing.
    Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
    BulletList,
    OrderedList,
    ListItem,
    ListKeymap,
    UndoRedo,
    TrailingNode,
    Markdown,
    Placeholder.configure({ placeholder: () => placeholder }),
  ],
  content: initial?.markdown ?? "",
  contentType: "markdown",
  editorProps: {
    // Pasted markdown is parsed, not shown with its markers; plain text pastes as is.
    handlePaste: (_view, event) => {
      const text = event.clipboardData?.getData("text/plain") ?? "";
      if (!looksLikeMarkdown(text)) return false;
      editor.commands.insertContent(text, { contentType: "markdown" });
      return true;
    },
  },
  onUpdate: () => scheduleChange(),
  onSelectionUpdate: () => post({ type: "active", active: active() }),
  onFocus: () => post({ type: "focus" }),
  onBlur: () => post({ type: "blur" }),
});

// A heading, list item or fence at a line start, or a bold, strike, underline or link mark.
const MARKDOWN = /^(#{1,3} |[-*] |\d+\. |```)|\*\*\S|~~\S|\+\+\S|\[[^\]]+\]\(https?:/m;
function looksLikeMarkdown(text: string): boolean {
  return MARKDOWN.test(text);
}

function active(): Active {
  const heading = ([1, 2, 3] as const).find((level) => editor.isActive("heading", { level }));
  return {
    heading: heading ?? 0,
    bulletList: editor.isActive("bulletList"),
    orderedList: editor.isActive("orderedList"),
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    strike: editor.isActive("strike"),
    underline: editor.isActive("underline"),
    codeBlock: editor.isActive("codeBlock"),
  };
}

// The text goes out a moment after the last keystroke, not on every one.
let changeTimer = 0;
function scheduleChange(): void {
  clearTimeout(changeTimer);
  changeTimer = window.setTimeout(() => {
    post({ type: "change", markdown: editor.getMarkdown() });
    post({ type: "active", active: active() });
  }, 150);
}

function applyTheme(theme: Theme, live = true): void {
  const root = document.documentElement.style;
  root.setProperty("--color", theme.color);
  root.setProperty("--background", theme.background);
  root.setProperty("--muted", theme.muted);
  root.setProperty("--font-size", `${theme.fontSize}px`);
  root.setProperty("--line-height", `${theme.lineHeight}px`);
  root.setProperty("--font-family", theme.fontFamily ?? "-apple-system, system-ui, sans-serif");
  if (theme.placeholder !== undefined) {
    placeholder = theme.placeholder;
    if (live) editor.view.dispatch(editor.state.tr);
  }
}

function send(command: Command): void {
  const chain = editor.chain().focus();
  switch (command.type) {
    case "heading":
      chain.toggleHeading({ level: command.level }).run();
      break;
    case "bulletList":
      chain.toggleBulletList().run();
      break;
    case "orderedList":
      chain.toggleOrderedList().run();
      break;
    case "bold":
      chain.toggleBold().run();
      break;
    case "italic":
      chain.toggleItalic().run();
      break;
    case "strike":
      chain.toggleStrike().run();
      break;
    case "underline":
      chain.toggleUnderline().run();
      break;
    case "codeBlock":
      chain.toggleCodeBlock().run();
      break;
    case "undo":
      chain.undo().run();
      break;
    case "redo":
      chain.redo().run();
      break;
    case "focus":
      editor.commands.focus("end");
      break;
    case "blur":
      editor.commands.blur();
      break;
    case "setMarkdown":
      editor.commands.setContent(command.markdown, { contentType: "markdown", emitUpdate: false });
      break;
    case "theme":
      applyTheme(command.theme);
      break;
  }
  post({ type: "active", active: active() });
}

// The page's height follows the text, so the native side sizes the WebView to it and the
// screen around scrolls, not the page.
new ResizeObserver(() => {
  post({ type: "height", height: document.documentElement.scrollHeight });
}).observe(document.body);

// Development: every touch and selection change goes to the native log, with timing, so
// a stray selection can be traced to the gesture that made it.
if (initial?.debug) {
  const started = performance.now();
  const at = () => `${Math.round(performance.now() - started)}ms`;
  const log = (text: string) => post({ type: "debug", text });
  let touchStart = 0;
  document.addEventListener("touchstart", (e) => {
    touchStart = performance.now();
    log(`${at()} touchstart x${e.touches.length}`);
  });
  document.addEventListener("touchend", () =>
    log(`${at()} touchend after ${Math.round(performance.now() - touchStart)}ms`)
  );
  document.addEventListener("touchcancel", () => log(`${at()} touchcancel`));
  document.addEventListener("selectionchange", () => {
    const sel = document.getSelection();
    const text = sel?.toString() ?? "";
    log(`${at()} selection ${sel?.type ?? "none"}${text ? ` "${text.slice(0, 30)}"` : ""}`);
  });
  document.addEventListener("focusin", () => log(`${at()} focusin`));
  document.addEventListener("focusout", () => log(`${at()} focusout`));
}

(window as unknown as Record<string, unknown>)[PAGE_GLOBAL] = { send };
post({
  type: "ready",
  timing: { ...(window.__timing ?? { page: 0, drawn: 0 }), parsed, ready: performance.now() },
});
