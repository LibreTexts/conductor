import { Icon, List } from "semantic-ui-react";
import { Dispatch, DragEvent, SetStateAction, useMemo, useState } from "react";
import { PathLevelFormat, RemixerSubPage } from "../model";
import {
  appendSiblingTitleSuffix,
  computeRemixerOrdinalPathsMap,
  getRemixerDisplayTitle,
  isMatterNode,
} from "../services";
import TreeNodeContainer from "./TreeNodeContainer";
import { STATUS_PALETTE } from "../style";

type DropPosition = "before" | "inside" | "after";
type TreeId = "library" | "book";



interface ExternalDropPayload {
  sourceTreeId: TreeId;
  node: RemixerSubPage;
}

interface TreeDndProps {
  currentBook: RemixerSubPage[];
  autoNumbering?: boolean;
  pathLevelFormats?: PathLevelFormat[];
  onExpand?: (id: string) => void;
  treeId: TreeId;
  onImportNode?: (params: {
    sourceTreeId: TreeId;
    targetTreeId: TreeId;
    node: RemixerSubPage;
    targetNodeId: string;
    position: DropPosition;
    targetParentId: string;
  }) => void;
  onImportNodeById?: (params: {
    nodeId: string;
    targetTreeId: TreeId;
    targetNodeId: string;
    position: DropPosition;
    targetParentId: string;
  }) => void;
  onReorderNode?: (params: {
    draggedNodeId: string;
    targetNodeId: string;
    position: DropPosition;
  }) => void;
  onMarkMovedNodes?: (nodeIds: string[]) => void;
  selectedNodeId?: string;
  onSelectNode?: (nodeId?: string) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  onNodeContextMenu?: (nodeId: string, event: React.MouseEvent) => void;
  expandedNodeIds: Set<string>;
  setExpandedNodeIds: Dispatch<SetStateAction<Set<string>>>;
}

