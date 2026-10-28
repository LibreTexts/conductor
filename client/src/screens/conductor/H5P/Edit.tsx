import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useHistory, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDocumentTitle, useMediaQuery } from "usehooks-ts";
import { format, parseISO } from "date-fns";
import {
  Accordion,
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Checkbox,
  Dialog,
  EmptyState,
  Heading,
  Input,
  Select,
  Skeleton,
  Spinner,
  Text,
  Textarea,
  VisuallyHidden,
} from "@libretexts/davis-react";
import { IconAlertTriangle, IconDeviceFloppy, IconExternalLink, IconLink, IconLock, IconTrash, IconWorld } from "@tabler/icons-react";
import api from "../../../api";
import useClientConfig from "../../../hooks/useClientConfig";
import useH5PAuthoringEnabled from "../../../hooks/useH5PAuthoringEnabled";
import useCanCreateActivities from "../../../hooks/useCanCreateActivities";
import { useNotifications } from "../../../context/NotificationContext";
import {
  ActivityDisplayOptions,
  ActivityMetadataInput,
  ActivityPerson,
  ActivityVisibilityLevel,
  EditableActivity,
} from "../../../types";
import languageCodes from "../../../utils/languageCodes";
import { buildActivityAttribution, getActivityLicense } from "../../../utils/activityHelpers";
import { EditorSaveError, useEditorBridge } from "./useEditorBridge";

/** Below Tailwind's `lg`, the screen becomes Content / Details / Sharing tabs. */
const DESKTOP_QUERY = "(min-width: 1024px)";

const DEFAULT_DISPLAY_OPTIONS: ActivityDisplayOptions = { frame: true, download: true, embed: true, copyright: true };

type FormState = {
  description: string;
  subjects: string[];
  tags: string[];
  language: string;
  publisher: string;
  visibility: ActivityVisibilityLevel;
};

const EMPTY_FORM: FormState = {
  description: "",
  subjects: [],
  tags: [],
  language: "en",
  publisher: "",
  visibility: "private",
};

function formFrom(activity: EditableActivity): FormState {
  return {
    description: activity.description ?? "",
    // Every subject, not only the first: migrated activities carry several,
    // and each save sends the whole list back.
    subjects: activity.subjects ?? [],
    tags: activity.tags ?? [],
    language: activity.language ?? "en",
    publisher: activity.publisher ?? "",
    visibility: activity.visibilityLevel,
  };
}

function metadataFrom(form: FormState): ActivityMetadataInput {
  return {
    description: form.description,
    subjects: form.subjects,
    tags: form.tags,
    language: form.language,
    publisher: form.publisher,
    visibility: form.visibility,
  };
}

function parseAuthors(raw?: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((a) => a?.name).filter((n) => typeof n === "string" && n.trim()) : [];
  } catch {
    return [];
  }
}

const VISIBILITY_CHOICES: { value: ActivityVisibilityLevel; label: string; description: string; icon: JSX.Element }[] = [
  { value: "public", label: "Public", description: "Listed in Commons and search results", icon: <IconWorld size={20} aria-hidden="true" /> },
  { value: "unlisted", label: "Unlisted", description: "Anyone with the link can view", icon: <IconLink size={20} aria-hidden="true" /> },
  { value: "private", label: "Private", description: "Only you and collaborators", icon: <IconLock size={20} aria-hidden="true" /> },
];

const DISPLAY_OPTION_CHOICES: { key: keyof ActivityDisplayOptions; label: string; description: string }[] = [
  { key: "frame", label: "Show action bar", description: "Download, embed, and copyright buttons below the activity" },
  { key: "download", label: "Allow download", description: "Visitors can download the .h5p file to reuse it" },
  { key: "embed", label: "Show embed button", description: "Visitors can copy code to embed it elsewhere" },
  { key: "copyright", label: "Show copyright button", description: "Shows the license and attribution" },
];

