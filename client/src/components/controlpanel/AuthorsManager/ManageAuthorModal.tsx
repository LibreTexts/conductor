import {
  Button,
  Dropdown,
  Form,
  Icon,
  Modal,
  ModalProps,
} from "semantic-ui-react";
import useGlobalError from "../../error/ErrorHooks";
import { Controller, useForm } from "react-hook-form";
import { Author, GenericKeyTextValueObj } from "../../../types";
import CtlTextInput from "../../ControlledInputs/CtlTextInput";
import { required } from "../../../utils/formRules";
import { useEffect, useState } from "react";
import api from "../../../api";
import useDebounce from "../../../hooks/useDebounce";

interface ManageAuthorModalProps extends ModalProps {
  show: boolean;
  onClose: () => void;
  authorID?: string;
}

const ManageAuthorModal: React.FC<ManageAuthorModalProps> = ({
  show,
  onClose,
  authorID,
  ...rest
}) => {
  const { debounce } = useDebounce();
  const { handleGlobalError } = useGlobalError();
  const { control, getValues, trigger, reset } = useForm<Author>({
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      primaryInstitution: "",
    },
  });

  const [mode, setMode] = useState<"create" | "edit">("create");
  const [orgOptions, setOrgOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [loadedOrgs, setLoadedOrgs] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const resetForm = () => {
    reset({
      firstName: "",
      lastName: "",
      email: "",
      primaryInstitution: "",
    });
  };

  useEffect(() => {
    if (show) {
      getOrgs();
      if (authorID) {
        setMode("edit");
        loadAuthor();
      } else {
        setMode("create");
        resetForm();
      }
    } else {
      resetForm();
    }
  }, [show, authorID]);

  async function loadAuthor() {
    try {
      if (!authorID) {
        throw new Error("Invalid author ID.");
      }

      setLoading(true);
      const res = await api.getAuthor(authorID);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.author) {
        throw new Error("Invalid response from server.");
      }

      reset(res.data.author);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function getOrgs(searchQuery?: string) {
    try {
      setLoadedOrgs(false);
      const res = await api.getCentralIdentityADAPTOrgs({
        query: searchQuery ?? undefined,
      });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.orgs || !Array.isArray(res.data.orgs)) {
        throw new Error("Invalid response from server.");
      }

      const orgs = res.data.orgs.map((org) => {
        return {
          value: org,
          key: crypto.randomUUID(),
          text: org,
        };
      });

      const clearOption: GenericKeyTextValueObj<string> = {
        key: crypto.randomUUID(),
        text: "Clear selection",
        value: "",
      };

      setOrgOptions([clearOption, ...orgs]);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoadedOrgs(true);
    }
  }

  const getOrgsDebounced = debounce(
    (inputVal: string) => getOrgs(inputVal),
    200
  );

  async function handeSubmit() {
    if (mode === "edit" && authorID) {
      handleEdit();
    } else {
      handleCreate();
    }
  }

  async function handleCreate() {
    try {
      const valid = await trigger();
      if (!valid) {
        return;
      }

      setLoading(true);
      const values = getValues();
      const createRes = await api.createAuthor(values);

      if (createRes.data.err) {
        throw new Error(createRes.data.errMsg);
      }

      onClose();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleEdit() {
    try {
      const valid = await trigger();
      if (!valid || !authorID) {
        return;
      }

      setLoading(true);
      const values = getValues();
      const editRes = await api.updateAuthor(authorID, values);

      if (editRes.data.err) {
        throw new Error(editRes.data.errMsg);
      }

      onClose();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={show} onClose={onClose} {...rest}>
      <Modal.Header>
        {mode === "create" ? "Create" : "Edit"} Author
      </Modal.Header>
      <Modal.Content>
        <Form onSubmit={(e) => e.preventDefault()} loading={loading}>
          <CtlTextInput
            control={control}
            name="firstName"
            label="First Name"
            placeholder="First Name"
            rules={required}
            required
          />
          <CtlTextInput
            control={control}
            name="lastName"
            label="Last Name"
            placeholder="Last Name"
            rules={required}
            required
            className="mt-4"
          />
          <CtlTextInput
            control={control}
            name="email"
            label="Email"
            placeholder="Email"
            className="mt-4"
          />
          <Form.Field className="flex flex-col !mt-4">
            <label htmlFor="primaryInstitution">Primary Institution</label>
            <Controller
              render={({ field }) => (
                <Dropdown
                  id="primaryInstitution"
                  placeholder="Search organizations..."
                  options={orgOptions}
                  {...field}
                  onChange={(e, { value }) => {
                    field.onChange(value as string);
                  }}
                  fluid
                  selection
                  search
                  onSearchChange={(e, { searchQuery }) => {
                    getOrgsDebounced(searchQuery);
                  }}
                  additionLabel="Add organization: "
                  allowAdditions
                  deburr
                  loading={!loadedOrgs}
                  onAddItem={(e, { value }) => {
                    if (value) {
                      orgOptions.push({
                        text: value.toString(),
                        value: value.toString(),
                        key: value.toString(),
                      });
                      field.onChange(value.toString());
                    }
                  }}
                  renderLabel={(tag) => ({
                    color: "blue",
                    content: tag.text,
                  })}
                />
              )}
              name="primaryInstitution"
              control={control}
            />
          </Form.Field>
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose} loading={loading}>
          Cancel
        </Button>
        <Button color="green" onClick={handeSubmit} loading={loading}>
          <Icon name="save" /> {mode === "create" ? "Create" : "Save"}
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default ManageAuthorModal;
