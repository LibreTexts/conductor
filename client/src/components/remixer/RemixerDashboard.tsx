import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { useMediaQuery } from "react-responsive";

import api from "../../api";
import { useNotifications } from "../../context/NotificationContext";
import { useTypedSelector } from "../../state/hooks";
import { flattenCatalogResponse } from "../../utils/booksManagerHelpers";

import BookImportModal from "./BookImportModal";
import ContextMenu from "./BookContent/ContextMenu";
import TreeDnd from "./BookContent/Dashboard";
import TreeSkeleton from "./BookContent/TreeSkeleton";
import CatalogList from "./CatalogBook/CatalogList";
import EditPanel from "./EditPanel";
import PathNameFormat from "./PathNameFormat";
import PublishPanel from "./PublishPanel";
import RecoveryModal from "./RecoveryModal";
import {
  Library,
  PathLevelFormat,
  PublishJobStatus,
  RemixerData,
  RemixerSubPage,
  RemixerUiState,
  copyModeStates,
  libraries,
  remixerDataInit,
  remixerUiStateInit,
} from "./model";
import {
  DropPosition,
  applyBookNodeDeletion,
  applyBookNodeRestore,
  applyDefaultBookArticleTypes,
  applySiblingDuplicateTitleSuffixes,
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
  isRemixerBookRoot,
  isRestrictedLibraryShelfNode,
  isBackMatterNode,
  isDefaultMatterPage,
  isFrontMatterNode,
  isMatterRootNode,
  isRootBookNode,
  sortMatterSiblings,
  reorderBookNodes,
  sanitizePathLevelFormats,
  setLocalDraft,
  hasFormattedPathChanged,
  splitFormattedPathParts,
  splitStoredFormattedPath,
  syncRenamedItemFromAutonumberTitle,
  toEditableRemixerTitle,
  withDerivedStatusFlags,
} from "./services";
import {
  Breadcrumb,
  Card,
  Heading,
  Stack,
  Text,
  Grid,
} from "@libretexts/davis-react";
import useProject from "../../hooks/useProject";
import { useModals } from "../../context/ModalContext";
import ConfirmModal from "../ConfirmModal";
import ControlPanelNewUITemp from "./ControlPanel";
import { useDocumentTitle } from "usehooks-ts";
import BookActions from "./BookActions";
import LibraryActions from "./LibraryActions";
import CreateMatterModal from "./CreateMatterModal";
import { Icon } from "semantic-ui-react";

/** Stable empty fallback so `pathLevelFormats ?? EMPTY_PATH_LEVEL_FORMATS`
 * doesn't hand a fresh `[]` to the memoized <TreeDnd> on every render. */
const EMPTY_PATH_LEVEL_FORMATS: PathLevelFormat[] = [];

/**
 * Pages the server dropped from the saved book because they no longer exist in
 * the live library book, plus any kept pages it had to reparent as a result.
 */
type UntrackedNotice = {
  untracked: RemixerSubPage[];
  reparented: RemixerSubPage[];
};

/**
 * The server recomputes this on every load and cannot clear it, so the same
 * removal would be announced on every visit until the user next saves (which is
 * what actually persists the pruned book). Remember what we have already
 * reported for this project so it is announced once per session, and again only
 * if the set of missing pages actually changes.
 */
const shouldAnnounceUntracked = (
  projectID: string,
  notice: UntrackedNotice,
): boolean => {
  const signature = notice.untracked
    .map((page) => page["@id"])
    .sort()
    .join(",");
  if (!signature) return false;
  const key = `remixer_untracked_notice_${projectID}`;
  try {
    if (sessionStorage.getItem(key) === signature) return false;
    sessionStorage.setItem(key, signature);
  } catch {
    // Private-mode / storage-disabled: announcing twice beats staying silent.
  }
  return true;
};

