import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { Avatar, Button, Input, Text } from "@libretexts/davis-react";
import { IconCheck, IconPlus, IconSearch, IconX } from "@tabler/icons-react";
import api from "../../api";
import { User } from "../../types";
import { useNotifications } from "../../context/NotificationContext";
import { useTypedSelector } from "../../state/hooks";
import useDebounce from "../../hooks/useDebounce";

interface TicketAssigneePickerProps {
  ticketId: string;
  assignedUUIDs?: string[];
  /**
   * The already-resolved assignee records carried on the ticket. Used to render
   * chips in read-only mode, where the staff-roster query is never fetched.
   */
  assignedUsers?: AssignableUser[];
  /** When the ticket is closed, render assignees read-only. */
  disabled?: boolean;
  /** DOM id applied to the popover trigger so the header can move focus here. */
  triggerId?: string;
}

type AssignableUser = Pick<
  User,
  "uuid" | "firstName" | "lastName" | "email" | "avatar"
>;

const fullName = (u: AssignableUser) => `${u.firstName} ${u.lastName}`;

const TicketAssigneePicker: React.FC<TicketAssigneePickerProps> = ({
  ticketId,
  assignedUUIDs,
  assignedUsers,
  disabled = false,
  triggerId = "ticket-assignee-trigger",
}) => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();
  const { debounce } = useDebounce();
  const currentUserUUID = useTypedSelector((state) => state.user.uuid);

  const [selected, setSelected] = useState<string[]>(assignedUUIDs ?? []);
  const [search, setSearch] = useState("");

  // Keep local selection in sync with the server value (idempotent after our own saves).
  useEffect(() => {
    setSelected(assignedUUIDs ?? []);
  }, [assignedUUIDs]);

  const { data: assignableUsers } = useQuery<AssignableUser[]>({
    queryKey: ["assignableUsers"],
    queryFn: async () => {
      const res = await api.getSupportAssignableUsers();
      return res.data.users;
    },
    enabled: !!ticketId && !disabled,
  });

  const updateAssignedMutation = useMutation({
    mutationFn: async (assignees: string[]) => {
      if (!ticketId) return;
      const res = await api.assignSupportTicket(ticketId, assignees);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries(["ticket", ticketId]);
      addNotification({
        type: "success",
        message: "Successfully updated assignees.",
      });
    },
    onError: (error: any) => {
      console.error("Error updating assignees:", error);
      // Snap local state back to the server's truth on failure.
      setSelected(assignedUUIDs ?? []);
      addNotification({
        type: "error",
        message:
          error?.response?.data?.errMsg ||
          "An error occurred while updating assignees.",
      });
    },
  });

  // Call the mutation through a ref so the debounced function never closes over a stale mutate.
  const mutateRef = useRef(updateAssignedMutation.mutate);
  mutateRef.current = updateAssignedMutation.mutate;

  const debouncedSave = useMemo(
    () => debounce((assignees: string[]) => mutateRef.current(assignees), 500),
    []
  );

  // Focus the search field when the panel opens, but suppress the browser's
  // scroll-into-view — the portaled panel mounts at the top of the document
  // before Floating UI anchors it, so a plain autoFocus jumps the page to the top.
  const focusSearch = useCallback((node: HTMLDivElement | null) => {
    node?.querySelector("input")?.focus({ preventScroll: true });
  }, []);

  const commit = (next: string[]) => {
    setSelected(next);
    debouncedSave(next);
  };

  const toggle = (uuid: string) => {
    commit(
      selected.includes(uuid)
        ? selected.filter((u) => u !== uuid)
        : [...selected, uuid]
    );
  };

  const selectedUsers = useMemo(
    () => (assignableUsers ?? []).filter((u) => selected.includes(u.uuid)),
    [assignableUsers, selected]
  );

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assignableUsers ?? [];
    return (assignableUsers ?? []).filter((u) =>
      `${fullName(u)} ${u.email}`.toLowerCase().includes(q)
    );
  }, [assignableUsers, search]);

  const canAssignSelf =
    !!currentUserUUID &&
    !selected.includes(currentUserUUID) &&
    (assignableUsers ?? []).some((u) => u.uuid === currentUserUUID);

  // In read-only mode the staff-roster query is disabled, so the editable
  // `selectedUsers` (derived from it) is always empty. Render the assignee
  // records carried on the ticket instead, falling back to any matched from
  // the roster if it happens to be populated.
  const readOnlyUsers =
    assignedUsers && assignedUsers.length > 0 ? assignedUsers : selectedUsers;

  // Read-only rendering for closed tickets: avatars + names, no editing affordances.
  if (disabled) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {readOnlyUsers.length === 0 ? (
          <Text size="sm" color="muted">
            Unassigned
          </Text>
        ) : (
          readOnlyUsers.map((u) => (
            <span
              key={u.uuid}
              className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 py-0.5 pl-0.5 pr-2"
            >
              <Avatar src={u.avatar} name={fullName(u)} size="xs" />
              <Text size="sm">{fullName(u)}</Text>
            </span>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {selectedUsers.map((u) => (
        <span
          key={u.uuid}
          className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 py-0.5 pl-0.5 pr-1"
        >
          <Avatar src={u.avatar} name={fullName(u)} size="xs" />
          <Text size="sm">{fullName(u)}</Text>
          <button
            type="button"
            aria-label={`Remove ${fullName(u)}`}
            onClick={() => toggle(u.uuid)}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <IconX size={14} />
          </button>
        </span>
      ))}

      <Popover className="relative inline-block">
        <PopoverButton
          id={triggerId}
          aria-haspopup="dialog"
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-400 px-2.5 py-1 text-sm text-gray-600 hover:border-gray-600 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <IconPlus size={14} />
          Add assignees
        </PopoverButton>
        <PopoverPanel
          anchor="bottom start"
          className="z-50 mt-1 w-80 rounded-md border border-gray-200 bg-white shadow-lg focus:outline-none [--anchor-gap:4px]"
        >
          {({ close }) => (
            <div className="flex flex-col">
              <div className="p-2" ref={focusSearch}>
                <Input
                  name="assignee-search"
                  label="Search staff"
                  labelClassName="sr-only"
                  placeholder="Search by name or email…"
                  leftIcon={<IconSearch size={16} />}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {canAssignSelf && (
                <div className="px-2 pb-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggle(currentUserUUID)}
                  >
                    Assign to me
                  </Button>
                </div>
              )}

              <div
                role="group"
                aria-label="Assignees"
                className="max-h-64 overflow-y-auto border-t border-gray-100 py-1"
              >
                {filteredUsers.length === 0 ? (
                  <Text size="sm" color="muted" className="block px-3 py-4">
                    No staff match “{search}”.
                  </Text>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelected = selected.includes(u.uuid);
                    return (
                      <div
                        key={u.uuid}
                        role="checkbox"
                        aria-checked={isSelected}
                        tabIndex={0}
                        onClick={() => toggle(u.uuid)}
                        onKeyDown={(e) => {
                          if (e.key === " " || e.key === "Enter") {
                            e.preventDefault();
                            toggle(u.uuid);
                          }
                        }}
                        className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                      >
                        <Avatar src={u.avatar} name={fullName(u)} size="xs" />
                        <span className="flex min-w-0 flex-col">
                          <Text size="sm" className="truncate">
                            {fullName(u)}
                          </Text>
                          <Text size="xs" color="muted" className="truncate">
                            {u.email}
                          </Text>
                        </span>
                        <span
                          aria-hidden="true"
                          className={`ml-auto flex h-5 w-5 items-center justify-center rounded border ${
                            isSelected
                              ? "border-primary bg-primary text-white"
                              : "border-gray-300"
                          }`}
                        >
                          {isSelected && <IconCheck size={14} />}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex justify-end border-t border-gray-100 p-2">
                <Button variant="outline" size="sm" onClick={() => close()}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </PopoverPanel>
      </Popover>

      {updateAssignedMutation.isPending && (
        <Text size="sm" color="muted">
          Saving…
        </Text>
      )}
    </div>
  );
};

export default TicketAssigneePicker;
