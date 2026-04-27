import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useMediaQuery } from "react-responsive";
import {
  Button,
  Container,
  Dimmer,
  Dropdown,
  Grid,
  Icon,
  Loader,
  Popup,
} from "semantic-ui-react";

import api from "../../api";
import { useNotifications } from "../../context/NotificationContext";
import { useTypedSelector } from "../../state/hooks";
import { flattenCatalogResponse } from "../../utils/booksManagerHelpers";

import BookImportModal from "./BookImportModal";
import ContextMenu from "./BookContent/ContextMenu";
import TreeDnd from "./BookContent/Dashboard";
import TreeSkeleton from "./BookContent/TreeSkeleton";
import CatalogList from "./CatalogBook/CatalogList";
import ControlPanel from "./ControlPanel";
import EditPanel from "./EditPanel";
import PathNameFormat from "./PathNameFormat";
import PublishPanel from "./PublishPanel";
import RecoveryModal from "./RecoveryModal";
import {
  CopyMode,
  Library,
  PathLevelFormat,
  PublishJobStatus,
  RemixerData,
  RemixerSubPage,
  RemixerUiState,
  libraries,
  libraryTitles,
  remixerDataInit,
  remixerUiStateInit,
} from "./model";
import {
  DropPosition,
  applyBookNodeDeletion,
  applyDefaultBookArticleTypes,
  buildBookPaths,
  clearLocalDraft,
  cloneBook,
  computeHighestPathLevel,
  computeLibraryImportInsertion,
  computeNodeDepth,
  getLocalDraft,
  getNewNodeTitleForDepth,
  getNodeTypeLabelForDepth,
  isBookLevelCatalogNode,
  isLibrary,
  isMatterBranchNode as isMatterBranchNodePure,
  isRestrictedLibraryShelfNode,
  isRootBookNode,
  reorderBookNodes,
  setLocalDraft,
  syncRenamedItemFromAutonumberTitle,
  withDerivedStatusFlags,
} from "./services";
import {
  STATUS_PALETTE,
  buttonStyle,
  handleMouseEnter,
  handleMouseLeave,
} from "./style";

