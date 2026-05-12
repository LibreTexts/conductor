import React from "react";
import {   Icon, Loader,  Popup } from "semantic-ui-react";
import { RemixerSubPage } from "./model";
import { Button, Checkbox, IconButton, Modal, Stack, Text } from "@libretexts/davis-react";
import { DAVIS_REMIXER_BTN_CLASS } from "./style";

const collectDescendantIds = (
  nodes: RemixerSubPage[],
  rootId: string,
): string[] => {
  const childrenBy = new Map<string, RemixerSubPage[]>();
  for (const n of nodes) {
    const pid = n.parentID ?? "";
    if (!childrenBy.has(pid)) childrenBy.set(pid, []);
    childrenBy.get(pid)!.push(n);
  }
  const out: string[] = [];
  const walk = (nid: string) => {
    out.push(nid);
    for (const c of childrenBy.get(nid) ?? []) walk(c["@id"]);
  };
  walk(rootId);
  return out;
};

interface BookImportModalProps {
  open: boolean;
  bookTitle: string;
  rootId: string | null;
  subtree: RemixerSubPage[] | null;
  subtreeLoading: boolean;
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  expandedIds: Set<string>;
  setExpandedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  isImporting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const BookImportModal: React.FC<BookImportModalProps> = ({
  open,
  bookTitle,
  rootId,
  subtree,
  subtreeLoading,
  selectedIds,
  setSelectedIds,
  expandedIds,
  setExpandedIds,
  isImporting,
  onCancel,
  onConfirm,
}) => {
  const toggleSelection = (pageId: string, checked: boolean) => {
    if (!subtree) return;
    const ids = collectDescendantIds(subtree, pageId);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (checked) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  const toggleExpanded = (pageId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };

  const selectableIds = React.useMemo<string[]>(() => {
    if (!subtree || !rootId) return [];
    return subtree
      .filter((n) => n["@id"] !== rootId)
      .map((n) => n["@id"]);
  }, [subtree, rootId]);

  const allSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableIds));
    }
  };

  const expandableIds = React.useMemo<string[]>(() => {
    if (!subtree || !rootId) return [];
    const hasChildren = new Set(
      subtree.map((n) => n.parentID).filter((pid): pid is string => !!pid),
    );
    return subtree
      .filter((n) => n["@id"] !== rootId && hasChildren.has(n["@id"]))
      .map((n) => n["@id"]);
  }, [subtree, rootId]);

  const allExpanded =
    expandableIds.length > 0 &&
    expandableIds.every((id) => expandedIds.has(id));

  const toggleExpandAll = () => {
    if (allExpanded) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(expandableIds));
    }
  };

  const renderRows = (parentId: string, depth: number): React.ReactNode => {
    if (!subtree) return null;
    const children = subtree.filter((n) => n.parentID === parentId);
    return children.map((child) => {
      const id = child["@id"];
      const title = child["@title"] || child.title || "Untitled";
      const hasChildren = subtree.some((n) => n.parentID === id);
      const expanded = expandedIds.has(id);
      const selected = selectedIds.has(id);
      return (
        <React.Fragment key={id}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 0",
              marginLeft: depth * 16,
            }}
          >
            <span style={{ width: 22, flexShrink: 0, textAlign: "center" }}>
              {hasChildren ? (
                <Icon
                  name={expanded ? "chevron down" : "chevron right"}
                  link
                  onClick={() => toggleExpanded(id)}
                />
              ) : null}
            </span>
            <Checkbox
              name="selected"
              checked={selected}
              onChange={(checked) => toggleSelection(id, checked)}
            />
            <span style={{ flex: 1, minWidth: 0 }}>{title}</span>
          </div>
          {hasChildren && expanded ? renderRows(id, depth + 1) : null}
        </React.Fragment>
      );
    });
  };

  return (
    <Modal open={open} size="xl" onClose={onCancel}>
      <Modal.Header>Import from book</Modal.Header>
      <Modal.Body >
        <Text>
          Choose pages from <strong>{bookTitle}</strong> to copy into the
          current book. Folders toggle with all nested pages.
        </Text>
          
        {subtreeLoading ? (
          <div  className="flex justify-center items-center h-full">
            <Loader active inline="centered" content="Loading pages…" />
          </div>
        ) : subtree && rootId ? (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 12,
              }}
            >
              <span style={{ color: "rgba(0,0,0,.6)", fontSize: "0.9em" }}>
                {selectedIds.size} of {selectableIds.length} selected
              </span>
            
                <Stack direction="horizontal" gap="md" justify="end">
                <Popup
                  content={allExpanded ? "Collapse all" : "Expand all"}
                  position="top center"
                  trigger={
                
                    <IconButton
                      icon={<Icon name={allExpanded ? "chevron up" : "chevron down"} />}
                      onClick={toggleExpandAll}
                      disabled={expandableIds.length === 0}
                      aria-label={allExpanded ? "Collapse all" : "Expand all"}
                      className={DAVIS_REMIXER_BTN_CLASS.neutral}
                    />
                  }
                />


                <Button
                  size="sm"
                  onClick={toggleSelectAll}
                  disabled={selectableIds.length === 0}
                  className={DAVIS_REMIXER_BTN_CLASS.neutral}
                >
                  {allSelected ? "Deselect all" : "Select all"}
                </Button> </Stack>
           
            </div>
            <div
              style={{
                maxHeight: 420,
                overflowY: "auto",
                border: "1px solid rgba(34,36,38,.15)",
                borderRadius: 4,
                padding: "8px 12px",
                marginTop: 8,
              }}
            >
              {renderRows(rootId, 0)}
            </div>
          </>
        ) : null}
      </Modal.Body>
      <Modal.Footer>
        <Stack direction="horizontal" gap="md" justify="end">
        <Button onClick={onCancel} className={DAVIS_REMIXER_BTN_CLASS.base}>Cancel</Button>
        <Button
          disabled={subtreeLoading || !subtree || selectedIds.size === 0}
          loading={isImporting}
          onClick={onConfirm}
          className={DAVIS_REMIXER_BTN_CLASS.success}
        >
          Import selected
        </Button></Stack>
      </Modal.Footer>
    </Modal>
  );
};

export default BookImportModal;
