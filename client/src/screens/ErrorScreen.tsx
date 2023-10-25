import {
  Message,
  Icon,
  Button,
  Image,
  Accordion,
} from "semantic-ui-react";
import { useEffect, useState } from "react";

const ErrorScreen = ({
  error,
  resetErrorBoundary,
}: {
  error: any;
  resetErrorBoundary: () => void;
}) => {
  const [devInfoOpen, setDevInfoOpen] = useState(false);

  /**
   * Setup page & title on load
   */
  useEffect(() => {
    document.title = "LibreTexts | Error";
  }, []);

  return (
    <div className="flex flex-col items-center bg-white h-screen w-screen justify-center">
      <div className="flex flex-col items-center justify-center py-4 px-36">
        <Image
          src="/libretexts_logo.png"
          alt="LibreTexts logo"
          className="w-96"
        />
        <p className="text-3xl font-semibold mb-8 mt-10 text-center">
          Oops, this page encountered an error. Please refresh to try again.
        </p>
        <Button
          icon
          color="blue"
          size="big"
          className="flex mt-4"
          onClick={() => window.location.reload()}
        >
          <Icon name="refresh" /> Refresh
        </Button>
        <Accordion styled className="!w-80 mt-24">
          <Accordion.Title
            active={devInfoOpen}
            index={0}
            onClick={() => setDevInfoOpen(!devInfoOpen)}
          >
            <Icon name="dropdown" />
            Show Debugging Info
          </Accordion.Title>
          <Accordion.Content active={devInfoOpen}>
            {typeof error === "object" && error.message && (
              <Message negative>
                <Message.Header>{error.name}</Message.Header>
                <p>{error.message}</p>
              </Message>
            )}
            {typeof error === "string" && (
              <Message negative>
                <Message.Header>Unknown Error</Message.Header>
                <p>{error}</p>
              </Message>
            )}
            {!error && (
              <Message negative>
                <Message.Header>Unknown Error</Message.Header>
                <p>No error message was provided.</p>
              </Message>
            )}
          </Accordion.Content>
        </Accordion>
        <Button
          icon
          size="mini"
          className="flex !mt-6"
          onClick={() => window.location.assign("https://launchpad.libretexts.org")}
        >
          <Icon name="location arrow" /> Go To Launchpad
        </Button>

      </div>
    </div>
  );
};

export default ErrorScreen;
