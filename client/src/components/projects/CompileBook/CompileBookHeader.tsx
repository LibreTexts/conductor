import { Button, Drawer } from "@libretexts/davis-react";
import { IconDownload, IconRotate2, IconSend } from "@tabler/icons-react";
import type { CompileStatus } from "../../../hooks/useShapeshift";

interface CompileBookHeaderProps {
  status: CompileStatus;
  isCompiling: boolean;
  /** True while a finished compile's files are still being waited on. */
  isSettling: boolean;
  hasDownloads: boolean;
  downloadAllURL: string;
  onCompile: () => void;
}

const CompileBookHeader: React.FC<CompileBookHeaderProps> = ({
  status,
  isCompiling,
  isSettling,
  hasDownloads,
  downloadAllURL,
  onCompile,
}) => {
  // Settling counts as busy. `status` is already `finished` during that window
  // while the previous compile's poll and timer are still live, so without this
  // a second job can be started underneath one that has not finished reporting.
  const compileDisabled = status === "in-progress" || isSettling;

  return (
    <Drawer.Header>
      <div className="mr-4">
        <Drawer.Title className="!text-2xl">Export Book</Drawer.Title>
        <p className="mt-1 mb-0 text-sm text-gray-600">
          Generate print and LMS-ready files from the current contents of
          this book.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          icon={<IconDownload size={18} />}
          as="a"
          href={downloadAllURL}
          // Soft-disabled rather than removing the href: the button keeps its
          // place in the tab order and announces its state, and Davis cancels
          // the click so the navigation cannot fire.
          softDisabled={!hasDownloads}
        >
          Download All
        </Button>
        <Button
          variant="primary"
          icon={<IconRotate2 size={18} />}
          onClick={onCompile}
          loading={isCompiling}
          softDisabled={compileDisabled}
        >
          Recompile Exports
        </Button>
        <Drawer.Close aria-label="Close compile book panel" />
      </div>
    </Drawer.Header>
  );
};

export default CompileBookHeader;