/** A tag field: Enter or comma adds, each tag is a removable badge. */
const TagsField = ({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) => {
  const [draft, setDraft] = useState("");
  const add = () => {
    const tag = draft.trim().replace(/,$/, "").trim();
    if (tag && !tags.includes(tag) && tags.length < 30) onChange([...tags, tag]);
    setDraft("");
  };
  return (
    <div className="flex flex-col gap-2">
      <Input
        name="activity-tags"
        label="Tags"
        value={draft}
        placeholder="Add a tag…"
        helperText="Press Enter to add."
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
      />
      {tags.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Tags">
          {tags.map((tag) => (
            <li key={tag}>
              <Badge label={tag} onRemove={() => onChange(tags.filter((t) => t !== tag))} removeLabel={`Remove tag ${tag}`} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/**
 * Subjects as a picker plus removable badges, like tags. Choosing a subject
 * adds it and resets the picker, so an activity holds as many as it needs.
 */
const SubjectsField = ({
  subjects,
  options,
  error,
  onChange,
}: {
  subjects: string[];
  options: { value: string; label: string }[];
  error: boolean;
  onChange: (subjects: string[]) => void;
}) => (
  <div className="flex flex-col gap-2">
    <Select
      name="activity-subject"
      label="Subjects"
      placeholder={subjects.length ? "Add another subject" : "Choose a subject"}
      required
      error={error}
      errorMessage={error ? "Choose a subject." : undefined}
      options={options.filter((o) => !subjects.includes(o.value))}
      value=""
      onChange={(e) => {
        const subject = e.target.value;
        if (subject && !subjects.includes(subject)) onChange([...subjects, subject]);
      }}
    />
    {subjects.length > 0 && (
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Subjects">
        {subjects.map((subject) => (
          <li key={subject}>
            <Badge
              label={subject}
              onRemove={() => onChange(subjects.filter((s) => s !== subject))}
              removeLabel={`Remove subject ${subject}`}
            />
          </li>
        ))}
      </ul>
    )}
  </div>
);

/** Visibility as radio cards, frame 1a. Native radios keep keyboard behaviour. */
const VisibilityField = ({ value, onChange }: { value: ActivityVisibilityLevel; onChange: (v: ActivityVisibilityLevel) => void }) => (
  <fieldset className="m-0 border-0 p-0">
    <legend className="mb-2 text-sm font-medium text-neutral-900">Visibility</legend>
    <div className="flex flex-col gap-2">
      {VISIBILITY_CHOICES.map((choice) => {
        const checked = value === choice.value;
        return (
          <label
            key={choice.value}
            className={[
              "flex cursor-pointer items-start gap-3 rounded-md p-3",
              "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-500",
              checked ? "border-2 border-primary-500 bg-primary-50" : "border border-neutral-500 bg-white",
            ].join(" ")}
          >
            <input
              type="radio"
              name="activity-visibility"
              value={choice.value}
              checked={checked}
              onChange={() => onChange(choice.value)}
              className="sr-only"
            />
            <span className="mt-0.5 text-neutral-600">{choice.icon}</span>
            <span className="flex flex-col">
              <span className="font-medium text-neutral-900">{choice.label}</span>
              <span className="text-sm text-neutral-600">{choice.description}</span>
            </span>
          </label>
        );
      })}
    </div>
  </fieldset>
);

/**
 * Create and edit an H5P activity: frames 1a and 6a to 6e of the design.
 *
 * The left side is H5P's own editor, served by the H5P service and framed
 * here; the right side is the activity's metadata, which Conductor owns. One
 * Save does both, in order: the editor saves the content, then the metadata is
 * saved with what the editor reported (H5P_AUTHORING_DESIGN.md, section 4). A
 * new activity gets its content id from Conductor at that first Save.
 *
 * Reached at /h5p/new and /h5p/:activityID/edit through one route, so the
 * editor is not reloaded when a new activity's URL changes after its first
 * save.
 */
const EditH5P = () => {
  const { activityID: routeActivityID } = useParams<{ activityID?: string }>();
  const history = useHistory();
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const { clientConfig, loading: configLoading } = useClientConfig();
  const authoringEnabled = useH5PAuthoringEnabled();
  const canCreate = useCanCreateActivities();
  const editorOrigin = clientConfig?.h5p_embed_origin ? clientConfig.h5p_embed_origin.replace(/\/+$/, "") : undefined;

  // Fixed for the life of the screen: the editor URL must not change under it.
  const [initialActivityID] = useState(routeActivityID);
  const activityIDRef = useRef<string | undefined>(routeActivityID);
  const [activityID, setActivityID] = useState<string | undefined>(routeActivityID);
  const isCreate = !activityID;

  // Keyed on the current id, not the initial one, so a new activity's record
  // loads after its first save and every save can refetch what the editor
  // changed (license and authors).
  const { data, isLoading, error: queryError } = useQuery({
    queryKey: ["activity-authoring", activityID],
    queryFn: async () => (await api.getActivityForEditing(activityID!)).data,
    enabled: Boolean(activityID),
    refetchOnWindowFocus: false,
    retry: false,
  });
  const { data: subjects } = useQuery({
    queryKey: ["activity-subjects"],
    queryFn: async () => (await api.getActivitySubjects()).data.subjects,
    staleTime: 10 * 60 * 1000,
  });

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [savedForm, setSavedForm] = useState<FormState>(EMPTY_FORM);
  const [options, setOptions] = useState<ActivityDisplayOptions>(DEFAULT_DISPLAY_OPTIONS);
  const [savedOptions, setSavedOptions] = useState<ActivityDisplayOptions>(DEFAULT_DISPLAY_OPTIONS);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ tone: "error" | "warning"; text: string } | null>(null);
  const [pendingMetadataRetry, setPendingMetadataRetry] = useState<null | Parameters<typeof api.updateActivity>[1]>(null);
  const [subjectError, setSubjectError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState<"content" | "details" | "sharing">("content");

  // Only a failed first load replaces the screen. A failed refetch after a
  // save keeps the editor and the last good record.
  const loadError = initialActivityID && !data ? queryError : null;

  // The last committed values, read by the effect below. Compared there and
  // not in a setForm updater: updaters run during render, and StrictMode's
  // second render would already see these refs overwritten.
  const formRef = useRef(form);
  formRef.current = form;
  const savedFormRef = useRef(savedForm);
  savedFormRef.current = savedForm;
  useEffect(() => {
    if (!data) return;
    const f = formFrom(data.activity);
    // A refetch after a save must not discard edits made while it ran.
    if (JSON.stringify(formRef.current) === JSON.stringify(savedFormRef.current)) setForm(f);
    setSavedForm(f);
    if (data.activity.updatedAt && !data.activity.pendingFirstSave) setLastSaved(parseISO(data.activity.updatedAt));
  }, [data]);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridge = useEditorBridge({
    iframeRef,
    editorOrigin,
    fetchToken: async () => (await api.getActivityEditorToken(activityIDRef.current)).data.token,
  });

  useEffect(() => {
    if (bridge.displayOptions) {
      setOptions(bridge.displayOptions);
      setSavedOptions(bridge.displayOptions);
    }
  }, [bridge.displayOptions]);

  const title = bridge.title || data?.activity.title || (isCreate ? "New H5P" : "");
  useDocumentTitle(`LibreTexts Conductor | ${title || "H5P"}`);

  const formDirty = JSON.stringify(form) !== JSON.stringify(savedForm);
  const optionsDirty = JSON.stringify(options) !== JSON.stringify(savedOptions);
  const dirty = bridge.dirty || formDirty || optionsDirty || Boolean(pendingMetadataRetry);

  // Leaving with unsaved work asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const role = data?.role ?? "owner";
  const people: ActivityPerson[] = data?.people ?? [];
  const licenseInfo = getActivityLicense(data?.activity.license);
  const authors = parseAuthors(data?.activity.h5pAuthors);
  const attribution = buildActivityAttribution({
    title: title || "Untitled activity",
    authors,
    publisher: form.publisher || undefined,
    license: data?.activity.license,
  });

  const subjectOptions = useMemo(() => {
    // Subjects outside the current list stay selectable, so a migrated
    // activity's older classifications still render and save.
    const list = [...(subjects ?? [])];
    for (const s of form.subjects) if (!list.includes(s)) list.unshift(s);
    return list.map((s) => ({ value: s, label: s }));
  }, [subjects, form.subjects]);
  const languageOptions = useMemo(() => languageCodes.map((l) => ({ value: l.code, label: l.name })), []);

  const saveStatus = saving
    ? "Saving…"
    : dirty
      ? "Unsaved changes"
      : lastSaved
        ? `Last saved ${format(lastSaved, "MMM d, yyyy 'at' h:mm a")}`
        : "Not saved yet";

  async function saveMetadata(id: string, update: Parameters<typeof api.updateActivity>[1]) {
    try {
      await api.updateActivity(id, update);
      setPendingMetadataRetry(null);
      return true;
    } catch {
      setPendingMetadataRetry(update);
      setSaveMessage({ tone: "warning", text: "Your activity was saved, but its details were not. Try saving again." });
      return false;
    }
  }

  async function handleSave() {
    setSaveMessage(null);
    if (form.subjects.length === 0) {
      setSubjectError(true);
      setTab("details");
      setSaveMessage({ tone: "error", text: "Choose a subject before saving." });
      return;
    }
    setSubjectError(false);
    setSaving(true);
    const metadata = metadataFrom(form);
    try {
      // A metadata save that failed after the content saved is retried alone.
      if (pendingMetadataRetry && activityIDRef.current) {
        if (await saveMetadata(activityIDRef.current, { ...pendingMetadataRetry, ...metadata })) {
          setSavedForm(form);
          setLastSaved(new Date());
          addNotification({ type: "success", message: "Activity saved." });
          queryClient.invalidateQueries(["activity-authoring", activityIDRef.current]);
        } else {
          addNotification({ type: "error", message: "Your activity's details could not be saved." });
        }
        return;
      }

      let id = activityIDRef.current;
      if (!id) {
        const created = await api.createActivity(metadata);
        id = created.data.activity.activityID;
        activityIDRef.current = id;
        setActivityID(id);
        bridge.sendToken(created.data.token);
      }

      const saved = await bridge.save(options);
      const ok = await saveMetadata(id, {
        ...metadata,
        contentSaved: {
          title: saved.title,
          library: saved.library,
          libraryTitle: saved.libraryTitle,
          license: saved.license,
          licenseVersion: saved.licenseVersion,
          authors: saved.authors,
        },
      });
      setSavedOptions(saved.displayOptions ?? options);
      if (ok) {
        setSavedForm(form);
        setLastSaved(new Date());
        addNotification({ type: "success", message: "Activity saved." });
      } else {
        addNotification({ type: "error", message: "Your activity was saved, but its details were not." });
      }
      queryClient.invalidateQueries(["my-activities"]);
      queryClient.invalidateQueries(["activity-authoring", id]);
      if (!routeActivityID || routeActivityID !== id) history.replace(`/h5p/${id}/edit`);
    } catch (err) {
      const reason = err instanceof EditorSaveError ? err.reason : "server";
      addNotification({ type: "error", message: "Your activity could not be saved." });
      setSaveMessage({
        tone: "error",
        text:
          reason === "validation"
            ? "The editor found problems with this activity. Check the highlighted fields and save again."
            : "Your activity could not be saved. Try again in a moment.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!activityIDRef.current) return;
    setDeleting(true);
    try {
      await api.deleteActivity(activityIDRef.current);
      queryClient.invalidateQueries(["my-activities"]);
      history.push("/h5p");
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
      setSaveMessage({ tone: "error", text: "This activity could not be deleted. Try again in a moment." });
    }
  }

  function handleCancel() {
    if (dirty) setConfirmLeave(true);
    else history.push("/h5p");
  }

  // ------------------------------------------------------------- states
  const unavailable = loadError && [403, 404].includes((loadError as any)?.response?.status);
  if (unavailable || (!configLoading && (!editorOrigin || !authoringEnabled))) {
    return (
      <div className="flex justify-center px-4 py-12">
        <Card padding="md" className="w-full max-w-[640px]">
          <EmptyState
            icon={<IconLock size={32} />}
            title={unavailable ? "This activity isn't available to edit" : "The H5P editor isn't available"}
            description={
              unavailable
                ? "It may have been deleted, or you may not be its owner or a collaborator."
                : "Editing H5P activities is not set up on this site yet."
            }
            action={
              <Button as={Link} to="/h5p" variant="primary">
                Back to My H5P
              </Button>
            }
          />
        </Card>
      </div>
    );
  }
  if (isCreate && !canCreate) {
    return (
      <div className="flex justify-center px-4 py-12">
        <Card padding="md" className="w-full max-w-[640px]">
          <EmptyState
            icon={<IconLock size={32} />}
            title="Creating H5P activities is open to verified instructors"
            description="You can still edit activities other authors share with you. To create your own, request instructor verification."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button as={Link} to="/h5p" variant="outline">
                  Back to My H5P
                </Button>
                {clientConfig?.instructor_verification_url && (
                  <Button as="a" href={clientConfig.instructor_verification_url} variant="primary" className="bg-primary! text-white!" icon={<IconExternalLink size={18} />}>
                    Request verification
                  </Button>
                )}
              </div>
            }
          />
        </Card>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="flex justify-center px-4 py-12">
        <Card padding="md" className="w-full max-w-[640px]">
          <EmptyState
            icon={<IconAlertTriangle size={32} />}
            title="This activity couldn't be loaded"
            description="Something went wrong on our end. Try again in a moment."
            action={<Button variant="primary" onClick={() => window.location.reload()}>Try again</Button>}
          />
        </Card>
      </div>
    );
  }

  const loadingActivity = Boolean(initialActivityID) && isLoading;
  const editorSrc = editorOrigin
    ? initialActivityID
      ? data && `${editorOrigin}/h5p/${data.activity.h5pContentID}/edit`
      : `${editorOrigin}/h5p/new/edit`
    : undefined;
  const statusBadge =
    form.visibility === "private" || isCreate ? (
      <Badge label="Draft" variant="default" dot size={isDesktop ? "md" : "sm"} />
    ) : (
      <Badge label="Published" variant="success" dot size={isDesktop ? "md" : "sm"} />
    );

  // ------------------------------------------------------------- parts
  // H5P's editor stylesheet caps its own page at 960px. From 1600px the
  // column is wider than that, so the frame is centred with padding around
  // it and the spare width goes to the details sidebar instead.
  const editorPanel = (
    <div className="relative overflow-hidden rounded-md border border-neutral-200 bg-white min-[1600px]:p-6 min-[1920px]:p-8">
      {!bridge.loaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-100">
          <Spinner size="lg" text="Loading H5P editor" />
        </div>
      )}
      {bridge.error && (
        <Alert
          variant="error"
          className="m-3"
          message={
            bridge.error === "token"
              ? "Your editing session could not be renewed. Copy any unsaved work, then reload the page."
              : "The editor reported a problem. Reload the page to continue."
          }
        />
      )}
      {editorSrc && (
        <iframe
          ref={iframeRef}
          src={editorSrc}
          title="H5P editor"
          className="block w-full border-0 min-[1600px]:mx-auto min-[1600px]:max-w-[1000px]"
          style={{ height: Math.max(bridge.height ?? 640, isDesktop ? 640 : 420) }}
          allow="fullscreen"
          allowFullScreen
        />
      )}
    </div>
  );

  const displayOptionsCard = (
    <Card padding="sm">
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-3 text-base font-semibold text-neutral-900">Display options</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {DISPLAY_OPTION_CHOICES.map((o) => (
            <Checkbox
              key={o.key}
              name={`display-${o.key}`}
              label={o.label}
              description={o.description}
              checked={options[o.key]}
              disabled={o.key !== "frame" && !options.frame}
              onChange={(checked) => setOptions({ ...options, [o.key]: checked })}
            />
          ))}
        </div>
      </fieldset>
    </Card>
  );

  const detailsFields = (
    <div className="flex flex-col gap-4">
      <Textarea
        name="activity-description"
        label="Description"
        rows={4}
        value={form.description}
        helperText="Set a helpful description for other educators. Shown publicly."
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />
      <SubjectsField
        subjects={form.subjects}
        options={subjectOptions}
        error={subjectError}
        onChange={(subjects) => {
          setForm({ ...form, subjects });
          setSubjectError(false);
        }}
      />
      <TagsField tags={form.tags} onChange={(tags) => setForm({ ...form, tags })} />
      <Select
        name="activity-language"
        label="Language"
        placeholder="Choose a language"
        options={languageOptions}
        value={form.language}
        onChange={(e) => setForm({ ...form, language: e.target.value })}
      />
    </div>
  );

  const sharingFields = (
    <div className="flex flex-col gap-4">
      <VisibilityField value={form.visibility} onChange={(visibility) => setForm({ ...form, visibility })} />
      <div>
        <Text weight="medium">Collaborators</Text>
        <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
          {(people.length ? people : [{ uuid: "me", name: "You", role: "owner" as const }]).map((p) => (
            <li key={p.uuid} className="flex items-center justify-between gap-2">
              <Text>{p.name}</Text>
              <Text size="sm" color="muted">{p.role === "owner" ? "Owner" : "Can edit"}</Text>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  const licenseFields = (
    <div className="flex flex-col gap-4">
      <div>
        <Text weight="medium">License and author</Text>
        <Text as="p" size="sm" color="muted">
          {licenseInfo ? licenseInfo.text : "Not set"}
          {authors.length ? ` · ${authors.join(", ")}` : ""}
        </Text>
        <Text as="p" size="sm" color="muted">
          Set these in the editor with the Metadata button beside the title. They update here when you save, and will follow the activity wherever it is reused.
        </Text>
      </div>
      <Input
        name="activity-publisher"
        label="Institution"
        value={form.publisher}
        onChange={(e) => setForm({ ...form, publisher: e.target.value })}
      />
      <div>
        <Text weight="medium">Attribution preview</Text>
        <Text as="p" size="sm">{attribution}</Text>
      </div>
    </div>
  );

  const metadataSummary = {
    details: [form.subjects.length ? form.subjects.join(", ") : "No subject", form.tags.length ? `${form.tags.length} tag${form.tags.length === 1 ? "" : "s"}` : null].filter(Boolean).join(" · "),
    sharing: `${VISIBILITY_CHOICES.find((c) => c.value === form.visibility)?.label} · ${Math.max(people.length, 1)} ${Math.max(people.length, 1) === 1 ? "person" : "people"}`,
    license: [licenseInfo?.text ?? "Not set", authors[0]].filter(Boolean).join(" · "),
  };

  const section = (key: string, label: string, summary: string, body: JSX.Element, open = false) => (
    <Accordion.Item key={key} defaultOpen={open}>
      <Accordion.Trigger>
        <span className="flex flex-col items-start text-left">
          <span className="font-semibold">{label}</span>
          <span className="text-sm font-normal text-neutral-600">{summary}</span>
        </span>
      </Accordion.Trigger>
      <Accordion.Panel>{body}</Accordion.Panel>
    </Accordion.Item>
  );

  const deleteButton =
    !isCreate && role === "owner" ? (
      <Button variant="destructive" size="sm" icon={<IconTrash size={16} />} onClick={() => setConfirmDelete(true)}>
        Delete H5P
      </Button>
    ) : null;

  const saveButton = (size: "md" | "lg") => (
    <Button
      variant="primary"
      size={size}
      onClick={handleSave}
      loading={saving}
      softDisabled={!bridge.loaded || saving}
      icon={<IconDeviceFloppy size={18} />}
    >
      {isCreate ? "Create" : "Save"}
    </Button>
  );
  const cancelButton = (size: "md" | "lg") => (
    <Button variant="outline" size={size} onClick={handleCancel}>
      Cancel
    </Button>
  );

  const messages = (
    <>
      {saveMessage && (
        <Alert variant={saveMessage.tone === "error" ? "error" : "warning"} className="mb-4" message={saveMessage.text} />
      )}
      <VisuallyHidden aria-live="polite">{saving ? "Saving" : saveStatus}</VisuallyHidden>
    </>
  );

  const dialogs = (
    <>
      <Dialog open={confirmDelete} onClose={() => !deleting && setConfirmDelete(false)} size="md">
        <Dialog.Header>
          <Dialog.Title>Delete this H5P activity?</Dialog.Title>
        </Dialog.Header>
        <div className="p-6">
          <Text>
            "{title}" will be deleted permanently. Any page that embeds it, in textbooks or in ADAPT, will show it as unavailable.
          </Text>
        </div>
        <Dialog.Footer>
          <Button variant="outline" onClick={() => setConfirmDelete(false)} softDisabled={deleting}>
            Keep it
          </Button>
          <Button variant="destructive" onClick={handleDelete} loading={deleting} icon={<IconTrash size={18} />}>
            Delete H5P
          </Button>
        </Dialog.Footer>
      </Dialog>
      <Dialog open={confirmLeave} onClose={() => setConfirmLeave(false)} size="sm">
        <Dialog.Header>
          <Dialog.Title>Leave without saving?</Dialog.Title>
          <Dialog.Description>Your unsaved changes will be lost.</Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer>
          <Button variant="outline" onClick={() => setConfirmLeave(false)}>
            Keep editing
          </Button>
          <Button variant="destructive" onClick={() => history.push("/h5p")}>
            Leave
          </Button>
        </Dialog.Footer>
      </Dialog>
    </>
  );

  // ------------------------------------------------------------- desktop
  if (isDesktop) {
    return (
      <div className="min-h-full bg-neutral-50 px-6 pb-16 pt-4">
        <Breadcrumb aria-label="Page navigation">
          <Breadcrumb.Item href="/h5p">My H5P</Breadcrumb.Item>
          <Breadcrumb.Item isCurrent>{loadingActivity ? <Skeleton variant="text" width={160} /> : title}</Breadcrumb.Item>
        </Breadcrumb>
        <header className="mt-3 flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-4">
          <div className="flex min-w-0 items-center gap-3">
            {loadingActivity ? (
              <Skeleton variant="text" width={420} height={44} />
            ) : (
              <Heading level={1} className="truncate mb-0!">{title}</Heading>
            )}
            {!loadingActivity && statusBadge}
          </div>
          <div className="flex items-center gap-3">
            <Text size="sm" color="muted">{saveStatus}</Text>
            {cancelButton("md")}
            {saveButton("md")}
          </div>
        </header>
        <div className="mt-4">{messages}</div>
        <div className="grid grid-cols-[minmax(0,1fr)_400px] gap-6 min-[1600px]:grid-cols-[minmax(0,1fr)_480px] min-[1600px]:gap-8 min-[1920px]:grid-cols-[minmax(0,1fr)_560px]">
          <div className="flex min-w-0 flex-col gap-4">
            {loadingActivity ? (
              <div className="flex h-[640px] items-center justify-center rounded-md bg-neutral-100">
                <Spinner size="lg" text="Loading H5P editor" />
              </div>
            ) : (
              editorPanel
            )}
            {displayOptionsCard}
          </div>
          <aside className="flex flex-col gap-4" aria-label="Activity details">
            {loadingActivity ? (
              <Card padding="sm">
                <Skeleton variant="text" lines={6} />
              </Card>
            ) : (
              <Card padding="sm">
                <Accordion>
                  {section("details", "Details", metadataSummary.details, detailsFields, true)}
                  {section("sharing", "Sharing", metadataSummary.sharing, sharingFields, true)}
                  {section("license", "License and attribution", metadataSummary.license, licenseFields)}
                </Accordion>
              </Card>
            )}
            {deleteButton && <div className="flex justify-center">{deleteButton}</div>}
          </aside>
        </div>
        {dialogs}
      </div>
    );
  }

  // ------------------------------------------------------------- mobile
  const tabs: { key: typeof tab; label: string }[] = [
    { key: "content", label: "Content" },
    { key: "details", label: "Details" },
    { key: "sharing", label: "Sharing" },
  ];
  return (
    <div className="min-h-full bg-neutral-50 pb-28">
      <div className="px-4 pt-3">
        <Link to="/h5p" className="text-sm text-primary-600 underline">
          ‹ My H5P
        </Link>
        <div className="mt-2 flex items-center gap-2">
          {loadingActivity ? <Skeleton variant="text" width="75%" height={28} /> : <Heading level={1} className="truncate !text-2xl">{title}</Heading>}
          {!loadingActivity && statusBadge}
        </div>
      </div>
      <div role="tablist" aria-label="Edit sections" className="mt-3 flex border-b border-neutral-200 bg-white px-2">
        {tabs.map((t, i) => (
          <button
            key={t.key}
            id={`edit-tab-${t.key}`}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            aria-controls={`edit-panel-${t.key}`}
            tabIndex={tab === t.key ? 0 : -1}
            onClick={() => setTab(t.key)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
                setTab(next.key);
                document.getElementById(`edit-tab-${next.key}`)?.focus();
              }
            }}
            className={[
              "min-h-[44px] flex-1 px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500",
              tab === t.key ? "border-b-2 border-primary-500 text-primary-600" : "text-neutral-700",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="px-4 pt-4">{messages}</div>
      {/* Hidden rather than unmounted: unmounting would reload the editor and lose work. */}
      <div id="edit-panel-content" role="tabpanel" aria-labelledby="edit-tab-content" hidden={tab !== "content"} className="flex flex-col gap-4 px-4">
        <Alert variant="info" message="Adding interactions is easier on a tablet or computer." />
        {loadingActivity ? (
          <div className="flex h-[420px] items-center justify-center rounded-md bg-neutral-100">
            <Spinner size="lg" text="Loading H5P editor" />
          </div>
        ) : (
          editorPanel
        )}
        {displayOptionsCard}
      </div>
      <div id="edit-panel-details" role="tabpanel" aria-labelledby="edit-tab-details" hidden={tab !== "details"} className="flex flex-col gap-4 px-4">
        <Card padding="sm">{detailsFields}</Card>
        <Card padding="sm">
          <Accordion>{section("license", "License and attribution", metadataSummary.license, licenseFields)}</Accordion>
        </Card>
      </div>
      <div id="edit-panel-sharing" role="tabpanel" aria-labelledby="edit-tab-sharing" hidden={tab !== "sharing"} className="flex flex-col gap-4 px-4">
        <Card padding="sm">{sharingFields}</Card>
        {deleteButton && <div className="flex justify-center">{deleteButton}</div>}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-neutral-200 bg-white px-4 py-3">
        <Text size="sm" color="muted" className="min-w-0 truncate">{saveStatus}</Text>
        <div className="flex shrink-0 gap-2">
          {cancelButton("lg")}
          {saveButton("lg")}
        </div>
      </div>
      {dialogs}
    </div>
  );
};

export default EditH5P;
