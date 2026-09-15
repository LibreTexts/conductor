import React, { useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Button, IconButton, Modal, Spinner } from "@libretexts/davis-react";
import {
  IconArrowDown,
  IconArrowUp,
  IconMapPin,
  IconPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import api from "../../../api";
import { TableOfContents } from "../../../types/Book";
import { GlossaryConfigGroup, GlossaryConfigMode } from "./model";
import {
  collectSubtreeIds,
  fallbackTargetPageId,
  generateDefaultGroups,
  resolveDrop,
  type DropTarget,
} from "./glossaryConfigDefaults";
import { findTocNodeById } from "./services";
import { getGroupColor } from "./glossaryConfigColors";
import GlossaryModeSelector from "./GlossaryModeSelector";
import GroupShape from "./GlossaryGroupShape";
import GlossaryConfigTocTree from "./GlossaryConfigTocTree";
import type { Notification } from "../../../context/NotificationContext";

interface GlossaryConfigModalProps {
  open: boolean;
  onClose: () => void;
  library: string;
  coverID: string;
  bookTOC: TableOfContents;
  /** The book's existing back-matter "Glossary" page, if one exists. */
  glossaryPageId?: string;
  addNotification: (notification: Notification) => void;
}

type GlossaryConfigFormFields = {
  mode: GlossaryConfigMode;
  groups: GlossaryConfigGroup[];
};

const DEFAULT_VALUES: GlossaryConfigFormFields = {
  mode: "PAGE",
  groups: [],
};

function getErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { errMsg?: string } | undefined;
    if (data?.errMsg) return data.errMsg;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

interface PageChipProps {
  pageId: string;
  dragId: string;
  title: string;
  onRemove?: () => void;
  disabled?: boolean;
}

const PageChip: React.FC<PageChipProps> = ({
  pageId,
  dragId,
  title,
  onRemove,
  disabled,
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: { pageIds: [pageId] },
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-1 rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-sm ${
        disabled ? "" : "cursor-grab"
      } ${isDragging ? "opacity-40" : ""}`}
    >
      <span className="max-w-[9rem] truncate">{title}</span>
      {onRemove && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onRemove}
          aria-label={`Remove ${title}`}
          className="rounded-full p-0.5 hover:bg-neutral-200"
          disabled={disabled}
        >
          <IconX size={12} />
        </button>
      )}
    </div>
  );
};

interface GroupCardProps {
  group: GlossaryConfigGroup;
  index: number;
  label: string;
  color: string;
  mode: GlossaryConfigMode;
  targetTitle: string;
  armed: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  busy: boolean;
  bookTOC: TableOfContents;
  allPageIdSet: Set<string>;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemoveGroup: () => void;
  onRemovePage: (pageId: string) => void;
  onToggleArm: () => void;
}

const GroupCard: React.FC<GroupCardProps> = ({
  group,
  index,
  label,
  color,
  mode,
  targetTitle,
  armed,
  canMoveUp,
  canMoveDown,
  busy,
  bookTOC,
  allPageIdSet,
  onMoveUp,
  onMoveDown,
  onRemoveGroup,
  onRemovePage,
  onToggleArm,
}) => {
  const dropTarget: DropTarget = { type: "group", groupIndex: index };
  const { setNodeRef, isOver } = useDroppable({
    id: `group-drop-${index}`,
    data: dropTarget,
  });
  const realPageIds = group.pageIds.filter((id) => allPageIdSet.has(id));

  return (
    <li
      ref={setNodeRef}
      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
      className={`rounded-md border p-3 transition-colors ${
        isOver
          ? "border-primary-400 bg-primary-50"
          : armed
            ? "border-primary-300"
            : "border-neutral-200"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span
            className="flex shrink-0 items-center"
            aria-label={`Group ${index + 1}`}
          >
            <GroupShape index={index} color={color} size={12} />
          </span>
          {label}
        </span>
        <div className="flex items-center gap-1">
          <IconButton
            name="move-up"
            title="Move group up"
            aria-label="Move group up"
            variant="ghost"
            size="sm"
            icon={<IconArrowUp size={14} />}
            disabled={!canMoveUp || busy}
            onClick={onMoveUp}
          />
          <IconButton
            name="move-down"
            title="Move group down"
            aria-label="Move group down"
            variant="ghost"
            size="sm"
            icon={<IconArrowDown size={14} />}
            disabled={!canMoveDown || busy}
            onClick={onMoveDown}
          />
          <IconButton
            name="remove-group"
            title="Remove group"
            aria-label="Remove group"
            variant="ghost"
            size="sm"
            icon={<IconTrash size={14} />}
            disabled={busy}
            onClick={onRemoveGroup}
          />
        </div>
      </div>

      {mode !== "PAGE" && (
        <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
          <span>
            Displays on: <strong className="text-neutral-700">{targetTitle}</strong>
          </span>
          {mode === "CHAPTER" && (
            <Button
              size="sm"
              variant={armed ? "secondary" : "ghost"}
              icon={<IconMapPin size={12} />}
              iconPosition="left"
              onClick={onToggleArm}
              disabled={busy}
              className="!min-h-0 !py-0.5 !px-2 !text-xs"
            >
              {armed ? "Click a page…" : "Set Target"}
            </Button>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        {realPageIds.map((pageId) => (
          <PageChip
            key={pageId}
            pageId={pageId}
            dragId={`chip-${index}-${pageId}`}
            title={findTocNodeById(bookTOC, pageId)?.title ?? pageId}
            onRemove={() => onRemovePage(pageId)}
            disabled={busy}
          />
        ))}
        {realPageIds.length === 0 && (
          <span className="text-xs text-neutral-400">
            <em>Drag pages here.</em>
          </span>
        )}
      </div>
    </li>
  );
};

const UnassignedZone: React.FC<{
  pageIds: string[];
  bookTOC: TableOfContents;
  busy: boolean;
}> = ({ pageIds, bookTOC, busy }) => {
  const dropTarget: DropTarget = { type: "unassigned" };
  const { setNodeRef, isOver } = useDroppable({
    id: "unassigned-drop",
    data: dropTarget,
  });
  if (pageIds.length === 0) return null;
  return (
    <div
      ref={setNodeRef}
      className={`mt-4 rounded-md border p-3 transition-colors ${
        isOver ? "border-primary-400 bg-primary-50" : "border-amber-200 bg-amber-50"
      }`}
    >
      <p className="text-sm font-semibold text-amber-800">
        {pageIds.length} unassigned page{pageIds.length === 1 ? "" : "s"}
      </p>
      <p className="mt-1 text-xs text-amber-700">
        Drag a page onto a group to assign it.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {pageIds.map((pageId) => (
          <PageChip
            key={pageId}
            pageId={pageId}
            dragId={`unassigned-${pageId}`}
            title={findTocNodeById(bookTOC, pageId)?.title ?? pageId}
            disabled={busy}
          />
        ))}
      </div>
    </div>
  );
};

const GlossaryConfigModal: React.FC<GlossaryConfigModalProps> = ({
  open,
  onClose,
  library,
  coverID,
  bookTOC,
  glossaryPageId,
  addNotification,
}) => {
  const queryClient = useQueryClient();
  const { control, getValues, setValue, watch, reset } =
    useForm<GlossaryConfigFormFields>({ defaultValues: DEFAULT_VALUES });
  const { fields, append, remove, move, update, replace } = useFieldArray({
    control,
    name: "groups",
  });
  const mode = watch("mode");
  const [armedGroupIndex, setArmedGroupIndex] = useState<number | null>(null);
  const [activeDragPageIds, setActiveDragPageIds] = useState<string[] | null>(
    null,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const { isLoading } = useQuery({
    queryKey: ["glossary-config", library, coverID],
    queryFn: async () => {
      const res = await api.getGlossaryConfig(library, coverID);
      if (res.err) {
        throw new Error(res.errMsg ?? "Failed to load glossary configuration.");
      }
      return res;
    },
    enabled: open,
    onSuccess: (res) => {
      if (res.exists && res.config) {
        reset({
          mode: res.config.mode,
          groups: res.config.groups,
        });
      } else {
        reset({
          mode: "PAGE",
          groups: generateDefaultGroups("PAGE", bookTOC, glossaryPageId),
        });
      }
    },
    onError: (err) => {
      addNotification({
        message: getErrorMessage(err, "Failed to load glossary configuration."),
        type: "error",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const values = getValues();
      const res = await api.saveGlossaryConfig({
        library,
        coverID,
        mode: values.mode,
        glossaryPageId,
        groups: values.groups,
      });
      if (res.err) {
        throw new Error(res.errMsg ?? "Failed to save glossary configuration.");
      }
      return res;
    },
    onSuccess: () => {
      addNotification({
        message: "Glossary configuration saved successfully",
        type: "success",
      });
      queryClient.invalidateQueries(["glossary-config", library, coverID]);
      onClose();
    },
    onError: (err) => {
      addNotification({
        message: getErrorMessage(err, "Failed to save glossary configuration."),
        type: "error",
      });
    },
  });

  const resetSavedMutation = useMutation({
    mutationFn: async () => {
      const res = await api.deleteGlossaryConfig(library, coverID);
      if (res.err) {
        throw new Error(res.errMsg ?? "Failed to reset glossary configuration.");
      }
    },
    onSuccess: () => {
      addNotification({
        message: "Saved glossary configuration reset",
        type: "success",
      });
      queryClient.invalidateQueries(["glossary-config", library, coverID]);
      reset({
        mode: "PAGE",
        groups: generateDefaultGroups("PAGE", bookTOC, glossaryPageId),
      });
    },
    onError: (err) => {
      addNotification({
        message: getErrorMessage(err, "Failed to reset glossary configuration."),
        type: "error",
      });
    },
  });

  const allPageIds = useMemo(
    () => bookTOC.children.flatMap(collectSubtreeIds),
    [bookTOC],
  );
  const allPageIdSet = useMemo(() => new Set(allPageIds), [allPageIds]);

  const assignedPageIds = useMemo(
    () => new Set(fields.flatMap((g) => g.pageIds)),
    [fields],
  );

  // Color is a supplementary cue, not the only one — a colorblind viewer (or
  // anyone once colors repeat past 8 groups) identifies a group by its
  // shape, matched 1:1 with the shape badge on each group card.
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

  const getGroupLabel = (group: GlossaryConfigGroup, index: number): string => {
    const firstRealPageTitle = group.pageIds
      .map((id) => findTocNodeById(bookTOC, id)?.title)
      .find((title) => !!title);
    return firstRealPageTitle ?? `Group ${index + 1}`;
  };

  const getTargetTitle = (group: GlossaryConfigGroup): string => {
    if (!group.targetPageId) return "Not set";
    return findTocNodeById(bookTOC, group.targetPageId)?.title ?? "Unknown page";
  };

  const removePageFromGroup = (pageId: string, groupIndex: number) => {
    const group = getValues(`groups.${groupIndex}`);
    update(groupIndex, {
      ...group,
      pageIds: group.pageIds.filter((id) => id !== pageId),
    });
  };

  const handleModeChange = (newMode: GlossaryConfigMode) => {
    setValue("mode", newMode, { shouldDirty: true });
    replace(generateDefaultGroups(newMode, bookTOC, glossaryPageId));
    setArmedGroupIndex(null);
  };

  const handleResetToDefault = () => {
    replace(generateDefaultGroups(mode, bookTOC, glossaryPageId));
    setArmedGroupIndex(null);
  };

  const handleAddGroup = () => {
    append({
      groupID: crypto.randomUUID(),
      pageIds: [],
      targetPageId: glossaryPageId ?? fallbackTargetPageId(bookTOC),
    });
  };

  const handleToggleArm = (index: number) => {
    setArmedGroupIndex((prev) => (prev === index ? null : index));
  };

  const handleTocNodeClick = (pageId: string) => {
    if (armedGroupIndex === null) return;
    const group = getValues(`groups.${armedGroupIndex}`);
    update(armedGroupIndex, { ...group, targetPageId: pageId });
    setArmedGroupIndex(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const pageIds = event.active.data.current?.pageIds as string[] | undefined;
    const overData = event.over?.data.current as DropTarget | undefined;
    setActiveDragPageIds(null);
    if (!pageIds || pageIds.length === 0 || !overData) return;
    replace(resolveDrop(getValues("groups"), pageIds, overData));
  };

  const handleClose = () => {
    reset(DEFAULT_VALUES);
    setArmedGroupIndex(null);
    onClose();
  };

  const busy = saveMutation.isLoading || resetSavedMutation.isLoading;

  return (
    <Modal open={open} onClose={(v) => !v && !busy && handleClose()} size="xl">
      <Modal.Header>
        <Modal.Title>Configure Glossary</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
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
              value={mode}
              onChange={handleModeChange}
              disabled={busy}
            />

            <div className="mt-4 grid grid-cols-[1fr_16rem] gap-4">
              <div>
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-semibold text-neutral-700">
                    Groups
                  </h5>
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
                  aria-label="Glossary groups"
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
                      armed={armedGroupIndex === index}
                      canMoveUp={index > 0}
                      canMoveDown={index < fields.length - 1}
                      busy={busy}
                      bookTOC={bookTOC}
                      allPageIdSet={allPageIdSet}
                      onMoveUp={() => move(index, index - 1)}
                      onMoveDown={() => move(index, index + 1)}
                      onRemoveGroup={() => remove(index)}
                      onRemovePage={(pageId) => removePageFromGroup(pageId, index)}
                      onToggleArm={() => handleToggleArm(index)}
                    />
                  ))}
                  {fields.length === 0 && (
                    <p className="text-sm text-neutral-500">
                      <em>No groups yet — add one to get started.</em>
                    </p>
                  )}
                </ul>

                <UnassignedZone
                  pageIds={unassignedPageIds}
                  bookTOC={bookTOC}
                  busy={busy}
                />

                {staleEntries.length > 0 && (
                  <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3">
                    <p className="text-sm font-semibold text-red-800">
                      {staleEntries.length} page
                      {staleEntries.length === 1 ? "" : "s"} no longer found in
                      this book
                    </p>
                    <p className="mt-1 text-xs text-red-700">
                      These pages were removed or moved since this
                      configuration was saved. Remove them, or leave them —
                      they won't affect anything until then.
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
                            onClick={() => removePageFromGroup(pageId, groupIndex)}
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
              </div>

              <div className="min-w-0">
                <h5 className="text-sm font-semibold text-neutral-700">
                  Table of Contents
                </h5>
                {armedGroupIndex !== null && (
                  <p className="mt-1 rounded bg-primary-50 px-2 py-1 text-xs text-primary-700">
                    Click a page to set it as the target for “
                    {getGroupLabel(fields[armedGroupIndex], armedGroupIndex)}”.
                  </p>
                )}
                <div className="mt-2 max-h-[22rem] overflow-y-auto rounded-md border border-neutral-200 p-2">
                  <GlossaryConfigTocTree
                    items={bookTOC.children}
                    onNodeClick={handleTocNodeClick}
                    pageGroupInfo={pageGroupInfo}
                  />
                </div>
              </div>
            </div>

            <DragOverlay>
              {activeDragPageIds && activeDragPageIds.length > 0 && (
                <div className="rounded border border-primary-300 bg-white px-2 py-1 text-sm shadow-lg">
                  {findTocNodeById(bookTOC, activeDragPageIds[0])?.title ??
                    activeDragPageIds[0]}
                  {activeDragPageIds.length > 1 &&
                    ` (+${activeDragPageIds.length - 1} more)`}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="ghost"
          onClick={() => resetSavedMutation.mutate()}
          loading={resetSavedMutation.isLoading}
          disabled={isLoading || busy}
        >
          Reset Saved Configuration
        </Button>
        <Button variant="ghost" onClick={handleClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          onClick={() => saveMutation.mutate()}
          loading={saveMutation.isLoading}
          disabled={isLoading || busy}
        >
          Save
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default GlossaryConfigModal;
