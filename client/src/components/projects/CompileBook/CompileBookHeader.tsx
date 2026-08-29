import { Button, Drawer } from "@libretexts/davis-react";
import { IconDownload, IconPackage, IconPackages, IconSend } from "@tabler/icons-react";
import type { CompileStatus } from "../../../hooks/useShapeshift";

interface CompileBookHeaderProps {
  status: CompileStatus;
  isCompiling: boolean;
  hasDownloads: boolean;
  downloadAllURL: string;
  onCompile: () => void;
}

const CompileBookHeader: React.FC<CompileBookHeaderProps> = ({
  status,
  isCompiling,
  hasDownloads,
  downloadAllURL,
  onCompile,
}) => {
  const compileDisabled = status === "in-progress";

  return (
    <Drawer.Header>
      <div className="mr-4">
        <Drawer.Title className="!text-2xl">Compile Book</Drawer.Title>
        <p className="mt-1 mb-0 text-sm text-gray-600">
          Generate print and LMS-ready files from the current contents of
          this book.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          icon={<IconDownload size={16} />}
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
          icon={<IconPackage size={20} />}
          onClick={onCompile}
          loading={isCompiling}
          softDisabled={compileDisabled}
        >
          Compile Book
        </Button>
        <Drawer.Close aria-label="Close compile book panel" />
      </div>
    </Drawer.Header>
  );
};

export default CompileBookHeader;
