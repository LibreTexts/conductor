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
import { useQuery } from "@tanstack/react-query";
import { required } from "../../utils/formRules";
import { useEffect, useState } from "react";
import { useTypedSelector } from "../../state/hooks";
import { CentralIdentityApp, CreateWorkbenchForm } from "../../types";
import TeamAccessWarningModal from './TeamAccessWarningModal';
import api from "../../api";
import useClientConfig from "../../hooks/useClientConfig";
import { useNotifications } from "../../context/NotificationContext";

interface CreateWorkbenchModalProps extends ModalProps {
  show: boolean;
  projectID: string;
  projectTitle: string;
  project: any;
  onClose: () => void;
  onSuccess: () => void;
}

interface TeamMemberWithoutAccess {
  uuid: string;
  firstName: string;
  lastName: string;
  avatar: string;
}

/** How long the title must sit still before we ask the library about it. */
const TITLE_CHECK_DEBOUNCE_MS = 600;

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
  const [libraryOptsLoading, setLibraryOptsLoading] = useState(false);
  const [libraryOptions, setLibraryOptions] = useState<CentralIdentityApp[]>(
    []
  );
  const [showAccessWarning, setShowAccessWarning] = useState(false);
  const [membersWithoutAccess, setMembersWithoutAccess] = useState<TeamMemberWithoutAccess[]>([]);
  const [selectedLibraryName, setSelectedLibraryName] = useState("");
  const [canAccessLibrary, setCanAccessLibrary] = useState(true);
  const [blockingNotice, setBlockingNotice] = useState<string | null>(null);
  const [debouncedTitle, setDebouncedTitle] = useState("");

  const selectedLibrary = watch("library");
  const title = watch("title");

  useEffect(() => {
    if (show) {
      reset(); // reset form on open
      setBlockingNotice(null);
      loadLibraries();
      setValue("title", projectTitle);
    }
  }, [show]);

  // Let the user finish typing before asking the library whether the title is taken.
  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedTitle(title?.trim() ?? ""),
      TITLE_CHECK_DEBOUNCE_MS
    );
    return () => window.clearTimeout(timer);
  }, [title]);

  async function loadLibraries() {
    try {
      setLibraryOptsLoading(true);
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
      setLibraryOptsLoading(false);
    }
  }

  useEffect(() => {
    checkLibraryAccess();
  }, [user, selectedLibrary]);

  useEffect(() => {
    if (selectedLibrary) {
      const libraryObj = libraryOptions.find(lib => lib.id.toString() === selectedLibrary.toString());
      if (libraryObj) {
        setSelectedLibraryName(libraryObj.name);
      }
    }
  }, [selectedLibrary, libraryOptions]);

  /**
   * Advisory availability check so a duplicate title shows up while the field is
   * still editable, rather than as a failed submission. `available: null` means
   * the library couldn't be reached; the server re-checks on submit either way.
   */
  const { data: titleAvailability, isFetching: checkingTitle } = useQuery({
    queryKey: ["book-title-availability", selectedLibrary, debouncedTitle],
    queryFn: async () => {
      const res = await api.checkBookTitleAvailability(
        selectedLibrary,
        debouncedTitle
      );
      if (res.data.err) throw new Error(res.data.errMsg);
      return res.data;
    },
    enabled: show && !!selectedLibrary && !!debouncedTitle,
    retry: false,
  });

  const titleTaken = titleAvailability?.available === false;
  const canCreate = canAccessLibrary && !titleTaken && !loading;

  const titleErrorMessage = (() => {
    if (formState.errors.title?.message) return formState.errors.title.message;
    if (titleTaken) {
      return `A book titled "${debouncedTitle}" already exists on ${
        selectedLibraryName || "this library"
      }. Please choose a different title.`;
    }
    return undefined;
  })();

  /**
   * Status text for the async check. Rendered in a live region so the result is
   * announced rather than only being visible.
   */
  const availabilityStatus = (() => {
    if (!selectedLibrary || !debouncedTitle) return "";
    if (checkingTitle) return "Checking title availability...";
    if (titleTaken) return "This title is already in use on the selected library.";
    if (titleAvailability?.available === true) return "This title is available.";
    return "";
  })();

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

  async function checkTeamMembersAccess() {
    try {
      if (!teamMembers.length || !getValues("library")) return [];
      const ids = teamMembers.map((member) => member.uuid);

      const res = await api.checkTeamLibraryAccess(getValues("library"), ids);

      const withoutAccess = teamMembers.filter(
        (member) => !res.data.accessResults.find((result: any) => result.id === member.uuid)?.hasAccess
      );
      return withoutAccess;
    } catch (err) {
      handleGlobalError(err);
      return [];
    }
  }

  /**
   * Sole owner of the loading state for the create flow: it either hands off to
   * the team-access warning modal (which clears it) or runs the create itself.
   */
  async function handleCreateClick() {
    if (!canCreate) return;
    try {
      setLoading(true);

      // Check team members' access
      const membersWithoutAccess = await checkTeamMembersAccess();
      if (membersWithoutAccess.length > 0) {
        setMembersWithoutAccess(membersWithoutAccess);
        setShowAccessWarning(true);
        setLoading(false);
      } else {
        // Everyone has access, proceed with creating the workbench
        await createWorkbench();
      }
    } catch (err) {
      handleGlobalError(err);
      setLoading(false);
    }
  }

  async function createWorkbench() {
    try {
      if (!canAccessLibrary) return;
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
                    onClick={() => setValue("library", "dev")}
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
                    helperText="Must be unique within the selected library."
                  />
                )}
              />
              <p className="sr-only" aria-live="polite">
                {availabilityStatus}
              </p>
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
          {!canAccessLibrary && (
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
            disabled={!canCreate}
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

export default CreateWorkbenchModal;
