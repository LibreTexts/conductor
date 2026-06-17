import { useEffect, useRef } from "react";

type MathJaxGlobal = {
  tex?: {
    inlineMath?: string[][];
    displayMath?: string[][];
  };
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
    __glossaryMathJaxLoad?: Promise<void>;
  }
}

function loadMathJax(): Promise<void> {
  if (window.__glossaryMathJaxLoad) return window.__glossaryMathJaxLoad;

  window.__glossaryMathJaxLoad = new Promise((resolve, reject) => {
    if (window.MathJax?.typesetPromise) {
      resolve();
      return;
    }

    window.MathJax = {
      tex: {
        inlineMath: [["\\(", "\\)"]],
        displayMath: [["\\[", "\\]"]],
      },
      startup: {
        ready: () => {
          window.MathJax?.startup?.defaultReady?.();
          resolve();
        },
      },
    };

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js";
    script.async = true;
    script.onerror = () => reject(new Error("MathJax failed to load"));
    document.head.appendChild(script);
  });

  return window.__glossaryMathJaxLoad;
}

interface GlossaryDefinitionPreviewProps {
  definition: string;
}

const GlossaryDefinitionPreview = ({
  definition,
}: GlossaryDefinitionPreviewProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !definition) return;

    el.textContent = `${definition}`;

    loadMathJax()
      .then(() => window.MathJax?.startup?.promise ?? Promise.resolve())
      .then(() => {
        window.MathJax?.typesetClear?.([el]);
        return window.MathJax?.typesetPromise?.([el]);
      })
      .catch((err) => console.error("MathJax typeset failed:", err));
  }, [definition]);

  if (!definition) return null;

  return (
    <div
      ref={ref}
      className="glossary-definition-preview prose max-w-none text-xs"
    />
  );
};

export default GlossaryDefinitionPreview;
