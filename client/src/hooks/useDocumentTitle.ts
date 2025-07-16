import { useEffect } from "react";

const useDocumentTitle = (title: string, overrideBase = false) => {
  useEffect(() => {
    if (typeof document === "undefined") {
        return;
    }
    
    document.title = `${title}${overrideBase ? "" : " | LibreTexts Conductor"}`;
  }, [title, overrideBase]);
};

export default useDocumentTitle;
