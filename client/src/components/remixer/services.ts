import { GetRemixerDisplayTitleOptions, NumberingType, PathLevelFormat, RemixerSubPage } from "./model";

export type DropPosition = "before" | "inside" | "after";

export interface LocalDraft {
  currentBook: RemixerSubPage[];
  autoNumbering?: boolean;
  copyModeState?: string;
  pathLevelFormats?: PathLevelFormat[];
  savedAt: number;
}

const LOCAL_DRAFT_KEY = (projectId: string) => `remixer_draft_${projectId}`;

export function getLocalDraft(projectId: string): LocalDraft | null {
  try {
    const raw = localStorage.getItem(LOCAL_DRAFT_KEY(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.currentBook) || parsed.currentBook.length === 0)
      return null;
    return parsed as LocalDraft;
  } catch {
    return null;
  }
}

export function setLocalDraft(projectId: string, draft: LocalDraft): void {
  try {
    localStorage.setItem(LOCAL_DRAFT_KEY(projectId), JSON.stringify(draft));
  } catch {
    // localStorage quota exceeded or unavailable
  }
}

export function clearLocalDraft(projectId: string): void {
  try {
    localStorage.removeItem(LOCAL_DRAFT_KEY(projectId));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Path/number helpers
// ---------------------------------------------------------------------------

export const stripLeadingNumbering = (value: string): string =>
  value.replace(/^\s*\d+(?:\.\d+)*\s*[:.\-]\s*/, "").trim();

/**
 * Stored titles often duplicate the computed path prefix ("1.2: Title"). With auto-numbering,
 * drop the legacy segment before the first ":" and any further ":" in the remainder.
 */
export const stripDefaultTitlePrefixBeforeColon = (value: string): string => {
  let s = value;
  const colonIndex = s.indexOf(":");
  if (colonIndex !== -1) {
    s = s.slice(colonIndex + 1);
  }
  return s.replace(/:/g, "").trim();
};

const normalizedMatterTitle = (node: RemixerSubPage): string =>
  stripLeadingNumbering(node["@title"] || node.title || "").toLowerCase();

export const isFrontMatterNode = (node: RemixerSubPage): boolean => {
  if (normalizedMatterTitle(node) === "front matter") return true;
  const uri = (node["uri.ui"] || node["@href"] || "").toLowerCase();
  return uri.includes("front_matter");
};

export const isBackMatterNode = (node: RemixerSubPage): boolean => {
  if (normalizedMatterTitle(node) === "back matter") return true;
  const uri = (node["uri.ui"] || node["@href"] || "").toLowerCase();
  return uri.includes("back_matter");
};

/** Path segment as integer for formatting ("0" → 0, "3" → 3). */
export const parsePathSegmentOrdinal = (segment: string): number => {
  const t = segment.trim();
  if (t === "") return 1;
  const n = Number.parseInt(t, 10);
  if (Number.isFinite(n) && String(n) === t) return n;
  return Math.max(1, Number(segment) || 1);
};

export const arePathNumbersEqual = (
  left?: string[],
  right?: string[],
): boolean => {
  const l = left ?? [];
  const r = right ?? [];
  if (l.length !== r.length) return false;
  return l.every((segment, index) => segment === r[index]);
};

export const cloneBook = (book: RemixerSubPage[]): RemixerSubPage[] =>
  book.map((page) => ({ ...page }));

export const toRoman = (value: number): string => {
  if (value <= 0) return "I";
  const numerals: Array<[number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let remaining = Math.floor(value);
  let result = "";
  for (const [num, symbol] of numerals) {
    while (remaining >= num) {
      result += symbol;
      remaining -= num;
    }
  }
  return result || "I";
};

export const toAlphabetic = (value: number): string => {
  const normalized = Math.max(1, Math.floor(value));
  let n = normalized;
  let result = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
};

export const getFormattedTokenByType = (
  value: number,
  type: NumberingType,
): string => {
  if (type === "none") return "";
  if (type === "alphabetic") return toAlphabetic(value);
  if (type === "alphabetic_lower") return toAlphabetic(value).toLowerCase();
  if (type === "roman") return toRoman(value);
  if (type === "roman_lower") return toRoman(value).toLowerCase();
  return String(value);
};

export const getStartToken = (start: number, type: NumberingType): string => {
  if (type === "none") return "";
  return getFormattedTokenByType(Math.max(1, start || 1), type);
};

/**
 * Formatted display path from ordinal segments — matches `buildBookPaths` `toPaths` rules
 * (delimiters, excludeParent reset, prefix/type per level).
 */
export const formatOrdinalSegmentsToFormattedPath = (
  segments: string[],
  pathLevelFormats: PathLevelFormat[],
  startLevel: number,
): string => {
  let numericPath = "";
  let formattedPath = "";
  segments.forEach((segment, index) => {
    const level = startLevel + index;
    const format = pathLevelFormats.find((item) => item.level === level);
    const delimiter = format?.delimiter ?? ".";
    const start = Math.max(1, format?.start ?? 1);
    const type: NumberingType = format?.type ?? "numeric";
    const value = start + parsePathSegmentOrdinal(segment) - 1;
    const token = getFormattedTokenByType(value, type);
    const tokenExists = token.trim().length > 0;

    if (format?.excludeParent) {
      numericPath = tokenExists ? token : "";
      formattedPath = numericPath;
      return;
    }

    if (tokenExists) {
      numericPath = numericPath ? `${numericPath}${delimiter}${token}` : token;
      const prefix = format?.prefix ?? "";
      formattedPath = prefix ? `${prefix}${numericPath}` : numericPath;
    }
  });
  return formattedPath;
};

/** Builds the path prefix string from ordinal segments (same rules as book `formattedPath`). */
export const buildFormattedPathFromNumberPath = (
  numberPath: string[],
  pathLevelFormats: PathLevelFormat[],
  options?: { startLevel?: number },
): string =>
  formatOrdinalSegmentsToFormattedPath(
    numberPath,
    pathLevelFormats,
    options?.startLevel ?? 1,
  );

/**
 * If an ancestor has `formattedPathOverride`, build `ancestorPrefix.<suffix>` from this node's
 * path segments below that ancestor (e.g. parent `CH-2A` → child `CH-2A.1`).
 */
export const resolveInheritedFormattedPathPrefix = (
  page: RemixerSubPage,
  numberPath: string[],
  pathLevelFormats: PathLevelFormat[],
  nodesById: Map<string, RemixerSubPage>,
  ordinalPathById: Map<string, string[]>,
): string | null => {
  let parentId = page.parentID ?? "-1";
  while (parentId !== "-1") {
    const ancestor = nodesById.get(parentId);
    if (!ancestor) break;
    if (
      ancestor.formattedPathOverride === true &&
      typeof ancestor.formattedPath === "string" &&
      ancestor.formattedPath.trim().length > 0
    ) {
      const ancestorDepth = (ordinalPathById.get(parentId) ?? []).length;
      const relative = numberPath.slice(ancestorDepth);
      if (relative.length === 0) return null;
      const firstRelLevel = ancestorDepth + 1;
      const firstRelFormat = pathLevelFormats.find((item) => item.level === firstRelLevel);
      const suffix = formatOrdinalSegmentsToFormattedPath(
        relative,
        pathLevelFormats,
        firstRelLevel,
      );
      const prefix = ancestor.formattedPath.trim();
      if (!suffix) return prefix;
      // excludeParent on first relative level: restart display (no inherited prefix), same as non-inherited tree.
      if (firstRelFormat?.excludeParent) {
        return suffix;
      }
      const joinDelim = firstRelFormat?.delimiter ?? ".";
      return `${prefix}${joinDelim}${suffix}`;
    }
    parentId = ancestor.parentID ?? "-1";
  }
  return null;
};

export const getRemixerDisplayTitle = (
  page: RemixerSubPage,
  numberPath: string[],
  /** True on front/back matter nodes and all descendants — no numeric path prefix. */
  inMatterNoNumberSubtree: boolean,
  inDeletedBranch: boolean,
  options: GetRemixerDisplayTitleOptions,
): string => {
  const {
    isBookTree,
    autoNumbering,
    pathLevelFormats = [],
    remixerPathLookup,
  } = options;
  const rawTitle = page["@title"] || page.title || "";
  if (!isBookTree) return rawTitle;
  if (!autoNumbering) return rawTitle;
  let cleanTitle = stripLeadingNumbering(rawTitle);
  const preserveTitleThroughColon = page.formattedPathOverride === true;
  if (!preserveTitleThroughColon) {
    cleanTitle = stripDefaultTitlePrefixBeforeColon(cleanTitle);
  }
  if (inDeletedBranch || numberPath.length === 0 || inMatterNoNumberSubtree) {
    return cleanTitle;
  }
  const overriddenFormattedPath =
    page.formattedPathOverride === true &&
    typeof page.formattedPath === "string" &&
    page.formattedPath.trim().length > 0
      ? page.formattedPath.trim()
      : "";
  if (overriddenFormattedPath) {
    return `${overriddenFormattedPath}: ${cleanTitle}`;
  }
  const inherited =
    remixerPathLookup &&
    resolveInheritedFormattedPathPrefix(
      page,
      numberPath,
      pathLevelFormats,
      remixerPathLookup.nodesById,
      remixerPathLookup.ordinalPathById,
    );
  if (inherited) {
    return `${inherited}: ${cleanTitle}`;
  }
  const formattedPath = buildFormattedPathFromNumberPath(
    numberPath,
    pathLevelFormats,
  );
  return formattedPath ? `${formattedPath}: ${cleanTitle}` : cleanTitle;
};

const isDeletedForPath = (node: RemixerSubPage): boolean =>
  node.deletedItem === true || node.isDeleted === true;

/**
 * Ordinal path segments per page: book root []; front matter ["0"]; chapters ["1"]…;
 * back matter root uses last index (chapter count + 1). Nested: ["1","1"], ["0","1"], …
 * Single top-level book node gets [] and layout applies to its children.
 */
export const computeRemixerOrdinalPathsMap = (
  book: RemixerSubPage[],
): Map<string, string[]> => {
  const nodesById = new Map(book.map((node) => [node["@id"], node]));
  const childrenByParent = new Map<string, RemixerSubPage[]>();

  const pushChild = (parentId: string, node: RemixerSubPage) => {
    const children = childrenByParent.get(parentId) ?? [];
    children.push(node);
    childrenByParent.set(parentId, children);
  };

  book.forEach((node) => {
    const parentId = node.parentID ?? "-1";
    if (parentId === "-1" || !nodesById.has(parentId)) {
      pushChild("-1", node);
    } else {
      pushChild(parentId, node);
    }
  });

  const ordinalPathById = new Map<string, string[]>();
  const visited = new Set<string>();

  const rootRow = childrenByParent.get("-1") ?? [];
  const singletonBookRootId =
    rootRow.length === 1 ? rootRow[0]["@id"] : null;

  const isRootLevelLayout = (parentId: string, parentPath: string[]): boolean => {
    if (parentId === "-1" && parentPath.length === 0) return true;
    if (
      singletonBookRootId &&
      parentId === singletonBookRootId &&
      parentPath.length === 0
    ) {
      return true;
    }
    return false;
  };

  const assignUnderParent = (
    parentId: string,
    parentPath: string[],
    parentInDeletedBranch: boolean,
  ) => {
    const children = childrenByParent.get(parentId) ?? [];

    if (isRootLevelLayout(parentId, parentPath)) {
      const chapterSlotNodes = children.filter(
        (c) =>
          !isFrontMatterNode(c) &&
          !isBackMatterNode(c) &&
          !isDeletedForPath(c),
      );
      const backMatterSegment = String(chapterSlotNodes.length + 1);

      for (const child of children) {
        if (isDeletedForPath(child) || parentInDeletedBranch) {
          const path = [...parentPath];
          ordinalPathById.set(child["@id"], path);
          visited.add(child["@id"]);
          assignUnderParent(child["@id"], path, true);
          continue;
        }
        let nextPath: string[];
        if (isFrontMatterNode(child)) {
          nextPath = [...parentPath, "0"];
        } else if (isBackMatterNode(child)) {
          nextPath = [...parentPath, backMatterSegment];
        } else {
          const idx = chapterSlotNodes.indexOf(child);
          nextPath =
            idx >= 0 ? [...parentPath, String(idx + 1)] : [...parentPath];
        }
        ordinalPathById.set(child["@id"], nextPath);
        visited.add(child["@id"]);
        assignUnderParent(child["@id"], nextPath, false);
      }
      return;
    }

    let ordinal = 0;
    for (const child of children) {
      if (isDeletedForPath(child) || parentInDeletedBranch) {
        const path = [...parentPath];
        ordinalPathById.set(child["@id"], path);
        visited.add(child["@id"]);
        assignUnderParent(child["@id"], path, true);
        continue;
      }
      ordinal += 1;
      const nextPath = [...parentPath, String(ordinal)];
      ordinalPathById.set(child["@id"], nextPath);
      visited.add(child["@id"]);
      assignUnderParent(child["@id"], nextPath, false);
    }
  };

  if (singletonBookRootId) {
    const only = rootRow[0];
    ordinalPathById.set(only["@id"], []);
    visited.add(only["@id"]);
    assignUnderParent(singletonBookRootId, [], false);
  } else {
    assignUnderParent("-1", [], false);
  }

  book.forEach((node) => {
    if (!visited.has(node["@id"])) {
      ordinalPathById.set(node["@id"], [String(ordinalPathById.size + 1)]);
    }
  });

  return ordinalPathById;
};

export const buildBookPaths = (
  book: RemixerSubPage[],
  pathLevelFormats: PathLevelFormat[] = [],
  options: { ignoreOverrides?: boolean } = {},
): RemixerSubPage[] => {
  const { ignoreOverrides = false } = options;
  if (book.length === 0) return book;

  const nodesById = new Map(book.map((n) => [n["@id"], n]));
  const ordinalPathById = computeRemixerOrdinalPathsMap(book);

  const toPaths = (ordinalPath: string[]) => {
    let numberedPath = "";
    const formattedPath = formatOrdinalSegmentsToFormattedPath(
      ordinalPath,
      pathLevelFormats,
      1,
    );
    ordinalPath.forEach((segment, index) => {
      const level = index + 1;
      const format = pathLevelFormats.find((item) => item.level === level);
      const delimiter = format?.delimiter ?? ".";
      const numericToken = segment;
      const numericTokenExists = numericToken.trim().length > 0;

      if (format?.excludeParent) {
        numberedPath = numericTokenExists ? numericToken : "";
        return;
      }

      if (numericTokenExists) {
        numberedPath = numberedPath
          ? `${numberedPath}${delimiter}${numericToken}`
          : numericToken;
      }
    });
    return { numberedPath, formattedPath };
  };

  return book.map((node) => {
    const ordinalPath = ordinalPathById.get(node["@id"]) ?? [];
    const { numberedPath, formattedPath: computedFormattedPath } = toPaths(ordinalPath);

    const hasOverride =
      ignoreOverrides !== true &&
      node.formattedPathOverride === true &&
      typeof node.formattedPath === "string" &&
      node.formattedPath.trim().length > 0;
    const inheritedPrefix =
      !hasOverride
        ? resolveInheritedFormattedPathPrefix(
            node,
            ordinalPath,
            pathLevelFormats,
            nodesById,
            ordinalPathById,
          )
        : null;
    const formattedPath = hasOverride
      ? node.formattedPath
      : inheritedPrefix ?? computedFormattedPath;
    return {
      ...node,
      originalPathNumber: node.originalPathNumber,
      pathNumber: ordinalPath,
      numberedPath,
      formattedPath,
    };
  });
};

export const withDerivedStatusFlags = (book: RemixerSubPage[]): RemixerSubPage[] =>
  book.map((page) => {
    const placementChanged =
      page.addedItem === true
        ? false
        : page.originalPathNumber
          ? !arePathNumbersEqual(page.originalPathNumber, page.pathNumber)
          : false;
    return {
      ...page,
      movedItem: placementChanged,
      isDeleted: page.deletedItem === true,
      isImported: page.addedItem === true,
      isRenamed: page.renamedItem === true,
      isPlacementChanged: placementChanged,
    };
  });

// ---------------------------------------------------------------------------
// Matter node helpers
// ---------------------------------------------------------------------------

export const isMatterNode = (node: RemixerSubPage): boolean =>
  isFrontMatterNode(node) || isBackMatterNode(node);

export const isMatterBranchNode = (
  nodeId: string | undefined,
  book: RemixerSubPage[],
): boolean => {
  if (!nodeId) return false;
  const nodesById = new Map(book.map((node) => [node["@id"], node]));
  let currentId: string | undefined = nodeId;
  const visited = new Set<string>();
  while (currentId && currentId !== "-1" && !visited.has(currentId)) {
    visited.add(currentId);
    const node = nodesById.get(currentId);
    if (!node) return false;
    if (isMatterNode(node)) return true;
    currentId = node.parentID ?? "-1";
  }
  return false;
};

// ---------------------------------------------------------------------------
// Book depth
// ---------------------------------------------------------------------------

export const computeHighestPathLevel = (book: RemixerSubPage[]): number => {
  if (!book || book.length === 0) return 0;
  const nodesById = new Map(book.map((page) => [page["@id"], page]));
  const depthById = new Map<string, number>();
  const visiting = new Set<string>();

  const computeDepth = (nodeId: string): number => {
    if (depthById.has(nodeId)) return depthById.get(nodeId) as number;
    if (visiting.has(nodeId)) return 0; // guard against cyclic refs
    visiting.add(nodeId);
    const node = nodesById.get(nodeId);
    if (!node) {
      visiting.delete(nodeId);
      return 0;
    }
    const parentId = node.parentID ?? "-1";
    const depth =
      parentId === "-1" || !nodesById.has(parentId)
        ? 0
        : computeDepth(parentId) + 1;
    visiting.delete(nodeId);
    depthById.set(nodeId, depth);
    return depth;
  };

  return Math.max(...book.map((page) => computeDepth(page["@id"])));
};

// ---------------------------------------------------------------------------
// Book mutation helpers (pure — return new arrays, no side effects)
// ---------------------------------------------------------------------------

export const applyBookNodeDeletion = (
  existingBookNodes: RemixerSubPage[],
  selectedNodeId: string,
): RemixerSubPage[] => {
  const childMap = new Map<string, string[]>();
  existingBookNodes.forEach((node) => {
    const parentId = node.parentID ?? "-1";
    const siblings = childMap.get(parentId) ?? [];
    siblings.push(node["@id"]);
    childMap.set(parentId, siblings);
  });

  const toDelete = new Set<string>();
  const queue: string[] = [selectedNodeId];
  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId || toDelete.has(nodeId)) continue;
    toDelete.add(nodeId);
    (childMap.get(nodeId) ?? []).forEach((childId) => queue.push(childId));
  }

  const withDeleted = existingBookNodes.map((node) =>
    toDelete.has(node["@id"]) ? { ...node, deletedItem: true } : node,
  );

  const activeChildrenByParent = new Set<string>();
  withDeleted.forEach((node) => {
    if (!node.deletedItem && node.parentID) {
      activeChildrenByParent.add(node.parentID);
    }
  });

  return withDeleted.map((node) =>
    !node.deletedItem
      ? { ...node, "@subpages": activeChildrenByParent.has(node["@id"]) }
      : node,
  );
};

const isDescendant = (
  nodeId: string,
  ancestorId: string,
  nodesById: Map<string, RemixerSubPage>,
): boolean => {
  let currentParentId = nodesById.get(nodeId)?.parentID ?? "-1";
  const visited = new Set<string>();
  while (currentParentId && currentParentId !== "-1" && !visited.has(currentParentId)) {
    if (currentParentId === ancestorId) return true;
    visited.add(currentParentId);
    currentParentId = nodesById.get(currentParentId)?.parentID ?? "-1";
  }
  return false;
};

export const reorderBookNodes = ({
  existingBook,
  draggedNodeId,
  targetNodeId,
  position,
}: {
  existingBook: RemixerSubPage[];
  draggedNodeId: string;
  targetNodeId: string;
  position: DropPosition;
}): RemixerSubPage[] => {
  if (draggedNodeId === targetNodeId) return existingBook;
  const nodesById = new Map(existingBook.map((node) => [node["@id"], node]));
  const draggedNode = nodesById.get(draggedNodeId);
  const targetNode = nodesById.get(targetNodeId);
  if (!draggedNode || !targetNode) return existingBook;

  const targetParentId =
    position === "inside" ? targetNodeId : targetNode.parentID ?? "-1";
  if (!targetParentId || targetParentId === draggedNodeId) return existingBook;
  if (isDescendant(targetParentId, draggedNodeId, nodesById)) return existingBook;

  const withUpdatedParent = existingBook.map((node) =>
    node["@id"] === draggedNodeId ? { ...node, parentID: targetParentId } : node,
  );

  const siblingNodes = withUpdatedParent.filter(
    (node) => (node.parentID ?? "-1") === targetParentId,
  );
  const siblingMap = new Map(
    siblingNodes.map((siblingNode) => [siblingNode["@id"], siblingNode]),
  );
  const siblingIds = siblingNodes
    .map((siblingNode) => siblingNode["@id"])
    .filter((siblingId) => siblingId !== draggedNodeId);
  const targetIndex = siblingIds.indexOf(targetNodeId);
  const insertIndex =
    position === "before"
      ? Math.max(targetIndex, 0)
      : position === "after"
        ? targetIndex >= 0
          ? targetIndex + 1
          : siblingIds.length
        : siblingIds.length;

  const orderedSiblingIds = [...siblingIds];
  orderedSiblingIds.splice(insertIndex, 0, draggedNodeId);

  const orderedSiblings = orderedSiblingIds
    .map((siblingId) => siblingMap.get(siblingId))
    .filter(Boolean) as RemixerSubPage[];

  const reordered: RemixerSubPage[] = [];
  let insertedSiblings = false;
  withUpdatedParent.forEach((bookNode) => {
    if ((bookNode.parentID ?? "-1") === targetParentId) {
      if (!insertedSiblings) {
        reordered.push(...orderedSiblings);
        insertedSiblings = true;
      }
      return;
    }
    reordered.push(bookNode);
  });
  if (!insertedSiblings) {
    reordered.push(...orderedSiblings);
  }
  return reordered;
};

export const insertAtSiblingPosition = ({
  bookNodes,
  importedRootId,
  targetNodeId,
  position,
  targetParentId,
}: {
  bookNodes: RemixerSubPage[];
  importedRootId: string;
  targetNodeId: string;
  position: DropPosition;
  targetParentId: string;
}): RemixerSubPage[] => {
  if (position === "inside") return bookNodes;

  const siblingNodes = bookNodes.filter(
    (bookNode) => (bookNode.parentID ?? "-1") === targetParentId,
  );
  const siblingMap = new Map(
    siblingNodes.map((siblingNode) => [siblingNode["@id"], siblingNode]),
  );
  const siblingIds = siblingNodes
    .map((siblingNode) => siblingNode["@id"])
    .filter((siblingId) => siblingId !== importedRootId);
  const targetIndex = siblingIds.indexOf(targetNodeId);
  const insertIndex =
    position === "before"
      ? Math.max(targetIndex, 0)
      : targetIndex >= 0
        ? targetIndex + 1
        : siblingIds.length;

  const orderedSiblingIds = [...siblingIds];
  orderedSiblingIds.splice(insertIndex, 0, importedRootId);

  const orderedSiblings = orderedSiblingIds
    .map((siblingId) => siblingMap.get(siblingId))
    .filter(Boolean) as RemixerSubPage[];

  const reordered: RemixerSubPage[] = [];
  let insertedSiblings = false;
  bookNodes.forEach((bookNode) => {
    if ((bookNode.parentID ?? "-1") === targetParentId) {
      if (!insertedSiblings) {
        reordered.push(...orderedSiblings);
        insertedSiblings = true;
      }
      return;
    }
    reordered.push(bookNode);
  });
  if (!insertedSiblings) {
    reordered.push(...orderedSiblings);
  }
  return reordered;
};