const RemixerDashboard: React.FC = () => {
  // ==========================================================================
  // State
  // ==========================================================================
  const user = useTypedSelector((state) => state.user);
  const isSupportOrSuperAdmin = user?.isSupport || user?.isSuperAdmin;
  const { addNotification } = useNotifications();
  const { openModal, closeAllModals } = useModals();
  const { id } = useParams<{ id: string }>();

  /** Below `lg` (~1024px): book toolbar actions collapse into a dropdown (Tailwind `md` + `sm` + `xs`). */
  const isNarrowScreen = useMediaQuery({ maxWidth: 1023 });
  /** The header area is busier, so we break earlier on mid-sized screens (~1280px). */
  const isMidSizedScreen = useMediaQuery({ maxWidth: 1279 });

  const [remixerData, setRemixerData] = useState<RemixerData>(remixerDataInit);
  const [uiState, setUiState] = useState<RemixerUiState>(remixerUiStateInit);

  const [expandedNodeIdsBook, setExpandedNodeIdsBook] = useState<Set<string>>(
    new Set(),
  );
  const [expandedNodeIdsLibrary, setExpandedNodeIdsLibrary] = useState<
    Set<string>
  >(new Set());
  /** Catalog-opened library node; stays highlighted until another catalog book is loaded. */
  const [highlightedLibraryNodeId, setHighlightedLibraryNodeId] = useState<
    string | undefined
  >();

  const [undoStack, setUndoStack] = useState<RemixerSubPage[][]>([]);
  const [redoStack, setRedoStack] = useState<RemixerSubPage[][]>([]);

  const [publishStatus, setPublishStatus] = useState<PublishJobStatus>("idle");
  const [publishMessages, setPublishMessages] = useState<string[]>([]);
  const [publishPolling, setPublishPolling] = useState<boolean>(false);
  const [publishPanelOpen, setPublishPanelOpen] = useState<boolean>(false);

  const [loadingRecovery, setLoadingRecovery] = useState(false);

  const { project, isLoading: isLoadingProject } = useProject(id ?? "");
  useDocumentTitle(`Remixer | ${project?.title ?? ""} | LibreTexts Conductor`);

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
      updatedAt?: string | Date;
      updatedBy?: string;
      publishedAt?: Date | string;
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

  /**
   * True for the front/back matter root nodes themselves and any of their
   * descendants that were NOT explicitly added by the user (i.e. default/
   * original items).  Added items inside matter sections are NOT default.
   */
  const isDefaultMatterItem = (nodeId?: string): boolean => {
    if (!nodeId) return false;
    const book = remixerData.currentBook ?? [];
    const node = book.find((n) => n["@id"] === nodeId);
    if (!node) return false;
    return isDefaultMatterPage(node);
  };

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

  const contextMenuTargetNode =
    contextMenu != null
      ? (remixerData.currentBook ?? []).find(
          (n) => n["@id"] === contextMenu.nodeId,
        )
      : undefined;
  const contextMenuParentNode = contextMenuTargetNode?.parentID
    ? (remixerData.currentBook ?? []).find(
        (n) => n["@id"] === contextMenuTargetNode.parentID,
      )
    : undefined;
  const contextMenuUnderMatterRoot =
    contextMenuParentNode != null && isMatterRootNode(contextMenuParentNode);

  // Sibling add is allowed under matter roots (insert is clamped: front after
  // defaults, back before defaults). Other default matter pages stay blocked.
  const contextMenuCanAddSibling =
    contextMenu != null &&
    !isRootBookNode(remixerData.currentBook ?? [], contextMenu.nodeId) &&
    (contextMenuUnderMatterRoot || !isDefaultMatterItem(contextMenu.nodeId));

  const contextMenuIsDeleted = contextMenuTargetNode?.deletedItem === true;

  const contextMenuCanDuplicate =
    contextMenu != null &&
    !isDefaultMatterItem(contextMenu.nodeId) &&
    !(remixerData.currentBook ?? []).some(
      (n) => n.parentID === contextMenu.nodeId,
    );

  const contextMenuSiblingTypeLabel = contextMenu
    ? getNodeTypeLabelForDepth(getContextNodeDepth(contextMenu.nodeId) - 1)
    : "Item";
  const contextMenuChildTypeLabel = contextMenu
    ? getNodeTypeLabelForDepth(getContextNodeDepth(contextMenu.nodeId))
    : "Item";

  /** Auto-numbered default prefix/index pieces for the selected node (edit-panel placeholders). */
  const selectedBookDefaultFormattedPathParts = useCallback(
    (
      nodeId?: string,
    ): {
      prefix: string;
      index: string;
    } => {
      const empty = { prefix: "", index: "" };
      if (remixerData.autoNumbering === false) return empty;
      const selectedId = nodeId ?? uiState.selectedBookNodeId;
      const book = remixerData.currentBook ?? [];
      if (!selectedId || book.length === 0) return empty;
      const normalizedBook = buildBookPaths(
        book,
        uiState.pathLevelFormats ?? [],
        {
          ignoreOverrides: true,
        },
      );
      const node = normalizedBook.find((n) => n["@id"] === selectedId);
      if (!node) return empty;
      return splitFormattedPathParts(
        node.pathNumber ?? [],
        uiState.pathLevelFormats ?? [],
        1,
      );
    },
    [
      remixerData.autoNumbering,
      remixerData.currentBook,
      uiState.pathLevelFormats,
      uiState.selectedBookNodeId,
    ],
  );

  // ==========================================================================
  // Book state mutation
  // ==========================================================================

  /** Rebuild numeric/formatted paths and status flags for a book. Optionally seeds `originalPathNumber`. */
  const normalizeBookState = useCallback(
    (
      book: RemixerSubPage[],
      options: {
        initializeOriginalPathNumber?: boolean;
        /** Prefer when settings were just applied (setState has not re-rendered yet). */
        pathLevelFormats?: PathLevelFormat[];
        autoNumbering?: boolean;
      } = {},
    ): RemixerSubPage[] => {
      const { initializeOriginalPathNumber = false } = options;
      const pathLevelFormats =
        options.pathLevelFormats ?? uiState.pathLevelFormats ?? [];
      const autoNumbering =
        options.autoNumbering ?? remixerData.autoNumbering ?? true;
      const withPaths = buildBookPaths(book, pathLevelFormats).map((page) => {
        const seedPathOriginals = initializeOriginalPathNumber;
        const seedFormattedOriginals =
          !page.addedItem && page.originalFormattedPathOverride === undefined;
        // Backfill the split edit-panel fields for overrides that only carry the
        // combined `formattedPath` (e.g. round-tripped through the backend on publish/reload).
        const seedSplitParts =
          page.formattedPathOverride === true &&
          typeof page.formattedPath === "string" &&
          page.formattedPath.trim().length > 0 &&
          (page.formattedPathPrefix === undefined ||
            page.formattedPathIndex === undefined);
        if (!seedPathOriginals && !seedFormattedOriginals && !seedSplitParts)
          return page;
        return {
          ...page,
          ...(seedPathOriginals && {
            originalPathNumber: page.pathNumber ? [...page.pathNumber] : [],
          }),
          ...(seedFormattedOriginals && {
            originalFormattedPathOverride: page.formattedPathOverride === true,
            originalFormattedPath:
              page.formattedPathOverride === true
                ? (page.formattedPath ?? "").trim()
                : undefined,
          }),
          ...(seedSplitParts &&
            (() => {
              const { prefix, index } = splitStoredFormattedPath(
                page.formattedPath!.trim(),
                pathLevelFormats,
              );
              return { formattedPathPrefix: prefix, formattedPathIndex: index };
            })()),
        };
      });
      const withSiblingTitles = applySiblingDuplicateTitleSuffixes(withPaths);
      const withRenamed = syncRenamedItemFromAutonumberTitle(
        withSiblingTitles,
        autoNumbering,
        pathLevelFormats,
      );
      const withArticleTypes = applyDefaultBookArticleTypes(
        withRenamed,
        remixerData.liberCoverID,
      );
      return withDerivedStatusFlags(withArticleTypes);
    },
    [
      uiState.pathLevelFormats,
      remixerData.autoNumbering,
      remixerData.liberCoverID,
    ],
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
          pathLevelFormats: sanitizePathLevelFormats(
            settings.pathLevelFormats as PathLevelFormat[],
          ),
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

  /** Load the entire remote book (cover + every descendant) in one request. */
  const loadEntireBook = async (
    projectId: string,
    coverPageId: string,
    libreLibrary: string,
    preserveConfigs?: boolean,
  ): Promise<RemixerSubPage[]> => {
    const res = await api.getRemixerTreeFlattened(
      projectId,
      coverPageId,
      libreLibrary,
      { preserveConfigs: preserveConfigs ?? true, flatten: true },
    );
    const nodes: RemixerSubPage[] = res.response ?? [];
    return nodes.map((node) => ({
      ...node,
      addedItem: false,
    }));
  };

  /** Load a library subtree rooted at `rootNode` (used for catalog-book extract imports). */
  const loadLibrarySubtree = useCallback(
    async (
      projectId: string,
      rootNode: RemixerSubPage,
      libreLibrary: string,
    ): Promise<RemixerSubPage[]> => {
      const res = await api.getRemixerTreeFlattened(
        projectId,
        rootNode["@id"],
        libreLibrary,
      );
      const nodes: RemixerSubPage[] = (res.response ?? []).map(
        (node: RemixerSubPage) => ({
          ...node,
          addedItem: false,
        }),
      );
      if (!nodes.some((node) => node["@id"] === rootNode["@id"])) {
        nodes.unshift({ ...rootNode, addedItem: false });
      }
      return nodes;
    },
    [],
  );

  /**
   * Open a catalog book: fetch its ancestry so the library tree is expanded to the book,
   * then scroll to it and keep it highlighted until another catalog book is selected.
   */
  const loadSelectedBook = async (bookID: string, lib: string) => {
    if (!id) return;
    // Prevent the selected-library useQuery from fetching home again while we
    // build the ancestry tree — that race produced a duplicate library root.
    skipLibraryAutoLoadRef.current = true;
    try {
      setRemixerData((prev) => ({ ...prev, selectedLibrary: lib as Library }));

      const targetNodeId = bookID.split("-")[1];
      const pageOptions = {
        includeMatter: false,
        linkTitle: true,
        full: false,
      };
      const nodesById = new Map<string, RemixerSubPage>();
      const expandedNodeIds = new Set<string>([targetNodeId]);

      const upsert = (node: RemixerSubPage, idOverride?: string) => {
        const nodeId = idOverride ?? node["@id"];
        if (!nodeId) return;
        nodesById.set(nodeId, {
          ...(nodesById.get(nodeId) ?? {}),
          ...node,
          "@id": nodeId,
        });
      };

      // Selected book's descendants in one request. Library browse only —
      // do not overlay this project's saved remixer configs onto the tree.
      const treeRes = await api.getRemixerTreeFlattened(id, targetNodeId, lib, {
        flatten: true,
        preserveConfigs: false,
      });
      for (const node of (treeRes.response ?? []) as RemixerSubPage[]) {
        upsert(node);
      }

      // Walk the ancestry with page details so the library tree can expand to the book.
      let pageId: string | undefined = targetNodeId;
      const visited = new Set<string>();
      while (pageId && pageId !== "-1" && !visited.has(pageId)) {
        visited.add(pageId);
        expandedNodeIds.add(pageId);

        const details = await api.getRemixerPage(
          id,
          pageId,
          lib,
          true,
          false,
          pageOptions,
        );
        if (details.err || !details.response) break;

        const node = details.response as RemixerSubPage;
        upsert(node, node["@id"] || pageId);

        const parentId = node.parentID;
        if (!parentId || parentId === "-1") break;

        // Direct children of each ancestor (siblings of the path) — one level only.
        const siblings = await api.getRemixerPage(
          id,
          parentId,
          lib,
          false,
          false,
          pageOptions,
        );
        if (siblings.err === false) {
          for (const child of (siblings.response ?? []) as RemixerSubPage[]) {
            upsert(child);
          }
        }

        pageId = parentId;
      }

      // Library home + top-level shelves (same shape as the auto-load query):
      // resolve home via "0", then load children by the real home @id.
      const libdetails = await api.getRemixerPage(
        id,
        "0",
        lib,
        true,
        false,
        pageOptions,
      );
      if (libdetails.err === false && libdetails.response) {
        const home = libdetails.response as RemixerSubPage;
        const homeId = home["@id"];
        upsert(home);
        if (homeId) {
          expandedNodeIds.add(homeId);
          const libsubpages = await api.getRemixerPage(
            id,
            homeId,
            lib,
            false,
            false,
            pageOptions,
          );
          if (libsubpages.err === false) {
            for (const child of (libsubpages.response ??
              []) as RemixerSubPage[]) {
              upsert(child);
            }
          }
        }
      }

      setRemixerData((prev) => ({
        ...prev,
        library: {
          ...(prev.library ?? {}),
          [lib]: Array.from(nodesById.values()),
        },
      }));

      setExpandedNodeIdsLibrary(
        new Set(
          Array.from(expandedNodeIds).sort((a, b) => parseInt(a) - parseInt(b)),
        ),
      );

      setHighlightedLibraryNodeId(targetNodeId);
      setTimeout(() => {
        const el = document.querySelector<HTMLElement>(
          `[data-node-id="${targetNodeId}"]`,
        );
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 200);
    } finally {
      // Defer until after React commits library pages so auto-load sees
      // hasSelectedLibraryPages and stays disabled.
      setTimeout(() => {
        skipLibraryAutoLoadRef.current = false;
      }, 0);
    }
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
    const isRoot_item = newNode.parentID === remixerData.liberCoverID;
    if (isRoot_item) {
      updateCurrentBook(
        (existingBookNodes) => {
          const updated = existingBookNodes.map((node) =>
            node["@id"] === parentId ? { ...node, "@subpages": true } : node,
          );
          const backMatterIdx = updated.findIndex(
            (n) =>
              n.parentID === remixerData.liberCoverID && isBackMatterNode(n),
          );
          if (backMatterIdx === -1) {
            return [...updated, newNode];
          }
          const result = [...updated];
          result.splice(backMatterIdx, 0, newNode);
          return result;
        },
        { trackHistory: true },
      );
    } else {
      updateCurrentBook(
        (existingBookNodes) => [
          ...existingBookNodes.map((node) =>
            node["@id"] === parentId ? { ...node, "@subpages": true } : node,
          ),
          newNode,
        ],
        { trackHistory: true },
      );
    }
    // setUiState((prev) => ({ ...prev, selectedBookNodeId: newNodeId }));
    const folderToExpand = uiState.selectedBookNodeId;
    if (folderToExpand) {
      setExpandedNodeIdsBook((prev) => {
        const next = new Set(prev);
        next.add(folderToExpand);
        return next;
      });
    }
  };

  /** Soft-delete the currently selected book node and its descendants (skipped for default matter items). */
  const handleDeleteSelectedBookNode = () => {
    const selectedNodeId = uiState.selectedBookNodeId;
    if (!selectedNodeId) return;
    if (isDefaultMatterItem(selectedNodeId)) return;
    updateCurrentBook(
      (existingBookNodes) =>
        applyBookNodeDeletion(existingBookNodes, selectedNodeId),
      { trackHistory: true },
    );
    setUiState((prev) => ({ ...prev, selectedBookNodeId: undefined }));
  };

  /** Restore the currently selected book node and its descendants (mirrors handleDeleteSelectedBookNode). */
  const handleRestoreSelectedBookNode = () => {
    const selectedNodeId = uiState.selectedBookNodeId;
    if (!selectedNodeId) return;
    if (isDefaultMatterItem(selectedNodeId)) return;
    updateCurrentBook(
      (existingBookNodes) =>
        applyBookNodeRestore(existingBookNodes, selectedNodeId),
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
    // The edit panel is an imperative modal in the new UI, so close it explicitly.
    // (`editPanelOpen` drives nothing here; it's a leftover from the old declarative UI.)
    closeAllModals();

    const nextOverride = page.formattedPathOverride === true;
    const nextFormattedPathPrefix = nextOverride
      ? (page.formattedPathPrefix ?? "")
      : undefined;
    const nextFormattedPathIndex = nextOverride
      ? (page.formattedPathIndex ?? "")
      : undefined;
    const nextFormattedPath = nextOverride
      ? `${nextFormattedPathPrefix ?? ""}${nextFormattedPathIndex ?? ""}`.trim()
      : undefined;

    const existingNode = (remixerData.currentBook ?? []).find(
      (node) => node["@id"] === page["@id"],
    );
    if (!existingNode) return;

    const isBookRoot = isRemixerBookRoot(
      existingNode,
      remixerData.liberCoverID,
    );

    // Both sides go through the same canonicalizer EditPanel seeds its field
    // with, so a save with no edits compares equal instead of registering as
    // a rename (which the job would replay as a real MindTouch move).
    const previousTitle = toEditableRemixerTitle(
      existingNode.title || existingNode["@title"] || "",
      isBookRoot,
    );
    const nextTitle = toEditableRemixerTitle(
      page.title || page["@title"] || "",
      isBookRoot,
    );
    const titleChanged = previousTitle !== nextTitle;
    const prevOverride = existingNode.formattedPathOverride === true;
    const nextOverrideUriUiEnding =
      page.overrideUriUiEnding || existingNode.overrideUriUiEnding;
    const pathChanged =
      prevOverride !== nextOverride ||
      (nextOverride &&
        ((existingNode.formattedPathPrefix ?? "") !==
          (nextFormattedPathPrefix ?? "") ||
          (existingNode.formattedPathIndex ?? "") !==
            (nextFormattedPathIndex ?? "") ||
          (existingNode.formattedPath ?? "").trim() !==
            (nextFormattedPath ?? "").trim()));

    // Save with no edits should not mark the node modified or push history.
    if (!titleChanged && !pathChanged) return;

    if (isDefaultMatterItem(page["@id"])) {
      // For default matter items only the path-prefix override can be changed.
      updateCurrentBook(
        (existingBook) =>
          existingBook.map((node) => {
            if (node["@id"] !== page["@id"]) return node;
            const saved = {
              ...node,
              formattedPathOverride: nextOverride,
              formattedPath: nextFormattedPath,
              formattedPathPrefix: nextFormattedPathPrefix,
              formattedPathIndex: nextFormattedPathIndex,
              ...(nextOverrideUriUiEnding
                ? { overrideUriUiEnding: nextOverrideUriUiEnding }
                : {}),
            };
            return {
              ...saved,
              renamedItem: node.renamedItem || hasFormattedPathChanged(saved),
            };
          }),
        { trackHistory: true },
      );
      return;
    }

    updateCurrentBook(
      (existingBook) => {
        return existingBook.map((node) => {
          if (node["@id"] !== page["@id"]) return node;
          const saved = {
            ...node,
            ...page,
            title: nextTitle,
            "@title": nextTitle,
            formattedPathOverride: nextOverride,
            formattedPath: nextFormattedPath,
            formattedPathPrefix: nextFormattedPathPrefix,
            formattedPathIndex: nextFormattedPathIndex,
            ...(nextOverrideUriUiEnding
              ? { overrideUriUiEnding: nextOverrideUriUiEnding }
              : {}),
          };
          return {
            ...saved,
            renamedItem:
              node.renamedItem ||
              titleChanged ||
              hasFormattedPathChanged(saved),
          };
        });
      },
      { trackHistory: true },
    );
  };

  /**
   * Insert `newNode` under `parentId`, clamping position for matter roots:
   * front matter → after default children; back matter → before default children.
   */
  const insertNodeUnderParent = (
    existingBookNodes: RemixerSubPage[],
    newNode: RemixerSubPage,
    parentId: string,
    mode: "above" | "below" | "inside",
    targetNodeId: string,
  ): RemixerSubPage[] => {
    const parent = existingBookNodes.find((n) => n["@id"] === parentId);
    const siblings = existingBookNodes.filter(
      (n) => (n.parentID ?? "-1") === parentId,
    );
    const ordered = sortMatterSiblings(siblings, parent);

    let insertAfterId: string | undefined;
    let insertBeforeId: string | undefined;

    if (parent && isMatterRootNode(parent)) {
      const defaults = ordered.filter((n) => isDefaultMatterPage(n));
      const customs = ordered.filter((n) => !isDefaultMatterPage(n));
      if (
        isFrontMatterNode(parent) ||
        parent["@title"]?.toLowerCase() === "front matter"
      ) {
        // Customs must sit after all defaults.
        if (customs.length === 0) {
          insertAfterId = defaults[defaults.length - 1]?.["@id"];
        } else if (mode === "inside") {
          insertAfterId =
            customs[customs.length - 1]?.["@id"] ??
            defaults[defaults.length - 1]?.["@id"];
        } else {
          const targetIsCustom = customs.some((n) => n["@id"] === targetNodeId);
          if (targetIsCustom) {
            const targetIndex = customs.findIndex(
              (n) => n["@id"] === targetNodeId,
            );
            const afterIndex = mode === "above" ? targetIndex - 1 : targetIndex;
            insertAfterId =
              afterIndex >= 0
                ? customs[afterIndex]?.["@id"]
                : defaults[defaults.length - 1]?.["@id"];
            if (afterIndex < 0 && !insertAfterId) {
              insertBeforeId = customs[0]?.["@id"];
            }
          } else {
            insertAfterId = defaults[defaults.length - 1]?.["@id"];
          }
        }
      } else if (
        isBackMatterNode(parent) ||
        parent["@title"]?.toLowerCase() === "back matter"
      ) {
        // Customs must sit before all defaults.
        if (customs.length === 0) {
          insertBeforeId = defaults[0]?.["@id"];
        } else if (mode === "inside") {
          insertBeforeId = defaults[0]?.["@id"];
          if (!insertBeforeId) {
            insertAfterId = customs[customs.length - 1]?.["@id"];
          }
        } else {
          const targetIsCustom = customs.some((n) => n["@id"] === targetNodeId);
          if (targetIsCustom) {
            const targetIndex = customs.findIndex(
              (n) => n["@id"] === targetNodeId,
            );
            const afterIndex = mode === "above" ? targetIndex - 1 : targetIndex;
            if (afterIndex >= 0) {
              insertAfterId = customs[afterIndex]?.["@id"];
            } else {
              insertBeforeId = customs[0]?.["@id"];
            }
          } else {
            insertBeforeId = defaults[0]?.["@id"];
          }
        }
      }
    } else {
      const targetIndex = siblings.findIndex((n) => n["@id"] === targetNodeId);
      const insertAfterIndex = mode === "above" ? targetIndex - 1 : targetIndex;
      insertAfterId = siblings[insertAfterIndex]?.["@id"];
      if (!insertAfterId && mode === "above") {
        insertBeforeId = siblings[0]?.["@id"];
      }
    }

    const result: RemixerSubPage[] = [];
    let inserted = false;
    for (const n of existingBookNodes) {
      if (insertBeforeId && n["@id"] === insertBeforeId) {
        result.push(newNode);
        inserted = true;
      }
      result.push(n);
      if (insertAfterId && n["@id"] === insertAfterId) {
        result.push(newNode);
        inserted = true;
      }
    }
    if (!inserted) {
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
        (existingBookNodes) =>
          insertNodeUnderParent(
            existingBookNodes.map((n) =>
              n["@id"] === targetNodeId ? { ...n, "@subpages": true } : n,
            ),
            newNode,
            targetNodeId,
            "inside",
            targetNodeId,
          ),
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
        (existingBookNodes) =>
          insertNodeUnderParent(
            existingBookNodes,
            newNode,
            parentId,
            mode,
            targetNodeId,
          ),
        { trackHistory: true },
      );
    }
    setUiState((prev) => ({ ...prev, selectedBookNodeId: newNodeId }));
  };

  /** Dispatch a context-menu action (add above/to/below, delete, modify, duplicate). */
  const handleContextMenuAction = (
    action:
      | "add-above"
      | "add-to"
      | "add-below"
      | "delete"
      | "restore"
      | "modify"
      | "duplicate",
  ) => {
    if (!contextMenu) return;
    const { nodeId } = contextMenu;
    setContextMenu(null);

    if (action === "modify") {
      setUiState((prev) => ({ ...prev, selectedBookNodeId: nodeId }));
      openEditPanelForSelectedBookNode(nodeId);
    } else if (action === "delete") {
      if (isDefaultMatterItem(nodeId)) return;
      updateCurrentBook(
        (existingBookNodes) => applyBookNodeDeletion(existingBookNodes, nodeId),
        { trackHistory: true },
      );
      setUiState((prev) => ({ ...prev, selectedBookNodeId: undefined }));
    } else if (action === "restore") {
      if (isDefaultMatterItem(nodeId)) return;
      updateCurrentBook(
        (existingBookNodes) => applyBookNodeRestore(existingBookNodes, nodeId),
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

  const openEditPanelForSelectedBookNode = (nodeId?: string) => {
    if (!remixerData.library) return;
    // Resolve the target node from the passed id (fresh) rather than relying on
    // `uiState.selectedBookNodeId`, which may not have committed yet when this is
    // called right after a `setUiState` (e.g. the double-click handler). Reading
    // state here would snapshot the previous selection into the modal element.
    const targetId = nodeId ?? uiState.selectedBookNodeId;
    const targetNode = targetId
      ? remixerData.currentBook?.find((node) => node["@id"] === targetId)
      : undefined;
    openModal(
      <EditPanel
        open={true}
        onClose={closeAllModals}
        formattedPathPartsDefault={selectedBookDefaultFormattedPathParts(
          targetId,
        )}
        currentPage={targetNode}
        handleSave={handleSaveEdit}
        library={remixerData.libreLibrary as Library}
        coverPageId={
          remixerData.liberCoverID ??
          remixerData.currentBook?.[0]?.["@id"] ??
          ""
        }
      />,
    );
  };

  /**
   * Persisted-closure guard (see `handleLoadSourceRef`): the F2 key handler is
   * registered in an effect keyed only on the selection, so a directly-captured
   * opener could reference a stale `currentBook`. Route through this ref so the
   * handler always invokes the latest closure.
   */
  const openEditPanelRef = useRef(openEditPanelForSelectedBookNode);
  openEditPanelRef.current = openEditPanelForSelectedBookNode;

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

  const handleOpenCatalogModal = () => {
    openModal(
      <CatalogList
        open={true}
        onClose={closeAllModals}
        dimmer="blurring"
        catalogBook={remixerData.catalogBook}
        loadSelectedBook={(bookID, library) => {
          loadSelectedBook(bookID, library);
          closeAllModals();
        }}
        loading={skipLibraryAutoLoadRef.current}
      />,
    );
  };

  // ==========================================================================
  // Persistence / recovery
  // ==========================================================================

  /** Load the book from a recovery source: local draft, server, server draft, or a fresh reload. */
  const handleLoadSource = async (
    source: "local" | "server" | "serverDraft" | "fresh",
    options?: { preserveConfigs?: boolean },
  ) => {
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
        // Capture draft settings before clear — page-load recovery has not applied
        // them to uiState yet, and preserveConfigs needs them.
        const localBeforeClear = getLocalDraft(id);
        clearLocalDraft(id);
        const preserveConfigs = options?.preserveConfigs !== false;
        const fullBook = await loadEntireBook(
          id,
          remixerData.liberCoverID!,
          remixerData.libreLibrary!,
          preserveConfigs,
        );

        // On first-load recovery, uiState still has init defaults — formats live on
        // the local/server draft until the user picks a source. Prefer those.
        let preservedSettings: {
          autoNumbering?: boolean;
          copyModeState?: string;
          pathLevelFormats?: unknown;
        } | null = null;
        if (preserveConfigs) {
          const uiHasFormats = (uiState.pathLevelFormats?.length ?? 0) > 0;
          if (uiHasFormats) {
            preservedSettings = {
              autoNumbering: remixerData.autoNumbering,
              copyModeState: uiState.copyModeState,
              pathLevelFormats: uiState.pathLevelFormats,
            };
          } else {
            preservedSettings =
              serverStateRef.current?.settings ??
              (localBeforeClear
                ? {
                    autoNumbering: localBeforeClear.autoNumbering,
                    copyModeState: localBeforeClear.copyModeState,
                    pathLevelFormats: localBeforeClear.pathLevelFormats,
                  }
                : null);
          }
        }

        if (preserveConfigs && preservedSettings) {
          applyDraftSettings(preservedSettings);
        } else if (!preserveConfigs) {
          setUiState((prev) => ({
            ...prev,
            pathLevelFormats: [],
            copyModeState: copyModeStates[0].value,
          }));
        }

        const pathLevelFormats = preserveConfigs
          ? sanitizePathLevelFormats(
              (preservedSettings?.pathLevelFormats ??
                uiState.pathLevelFormats) as PathLevelFormat[] | undefined,
            )
          : [];
        const autoNumbering = preserveConfigs
          ? (preservedSettings?.autoNumbering ??
            remixerData.autoNumbering ??
            true)
          : true;

        setRemixerData((prev) => ({
          ...prev,
          autoNumbering,
          currentBook: normalizeBookState(fullBook, {
            initializeOriginalPathNumber: true,
            pathLevelFormats,
            autoNumbering,
          }),
        }));
      }
      setUndoStack([]);
      setRedoStack([]);
    } finally {
      setLoadingRecovery(false);
    }
  };

  /**
   * Persisted modal elements (via `openModal`) freeze the closure captured when
   * they were created, so a stored `<RecoveryModal>` would call a stale
   * `handleLoadSource` (bound to `remixerDataInit`, before the project loads).
   * Route through this ref so the modal always invokes the latest closure.
   */
  const handleLoadSourceRef = useRef(handleLoadSource);
  handleLoadSourceRef.current = handleLoadSource;

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
              updatedAt: savedState.updatedAt,
              updatedBy: savedState.updatedBy,
              publishedAt: savedState.publishedAt,
            },
          };
        }
      } catch {
        // Server unreachable — leave serverStateRef as null
      }
    }

    openModal(
      <RecoveryModal
        open={true}
        loading={loadingRecovery}
        dismissible={true}
        availableSources={{
          hasLocal: !!localDraft,
          hasServer: !!serverStateRef.current,
          hasServerDraft: !!serverStateRef.current,
          localTimestamp: localDraft?.savedAt,
          serverUpdatedAt: serverStateRef.current?.settings.updatedAt,
          serverUpdatedBy: serverStateRef.current?.settings.updatedBy,
          publishedAt: serverStateRef.current?.settings.publishedAt,
        }}
        onLoadSource={(source, options) => {
          handleLoadSourceRef.current(source, options);
          closeAllModals();
        }}
        onClose={closeAllModals}
      />,
    );
  };

  /** Persist the current book + settings to the server and clear any local draft. */
  const saveDraftMutation = useMutation({
    mutationFn: async (data: {
      book: RemixerSubPage[];
      settings: {
        autoNumbering?: boolean;
        copyModeState?: string;
        pathLevelFormats?: PathLevelFormat[];
      };
    }) => {
      const response = await api.saveRemixerProjectState(
        id,
        data.book,
        data.settings,
      );
      if (response.err)
        throw new Error(response.errMsg ?? "Failed to save draft");
      return response;
    },
    onSuccess: (_, variables) => {
      clearLocalDraft(id);
      serverStateRef.current = {
        book: variables.book,
        settings: variables.settings,
      };
      addNotification({
        message: "Draft saved successfully.",
        type: "success",
        duration: 3000,
      });
    },
    onError: (error) => {
      addNotification({
        message:
          error instanceof Error ? error.message : "Failed to save draft",
        type: "error",
        duration: 3000,
      });
    },
  });

  const handleSaveDraft = () => {
    if (!id) return;
    saveDraftMutation.mutate({
      book: remixerData.currentBook ?? [],
      settings: {
        autoNumbering: remixerData.autoNumbering,
        copyModeState: uiState.copyModeState,
        pathLevelFormats: uiState.pathLevelFormats,
      },
    });
  };

  /** Discard local/server drafts and reload the book from source. Resets undo/redo and UI panels. */
  const { mutate: startOverMutation, isPending: isStartOverPending } =
    useMutation({
      mutationFn: async () => {
        clearLocalDraft(id);
        serverStateRef.current = null;
        await api.deleteRemixerProjectState(id);
        const res = await api.getRemixerProject(id);
        const fullBook = await loadEntireBook(
          id,
          res.project.libreCoverID,
          res.project.libreLibrary,
        );
        return { res, fullBook };
      },
      onSuccess: ({ res, fullBook }) => {
        setUndoStack([]);
        setRedoStack([]);
        setUiState((prev) => ({
          ...prev,
          selectedBookNodeId: undefined,
          editPanelOpen: false,
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
      },
      onError: (error) => {
        addNotification({
          message:
            error instanceof Error ? error.message : "Failed to start over.",
          type: "error",
          duration: 4000,
        });
      },
    });

  const handleStartOverWithConfirmation = () => {
    openModal(
      <ConfirmModal
        text="This will delete the saved Remixer draft for this project. This action cannot be undone"
        confirmColor="red"
        confirmText="Start Over"
        cancelText="Keep Changes"
        onCancel={closeAllModals}
        onConfirm={() => {
          startOverMutation();
          closeAllModals();
        }}
      />,
    );
  };

  const openAutoNumberingModal = () => {
    openModal(
      <PathNameFormat
        open={true}
        dimmer="blurring"
        onClose={closeAllModals}
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
      />,
    );
  };

  // ==========================================================================
  // Create Matter
  // ==========================================================================
  const openCreateMatterModal = async () => {
    if (!id) return;
    openModal(
      <CreateMatterModal
        open={true}
        onClose={closeAllModals}
        onSuccess={() => {
          startOverMutation(); // Reset all state and reload the book to reflect the new matter.
          closeAllModals();
        }}
        projectId={id}
      />,
    );
  };

  // ==========================================================================
  // Publish
  // ==========================================================================

  /** Kick off a publish job on the server and start polling for status. */
  const publishMutation = useMutation({
    mutationFn: async (data: {
      book: RemixerSubPage[];
      settings: {
        autoNumbering?: boolean;
        copyModeState?: string;
        pathLevelFormats?: PathLevelFormat[];
      };
    }) => {
      const response = await api.publishRemixerProject(
        id,
        data.book,
        data.settings,
      );
      if (response.err) throw new Error(response.errMsg ?? "Failed to publish");
      return response;
    },
    onSuccess: () => {
      setPublishPolling(true);
    },
    onError: (error) => {
      setPublishStatus("error");
      addNotification({
        message: error instanceof Error ? error.message : "Failed to publish",
        type: "error",
        duration: 3000,
      });
    },
  });

  const handlePublish = () => {
    if (!id) return;
    setPublishStatus("pending");
    setPublishMessages(["Publish request accepted. Creating backend job..."]);
    publishMutation.mutate({
      book: remixerData.currentBook ?? [],
      settings: {
        autoNumbering: remixerData.autoNumbering,
        copyModeState: uiState.copyModeState,
        pathLevelFormats: uiState.pathLevelFormats,
      },
    });
  };

  // Rendered inline in the tree (see below) rather than pushed through
  // `openModal`, which snapshots a static element and would freeze the panel's
  // `publishStatus`/`publishMessages` at their open-time values — the polling
  // updates would never reach it. Inline rendering keeps its props live.
  const openPublishModal = () => {
    // Clear a previous run's terminal state so Save starts enabled again;
    // never clear mid-flight (pending/running), e.g. the on-load resume-polling call.
    if (publishStatus === "success" || publishStatus === "error") {
      setPublishStatus("idle");
      setPublishMessages([]);
    }
    setPublishPanelOpen(true);
  };

  // ==========================================================================
  // Stable <TreeDnd> prop identities
  // ==========================================================================
  // TreeDnd is memoized; these give it referentially-stable callbacks so
  // unrelated re-renders (publish polling, context menu, media-query flips)
  // don't rebuild the tree. The drag/import/expand handlers close over
  // frequently-changing state, so we route them through refs (the same pattern
  // as openEditPanelRef / handleLoadSourceRef) rather than depend on that state.
  const expandBookTreeRef = useRef(expandBookTree);
  expandBookTreeRef.current = expandBookTree;
  const expandLibraryTreeRef = useRef(expandLibraryTree);
  expandLibraryTreeRef.current = expandLibraryTree;
  const importLibraryNodeToBookRef = useRef(importLibraryNodeToBook);
  importLibraryNodeToBookRef.current = importLibraryNodeToBook;
  const importLibraryNodeToBookByIdRef = useRef(importLibraryNodeToBookById);
  importLibraryNodeToBookByIdRef.current = importLibraryNodeToBookById;
  const handleReorderBookNodeRef = useRef(handleReorderBookNode);
  handleReorderBookNodeRef.current = handleReorderBookNode;
  const handleMarkMovedNodesRef = useRef(handleMarkMovedNodes);
  handleMarkMovedNodesRef.current = handleMarkMovedNodes;

  const handleBookExpand = useCallback(
    (nodeId: string) => expandBookTreeRef.current(nodeId),
    [],
  );
  const handleLibraryExpand = useCallback(
    (nodeId: string) => expandLibraryTreeRef.current(nodeId),
    [],
  );
  const handleImportNode = useCallback(
    (params: Parameters<typeof importLibraryNodeToBook>[0]) =>
      importLibraryNodeToBookRef.current(params),
    [],
  );
  const handleImportNodeById = useCallback(
    (params: Parameters<typeof importLibraryNodeToBookById>[0]) =>
      importLibraryNodeToBookByIdRef.current(params),
    [],
  );
  const handleReorderNode = useCallback(
    (params: Parameters<typeof handleReorderBookNode>[0]) =>
      handleReorderBookNodeRef.current(params),
    [],
  );
  const handleMarkMoved = useCallback(
    (nodeIds: string[]) => handleMarkMovedNodesRef.current(nodeIds),
    [],
  );
  const handleSelectBookNode = useCallback(
    (nodeId?: string) =>
      setUiState((prev) => ({ ...prev, selectedBookNodeId: nodeId })),
    [],
  );
  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    setUiState((prev) => ({ ...prev, selectedBookNodeId: nodeId }));
    openEditPanelRef.current(nodeId);
  }, []);
  const handleNodeContextMenu = useCallback(
    (nodeId: string, event: React.MouseEvent) => {
      setUiState((prev) => ({ ...prev, selectedBookNodeId: nodeId }));
      setContextMenu({ nodeId, x: event.clientX, y: event.clientY });
    },
    [],
  );

  // ==========================================================================
  // Effects
  // ==========================================================================

  // Load pages for the pending book-import modal whenever a new pending import appears.
  const bookImportSubtreeQuery = useQuery({
    queryKey: [
      "remixer-book-import-subtree",
      id,
      remixerData.selectedLibrary,
      pendingBookImport?.node["@id"],
      pendingBookImport?.targetNodeId,
    ],
    enabled: !!pendingBookImport && !!id && !!remixerData.selectedLibrary,
    queryFn: async () => {
      const subtree = await loadLibrarySubtree(
        id,
        pendingBookImport!.node,
        remixerData.selectedLibrary as Library,
      );
      return { rootId: pendingBookImport!.node["@id"], subtree };
    },
    onSuccess: ({ rootId, subtree }) => {
      setBookImportSubtree(subtree);
      const defaultSelectable = subtree
        .filter(
          (n) =>
            n["@id"] !== rootId && !isMatterBranchNodePure(n["@id"], subtree),
        )
        .map((n) => n["@id"]);
      setBookImportSelectedIds(new Set(defaultSelectable));
      const expanded = new Set<string>();
      subtree.forEach((n) => {
        if (n["@subpages"] && n["@id"] !== rootId) expanded.add(n["@id"]);
      });
      setBookImportExpandedIds(expanded);
    },
    onError: (error) => {
      addNotification({
        message:
          error instanceof Error ? error.message : "Failed to load book pages.",
        type: "error",
        duration: 4000,
      });
      setPendingBookImport(null);
    },
  });

  // Reset the modal state when the pending import is cleared.
  useEffect(() => {
    if (pendingBookImport) return;
    setBookImportSubtree(null);
    setBookImportSelectedIds(new Set());
    setBookImportExpandedIds(new Set());
  }, [pendingBookImport]);

  useEffect(() => {
    setBookImportSubtreeLoading(bookImportSubtreeQuery.isFetching);
  }, [bookImportSubtreeQuery.isFetching]);

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
          openPublishModal();
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
        updatedAt?: string | Date;
        updatedBy?: string;
        publishedAt?: Date | string;
      } | null = null;

      // Describes the server state, so it is only worth reporting once we know
      // the user is actually keeping the server state (see `announceUntracked`).
      let untrackedNotice: UntrackedNotice | null = null;

      try {
        const savedState = await api.getRemixerProjectState(id);
        const savedBook = (savedState.currentBook ?? []) as RemixerSubPage[];
        if (Array.isArray(savedBook) && savedBook.length > 0) {
          serverBook = savedBook;
          serverSettings = {
            autoNumbering: savedState.autoNumbering,
            copyModeState: savedState.copyModeState,
            pathLevelFormats: savedState.pathLevelFormats,
            updatedAt: savedState?.updatedAt,
            updatedBy: savedState?.updatedBy,
            publishedAt: savedState?.publishedAt,
          };
          serverStateRef.current = {
            book: savedBook,
            settings: serverSettings,
          };
        }
        const untracked = Array.isArray(savedState.untracked)
          ? (savedState.untracked as RemixerSubPage[])
          : [];
        const reparented = Array.isArray(savedState.reparented)
          ? (savedState.reparented as RemixerSubPage[])
          : [];
        if (untracked.length > 0) {
          untrackedNotice = { untracked, reparented };
        }
      } catch (error) {
        console.error("Failed to load remixer saved state", error);
      }

      /**
       * One summary rather than a toast per page: a deleted chapter can strip
       * dozens of pages at once, and the notifications provider stacks every
       * call. Uses `error` and a long duration because this reports content
       * silently disappearing from the user's book.
       */
      const announceUntracked = () => {
        if (!untrackedNotice) return;
        if (!shouldAnnounceUntracked(id, untrackedNotice)) return;
        const { untracked, reparented } = untrackedNotice;
        const subject =
          untracked.length === 1
            ? `"${untracked[0]["@title"]}" is no longer in this book and was removed from your draft`
            : `${untracked.length} pages are no longer in this book and were removed from your draft`;
        const orphans =
          reparented.length > 0
            ? ` ${reparented.length} imported page${
                reparented.length === 1 ? " was" : "s were"
              } moved to the top level as a result.`
            : "";
        addNotification({
          message: `${subject}.${orphans}`,
          type: "error",
          duration: 10000,
        });
      };

      if (localDraft && serverBook) {
        openModal(
          <RecoveryModal
            open={true}
            loading={loadingRecovery}
            dismissible={false}
            availableSources={{
              hasLocal: !!localDraft,
              hasServer: !!serverBook,
              hasServerDraft: !!serverBook,
              localTimestamp: localDraft?.savedAt,
              serverUpdatedAt: serverSettings?.updatedAt,
              serverUpdatedBy: serverSettings?.updatedBy,
              publishedAt: serverSettings?.publishedAt,
            }}
            onLoadSource={(source, options) => {
              handleLoadSourceRef.current(source, options);
              // Only relevant when the server state is the one being kept.
              if (source === "server" || source === "serverDraft") {
                announceUntracked();
              }
              closeAllModals();
            }}
            onClose={closeAllModals}
          />,
        );
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
        announceUntracked();
        return;
      }

      // Nothing usable was saved. If that is because reconciliation emptied the
      // book, say so before silently reloading it from the library — otherwise
      // the whole draft disappearing looks like it was never saved.
      announceUntracked();

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
  // Only fetch when we have no pages yet — background refetches would overwrite lazily expanded
  // children and remount/re-render the tree (e.g. on window focus).
  const hasSelectedLibraryPages = !!(
    remixerData.selectedLibrary &&
    remixerData.library?.[remixerData.selectedLibrary]?.length
  );
  useQuery({
    queryKey: ["remixer-selected-library", id, remixerData.selectedLibrary],
    enabled:
      !!id &&
      !!remixerData.selectedLibrary &&
      !hasSelectedLibraryPages &&
      !skipLibraryAutoLoadRef.current,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    queryFn: async () => {
      const library = remixerData.selectedLibrary as Library;
      const resLibraryDetails = await api.getRemixerPage(
        id,
        "0",
        library,
        true,
        true,
        { includeMatter: false, linkTitle: true, full: false },
      );
      const resLibrary = await api.getRemixerPage(
        id,
        resLibraryDetails.response["@id"],
        library,
        false,
        true,
        { includeMatter: false, linkTitle: true, full: false },
      );
      return {
        library,
        nodes: [resLibraryDetails.response, ...(resLibrary.response ?? [])],
      };
    },
    onSuccess: (data) => {
      if (!data) return;
      setRemixerData((prev) => {
        // Preserve any pages already present (catalog ancestry / expandLibraryTree).
        if (prev.library?.[data.library]?.length) return prev;
        return {
          ...prev,
          library: {
            ...(prev.library ?? {}),
            [data.library]: data.nodes,
          },
        };
      });
    },
  });

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
  useQuery({
    queryKey: ["remixer-publish-job", id],
    enabled: !!id && publishPolling,
    refetchInterval: publishPolling ? 2000 : false,
    refetchIntervalInBackground: true,
    queryFn: async () => {
      const statusResponse = await api.getRemixerPublishJobStatus(id);
      return statusResponse.job as {
        status: PublishJobStatus;
        messages?: string[];
        errorMessage?: string;
      } | null;
    },
    onSuccess: (job) => {
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
        serverStateRef.current = null;
        handleLoadSourceRef.current("serverDraft");
      } else if (job.status === "error") {
        setPublishPolling(false);
        addNotification({
          message: job.errorMessage || "Publish failed.",
          type: "error",
          duration: 5000,
        });
      }
    },
    onError: (error) => {
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
    },
  });

  // F2 opens the edit panel for the currently selected book node.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2" && uiState.selectedBookNodeId) {
        e.preventDefault();
        openEditPanelRef.current(uiState.selectedBookNodeId);
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

  const { currentBookTitle, currentBookLink } = useMemo(() => {
    const root = remixerData.currentBook?.[0];
    return {
      currentBookTitle: root?.["@title"] || root?.title || "",
      currentBookLink: root?.["uri.ui"] || root?.["@href"] || "",
    };
  }, [remixerData.currentBook]);

  // ==========================================================================
  // Render
  // ==========================================================================
  return (
    <div className="h-full! p-8!">
      <Stack direction="vertical" gap="md" className="mb-4 w-full! h-full!">
        <Stack
          direction={isMidSizedScreen ? "vertical" : "horizontal"}
          align={isMidSizedScreen ? "start" : "center"}
          justify="between"
          className="w-full"
        >
          <div className="flex flex-col">
            <Heading level={2}>Remixer</Heading>
            {!isLoadingProject && project?.title && (
              <Breadcrumb aria-label="Page navigation">
                <Breadcrumb.Item href="/projects">Projects</Breadcrumb.Item>
                <Breadcrumb.Item href={`/projects/${id}`}>
                  {project?.title}
                </Breadcrumb.Item>
                <Breadcrumb.Item isCurrent>Remixer</Breadcrumb.Item>
              </Breadcrumb>
            )}
          </div>
          <ControlPanelNewUITemp
            isNarrowScreen={isNarrowScreen}
            isAdmin={isSupportOrSuperAdmin}
            copyModeState={uiState.copyModeState ?? "default"}
            onCopyModeChange={(newMode) => {
              setUiState((prev) => ({ ...prev, copyModeState: newMode }));
              addNotification({
                message: `Copy mode changed to ${newMode}`,
                type: "info",
                duration: 3000,
              });
            }}
            onCreateMatter={() => openCreateMatterModal()}
            onStartOver={() => handleStartOverWithConfirmation()}
            onLoadVersion={() => openRecoveryModal()}
            onAutoNumberingSettings={() => openAutoNumberingModal()}
            onSaveDraft={() => handleSaveDraft()}
            onSaveChanges={() => openPublishModal()}
            projectID={id}
            projectName={project?.title}
          />
        </Stack>
      </Stack>
      <Card className="h-[900px] w-full!">
        <Grid cols={2} className="h-full w-full" gap="lg">
          <Stack direction="horizontal" align="start">
            <Stack direction="vertical" gap="sm" className="h-full w-full">
              <Stack
                direction="horizontal"
                gap="md"
                className="w-full"
                align="center"
                justify="between"
              >
                <Text color="default" className="font-bold text-lg">
                  Library
                </Text>
                <LibraryActions
                  isNarrowScreen={isNarrowScreen}
                  remixerData={remixerData}
                  setRemixerData={setRemixerData}
                  onOpenCatalogModal={() => handleOpenCatalogModal()}
                />
              </Stack>

              {selectedLibraryPages && remixerData.selectedLibrary ? (
                <TreeDnd
                  expandedNodeIds={expandedNodeIdsLibrary}
                  setExpandedNodeIds={setExpandedNodeIdsLibrary}
                  currentBook={selectedLibraryPages}
                  autoNumbering={remixerData.autoNumbering ?? true}
                  pathLevelFormats={
                    uiState.pathLevelFormats ?? EMPTY_PATH_LEVEL_FORMATS
                  }
                  onExpand={handleLibraryExpand}
                  treeId="library"
                  selectedNodeId={highlightedLibraryNodeId}
                />
              ) : (
                <TreeSkeleton />
              )}
            </Stack>
          </Stack>
          <Stack direction="horizontal" align="start">
            <Stack direction="vertical" gap="sm" className="h-full w-full">
              <Stack
                direction="horizontal"
                className="w-full"
                align="center"
                justify="between"
              >
                <Text className="font-bold text-lg flex items-top" color="default">
                  Text{" "}
                  {currentBookLink && (
                    <a
                      href={currentBookLink}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      style={{ display: "inline-flex", marginLeft: 8 }}
                    >
                      <Icon
                        name="linkify"
                        style={{ color: "#1e70bf", margin: 0 }}
                      />
                    </a>
                  )}
                </Text>
                <BookActions
                  isNarrowScreen={isNarrowScreen}
                  onAddItem={handleAddBookItem}
                  onDeleteItem={handleDeleteSelectedBookNode}
                  onRestoreItem={handleRestoreSelectedBookNode}
                  isSelectedItemDeleted={
                    (remixerData.currentBook ?? []).find(
                      (n) => n["@id"] === uiState.selectedBookNodeId,
                    )?.deletedItem === true
                  }
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  isAllExpanded={isExpandedAllCurrentBookNodes()}
                  onToggleExpandCollapse={() => {
                    if (isExpandedAllCurrentBookNodes()) {
                      collapseAllCurrentBook();
                    } else {
                      expandAllCurrentBook();
                    }
                  }}
                  canUndo={undoStack.length > 0}
                  canRedo={redoStack.length > 0}
                />
              </Stack>
              {remixerData.currentBook && !isStartOverPending ? (
                <TreeDnd
                  expandedNodeIds={expandedNodeIdsBook}
                  setExpandedNodeIds={setExpandedNodeIdsBook}
                  currentBook={remixerData.currentBook}
                  autoNumbering={remixerData.autoNumbering ?? true}
                  pathLevelFormats={
                    uiState.pathLevelFormats ?? EMPTY_PATH_LEVEL_FORMATS
                  }
                  onExpand={handleBookExpand}
                  treeId="book"
                  onImportNode={handleImportNode}
                  onImportNodeById={handleImportNodeById}
                  onReorderNode={handleReorderNode}
                  onMarkMovedNodes={handleMarkMoved}
                  selectedNodeId={uiState.selectedBookNodeId}
                  onSelectNode={handleSelectBookNode}
                  onNodeDoubleClick={handleNodeDoubleClick}
                  onNodeContextMenu={handleNodeContextMenu}
                />
              ) : (
                <TreeSkeleton />
              )}
            </Stack>
          </Stack>
        </Grid>
      </Card>
      <PublishPanel
        open={publishPanelOpen}
        dimmer="blurring"
        handleClose={() => setPublishPanelOpen(false)}
        handlePublish={handlePublish}
        currentBook={remixerData.currentBook}
        publishInProgress={publishPolling}
        publishStatus={publishStatus}
        publishMessages={publishMessages}
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
        isDeleted={contextMenuIsDeleted}
        addAboveLabel={`Add ${contextMenuSiblingTypeLabel} Above`}
        addToLabel={`Add ${contextMenuChildTypeLabel} To`}
        addBelowLabel={`Add ${contextMenuSiblingTypeLabel} Below`}
        onAction={handleContextMenuAction}
      />
    </div>
  );
};

export default RemixerDashboard;
