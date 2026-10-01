import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  type ForwardedRef,
  type JSX,
} from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { PAGE_GLOBAL, type Active, type Command, type Message, type Theme } from "./bridge";
import { EDITOR_HTML } from "./editor-html";

export type { Active, Command, Theme } from "./bridge";

export type RichTextProps = {
  /** The text at the start. Later changes come through `send({ type: "setMarkdown" })`. */
  markdown: string;
  theme: Theme;
  /** The markdown, a moment after each change. */
  onChange?: (markdown: string) => void;
  /** What is active at the cursor, for a toolbar. */
  onActive?: (active: Active) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  /**
   * The page has loaded and shows the text. Until then the WebView is blank: show the
   * text some other way over it, the page takes a moment to parse.
   */
  onReady?: () => void;
  /** Opens the keyboard once the editor is ready. */
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
};

export type RichTextHandle = {
  /** A toolbar command, focus, blur, new text or a new theme (./bridge.ts). */
  send: (command: Command) => void;
};

// Only the page itself: the editor is one inline document and must load nothing else.
const PAGE_URL = "about:blank";

// A WYSIWYG markdown editor: Tiptap in a WebView, sized to its text so the screen around
// it scrolls. The page is embedded (./editor-html.ts) and reaches no network.
function RichTextInner(
  {
    markdown,
    theme,
    onChange,
    onActive,
    onFocus,
    onBlur,
    onReady,
    autoFocus,
    style,
  }: RichTextProps,
  ref: ForwardedRef<RichTextHandle>
): JSX.Element {
  const web = useRef<WebView>(null);
  const [height, setHeight] = useState(0);
  const shown = useRef(false);
  // The text and theme go into the page itself: it paints them right away, before the
  // round trip of "ready". `</` must not end the script early.
  const [html] = useState(() =>
    EDITOR_HTML.replace(
      "__INITIAL__",
      JSON.stringify({ markdown, theme, debug: __DEV__ }).replace(/<\//g, "<\\/")
    )
  );
  const mounted = useRef(Date.now());

  const send = useCallback((command: Command) => {
    web.current?.injectJavaScript(
      `window.${PAGE_GLOBAL} && window.${PAGE_GLOBAL}.send(${JSON.stringify(command)}); true;`
    );
  }, []);
  useImperativeHandle(ref, () => ({ send }), [send]);

  function receive(event: WebViewMessageEvent): void {
    let message: Message;
    try {
      message = JSON.parse(event.nativeEvent.data) as Message;
    } catch {
      return;
    }
    switch (message.type) {
      case "ready":
        if (__DEV__) {
          const t = message.timing;
          const ms = (n: number) => `${Math.round(n)} ms`;
          console.log(
            `expo-rich-text: ready in ${Date.now() - mounted.current} ms` +
              ` (webview up ${ms(t.page)}, drawn +${ms(t.drawn - t.page)},` +
              ` parse +${ms(t.parsed - t.drawn)}, editor +${ms(t.ready - t.parsed)})`
          );
        }
        if (autoFocus) send({ type: "focus" });
        break;
      case "change":
        onChange?.(message.markdown);
        break;
      case "active":
        onActive?.(message.active);
        break;
      case "height":
        setHeight(message.height);
        // The first height after the text went in: the page is on screen.
        if (!shown.current && message.height > 0) {
          shown.current = true;
          onReady?.();
        }
        break;
      case "focus":
        onFocus?.();
        break;
      case "blur":
        onBlur?.();
        break;
      case "debug":
        if (__DEV__) console.log(`expo-rich-text: ${message.text}`);
        break;
    }
  }

  return (
    <WebView
      ref={web}
      source={{ html }}
      originWhitelist={[PAGE_URL]}
      onShouldStartLoadWithRequest={(request) => request.url === PAGE_URL}
      onMessage={receive}
      onLoadStart={() => {
        if (__DEV__) console.log(`expo-rich-text: load started ${Date.now() - mounted.current} ms`);
      }}
      style={[{ height, backgroundColor: theme.background }, style]}
      scrollEnabled={false}
      bounces={false}
      hideKeyboardAccessoryView
      keyboardDisplayRequiresUserAction={false}
      setSupportMultipleWindows={false}
      allowsLinkPreview={false}
      allowsInlineMediaPlayback={false}
      dataDetectorTypes="none"
      cacheEnabled={false}
      javaScriptEnabled
      textInteractionEnabled
    />
  );
}

export const RichText = forwardRef(RichTextInner);
