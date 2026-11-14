import {
  Alert,
  Button,
  Input,
  Link as DavisLink,
  Modal,
  Select,
  Stack,
  Text,
} from "@libretexts/davis-react";
import { IconDeviceFloppy } from "@tabler/icons-react";
import useGlobalError from "../error/ErrorHooks";
import axios from "axios";
import { Controller, useForm } from "react-hook-form";
import { required } from "../../utils/formRules";
import { useEffect, useMemo, useState } from "react";
import { useTypedSelector } from "../../state/hooks";
import { CreateWorkbenchForm } from "../../types";
import TeamAccessWarningModal from "./TeamAccessWarningModal";
import api from "../../api";
import useClientConfig from "../../hooks/useClientConfig";
import { useNotifications } from "../../context/NotificationContext";
import useProjectTeamLibraryAccess from "../../hooks/useProjectTeamLibraryAccess";
import useLibraries from "../../hooks/useLibraries";

interface CreateWorkbenchModalProps {
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
}) => {
  const teamMembers = [
    ...(project?.auditors || []),
    ...(project?.leads || []),
    ...(project?.liaisons || []),
    ...(project?.members || []),
  ].map((member) => ({
    uuid: member.uuid,
    firstName: member.firstName,
    lastName: member.lastName,
    avatar: member.avatar,
  }));

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

  const { libraries, isLoading: librariesLoading } = useLibraries({
    enabled: show,
  });
  const { access, isFetching: accessLoading } = useProjectTeamLibraryAccess(
    projectID,
    watch("library")
  );

  const selectedLibrary = watch("library");
  const selectedLibraryTitle = useMemo(() => {
    const library = libraries?.find((lib) => lib.subdomain === selectedLibrary);
    return library ? library.title : "";
  }, [selectedLibrary, libraries]);

  const libraryOptions = useMemo(
    () =>
      (libraries || []).map((l) => ({
        value: l.subdomain,
        label: l.title,
      })),
    [libraries]
  );

  useEffect(() => {
    if (show) {
      reset();
      setBlockingNotice(null);
      setValue("title", projectTitle);
    }
  }, [show]);

  const userCanAccessLibrary = useMemo(() => {
    if (!selectedLibrary) return true;
    if (user.isSupport || user.isSuperAdmin) return true;
    if (accessLoading) return true;
    return (
      access?.find((result: any) => result.id === user.uuid)?.hasAccess ?? false
    );
  }, [
    access,
    accessLoading,
    selectedLibrary,
    user.uuid,
    user.isSupport,
    user.isSuperAdmin,
  ]);

  const membersWithoutAccess = useMemo(() => {
    if (accessLoading) return [];
    return teamMembers.filter(
      (member) =>
        !access?.find((result: any) => result.id === member.uuid)?.hasAccess
    );
  }, [access, accessLoading, teamMembers]);

  const titleErrorMessage = formState.errors.title?.message;

  async function handleCreateClick() {
    try {
      if (!userCanAccessLibrary) return;
      if (loading) return;

      setLoading(true);

      if (membersWithoutAccess.length > 0) {
        setShowAccessWarning(true);
        setLoading(false);
      } else {
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
      <Modal size="lg" open={show} onClose={(v) => !v && onClose()}>
        <Modal.Header>
          <Modal.Title>Create Book</Modal.Title>
        </Modal.Header>
        <Modal.Body className="overflow-y-auto max-h-[calc(100dvh-10rem)]">
          <Stack direction="vertical" gap="md">
            <Text size="sm" className="text-slate-700" id="bookInstructions">
              This creates an empty book on your chosen library and links it to
              this Conductor project.
            </Text>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateClick();
              }}
              className="space-y-4"
            >
              <div>
                <Controller
                  name="library"
                  control={control}
                  rules={required}
                  render={({ field }) => (
                    <Select
                      name={field.name}
                      label="Library"
                      required
                      placeholder={
                        librariesLoading
                          ? "Loading libraries..."
                          : "Select Library..."
                      }
                      options={libraryOptions}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value)}
                      error={!!formState.errors.library}
                      errorMessage="Please select a library."
                      disabled={librariesLoading || loading}
                    />
                  )}
                />
                {user.isSuperAdmin && (
                  <button
                    type="button"
                    className="mt-1.5 text-xs font-medium text-primary underline hover:text-primary-600"
                    onClick={() =>
                      setValue("library", "dev", { shouldDirty: true })
                    }
                  >
                    Use Dev (Super Admins Only)
                  </button>
                )}
              </div>

              <Controller
                name="title"
                control={control}
                rules={required}
                render={({ field }) => (
                  <Input
                    name={field.name}
                    label="Book Title"
                    placeholder="Enter Book Title"
                    required
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value)}
                    error={!!titleErrorMessage}
                    errorMessage={titleErrorMessage}
                    disabled={loading}
                    helperText="This is the title of your book. It does not need to be unique."
                  />
                )}
              />

              <Alert
                variant="warning"
                message="CAUTION: Library cannot be changed after book is created! Please check your selection before submitting."
              />
            </form>

            {blockingNotice && (
              <Alert
                variant="error"
                title="Cannot Create Book"
                message={blockingNotice}
              />
            )}

            {!userCanAccessLibrary && (
              <Alert
                variant="warning"
                title="Cannot Access Library"
                message={
                  clientConfig?.instructor_verification_url
                    ? `You do not have access to this library yet. Please submit or update your instructor verification request at ${clientConfig.instructor_verification_url}`
                    : "You do not have access to this library yet. Please contact our Support Center."
                }
                action={
                  clientConfig?.instructor_verification_url
                    ? {
                        label: "Open Verification Request",
                        onClick: () =>
                          window.open(
                            clientConfig.instructor_verification_url,
                            "_blank",
                            "noopener,noreferrer"
                          ),
                      }
                    : {
                        label: "Contact Support",
                        onClick: () =>
                          window.open(
                            "https://commons.libretexts.org/support/contact",
                            "_blank",
                            "noopener,noreferrer"
                          ),
                      }
                }
              />
            )}
          </Stack>
        </Modal.Body>
        <Modal.Footer>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={<IconDeviceFloppy size={16} />}
              iconClassName="items-center justify-center"
              onClick={handleCreateClick}
              loading={loading}
              disabled={!userCanAccessLibrary || loading || accessLoading}
            >
              Create
            </Button>
          </div>
        </Modal.Footer>
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
