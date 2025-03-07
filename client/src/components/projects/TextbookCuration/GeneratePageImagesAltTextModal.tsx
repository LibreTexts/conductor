import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Checkbox, Icon, Modal } from "semantic-ui-react";
import useGlobalError from "../../error/ErrorHooks";
import LoadingSpinner from "../../LoadingSpinner";
import api from "../../../api";
import Tooltip from "../../util/Tooltip";

interface GeneratePageImagesAltTextModalProps {
  onClose: () => void;
  coverPageID: string;
  fullPageID: string;
}

const GeneratePageImagesAltTextModal: React.FC<
  GeneratePageImagesAltTextModalProps
> = ({ coverPageID, fullPageID, onClose }) => {
  const { handleGlobalError } = useGlobalError();
  const [overwrite, setOverwrite] = useState(false);
  const [modifiedCount, setModifiedCount] = useState(0);
  const [didRun, setDidRun] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const results = await api.generatePageImagesAltText(
        fullPageID,
        coverPageID,
        overwrite
      );
      if (!results.data) {
        throw new Error("No data returned from server");
      }
      setDidRun(true);
      setModifiedCount(results.data.modified_count);
    },
    onError: (e) => {
      handleGlobalError(e);
    },
  });

  return (
    <Modal
      title="Generate Page Images Alt Text?"
      open={true}
      onClose={onClose}
      closeOnPortalMouseLeave={!generateMutation.isLoading}
      closeOnTriggerClick={!generateMutation.isLoading}
      closeOnDimmerClick={!generateMutation.isLoading}
    >
      <Modal.Header>Generate Page Images Alt Text?</Modal.Header>
      <Modal.Content>
        {!didRun ? (
          <>
            {generateMutation.isLoading && (
              <LoadingSpinner text="Generating alt text... This may take a moment." />
            )}
            <p className="text-lg">
              Are you sure you want to generate alt text for the images on this
              page? This will immediately generate and apply alt text. This will
              take a moment to complete.
            </p>
            <p className="text-lg mt-4">
              Alt text generation is currently supported for the following image
              types: JPEG, PNG, GIF, WEBP, BMP, SVG. Alt text consisting of only
              the filename will be considered empty and always overwritten.
            </p>
            <div className="my-6 flex items-center">
              <Checkbox
                label="Overwrite existing alt text?"
                checked={overwrite}
                onChange={() => setOverwrite(!overwrite)}
                toggle
              />
              <Tooltip
                text="If selected, existing alt text will be replaced with AI-generated alt text. If not selected, only images without alt text will have alt text generated. Alt text consisting of only the filename will be considered empty and always overwritten."
                children={
                  <Icon name="question circle" className="!ml-1 !mb-1" />
                }
              />
            </div>
          </>
        ) : (
          <>
            <p className="text-lg">
              Generated alt text for {modifiedCount} images on this page
              {modifiedCount === 0
                ? " without error. Reasons for this may include:"
                : "!"}
            </p>
            {modifiedCount === 0 && (
              <ul className="list-disc list-inside text-lg ml-2">
                <li>There are no images on this page.</li>
                <li>The images on this page are not supported file types.</li>
                <li>
                  All images have alt text and the "overwrite" option was not
                  selected".
                </li>
              </ul>
            )}
          </>
        )}
      </Modal.Content>
      <Modal.Actions>
        {!generateMutation.isLoading && !didRun && (
          <Button onClick={onClose}>Cancel</Button>
        )}
        {didRun && (
          <Button onClick={onClose} color="green">
            Close
          </Button>
        )}
        {!didRun && (
          <Button
            color="green"
            loading={generateMutation.isLoading}
            onClick={async () => {
              await generateMutation.mutateAsync();
            }}
          >
            <Icon name="magic" />
            Generate
          </Button>
        )}
      </Modal.Actions>
    </Modal>
  );
};

export default GeneratePageImagesAltTextModal;
