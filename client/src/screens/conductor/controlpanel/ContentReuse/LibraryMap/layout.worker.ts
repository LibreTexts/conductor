import { computeLayout, type LayoutInput, type LayoutWorkerMessage } from "./layout";

/** Lays the library map out off the main thread (see `runLayout`). */
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<LayoutInput>) => void) | null;
  postMessage: (message: LayoutWorkerMessage, transfer?: Transferable[]) => void;
};

scope.onmessage = (event) => {
  const out = computeLayout(event.data, (done) => scope.postMessage({ type: "progress", done }));
  scope.postMessage({ type: "done", out }, [out.x.buffer, out.y.buffer]);
};
