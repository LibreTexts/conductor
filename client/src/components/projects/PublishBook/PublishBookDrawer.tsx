import { useCallback, useState } from "react";
import { Alert, Drawer, Spinner, Text } from "@libretexts/davis-react";
import usePublishBook from "../../../hooks/usePublishBook";
import PublishStep from "./PublishStep";
import MoveDestinationPicker from "./MoveDestinationPicker";
import { IconBolt, IconEye, IconHandMove, IconPackage } from "@tabler/icons-react";

interface PublishBookDrawerProps {
  open: boolean;
  onClose: () => void;
  projectID: string;
  projectTitle: string;
}

const PublishBookDrawer: React.FC<PublishBookDrawerProps> = ({
  open,
  onClose,
  projectID,
  projectTitle,
}) => {
  const {
    status,
    steps,
    isPublished,
    isLoading,
    error,
    isSubmitting,
    runPreprocess,
    runSecurity,
    runMove,
    runVisibility,
    runCompile,
  } = usePublishBook({ projectID, enabled: open });

  const [destination, setDestination] = useState<string | null>(null);

  // Stable so the picker's effect does not re-fire on every poll-driven render,
  // which would otherwise stomp focus in the middle of a selection.
  const handleDestinationChange = useCallback(
    (path: string | null) => setDestination(path),
    []
  );

  const body = () => {
    if (isLoading) {
      return (
        <div className="flex h-full items-center justify-center">
          <Spinner size="lg" text="Loading publishing status" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-6">
          <Alert
            variant="error"
            title="Could not load publishing status"
            message={error.message}
          />
        </div>
      );
    }

    return (
      <>
        {isPublished && (
          <div className="px-6 pt-5">
            <Alert
              variant="success"
              title="This book is published"
              message="Every step has completed. Running a step again is safe if something needs redoing."
            />
          </div>
        )}

        {/* Progress is announced once per transition rather than on every poll:
            the hook only pushes a notification when a step leaves `running`. */}
        <ol className="mt-2">
          <PublishStep
            index={1}
            title="Run editor preprocess"
            description="Opens every page in CKEditor and saves it to ensure it's well-formed. This will take some time for larger books."
            status={steps.preprocess.status}
            facts={[
              steps.preprocess.jobID
                ? ` Job ${steps.preprocess.jobID}`
                : undefined,
            ]}
            finishedAt={steps.preprocess.finishedAt}
            errorMessage={steps.preprocess.errorMessage}
            percentage={status?.preprocessPercentage}
            actionLabel="Run preprocess"
            actionIcon={<IconBolt size={16} />}
            onRun={runPreprocess}
            isSubmitting={isSubmitting("preprocess")}
          />

          <PublishStep
            index={2}
            title="Make the book public on the library"
            description="Lifts the MindTouch restriction on the cover page and every page beneath it, so anyone can read them."
            status={steps.security.status}
            facts={[
              status?.restriction
                ? ` Currently ${status.restriction}`
                : undefined,
            ]}
            finishedAt={steps.security.finishedAt}
            errorMessage={steps.security.errorMessage}
            actionLabel="Set public"
            actionIcon={<IconEye size={16} />}
            onRun={runSecurity}
            isSubmitting={isSubmitting("security")}
          />

          <PublishStep
            index={3}
            title="Move book to its final location"
            description="Relocates the cover page and every page beneath it on the library."
            status={steps.move.status}
            facts={[
              steps.move.detail,
              // The live path is the honest answer to "where is this book now",
              // and it can differ from what a past move recorded.
              status?.currentPath && status.currentPath !== steps.move.detail
                ? ` Currently at ${status.currentPath}`
                : undefined,
            ]}
            finishedAt={steps.move.finishedAt}
            errorMessage={steps.move.errorMessage}
            actionLabel="Move book"
            actionIcon={<IconHandMove size={16} />}
            onRun={() => destination && runMove(destination)}
            isSubmitting={isSubmitting("move")}
            actionDisabled={!destination}
          >
            {status?.library && (
              <MoveDestinationPicker
                projectID={projectID}
                library={status.library}
                bookTitle={projectTitle}
                onChange={handleDestinationChange}
                disabled={isSubmitting("move")}
              />
            )}
          </PublishStep>

          <PublishStep
            index={4}
            title="Set project visibility to public"
            description="Lists the project on the Commons catalog. Separate from the library permissions in step 2."
            status={steps.visibility.status}
            facts={[
              status ? ` Currently ${status.visibility}` : undefined,
            ]}
            finishedAt={steps.visibility.finishedAt}
            errorMessage={steps.visibility.errorMessage}
            actionLabel="Set public"
            actionIcon={<IconEye size={16} />}
            onRun={runVisibility}
            isSubmitting={isSubmitting("visibility")}
          />

          <PublishStep
            index={5}
            title="Compile the book"
            description="Submits a Shapeshift job to generate the PDF, LMS, and print exports."
            status={steps.compile.status}
            facts={[
              steps.compile.jobID ? ` Job ${steps.compile.jobID}` : undefined,
            ]}
            finishedAt={steps.compile.finishedAt}
            errorMessage={steps.compile.errorMessage}
            actionLabel="Compile book"
            actionIcon={<IconPackage size={16} />}
            onRun={runCompile}
            isSubmitting={isSubmitting("compile")}
          />
        </ol>
      </>
    );
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      side="right"
      size="lg"
      // Matches CompileBookDrawer so the two panels on the Project page open at
      // the same width. Davis tops out at `lg` (32rem); the drawer composes its
      // classes with clsx, which does not merge conflicting utilities, so these
      // are marked important rather than left to stylesheet ordering between
      // two `w-*` rules. Upstream request filed for an `xl` drawer size.
      className="!w-[85vw] !max-w-[1400px]"
    >
      <Drawer.Header>
        <div className="mr-4">
          <Drawer.Title className="!text-2xl">Publish Book</Drawer.Title>
          <p className="mt-1 mb-0 text-sm text-gray-600">
            Run each step in order. They are independent, so a step can be
            re-run on its own if it fails.
          </p>
        </div>
        <Drawer.Close aria-label="Close publish book panel" />
      </Drawer.Header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {body()}
        <div className="px-6 py-4">
          <Text size="sm" color="muted" className="!mb-0">
            Moving a book keeps its page ID, so links to{" "}
            <code>@go/page/{status?.coverID ?? "…"}</code> keep working.
          </Text>
        </div>
      </div>
    </Drawer>
  );
};

export default PublishBookDrawer;
