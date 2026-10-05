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
  IconUpload,
} from "@tabler/icons-react";
import axios from "axios";
import { getShelvesNameText } from "../../util/BookHelpers.js";
import useGlobalError from "../../error/ErrorHooks";
import {
  Collection,
  CollectionPrivacyOptions,
  CollectionSyncMode,
  MAX_COLLECTION_SYNC_SHELVES,
} from "../../../types";
import ShelfTreePicker from "./ShelfTreePicker";
import { Controller, useForm } from "react-hook-form";
import { useTypedSelector } from "../../../state/hooks.js";
import { collectionPrivacyOptions } from "../../util/CollectionHelpers.js";

const PRIVACY_OPTIONS = collectionPrivacyOptions.map((o) => ({
  label: o.text,
  value: o.value,
}));

/**
 * Whether a collection is still on the retired program meta-tag rule.
 *
 * Collections predating sync modes carry no `syncMode` at all, so a stored
 * program value is what identifies them.
 */
const isLegacyProgramCollection = (collection?: Collection): boolean => {
  if (!collection) return false;
  if (collection.syncMode) return collection.syncMode === CollectionSyncMode.PROGRAM;
  return !!collection.program?.trim();
};

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
    watch: watchFormValue,
    setError: setFormError,
    clearErrors,
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
      syncMode: CollectionSyncMode.SHELVES,
      syncShelves: [],
    },
  });

  const [loading, setLoading] = useState<boolean>(false);
  const photoRef = useRef(null);
  const [photoLoading, setPhotoLoading] = useState<boolean>(false);
  const [photoUploaded, setPhotoUploaded] = useState<boolean>(false);
  // Set when the admin converts a legacy program collection to shelves, which
  // swaps the frozen summary for the shelf picker before anything is saved.
  const [convertedToShelves, setConvertedToShelves] = useState<boolean>(false);

  const isCreateMode = ["nest", "create"].includes(mode);
  const autoManage = watchFormValue("autoManage");
  const onLegacyProgramRule =
    !isCreateMode && isLegacyProgramCollection(collectionToEdit) && !convertedToShelves;

  useEffect(() => {
    setConvertedToShelves(false);
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
        syncMode: CollectionSyncMode.SHELVES,
        syncShelves: [],
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

    if (!validateSyncConfig(d)) {
      setLoading(false);
      return;
    }

    /* A collection still on the legacy program rule sends no sync fields at all.
       The server rejects `syncMode: "program"` outright — that rejection is what
       closes the rule to new collections — and omitting the fields is what tells
       it to leave the stored program and locations alone.

       Everything else asserts `shelves` rather than passing the loaded value
       through. A manual collection created before sync modes existed carries no
       `syncMode`, and an omitted mode means "don't touch the rule" to the server:
       the shelves would be stored, the mode would stay empty, and the sync would
       fall through to the program rule and match nothing. */
    const { program, locations, ...rest } = d;
    const payload = onLegacyProgramRule
      ? (({ syncMode, syncShelves, ...withoutSync }) => withoutSync)(rest)
      : { ...rest, syncMode: CollectionSyncMode.SHELVES };

    let axiosReq;
    if (["nest", "create"].includes(mode)) {
      axiosReq = axios.post("/commons/collection", payload);
    } else {
      axiosReq = axios.put(
        `/commons/collection/${collectionToEdit?.collID}`,
        payload
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
   * Checks the shelf configuration before it is sent.
   *
   * An auto-managed collection needs at least one shelf: an empty config saves
   * fine and then quietly syncs nothing, which reads to the admin as a broken
   * collection rather than an unfinished one.
   *
   * The ceiling is checked whether or not automatic management is on, because
   * the shelves are submitted either way and the API caps the array regardless.
   * Both sides read {@link MAX_COLLECTION_SYNC_SHELVES} from
   * `shared/collection-limits.json`, so this check cannot drift from the one
   * that would reject the request.
   *
   * A collection still on the frozen program rule submits no sync fields at all,
   * so there is nothing to check.
   *
   * @param {Collection} coll - Collection to validate
   * @returns {Boolean} - true if the config is usable or there is nothing to check
   */
  function validateSyncConfig(coll: Collection): boolean {
    if (onLegacyProgramRule) return true;

    const shelves = coll.syncShelves ?? [];

    if (shelves.length > MAX_COLLECTION_SYNC_SHELVES) {
      setFormError("syncShelves", {
        types: {
          shelvesMax: `Select at most ${MAX_COLLECTION_SYNC_SHELVES} shelves.`,
        },
      });
      handleGlobalError(
        `A collection can sync from at most ${MAX_COLLECTION_SYNC_SHELVES} shelves. ` +
        `${shelves.length} are selected — remove ${shelves.length - MAX_COLLECTION_SYNC_SHELVES} to save.`
      );
      return false;
    }

    if (!coll.autoManage) return true;

    if (shelves.length < 1) {
      setFormError("syncShelves", {
        types: { shelvesRequired: "At least one shelf is required." },
      });
      return false;
    }
    return true;
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

  return (
    <Modal open={show} onClose={onCloseFunc} size="lg">
      <Modal.Header>
        <Modal.Title className="!mb-0">{isCreateMode ? "Create" : "Edit"} Collection</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body className="overflow-y-auto max-h-[70vh]">
        <Stack gap="xl">
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
              {isCreateMode && (
                <Stack direction="vertical" gap="xs">
                  <Text as="p" className="text-gray-500 !mb-1">
                    Location:
                  </Text>
                  <Text as="p" italic>
                    This collection will be created inside of{" "}
                    <strong>
                      {org.shortName}
                      {collectionToEdit?.collID ? `: ${collectionToEdit.title}` : "."}
                    </strong>
                  </Text>
                </Stack>
              )}
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
                  <Text as="p" className="text-gray-500 !mb-1">
                    Collection Cover Photo
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
                  <Text as="p" size="sm" color="muted" className="mt-2!">
                    Resolution should be high enough to avoid blurring.
                  </Text>
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
                    label="Allow Conductor to manage this collection automatically during Commons-Libraries syncs. Syncs run daily at approx. 5 AM PST."
                    checked={field.value || false}
                    error={!!errors.autoManage}
                    onChange={async (checked) => {
                      field.onChange(checked);
                      await trigger("autoManage");
                    }}
                  />
                )}
              />
              {onLegacyProgramRule ? (
                <Stack gap="md">
                  {/* Read-only on purpose. Program syncing is being retired, so
                      this collection keeps working exactly as it does today but
                      cannot be reconfigured on the old rule. */}
                  <Alert
                    variant="warning"
                    message="This collection still syncs by program meta-tag, which is being retired. It will keep working, but the rule can no longer be changed. Switching to Library Shelves is permanent. The program and locations below are cleared when you save."
                  />
                  <div>
                    <Text as="p" weight="semibold" className="mb-1!">
                      Program Meta-Tag
                    </Text>
                    <Text as="p" className="mb-0!">
                      {collectionToEdit?.program || "Not set"}
                    </Text>
                  </div>
                  <div>
                    <Text as="p" weight="semibold" className="mb-1!">
                      Locations Searched
                    </Text>
                    <Text as="p" className="mb-0!">
                      {collectionToEdit?.locations?.length
                        ? collectionToEdit.locations
                          .map((location) => getShelvesNameText(location))
                          .join(", ")
                        : "None"}
                    </Text>
                  </div>
                  <div>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setFormValue("syncMode", CollectionSyncMode.SHELVES);
                        setFormValue("syncShelves", []);
                        setConvertedToShelves(true);
                      }}
                    >
                      Switch to Library Shelves
                    </Button>
                  </div>
                </Stack>
              ) : (
                <Stack gap="md">
                  <Text as="p" size="sm" color="muted" className="mb-0!">
                    Syncs every book under the shelves you choose, across any
                    library.
                  </Text>
                  <Controller
                    name="syncShelves"
                    control={control}
                    render={({ field: shelvesField }) => (
                      <ShelfTreePicker
                        value={shelvesField.value ?? []}
                        onChange={(shelves) => {
                          shelvesField.onChange(shelves);
                          clearErrors("syncShelves");
                        }}
                        disabled={!autoManage}
                      />
                    )}
                  />
                  {!!errors.syncShelves && (
                    <Text as="p" size="sm" className="mt-1 mb-0! text-red-700">
                      At least one shelf is required.
                    </Text>
                  )}
                </Stack>
              )}
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
