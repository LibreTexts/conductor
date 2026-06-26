import { useEffect, useRef } from "react";
import { typesetMathElements } from "../../../utils/mathjax";

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

    el.innerHTML = definition;

    console.log("[MathJax] GlossaryDefinitionPreview: calling typesetMathElements, definition length:", definition.length);
    typesetMathElements([el]).catch((err) =>
      console.error("MathJax typeset failed:", err),
    );
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
