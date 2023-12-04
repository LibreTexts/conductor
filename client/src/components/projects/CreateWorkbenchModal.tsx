import {
  Button,
  Dropdown,
  Form,
  Icon,
  Modal,
  ModalProps,
} from "semantic-ui-react";
import useGlobalError from "../error/ErrorHooks";
import axios from "axios";
import { Controller, useForm } from "react-hook-form";
import CtlTextInput from "../ControlledInputs/CtlTextInput";
import { libraryOptions } from "../util/LibraryOptions";
import { required } from "../../utils/formRules";
import { useEffect, useState } from "react";

interface CreateWorkbenchModalProps extends ModalProps {
  show: boolean;
  projectID: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface CreateWorkbenchForm {
  library: string;
  title: string;
}

const CreateWorkbenchModal: React.FC<CreateWorkbenchModalProps> = ({
  show,
  projectID,
  onClose,
  onSuccess,
  ...rest
}) => {
  const { handleGlobalError } = useGlobalError();
  const { control, getValues, setValue, reset, trigger, formState } =
    useForm<CreateWorkbenchForm>({
      defaultValues: {
        library: "",
        title: "",
      },
    });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (show) {
      reset(); // reset form on open
    }
  }, [show]);

  async function createWorkbench() {
    try {
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
    <Modal size="fullscreen" {...rest}>
      <Modal.Header>Create Workbench</Modal.Header>
      <Modal.Content>
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
                  options={libraryOptions}
                  {...field}
                  onChange={(e, data) => {
                    field.onChange(data.value?.toString() ?? "text");
                  }}
                  fluid
                  selection
                  placeholder="Select Library..."
                  error={formState.errors.library ? true : false}
                />
              )}
            />
            <p
              className="underline cursor-pointer"
              onClick={() => setValue("library", "dev")}
            >
              Use Dev
            </p>
          </div>
          <div className="mt-4">
            <CtlTextInput
              control={control}
              name="title"
              label="Workbench Title"
              placeholder="Enter Workbench Title"
              required
              rules={required}
            />
          </div>
          <p>
            <strong>CAUTION:</strong> Library cannot be changed after Workbench
            is created. Please check your selection before submitting.
          </p>
        </Form>
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
        >
          <Icon name="save" />
          Create
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default CreateWorkbenchModal;
