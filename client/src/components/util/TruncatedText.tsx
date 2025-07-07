import classNames from "classnames";
import { useEffect, useRef, useState } from "react";

interface TruncatedTextProps {
  text?: string | null; // If null or undefined, an empty string will be displayed
  maxLines: number;
  className?: string;
  lineHeight?: number; // Optional line-height for better control
  preciseTruncation?: boolean; // Whether to use precise truncation with binary search
}

/**
 * Re-usable component that truncates text to a specified number of lines using CSS.
 * @param {string} text - The text to display.
 * @param {number} maxLines - The maximum number of lines to display before truncating
 * @param {string} className - Optional additional CSS classes to apply.
 * @param {number} lineHeight - Optional line-height to control the height of each line (default is 20).
 * @param {boolean} preciseTruncation - Whether to use precise truncation with binary search (default is false).
 * @returns {JSX.Element} - A div containing the truncated text.
 *
 */
const TruncatedText: React.FC<TruncatedTextProps> = ({
  text,
  maxLines,
  className = "",
  lineHeight = 20,
  preciseTruncation = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [displayText, setDisplayText] = useState(text);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const truncateText = () => {
      if (!containerRef.current || !textRef.current) return;

      const textElement = textRef.current;
      const maxHeight = maxLines * lineHeight;

      // Reset to original text
      textElement.textContent = text || "";

      // Check if truncation is needed
      if (textElement.scrollHeight <= maxHeight) {
        setDisplayText(text);
        setIsTruncated(false);
        return;
      }

      setIsTruncated(true);

      if (!preciseTruncation) {
        // Simple truncation - just hide overflow
        setDisplayText(text);
        return;
      }

      // Precise truncation using binary search
      const words = text?.split(" ")|| [];
      let left = 0;
      let right = words.length;
      let bestFit = "";

      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const testText = words.slice(0, mid).join(" ");

        textElement.textContent = testText + "...";

        if (textElement.scrollHeight <= maxHeight) {
          bestFit = testText;
          left = mid + 1;
        } else {
          right = mid - 1;
        }
      }

      setDisplayText(bestFit);
    };

    truncateText();

    // Re-truncate on window resize
    window.addEventListener("resize", truncateText);
    return () => window.removeEventListener("resize", truncateText);
  }, [text, maxLines, lineHeight, preciseTruncation]);

  const containerStyle: React.CSSProperties = {
    position: "relative",
    lineHeight: `${lineHeight}px`,
    maxHeight: `${maxLines * lineHeight}px`,
    overflow: "hidden",
  };

  const textStyle: React.CSSProperties = {
    margin: 0,
    padding: 0,
    lineHeight: `${lineHeight}px`,
    paddingRight: isTruncated ? "1rem" : "0",
  };

  return (
    <div
      ref={containerRef}
      className={classNames(className)}
      style={containerStyle}
    >
      <p ref={textRef} style={textStyle}>
        {preciseTruncation && isTruncated ? displayText : text}
      </p>
    </div>
  );
};

export default TruncatedText;
