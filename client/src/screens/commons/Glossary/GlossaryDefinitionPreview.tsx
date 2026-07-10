import { useEffect, useRef } from "react";
import { typesetMathElements } from "../../../utils/mathjax";

interface GlossaryDefinitionPreviewProps {
  definition: string;
  className?: string;
}

const GlossaryDefinitionPreview = ({
  definition,
  className,
}: GlossaryDefinitionPreviewProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !definition) return;

    el.innerHTML = definition;

    typesetMathElements([el]).catch((err) =>
      console.error("MathJax typeset failed:", err),
    );
  }, [definition]);

  if (!definition) return null;

  return (
    <div
      ref={ref}
      className={`glossary-definition-preview prose max-w-none${className ? ` ${className}` : ""}`}
    />
  );
};

export default GlossaryDefinitionPreview;
