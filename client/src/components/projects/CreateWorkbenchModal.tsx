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
import { Controller, useForm } from "react-hook-form";
import { Input } from "@libretexts/davis-react";
import { required } from "../../utils/formRules";
import { useEffect, useMemo, useState } from "react";
import { useTypedSelector } from "../../state/hooks";
import { CreateWorkbenchForm } from "../../types";
import TeamAccessWarningModal from './TeamAccessWarningModal';
import api from "../../api";
import useClientConfig from "../../hooks/useClientConfig";
import { useNotifications } from "../../context/NotificationContext";
import useProjectTeamLibraryAccess from "../../hooks/useProjectTeamLibraryAccess";
import useLibraries from "../../hooks/useLibraries";

interface CreateWorkbenchModalProps extends ModalProps {
  show: boolean;
  projectID: string;
  projectTitle: string;
  project: any;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateWorkbenchModal: React.FC<CreateWorkbenchModalProps> = ({
  show,
  projectID,
  projectTitle,
  onClose,
  onSuccess,
  project,
  ...rest
}) => {
  const teamMembers = [
    ...(project?.auditors || []),
    ...(project?.leads || []),
    ...(project?.liaisons || []),
    ...(project?.members || [])
  ].map(member => {
    return {
      uuid: member.uuid,
      firstName: member.firstName,
      lastName: member.lastName,
      avatar: member.avatar,
    };
  });
  const { handleGlobalError } = useGlobalError();
  const { addNotification } = useNotifications();
  const { clientConfig } = useClientConfig();
  const user = useTypedSelector((state) => state.user);
  const {
    control,
    getValues,
    setValue,
    setError,
    clearErrors,
    reset,
    trigger,
    formState,
    watch,
  } = useForm<CreateWorkbenchForm>({
    defaultValues: {
      library: "",
      title: "",
    },
  });

  const [loading, setLoading] = useState(false);
  const [showAccessWarning, setShowAccessWarning] = useState(false);
  const [blockingNotice, setBlockingNotice] = useState<string | null>(null);

  const { libraries, isLoading: librariesLoading } = useLibraries({ enabled: show });
  const { access, isFetching: accessLoading } = useProjectTeamLibraryAccess(
    projectID,
    watch("library")
  );

  const selectedLibrary = watch("library");
  const selectedLibraryTitle = useMemo(() => {
    const library = libraries?.find(lib => lib.subdomain === selectedLibrary);
    return library ? library.title : "";
  }, [selectedLibrary, libraries]);

  useEffect(() => {
    if (show) {
      reset(); // reset form on open
      setBlockingNotice(null);
      setValue("title", projectTitle);
    }
  }, [show]);

  const userCanAccessLibrary = useMemo(() => {
    if (!selectedLibrary) return true; // Don't show access warning if no library is selected
    if (user.isSupport || user.isSuperAdmin) return true; // Support and super admins always have access
    if (accessLoading) return true; // Don't warn while the check for the new library is in flight
    return access?.find((result: any) => result.id === user.uuid)?.hasAccess ?? false;
  }, [access, accessLoading, selectedLibrary, user.uuid, user.isSupport, user.isSuperAdmin]);

  const membersWithoutAccess = useMemo(() => {
    if (accessLoading) return [];
    return teamMembers.filter(
      (member) => !access?.find((result: any) => result.id === member.uuid)?.hasAccess
    );
  }, [access, accessLoading, teamMembers]);

  const titleErrorMessage = formState.errors.title?.message;

  /**
   * Sole owner of the loading state for the create flow: it either hands off to
   * the team-access warning modal (which clears it) or runs the create itself.
   */
  async function handleCreateClick() {
    try {
      if (!userCanAccessLibrary) return;
      if (loading) return;

      setLoading(true);

      // Check team members' access
      if (membersWithoutAccess.length > 0) {
        setShowAccessWarning(true);
        setLoading(false);
      } else {
        // Proceed with creating the workbench since all members have access
        await createWorkbench();
      }
    } catch (err) {
      handleGlobalError(err);
      setLoading(false);
    }
  }

  async function createWorkbench() {
    try {
      if (!userCanAccessLibrary) return;
      setLoading(true);
      clearErrors("title");
      setBlockingNotice(null);
      if (!(await trigger())) return;

      const res = await api.createWorkbench(getValues(), projectID);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      // The book exists; a warning here means an optional extra (first chapter,
      // team permissions) didn't land. This is not a failure, so it must not go
      // through the global error modal.
      res.data.warnings?.forEach((message) =>
        addNotification({ message, type: "info", duration: 10000 })
      );
      onSuccess();
    } catch (err) {
      handleSubmitError(err);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Recoverable problems stay in the modal and point at the field the user needs
   * to change. Only genuinely unexpected failures go to the global error modal,
   * which closes over the form and loses what they typed.
   */
  function handleSubmitError(err: unknown) {
    const code = axios.isAxiosError(err)
      ? (err.response?.data as { code?: string } | undefined)?.code
      : undefined;
    const errMsg = axios.isAxiosError(err)
      ? (err.response?.data as { errMsg?: string } | undefined)?.errMsg
      : undefined;

    if (code === "title_conflict") {
      setError("title", {
        type: "conflict",
        message:
          errMsg ??
          "A book with this title already exists on the selected library. Please choose a different title.",
      });
      return;
    }

    if (code === "already_linked" || code === "no_library_access") {
      setBlockingNotice(errMsg ?? "This book could not be created.");
      return;
    }

    handleGlobalError(err);
  }

  return (
    <>
      <Modal size="fullscreen" open={show} {...rest}>
        <Modal.Header>Create Book</Modal.Header>
        <Modal.Content>
          <p id="bookInstructions">This creates an empty book on your chosen library and links it to this Conductor project.</p>
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateClick();
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
                    options={libraries?.map((l) => ({
                      key: l.subdomain,
                      text: l.title,
                      value: l.subdomain,
                    }))}
                    {...field}
                    onChange={(e, data) => field.onChange(data.value)}
                    fluid
                    selection
                    placeholder="Select Library..."
                    error={formState.errors.library ? true : false}
                    loading={librariesLoading}
                    disabled={librariesLoading}
                  />
                )}
              />
              {user.isSuperAdmin && (
                <>
                  {/* Super Admins can use the dev library for debugging */}
                  <p
                    className="underline cursor-pointer mt-2!"
                    onClick={() => setValue("library", "dev", { shouldDirty: true })}
                  >
                    Use Dev (Super Admins Only)
                  </p>
                </>
              )}
            </div>
            <div className="mt-4">
              <Controller
                name="title"
                control={control}
                rules={required}
                render={({ field }) => (
                  <Input
                    name={field.name}
                    id={field.name}
                    label="Book Title"
                    placeholder="Enter Book Title"
                    required
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value)}
                    error={!!titleErrorMessage}
                    errorMessage={titleErrorMessage}
                    helperText="This is the title of your book. It does not need to be unique."
                  />
                )}
              />
            </div>
            <p>
              <strong>CAUTION:</strong> Library cannot be changed after book is
              created! Please check your selection before submitting.
            </p>
          </Form>
          {blockingNotice && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4">
              <p className="font-semibold text-red-800">
                Cannot Create Book
              </p>
              <p className="mt-1 text-sm text-red-700">{blockingNotice}</p>
            </div>
          )}
          {!userCanAccessLibrary && (
            <Message warning>
              <Message.Header>Cannot Access Library</Message.Header>
              <p>
                Oops, it looks like you do not have access to this library. If you
                need to request access, please {" "}{
                  clientConfig?.instructor_verification_url ? (
                    <>
                      <span>
                        submit or update your instructor
                        verification request here: {" "}
                      </span>
                      <a href={clientConfig?.instructor_verification_url} target="_blank" rel="noopener noreferrer">
                        {clientConfig?.instructor_verification_url}
                      </a>
                    </>
                  ) : (
                    <a href="https://commons.libretexts.org/support/contact" target="_blank" rel="noopener noreferrer">
                      contact our Support Center.
                    </a>
                  )
                }
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
            disabled={!userCanAccessLibrary || loading || accessLoading}
          >
            <Icon name="save" />
            Create
          </Button>
        </Modal.Actions>
      </Modal>
      <TeamAccessWarningModal
        open={showAccessWarning}
        selectedLibraryName={selectedLibraryTitle}
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

export default CreateWorkbenchModal;
