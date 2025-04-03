import { useState, useEffect, useRef, FC, ReactElement } from "react";
import { Form, Modal, Button, Icon, Input, Message } from "semantic-ui-react";
import axios from "axios";
import { getShelvesNameText } from "../../util/BookHelpers.js";
import useGlobalError from "../../error/ErrorHooks";
import { Collection, CollectionLocations, CollectionPrivacyOptions } from "../../../types";
import { useForm } from "react-hook-form";
import { useTypedSelector } from "../../../state/hooks.js";
import { collectionPrivacyOptions } from "../../util/CollectionHelpers.js";
import TextArea from "../../TextArea/index.js";
import CtlTextInput from "../../ControlledInputs/CtlTextInput.js";
import CtlDropdown from "../../ControlledInputs/CtlDropdown.js";

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
    formState: { errors, isDirty },
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
    <Modal open={show} closeOnDimmerClick={false}>
      <Modal.Header>
        {["nest", "create"].includes(mode) ? "Create" : "Edit"} Collection
      </Modal.Header>
      <Modal.Content>
        {["create", "nest"].includes(mode) && (
          <p>
            <em>
              This collection will be created inside of{" "}
              <strong>
                {org.shortName}
                {collectionToEdit?.collID ? `: ${collectionToEdit.title}` : "."}
              </strong>
            </em>
          </p>
        )}
        <Form noValidate>
          <Form.Field required error={errors.title}>
            <label>Collection Title</label>
            <CtlTextInput
              control={control}
              name="title"
              placeholder="Collection Title..."
              error={errors.title ? true : false}
              rules={{ required: "Title is required." }}
            />
          </Form.Field>
          <Form.Field error={errors.description}>
            <label>Description</label>
            <TextArea
              placeholder="Collection Description..."
              textValue={watchFormValue("description") || ""}
              onTextChange={(newText) => setFormValue("description", newText)}
              contentType="description"
              error={errors.description ? true : false}
              className="h-40"
            />
          </Form.Field>
          {["create", "nest"].includes(mode) && (
            <>
              <p>
                <strong>Collection Cover Photo</strong>
              </p>
              <p>
                <em>Save this collection first to upload a Cover Photo.</em>
              </p>
            </>
          )}
          {["edit"].includes(mode) && collectionToEdit?.collID && (
            <Form.Field required className="!my-6">
              <label htmlFor="coverPhoto">Collection Cover Photo</label>
              <p>
                Resolution should be high enough to avoid blurring on digital
                screens.
              </p>
              <input
                type="file"
                accept="image/jpeg,image/png"
                id="conductor-org-coverphoto-upload"
                hidden
                ref={photoRef}
                onChange={handleCoverPhotoFileChange}
              />
              <Button.Group fluid>
                <Button
                  disabled={!collectionToEdit.coverPhoto}
                  as="a"
                  href={collectionToEdit.coverPhoto}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Icon name="external" />
                  View Current
                </Button>
                <Button
                  color="blue"
                  onClick={handleUploadCoverPhoto}
                  loading={photoLoading}
                >
                  <Icon name="upload" />
                  Upload New
                </Button>
              </Button.Group>
              {photoUploaded && (
                <Message positive>
                  <Icon name="check circle" />
                  <span>Cover Photo successfully uploaded.</span>
                </Message>
              )}
            </Form.Field>
          )}
          <Form.Select
            name="privacy"
            fluid
            label={
              <label>
                Collection Privacy{" "}
                <span className="muted-text">(defaults to Public)</span>
              </label>
            }
            value={getFormValue("privacy") || "public"}
            placeholder="Collection Privacy..."
            options={collectionPrivacyOptions}
            onChange={(e, { value }) => setFormValue('privacy', value?.toString() as CollectionPrivacyOptions || CollectionPrivacyOptions.PUBLIC)}
            error={errors.privacy ? true : false}
          />
          <Form.Checkbox
            name="autoManage"
            label="Allow Conductor to manage this collection automatically during Commons-Libraries syncs"
            onChange={async (e, { name, defaultChecked, checked }) => {
              setFormValue("autoManage", checked ?? false);
              await trigger("autoManage");
            }}
            checked={getFormValue("autoManage") || false}
            error={errors.autoManage ? true : false}
          />
          <Form.Field
            className="mt-2p"
            error={errors.program}
          >
            <label className={getFormValue("autoManage") ? "" : "muted-text"}>
              Program Meta-Tag{" "}
              <span className="muted-text">(used to match resources)</span>
            </label>
            <Form.Input
              disabled={!getFormValue("autoManage")}
              name="program"
              icon="tag"
              placeholder="Meta-Tag"
              type="text"
              value={getFormValue("program") || ""}
              iconPosition="left"
              onChange={async (e, { name, value }) => {
                setFormValue(name, value);
                await trigger("program");
              }}
              error={errors.program ? true : false}
            />
          </Form.Field>
          <Form.Group grouped>
            <label className={getFormValue("autoManage") ? "" : "muted-text"}>
              Locations to Search{" "}
              <span className="muted-text">(at least one required)</span>
            </label>
            {Object.values(CollectionLocations).map((option, index) => {
              return (
                <Form.Checkbox
                  key={index}
                  disabled={!getFormValue("autoManage")}
                  name="locations"
                  label={getShelvesNameText(option)}
                  value={option}
                  checked={getFormValue("locations")?.includes(option) ?? false}
                  onChange={async (e, { name, value }) => {
                    handleLocationsChange(value?.toString());
                    await trigger("locations");
                  }}
                  error={errors.locations ? true : false}
                />
              );
            })}
          </Form.Group>
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onCloseFunc}>Cancel</Button>
        <Button
          color="green"
          onClick={handleSubmit(submitForm)}
          loading={loading}
        >
          <Icon name={["nest", "create"].includes(mode) ? "add" : "save"} />
          {["nest", "create"].includes(mode) ? "Create" : "Save"}
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default EditCollection;
