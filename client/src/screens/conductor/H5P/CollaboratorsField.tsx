import { useId, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Combobox, Dialog, Divider, Text } from "@libretexts/davis-react";
import { IconLogout, IconX } from "@tabler/icons-react";
import api from "../../../api";
import useDebounce from "../../../hooks/useDebounce";
import { useNotifications } from "../../../context/NotificationContext";
import { ActivityCollaboratorCandidate, ActivityEditorRole, ActivityPerson } from "../../../types";

/** Matches the server's cap, which Studio set. */
export const MAX_COLLABORATORS = 10;

const fullName = (u: ActivityCollaboratorCandidate) => [u.firstName, u.lastName].filter(Boolean).join(" ");

/** The server's message when it sent one, such as the collaborator cap. */
const errorMessage = (err: unknown, fallback: string): string =>
  (err as any)?.response?.data?.errMsg || fallback;

/**
 * Who may edit an activity, on the edit screen's Sharing section. Owners and
 * LibreTexts staff add and remove collaborators; a collaborator may leave.
 * Changes save at once, apart from the activity's Save, since they are not
 * part of its content.
 */
const CollaboratorsField = ({
  activityID,
  people,
  role,
  currentUserUUID,
}: {
  /** Unset while creating: there is no record to share yet. */
  activityID?: string;
  people: ActivityPerson[];
  role: ActivityEditorRole;
  currentUserUUID?: string;
}) => {
  const history = useHistory();
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();
  const { debounce } = useDebounce();
  const headingID = useId();
  const headingRef = useRef<HTMLSpanElement>(null);
  const [search, setSearch] = useState("");
  const [confirmLeave, setConfirmLeave] = useState(false);

  const isCreate = !activityID;
  const canManage = !isCreate && (role === "owner" || role === "staff");
  const collaboratorCount = people.filter((p) => p.role === "collaborator").length;
  const full = collaboratorCount >= MAX_COLLABORATORS;

  const { data: candidates, isFetching: searching } = useQuery({
    queryKey: ["activity-collaborator-candidates", activityID, search],
    queryFn: async () => (await api.searchActivityCollaborators(activityID!, search)).data.users ?? [],
    enabled: canManage && !full,
    keepPreviousData: true,
    staleTime: 30 * 1000,
  });

  const setPeople = (next: ActivityPerson[]) => {
    queryClient.setQueryData(["activity-authoring", activityID], (old: any) => (old ? { ...old, people: next } : old));
    queryClient.invalidateQueries(["activity-collaborator-candidates", activityID]);
    queryClient.invalidateQueries(["my-activities"]);
  };

  const addMutation = useMutation({
    mutationFn: async (user: ActivityCollaboratorCandidate) => {
      const res = await api.addActivityCollaborator(activityID!, user.uuid);
      if (res.data.err) throw new Error(res.data.errMsg);
      return { people: res.data.people, user };
    },
    onSuccess: ({ people: next, user }) => {
      setPeople(next);
      addNotification({ type: "success", message: `Added ${fullName(user)} as a collaborator.` });
    },
    onError: (err) =>
      addNotification({ type: "error", message: errorMessage(err, "That person could not be added. Try again in a moment.") }),
  });

  const removeMutation = useMutation({
    mutationFn: async (person: ActivityPerson) => {
      const res = await api.removeActivityCollaborator(activityID!, person.uuid);
      if (res.data.err) throw new Error(res.data.errMsg);
      return { ...res.data, person };
    },
    onSuccess: ({ people: next, left, person }) => {
      if (left) {
        queryClient.invalidateQueries(["my-activities"]);
        addNotification({ type: "success", message: "You are no longer a collaborator on this activity." });
        history.push("/h5p");
        return;
      }
      setPeople(next);
      addNotification({ type: "success", message: `Removed ${person.name}.` });
      // The removed row and its button are gone, so focus returns to the list.
      headingRef.current?.focus();
    },
    onError: (err) => {
      setConfirmLeave(false);
      addNotification({ type: "error", message: errorMessage(err, "That change could not be saved. Try again in a moment.") });
    },
  });

  const debouncedSearch = debounce((value: string) => setSearch(value.trim()), 250);

  // "You" only while creating: an existing activity with no owner on record is an orphaned migration.
  const shown = people.length ? people : isCreate ? [{ uuid: "me", name: "You", role: "owner" as const }] : [];

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Text weight="medium">
          <span id={headingID} ref={headingRef} tabIndex={-1} className="outline-none">
            Collaborators
          </span>
        </Text>
        <Divider />
        <ul aria-labelledby={headingID} className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
          {shown.map((p) => {
            const isSelf = Boolean(currentUserUUID) && p.uuid === currentUserUUID;
            return (
              <li key={p.uuid} className="flex min-h-8 items-center justify-between gap-2">
                <span className="flex min-w-0 flex-col">
                  <Text className="truncate" size="sm">
                    {p.name}
                    {isSelf && p.role === "collaborator" ? " (you)" : ""}
                  </Text>
                  <Text size="sm" color="muted">{p.role === "owner" ? "Owner" : "Can edit"}</Text>
                </span>
                {p.role === "collaborator" && canManage && (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<IconX size={16} aria-hidden="true" />}
                    aria-label={`Remove ${p.name}`}
                    loading={removeMutation.isLoading && removeMutation.variables?.uuid === p.uuid}
                    softDisabled={removeMutation.isLoading}
                    onClick={() => removeMutation.mutate(p)}
                  >
                    Remove
                  </Button>
                )}
                {p.role === "collaborator" && role === "collaborator" && isSelf && (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<IconLogout size={16} aria-hidden="true" />}
                    onClick={() => setConfirmLeave(true)}
                  >
                    Leave
                  </Button>
                )}
              </li>
            );
          })}
          {!isCreate && !people.length && (
            <li>
              <Text color="muted">No owner on record</Text>
            </li>
          )}
        </ul>
      </div>

      {canManage && (
        <div>
          {full ? (
            <Text size="sm" color="muted">
              Activities can have up to {MAX_COLLABORATORS} collaborators. Remove someone to add another.
            </Text>
          ) : (
            <Combobox<ActivityCollaboratorCandidate>
              value={null}
              by="uuid"
              nullable
              disabled={addMutation.isLoading}
              onChange={(user) => user && addMutation.mutate(user)}
            >
              <Combobox.Label>Add a collaborator</Combobox.Label>
              <Combobox.Input<ActivityCollaboratorCandidate>
                placeholder="Search by name"
                displayValue={() => ""}
                onChange={(e) => debouncedSearch(e.target.value)}
              />
              <Combobox.Options>
                {((candidates ?? []).length > 0 && (candidates ?? []).map((u) => (
                  <Combobox.Option<ActivityCollaboratorCandidate> key={u.uuid} value={u}>
                    {/* The highlighted option has a primary background, so the muted domain turns white there. */}
                    {({ active, focus }) => (
                      <span className="flex flex-col">
                        <span>{fullName(u)}</span>
                        {u.emailDomain && (
                          <span className={`text-sm ${active || focus ? "text-white" : "text-neutral-600"}`}>
                            {u.emailDomain}
                          </span>
                        )}
                      </span>
                    )}
                  </Combobox.Option>
                ))) || <Combobox.Empty>{searching ? "Searching…" : "No matching users."}</Combobox.Empty>
                }
              </Combobox.Options>
            </Combobox>
          )}
          <Text as="p" size="sm" color="muted" className="mt-1.5!">
            Collaborators can edit and save this activity. Only the owner can delete it.
          </Text>
        </div>
      )}

      <Dialog open={confirmLeave} onClose={() => !removeMutation.isLoading && setConfirmLeave(false)} size="sm">
        <Dialog.Header>
          <Dialog.Title>Leave this activity?</Dialog.Title>
        </Dialog.Header>
        <div className="p-6">
          <Text>You will lose edit access. The owner can add you again.</Text>
        </div>
        <Dialog.Footer>
          <Button variant="outline" onClick={() => setConfirmLeave(false)} softDisabled={removeMutation.isLoading}>
            Stay
          </Button>
          <Button
            variant="destructive"
            loading={removeMutation.isLoading}
            onClick={() => {
              const self = people.find((p) => p.uuid === currentUserUUID);
              if (self) removeMutation.mutate(self);
            }}
          >
            Leave
          </Button>
        </Dialog.Footer>
      </Dialog>
    </div>
  );
};

export default CollaboratorsField;