const TreeDnd: React.FC<TreeDndProps> = ({
  currentBook,
  autoNumbering = true,
  pathLevelFormats = [],
  onExpand,
  treeId,
  onImportNode,
  onImportNodeById,
  onReorderNode,
  onMarkMovedNodes,
  selectedNodeId,
  onSelectNode,
  onNodeDoubleClick,
  onNodeContextMenu,
  expandedNodeIds,
  setExpandedNodeIds,
}) => {
  const isBookTree = treeId === "book";

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    targetId: string;
    position: DropPosition;
  } | null>(null);

  const pagesById = useMemo(
    () => new Map(currentBook.map((page) => [page["@id"], page])),
    [currentBook],
  );

  const ordinalPathById = useMemo(() => {
    if (!isBookTree) return new Map<string, string[]>();
    return computeRemixerOrdinalPathsMap(currentBook, pathLevelFormats);
  }, [isBookTree, currentBook, pathLevelFormats]);

  const getDisplayedParentId = (page: RemixerSubPage): string =>
    page.parentID ?? "-1";

  const getChildrenByParent = (parentId: string): RemixerSubPage[] =>
    currentBook.filter((p) => (p.parentID ?? "-1") === parentId);

  const hasChildren = (pageId: string): boolean =>
    getChildrenByParent(pageId).length > 0;

  const isMatterBranchNode = (nodeId: string): boolean => {
    if (!isBookTree) return false;
    let currentId: string | undefined = nodeId;
    const visited = new Set<string>();
    while (currentId && currentId !== "-1" && !visited.has(currentId)) {
      visited.add(currentId);
      const node = pagesById.get(currentId);
      if (!node) return false;
      if (isMatterNode(node)) return true;
      currentId = getDisplayedParentId(node);
    }
    return false;
  };

  const isDescendant = (nodeId: string, ancestorId: string): boolean => {
    let currentParentId = pagesById.get(nodeId)?.parentID;
    while (currentParentId && currentParentId !== "-1") {
      if (currentParentId === ancestorId) {
        return true;
      }
      currentParentId = pagesById.get(currentParentId)?.parentID;
    }
    return false;
  };

  const getDropPosition = (
    event: DragEvent<HTMLDivElement>,
  ): DropPosition => {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeY = (event.clientY - rect.top) / rect.height;
    if (relativeY < 0.25) return "before";
    if (relativeY > 0.75) return "after";
    return "inside";
  };

  const getEffectiveDropPosition = (
    position: DropPosition,
    targetLevel: number,
  ): DropPosition => {
    // Match legacy Remixer behavior: drops on top-level nodes are always "inside".
    if (targetLevel <= 1) {
      return "inside";
    }
    return position;
  };

  const moveNode = (
    draggedNodeId: string,
    targetNodeId: string,
    position: DropPosition,
  ) => {
    if (!isBookTree) return;
    if (draggedNodeId === targetNodeId) return;

    const targetNode = pagesById.get(targetNodeId);
    const draggedNode = pagesById.get(draggedNodeId);
    if (!targetNode || !draggedNode) return;

    let nextParentId = targetNodeId;
    if (position !== "inside") {
      nextParentId = getDisplayedParentId(targetNode);
    }

    if (!nextParentId || nextParentId === draggedNodeId) return;
    if (isDescendant(nextParentId, draggedNodeId)) return;

    const draggedNodeIsNative = draggedNode.addedItem !== true;
    if (treeId === "book" && draggedNodeIsNative) {
      onMarkMovedNodes?.([draggedNodeId]);
    }

    onReorderNode?.({
      draggedNodeId,
      targetNodeId,
      position,
    });

    setExpandedNodeIds((prev: Set<string>) => {
      const next = new Set(prev);
      next.add(nextParentId);
      return next;
    });
    if (position === "inside") {
      onExpand?.(targetNodeId);
    }
  };

  const getTargetParentId = (
    targetNodeId: string,
    position: DropPosition,
  ): string | null => {
    const targetNode = pagesById.get(targetNodeId);
    if (!targetNode) return null;
    if (position === "inside") return targetNodeId;
    return getDisplayedParentId(targetNode);
  };

  const parseExternalDropPayload = (
    event: DragEvent<HTMLDivElement>,
  ): ExternalDropPayload | null => {
    const rawPayload = event.dataTransfer.getData("application/x-remixer-node");
    if (!rawPayload) return null;
    try {
      const parsedPayload = JSON.parse(rawPayload) as ExternalDropPayload;
      if (!parsedPayload?.node?.["@id"] || !parsedPayload?.sourceTreeId) {
        return null;
      }
      return parsedPayload;
    } catch {
      return null;
    }
  };

  const tryImportById = (
    draggedNodeId: string,
    targetNodeId: string,
    position: DropPosition,
    targetLevel: number,
  ) => {
    const effectivePosition = getEffectiveDropPosition(position, targetLevel);
    const targetParentId = getTargetParentId(targetNodeId, effectivePosition);
    if (!targetParentId) return;
    onImportNodeById?.({
      nodeId: draggedNodeId,
      targetTreeId: treeId,
      targetNodeId,
      position: effectivePosition,
      targetParentId,
    });
  };

  const toggleFolder = (page: RemixerSubPage) => {
    const pageId = page["@id"];
    const isExpanded = expandedNodeIds.has(pageId);

    setExpandedNodeIds((prev: Set<string>) => {
      const next = new Set(prev);
      if (isExpanded) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });

    // Keep lazy-loading behavior when a folder is expanded.
    if (!isExpanded && page["@subpages"]) {
      onExpand?.(pageId);
    }
  };

  const expandFolder = (page: RemixerSubPage) => {
    const pageId = page["@id"];
    const isExpanded = expandedNodeIds.has(pageId);
    if (isExpanded) return;

    setExpandedNodeIds((prev: Set<string>) => {
      const next = new Set(prev);
      next.add(pageId);
      return next;
    });

    if (page["@subpages"]) {
      onExpand?.(pageId);
    }
  };

  const displayTitleOptions = {
    isBookTree,
    autoNumbering: autoNumbering ?? false,
    pathLevelFormats,
    ...(isBookTree
      ? {
          remixerPathLookup: {
            nodesById: pagesById,
            ordinalPathById,
          },
        }
      : {}),
  };

  const renderNodes = (
    parentId: string,
    depth: number,
    parentInDeletedBranch = false,
    parentInMatterNoNumberSubtree = false,
  ) => {
    const children = getChildrenByParent(parentId);

    return children.map((page) => {
      const inMatterNoNumberSubtree =
        parentInMatterNoNumberSubtree || isMatterNode(page);
      const inDeletedBranch =
        parentInDeletedBranch ||
        page.isDeleted === true ||
        page.deletedItem === true;
      const numberPath = isBookTree
        ? (ordinalPathById.get(page["@id"]) ?? [])
        : [];
      const isFolder = page["@subpages"] === true || hasChildren(page["@id"]);
      const isExpanded = expandedNodeIds.has(page["@id"]);
      const isDeleted = page.isDeleted ?? page.deletedItem === true;
      const isImported = page.isImported ?? page.addedItem === true;
      const isRenamed = page.isRenamed ?? page.renamedItem === true;
      const isPlacementChanged =
        page.isPlacementChanged ?? page.movedItem === true;
      const isSelected = selectedNodeId === page["@id"];
      const itemLink = page["uri.ui"] || page["@href"];
      const targetLevel = depth + 1;
      // Lock default matter items (non-added descendants) but keep the
      // matter roots themselves and any user-added children interactive.
      const isInteractionLocked =
        isMatterBranchNode(page["@id"]) &&
        !page.addedItem &&
        !isMatterNode(page);
      const isDropInside =
        dropIndicator?.targetId === page["@id"] &&
        dropIndicator.position === "inside";
      const isDropBefore =
        dropIndicator?.targetId === page["@id"] &&
        dropIndicator.position === "before";
      const isDropAfter =
        dropIndicator?.targetId === page["@id"] &&
        dropIndicator.position === "after";
      return (
        <TreeNodeContainer
          key={page["@id"]}
          page={page}
          isFolder={isFolder}
          isExpanded={isExpanded}
          isDeleted={isDeleted}
          isImported={isImported}
          isRenamed={isRenamed}
          isPlacementChanged={isPlacementChanged}
          isSelected={isSelected}
          isBookTree={isBookTree}
          isInteractionLocked={isInteractionLocked}
          isVisualLocked={isInteractionLocked}
          itemLink={itemLink}
          displayTitle={appendSiblingTitleSuffix(
            getRemixerDisplayTitle(
              page,
              numberPath,
              inMatterNoNumberSubtree,
              inDeletedBranch,
              displayTitleOptions,
            ),
            page,
          )}
          isDropInside={isDropInside}
          isDropBefore={isDropBefore}
          isDropAfter={isDropAfter}
          palette={STATUS_PALETTE}
          onToggleFolder={toggleFolder}
          onDragStart={(event: DragEvent<HTMLDivElement>) => {
            if (isInteractionLocked) return;
            setDraggingId(page["@id"]);
            event.dataTransfer.setData("text/plain", page["@id"]);
            event.dataTransfer.setData(
              "application/x-remixer-node",
              JSON.stringify({
                sourceTreeId: treeId,
                node: page,
              } as ExternalDropPayload),
            );
          }}
          onDragEnd={() => {
            setDraggingId(null);
            setDropIndicator(null);
          }}
          onDragOver={(event: DragEvent<HTMLDivElement>) => {
            if (!isBookTree || isInteractionLocked) return;
            const draggedNodeId =
              draggingId || event.dataTransfer.getData("text/plain");
            // Some browsers only expose transfer payload at drop time.
            // Always allow dragover so cross-tree drop can complete.
            if (draggedNodeId && draggedNodeId === page["@id"]) return;
            event.preventDefault();
            setDropIndicator({
              targetId: page["@id"],
              position: getDropPosition(event),
            });
          }}
          onDragLeave={() => {
            if (dropIndicator?.targetId === page["@id"]) {
              setDropIndicator(null);
            }
          }}
          onDrop={(event: DragEvent<HTMLDivElement>) => {
            if (!isBookTree || isInteractionLocked) return;
            event.preventDefault();
            const draggedNodeId =
              draggingId || event.dataTransfer.getData("text/plain");
            const targetNodeId = page["@id"];
            const position = dropIndicator?.position ?? getDropPosition(event);
            const effectivePosition = getEffectiveDropPosition(
              position,
              targetLevel,
            );
            const externalPayload = parseExternalDropPayload(event);

            setDropIndicator(null);
            setDraggingId(null);

            if (draggedNodeId && pagesById.has(draggedNodeId)) {
              moveNode(draggedNodeId, targetNodeId, effectivePosition);
              return;
            }

            if (!externalPayload || externalPayload.sourceTreeId === treeId) {
              if (draggedNodeId) {
                tryImportById(
                  draggedNodeId,
                  targetNodeId,
                  position,
                  targetLevel,
                );
              }
              return;
            }
            const targetParentId = getTargetParentId(
              targetNodeId,
              effectivePosition,
            );
            if (!targetParentId) return;
            onImportNode?.({
              sourceTreeId: externalPayload.sourceTreeId,
              targetTreeId: treeId,
              node: externalPayload.node,
              targetNodeId,
              position: effectivePosition,
              targetParentId,
            });
          }}
          onSelect={() => {
            if (isBookTree) {
              onSelectNode?.(isSelected ? undefined : page["@id"]);
            }
          }}
          onDoubleClick={() => {
            if (isBookTree) {
              onNodeDoubleClick?.(page["@id"]);
            }
          }}
          onContextMenu={(event: React.MouseEvent) => {
            if (isBookTree && !isInteractionLocked) {
              event.preventDefault();
              onNodeContextMenu?.(page["@id"], event);
            }
          }}
        >
          {isExpanded
            ? renderNodes(
                page["@id"],
                depth + 1,
                inDeletedBranch,
                inMatterNoNumberSubtree,
              )
            : null}
        </TreeNodeContainer>
      );
    });
  };

  // Roots are nodes with parentID === "-1"
  const roots = getChildrenByParent("-1");

  return (
    <div
      style={{
        padding: 12,
        background: "#f9f9f9",
        borderRadius: 8,
        width: "100%",
        boxSizing: "border-box",
        height: 600,
        overflowY: "auto",
        overflowX: "auto",
        marginTop: 12,
      }}
    >
      {/* <div style={{ marginBottom: 8, fontWeight: "bold" }}>
        <Icon name="folder open" /> {title}
      </div> */}

      <List style={{ minWidth: "max-content" }}>
        {roots.map((root) => {
          const inMatterNoNumberSubtree = isMatterNode(root);
          const inDeletedBranch =
            root.isDeleted === true || root.deletedItem === true;
          const numberPath = isBookTree
            ? (ordinalPathById.get(root["@id"]) ?? [])
            : [];
          const isExpanded = true;
          const isDeleted = root.isDeleted ?? root.deletedItem === true;
          const isImported = root.isImported ?? root.addedItem === true;
          const isRenamed = root.isRenamed ?? root.renamedItem === true;
          const isPlacementChanged =
            root.isPlacementChanged ?? root.movedItem === true;
          const isSelected = selectedNodeId === root["@id"];
          const itemLink = root["uri.ui"] || root["@href"];
          const targetLevel = 1;
          // Matter root nodes are interactive so users can right-click to
          // add children; only their non-added descendants stay locked.
          const isInteractionLocked =
            isMatterBranchNode(root["@id"]) &&
            !root.addedItem &&
            !isMatterNode(root);

          return (
            <div key={root["@id"]} data-node-id={root["@id"]}>
            <List.Item
              draggable={!isInteractionLocked}
              onDragStart={(event: DragEvent<HTMLDivElement>) => {
                if (isInteractionLocked) return;
                setDraggingId(root["@id"]);
                event.dataTransfer.setData("text/plain", root["@id"]);
                event.dataTransfer.setData(
                  "application/x-remixer-node",
                  JSON.stringify({
                    sourceTreeId: treeId,
                    node: root,
                  } as ExternalDropPayload),
                );
              }}
              onDragEnd={() => {
                setDraggingId(null);
                setDropIndicator(null);
              }}
              onDragOver={(event: DragEvent<HTMLDivElement>) => {
                if (!isBookTree || isInteractionLocked) return;
                const draggedNodeId =
                  draggingId || event.dataTransfer.getData("text/plain");
                // Some browsers only expose transfer payload at drop time.
                // Always allow dragover so cross-tree drop can complete.
                if (draggedNodeId && draggedNodeId === root["@id"]) return;
                event.preventDefault();
                setDropIndicator({
                  targetId: root["@id"],
                  position: getDropPosition(event),
                });
              }}
              onDragLeave={() => {
                if (dropIndicator?.targetId === root["@id"]) {
                  setDropIndicator(null);
                }
              }}
              onDrop={(event: DragEvent<HTMLDivElement>) => {
                if (!isBookTree || isInteractionLocked) return;
                event.preventDefault();
                const draggedNodeId =
                  draggingId || event.dataTransfer.getData("text/plain");
                const targetNodeId = root["@id"];
                const position = dropIndicator?.position ?? getDropPosition(event);
                const effectivePosition = getEffectiveDropPosition(
                  position,
                  targetLevel,
                );
                const externalPayload = parseExternalDropPayload(event);

                setDropIndicator(null);
                setDraggingId(null);

                if (draggedNodeId && pagesById.has(draggedNodeId)) {
                  moveNode(draggedNodeId, targetNodeId, effectivePosition);
                  return;
                }

              if (!externalPayload || externalPayload.sourceTreeId === treeId) {
                if (draggedNodeId) {
                    tryImportById(
                      draggedNodeId,
                      targetNodeId,
                      position,
                      targetLevel,
                    );
                }
                return;
              }
                const targetParentId = getTargetParentId(
                  targetNodeId,
                  effectivePosition,
                );
                if (!targetParentId) return;
                onImportNode?.({
                  sourceTreeId: externalPayload.sourceTreeId,
                  targetTreeId: treeId,
                  node: externalPayload.node,
                  targetNodeId,
                  position: effectivePosition,
                  targetParentId,
                });
              }}
              onClick={() => {
                if (isBookTree) {
                  if (isInteractionLocked) {
                    onSelectNode?.(undefined);
                    return;
                  }
                  onSelectNode?.(isSelected ? undefined : root["@id"]);
                }
              }}
              onDoubleClick={() => {
                if (isBookTree && !isInteractionLocked) {
                  onNodeDoubleClick?.(root["@id"]);
                }
              }}
              onContextMenu={(event: React.MouseEvent) => {
                if (isBookTree && !isInteractionLocked) {
                  event.preventDefault();
                  onNodeContextMenu?.(root["@id"], event);
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 0",
                opacity: isInteractionLocked ? 0.6 : 1,
                background:
                  dropIndicator?.targetId === root["@id"] &&
                  dropIndicator.position === "inside"
                    ? STATUS_PALETTE.infoBg
                    : isDeleted
                      ? STATUS_PALETTE.errorBg
                      : isImported
                      ? STATUS_PALETTE.successBg
                      : isRenamed || isPlacementChanged || root.movedItem === true
                        ? STATUS_PALETTE.warningBg
                      : "transparent",
                
                borderTop:
                  dropIndicator?.targetId === root["@id"] &&
                  dropIndicator.position === "before"
                    ? `2px solid ${STATUS_PALETTE.info}`
                    : "2px solid transparent",
                borderBottom:
                  dropIndicator?.targetId === root["@id"] &&
                  dropIndicator.position === "after"
                    ? `2px solid ${STATUS_PALETTE.info}`
                    : "2px solid transparent",
                borderRadius: 4,
                outline: isSelected ? `2px solid ${STATUS_PALETTE.info}` : "none",
                cursor: isInteractionLocked ? "not-allowed" : "pointer",
              }}
            >
              <span style={{ width: 12 }} />

              <Icon name="folder" color="grey" />
              <span
                style={{
                  whiteSpace: "nowrap",
                  fontStyle: isInteractionLocked ? "italic" : "normal",
                  color: isInteractionLocked ? "#6b7280" : "inherit",
                  textDecoration: isDeleted ? "line-through" : "none",
                }}
              >
                
                {appendSiblingTitleSuffix(
                  getRemixerDisplayTitle(
                    root,
                    numberPath,
                    inMatterNoNumberSubtree,
                    inDeletedBranch,
                    displayTitleOptions,
                  ),
                  root,
                )}
              </span>
              {!isBookTree && itemLink ? (
                <a
                  href={itemLink}
                  target="_blank"
                  rel="noreferrer"
                  style={{ marginLeft: 8, color: "#1e70bf" }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <Icon name="linkify" />
                </a>
              ) : null}
            </List.Item>
            {renderNodes(
              root["@id"],
              1,
              inDeletedBranch,
              inMatterNoNumberSubtree,
            )}
          </div>
          );
        })}
      </List>
    </div>
  );
};

export default TreeDnd;