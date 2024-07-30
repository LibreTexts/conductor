import { useState } from "react";

interface CopyButtonProps {
  children: (payload: {
    copied: boolean;
    copy: (val?: string) => Promise<void>;
  }) => React.ReactNode;
  val?: string;
  timeout?: number;
}

const CopyButton: React.FC<CopyButtonProps> = ({
  children,
  val: parentVal,
  timeout = 1000,
}) => {
  const [copied, setCopied] = useState(false);

  const copy = async (_val?: string) => {
    try {
      if (!_val && !parentVal) return;
      const valToCopy = _val ? _val : (parentVal as string);

      await navigator.clipboard.writeText(valToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), timeout);
    } catch (e) {
      console.error(e);
      setCopied(false);
    }
  };

  return <>{children({ copied, copy })}</>;
};

export default CopyButton;
