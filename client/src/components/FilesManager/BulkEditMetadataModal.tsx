import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Dropdown,
  Form,
  Icon,
  Message,
  Modal,
  ModalProps,
} from "semantic-ui-react";
import { Controller, useForm } from "react-hook-form";
import { License } from "../../types";
import CtlTextInput from "../ControlledInputs/CtlTextInput";
import CtlTextArea from "../ControlledInputs/CtlTextArea";
import AuthorsForm from "./AuthorsForm";
import useGlobalError from "../error/ErrorHooks";
import useCentralIdentityLicenses from "../../hooks/useCentralIdentityLicenses";
import api from "../../api";

interface BulkEditMetadataModalProps extends ModalProps {
  projectID: string;
  /** IDs of the selected items (files and/or folders). Folders are expanded server-side. */
  fileIds: string[];
  onCancel: () => void;
  onSave: () => void;
}

type BulkMetaForm = {
  license: {
    name: string;
    version: string;
    url: string;
    sourceURL: string;
    additionalTerms: string;
  };
  originalPublisher: {
    name: string;
    url: string;
  };
};

const TERMS_MAX_CHARS = 500;

/**
 * Applies licensing, authorship, and publisher metadata to many files at once.
 * Only fields the user fills in are sent; blank fields are left unchanged on each file.
 * Selecting a folder applies the changes to every file inside it (all nesting levels).
 */
