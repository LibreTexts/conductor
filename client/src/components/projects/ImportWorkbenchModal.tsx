import React, { useEffect, useState } from "react";
import {
  Button,
  Dropdown,
  Form,
  Icon,
  Message,
  Modal,
  ModalProps,
} from "semantic-ui-react";
import { Controller, get, useForm } from "react-hook-form";
import { required } from "../../utils/formRules";
import { CentralIdentityApp } from "../../types";
import CtlTextInput from "../ControlledInputs/CtlTextInput";
import { useTypedSelector } from "../../state/hooks";
import useGlobalError from "../error/ErrorHooks";
import axios from "axios";
import api from "../../api";
import { getCentralAuthInstructorURL } from "../../utils/centralIdentityHelpers";
import TeamAccessWarningModal from "./TeamAccessWarningModal";

interface ImportWorkbenchModalProps extends ModalProps {
  show: boolean;
  projectID: string;
  projectTitle: string;
  project: any;
  onClose: () => void;
  onSuccess: () => void;
}
interface ImportWorkbenchForm {
  library: number | string;
  pbBookURL: string;
  title: string;

}

interface TeamMemberWithoutAccess {
  uuid: string;
  firstName: string;
  lastName: string;
  avatar: string;
}

const ImportWorkbenchModal: React.FC<ImportWorkbenchModalProps> = (props) => {
  const {
    show,
    projectID,
    projectTitle,
    project,
    onClose,
    onSuccess,
    ...rest
  } = props;
  const teamMembers = [
    ...(project?.auditors || []),
    ...(project?.leads || []),
    ...(project?.liaisons || []),
    ...(project?.members || []),
  ].map((member) => {
    return {
      uuid: member.uuid,
      firstName: member.firstName,
      lastName: member.lastName,
      avatar: member.avatar,
    };
  });

  const { handleGlobalError } = useGlobalError();
  const user = useTypedSelector((state) => state.user);
  const { control, getValues, setValue, reset, trigger, formState, watch } =
    useForm<ImportWorkbenchForm>({
      defaultValues: {
        library: "",
        pbBookURL: "",
      },
    });
  const [loading, setLoading] = useState(false);
  const [libraryOptsLoading, setLibraryOptsLoading] = useState(false);
  const [libraryOptions, setLibraryOptions] = useState<CentralIdentityApp[]>(
    [],
  );
  const [showAccessWarning, setShowAccessWarning] = useState(false);
  const [membersWithoutAccess, setMembersWithoutAccess] = useState<
    TeamMemberWithoutAccess[]
  >([]);
  const [selectedLibraryName, setSelectedLibraryName] = useState("");
  const [canAccessLibrary, setCanAccessLibrary] = useState(true);

  const selectedLibrary = watch("library");

  useEffect(() => {
    if (show) {
      reset(); // reset form on open
      loadLibraries();
      setValue("pbBookURL", projectTitle);
    }
  }, [show]);

  async function loadLibraries() {
    try {
      setLibraryOptsLoading(true);
      const res = await axios.get("/central-identity/public/apps");
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.applications) throw new Error("No libraries found");

      const libraries = res.data.applications.filter(
        (a: CentralIdentityApp) => a.app_type === "library",
      );

      if (!libraries.length) throw new Error("No libraries found");
      setLibraryOptions(libraries);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLibraryOptsLoading(false);
    }
  }

  useEffect(() => {
    checkLibraryAccess();
  }, [user, selectedLibrary]);

  useEffect(() => {
    if (selectedLibrary) {
      const libraryObj = libraryOptions.find(
        (lib) => lib.id.toString() === selectedLibrary.toString(),
      );
      if (libraryObj) {
        setSelectedLibraryName(libraryObj.name);
      }
    }
  }, [selectedLibrary, libraryOptions]);

  async function checkLibraryAccess() {
    try {
      if (!user.uuid || !getValues("library")) return;
      const res = await axios.get(
        `/central-identity/users/${user.uuid}/applications/${getValues(
          "library",
        )}`,
      );
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      setCanAccessLibrary(res.data.hasAccess ?? false);
    } catch (err) {
      handleGlobalError(err);
    }
  }

  async function checkTeamMembersAccess() {
    try {
      if (!teamMembers.length || !getValues("library")) return [];
      const ids = teamMembers.map((member) => member.uuid);

      const res = await api.checkTeamLibraryAccess(getValues("library"), ids);

      const withoutAccess = teamMembers.filter(
        (member) =>
          !res.data.accessResults.find(
            (result: any) => result.id === member.uuid,
          )?.hasAccess,
      );
      return withoutAccess;
    } catch (err) {
      handleGlobalError(err);
      return [];
    }
  }

  async function createWorkbench() {
    try {
      if (!canAccessLibrary) return;
      setLoading(true);
      if (!(await trigger())) return;
      
      const res = await axios.post("/commons/import-pressbooks", {
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

  async function handleCreateClick() {
    try {
      setLoading(true);

      // Check team members' access
      const membersWithoutAccess = await checkTeamMembersAccess();
      if (membersWithoutAccess.length > 0) {
        setMembersWithoutAccess(membersWithoutAccess);
        setShowAccessWarning(true);
        setLoading(false);
        console.error(getValues());
      } else {
        // Everyone has access, proceed with creating the workbench
        await createWorkbench();
      }
    } catch (err) {
      handleGlobalError(err);
      setLoading(false);
    }
  }

  return (
    <>
      <Modal size="fullscreen" open={show} {...rest}>
        <Modal.Header>Import Book</Modal.Header>
        <Modal.Content>
          <p id="bookInstructions">
            This imports a book from a library into this Conductor project.
          </p>

          <Form
            onSubmit={(e) => {
              e.preventDefault();
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
                    loading={libraryOptsLoading}
                    disabled={libraryOptsLoading}
                  />
                )}
              />
              {user.isSuperAdmin && (
                <>
                  {/* Super Admins can use the dev library for debugging */}
                  <p
                    className="underline cursor-pointer mt-1"
                    onClick={() => setValue("library", 21, { shouldDirty: true })}
                  >
                    Use Dev (Super Admins Only)
                  </p>
                </>
              )}
            </div>
            <div className="mt-4">
              <CtlTextInput
                control={control}
                name="pbBookURL"
                label="Book URL"
                placeholder="Enter Book URL"
                type="url"
                required
                rules={required}
              />
            </div>
            <div className="mt-4">
              <CtlTextInput
                control={control}
                name="title"
                label="Book Title"
                placeholder="Enter Book Title"
                // required
                // rules={required}
              />
            </div>
            <div className="mt-4">
            <p>
              <strong>CAUTION:</strong> Book Title cannot be changed after book is
              imported! Leaving this blank will use the title from the book Metadata.
            </p></div>
          </Form>
          {!canAccessLibrary && (
            <Message warning>
              <Message.Header>Cannot Access Library</Message.Header>
              <p>
                Oops, it looks like you do not have access to this library. If
                you need to request access, please submit or update your
                instructor verification request here:{" "}
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
            onClick={handleCreateClick}
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
      <TeamAccessWarningModal
        open={showAccessWarning}
        selectedLibraryName={selectedLibraryName}
        membersWithoutAccess={membersWithoutAccess}
        onClose={() => {
          setShowAccessWarning(false);
          setLoading(false);
        }}
        onCreateWithWarning={() => {
          setShowAccessWarning(false);
          createWorkbench();
        }}
      />
    </>
  );
};

export default ImportWorkbenchModal;