const RemixerDashboard: React.FC = () => {
  // ==========================================================================
  // State
  // ==========================================================================
  const user = useTypedSelector((state) => state.user);
  const isAdmin = user?.isSuperAdmin || user?.isCampusAdmin;
  const { addNotification } = useNotifications();
  const { id } = useParams<{ id: string }>();
  /** Below `md` (~768px): book toolbar actions collapse into a dropdown (Tailwind `sm` + `xs`). */
  const isBookToolbarNarrow = useMediaQuery({ maxWidth: 767 });

  const [remixerData, setRemixerData] = useState<RemixerData>(remixerDataInit);
  const [uiState, setUiState] = useState<RemixerUiState>(remixerUiStateInit);
  const [libraryLoading, setLibraryLoading] = useState<boolean>(false);

  const [expandedNodeIdsBook, setExpandedNodeIdsBook] = useState<Set<string>>(
    new Set(),
  );
  const [expandedNodeIdsLibrary, setExpandedNodeIdsLibrary] = useState<
    Set<string>
  >(new Set());

  const [undoStack, setUndoStack] = useState<RemixerSubPage[][]>([]);
  const [redoStack, setRedoStack] = useState<RemixerSubPage[][]>([]);

  const [publishStatus, setPublishStatus] = useState<PublishJobStatus>("idle");
  const [publishMessages, setPublishMessages] = useState<string[]>([]);
  const [publishPolling, setPublishPolling] = useState<boolean>(false);

  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [loadingRecovery, setLoadingRecovery] = useState(false);
  const [availableSources, setAvailableSources] = useState<{
    hasLocal: boolean;
    hasServer: boolean;
    hasServerDraft: boolean;
    localTimestamp?: number;
  }>({ hasLocal: false, hasServer: false, hasServerDraft: false });

  const [contextMenu, setContextMenu] = useState<{
    nodeId: string;
    x: number;
    y: number;
  } | null>(null);

  const [pendingBookImport, setPendingBookImport] = useState<{
    node: RemixerSubPage;
    targetNodeId: string;
    position: DropPosition;
    targetParentId: string;
  } | null>(null);
  const [bookImportSubtree, setBookImportSubtree] = useState<
    RemixerSubPage[] | null
  >(null);
  const [bookImportSubtreeLoading, setBookImportSubtreeLoading] =
    useState(false);
  const [bookImportSelectedIds, setBookImportSelectedIds] = useState<
    Set<string>
  >(new Set());
  const [bookImportExpandedIds, setBookImportExpandedIds] = useState<
    Set<string>
  >(new Set());
  const [isImportingFromLibrary, setIsImportingFromLibrary] =
    useState<boolean>(false);

  /** When true, the selected-library useEffect skips one fetch (catalog-driven load already populated `library`). */
  const skipLibraryAutoLoadRef = useRef(false);
  /** Last known server-persisted book state; used by the recovery modal so we don't refetch. */
  const serverStateRef = useRef<{
    book: RemixerSubPage[];
    settings: {
      autoNumbering?: boolean;
      copyModeState?: string;
      pathLevelFormats?: unknown;
    };
  } | null>(null);

  // ==========================================================================
  // Derived selectors (recomputed each render)
  // ==========================================================================

  /** Currently-loaded pages for the selected library (may be undefined until loaded). */
  const selectedLibraryPages = remixerData.selectedLibrary
    ? remixerData.library?.[remixerData.selectedLibrary]
    : undefined;

  /** The book node matching the current selection, if any. */
  const selectedBookNode = uiState.selectedBookNodeId
    ? remixerData.currentBook?.find(
        (node) => node["@id"] === uiState.selectedBookNodeId,
      )
    : undefined;

  /** True when a library node is a restricted shelf (cannot be imported). */
  const isRestrictedShelfNode = useCallback(
    (nodeId: string): boolean =>
      isRestrictedLibraryShelfNode(selectedLibraryPages ?? [], nodeId),
    [selectedLibraryPages],
  );

  /** True when a library node is a catalog-registered book (triggers the extract modal). */
  const isBookLevelLibraryNode = useCallback(
    (nodeId: string): boolean =>
      isBookLevelCatalogNode(
        remixerData.catalogBook,
        remixerData.selectedLibrary,
        nodeId,
      ),
    [remixerData.catalogBook, remixerData.selectedLibrary],
  );

  /** True when a book node lives inside a front/back matter subtree. */
  const isMatterBranchNode = (nodeId?: string): boolean =>
    isMatterBranchNodePure(nodeId, remixerData.currentBook ?? []);

  /** Deepest path level present in the current book (drives the path-format modal). */
  const highestPathLevel = useCallback(
    (): number => computeHighestPathLevel(remixerData.currentBook ?? []),
    [remixerData.currentBook],
  );

  /** True when every folder in the current book is already expanded. */
  const isExpandedAllCurrentBookNodes = useCallback(() => {
    const { currentBook } = remixerData;
    if (!currentBook) return false;
    const nodesToExpand = currentBook
      .filter((node) => node["@subpages"])
      .map((node) => node["@id"]);
    return nodesToExpand.every((nodeId) => expandedNodeIdsBook.has(nodeId));
  }, [remixerData.currentBook, expandedNodeIdsBook]);

  /** Depth of `nodeId` from the nearest root (book cover node counts as root). */
  const getContextNodeDepth = (nodeId: string): number =>
    computeNodeDepth(remixerData.currentBook ?? [], nodeId, {
      stopAtParentId: remixerData.liberCoverID,
    });

  const contextMenuCanAddSibling =
    contextMenu != null &&
    !isRootBookNode(remixerData.currentBook ?? [], contextMenu.nodeId);

  const contextMenuCanDuplicate =
    contextMenu != null &&
    !(remixerData.currentBook ?? []).some(
      (n) => n.parentID === contextMenu.nodeId,
    );

  const contextMenuSiblingTypeLabel = contextMenu
    ? getNodeTypeLabelForDepth(getContextNodeDepth(contextMenu.nodeId) - 1)
    : "Item";
  const contextMenuChildTypeLabel = contextMenu
    ? getNodeTypeLabelForDepth(getContextNodeDepth(contextMenu.nodeId))
    : "Item";

  /** Auto-numbered default path prefix for the selected node (edit-panel placeholder). */
  const selectedBookDefaultFormattedPath = useCallback((): string => {
    if (remixerData.autoNumbering === false) return "";
    const selectedId = uiState.selectedBookNodeId;
    const book = remixerData.currentBook ?? [];
    if (!selectedId || book.length === 0) return "";
    const normalizedBook = buildBookPaths(
      book,
      uiState.pathLevelFormats ?? [],
      {
        ignoreOverrides: true,
      },
    );
    return (
      normalizedBook.find((node) => node["@id"] === selectedId)
        ?.formattedPath ?? ""
    );
  }, [
    remixerData.autoNumbering,
    remixerData.currentBook,
    uiState.pathLevelFormats,
    uiState.selectedBookNodeId,
  ]);

  // ==========================================================================
  // Book state mutation
  // ==========================================================================

  /** Rebuild numeric/formatted paths and status flags for a book. Optionally seeds `originalPathNumber`. */
  const normalizeBookState = useCallback(
    (
      book: RemixerSubPage[],
      options: { initializeOriginalPathNumber?: boolean } = {},
    ): RemixerSubPage[] => {
      const { initializeOriginalPathNumber = false } = options;
      const withPaths = buildBookPaths(
        book,
        uiState.pathLevelFormats ?? [],
      ).map((page) =>
        initializeOriginalPathNumber
          ? {
              ...page,
              originalPathNumber: page.pathNumber ? [...page.pathNumber] : [],
            }
          : page,
      );
      const withRenamed = syncRenamedItemFromAutonumberTitle(
        withPaths,
        remixerData.autoNumbering ?? true,
        uiState.pathLevelFormats ?? [],
      );
      const withArticleTypes = applyDefaultBookArticleTypes(
        withRenamed,
        remixerData.liberCoverID,
      );
      return withDerivedStatusFlags(withArticleTypes);
    },
    [uiState.pathLevelFormats, remixerData.autoNumbering, remixerData.liberCoverID],
  );

  /** Apply an updater to `currentBook`, re-normalize, and optionally push the previous snapshot to undo. */
  const updateCurrentBook = (
    updater: (prevBook: RemixerSubPage[]) => RemixerSubPage[],
    options: { trackHistory?: boolean } = {},
  ) => {
    const { trackHistory = false } = options;
    setRemixerData((prev) => {
      const prevBook = prev.currentBook ?? [];
      const nextBook = normalizeBookState(updater(prevBook));
      const changed = JSON.stringify(prevBook) !== JSON.stringify(nextBook);

      if (!changed) {
        return prev;
      }

      if (trackHistory) {
        setUndoStack((prevUndo) => [...prevUndo, cloneBook(prevBook)]);
        setRedoStack([]);
      }

      return {
        ...prev,
        currentBook: nextBook,
      };
    });
  };

  /** Merge persisted draft/project settings (auto-numbering, path formats, copy mode) into state. */
  const applyDraftSettings = (settings: {
    autoNumbering?: boolean;
    copyModeState?: string;
    pathLevelFormats?: unknown;
  }) => {
    if (settings.autoNumbering !== undefined) {
      setRemixerData((prev) => ({
        ...prev,
        autoNumbering: settings.autoNumbering,
      }));
    }
    if (
      settings.copyModeState !== undefined ||
      settings.pathLevelFormats !== undefined
    ) {
      setUiState((prev) => ({
        ...prev,
        ...(settings.copyModeState !== undefined && {
          copyModeState: settings.copyModeState,
        }),
        ...(settings.pathLevelFormats !== undefined && {
          pathLevelFormats: settings.pathLevelFormats as PathLevelFormat[],
        }),
      }));
    }
  };

  /** Restore the previous book snapshot from the undo stack (pushing the current one to redo). */
  const handleUndo = () => {
    setUndoStack((prevUndo) => {
      if (prevUndo.length === 0) return prevUndo;
      const previousBook = prevUndo[prevUndo.length - 1];
      setRemixerData((prev) => {
        const currentBook = prev.currentBook ?? [];
        setRedoStack((prevRedo) => [...prevRedo, cloneBook(currentBook)]);
        return {
          ...prev,
          currentBook: normalizeBookState(cloneBook(previousBook)),
        };
      });
      return prevUndo.slice(0, -1);
    });
  };

  /** Re-apply the most recently undone book snapshot. */
  const handleRedo = () => {
    setRedoStack((prevRedo) => {
      if (prevRedo.length === 0) return prevRedo;
      const nextBook = prevRedo[prevRedo.length - 1];
      setRemixerData((prev) => {
        const currentBook = prev.currentBook ?? [];
        setUndoStack((prevUndo) => [...prevUndo, cloneBook(currentBook)]);
        return {
          ...prev,
          currentBook: normalizeBookState(cloneBook(nextBook)),
        };
      });
      return prevRedo.slice(0, -1);
    });
  };

  // ==========================================================================
  // API loaders & tree expansion
  // ==========================================================================

  /** BFS-load the entire remote book (cover + every descendant) into a flat node list. */
  const loadEntireBook = async (
    projectId: string,
    coverPageId: string,
    libreLibrary: string,
  ): Promise<RemixerSubPage[]> => {
    const nodesById = new Map<string, RemixerSubPage>();
    const fetchedParentIds = new Set<string>();
    const queue: string[] = [];

    const rootDetails = await api.getRemixerPage(
      projectId,
      coverPageId,
      libreLibrary,
      true,
      true,
      { includeMatter: false, linkTitle: true, full: false },
    );
    const rootNode: RemixerSubPage = {
      ...rootDetails.response,
      addedItem: false,
    };
    nodesById.set(rootNode["@id"], rootNode);
    queue.push(rootNode["@id"]);

    while (queue.length > 0) {
      const parentId = queue.shift();
      if (!parentId || fetchedParentIds.has(parentId)) {
        continue;
      }
      fetchedParentIds.add(parentId);

      const response = await api.getRemixerPage(
        projectId,
        parentId,
        libreLibrary,
        false,
        true,
        { includeMatter: false, linkTitle: true, full: false },
      );

      const children: RemixerSubPage[] = (response.response ?? []).map(
        (node: RemixerSubPage) => ({
          ...node,
          addedItem: false,
        }),
      );

      children.forEach((child) => {
        nodesById.set(child["@id"], child);
        if (child["@subpages"]) {
          queue.push(child["@id"]);
        }
      });
    }

    return Array.from(nodesById.values());
  };

  /** BFS-load a library subtree rooted at `rootNode` (used for catalog-book extract imports). */
  const loadLibrarySubtree = useCallback(
    async (
      projectId: string,
      rootNode: RemixerSubPage,
      libreLibrary: string,
    ): Promise<RemixerSubPage[]> => {
      const nodesById = new Map<string, RemixerSubPage>();
      const fetchedParentIds = new Set<string>();
      const queue: string[] = [];

      nodesById.set(rootNode["@id"], {
        ...rootNode,
        addedItem: false,
      });
      queue.push(rootNode["@id"]);

      while (queue.length > 0) {
        const parentId = queue.shift();
        if (!parentId || fetchedParentIds.has(parentId)) {
          continue;
        }
        fetchedParentIds.add(parentId);

        const parentNode = nodesById.get(parentId);
        if (!parentNode?.["@subpages"]) {
          continue;
        }

        const response = await api.getRemixerPage(
          projectId,
          parentId,
          libreLibrary,
          false,
          true,
          { includeMatter: false, linkTitle: true, full: false },
        );

        const children: RemixerSubPage[] = (response.response ?? []).map(
          (node: RemixerSubPage) => ({
            ...node,
            addedItem: false,
          }),
        );

        children.forEach((child) => {
          nodesById.set(child["@id"], child);
          if (child["@subpages"]) {
            queue.push(child["@id"]);
          }
        });
      }

      return Array.from(nodesById.values());
    },
    [],
  );

  /**
   * Open a catalog book: fetch its ancestry so the library tree is expanded to the book,
   * then scroll-reveal the target node with a brief highlight.
   */
  const loadSelectedBook = async (bookID: string, lib: string) => {
    skipLibraryAutoLoadRef.current = true;
    let expandedNodeIds = new Set<string>();
    setRemixerData((prev) => ({ ...prev, selectedLibrary: lib as Library }));
    // fetch bookCoverID
    let pageId = bookID.split("-")[1];
    const fetchingLibarary = [] as RemixerSubPage[];

    while (true) {
      if (fetchingLibarary.find((c) => c["@id"] === pageId)) {
        expandedNodeIds.add(pageId);
        const parent = fetchingLibarary.find((c) => c["@id"] === pageId);
        pageId = parent?.parentID ?? "";
        if (!pageId || pageId === "-1") break;
        continue;
      }
      const res = await api.getRemixerPage(id, pageId, lib, false, false, {
        includeMatter: false,
        linkTitle: true,
        full: false,
      });
      const pagedetails = await api.getRemixerPage(
        id,
        pageId,
        lib,
        true,
        false,
        {
          includeMatter: false,
          linkTitle: true,
          full: false,
        },
      );

      if (res.err === false) {
        fetchingLibarary.push(...res.response);
        expandedNodeIds.add(pageId);
      }

      pageId = pagedetails.response["parentID"];
      if (!pageId || pageId === "-1") {
        console.debug("pageId not found", pageId);
        break;
      }
    }
    const libsubpages = await api.getRemixerPage(id, "0", lib, false, false, {
      includeMatter: false,
      linkTitle: true,
      full: false,
    });
    const libdetails = await api.getRemixerPage(id, "0", lib, true, false, {
      includeMatter: false,
      linkTitle: true,
      full: false,
    });
    try {
      fetchingLibarary.push(...(libsubpages.response as RemixerSubPage[]), {
        ...libdetails.response,
        ["@id"]: "0",
      });
    } catch {
      console.debug("wrong push");
    }

    setRemixerData((prev) => ({
      ...prev,
      library: {
        ...(prev.library ?? {}),
        [lib]: fetchingLibarary.sort(
          (a, b) => parseInt(a["@id"]) - parseInt(b["@id"]),
        ),
      },
      // selectedLibrary: lib as Library,
    }));

    setExpandedNodeIdsLibrary(
      new Set(
        Array.from(expandedNodeIds).sort((a, b) => parseInt(a) - parseInt(b)),
      ),
    );

    setUiState((prev) => ({
      ...prev,
      catalogListOpen: false,
    }));
    setLibraryLoading(false);
    const targetNodeId = bookID.split("-")[1];
    setTimeout(() => {
      skipLibraryAutoLoadRef.current = false;
      const el = document.querySelector<HTMLElement>(
        `[data-node-id="${targetNodeId}"]`,
      );
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.style.transition =
          "outline-color 0.5s ease, background-color 0.5s ease";
        el.style.outline = "2px solid #1e70bf";
        el.style.backgroundColor = "rgba(30, 112, 191, 0.1)";
        el.style.borderRadius = "4px";
        setTimeout(() => {
          el.style.outlineColor = "transparent";
          el.style.backgroundColor = "transparent";
        }, 4000);
        setTimeout(() => {
          el.style.transition = "";
          el.style.outline = "";
          el.style.backgroundColor = "";
          el.style.borderRadius = "";
        }, 4500);
      }
    }, 200);
  };

  /** Lazy-fetch children for a book folder being expanded (skipped if server-backed children already exist). */
  const expandBookTree = async (nodeId: string) => {
    // If this folder has server-backed children, don't refetch.
    // If it only has locally added items, fetch from server.
    const currentChildren = (remixerData.currentBook ?? []).filter(
      (p) => p.parentID === nodeId,
    );
    const hasServerBackedChildren = currentChildren.some(
      (child) => !child.addedItem,
    );
    if (hasServerBackedChildren) {
      return;
    }
    const expandedNode = (remixerData.currentBook ?? []).find(
      (node) => node["@id"] === nodeId,
    );
    const inheritAddedItem = expandedNode?.addedItem === true;

    const resPage = await api.getRemixerPage(
      id,
      nodeId,
      remixerData.libreLibrary || "",
      false,
      true,
      { includeMatter: false, linkTitle: true, full: false },
    );

    updateCurrentBook((existingBook) => {
      const incomingPages: RemixerSubPage[] = (resPage.response ?? []).map(
        (page: RemixerSubPage) => ({
          ...page,
          addedItem: inheritAddedItem,
        }),
      );
      const incomingIds = new Set(incomingPages.map((page) => page["@id"]));
      const updatedExisting = existingBook.map((page) =>
        incomingIds.has(page["@id"])
          ? { ...page, addedItem: inheritAddedItem }
          : page,
      );
      const newPages = incomingPages.filter(
        (incomingPage) =>
          !existingBook.some(
            (existingPage) => existingPage["@id"] === incomingPage["@id"],
          ),
      );
      return [...updatedExisting, ...newPages];
    });
  };

  /** Lazy-fetch children for a library folder on expand (no-op if already loaded). */
  const expandLibraryTree = async (nodeId: string) => {
    if (!remixerData.selectedLibrary) return;
    // If this folder already has loaded children, don't refetch
    if (selectedLibraryPages?.some((p) => p.parentID === nodeId)) {
      return;
    }
    const node = selectedLibraryPages?.find((p) => p["@id"] === nodeId);
    const pagePath =
      node?.title === "Workbench" || node?.["@title"] === "Workbench"
        ? "Workbench"
        : nodeId;
    const resLibrary = await api.getRemixerPage(
      id,
      pagePath,
      remixerData.selectedLibrary,
      false,
      true,
      { includeMatter: false, linkTitle: true, full: false },
    );
    setRemixerData((prev) => ({
      ...prev,
      library: {
        ...(prev.library ?? {}),
        [remixerData.selectedLibrary as Library]: [
          ...(prev.library?.[remixerData.selectedLibrary as Library] ?? []),
          ...(resLibrary.response ?? []),
        ],
      },
    }));
  };

  /** Expand every node in the current book. */
  const expandAllCurrentBook = async () => {
    const { currentBook } = remixerData;
    if (!currentBook) return;
    const ids = currentBook.map((node) => {
      return node["@id"];
    });

    setExpandedNodeIdsBook(new Set(ids));
  };

  /** Collapse every node in the current book. */
  const collapseAllCurrentBook = async () => {
    setExpandedNodeIdsBook(new Set());
  };

  // ==========================================================================
  // Tree edit actions (add / delete / move / rename / duplicate)
  // ==========================================================================

  /** Add a new chapter/page/subpage as a child of the selected node (or the book root). */
  const handleAddBookItem = () => {
    const canNestInSelectedNode = !!uiState.selectedBookNodeId;
    const parentId = canNestInSelectedNode
      ? uiState.selectedBookNodeId
      : remixerData.liberCoverID;
    const newNodeId = `new-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    let title = "New Chapter";
    if (canNestInSelectedNode && parentId !== remixerData.liberCoverID) {
      const depth = computeNodeDepth(
        remixerData.currentBook ?? [],
        uiState.selectedBookNodeId!,
        { stopAtParentId: remixerData.liberCoverID },
      );
      title = getNewNodeTitleForDepth(depth);
    }
    const newNode: RemixerSubPage = {
      "@id": newNodeId,
      "@title": title,
      "@href": "#",
      "@subpages": false,
      article: "article",
      parentID: parentId,
      namespace: "main",
      title,
      "uri.ui": "#",
      addedItem: true,
    };

    updateCurrentBook(
      (existingBookNodes) => [
        ...existingBookNodes.map((node) =>
          node["@id"] === parentId ? { ...node, "@subpages": true } : node,
        ),
        newNode,
      ],
      { trackHistory: true },
    );
    setUiState((prev) => ({ ...prev, selectedBookNodeId: newNodeId }));
    const folderToExpand = uiState.selectedBookNodeId;
    if (folderToExpand) {
      setExpandedNodeIdsBook((prev) => {
        const next = new Set(prev);
        next.add(folderToExpand);
        return next;
      });
    }
  };

  /** Soft-delete the currently selected book node and its descendants (skipped for matter branches). */
  const handleDeleteSelectedBookNode = () => {
    const selectedNodeId = uiState.selectedBookNodeId;
    if (!selectedNodeId) return;
    if (isMatterBranchNode(selectedNodeId)) return;
    updateCurrentBook(
      (existingBookNodes) =>
        applyBookNodeDeletion(existingBookNodes, selectedNodeId),
      { trackHistory: true },
    );
    setUiState((prev) => ({ ...prev, selectedBookNodeId: undefined }));
  };

  /** Flag the given nodes as moved (used after a drag-and-drop reorder completes). */
  const handleMarkMovedNodes = (nodeIds: string[]) => {
    if (nodeIds.length === 0) return;
    setRemixerData((prev) => {
      const existingBook = prev.currentBook ?? [];
      const movedSet = new Set(nodeIds);
      return {
        ...prev,
        currentBook: normalizeBookState(
          existingBook.map((node) =>
            movedSet.has(node["@id"]) && !node.deletedItem
              ? { ...node, movedItem: true }
              : node,
          ),
        ),
      };
    });
  };

  /** Move a node before/after/inside another via the shared reorder helper. */
  const handleReorderBookNode = ({
    draggedNodeId,
    targetNodeId,
    position,
  }: {
    draggedNodeId: string;
    targetNodeId: string;
    position: DropPosition;
  }) => {
    updateCurrentBook(
      (existingBook) =>
        reorderBookNodes({
          existingBook,
          draggedNodeId,
          targetNodeId,
          position,
        }),
      { trackHistory: true },
    );
  };

  /** Persist edits from the edit panel onto the current book (also toggles `renamedItem`). */
  const handleSaveEdit = (page: RemixerSubPage) => {
    if (isMatterBranchNode(page["@id"])) {
      setUiState((prev) => ({ ...prev, editPanelOpen: false }));
      return;
    }
    setUiState((prev) => ({ ...prev, editPanelOpen: false }));
    updateCurrentBook(
      (existingBook) => {
        return existingBook.map((node) => {
          if (node["@id"] !== page["@id"]) return node;
          const previousTitle = node.title || node["@title"] || "";
          const nextTitle = page.title || page["@title"] || "";
          const renamed = previousTitle !== nextTitle;
          return {
            ...node,
            ...page,
            title: nextTitle,
            "@title": nextTitle,
            formattedPathOverride: page.formattedPathOverride === true,
            formattedPath:
              page.formattedPathOverride === true
                ? page.formattedPath
                : undefined,
            renamedItem: node.renamedItem || renamed,
          };
        });
      },
      { trackHistory: true },
    );
  };

  /** Insert a new node above/below `targetNodeId` (as a sibling) or inside it (as a child). */
  const addNodeRelative = (
    targetNodeId: string,
    mode: "above" | "below" | "inside",
  ) => {
    const book = remixerData.currentBook ?? [];
    const nodesById = new Map(book.map((n) => [n["@id"], n]));
    const targetNode = nodesById.get(targetNodeId);
    if (!targetNode) return;

    const newNodeId = `new-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    if (mode === "inside") {
      const depth = getContextNodeDepth(targetNodeId);
      const title = getNewNodeTitleForDepth(depth);
      const newNode: RemixerSubPage = {
        "@id": newNodeId,
        "@title": title,
        "@href": "#",
        "@subpages": false,
        article: "article",
        parentID: targetNodeId,
        namespace: "main",
        title,
        "uri.ui": "#",
        addedItem: true,
      };
      updateCurrentBook(
        (existingBookNodes) => [
          ...existingBookNodes.map((n) =>
            n["@id"] === targetNodeId ? { ...n, "@subpages": true } : n,
          ),
          newNode,
        ],
        { trackHistory: true },
      );
      setExpandedNodeIdsBook((prev) => {
        const next = new Set(prev);
        next.add(targetNodeId);
        return next;
      });
    } else {
      const parentId = targetNode.parentID ?? "-1";
      const depth = getContextNodeDepth(targetNodeId) - 1;
      const title = getNewNodeTitleForDepth(depth);
      const newNode: RemixerSubPage = {
        "@id": newNodeId,
        "@title": title,
        "@href": "#",
        "@subpages": false,
        article: "article",
        parentID: parentId,
        namespace: "main",
        title,
        "uri.ui": "#",
        addedItem: true,
      };
      updateCurrentBook(
        (existingBookNodes) => {
          const siblings = existingBookNodes.filter(
            (n) => (n.parentID ?? "-1") === parentId,
          );
          const targetIndex = siblings.findIndex(
            (n) => n["@id"] === targetNodeId,
          );
          const insertAfterIndex =
            mode === "above" ? targetIndex - 1 : targetIndex;
          const insertAfterId = siblings[insertAfterIndex]?.["@id"];

          const result: RemixerSubPage[] = [];
          for (const n of existingBookNodes) {
            result.push(n);
            if (insertAfterId && n["@id"] === insertAfterId) {
              result.push(newNode);
            }
          }
          if (!insertAfterId) {
            const firstSiblingIndex = result.findIndex(
              (n) => (n.parentID ?? "-1") === parentId,
            );
            if (firstSiblingIndex >= 0) {
              result.splice(firstSiblingIndex, 0, newNode);
            } else {
              result.push(newNode);
            }
          }
          return result;
        },
        { trackHistory: true },
      );
    }
    setUiState((prev) => ({ ...prev, selectedBookNodeId: newNodeId }));
  };

  /** Dispatch a context-menu action (add above/to/below, delete, modify, duplicate). */
  const handleContextMenuAction = (
    action: "add-above" | "add-to" | "add-below" | "delete" | "modify" | "duplicate",
  ) => {
    if (!contextMenu) return;
    const { nodeId } = contextMenu;
    setContextMenu(null);

    if (action === "modify") {
      setUiState((prev) => ({
        ...prev,
        selectedBookNodeId: nodeId,
        editPanelOpen: true,
      }));
    } else if (action === "delete") {
      if (isMatterBranchNode(nodeId)) return;
      updateCurrentBook(
        (existingBookNodes) =>
          applyBookNodeDeletion(existingBookNodes, nodeId),
        { trackHistory: true },
      );
      setUiState((prev) => ({ ...prev, selectedBookNodeId: undefined }));
    } else if (action === "add-above") {
      addNodeRelative(nodeId, "above");
    } else if (action === "add-below") {
      addNodeRelative(nodeId, "below");
    } else if (action === "add-to") {
      addNodeRelative(nodeId, "inside");
    } else if (action === "duplicate") {
      const book = remixerData.currentBook ?? [];
      const original = book.find((n) => n["@id"] === nodeId);
      if (!original) return;
      const newNodeId = `${nodeId}-dup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const resolvedSourceID = original.sourceID || original["@id"];
      const duplicate: RemixerSubPage = {
        ...original,
        "@id": newNodeId,
        ...(resolvedSourceID && !resolvedSourceID.startsWith("new-")
          ? { sourceID: resolvedSourceID }
          : {}),
        addedItem: true,
      };
      updateCurrentBook(
        (existingBookNodes) => {
          const result: RemixerSubPage[] = [];
          for (const n of existingBookNodes) {
            result.push(n);
            if (n["@id"] === nodeId) {
              result.push(duplicate);
            }
          }
          return result;
        },
        { trackHistory: true },
      );
      setUiState((prev) => ({ ...prev, selectedBookNodeId: newNodeId }));
    }
  };

  // ==========================================================================
  // Library → Book import
  // ==========================================================================

  /**
   * Import a library node into the current book.
   *
   * Behavior:
   * - Blocks imports from restricted shelves.
   * - For catalog-registered books, opens the pick-pages modal (unless `bypassPrompt`).
   * - Otherwise loads the subtree (or uses a preloaded one) and delegates to
   *   the pure reducer `computeLibraryImportInsertion`.
   */
  const importLibraryNodeToBook = async (
    {
      sourceTreeId,
      targetTreeId,
      node,
      targetNodeId,
      position,
      targetParentId,
    }: {
      sourceTreeId: "library" | "book";
      targetTreeId: "library" | "book";
      node: RemixerSubPage;
      targetNodeId: string;
      position: DropPosition;
      targetParentId: string;
    },
    options: {
      extractContent?: boolean;
      bypassPrompt?: boolean;
      subtreeNodes?: RemixerSubPage[];
      selectedSourceIds?: Set<string>;
    } = {},
  ) => {
    if (sourceTreeId !== "library" || targetTreeId !== "book") return;
    if (!remixerData.selectedLibrary) return;
    if (isRestrictedShelfNode(node["@id"])) {
      addNotification({
        message:
          "Import blocked: Bookshelves and Campus Bookshelves (and their immediate children) cannot be moved to Current Book.",
        type: "info",
        duration: 3500,
      });
      return;
    }

    if (!options.bypassPrompt && isBookLevelLibraryNode(node["@id"])) {
      setPendingBookImport({
        node,
        targetNodeId,
        position,
        targetParentId,
      });
      return;
    }

    setIsImportingFromLibrary(true);
    let subtreeNodes: RemixerSubPage[] = [];
    try {
      if (options.subtreeNodes && options.subtreeNodes.length > 0) {
        subtreeNodes = options.subtreeNodes;
      } else {
        subtreeNodes = await loadLibrarySubtree(
          id,
          node,
          remixerData.selectedLibrary,
        );
      }
    } catch (error) {
      setIsImportingFromLibrary(false);
      addNotification({
        message:
          error instanceof Error
            ? error.message
            : "Failed to load library content.",
        type: "error",
        duration: 3000,
      });
      return;
    }

    const originalRootId = node["@id"];

    if (options.extractContent && options.selectedSourceIds) {
      const descendantIds = new Set(
        subtreeNodes
          .filter((sn) => sn["@id"] !== originalRootId)
          .map((sn) => sn["@id"]),
      );
      let picked = 0;
      options.selectedSourceIds.forEach((sid) => {
        if (sid !== originalRootId && descendantIds.has(sid)) picked += 1;
      });
      if (picked === 0) {
        setIsImportingFromLibrary(false);
        addNotification({
          message: "Select at least one page to import.",
          type: "info",
          duration: 3000,
        });
        return;
      }
    }

    updateCurrentBook(
      (existingBookNodes) =>
        computeLibraryImportInsertion({
          existingBookNodes,
          subtreeNodes,
          originalRootId,
          targetNodeId,
          position,
          targetParentId,
          extractContent: options.extractContent === true,
          selectedSourceIds: options.selectedSourceIds,
        }),
      { trackHistory: true },
    );
    setIsImportingFromLibrary(false);
  };

  /** Import by id — looks the node up in the selected library and forwards to `importLibraryNodeToBook`. */
  const importLibraryNodeToBookById = async ({
    nodeId,
    targetTreeId,
    targetNodeId,
    position,
    targetParentId,
  }: {
    nodeId: string;
    targetTreeId: "library" | "book";
    targetNodeId: string;
    position: DropPosition;
    targetParentId: string;
  }) => {
    if (targetTreeId !== "book") return;
    const node = (selectedLibraryPages ?? []).find(
      (item) => item["@id"] === nodeId,
    );
    if (!node) return;
    if (isRestrictedShelfNode(nodeId)) {
      addNotification({
        message:
          "Import blocked: Bookshelves and Campus Bookshelves (and their immediate children) cannot be moved to Current Book.",
        type: "info",
        duration: 3500,
      });
      return;
    }
    await importLibraryNodeToBook({
      sourceTreeId: "library",
      targetTreeId,
      node,
      targetNodeId,
      position,
      targetParentId,
    });
  };

  /** Confirm the pending book-import modal: extract only the user-selected pages. */
  const resolvePendingBookImport = async () => {
    if (!pendingBookImport) return;
    const pending = pendingBookImport;
    const subtree = bookImportSubtree;
    const selected = bookImportSelectedIds;
    if (!subtree || subtree.length === 0) {
      addNotification({
        message: "Still loading pages; try again in a moment.",
        type: "info",
        duration: 3000,
      });
      return;
    }
    if (selected.size === 0) {
      addNotification({
        message: "Select at least one page to import.",
        type: "info",
        duration: 3000,
      });
      return;
    }

    setPendingBookImport(null);
    await importLibraryNodeToBook(
      {
        sourceTreeId: "library",
        targetTreeId: "book",
        node: pending.node,
        targetNodeId: pending.targetNodeId,
        position: pending.position,
        targetParentId: pending.targetParentId,
      },
      {
        extractContent: true,
        bypassPrompt: true,
        subtreeNodes: subtree,
        selectedSourceIds: selected,
      },
    );
  };

  // ==========================================================================
  // Persistence / recovery
  // ==========================================================================

  /** Load the book from a recovery source: local draft, server, server draft, or a fresh reload. */
  const handleLoadSource = async (
    source: "local" | "server" | "serverDraft" | "fresh",
  ) => {
    setShowRecoveryModal(false);
    setLoadingRecovery(true);
    try {
      if (source === "local") {
        const draft = getLocalDraft(id);
        if (!draft) return;
        applyDraftSettings(draft);
        setRemixerData((prev) => ({
          ...prev,
          currentBook: normalizeBookState(draft.currentBook),
        }));
      } else if (source === "serverDraft") {
        if (serverStateRef.current) {
          applyDraftSettings(serverStateRef.current.settings);
          setRemixerData((prev) => ({
            ...prev,
            currentBook: normalizeBookState(serverStateRef.current!.book),
          }));
        } else {
          try {
            const savedState = await api.getRemixerProjectState(id);
            const savedBook = (savedState.currentBook ??
              []) as RemixerSubPage[];
            if (Array.isArray(savedBook) && savedBook.length > 0) {
              applyDraftSettings(savedState);
              serverStateRef.current = {
                book: savedBook,
                settings: savedState,
              };
              setRemixerData((prev) => ({
                ...prev,
                currentBook: normalizeBookState(savedBook),
              }));
            }
          } catch {
            addNotification({
              message: "Failed to load server draft.",
              type: "error",
              duration: 3000,
            });
          }
        }
      } else if (source === "server") {
        if (serverStateRef.current) {
          applyDraftSettings(serverStateRef.current.settings);
          setRemixerData((prev) => ({
            ...prev,
            currentBook: normalizeBookState(serverStateRef.current!.book),
          }));
        } else {
          try {
            const savedState = await api.getRemixerProjectState(id);
            const savedBook = (savedState.currentBook ??
              []) as RemixerSubPage[];
            if (Array.isArray(savedBook) && savedBook.length > 0) {
              applyDraftSettings(savedState);
              serverStateRef.current = {
                book: savedBook,
                settings: savedState,
              };
              setRemixerData((prev) => ({
                ...prev,
                currentBook: normalizeBookState(savedBook),
              }));
            }
          } catch {
            addNotification({
              message: "Failed to load server draft.",
              type: "error",
              duration: 3000,
            });
          }
        }
      } else {
        clearLocalDraft(id);
        const fullBook = await loadEntireBook(
          id,
          remixerData.liberCoverID!,
          remixerData.libreLibrary!,
        );
        setRemixerData((prev) => ({
          ...prev,
          currentBook: normalizeBookState(fullBook, {
            initializeOriginalPathNumber: true,
          }),
        }));
      }
      setUndoStack([]);
      setRedoStack([]);
    } finally {
      setLoadingRecovery(false);
    }
  };

  /** Gather the set of available recovery sources (local/server) and open the recovery modal. */
  const openRecoveryModal = async () => {
    const localDraft = getLocalDraft(id);

    if (!serverStateRef.current) {
      try {
        const savedState = await api.getRemixerProjectState(id);
        const savedBook = (savedState.currentBook ?? []) as RemixerSubPage[];
        if (Array.isArray(savedBook) && savedBook.length > 0) {
          serverStateRef.current = {
            book: savedBook,
            settings: {
              autoNumbering: savedState.autoNumbering,
              copyModeState: savedState.copyModeState,
              pathLevelFormats: savedState.pathLevelFormats,
            },
          };
        }
      } catch {
        // Server unreachable — leave serverStateRef as null
      }
    }

    setAvailableSources({
      hasLocal: !!localDraft,
      hasServer: !!serverStateRef.current,
      hasServerDraft: !!serverStateRef.current,
      localTimestamp: localDraft?.savedAt,
    });
    setShowRecoveryModal(true);
  };

  /** Persist the current book + settings to the server and clear any local draft. */
  const handleSaveDraft = async () => {
    if (!id) return;
    try {
      const response = await api.saveRemixerProjectState(
        id,
        remixerData.currentBook ?? [],
        {
          autoNumbering: remixerData.autoNumbering,
          copyModeState: uiState.copyModeState,
          pathLevelFormats: uiState.pathLevelFormats,
        },
      );
      if (response.err) {
        throw new Error(response.errMsg ?? "Failed to save draft");
      }
      clearLocalDraft(id);
      serverStateRef.current = {
        book: remixerData.currentBook ?? [],
        settings: {
          autoNumbering: remixerData.autoNumbering,
          copyModeState: uiState.copyModeState,
          pathLevelFormats: uiState.pathLevelFormats,
        },
      };
      addNotification({
        message: "Draft saved successfully.",
        type: "success",
        duration: 3000,
      });
    } catch (error) {
      addNotification({
        message:
          error instanceof Error ? error.message : "Failed to save draft",
        type: "error",
        duration: 3000,
      });
    }
  };

  /** Discard local/server drafts and reload the book from source. Resets undo/redo and UI panels. */
  const handleStartOver = async () => {
    if (!id) return;
    clearLocalDraft(id);
    serverStateRef.current = null;
    await api.deleteRemixerProjectState(id);
    const res = await api.getRemixerProject(id);
    const fullBook = await loadEntireBook(
      id,
      res.project.libreCoverID,
      res.project.libreLibrary,
    );
    setUndoStack([]);
    setRedoStack([]);
    setUiState((prev) => ({
      ...prev,
      selectedBookNodeId: undefined,
      editPanelOpen: false,
      publishPanelOpen: false,
    }));
    setRemixerData((prev) => ({
      ...prev,
      projectID: res.project.projectID,
      title: res.project.title,
      liberCoverID: res.project.libreCoverID,
      libreLibrary: res.project.libreLibrary,
      selectedLibrary: isLibrary(res.project.libreLibrary)
        ? res.project.libreLibrary
        : undefined,
      currentBook: normalizeBookState(fullBook, {
        initializeOriginalPathNumber: true,
      }),
    }));
  };

  // ==========================================================================
  // Publish
  // ==========================================================================

  /** Kick off a publish job on the server and start polling for status. */
  const handlePublish = async () => {
    if (!id) return;
    try {
      setPublishStatus("pending");
      setPublishMessages(["Publish request accepted. Creating backend job..."]);
      const response = await api.publishRemixerProject(
        id,
        remixerData.currentBook ?? [],
        {
          autoNumbering: remixerData.autoNumbering,
          copyModeState: uiState.copyModeState,
          pathLevelFormats: uiState.pathLevelFormats,
        },
      );
      if (response.err) {
        throw new Error(response.errMsg ?? "Failed to publish");
      }
      setPublishPolling(true);
    } catch (error) {
      setPublishStatus("error");
      addNotification({
        message: error instanceof Error ? error.message : "Failed to publish",
        type: "error",
        duration: 3000,
      });
    }
  };

  // ==========================================================================
  // Effects
  // ==========================================================================

  // Load pages for the pending book-import modal whenever a new pending import appears.
  useEffect(() => {
    if (!pendingBookImport) {
      setBookImportSubtree(null);
      setBookImportSubtreeLoading(false);
      setBookImportSelectedIds(new Set());
      setBookImportExpandedIds(new Set());
      return;
    }
    if (!id || !remixerData.selectedLibrary) return;

    const projectId = id;
    const libKey = remixerData.selectedLibrary;
    let cancelled = false;
    const rootNode = pendingBookImport.node;
    const rootId = rootNode["@id"];

    (async () => {
      setBookImportSubtreeLoading(true);
      setBookImportSubtree(null);
      setBookImportSelectedIds(new Set());
      try {
        const subtree = await loadLibrarySubtree(
          projectId,
          rootNode,
          libKey,
        );
        if (cancelled) return;
        setBookImportSubtree(subtree);
        const defaultSelectable = subtree
          .filter(
            (n) =>
              n["@id"] !== rootId &&
              !isMatterBranchNodePure(n["@id"], subtree),
          )
          .map((n) => n["@id"]);
        setBookImportSelectedIds(new Set(defaultSelectable));
        const expanded = new Set<string>();
        subtree.forEach((n) => {
          if (n["@subpages"] && n["@id"] !== rootId) expanded.add(n["@id"]);
        });
        setBookImportExpandedIds(expanded);
      } catch (error) {
        if (!cancelled) {
          addNotification({
            message:
              error instanceof Error
                ? error.message
                : "Failed to load book pages.",
            type: "error",
            duration: 4000,
          });
          setPendingBookImport(null);
        }
      } finally {
        if (!cancelled) setBookImportSubtreeLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    pendingBookImport?.node["@id"],
    pendingBookImport?.targetNodeId,
    id,
    remixerData.selectedLibrary,
    loadLibrarySubtree,
    addNotification,
  ]);

  // Initial load: project metadata, catalog, and existing book state (with recovery prompt).
  useEffect(() => {
    const getRemixerProject = async () => {
      // get the authen browser details

      setRemixerData((prev) => ({
        ...prev,
        libraries: libraries,
      }));
      // get the project details
      const res = await api.getRemixerProject(id);
      setRemixerData((prev) => ({
        ...prev,
        projectID: res.project.projectID,
        title: res.project.title,
        liberCoverID: res.project.libreCoverID,
        libreLibrary: res.project.libreLibrary,
        selectedLibrary: isLibrary(res.project.libreLibrary)
          ? res.project.libreLibrary
          : undefined,
      }));

      // Resume polling if a job is already in progress
      try {
        const jobStatusRes = await api.getRemixerPublishJobStatus(id);
        const existingJob = jobStatusRes.job;
        if (
          existingJob &&
          (existingJob.status === "pending" || existingJob.status === "running")
        ) {
          setPublishStatus(existingJob.status);
          setPublishMessages(existingJob.messages ?? []);
          setPublishPolling(true);
          setUiState((prev) => ({ ...prev, publishPanelOpen: true }));
        }
      } catch {
        // Non-critical; ignore errors checking job status on load
      }

      const localDraft = getLocalDraft(id);

      let serverBook: RemixerSubPage[] | null = null;
      let serverSettings: {
        autoNumbering?: boolean;
        copyModeState?: string;
        pathLevelFormats?: unknown;
      } | null = null;

      try {
        const savedState = await api.getRemixerProjectState(id);
        const savedBook = (savedState.currentBook ?? []) as RemixerSubPage[];
        if (Array.isArray(savedBook) && savedBook.length > 0) {
          serverBook = savedBook;
          serverSettings = {
            autoNumbering: savedState.autoNumbering,
            copyModeState: savedState.copyModeState,
            pathLevelFormats: savedState.pathLevelFormats,
          };
          serverStateRef.current = {
            book: savedBook,
            settings: serverSettings,
          };
        }
      } catch (error) {
        console.error("Failed to load remixer saved state", error);
      }

      setAvailableSources({
        hasLocal: !!localDraft,
        hasServer: !!serverBook,
        hasServerDraft: !!serverBook,
        localTimestamp: localDraft?.savedAt,
      });

      if (localDraft && serverBook) {
        setShowRecoveryModal(true);
        return;
      }

      if (localDraft) {
        applyDraftSettings(localDraft);
        setRemixerData((prev) => ({
          ...prev,
          currentBook: normalizeBookState(localDraft.currentBook),
        }));
        return;
      }

      if (serverBook && serverSettings) {
        applyDraftSettings(serverSettings);
        setRemixerData((prev) => ({
          ...prev,
          currentBook: normalizeBookState(serverBook!),
        }));
        return;
      }

      const fullBook = await loadEntireBook(
        id,
        res.project.libreCoverID,
        res.project.libreLibrary,
      );
      setRemixerData((prev) => ({
        ...prev,
        currentBook: normalizeBookState(fullBook, {
          initializeOriginalPathNumber: true,
        }),
      }));
    };
    const loadCatalogBook = async () => {
      const [res, masterCatRes] = await Promise.all([
        api.getCommonsCatalog({ limit: 10000 }),
        api.getMasterCatalogV2(),
      ]);

      const masterBooks = flattenCatalogResponse(masterCatRes.data);
      const commonsBooks = res.data.books ?? [];
      const seen = new Set(commonsBooks.map((b) => b.bookID));
      const merged = [
        ...commonsBooks,
        ...masterBooks.filter((b) => !seen.has(b.bookID)),
      ];

      setRemixerData((prev) => ({
        ...prev,
        catalogBook: merged,
      }));
    };

    getRemixerProject();
    loadCatalogBook();
  }, [id]);

  // Auto-load the library tree when the selected library changes (skipped when catalog-driven).
  useEffect(() => {
    const loadSelectedLibrary = async () => {
      if (!id || !remixerData.selectedLibrary || skipLibraryAutoLoadRef.current)
        return;
      setLibraryLoading(true);

      // get the selected library details
      const resLibraryDetails = await api.getRemixerPage(
        id,
        "0",
        remixerData.selectedLibrary,
        true,
        true,
        { includeMatter: false, linkTitle: true, full: false },
      );

      // get selected library root children
      const resLibrary = await api.getRemixerPage(
        id,
        resLibraryDetails.response["@id"],
        remixerData.selectedLibrary,
        false,
        true,
        { includeMatter: false, linkTitle: true, full: false },
      );

      setRemixerData((prev) => ({
        ...prev,
        library: {
          ...(prev.library ?? {}),
          [remixerData.selectedLibrary as Library]: [
            resLibraryDetails.response,
            ...(resLibrary.response ?? []),
          ],
        },
      }));
      setLibraryLoading(false);
    };

    loadSelectedLibrary();
  }, [id, remixerData.selectedLibrary]);

  // Clear the selected-book-node id when the node no longer exists (e.g. after delete/undo).
  useEffect(() => {
    if (!uiState.selectedBookNodeId) return;
    const stillExists = (remixerData.currentBook ?? []).some(
      (node) => node["@id"] === uiState.selectedBookNodeId,
    );
    if (!stillExists) {
      setUiState((prev) => ({ ...prev, selectedBookNodeId: undefined }));
    }
  }, [remixerData.currentBook, uiState.selectedBookNodeId]);

  // Re-normalize path numbering whenever the user changes path-level formats.
  useEffect(() => {
    updateCurrentBook((existingBook) => existingBook);
  }, [uiState.pathLevelFormats]);

  // Debounced local-draft autosave to survive tab reloads.
  useEffect(() => {
    if (!id || !remixerData.currentBook || remixerData.currentBook.length === 0)
      return;
    const timer = setTimeout(() => {
      setLocalDraft(id, {
        currentBook: remixerData.currentBook!,
        autoNumbering: remixerData.autoNumbering,
        copyModeState: uiState.copyModeState,
        pathLevelFormats: uiState.pathLevelFormats,
        savedAt: Date.now(),
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [
    id,
    remixerData.currentBook,
    remixerData.autoNumbering,
    uiState.copyModeState,
    uiState.pathLevelFormats,
  ]);

  // Poll the publish job status; refreshes the page on success, surfaces errors.
  useEffect(() => {
    if (!id || !publishPolling) return;

    let isCancelled = false;
    const pollOnce = async () => {
      try {
        const statusResponse = await api.getRemixerPublishJobStatus(id);
        if (isCancelled) return;

        const job = statusResponse.job;
        if (!job) {
          setPublishStatus("pending");
          return;
        }

        setPublishStatus(job.status);
        setPublishMessages(job.messages ?? []);

        if (job.status === "success") {
          setPublishPolling(false);
          addNotification({
            message: "Publish completed successfully.",
            type: "success",
            duration: 4000,
          });
          setTimeout(() => window.location.reload(), 4000);
        } else if (job.status === "error") {
          setPublishPolling(false);
          addNotification({
            message: job.errorMessage || "Publish failed.",
            type: "error",
            duration: 5000,
          });
        }
      } catch (error) {
        if (isCancelled) return;
        setPublishPolling(false);
        setPublishStatus("error");
        addNotification({
          message:
            error instanceof Error
              ? error.message
              : "Failed to get publish status.",
          type: "error",
          duration: 5000,
        });
      }
    };

    pollOnce();
    const intervalId = window.setInterval(pollOnce, 2000);
    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [id, publishPolling, addNotification]);

  // F2 opens the edit panel for the currently selected book node.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2" && uiState.selectedBookNodeId) {
        e.preventDefault();
        setUiState((prev) => ({ ...prev, editPanelOpen: true }));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [uiState.selectedBookNodeId]);

  // Dismiss the context menu on the next click or contextmenu event outside of it.
  useEffect(() => {
    if (!contextMenu) return;
    const dismiss = () => setContextMenu(null);
    const frameId = requestAnimationFrame(() => {
      window.addEventListener("click", dismiss);
      window.addEventListener("contextmenu", dismiss);
    });
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("click", dismiss);
      window.removeEventListener("contextmenu", dismiss);
    };
  }, [contextMenu]);

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <Grid
      className="component-container"
      style={{
        justifyContent: "center",
        paddingTop: 72,
        width: "100%",
        marginLeft: 0,
        marginRight: 0,
      }}
    >
      <ControlPanel
        onStartOver={handleStartOver}
        onLoadVersion={openRecoveryModal}
        onPublish={() =>
          setUiState((prev) => ({ ...prev, publishPanelOpen: true }))
        }
        onPathNameFormat={() =>
          setUiState((prev) => ({ ...prev, pathNameFormatOpen: true }))
        }
        onSave={handleSaveDraft}
        copyModeState={uiState.copyModeState as CopyMode | undefined}
        onCopyModeChange={(value) =>
          setUiState((prev) => ({ ...prev, copyModeState: value }))
        }
        isAdmin={isAdmin}
          autoNumbering={remixerData.autoNumbering ?? false}
      />

      <Grid.Row>
        <Grid.Column width={8} style={{ padding: "25px" , paddingRight : isBookToolbarNarrow ? "0px" : "25px", paddingLeft : isBookToolbarNarrow ? "0px" : "25px" }}>
          <Container fluid>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5em" }}>
              <label style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>Library</label>

              {isBookToolbarNarrow ? (
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", paddingTop : isBookToolbarNarrow ? "1.5em" : "0px" }}>
                  <Dropdown
                    direction="left"
                    icon={null}
                    trigger={
                      <Button
                        icon
                        compact
                        aria-label="Library actions"
                        style={buttonStyle}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                      >
                        <Icon name="ellipsis vertical" />
                      </Button>
                    }
                  >
                    <Dropdown.Menu>
                      {(remixerData.libraries ?? []).map((library) => {
                        const isSelected = remixerData.selectedLibrary === library;
                        return (
                          <Dropdown.Item
                            key={library}
                            text={
                              isLibrary(library) ? libraryTitles[library] : library
                            }
                            icon={isSelected ? "check" : undefined}
                            onClick={() =>
                              setRemixerData((prev) => ({
                                ...prev,
                                selectedLibrary: isLibrary(library)
                                  ? library
                                  : undefined,
                              }))
                            }
                          />
                        );
                      })}
                      <Dropdown.Divider />
                      <Dropdown.Item
                        icon="search"
                        text="Search Catalog Book"
                        onClick={() =>
                          setUiState((prev) => ({ ...prev, catalogListOpen: true }))
                        }
                      />
                    </Dropdown.Menu>
                  </Dropdown>
                </div>
              ) : (
                <>
                  <Dropdown
                    options={remixerData.libraries?.map((library) => ({
                      key: library,
                      text: isLibrary(library)
                        ? libraryTitles[library]
                        : library,
                      value: library,
                    }))}
                    value={remixerData.selectedLibrary}
                    onChange={(e, { value }) => {
                      const nextLibrary =
                        typeof value === "string" && isLibrary(value)
                          ? value
                          : undefined;
                      setRemixerData((prev) => ({
                        ...prev,
                        selectedLibrary: nextLibrary,
                      }));
                    }}
                    fluid
                    selection
                    placeholder="Library..."
                    style={{ flex: 1 }}
                  />

                  <Popup
                    content="Search Catalog Book"
                    position="bottom center"
                    trigger={
                      <Button
                        icon
                        onClick={() =>
                          setUiState((prev) => ({ ...prev, catalogListOpen: true }))
                        }
                        style={buttonStyle}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                      >
                        <Icon name="search" />
                      </Button>
                    }
                  />
                </>
              )}
            </div>

            {!libraryLoading &&
            selectedLibraryPages &&
            remixerData.selectedLibrary ? (
              <TreeDnd
                expandedNodeIds={expandedNodeIdsLibrary}
                setExpandedNodeIds={setExpandedNodeIdsLibrary}
                currentBook={selectedLibraryPages}
                autoNumbering={remixerData.autoNumbering ?? true}
                pathLevelFormats={uiState.pathLevelFormats ?? []}
                onExpand={expandLibraryTree}
                treeId="library"
              />
            ) : (
              <TreeSkeleton />
            )}
          </Container>
        </Grid.Column>
        <Grid.Column
          width={8}
          style={{ padding: "25px", display: "flex", alignItems: "flex-end" , paddingLeft : isBookToolbarNarrow ? "0px" : "25px" }}
     
        >
          <Container fluid style={{ width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5em" }}>
              <label style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>Text</label>
              <div
                style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.2em"  , paddingTop : isBookToolbarNarrow ? "1.5em" : "0px" }}
              >
                {isBookToolbarNarrow ? (
                  <Dropdown
                    direction="left"
                    icon={null}
                    trigger={
                      <Button
                        icon
                        compact
                        aria-label="Current book actions"
                        style={buttonStyle}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                      >
                        <Icon name="ellipsis vertical" />
                      </Button>
                    }
                  >
                    <Dropdown.Menu>
                      <Dropdown.Item
                        icon="add"
                        text="Add"
                        onClick={() => handleAddBookItem()}
                        style={{ color: STATUS_PALETTE.success }}
                      />
                      <Dropdown.Item
                        icon="trash"
                        text="Delete"
                        onClick={() => handleDeleteSelectedBookNode()}
                        style={{ color: STATUS_PALETTE.error }}
                      />
                      <Dropdown.Divider />
                      <Dropdown.Item
                        icon="undo"
                        text="Undo"
                        disabled={undoStack.length === 0}
                        onClick={() => handleUndo()}
                      />
                      <Dropdown.Item
                        icon="redo"
                        text="Redo"
                        disabled={redoStack.length === 0}
                        onClick={() => handleRedo()}
                      />
                      <Dropdown.Divider />
                      <Dropdown.Item
                        icon={
                          isExpandedAllCurrentBookNodes() ? "chevron up" : "chevron down"
                        }
                        text={
                          isExpandedAllCurrentBookNodes()
                            ? "Collapse all (Current Book)"
                            : "Expand all (Current Book)"
                        }
                        onClick={() =>
                          void (isExpandedAllCurrentBookNodes()
                            ? collapseAllCurrentBook()
                            : expandAllCurrentBook())
                        }
                      />
                    </Dropdown.Menu>
                  </Dropdown>
                ) : (
                  <>
                    <Popup
                      content="Add"
                      position="bottom center"
                      trigger={
                        <Button
                          icon
                          onClick={handleAddBookItem}
                          style={{
                            backgroundColor: STATUS_PALETTE.successBg,
                            color: STATUS_PALETTE.success,
                          }}
                          onMouseEnter={(event: React.MouseEvent<HTMLButtonElement>) => {
                            event.currentTarget.style.backgroundColor =
                              STATUS_PALETTE.success;
                            event.currentTarget.style.color = "#ffffff";
                          }}
                          onMouseLeave={(event: React.MouseEvent<HTMLButtonElement>) => {
                            event.currentTarget.style.backgroundColor =
                              STATUS_PALETTE.successBg;
                            event.currentTarget.style.color = STATUS_PALETTE.success;
                          }}
                        >
                          <Icon name="add" />
                        </Button>
                      }
                    />
                    <Popup
                      content="Delete"
                      position="bottom center"
                      trigger={
                        <Button
                          icon
                          onClick={handleDeleteSelectedBookNode}
                          style={{
                            backgroundColor: STATUS_PALETTE.errorBg,
                            color: STATUS_PALETTE.error,
                          }}
                          onMouseEnter={(event: React.MouseEvent<HTMLButtonElement>) => {
                            event.currentTarget.style.backgroundColor =
                              STATUS_PALETTE.error;
                            event.currentTarget.style.color = "#ffffff";
                          }}
                          onMouseLeave={(event: React.MouseEvent<HTMLButtonElement>) => {
                            event.currentTarget.style.backgroundColor =
                              STATUS_PALETTE.errorBg;
                            event.currentTarget.style.color = STATUS_PALETTE.error;
                          }}
                        >
                          <Icon name="trash alternate" />
                        </Button>
                      }
                    />
                    <Popup
                      content="Undo"
                      position="bottom center"
                      trigger={
                        <Button
                          icon
                          onClick={handleUndo}
                          disabled={undoStack.length === 0}
                          style={buttonStyle}
                          onMouseEnter={handleMouseEnter}
                          onMouseLeave={handleMouseLeave}
                        >
                          <Icon name="undo" />
                        </Button>
                      }
                    />
                    <Popup
                      content="Redo"
                      position="bottom center"
                      trigger={
                        <Button
                          icon
                          onClick={handleRedo}
                          disabled={undoStack.length === 0}
                          style={buttonStyle}
                          onMouseEnter={handleMouseEnter}
                          onMouseLeave={handleMouseLeave}
                        >
                          <Icon name="redo" />
                        </Button>
                      }
                    />
                    <Popup
                      content={
                        isExpandedAllCurrentBookNodes()
                          ? "Collapse all (Current Book)"
                          : "Expand all (Current Book)"
                      }
                      position="bottom center"
                      trigger={
                        <Button
                          icon
                          onClick={
                            isExpandedAllCurrentBookNodes()
                              ? collapseAllCurrentBook
                              : expandAllCurrentBook
                          }
                          style={buttonStyle}
                          onMouseEnter={handleMouseEnter}
                          onMouseLeave={handleMouseLeave}
                        >
                          <Icon
                            name={
                              isExpandedAllCurrentBookNodes()
                                ? "chevron up"
                                : "chevron down"
                            }
                          />
                        </Button>
                      }
                    />
                  </>
                )}
              </div>
            </div>
            {remixerData.currentBook ? (
              <div style={{ position: "relative" }}>
                <TreeDnd
                  expandedNodeIds={expandedNodeIdsBook}
                  setExpandedNodeIds={setExpandedNodeIdsBook}
                  currentBook={remixerData.currentBook}
                  autoNumbering={remixerData.autoNumbering ?? true}
                  pathLevelFormats={uiState.pathLevelFormats ?? []}
                  onExpand={expandBookTree}
                  treeId="book"
                  onImportNode={importLibraryNodeToBook}
                  onImportNodeById={importLibraryNodeToBookById}
                  onReorderNode={handleReorderBookNode}
                  onMarkMovedNodes={handleMarkMovedNodes}
                  selectedNodeId={uiState.selectedBookNodeId}
                  onSelectNode={(nodeId) =>
                    setUiState((prev) => ({
                      ...prev,
                      selectedBookNodeId: nodeId,
                    }))
                  }
                  onNodeDoubleClick={(nodeId) =>
                    setUiState((prev) => ({
                      ...prev,
                      selectedBookNodeId: nodeId,
                      editPanelOpen: true,
                    }))
                  }
                  onNodeContextMenu={(nodeId, event) => {
                    setUiState((prev) => ({
                      ...prev,
                      selectedBookNodeId: nodeId,
                    }));
                    setContextMenu({
                      nodeId,
                      x: event.clientX,
                      y: event.clientY,
                    });
                  }}
                />
                <Dimmer active={isImportingFromLibrary} inverted>
                  <Loader size="medium">Importing from library…</Loader>
                </Dimmer>
              </div>
            ) : (
              <TreeSkeleton  />
            )}
          </Container>
        </Grid.Column>
      </Grid.Row>
      <PublishPanel
        open={uiState.publishPanelOpen}
        dimmer="blurring"
        handleClose={() =>
          setUiState((prev) => ({ ...prev, publishPanelOpen: false }))
        }
        handlePublish={handlePublish}
        currentBook={remixerData.currentBook}
        publishInProgress={publishPolling}
        publishStatus={publishStatus}
        publishMessages={publishMessages}
      />
      <EditPanel
        open={uiState.editPanelOpen}
        dimmer="blurring"
        onClose={() =>
          setUiState((prev) => ({ ...prev, editPanelOpen: false }))
        }
        formattedPathDefault={selectedBookDefaultFormattedPath()}
        currentPage={selectedBookNode}
        handleSave={handleSaveEdit}
      />
      <PathNameFormat
        open={uiState.pathNameFormatOpen}
        dimmer="blurring"
        onClose={() =>
          setUiState((prev) => ({ ...prev, pathNameFormatOpen: false }))
        }
        depth={highestPathLevel()}
        pathLevelFormats={uiState.pathLevelFormats ?? []}
        setPathLevelFormats={(pathLevelFormats) =>
          setUiState((prev) => ({ ...prev, pathLevelFormats }))
        }
        autoNumbering={remixerData.autoNumbering ?? true}
        onAutoNumberingChange={(checked) => {
          setRemixerData((prev) => ({
            ...prev,
            autoNumbering: checked,
          }));
        }}
      />
      <CatalogList
        open={uiState.catalogListOpen}
        onClose={() =>
          setUiState((prev) => ({ ...prev, catalogListOpen: false }))
        }
        dimmer="blurring"
        catalogBook={remixerData.catalogBook}
        loadSelectedBook={loadSelectedBook}
        loading={skipLibraryAutoLoadRef.current}
      />
      <RecoveryModal
        open={showRecoveryModal}
        loading={loadingRecovery}
        availableSources={availableSources}
        onLoadSource={handleLoadSource}
        onClose={() => setShowRecoveryModal(false)}
      />
      <BookImportModal
        open={pendingBookImport !== null}
        bookTitle={
          pendingBookImport?.node?.["@title"] ||
          pendingBookImport?.node?.title ||
          "this book"
        }
        rootId={pendingBookImport?.node?.["@id"] ?? null}
        subtree={bookImportSubtree}
        subtreeLoading={bookImportSubtreeLoading}
        selectedIds={bookImportSelectedIds}
        setSelectedIds={setBookImportSelectedIds}
        expandedIds={bookImportExpandedIds}
        setExpandedIds={setBookImportExpandedIds}
        isImporting={isImportingFromLibrary}
        onCancel={() => setPendingBookImport(null)}
        onConfirm={() => void resolvePendingBookImport()}
      />
      <ContextMenu
        contextMenu={contextMenu}
        canAddSibling={contextMenuCanAddSibling}
        canDuplicate={contextMenuCanDuplicate}
        addAboveLabel={`Add ${contextMenuSiblingTypeLabel} Above`}
        addToLabel={`Add ${contextMenuChildTypeLabel} To`}
        addBelowLabel={`Add ${contextMenuSiblingTypeLabel} Below`}
        onAction={handleContextMenuAction}
      />
    </Grid>
  );
};

export default RemixerDashboard;
