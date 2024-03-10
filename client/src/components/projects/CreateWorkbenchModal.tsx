import {
  Button,
  Dropdown,
  Form,
  Icon,
  Message,
  Modal,
  ModalProps,
} from "semantic-ui-react";
import './Projects.css'
import useGlobalError from "../error/ErrorHooks";
import axios from "axios";
import { Controller, get, useForm } from "react-hook-form";
import CtlTextInput from "../ControlledInputs/CtlTextInput";
import { required } from "../../utils/formRules";
import { useEffect, useState } from "react";
import { useTypedSelector } from "../../state/hooks";
import { CentralIdentityApp } from "../../types";
import { getCentralAuthInstructorURL } from "../../utils/centralIdentityHelpers";

interface CreateWorkbenchModalProps extends ModalProps {
  show: boolean;
  projectID: string;
  projectTitle: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface CreateWorkbenchForm {
  library: number | string;
  title: string;
}

const CreateWorkbenchModal: React.FC<CreateWorkbenchModalProps> = ({
  show,
  projectID,
  projectTitle,
  onClose,
  onSuccess,
  ...rest
}) => {
  const { handleGlobalError } = useGlobalError();
  const user = useTypedSelector((state) => state.user);
  const { control, getValues, setValue, reset, trigger, formState, watch } =
    useForm<CreateWorkbenchForm>({
      defaultValues: {
        library: "",
        title: "",
      },
    });
  const [loading, setLoading] = useState(false);
  const [libraryOptions, setLibraryOptions] = useState<CentralIdentityApp[]>(
    []
  );
  const [canAccessLibrary, setCanAccessLibrary] = useState(true);

  useEffect(() => {
    if (show) {
      reset(); // reset form on open
      loadLibraries();
      setValue("title", projectTitle);
    }
  }, [show]);

  async function loadLibraries() {
    try {
      setLoading(true);
      const res = await axios.get("/central-identity/public/apps");
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.applications) throw new Error("No libraries found");

      const libraries = res.data.applications.filter(
        (a: CentralIdentityApp) => a.app_type === "library"
      );

      if (!libraries.length) throw new Error("No libraries found");
      setLibraryOptions(libraries);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkLibraryAccess();
  }, [user, watch("library")]);

  async function checkLibraryAccess() {
    try {
      if (!user.uuid || !getValues("library")) return;
      const res = await axios.get(
        `/central-identity/users/${user.uuid}/applications/${getValues(
          "library"
        )}`
      );
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      setCanAccessLibrary(res.data.hasAccess ?? false);
    } catch (err) {
      handleGlobalError(err);
    }
  }

  async function createWorkbench() {
    try {
      if (!canAccessLibrary) return;
      setLoading(true);
      if (!(await trigger())) return;
      const res = await axios.post("/commons/book", {
        ...getValues(),
        projectID,
      });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      onSuccess();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal size="fullscreen" open={show} {...rest}>
      <Modal.Header>Create Book</Modal.Header>
      <Modal.Content>
        <p id = "bookInstructions">This creates an empty book on your chosen library and links it to this Conductor project.</p>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            createWorkbench();
          }}
          loading={loading}
        >
          <div className="w-full mr-6">
            <label
              htmlFor="projectStatus"
              className="form-field-label form-required"
            >
              Library
            </label>
            <Controller
              name="library"
              control={control}
              rules={required}
              render={({ field }) => (
                <Dropdown
                  id="projectStatus"
                  options={libraryOptions.map((l) => ({
                    key: l.id,
                    text: l.name,
                    value: l.id,
                  }))}
                  {...field}
                  onChange={(e, data) => {
                    field.onChange(data.value);
                  }}
                  fluid
                  selection
                  placeholder="Select Library..."
                  error={formState.errors.library ? true : false}
                />
              )}
            />
            {user.isSuperAdmin && (
              <>
                {/* Super Admins can use the dev library for debugging */}
                <p
                  className="underline cursor-pointer"
                  onClick={() => setValue("library", "dev")}
                >
                  Use Dev
                </p>
              </>
            )}
          </div>
          <div className="mt-4">
            <CtlTextInput
              control={control}
              name="title"
              label="Book Title"
              placeholder="Enter Book Title"
              required
              rules={required}
            />
          </div>
          <p>
            <strong>CAUTION:</strong> Library cannot be changed after Book is
            created. Please check your selection before submitting.
          </p>
        </Form>
        {!canAccessLibrary && (
          <Message warning>
            <Message.Header>Cannot Access Library</Message.Header>
            <p>
              Oops, it looks like you do not have access to this library. If you
              need to request access, please submit or update your instructor
              verification request here:{" "}
              <a href={getCentralAuthInstructorURL()} target="_blank">
                {getCentralAuthInstructorURL()}
              </a>
            </p>
          </Message>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose} loading={loading}>
          Cancel
        </Button>
        <Button
          onClick={createWorkbench}
          labelPosition="left"
          icon
          color="green"
          loading={loading}
          disabled={!canAccessLibrary}
        >
          <Icon name="save" />
          Create
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default CreateWorkbenchModal;
