import { useEffect, useMemo, useState } from "react";
import { Drawer, Spinner } from "@libretexts/davis-react";
import useShapeshift from "../../../hooks/useShapeshift";
import { getDefaultExportKey } from "../../../utils/bookExports";
import CompileBookHeader from "./CompileBookHeader";
import CompileBookStatusBar from "./CompileBookStatusBar";
import CompileBookEmptyState from "./CompileBookEmptyState";
import ExportRail from "./ExportRail";
import ExportDetailPane from "./ExportDetailPane";
import type { BookExportKey } from "../../../types/Shapeshift";

interface CompileBookDrawerProps {
  open: boolean;
  onClose: () => void;
  bookID: string;
}

const CompileBookDrawer: React.FC<CompileBookDrawerProps> = ({
  open,
  onClose,
  bookID,
}) => {
  const {
    job,
    exports,
    exportInfo,
    status,
    availableKeys,
    totalSizeBytes,
    isCompiling,
    isLoading,
    isExportsLoading,
    compile,
    downloadAllURL,
  } = useShapeshift({ bookID, enabled: open });

  const [selectedKey, setSelectedKey] = useState<BookExportKey | null>(null);

  // Land on the first export that actually exists once the manifest arrives,
  // but never fight a choice the user has already made.
  useEffect(() => {
    if (selectedKey || availableKeys.length === 0) return;
    setSelectedKey(getDefaultExportKey(availableKeys));
  }, [availableKeys, selectedKey]);

  const activeKey = selectedKey ?? getDefaultExportKey(availableKeys);
  const activeEntry = useMemo(
    () => exports.find((e) => e.key === activeKey),
    [exports, activeKey],
  );

  // A running or failed compile does not invalidate the previous compile's
  // files, so the rail and pane keep working as long as something is there to
  // download. The empty state is for when there is genuinely nothing to show.
  const hasExports = availableKeys.length > 0;
  const showEmptyState =
    status === "never-compiled" ||
    (!hasExports &&
      (status === "submitting" ||
        status === "in-progress" ||
        status === "failed"));

  const body = () => {
    if (isLoading || (isExportsLoading && !hasExports && !showEmptyState)) {
      return (
        <div className="flex h-full items-center justify-center">
          <Spinner size="lg" text="Loading exports" />
        </div>
      );
    }

    if (showEmptyState) {
      return (
        <CompileBookEmptyState
          status={
            status as
              | "never-compiled"
              | "submitting"
              | "in-progress"
              | "failed"
          }
          isCompiling={isCompiling}
          onCompile={compile}
          progress={job?.progress}
          stage={job?.stage}
        />
      );
    }

    return (
      <ExportDetailPane
        exportKey={activeKey}
        entry={activeEntry}
        job={job}
        isCompiling={isCompiling}
        onCompile={compile}
      />
    );
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      side="right"
      size="lg"
      // Davis tops out at `lg` (32rem), far narrower than a two-pane layout with
      // a PDF preview needs. Sized against the viewport so the preview grows
      // with the screen, capped so it does not stretch to absurd widths on an
      // ultrawide. The drawer composes its classes with clsx, which does not
      // merge conflicting utilities, so these are marked important rather than
      // left to depend on stylesheet ordering between two `w-*` rules.
      // Upstream request filed for an `xl` drawer size.
      className="!w-[85vw] !max-w-[1400px] !overflow-hidden"
    >
      <CompileBookHeader
        status={status}
        isCompiling={isCompiling}
        hasDownloads={hasExports}
        downloadAllURL={downloadAllURL}
        onCompile={compile}
      />
      <CompileBookStatusBar
        status={status}
        job={job}
        exportInfo={exportInfo}
        fileCount={availableKeys.length}
        totalSizeBytes={totalSizeBytes}
      />
      <div className="flex min-h-0 flex-1">
        <ExportRail
          exports={exports}
          selectedKey={activeKey}
          onSelect={setSelectedKey}
          disabled={showEmptyState}
        />
        <div className="min-w-0 flex-1">{body()}</div>
      </div>
    </Drawer>
  );
};

export default CompileBookDrawer;
