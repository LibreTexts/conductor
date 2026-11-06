import { useEffect, useRef } from "react";
import DOMPurify from "dompurify";
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

    // Server-side ingestion (manual add, CSV import, Pressbooks/CXOne sync)
    // already strips markup from term/definition, but this is the actual
    // innerHTML sink — sanitize here too so a bad value can never reach it,
    // regardless of how or when it was written.
    el.innerHTML = DOMPurify.sanitize(definition, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    });

    // Deliberately silent: if MathJax can't load or typeset, the definition
    // simply shows its raw TeX, which is still readable.
    typesetMathElements([el]).catch(() => {});
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
