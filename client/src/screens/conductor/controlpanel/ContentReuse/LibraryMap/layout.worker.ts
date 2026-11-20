import { computeLayout, type LayoutInput, type LayoutOutput } from "./layout";

/** Lays the library map out off the main thread (see `runLayout`). */
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<LayoutInput>) => void) | null;
  postMessage: (message: LayoutOutput, transfer: Transferable[]) => void;
};

scope.onmessage = (event) => {
  const out = computeLayout(event.data);
  scope.postMessage(out, [out.x.buffer, out.y.buffer]);
};
