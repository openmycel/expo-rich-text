# expo-rich-text

A WYSIWYG markdown editor for Expo and React Native. [Tiptap](https://tiptap.dev) runs inside
a WebView from one embedded HTML page; the component around it sizes the page to its text,
sends toolbar commands in and gets markdown out. Headings, bullet and numbered lists, bold,
italic, strikethrough, underline, code blocks and links: a typed or pasted URL
becomes one, and `[text](url)` in the markdown stays one. Pasted text that looks like markdown
(a heading, list or fence at a line start, a bold, strike, underline or link mark) is parsed;
anything else pastes as plain text. The page loads nothing and reaches no
network: it is a string in the package, with a Content Security Policy of `default-src 'none'`.

Built for [OpenMycel](https://github.com/openmycel/openmycel), a private assistant that works
offline. Tiptap has no React Native build of its own (ProseMirror needs the browser's DOM), so
this is the bridge.

**Status:** early. Tested on iOS; Android untested.

![A note in the editor: headings, lists, bold, underline, strikethrough and a link, with the toolbar below](https://raw.githubusercontent.com/openmycel/expo-rich-text/main/docs/preview.webp)

## Install

Needs `react-native-webview` 13+. In an Expo app:

```sh
npx expo install react-native-webview
npm install @openmycel/expo-rich-text
```

## Usage

```tsx
import { RichText, type Active, type RichTextHandle } from "@openmycel/expo-rich-text";

const editor = useRef<RichTextHandle>(null);
const [active, setActive] = useState<Active | null>(null);

<RichText
  ref={editor}
  markdown={note.body}
  theme={{ color: "#fff", background: "#000", muted: "#8e8e93", fontSize: 17, lineHeight: 24 }}
  onChange={(markdown) => save(markdown)}
  onActive={setActive}
/>;

// A toolbar button:
editor.current?.send({ type: "heading", level: 2 });
```

| Prop                 | What it does                                                                       |
| -------------------- | ---------------------------------------------------------------------------------- |
| `markdown`           | The text at the start. Later changes go through `send({ type: "setMarkdown" })`.   |
| `theme`              | Colors, type size and line height as the page's CSS; `placeholder` for empty text. |
| `onChange`           | The markdown, 150 ms after the last keystroke.                                     |
| `onActive`           | What is active at the cursor: heading level, list, bold… — for a toolbar's state.  |
| `onFocus` / `onBlur` | The keyboard came up or went away.                                                 |
| `onReady`            | The page shows the text; until then the WebView is blank, show the text yourself.  |
| `autoFocus`          | Opens the keyboard once the editor is ready.                                       |

`send(command)` on the ref takes `heading` (levels 1–3), `bulletList`, `orderedList`, `bold`,
`italic`, `strike`, `underline`, `codeBlock`, `undo`, `redo`, `focus`, `blur`, `setMarkdown` and
`theme`. Every message between the two sides is typed in `src/bridge.ts`.

## How it is built

`web/editor.ts` sets up Tiptap from the official extension packages, one per feature, with
`@tiptap/extensions` (placeholder, undo and redo) and `@tiptap/markdown`; `scripts/build-web.mjs` bundles it with esbuild into
`src/editor-html.ts`, a single HTML string the WebView loads from memory. Markdown in and out
is Tiptap's own, so what the editor saves is plain markdown another tool can read; the one
Tiptap-specific mark is underline, written as `++text++`.

```sh
npm run build:web   # web/ → src/editor-html.ts
npm run build       # the page, then the TypeScript build
npm run typecheck
```

## Credits

The editor page bundles [Tiptap](https://github.com/ueberdosis/tiptap) by Tiptap GmbH and
contributors, [ProseMirror](https://prosemirror.net) by Marijn Haverbeke and others,
[marked](https://github.com/markedjs/marked) by Christopher Jeffrey and MarkedJS, and
[linkifyjs](https://github.com/nfrasser/linkifyjs) by Nick Frasser; all MIT. Their license texts
are in [THIRD-PARTY-LICENSES.md](THIRD-PARTY-LICENSES.md), generated from what the bundle
actually contains, and ship with the package. Tiptap is a trademark of its owners; this package
is not affiliated with them.

## Author and license

Created by Nikita MRCS — [@nmrcs](https://github.com/nmrcs). Contributors are
credited in the git history.

MIT.