const BulkEditMetadataModal: React.FC<BulkEditMetadataModalProps> = ({
  projectID,
  fileIds,
  onCancel,
  onSave,
  ...props
}) => {
  const { handleGlobalError } = useGlobalError();
  const authorsFormRef = useRef<React.ElementRef<typeof AuthorsForm>>(null);
  const { licenseOptions, isFetching: licensesLoading } =
    useCentralIdentityLicenses();

  const { control, getValues, setValue, watch, formState } =
    useForm<BulkMetaForm>({
      defaultValues: {
        license: {
          name: "",
          version: "",
          url: "",
          sourceURL: "",
          additionalTerms: "",
        },
        originalPublisher: { name: "", url: "" },
      },
      mode: "onChange",
    });

  const [loading, setLoading] = useState(false);
  const [noFieldsError, setNoFieldsError] = useState(false);
  // Tri-state so "off" is distinguishable from "leave unchanged".
  const [modifiedFromSource, setModifiedFromSource] = useState<
    "unset" | "true" | "false"
  >("unset");

  // Update license URL and version when the license name changes (mirrors EditFile).
  useEffect(() => {
    const name = getValues("license.name");
    if (name === undefined) return;

    if (name === "") {
      setValue("license.url", "");
      setValue("license.version", "");
      return;
    }

    const license = licenseOptions?.find((l) => l.name === name);
    if (!license) return;

    if (!license.versions || license.versions.length === 0) {
      setValue("license.version", "");
    } else {
      setValue("license.version", license.versions[0]);
    }
    setValue("license.url", license.url ?? "");
  }, [watch("license.name")]);

  const selectedLicenseVersions = useCallback(() => {
    const license = licenseOptions?.find(
      (l) => l.name === getValues("license.name")
    );
    if (!license) return [];
    return license.versions ?? [];
  }, [watch("license.name"), licenseOptions]);

  function handleNoExternalSource() {
    setValue("license.sourceURL", "local");
  }

  function handleResetExternalSource() {
    setValue("license.sourceURL", "");
  }

  /**
   * Assembles a payload from only the fields the user actually set.
   * Returns null when nothing was provided.
   */
  function buildPayload() {
    const vals = getValues();
    const authorsData = authorsFormRef.current?.getAuthors();

    const license: Partial<License> = {};
    if (vals.license.name) {
      license.name = vals.license.name;
      if (vals.license.version) license.version = vals.license.version;
      if (vals.license.url) license.url = vals.license.url;
    }
    if (vals.license.sourceURL) license.sourceURL = vals.license.sourceURL;
    if (vals.license.additionalTerms)
      license.additionalTerms = vals.license.additionalTerms;
    if (modifiedFromSource !== "unset") {
      license.modifiedFromSource = modifiedFromSource === "true";
    }

    const originalPublisher: { name?: string; url?: string } = {};
    if (vals.originalPublisher.name)
      originalPublisher.name = vals.originalPublisher.name;
    if (vals.originalPublisher.url)
      originalPublisher.url = vals.originalPublisher.url;

    const data: Parameters<typeof api.bulkUpdateProjectFileMetadata>[2] = {};
    if (Object.keys(license).length > 0) data.license = license;
    if (Object.keys(originalPublisher).length > 0)
      data.originalPublisher = originalPublisher;
    if (authorsData?.primaryAuthor?._id)
      data.primaryAuthor = authorsData.primaryAuthor._id;

    if (Object.keys(data).length === 0) return null;
    return data;
  }

  async function handleSave() {
    try {
      const data = buildPayload();
      if (!data) {
        setNoFieldsError(true);
        return;
      }
      setNoFieldsError(false);
      setLoading(true);

      const res = await api.bulkUpdateProjectFileMetadata(
        projectID,
        fileIds,
        data
      );
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      onSave();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal {...props} open={true} onClose={onCancel} size="large">
      <Modal.Header>Bulk Edit Metadata</Modal.Header>
      <Modal.Content scrolling>
        <Message color="blue">
          <Message.Content>
            These fields will be applied to <strong>{fileIds.length}</strong>{" "}
            selected item{fileIds.length === 1 ? "" : "s"}. When a folder is
            selected, the fields are applied to every file inside it. Fields left
            blank are not changed.
          </Message.Content>
        </Message>
        <Form onSubmit={(e) => e.preventDefault()}>
          <div className="flex flex-col rounded-md shadow-lg border p-4">
            <span className="font-semibold mb-2">License Info</span>
            <div>
              <label className="form-field-label" htmlFor="bulkSelectLicenseName">
                Name
              </label>
              <Controller
                render={({ field }) => (
                  <Dropdown
                    id="bulkSelectLicenseName"
                    options={licenseOptions?.map((l) => ({
                      key: l.name,
                      value: l.name,
                      text: l.name,
                    }))}
                    {...field}
                    onChange={(e, data) => {
                      field.onChange(data.value?.toString() ?? "");
                    }}
                    fluid
                    selection
                    clearable
                    loading={licensesLoading}
                    placeholder="Select a license..."
                  />
                )}
                name="license.name"
                control={control}
              />
            </div>
            {selectedLicenseVersions().length > 0 && (
              <div className="mt-4">
                <label
                  className="form-field-label"
                  htmlFor="bulkSelectLicenseVersion"
                >
                  Version
                </label>
                <Controller
                  render={({ field }) => (
                    <Dropdown
                      id="bulkSelectLicenseVersion"
                      options={selectedLicenseVersions().map((v) => ({
                        key: v,
                        value: v,
                        text: v,
                      }))}
                      {...field}
                      onChange={(e, data) => {
                        field.onChange(data.value?.toString() ?? "");
                      }}
                      fluid
                      selection
                      placeholder="Select license version"
                      loading={licensesLoading}
                    />
                  )}
                  name="license.version"
                  control={control}
                />
              </div>
            )}
            <CtlTextInput
              name="license.sourceURL"
              control={control}
              label="File Source URL"
              placeholder="https://example.com"
              className="mt-2"
              helpText="URL where the file was sourced from"
              disabled={watch("license.sourceURL") === "local"}
            />
            {watch("license.sourceURL") !== "local" && (
              <p
                className="text-sky-500 ml-1 mt-1 cursor-pointer hover:underline"
                onClick={handleNoExternalSource}
              >
                These files don't have an external source.
              </p>
            )}
            {watch("license.sourceURL") === "local" && (
              <p
                className="text-sky-500 ml-1 mt-1 cursor-pointer hover:underline"
                onClick={handleResetExternalSource}
              >
                Add an external source URL
              </p>
            )}
            <div className="mt-3">
              <label
                className="form-field-label"
                htmlFor="bulkModifiedFromSource"
              >
                File modified from source?
              </label>
              <Dropdown
                id="bulkModifiedFromSource"
                options={[
                  { key: "unset", text: "Leave unchanged", value: "unset" },
                  { key: "true", text: "Yes", value: "true" },
                  { key: "false", text: "No", value: "false" },
                ]}
                value={modifiedFromSource}
                onChange={(e, { value }) =>
                  setModifiedFromSource(
                    value as "unset" | "true" | "false"
                  )
                }
                fluid
                selection
                className="mt-1"
              />
            </div>
            <CtlTextArea
              name="license.additionalTerms"
              control={control}
              label="Additional License Terms"
              placeholder="Additional terms (if applicable)..."
              className="mt-2"
              maxLength={TERMS_MAX_CHARS}
              showRemaining
            />
          </div>

          <div className="flex flex-col rounded-md shadow-lg border p-4 mt-4">
            <span className="font-semibold mb-2">Author & Publisher Info</span>
            <AuthorsForm ref={authorsFormRef} mode="file" />
            <CtlTextInput
              name="originalPublisher.name"
              control={control}
              label="Original Publisher Name"
              placeholder="John Doe"
              className="mt-4"
            />
            <CtlTextInput
              name="originalPublisher.url"
              control={control}
              label="Original Publisher URL"
              placeholder="https://example.com"
              className="mt-2"
            />
          </div>

          {noFieldsError && (
            <Message negative className="mt-4">
              <Message.Content>
                Please set at least one field before saving.
              </Message.Content>
            </Message>
          )}
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button color="green" onClick={handleSave} loading={loading}>
          <Icon name="save" />
          Save
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default BulkEditMetadataModal;
