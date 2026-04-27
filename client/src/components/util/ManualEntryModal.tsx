import { Modal, Form, Button, Dropdown, Icon } from "semantic-ui-react";
import useDebounce from "../../hooks/useDebounce";
import useGlobalError from "../error/ErrorHooks";
import { useState } from "react";
import { Author, GenericKeyTextValueObj } from "../../types";
import api from "../../api";

interface ManualEntryModalProps {
  show: boolean;
  onClose: () => void;
  onSaved: (author: Author, ctx: string) => void;
  ctx: string;
}

const ManualEntryModal: React.FC<ManualEntryModalProps> = ({
  show,
  onClose,
  onSaved,
  ctx
}) => {
  const { handleGlobalError } = useGlobalError();
  const { debounce } = useDebounce();

  const [orgOptions, setOrgOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [newAuthor, setNewAuthor] = useState<Author>({
    firstName: "",
    lastName: "",
    email: "",
    url: "",
    primaryInstitution: "",
  });

  const clearNewAuthor = () => {
    setNewAuthor({
      firstName: "",
      lastName: "",
      email: "",
      url: "",
      primaryInstitution: "",
    });
  };

  async function getOrgs(searchQuery?: string) {
    try {
      setLoadingOrgs(true);
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
      setLoadingOrgs(false);
    }
  }

  const getOrgsDebounced = debounce(
    (inputVal: string) => getOrgs(inputVal),
    200
  );

  const handleClose = () => {
    clearNewAuthor();
    onClose();
  };

  return (
    <Modal open={show} onClose={handleClose}>
      <Modal.Content>
        <h3 className="text-xl font-semibold mb-4">Add New Author</h3>
        <div className="flex flex-row">
          <Form.Field className="!w-full">
            <label
              className="form-field-label form-required"
              htmlFor={"newAuthorFirstID"}
            >
              First Name
            </label>
            <Form.Input
              id={"newAuthorFirstID"}
              placeholder="John"
              value={newAuthor.firstName}
              onChange={(e) =>
                setNewAuthor({
                  ...newAuthor,
                  firstName: e.target.value,
                })
              }
              required
              fluid
              key={"newAuthorFirstName"}
            />
          </Form.Field>
          <Form.Field className="!w-full !ml-4">
            <label
              className="form-field-label form-required"
              htmlFor={"newAuthorLastID"}
            >
              Last Name
            </label>
            <Form.Input
              id={"newAuthorLastID"}
              placeholder="Doe"
              value={newAuthor.lastName}
              onChange={(e) =>
                setNewAuthor({
                  ...newAuthor,
                  lastName: e.target.value,
                })
              }
              required
              fluid
              key={"newAuthorLastName"}
            />
          </Form.Field>
        </div>
        <div className="flex flex-row mt-4">
          <Form.Field className="!w-full">
            <label className="form-field-label" htmlFor={"newAuthorEmailID"}>
              Email
            </label>
            <Form.Input
              id={"newAuthorEmailID"}
              placeholder="johndoe@example.com"
              value={newAuthor.email}
              onChange={(e) =>
                setNewAuthor({
                  ...newAuthor,
                  email: e.target.value,
                })
              }
              fluid
              key={"newAuthorEmail"}
            />
          </Form.Field>
          <Form.Field className="!w-full !ml-4">
            <label className="form-field-label" htmlFor={"newAuthorUrlID"}>
              URL
            </label>
            <Form.Input
              id={"newAuthorUrlID"}
              placeholder="https://example.com"
              value={newAuthor.url}
              fluid
              onChange={(e) =>
                setNewAuthor({
                  ...newAuthor,
                  url: e.target.value,
                })
              }
              key={"newAuthorUrl"}
            />
          </Form.Field>
        </div>
        <Form.Field className="flex flex-col !mt-4">
          <label
            id={"newAuthorPrimaryInstitutionID"}
            className="form-field-label"
          >
            Primary Institution
          </label>
          <Dropdown
            id={"newAuthorPrimaryInstitutionID"}
            placeholder="Search organizations..."
            options={orgOptions}
            onChange={(e, { value }) => {
              setNewAuthor({
                ...newAuthor,
                primaryInstitution: value?.toString() ?? "",
              });
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
            loading={loadingOrgs}
            onAddItem={(e, { value }) => {
              if (value) {
                orgOptions.push({
                  text: value.toString(),
                  value: value.toString(),
                  key: value.toString(),
                });
                setNewAuthor({
                  ...newAuthor,
                  primaryInstitution: value.toString(),
                });
              }
            }}
            key={"newAuthorPrimaryInstitution"}
          />
        </Form.Field>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={handleClose}>
          <Icon name="close" />
          Cancel
        </Button>
        <Button
          onClick={() => {
            onSaved(newAuthor, ctx);
            clearNewAuthor();
          }}
          color="blue"
          disabled={!newAuthor.firstName.trim() || !newAuthor.lastName.trim()}
        >
          <Icon name="plus" />
          Add Author
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default ManualEntryModal;
