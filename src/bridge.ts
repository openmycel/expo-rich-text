// What the editor page and the native side say to each other. The page runs Tiptap in a
// WebView; React Native drives it with commands and listens for the text. Shared by
// src/ (the component) and web/ (the page), so both sides agree on every message.

/** Marks and nodes the toolbar can toggle. */
export type Command =
  | { type: "heading"; level: 1 | 2 | 3 }
  | { type: "bulletList" }
  | { type: "orderedList" }
  | { type: "bold" }
  | { type: "italic" }
  | { type: "strike" }
  | { type: "underline" }
  | { type: "codeBlock" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "focus" }
  | { type: "blur" }
  /** Replaces the whole text. */
  | { type: "setMarkdown"; markdown: string }
  /** Colors and type, as CSS values. */
  | { type: "theme"; theme: Theme };

export type Theme = {
  color: string;
  background: string;
  /** Muted color for the placeholder and code background tint. */
  muted: string;
  fontSize: number;
  lineHeight: number;
  /** A CSS font-family list; the system font by default. */
  fontFamily?: string;
  /** Shown in an empty editor. */
  placeholder?: string;
};

/** What is active at the cursor, for the toolbar's state. */
export type Active = {
  heading: 0 | 1 | 2 | 3;
  bulletList: boolean;
  orderedList: boolean;
  bold: boolean;
  italic: boolean;
  strike: boolean;
  underline: boolean;
  codeBlock: boolean;
};

/** Milliseconds since the page started, for the development log. */
export type Timing = {
  /** The first script ran: the WebView was up and had the page. */
  page: number;
  /** The text was drawn by the prerender script. */
  drawn: number;
  /** The editor bundle had parsed and started. */
  parsed: number;
  /** The editor was up. */
  ready: number;
};

export type Message =
  | { type: "ready"; timing: Timing }
  | { type: "change"; markdown: string }
  | { type: "active"; active: Active }
  | { type: "height"; height: number }
  | { type: "focus" }
  | { type: "blur" }
  /** Development only: touches and selection changes, for the log. */
  | { type: "debug"; text: string };

/** The page's global the native side calls: `window.richText.send(command)`. */
export const PAGE_GLOBAL = "richText";
