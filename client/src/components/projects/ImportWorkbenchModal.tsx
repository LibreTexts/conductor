import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button, Input, Modal, Select } from "@libretexts/davis-react";
import { IconDeviceFloppy } from "@tabler/icons-react";
import { Controller, useForm } from "react-hook-form";
import { httpUrl, required } from "../../utils/formRules";
import { CreateWorkbenchForm, ImportWorkbenchForm } from "../../types";
import { useTypedSelector } from "../../state/hooks";
import useGlobalError from "../error/ErrorHooks";
import axios from "axios";
import TeamAccessWarningModal from "./TeamAccessWarningModal";
import useClientConfig from "../../hooks/useClientConfig";
import api from "../../api";
import useLibraries from "../../hooks/useLibraries";
import useProjectTeamLibraryAccess from "../../hooks/useProjectTeamLibraryAccess";

interface ImportWorkbenchModalProps {
  show: boolean;
  projectID: string;
  project: any;
  onClose: () => void;
  onSuccess: () => void;
  initialJobID?: string | null;
  initialJobStatus?: "pending" | "running" | "success" | "error";
  initialJobMessages?: string[];
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
    project,
    onClose,
    onSuccess,
    initialJobID,
    initialJobStatus,
    initialJobMessages,
  } = props;
  const teamMembers: TeamMemberWithoutAccess[] = useMemo(
    () =>
      [
        ...(project?.auditors || []),
        ...(project?.leads || []),
        ...(project?.liaisons || []),
        ...(project?.members || []),
      ].map((member) => ({
        uuid: member.uuid,
        firstName: member.firstName,
        lastName: member.lastName,
        avatar: member.avatar,
      })),
    [project]
  );
  const { clientConfig } = useClientConfig();

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
  const [showAccessWarning, setShowAccessWarning] = useState(false);
  const [jobID, setJobID] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<
    "idle" | "pending" | "running" | "success" | "error"
  >("idle");
  const [jobMessages, setJobMessages] = useState<string[]>([]);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!messagesContainerRef.current) return;
    messagesContainerRef.current.scrollTop =
      messagesContainerRef.current.scrollHeight;
  }, [jobMessages]);


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

  const userCanAccessLibrary = useMemo(() => {
    if (!selectedLibrary) return true; // Don't show access warning if no library is selected
    if (user.isSupport || user.isSuperAdmin) return true; // Support and super admins always have access
    if (accessLoading) return true; // Don't warn while the check for the new library is in flight
    return access?.find((result: any) => result.id === user.uuid)?.hasAccess ?? false;
  }, [access, accessLoading, selectedLibrary, user.uuid, user.isSupport, user.isSuperAdmin]);

  const membersWithoutAccess = useMemo(() => {
    if (accessLoading) return [];
    return teamMembers.filter(
      (member) =>
        !access?.find((result: any) => result.id === member.uuid)?.hasAccess
    );
  }, [access, accessLoading, selectedLibrary, teamMembers]);

  useEffect(() => {
    if (show) {
      reset();
      setShowAccessWarning(false);
      // An in-flight import is owned by jobID and keeps polling while the modal
      // is closed, so only clear the state that describes this modal session.
      if (!jobID) {
        setLoading(false);
        setJobStatus("idle");
        setJobMessages([]);
      }
    }
  }, [show]);

  const adoptedInitialJobRef = useRef<string | null>(null);

  useEffect(() => {
    if (!show) return;
    if (!initialJobID) return;
    // Re-running this on a refetch of the parent query would overwrite the
    // status and messages the poller has since collected.
    if (adoptedInitialJobRef.current === initialJobID) return;
    adoptedInitialJobRef.current = initialJobID;

    setJobID(initialJobID);
    if (initialJobStatus) {
      setJobStatus(initialJobStatus);
    } else {
      setJobStatus("pending");
    }
    if (Array.isArray(initialJobMessages)) {
      setJobMessages(initialJobMessages);
    }
    setLoading(true);
  }, [show, initialJobID, initialJobStatus, initialJobMessages]);

  const { mutateAsync: createWorkbench } = useMutation({
    mutationFn: async () => {
      if (!(await trigger())) return null;
      const res = await api.createPressbooksJob(getValues(), projectID);
      if (res.data.err) throw new Error(res.data.errMsg);
      if (!res.data.jobID) throw new Error("Failed to start import job.");
      return res.data.jobID as string;
    },
    onSuccess: (newJobID) => {
      if (!newJobID) {
        setLoading(false);
        return;
      }
      setJobID(newJobID);
      setJobStatus("pending");
      setJobMessages([]);
    },
  });

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollIntervalRef.current !== null) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const { mutate: pollJob } = useMutation({
    mutationFn: async (id: string) => {
      const res = await axios.get(`/commons/import-pressbooks/${id}`);
      if (res.data.err) throw new Error(res.data.errMsg);
      return res.data.job as {
        status: "pending" | "running" | "success" | "error";
        messages?: string[];
        errorMessage?: string;
      };
    },
    onSuccess: (job) => {
      setJobStatus(job.status);
      if (Array.isArray(job.messages)) {
        setJobMessages(job.messages);
      }
      if (job.status === "success") {
        stopPolling();
        setLoading(false);
        setJobID(null);
        onSuccess();
      } else if (job.status === "error") {
        stopPolling();
        setLoading(false);
        setJobID(null);
        handleGlobalError(new Error(job.errorMessage || "Import failed."));
      }
    },
    onError: (err) => {
      stopPolling();
      setLoading(false);
      setJobID(null);
      handleGlobalError(err);
    },
  });

  useEffect(() => {
    if (!jobID) return;

    setJobStatus((current) =>
      current === "idle" || current === "pending" ? "running" : current,
    );

    pollIntervalRef.current = setInterval(() => pollJob(jobID), 3000);

    return stopPolling;
  }, [jobID]);

  async function handleCreateClick() {
    try {
      if (!userCanAccessLibrary || accessLoading) return;
      if (loading) return;

      setLoading(true);
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



  return (
    <>
      <Modal size="full" open={show} onClose={() => onClose()}>
        <Modal.Header>
          <Modal.Title>Import Book</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p id="bookInstructions">
            This imports a book from a Pressbook source into this Conductor project.
          </p>

          <form onSubmit={(e) => e.preventDefault()}>
            <Controller
              name="library"
              control={control}
              rules={required}
              render={({ field }) => (
                <Select
                  name={field.name}
                  label="Library"
                  options={libraries?.map((l) => ({
                    value: l.subdomain,
                    label: l.title,
                    key: l.subdomain,
                  })) || []}
                  value={field.value?.toString() ?? ""}
                  onChange={(e) => field.onChange(e.target.value)}
                  placeholder="Select Library..."
                  error={!!formState.errors.library}
                  errorMessage={formState.errors.library?.message}
                  disabled={librariesLoading}
                  required
                />
              )}
            />
            {user.isSuperAdmin && (
              // Super Admins can use the dev library for debugging
              <p
                className="underline cursor-pointer mt-2!"
                onClick={() => setValue("library", "dev", { shouldDirty: true })}
              >
                Use Dev (Super Admins Only)
              </p>
            )}
            <div className="mt-4">
              <Controller
                name="pbBookURL"
                control={control}
                rules={{ ...required, ...httpUrl }}
                render={({ field }) => (
                  <Input
                    name={field.name}
                    id={field.name}
                    label="Book URL"
                    placeholder="https://pressbooks.pub/example_book"
                    type="url"
                    required
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value)}
                    error={!!formState.errors.pbBookURL}
                    errorMessage={formState.errors.pbBookURL?.message}
                  />
                )}
              />

            </div>
            <div className="mt-4">
              <Controller
                name="title"
                control={control}

                render={({ field }) => (
                  <Input
                    name={field.name}
                    id={field.name}
                    label="Book Title"
                    placeholder="Enter Book Title"
                    required={false}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value)}
                    error={!!formState.errors.title}
                    errorMessage={formState.errors.title?.message}
                  />
                )}
              />
            </div>
            <div className="mt-4">
              <p>
                <strong>CAUTION:</strong> Book Title cannot be changed after book
                is imported! Leaving this blank will use the title from the book
                Metadata.
              </p>
            </div>
          </form>

          {(jobStatus === "pending" || jobStatus === "running") && (
            <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-4">
              <p className="font-semibold text-blue-800">Import in progress</p>
              {jobMessages.length > 0 ? (
                <div
                  className="mt-1"
                  style={{ maxHeight: 200, overflowY: "auto" }}
                  ref={messagesContainerRef}
                >
                  <ul className="ml-4 list-disc text-sm text-blue-700">
                    {jobMessages.map((msg, idx) => (
                      <li key={idx}>{msg}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-1 text-sm text-blue-700">
                  The book is being imported from Pressbooks. This may take a few
                  minutes. Please keep this window open.
                </p>
              )}
            </div>
          )}

          {!userCanAccessLibrary && (
            <div className="mt-4 rounded-md border border-yellow-200 bg-yellow-50 p-4">
              <p className="font-semibold text-yellow-800">
                Cannot Access Library
              </p>
              <p className="mt-1 text-sm text-yellow-700">
                Oops, it looks like you do not have access to this library. If you
                need to request access, please{" "}
                {clientConfig?.instructor_verification_url ? (
                  <>
                    <span>
                      submit or update your instructor verification request
                      here:{" "}
                    </span>
                    <a
                      href={clientConfig.instructor_verification_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      {clientConfig.instructor_verification_url}
                    </a>
                  </>
                ) : (
                  <a
                    href="https://commons.libretexts.org/support/contact"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    contact our Support Center.
                  </a>
                )}
              </p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onClose} loading={loading} iconPosition="left">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateClick}
            loading={loading}
            disabled={!userCanAccessLibrary || accessLoading}
            icon={<IconDeviceFloppy size={16} />}
            iconPosition="left"
          >
            Create
          </Button>
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
        onCreateWithWarning={async () => {
          setShowAccessWarning(false);
          try {
            if (!userCanAccessLibrary) return;
            setLoading(true);
            await createWorkbench();
          } catch (err) {
            handleGlobalError(err);
            setLoading(false);
          }
        }}
      />
    </>
  );
};

export default ImportWorkbenchModal;
