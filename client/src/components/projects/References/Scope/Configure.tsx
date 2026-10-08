import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Button,
  Input,
  Modal,
  Select,
  Spinner,
  Stack,
  Text,
} from "@libretexts/davis-react";
import { IconPlus, IconX } from "@tabler/icons-react";
import { TableOfContents } from "../../../../types/Book";
import {
  GroupCard,
  UnassignedZone,
} from "../../../../screens/commons/Glossary/GlossaryConfigModal";
import GlossaryModeSelector, {
  type ScopeModeOption,
} from "../../../../screens/commons/Glossary/GlossaryModeSelector";
import GlossaryConfigTocTree from "../../../../screens/commons/Glossary/GlossaryConfigTocTree";
import {
  collectSubtreeIds,
  fallbackTargetPageId,
  generateDefaultGroups,
  resolveDrop,
  type DropTarget,
} from "../../../../screens/commons/Glossary/glossaryConfigDefaults";
import { findTocNodeById } from "../../../../screens/commons/Glossary/services";
import { getGroupColor } from "../../../../screens/commons/Glossary/glossaryConfigColors";
import {
  bibScript,
  REFERENCE_BACKMATTER_TARGET,
  ReferenceDisplayLocation,
  ReferenceFormatType,
  ReferenceFormatTypes,
  ReferenceScopeGroup,
  ReferenceScopeMode,
  scopeModeForDisplayLocation,
} from "../model";
import type { Notification } from "../../../../context/NotificationContext";

export type ConfigureSettings = {
  format: ReferenceFormatType;
  /** Title of the shared back-matter References page (BACKMATTER only). */
  pageTitle: string;
  mode: ReferenceScopeMode;
  groups: ReferenceScopeGroup[];
};

interface ConfigureProps {
  open: boolean;
  onClose: () => void;
  format?: ReferenceFormatType;
  pageTitle?: string;
  /** Saved scope; when absent the editor seeds itself from `displayLocation`. */
  scopeMode?: ReferenceScopeMode;
  scopeGroups?: ReferenceScopeGroup[];
  /** Legacy setting, used only to pick the starting mode for an unsaved scope. */
  displayLocation?: ReferenceDisplayLocation;
  /** The shared back-matter References page, once populate has created it. */
  backmatterPageID?: string;
  bookToc?: TableOfContents;
  onSubmit?: (settings: ConfigureSettings) => void | Promise<void>;
  /** Forget the saved scope on the server. */
  onResetScope?: () => void | Promise<void>;
  submitDisabled?: boolean;
  addNotification: (notification: Notification) => void;
}

type ConfigureFormFields = {
  format: ReferenceFormatType | "";
  pageTitle: string;
  mode: ReferenceScopeMode;
  groups: ReferenceScopeGroup[];
};

const DEFAULT_VALUES: ConfigureFormFields = {
  format: "",
  pageTitle: "",
  mode: "PAGE",
  groups: [],
};

/** The glossary scope's modes, worded for references. */
const REFERENCE_MODE_OPTIONS: ScopeModeOption[] = [
  {
    label: "References at the end of each page",
    value: "PAGE",
    description: "Every page lists the references cited on it.",
  },
  {
    label: "References by chapter",
    value: "CHAPTER",
    description:
      "Pages are grouped by top-level chapter — each group's references are listed together on its target page.",
  },
  {
    label: "Backmatter references page",
    value: "BACKMATTER",
    description:
      "All pages share one references list on a References page in the back matter.",
  },
];

/**
 * Citation format and reference scope. The scope editor is the glossary
 * scope's (same components and the same group logic), so both features are
 * configured the same way.
 */
