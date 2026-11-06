import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { ActivityDisplayOptions, EditorSavedContent } from "../../../types";

/**
 * Conductor's side of the editor protocol with the H5P service's editor page
 * (H5P_AUTHORING_DESIGN.md, section 3). The editor runs in an iframe served by
 * the H5P service; everything crosses postMessage, checked against that
 * service's origin and the iframe's own window.
 */

export type EditorSaved = EditorSavedContent & {
  contentId: string;
  displayOptions?: ActivityDisplayOptions;
};

export class EditorSaveError extends Error {
  constructor(readonly reason: string, readonly status?: number) {
    super(`Editor save failed: ${reason}`);
  }
}

type Pending = {
  resolve: (saved: EditorSaved) => void;
  reject: (err: EditorSaveError) => void;
  timer: ReturnType<typeof setTimeout>;
};

/** A save that has not answered in this long is reported as failed. */
const SAVE_TIMEOUT_MS = 90_000;

export function useEditorBridge({
  iframeRef,
  editorOrigin,
  fetchToken,
}: {
  iframeRef: RefObject<HTMLIFrameElement>;
  editorOrigin?: string;
  /** Returns a fresh token for whatever the screen is editing right now. */
  fetchToken: () => Promise<string>;
}) {
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState<string>("");
  const [dirty, setDirty] = useState(false);
  const [height, setHeight] = useState<number | null>(null);
  const [displayOptions, setDisplayOptions] = useState<ActivityDisplayOptions | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTokenRef = useRef(fetchToken);
  fetchTokenRef.current = fetchToken;
  const pending = useRef(new Map<string, Pending>());

  const post = useCallback(
    (message: Record<string, unknown>) => {
      if (!editorOrigin) return;
      iframeRef.current?.contentWindow?.postMessage(message, editorOrigin);
    },
    [editorOrigin, iframeRef]
  );

  const sendToken = useCallback((token: string) => post({ type: "token", token }), [post]);

  const sendFreshToken = useCallback(async () => {
    try {
      sendToken(await fetchTokenRef.current());
    } catch {
      setError("token");
    }
  }, [sendToken]);

  useEffect(() => {
    if (!editorOrigin) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== editorOrigin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      const m = event.data;
      if (!m || typeof m !== "object") return;
      switch (m.type) {
        case "ready":
        case "token-expiring":
          void sendFreshToken();
          break;
        case "loaded":
          setLoaded(true);
          if (typeof m.title === "string") setTitle(m.title);
          if (m.displayOptions) setDisplayOptions(m.displayOptions);
          break;
        case "title":
          if (typeof m.title === "string") setTitle(m.title);
          break;
        case "dirty":
          setDirty(Boolean(m.dirty));
          break;
        case "height":
          if (typeof m.height === "number" && m.height > 0) setHeight(m.height);
          break;
        case "saved": {
          const p = pending.current.get(m.requestId);
          if (!p) break;
          clearTimeout(p.timer);
          pending.current.delete(m.requestId);
          setDirty(false);
          if (m.displayOptions) setDisplayOptions(m.displayOptions);
          p.resolve(m as EditorSaved);
          break;
        }
        case "save-failed": {
          const p = pending.current.get(m.requestId);
          if (!p) break;
          clearTimeout(p.timer);
          pending.current.delete(m.requestId);
          p.reject(new EditorSaveError(String(m.reason ?? "unknown"), m.status));
          break;
        }
        case "error":
          setError(String(m.reason ?? "unknown"));
          break;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [editorOrigin, iframeRef, sendFreshToken]);

  // Reject anything still waiting if the screen goes away.
  useEffect(() => {
    const waiting = pending.current;
    return () => {
      waiting.forEach((p) => {
        clearTimeout(p.timer);
        p.reject(new EditorSaveError("unmounted"));
      });
      waiting.clear();
    };
  }, []);

  /** Asks the editor to validate and save; resolves with what it saved. */
  const save = useCallback(
    (options?: ActivityDisplayOptions) =>
      new Promise<EditorSaved>((resolve, reject) => {
        const requestId = crypto.randomUUID();
        const timer = setTimeout(() => {
          pending.current.delete(requestId);
          reject(new EditorSaveError("timeout"));
        }, SAVE_TIMEOUT_MS);
        pending.current.set(requestId, { resolve, reject, timer });
        post({ type: "save", requestId, ...(options ? { displayOptions: options } : {}) });
      }),
    [post]
  );

  return { loaded, title, dirty, height, displayOptions, error, save, sendToken };
}
