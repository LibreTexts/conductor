import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Breadcrumb,
  Button,
  Card,
  Heading,
  Input,
  Spinner,
  Stack,
  Text,
  Textarea,
} from "@libretexts/davis-react";
import {
  IconArchive,
  IconDeviceFloppy,
  IconPlus,
  IconSend,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import ReactMarkdown from "react-markdown";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../../../api";
import useGlobalError from "../../../../components/error/ErrorHooks";
import useDocumentTitle from "../../../../hooks/useDocumentTitle";
import { useNotifications } from "../../../../context/NotificationContext";
import { useModals } from "../../../../context/ModalContext";
import ConfirmModal from "../../../../components/ConfirmModal";
import { useTypedSelector } from "../../../../state/hooks";
import {
  WhatsNewEntryAdmin,
  WhatsNewEntryPayload,
  WhatsNewStatus,
} from "../../../../types";

const WHATS_NEW_QUERY_KEY = ["whats-new-entries"] as const;

const MAX_BODY_LENGTH = 8000;

const STATUS_VARIANTS: Record<
  WhatsNewStatus,
  "default" | "success" | "warning"
> = {
  draft: "warning",
  published: "success",
  archived: "default",
};

type FormState = {
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  expiresAt: string;
  staleAfterDays: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  body: "",
  ctaLabel: "",
  ctaUrl: "",
  expiresAt: "",
  staleAfterDays: "",
};

/** `2026-09-30T12:00:00.000Z` → `2026-09-30`, for a date input. */
function toDateInputValue(iso?: string) {
  return iso ? iso.slice(0, 10) : "";
}

function formatDate(iso?: string) {
  return iso ? new Date(iso).toLocaleString() : "—";
}

/**
 * Authoring UI for the "What's New in Conductor" notice.
 *
 * Only the newest published entry is ever served, and only within its staleness
 * window, so publishing a new entry is what retires the previous one. There is
 * no need to archive the old one first.
 */
const WhatsNewManager = () => {
  useDocumentTitle("LibreTexts Conductor | What's New Manager");
  const { handleGlobalError } = useGlobalError();
  const { addNotification } = useNotifications();
  const { openModal, closeAllModals } = useModals();
  const queryClient = useQueryClient();
  const user = useTypedSelector((state) => state.user);

  const [editingID, setEditingID] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // Mirrors the guard on the Control Panel index. The API enforces this too;
  // this only keeps the screen from rendering for someone who typed the URL.
  // `developer` is the gate, not `superadmin`: authoring a notice shown to every
  // user is a release-engineering act, so the role is granted by hand.
  useEffect(() => {
    if (!user || !user.uuid) return;
    if (!user.isDeveloper) {
      window.location.href = "/home";
    }
  }, [user]);

  const { data, isLoading } = useQuery({
    queryKey: WHATS_NEW_QUERY_KEY,
    queryFn: async () => {
      const res = await api.getWhatsNewEntries({ limit: 50 });
      if (res.data.err) throw new Error(res.data.errMsg);
      return res.data.items;
    },
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
    meta: { errorMessage: "Failed to load What's New entries." },
  });

  const entries = data ?? [];

  /**
   * Which entry users are actually being shown right now. Recomputed here rather
   * than asked of the server so the author sees the same reasoning the read
   * route applies: newest published, inside its window, not expired.
   */
  const activeEntryID = useMemo(() => {
    const now = Date.now();
    const candidates = entries
      .filter((e) => e.status === "published" && e.publishedAt)
      .filter((e) => !e.expiresAt || new Date(e.expiresAt).getTime() > now)
      .filter((e) => {
        const staleDays = e.staleAfterDays ?? 90;
        const age = now - new Date(e.publishedAt as string).getTime();
        return age < staleDays * 86400000;
      })
      .sort(
        (a, b) =>
          new Date(b.publishedAt as string).getTime() -
          new Date(a.publishedAt as string).getTime()
      );
    return candidates[0]?._id ?? null;
  }, [entries]);

  function buildPayload(status?: WhatsNewStatus): WhatsNewEntryPayload {
    return {
      title: form.title.trim(),
      body: form.body.trim(),
      ...(status ? { status } : {}),
      // Empty strings clear the optional fields; `null` is the server's
      // "unset this" signal.
      ctaLabel: form.ctaLabel.trim() || undefined,
      ctaUrl: form.ctaUrl.trim() || undefined,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      staleAfterDays: form.staleAfterDays
        ? Number(form.staleAfterDays)
        : null,
    };
  }

  const saveMutation = useMutation({
    mutationFn: async (vars: { status?: WhatsNewStatus }) => {
      const payload = buildPayload(vars.status);
      const res = editingID
        ? await api.updateWhatsNewEntry(editingID, payload)
        : await api.createWhatsNewEntry(payload);
      if (res.data.err) throw new Error(res.data.errMsg);
      return res.data.entry;
    },
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: WHATS_NEW_QUERY_KEY });
      addNotification({
        message:
          entry.status === "published"
            ? "The entry is published and will be shown to users."
            : "The entry has been saved as a draft.",
        type: "success",
      });
      resetForm();
    },
    onError: (err) => handleGlobalError(err),
  });

  const statusMutation = useMutation({
    mutationFn: async (vars: { id: string; status: WhatsNewStatus }) => {
      const res = await api.updateWhatsNewEntry(vars.id, {
        status: vars.status,
      });
      if (res.data.err) throw new Error(res.data.errMsg);
      return res.data.entry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WHATS_NEW_QUERY_KEY });
      addNotification({ message: "Entry updated.", type: "success" });
    },
    onError: (err) => handleGlobalError(err),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.deleteWhatsNewEntry(id);
      if (res.data.err) throw new Error(res.data.errMsg);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WHATS_NEW_QUERY_KEY });
      addNotification({ message: "Entry deleted.", type: "success" });
      resetForm();
    },
    onError: (err) => handleGlobalError(err),
  });

  /**
   * Deletion is irreversible and loses the entry's history, so it is always
   * confirmed. Archiving is the reversible option and is one click away.
   */
  function confirmDelete(entry: WhatsNewEntryAdmin) {
    openModal(
      <ConfirmModal
        text={`Permanently delete "${entry.title}"? This cannot be undone. Archive it instead if you only want to stop showing it.`}
        confirmText="Delete"
        confirmColor="red"
        onConfirm={() => {
          closeAllModals();
          deleteMutation.mutate(entry._id);
        }}
        onCancel={closeAllModals}
      />
    );
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingID(null);
    setComposing(false);
  }

  function startEdit(entry: WhatsNewEntryAdmin) {
    setForm({
      title: entry.title,
      body: entry.body,
      ctaLabel: entry.ctaLabel ?? "",
      ctaUrl: entry.ctaUrl ?? "",
      expiresAt: toDateInputValue(entry.expiresAt),
      staleAfterDays: entry.staleAfterDays ? String(entry.staleAfterDays) : "",
    });
    setEditingID(entry._id);
    setComposing(true);
  }

  const canSave = form.title.trim().length > 0 && form.body.trim().length > 0;
  const saving = saveMutation.isPending;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <Breadcrumb aria-label="Page navigation">
        <Breadcrumb.Item href="/controlpanel">Control Panel</Breadcrumb.Item>
        <Breadcrumb.Item isCurrent>What's New Manager</Breadcrumb.Item>
      </Breadcrumb>

      <Stack direction="vertical" gap="md" className="mt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Heading level={1}>What's New Manager</Heading>
            <Text className="mt-1">
              Publish the release notice shown to users in a one-time modal.
              Only the newest published entry is served, and only for 90 days
              after publication unless you override the window.
              Write for impact: say what a user can now do, not what shipped.
            </Text>
          </div>
          {!composing && (
            <Button icon={<IconPlus />} onClick={() => setComposing(true)}>
              New Entry
            </Button>
          )}
        </div>

        {composing && (
          <Card>
            <Card.Body>
              <Stack direction="vertical" gap="md">
                <Heading level={2}>
                  {editingID ? "Edit Entry" : "New Entry"}
                </Heading>

                <Input
                  name="title"
                  label="Title"
                  required
                  value={form.title}
                  maxLength={200}
                  helperText="Lead with what the user can now do. (will be prefixed with 'What's New: ')"
                  onChange={(e) =>
                    setForm({ ...form, title: e.target.value })
                  }
                />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Textarea
                    name="body"
                    label="Body (Markdown)"
                    required
                    rows={14}
                    value={form.body}
                    maxLength={MAX_BODY_LENGTH}
                    showCharacterCount
                    helperText="Markdown: headings, lists, links, bold. Raw HTML is not rendered."
                    onChange={(e) =>
                      setForm({ ...form, body: e.target.value })
                    }
                  />
                  <div>
                    <Heading level={3} className="text-sm font-semibold mb-2">
                      Preview
                    </Heading>
                    <div className="border border-border rounded-md p-4 min-h-[16rem] max-h-[24rem] overflow-y-auto bg-surface">
                      {form.body.trim() ? (
                        <div className="prose prose-code:before:hidden prose-code:after:hidden max-w-none">
                          <ReactMarkdown>{form.body}</ReactMarkdown>
                        </div>
                      ) : (
                        <Text>Nothing to preview yet.</Text>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    name="ctaLabel"
                    label="Call-to-action label (optional)"
                    value={form.ctaLabel}
                    maxLength={60}
                    helperText="Leave both CTA fields blank for no button."
                    onChange={(e) =>
                      setForm({ ...form, ctaLabel: e.target.value })
                    }
                  />
                  <Input
                    name="ctaUrl"
                    label="Call-to-action URL (optional)"
                    type="url"
                    value={form.ctaUrl}
                    onChange={(e) =>
                      setForm({ ...form, ctaUrl: e.target.value })
                    }
                  />
                  <Input
                    name="expiresAt"
                    label="Hard expiry (optional)"
                    type="date"
                    value={form.expiresAt}
                    helperText="Stop showing this entry on this date, whatever the staleness window says."
                    onChange={(e) =>
                      setForm({ ...form, expiresAt: e.target.value })
                    }
                  />
                  <Input
                    name="staleAfterDays"
                    label="Staleness window override, in days (optional)"
                    type="number"
                    min={1}
                    max={3650}
                    value={form.staleAfterDays}
                    helperText="Defaults to 90 days after publication."
                    onChange={(e) =>
                      setForm({ ...form, staleAfterDays: e.target.value })
                    }
                  />
                </div>

                <div className="flex flex-wrap gap-2 justify-end">
                  <Button
                    variant="secondary"
                    icon={<IconX />}
                    onClick={resetForm}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="secondary"
                    icon={<IconDeviceFloppy />}
                    onClick={() => saveMutation.mutate({})}
                    disabled={!canSave}
                    loading={saving}
                  >
                    Save Draft
                  </Button>
                  <Button
                    icon={<IconSend />}
                    onClick={() => saveMutation.mutate({ status: "published" })}
                    disabled={!canSave}
                    loading={saving}
                  >
                    Publish
                  </Button>
                </div>
              </Stack>
            </Card.Body>
          </Card>
        )}

        <Heading level={2} className="mt-2">
          Entries
        </Heading>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : entries.length === 0 ? (
          <Text>No entries yet. Create one to get started.</Text>
        ) : (
          <Stack direction="vertical" gap="sm">
            {entries.map((entry) => (
              <Card key={entry._id}>
                <Card.Body>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Heading level={3}>{entry.title}</Heading>
                        <Badge
                          label={entry.status}
                          variant={STATUS_VARIANTS[entry.status]}
                          size="sm"
                        />
                        {entry._id === activeEntryID && (
                          <Badge
                            label="Currently shown to users"
                            variant="primary"
                            size="sm"
                          />
                        )}
                      </div>
                      <Text className="mt-1 text-sm">
                        Published: {formatDate(entry.publishedAt)}
                        {entry.expiresAt
                          ? ` · Expires: ${formatDate(entry.expiresAt)}`
                          : ""}
                        {entry.staleAfterDays
                          ? ` · Window: ${entry.staleAfterDays} days`
                          : ""}
                      </Text>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => startEdit(entry)}
                      >
                        Edit
                      </Button>
                      {entry.status !== "published" && (
                        <Button
                          size="sm"
                          icon={<IconSend />}
                          loading={statusMutation.isPending}
                          onClick={() =>
                            statusMutation.mutate({
                              id: entry._id,
                              status: "published",
                            })
                          }
                        >
                          Publish
                        </Button>
                      )}
                      {entry.status === "published" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<IconArchive />}
                          loading={statusMutation.isPending}
                          onClick={() =>
                            statusMutation.mutate({
                              id: entry._id,
                              status: "archived",
                            })
                          }
                        >
                          Archive
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        icon={<IconTrash />}
                        loading={deleteMutation.isPending}
                        onClick={() => confirmDelete(entry)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>
    </div>
  );
};

export default WhatsNewManager;
