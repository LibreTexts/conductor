import {
  Button,
  Input,
  Modal,
  RadioGroup,
  Select,
  Stack,
  Text,
} from "@libretexts/davis-react";
import React, { useEffect, useState } from "react";
import {
  ReferenceDisplayLocation,
  ReferenceDisplayLocations,
  ReferenceFormatType,
  ReferenceFormatTypes,
} from "./model";

export type ConfigureSettings = {
  format: ReferenceFormatType;
  displayLocation: ReferenceDisplayLocation;
  pageTitle: string;
};

interface ConfigureProps {
  open: boolean;
  onClose: () => void;
  format?: ReferenceFormatType;
  /** Optional initial values for display settings (wire to API later). */
  displayLocation?: ReferenceDisplayLocation;
  pageTitle?: string;
  onSubmit?: (settings: ConfigureSettings) => void | Promise<void>;
  submitDisabled?: boolean;
}

const needsPageTitle = (location: ReferenceDisplayLocation) =>
  location === "endOfChapter" || location === "backmatter";

const Configure: React.FC<ConfigureProps> = ({
  open,
  onClose,
  format: initialFormat,
  displayLocation: initialDisplayLocation = "endOfPage",
  pageTitle: initialPageTitle = "",
  onSubmit,
  submitDisabled = false,
}) => {
  const [format, setFormat] = useState<ReferenceFormatType | "">(
    initialFormat ?? "",
  );
  const [displayLocation, setDisplayLocation] =
    useState<ReferenceDisplayLocation>(initialDisplayLocation);
  const [pageTitle, setPageTitle] = useState(initialPageTitle);

  useEffect(() => {
    if (!open) return;
    setFormat(initialFormat ?? "");
    setDisplayLocation(initialDisplayLocation);
    setPageTitle(initialPageTitle);
  }, [open, initialFormat, initialDisplayLocation, initialPageTitle]);

  const showPageTitle = needsPageTitle(displayLocation);
  const canSubmit =
    !!format &&
    (!showPageTitle || pageTitle.trim().length > 0) &&
    !submitDisabled;

  const handleSubmit = async () => {
    if (!format || !canSubmit) return;
    await onSubmit?.({
      format,
      displayLocation,
      pageTitle: showPageTitle ? pageTitle.trim() : "",
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} size="md">
      <Modal.Header>
        <Modal.Title>Configure References</Modal.Title>
        <Modal.Close aria-label="Close" />
      </Modal.Header>
      <Modal.Body>
        <Stack direction="vertical" gap="sm">
          <Select
            name="configureReferencesFormat"
            label="Citation format"
            placeholder="Select a format"
            options={ReferenceFormatTypes.map((value) => ({
              label: value,
              value,
            }))}
            value={format}
            onChange={(e) =>
              setFormat(e.target.value as ReferenceFormatType | "")
            }
          />

          <RadioGroup
            name="displayLocation"
            label="Where to display references"
            value={displayLocation}
            onChange={(value) =>
              setDisplayLocation(value as ReferenceDisplayLocation)
            }
            options={ReferenceDisplayLocations.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            orientation="horizontal"
            className="gap-sm"
          />

          {showPageTitle && (
            <Stack direction="vertical" gap="xs">
              <Input
                name="pageTitle"
                label="Page title"
                placeholder="e.g. References"
                value={pageTitle}
                onChange={(e) => setPageTitle(e.target.value)}
              />
              <Text size="sm" className="text-neutral-500">
                Title used for the generated references page.
              </Text>
            </Stack>
          )}
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          Save
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default Configure;
