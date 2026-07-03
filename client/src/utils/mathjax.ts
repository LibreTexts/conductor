/**
 * MathJax v4 browser integration aligned with LibreTexts/shapeshift configuration.
 *
 * @see https://github.com/LibreTexts/shapeshift/blob/main/src/util/mathjax.ts
 * @see server/util/cxone-page-content-footer.html
 */

const MATHJAX_SCRIPT_URL =
  "https://cdn.jsdelivr.net/npm/mathjax@4/tex-mml-svg.js";

type MathJaxGlobal = {
  typesetPromise?: (elements?: HTMLElement[]) => Promise<void>;
  typesetClear?: (elements?: HTMLElement[]) => void;
  startup?: {
    ready?: () => void;
    defaultReady?: () => void;
    promise?: Promise<void>;
  };
};

declare global {
  interface Window {
    MathJax?: MathJaxGlobal;
    __libretextsMathJaxLoad?: Promise<void>;
  }
}

function getMathJaxConfig(): Record<string, unknown> {
  return {
    options: {
      ignoreHtmlClass: "tex2jax_ignore",
      processHtmlClass: "tex2jax_process",
      renderActions: {
        assistiveMml: [],
      },
      enableBraille: false,
    },
    output: {
      scale: 0.85,
      mtextInheritFont: false,
      displayOverflow: "linebreak",
      linebreaks: {
        width: "100%",
      },
    },
    chtml: {
      matchFontHeight: true,
    },
    tex: {
      tags: "none",
      macros: {
        eatSpaces: ["#1", 2, ["", " ", "\\endSpaces"]],
        mhchemrightleftharpoons: "{\\unicode{x21CC}\\,}",
        xrightleftharpoons: ["\\mhchemxrightleftharpoons[#1]{#2}", 2, ""],
      },
      packages: {
        "[+]": ["mhchem", "color", "cancel", "ams", "tagformat"],
      },
    },
    loader: {
      "[tex]/mhchem": {
        ready() {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mj = (globalThis as any).MathJax;
          const { MapHandler } = mj._.input.tex.MapHandler;
          const mhchem = MapHandler.getMap("mhchem-chars");
          mhchem.lookup("mhchemrightarrow")._char = "\uE42D";
          mhchem.lookup("mhchemleftarrow")._char = "\uE42C";
        },
      },
      load: ["[tex]/mhchem", "[tex]/color", "[tex]/cancel", "[tex]/tagformat"],
    },
  };
}

export function loadMathJax(): Promise<void> {
  console.debug("[MathJax] loadMathJax() called");
  if (window.__libretextsMathJaxLoad) {
    console.debug("[MathJax] Already loading/loaded, returning cached promise");
    return window.__libretextsMathJaxLoad;
  }

  window.__libretextsMathJaxLoad = new Promise((resolve, reject) => {
    if (window.MathJax?.typesetPromise) {
      resolve();
      return;
    }

    window.MathJax = {
      ...getMathJaxConfig(),
      startup: {
        ready: () => {
          window.MathJax?.startup?.defaultReady?.();
          console.debug("[MathJax] Loaded successfully");
          resolve();
        },
      },
    };

    const existingScript = document.getElementById("mathjax-script");
    if (existingScript) {
      console.debug("[MathJax] Script tag already exists, awaiting startup promise");
      window.MathJax?.startup?.promise?.then(resolve).catch(reject);
      return;
    }

    const script = document.createElement("script");
    script.id = "mathjax-script";
    script.src = MATHJAX_SCRIPT_URL;
    script.defer = true;
    script.onerror = () => {
      console.error("[MathJax] Failed to load script from", MATHJAX_SCRIPT_URL);
      reject(new Error("MathJax failed to load"));
    };
    console.debug("[MathJax] Injecting script tag...");
    document.head.appendChild(script);
  });

  return window.__libretextsMathJaxLoad;
}

export async function typesetMathElements(
  elements: HTMLElement[],
): Promise<void> {
  console.debug("[MathJax] typesetMathElements() called with", elements.length, "element(s)");
  await loadMathJax();
  await (window.MathJax?.startup?.promise ?? Promise.resolve());
  window.MathJax?.typesetClear?.(elements);
  await window.MathJax?.typesetPromise?.(elements);
}
