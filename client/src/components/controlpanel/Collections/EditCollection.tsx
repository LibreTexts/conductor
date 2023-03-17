import React, { useState, useEffect, useRef, FC, ReactElement } from "react";
import { Form, Modal, Button, Icon, Input, Message } from "semantic-ui-react";
import axios from "axios";

import { getShelvesNameText } from "../../util/BookHelpers.js";
import { isEmptyString, basicArraysEqual } from "../../util/HelperFunctions.js";
import { itemsPerPageOptions } from "../../util/PaginationOptions.js";
import useGlobalError from "../../error/ErrorHooks.js";
import { Collection, CollectionLocations } from "../../../types";
import { useForm, useFormState, useFieldArray } from "react-hook-form";
import { useTypedSelector } from "../../../state/hooks.js";
import { collectionPrivacyOptions } from "../../util/CollectionHelpers.js";

type EditCollectionProps = {
  show: boolean;
  createMode: boolean;
  onCloseFunc: () => void;
  collectionToEdit?: Collection;
};
const EditCollection: FC<EditCollectionProps> = ({
  show,
  createMode,
  onCloseFunc,
  collectionToEdit,
}): ReactElement => {
  const { handleGlobalError } = useGlobalError();
  const org = useTypedSelector((state) => state.org);

  const {
    control,
    trigger,
    reset: resetForm,
    handleSubmit,
    register: registerFormField,
    setValue: setFormValue,
    getValues: getFormValue,
    watch: watchFormValues,
    formState: { errors, isDirty },
  } = useForm<Collection>({
    defaultValues: {
      autoManage: false,
    },
  });

  const [loading, setLoading] = useState<boolean>(false);
  const photoRef = useRef(null);
  const [photoLoading, setPhotoLoading] = useState<boolean>(false);
  const [photoUploaded, setPhotoUploaded] = useState<boolean>(false);
  const [editCollPhoto, setEditCollPhoto] = useState<boolean>(false);

  useEffect(() => {
    if (createMode) {
      resetForm();
    } else {
      resetForm(collectionToEdit);
    }
  }, [createMode, collectionToEdit]);

  const submitForm = (d: Collection) => {
    setLoading(true);
    let axiosReq;
    if (createMode) {
      axiosReq = axios.post("/commons/collection/create", d);
    } else {
      axiosReq = axios.patch("/commons/collection/edit", d);
    }

    axiosReq
      .then((res) => {
        if (!res.data.err) {
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
   * Passes the Cover photo file selection event to the asset uploader.
   *
   * @param {React.FormEvent<HTMLInputElement>} event - File selection event.
   */
  function handleCoverPhotoFileChange(event: any) {
    handleAssetUpload(
      event,
      "coverPhoto",
      setEditCollPhoto,
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
   * @param {function} assetLinkUpdater - State setter for the respective asset link.
   * @param {function} uploadingStateUpdater - State setter for the respective asset upload status.
   * @param {function} uploadSuccessUpdater - State setter for the respective asset upload success flag.
   */
  async function handleAssetUpload(
    event: any,
    assetName: string,
    assetLinkUpdater: Function,
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
        if (uploadRes.data.url) {
          assetLinkUpdater(uploadRes.data.url);
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
    <Modal open={show} closeOnDimmerClick={false}>
      <Modal.Header>{createMode ? "Create" : "Edit"} Collection</Modal.Header>
      <Modal.Content>
        {createMode && (
          <p>
            <em>
              This collection will be created inside of{" "}
              <strong>{org.shortName}</strong>.
            </em>
          </p>
        )}
        <Form noValidate>
          <Form.Field error={useFormState({ control }).errors.title}>
            <label>Collection Title</label>
            <Form.Input
              name="title"
              fluid
              placeholder="Collection Title..."
              onChange={async (e, { name, value }) => {
                setFormValue(name, value);
                await trigger("title");
              }}
              error={errors.title ? true : false}
            />
          </Form.Field>
          {createMode && (
            <>
              <p>
                <strong>Collection Cover Photo</strong>
              </p>
              <p>
                <em>Save this collection first to upload a Cover Photo.</em>
              </p>
            </>
          )}
          {!createMode && collectionToEdit?.collID && (
            <Form.Field required className="mt-2r">
              <label htmlFor="coverPhoto">Collection Cover Photo</label>
              <p>
                A <em>download link</em> to the collection's cover photo.
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
                  disabled={!editCollPhoto}
                  as="a"
                  href={editCollPhoto}
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
            placeholder="Collection Privacy..."
            options={collectionPrivacyOptions}
            onChange={async (e, { name, value }) => {
              setFormValue(name, value);
              await trigger("privacy");
            }}
            error={errors.privacy ? true : false}
          />

          <Form.Checkbox
            name="autoManage"
            label="Allow Conductor to manage this collection automatically during Commons-Libraries syncs"
            onChange={async (e, { name, defaultChecked, checked }) => {
              setFormValue("autoManage", checked ?? false);
              await trigger("autoManage");
            }}
            error={errors.autoManage ? true : false}
          />
          <Form.Field
            className="mt-2p"
            error={useFormState({ control }).errors.program}
          >
            <label className={getFormValue('autoManage') ? '': 'muted-text'}>
              Program Meta-Tag{" "}
              <span className="muted-text">(used to match resources)</span>
            </label>
            <Form.Input
              disabled={!getFormValue("autoManage") ?? true}
              name="program"
              icon="tag"
              placeholder="Meta-Tag"
              type="text"
              iconPosition="left"
              onChange={async (e, { name, value }) => {
                setFormValue(name, value);
                await trigger("program");
              }}
              error={errors.program ? true : false}
            />
          </Form.Field>
          <Form.Group grouped>
            <label className={getFormValue('autoManage') ? '': 'muted-text'}>
              Locations to Search{" "}
              <span className="muted-text">(at least one required)</span>
            </label>
            {Object.values(CollectionLocations).map((option, index) => {
              return (
                <Form.Checkbox
                  disabled={!getFormValue("autoManage") ?? true}
                  name="locations"
                  label={getShelvesNameText(option)}
                  onChange={async (e, { name, value }) => {
                    setFormValue("locations", value as CollectionLocations);
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
          color={createMode ? "green" : "blue"}
          onClick={handleSubmit(submitForm)}
          loading={loading}
        >
          <Icon name={createMode ? "add" : "edit"} />
          {createMode ? "Create" : "Edit"}
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default EditCollection;
