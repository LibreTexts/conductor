import { Accordion, Alert, Button } from "@libretexts/davis-react";
import { IconLocationFilled, IconRefresh } from "@tabler/icons-react";
import { useEffect } from "react";
import { isChunkLoadError } from "../utils/chunkErrorRecovery";

const ErrorScreen = ({
  error,
  resetErrorBoundary,
}: {
  error: any;
  resetErrorBoundary: () => void;
}) => {
  // A failed chunk fetch means this tab is running a build that no longer exists on the
  // server, not that the page is broken. Say so, because "reload" actually fixes it.
  const staleBuild = isChunkLoadError(error);

  /**
   * Setup page & title on load
   */
  useEffect(() => {
    document.title = staleBuild
      ? "LibreTexts | Update Available"
      : "LibreTexts | Error";
  }, [staleBuild]);

  const errorName =
    typeof error === "object" && error?.name ? error.name : "Unknown Error";
  const errorMessage =
    typeof error === "string"
      ? error
      : typeof error === "object" && error?.message
      ? error.message
      : "No error message was provided.";

  return (
    <div className="flex flex-col items-center bg-white h-screen w-screen justify-center">
      <div className="flex flex-col items-center justify-center py-4 px-36">
        <img
          src="/libretexts_logo.png"
          alt="LibreTexts"
          className="w-96 max-w-full"
        />
        <h1 className="text-3xl font-semibold mb-8 mt-10 text-center">
          {staleBuild
            ? "A new version of Conductor is available. Reload to continue."
            : "Oops, this page encountered an error. Please refresh to try again."}
        </h1>
        <Button
          variant="primary"
          size="lg"
          className="mt-4"
          icon={<IconRefresh aria-hidden="true" />}
          onClick={() => window.location.reload()}
        >
          Reload
        </Button>
        <Accordion className="w-80 mt-24" variant="bordered">
          <Accordion.Item>
            <Accordion.Trigger>Show Debugging Info</Accordion.Trigger>
            <Accordion.Panel>
              <Alert
                variant="error"
                title={errorName}
                asHeading="p"
                message={errorMessage}
              />
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
        <Button
          variant="ghost"
          size="sm"
          className="mt-6"
          icon={<IconLocationFilled aria-hidden="true" />}
          onClick={() =>
            window.location.assign("https://launchpad.libretexts.org")
          }
        >
          Go To Launchpad
        </Button>
      </div>
    </div>
  );
};

export default ErrorScreen;
