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
import ConfirmDeletePersonModal from "./ConfirmDeletePersonModal";
import { useTypedSelector } from "../../../state/hooks";

interface ManagePersonModalProps extends ModalProps {
  show: boolean;
  onClose: () => void;
  personID?: string;
}

const ManagePersonModal: React.FC<ManagePersonModalProps> = ({
  show,
  onClose,
  personID,
  ...rest
}) => {
  const org = useTypedSelector((state) => state.org);
  const { debounce } = useDebounce();
  const { handleGlobalError } = useGlobalError();
  const { control, getValues, trigger, reset } = useForm<Author>({
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      url: "",
      primaryInstitution: "",
    },
  });

  const [mode, setMode] = useState<"create" | "edit">("create");
  const [orgOptions, setOrgOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [loadedOrgs, setLoadedOrgs] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState<boolean>(false);

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
      if (personID) {
        setMode("edit");
        loadAuthor();
      } else {
        setMode("create");
        resetForm();
      }
    } else {
      resetForm();
    }
  }, [show, personID]);

  async function loadAuthor() {
    try {
      if (!personID) {
        throw new Error("Invalid author ID.");
      }

      setLoading(true);
      const res = await api.getAuthor(personID);
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

      const clearOption: GenericKeyTextValueObj<string> = {
        key: crypto.randomUUID(),
        text: "Clear selection",
        value: "",
      };

      // If org has custom org list, use that instead of fetching from server
      if(org.customOrgList && org.customOrgList.length > 0){
        const orgs = org.customOrgList.map((org) => {
          return {
            value: org,
            key: crypto.randomUUID(),
            text: org,
          };
        });

        setOrgOptions([clearOption, ...orgs]);
        return;
      }

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
    if (mode === "edit" && personID) {
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
      if (!valid || !personID) {
        return;
      }

      setLoading(true);
      const values = getValues();
      const editRes = await api.updateAuthor(personID, values);

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

  async function handleDeleted() {
    setShowConfirmDelete(false);
    onClose();
  }

  return (
    <Modal open={show} onClose={onClose} {...rest}>
      <Modal.Header>
        {mode === "create" ? "Create" : "Edit"} Person
      </Modal.Header>
      <Modal.Content>
        <Form onSubmit={(e) => e.preventDefault()} loading={loading}>
          <CtlTextInput
            control={control}
            name="firstName"
            label="First Name"
            placeholder="John"
            rules={required}
            required
          />
          <CtlTextInput
            control={control}
            name="lastName"
            label="Last Name"
            placeholder="Doe"
            rules={required}
            required
            className="mt-4"
          />
          <CtlTextInput
            control={control}
            name="email"
            label="Email"
            placeholder="johndoe@example.com"
            className="mt-4"
          />
          <CtlTextInput
            control={control}
            name="url"
            label="URL"
            placeholder="https://example.com"
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
                />
              )}
              name="primaryInstitution"
              control={control}
            />
          </Form.Field>
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <div className="flex flex-row justify-between items-center">
          {mode === "edit" && personID && (
            <Button
              color="red"
              icon="trash alternate outline"
              onClick={() => setShowConfirmDelete(true)}
            ></Button>
          )}
          <div>
            <Button onClick={onClose} loading={loading}>
              Cancel
            </Button>
            <Button color="green" onClick={handeSubmit} loading={loading}>
              <Icon name="save" /> {mode === "create" ? "Create" : "Save"}
            </Button>
          </div>
        </div>
      </Modal.Actions>
      {personID && (
        <ConfirmDeletePersonModal
          show={showConfirmDelete}
          onCancel={() => setShowConfirmDelete(false)}
          onDeleted={handleDeleted}
          personID={personID}
        />
      )}
    </Modal>
  );
};

export default ManagePersonModal;
