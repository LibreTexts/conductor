import { useState, useEffect, useRef, FC, ReactElement } from "react";
import {
  Modal,
  Button,
  Input,
  Textarea,
  Select,
  Checkbox,
  FormSection,
  Stack,
  Alert,
  Text,
} from "@libretexts/davis-react";
import {
  IconDeviceFloppy,
  IconExternalLink,
  IconPlus,
  IconTag,
  IconUpload,
} from "@tabler/icons-react";
import axios from "axios";
import { getShelvesNameText } from "../../util/BookHelpers.js";
import useGlobalError from "../../error/ErrorHooks";
import { Collection, CollectionLocations, CollectionPrivacyOptions } from "../../../types";
import { Controller, useForm } from "react-hook-form";
import { useTypedSelector } from "../../../state/hooks.js";
import { collectionPrivacyOptions } from "../../util/CollectionHelpers.js";

const PRIVACY_OPTIONS = collectionPrivacyOptions.map((o) => ({
  label: o.text,
  value: o.value,
}));

type EditCollectionProps = {
  show: boolean;
  mode: "edit" | "create" | "nest";
  onCloseFunc: () => void;
  onSuccessFunc: () => void;
  collectionToEdit?: Collection;
};
const EditCollection: FC<EditCollectionProps> = ({
  show,
  mode,
  onCloseFunc,
  onSuccessFunc,
  collectionToEdit,
}): ReactElement => {
  const { handleGlobalError } = useGlobalError();
  const org = useTypedSelector((state) => state.org);

  const {
    control,
    trigger,
    reset: resetForm,
    handleSubmit,
    setValue: setFormValue,
    getValues: getFormValue,
    watch: watchFormValue,
    setError: setFormError,
    formState: { errors },
  } = useForm<Collection>({
    defaultValues: {
      orgID: "",
      collID: "",
      parentID: "",
      title: "",
      description: "",
      coverPhoto: "",
      program: "",
      locations: [],
      autoManage: false,
    },
  });

  const [loading, setLoading] = useState<boolean>(false);
  const photoRef = useRef(null);
  const [photoLoading, setPhotoLoading] = useState<boolean>(false);
  const [photoUploaded, setPhotoUploaded] = useState<boolean>(false);

  const isCreateMode = ["nest", "create"].includes(mode);
  const autoManage = watchFormValue("autoManage");
  const selectedLocations = watchFormValue("locations");

  useEffect(() => {
    if (["edit"].includes(mode)) {
      resetForm(collectionToEdit); // Load existing values if editing
    } else {
      // Cleanup on close/exit
      setPhotoLoading(false);
      setPhotoUploaded(false);
      resetForm({
        orgID: "",
        collID: "",
        parentID: undefined,
        title: "",
        description: "",
        coverPhoto: "",
        program: "",
        privacy: undefined,
        locations: [],
        autoManage: false,
        resourceCount: undefined,
      });
    }
  }, [mode, collectionToEdit, show]);

  const submitForm = (d: Collection) => {
    setLoading(true);
    if (["nest"].includes(mode) && collectionToEdit?.collID) {
      d.parentID = collectionToEdit.collID;
    } else if (["nest"].includes(mode) && !collectionToEdit?.collID) {
      return handleGlobalError("Could not get parent ID");
    }

    if (!validateLocations(d)) return;
    let axiosReq;
    if (["nest", "create"].includes(mode)) {
      axiosReq = axios.post("/commons/collection", d);
    } else {
      axiosReq = axios.put(
        `/commons/collection/${collectionToEdit?.collID}`,
        d
      );
    }

    axiosReq
      .then((res) => {
        if (!res.data.err) {
          onSuccessFunc();
        } else {
          handleGlobalError(res.data.errMsg);
        }
      })
      .catch((err) => {
        handleGlobalError(err);
      });
    setLoading(false);
  };

  /**
   * If Collection will be auto-managed, determines if at least one search location has been selected
   * @param {Collection} coll - Collection to validate
   * @returns {Boolean} - true if valid or not auto-manage, valid otherwise
   */
  function validateLocations(coll: Collection): boolean {
    let isValid = true;
    if (!coll.autoManage) isValid = true;
    if (coll.autoManage && coll.locations.length < 1) {
      isValid = false;
    }

    if (!isValid) {
      setFormError("locations", {
        types: {
          locationSelection: "At least one location is required.",
        },
      });
    }
    return isValid;
  }

  /**
   * Passes the Cover photo file selection event to the asset uploader.
   *
   * @param {React.FormEvent<HTMLInputElement>} event - File selection event.
   */
  function handleCoverPhotoFileChange(event: any) {
    handleAssetUpload(
      event,
      "coverPhoto",
      setPhotoLoading,
      setPhotoUploaded
    );
  }

  /**
   * Activates the Cover Photo file input selector.
   */
  function handleUploadCoverPhoto() {
    if (photoRef.current) {
      (photoRef.current as HTMLInputElement).click();
    }
  }

  /**
   * Uploads a selected asset file to the server, then updates state accordingly.
   *
   * @param {React.FormEvent<HTMLInputElement>} event - File selection event.
   * @param {string} assetName - Name of the asset being uploaded/replaced.
   * @param {function} uploadingStateUpdater - State setter for the respective asset upload status.
   * @param {function} uploadSuccessUpdater - State setter for the respective asset upload success flag.
   */
  async function handleAssetUpload(
    event: any,
    assetName: string,
    uploadingStateUpdater: Function,
    uploadSuccessUpdater: Function
  ) {
    const validFileTypes = ["image/jpeg", "image/png"];
    if (!event.target || typeof event?.target?.files !== "object") {
      return;
    }
    if (event.target.files.length !== 1) {
      handleGlobalError("Only one file can be uploaded at a time.");
      return;
    }

    if (!collectionToEdit) return;

    const newAsset = event.target.files[0];
    if (
      !(newAsset instanceof File) ||
      !validFileTypes.includes(newAsset.type)
    ) {
      handleGlobalError("Sorry, that file type is not supported.");
    }

    uploadingStateUpdater(true);
    const formData = new FormData();
    formData.append("assetFile", newAsset);

    try {
      const uploadRes = await axios.post(
        `/commons/collection/${collectionToEdit.collID}/assets/${assetName}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      if (!uploadRes.data.err) {
        uploadSuccessUpdater(true);
        if (uploadRes.data.url && assetName === "coverPhoto") {
          setFormValue(assetName, uploadRes.data.url);
        }
      } else {
        throw new Error(uploadRes.data.errMsg);
      }
    } catch (e) {
      handleGlobalError(e);
    }
    uploadingStateUpdater(false);
  }

  function handleLocationsChange(newValue?: string) {
    if (!newValue) return;
    let existingData = getFormValue("locations");
    if (!existingData) {
      existingData = [];
    }

    if (existingData.includes(newValue)) {
      existingData.splice(existingData.indexOf(newValue));
      setFormValue("locations", existingData);
      return;
    }

    setFormValue("locations", [...existingData, newValue]);
  }

  return (
    <Modal open={show} onClose={onCloseFunc} size="lg">
      <Modal.Header>
        <Modal.Title>{isCreateMode ? "Create" : "Edit"} Collection</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body className="overflow-y-auto max-h-[70vh]">
        <Stack gap="xl">
          {isCreateMode && (
            <Text as="p" italic>
              This collection will be created inside of{" "}
              <strong>
                {org.shortName}
                {collectionToEdit?.collID ? `: ${collectionToEdit.title}` : "."}
              </strong>
            </Text>
          )}

          <FormSection title="Collection Details">
            <Stack gap="md">
              <Controller
                name="title"
                control={control}
                rules={{ required: "Title is required." }}
                render={({ field }) => (
                  <Input
                    label="Collection Title"
                    placeholder="Collection Title..."
                    required
                    error={!!errors.title}
                    errorMessage={errors.title?.message}
                    {...field}
                  />
                )}
              />
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <Textarea
                    label="Description"
                    placeholder="Collection Description..."
                    rows={6}
                    helperText="You can format your description with Markdown."
                    error={!!errors.description}
                    {...field}
                    value={field.value || ""}
                  />
                )}
              />

              {isCreateMode && (
                <Alert
                  variant="info"
                  message="Save this collection first to upload a Cover Photo."
                />
              )}
              {["edit"].includes(mode) && collectionToEdit?.collID && (
                <div>
                  <Text as="p" weight="semibold">
                    Collection Cover Photo
                  </Text>
                  <Text as="p" color="muted">
                    Resolution should be high enough to avoid blurring on digital
                    screens.
                  </Text>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    id="conductor-org-coverphoto-upload"
                    hidden
                    ref={photoRef}
                    onChange={handleCoverPhotoFileChange}
                  />
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant="outline"
                      as="a"
                      href={collectionToEdit.coverPhoto}
                      target="_blank"
                      rel="noreferrer"
                      disabled={!collectionToEdit.coverPhoto}
                      icon={<IconExternalLink size={16} />}
                    >
                      View Current
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={handleUploadCoverPhoto}
                      loading={photoLoading}
                      icon={<IconUpload size={16} />}
                    >
                      Upload New
                    </Button>
                  </div>
                  {photoUploaded && (
                    <Alert
                      variant="success"
                      message="Cover Photo successfully uploaded."
                      className="mt-2"
                    />
                  )}
                </div>
              )}

              <Controller
                name="privacy"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Collection Privacy (defaults to Public)"
                    placeholder="Collection Privacy..."
                    options={PRIVACY_OPTIONS}
                    error={!!errors.privacy}
                    name={field.name}
                    value={field.value || CollectionPrivacyOptions.PUBLIC}
                    onChange={(e) =>
                      field.onChange(
                        (e.target.value as CollectionPrivacyOptions) ||
                          CollectionPrivacyOptions.PUBLIC
                      )
                    }
                  />
                )}
              />
            </Stack>
          </FormSection>

          <FormSection title="Automatic Management">
            <Stack gap="md">
              <Controller
                name="autoManage"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    name="autoManage"
                    label="Allow Conductor to manage this collection automatically during Commons-Libraries syncs"
                    checked={field.value || false}
                    error={!!errors.autoManage}
                    onChange={async (checked) => {
                      field.onChange(checked);
                      await trigger("autoManage");
                    }}
                  />
                )}
              />
              <Controller
                name="program"
                control={control}
                render={({ field }) => (
                  <Input
                    label="Program Meta-Tag (used to match resources)"
                    placeholder="Meta-Tag"
                    type="text"
                    leftIcon={<IconTag size={16} />}
                    error={!!errors.program}
                    {...field}
                    disabled={!autoManage}
                    value={field.value || ""}
                  />
                )}
              />
              <div>
                <Text
                  as="p"
                  color={autoManage ? "default" : "muted"}
                  className="mb-2"
                >
                  Locations to Search{" "}
                  <span className="text-gray-500">(at least one required)</span>
                </Text>
                <Stack gap="sm">
                  {Object.values(CollectionLocations).map((option, index) => (
                    <Checkbox
                      key={index}
                      name="locations"
                      disabled={!autoManage}
                      label={getShelvesNameText(option)}
                      checked={selectedLocations?.includes(option) ?? false}
                      error={!!errors.locations}
                      onChange={async () => {
                        handleLocationsChange(option);
                        await trigger("locations");
                      }}
                    />
                  ))}
                </Stack>
              </div>
            </Stack>
          </FormSection>
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <Stack direction="horizontal" gap="md" justify="end">
          <Button variant="outline" onClick={onCloseFunc} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit(submitForm)}
            loading={loading}
            icon={
              isCreateMode ? (
                <IconPlus size={16} />
              ) : (
                <IconDeviceFloppy size={16} />
              )
            }
          >
            {isCreateMode ? "Create" : "Save"}
          </Button>
        </Stack>
      </Modal.Footer>
    </Modal>
  );
};

export default EditCollection;