const Configure: React.FC<ConfigureProps> = ({
  open,
  onClose,
  format: initialFormat,
  pageTitle: initialPageTitle = "",
  scopeMode,
  scopeGroups,
  displayLocation,
  backmatterPageID,
  bookToc,
  onSubmit,
  onResetScope,
  submitDisabled = false,
  addNotification,
}) => {
  const { control, getValues, setValue, watch, reset } =
    useForm<ConfigureFormFields>({ defaultValues: DEFAULT_VALUES });
  const { fields, append, remove, move, update, replace } = useFieldArray({
    control,
    name: "groups",
  });
  const mode = watch("mode");
  const format = watch("format");
  const pageTitle = watch("pageTitle");
  const [activeDragPageIds, setActiveDragPageIds] = useState<string[] | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  /** Where the BACKMATTER group's list goes: the real page once it exists. */
  const backmatterTarget = backmatterPageID ?? REFERENCE_BACKMATTER_TARGET;

  const defaultGroupsFor = (
    toc: TableOfContents,
    forMode: ReferenceScopeMode,
  ): ReferenceScopeGroup[] =>
    generateDefaultGroups(forMode, toc, backmatterTarget);

  // Seed once per open, as the glossary scope does: later prop changes
  // (a refetch after save elsewhere) must not overwrite unsaved edits.
  const formSeededRef = useRef(false);
  useEffect(() => {
    if (!open) {
      formSeededRef.current = false;
      return;
    }
    if (formSeededRef.current || !bookToc) return;
    formSeededRef.current = true;
    const seededMode = scopeMode ?? scopeModeForDisplayLocation(displayLocation);
    reset({
      format: initialFormat ?? "",
      pageTitle: initialPageTitle,
      mode: seededMode,
      groups: scopeGroups ?? defaultGroupsFor(bookToc, seededMode),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bookToc]);

  const allPageIds = useMemo(
    () => (bookToc ? bookToc.children.flatMap(collectSubtreeIds) : []),
    [bookToc],
  );
  const allPageIdSet = useMemo(() => new Set(allPageIds), [allPageIds]);

  const assignedPageIds = useMemo(
    () => new Set(fields.flatMap((g) => g.pageIds)),
    [fields],
  );

  const pageGroupInfo = useMemo(() => {
    const map = new Map<string, { color: string; index: number }>();
    fields.forEach((group, index) => {
      const info = { color: getGroupColor(index), index };
      group.pageIds.forEach((pageId) => map.set(pageId, info));
    });
    return map;
  }, [fields]);

  const unassignedPageIds = useMemo(
    () => allPageIds.filter((id) => !assignedPageIds.has(id)),
    [allPageIds, assignedPageIds],
  );

  const staleEntries = useMemo(() => {
    const stale: { pageId: string; groupIndex: number }[] = [];
    fields.forEach((group, index) => {
      group.pageIds.forEach((pageId) => {
        if (!allPageIdSet.has(pageId)) stale.push({ pageId, groupIndex: index });
      });
    });
    return stale;
  }, [fields, allPageIdSet]);

  const getGroupLabel = (group: ReferenceScopeGroup, index: number): string => {
    const firstRealPageTitle = bookToc
      ? group.pageIds
          .map((id) => findTocNodeById(bookToc, id)?.title)
          .find((title) => !!title)
      : undefined;
    return firstRealPageTitle ?? `Group ${index + 1}`;
  };

  /**
   * Where a group's list is displayed. In CHAPTER mode that isn't chosen: it
   * is the group's first page, i.e. the chapter page for a chapter's group.
   */
  const effectiveTargetPageId = (
    group: ReferenceScopeGroup,
    forMode: ReferenceScopeMode = mode,
  ): string =>
    forMode === "CHAPTER"
      ? (group.pageIds.find((id) => allPageIdSet.has(id)) ??
        group.targetPageId)
      : group.targetPageId;

  const getTargetTitle = (group: ReferenceScopeGroup): string => {
    const targetPageId = effectiveTargetPageId(group);
    if (!targetPageId) return "Not set";
    if (targetPageId === REFERENCE_BACKMATTER_TARGET) {
      return `"${pageTitle.trim() || "References"}" page in Back Matter (created when references are populated)`;
    }
    return (
      (bookToc && findTocNodeById(bookToc, targetPageId)?.title) ??
      "Unknown page"
    );
  };

  const removePageFromGroup = (pageId: string, groupIndex: number) => {
    const group = getValues(`groups.${groupIndex}`);
    update(groupIndex, {
      ...group,
      pageIds: group.pageIds.filter((id) => id !== pageId),
    });
  };

  const handleModeChange = (newMode: ReferenceScopeMode) => {
    if (!bookToc) return;
    setValue("mode", newMode, { shouldDirty: true });
    replace(defaultGroupsFor(bookToc, newMode));
  };

  const handleResetToDefault = () => {
    if (!bookToc) return;
    replace(defaultGroupsFor(bookToc, mode));
  };

  const handleAddGroup = () => {
    if (!bookToc) return;
    append({
      groupID: crypto.randomUUID(),
      pageIds: [],
      targetPageId:
        mode === "BACKMATTER" ? backmatterTarget : fallbackTargetPageId(bookToc),
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const pageIds = event.active.data.current?.pageIds as string[] | undefined;
    const overData = event.over?.data.current as DropTarget | undefined;
    setActiveDragPageIds(null);
    if (!pageIds || pageIds.length === 0 || !overData) return;
    replace(resolveDrop(getValues("groups"), pageIds, overData));
  };

  const busy = saving || resetting;
  const needsPageTitle = mode === "BACKMATTER";
  const canSubmit =
    !!format &&
    !!bookToc &&
    (!needsPageTitle || pageTitle.trim().length > 0) &&
    !submitDisabled &&
    !busy;

  const handleClose = () => {
    reset(DEFAULT_VALUES);
    formSeededRef.current = false;
    onClose();
  };

  const handleSubmit = async () => {
    const values = getValues();
    if (!values.format || !canSubmit) return;
    setSaving(true);
    try {
      await onSubmit?.({
        format: values.format,
        pageTitle: needsPageTitle ? values.pageTitle.trim() : "",
        mode: values.mode,
        // Plain groups: useFieldArray adds its own `id` key to each item.
        groups: values.groups.map((group) => ({
          groupID: group.groupID,
          pageIds: group.pageIds,
          targetPageId: effectiveTargetPageId(group, values.mode),
        })),
      });
      handleClose();
    } catch {
      // The caller reports the failure; stay open so no edits are lost.
    } finally {
      setSaving(false);
    }
  };

  const handleResetSaved = async () => {
    if (!bookToc) return;
    setResetting(true);
    try {
      await onResetScope?.();
      const seededMode = scopeModeForDisplayLocation(displayLocation);
      setValue("mode", seededMode);
      replace(defaultGroupsFor(bookToc, seededMode));
      } catch {
      // The caller reports the failure; keep the current edits.
    } finally {
      setResetting(false);
    }
  };

  return (
    <Modal open={open} onClose={(v) => !v && !busy && handleClose()} size="xl">
      <Modal.Header>
        <Modal.Title>Reference Scope</Modal.Title>
        <Modal.Close aria-label="Close" />
      </Modal.Header>
      <Modal.Body>
        <Stack direction="vertical" gap="sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select
              name="configureReferencesFormat"
              label="Citation format"
              placeholder="Select a format"
              options={ReferenceFormatTypes.map((value) => ({
                label: value,
                value,
              }))}
              value={format}
              onChange={(e) =>
                setValue(
                  "format",
                  e.target.value as ReferenceFormatType | "",
                  { shouldDirty: true },
                )
              }
              disabled={busy}
            />
            {needsPageTitle && (
              <Stack direction="vertical" gap="xs">
                <Input
                  name="pageTitle"
                  label="Page title"
                  placeholder="e.g. References"
                  value={pageTitle}
                  onChange={(e) =>
                    setValue("pageTitle", e.target.value, { shouldDirty: true })
                  }
                  disabled={busy}
                />
                <Text size="sm" className="text-neutral-500">
                  Title of the References page in the back matter.
                </Text>
              </Stack>
            )}
          </div>

          {!bookToc ? (
            <div className="flex justify-center py-8">
              <Spinner text="Loading table of contents…" />
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              onDragStart={(e) =>
                setActiveDragPageIds(
                  (e.active.data.current?.pageIds as string[]) ?? null,
                )
              }
              onDragCancel={() => setActiveDragPageIds(null)}
              onDragEnd={handleDragEnd}
            >
              <GlossaryModeSelector
                name="reference-scope-mode"
                label="Reference Scope"
                options={REFERENCE_MODE_OPTIONS}
                value={mode}
                onChange={handleModeChange}
                disabled={busy}
              />

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[1fr_16rem]">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-neutral-700">
                      Groups
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleResetToDefault}
                        disabled={busy}
                      >
                        Reset to Default
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<IconPlus size={14} />}
                        iconPosition="left"
                        onClick={handleAddGroup}
                        disabled={busy}
                      >
                        Add Group
                      </Button>
                    </div>
                  </div>

                  <ul
                    aria-label="Reference groups"
                    className="mt-2 max-h-[22rem] space-y-3 overflow-y-auto"
                  >
                    {fields.map((group, index) => (
                      <GroupCard
                        key={group.id}
                        group={group}
                        index={index}
                        label={getGroupLabel(group, index)}
                        color={getGroupColor(index)}
                        mode={mode}
                        targetTitle={getTargetTitle(group)}
                        armed={false}
                        canSetTarget={false}
                        showTarget={mode !== "CHAPTER"}
                        canMoveUp={index > 0}
                        canMoveDown={index < fields.length - 1}
                        busy={busy}
                        bookTOC={bookToc}
                        allPageIdSet={allPageIdSet}
                        onMoveUp={() => move(index, index - 1)}
                        onMoveDown={() => move(index, index + 1)}
                        onRemoveGroup={() => remove(index)}
                        onRemovePage={(pageId) =>
                          removePageFromGroup(pageId, index)
                        }
                      />
                    ))}
                  </ul>
                  {fields.length === 0 && (
                    <p className="mt-2 text-sm text-neutral-500">
                      <em>No groups yet — add one to get started.</em>
                    </p>
                  )}

                  <UnassignedZone
                    pageIds={unassignedPageIds}
                    bookTOC={bookToc}
                    busy={busy}
                  />

                  {staleEntries.length > 0 && (
                    <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3">
                      <p className="text-sm font-semibold text-red-800">
                        {staleEntries.length} page
                        {staleEntries.length === 1 ? "" : "s"} no longer found
                        in this book
                      </p>
                      <p className="mt-1 text-xs text-red-700">
                        These pages were removed or moved since this scope was
                        saved. Remove them, or leave them — they won't affect
                        anything until then.
                      </p>
                      <ul className="mt-2 space-y-1">
                        {staleEntries.map(({ pageId, groupIndex }) => (
                          <li
                            key={`${groupIndex}-${pageId}`}
                            className="flex items-center justify-between gap-2 text-sm text-red-700"
                          >
                            <span className="truncate">{pageId}</span>
                            <button
                              type="button"
                              onClick={() =>
                                removePageFromGroup(pageId, groupIndex)
                              }
                              aria-label={`Remove stale page ${pageId}`}
                              className="shrink-0 rounded-full p-0.5 hover:bg-red-100"
                              disabled={busy}
                            >
                              <IconX size={14} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {mode === "CHAPTER" && (
                    <Button
                      className="mt-4"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard
                          .writeText(bibScript)
                          .then(() =>
                            addNotification({
                              message: "Script copied to clipboard",
                              type: "success",
                            }),
                          )
                          .catch(() =>
                            addNotification({
                              message: "Couldn't copy to the clipboard",
                              type: "error",
                            }),
                          );
                      }}
                    >
                      Copy bibliography script
                    </Button>
                  )}
                </div>

                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-neutral-700">
                    Table of Contents
                  </h3>
                  <div className="mt-2 max-h-[22rem] overflow-y-auto rounded-md border border-neutral-200 p-2">
                    <GlossaryConfigTocTree
                      items={bookToc.children}
                      pageGroupInfo={pageGroupInfo}
                    />
                  </div>
                </div>
              </div>

              <DragOverlay>
                {activeDragPageIds && activeDragPageIds.length > 0 && (
                  <div className="rounded border border-primary-300 bg-white px-2 py-1 text-sm shadow-lg">
                    {findTocNodeById(bookToc, activeDragPageIds[0])?.title ??
                      activeDragPageIds[0]}
                    {activeDragPageIds.length > 1 &&
                      ` (+${activeDragPageIds.length - 1} more)`}
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        {onResetScope && (
          <Button
            variant="ghost"
            onClick={handleResetSaved}
            loading={resetting}
            disabled={!bookToc || busy}
          >
            Reset Saved Scope
          </Button>
        )}
        <Button variant="outline" onClick={handleClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          loading={saving}
          disabled={!canSubmit}
        >
          Save
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default Configure;
