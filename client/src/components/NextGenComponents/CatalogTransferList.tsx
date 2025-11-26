import React, { useMemo, useRef, useState } from "react";
import { Button, Checkbox } from "semantic-ui-react";
import {
  Book,
  BooksManagerSortOptions,
  GenericKeyTextValueObj,
  MasterCatalogV2Response,
} from "../../types";
import {
  IconBook,
  IconBooks,
  IconChevronDown,
  IconChevronRight,
  IconDotsVertical,
  IconLibrary,
  IconSchool,
  IconSearch,
} from "@tabler/icons-react";
import { getLibraryName } from "../util/LibraryOptions";
import Input from "../NextGenInputs/Input";
import useDebounce from "../../hooks/useDebounce";
import Combobox from "../NextGenInputs/Combobox";
import {
  BOOKS_MANAGER_SORT_OPTIONS,
  filterBooksBySearchTerm,
  sortBooks,
} from "../../utils/booksManagerHelpers";
import classNames from "classnames";
import { useVirtualizer } from "@tanstack/react-virtual";

// Internal node types for the tree structure
type NodeType = "library" | "course" | "subject" | "book";

interface TreeNode<T extends Book = Book> {
  id: string;
  type: NodeType;
  label: string;
  book?: T; // Only populated for book nodes
  children?: TreeNode<T>[];
  selectable: boolean; // Only books are selectable
}

interface CatalogTransferListProps<T extends Book = Book> {
  availableData: MasterCatalogV2Response;
  selectedBooks: T[];
  onSelectedBooksChange: (books: T[]) => void;
  bookActions?: Array<{
    label: string;
    icon?: React.ReactNode;
    onClick: (book: T) => void;
  }>;
  renderBook?: (book: T) => React.ReactNode;
  selectedTitle?: string;
  availableTitle?: string;
  transferDisabled?: boolean;
  flattenSelected?: boolean;
  className?: string;
}

function CatalogTransferList<T extends Book = Book>({
  availableData,
  selectedBooks,
  onSelectedBooksChange,
  bookActions = [],
  renderBook,
  selectedTitle = "Selected Books",
  availableTitle = "Available Books",
  transferDisabled = false,
  flattenSelected = true,
  className,
}: CatalogTransferListProps<T>) {
  const { debounce } = useDebounce();
  const availableListParentRef = useRef<HTMLDivElement>(null);
  const selectedListParentRef = useRef<HTMLDivElement>(null);
  const [checkedBookIds, setCheckedBookIds] = useState<string[]>([]);
  const [expandedAvailable, setExpandedAvailable] = useState<Set<string>>(
    new Set()
  );
  const [expandedSelected, setExpandedSelected] = useState<Set<string>>(
    new Set()
  );
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [allExpanded, setAllExpanded] = useState(false);

  const [availableSearchTerm, setAvailableSearchTerm] = useState("");
  const [selectedSearchTerm, setSelectedSearchTerm] = useState("");
  const [availableSearchTermUI, setAvailableSearchTermUI] = useState(""); // input UI changes immediately, but actual search term is debounced
  const [selectedSearchTermUI, setSelectedSearchTermUI] = useState("");
  const [availableSortOption, setAvailableSortOption] =
    useState<BooksManagerSortOptions>("title_asc");
  const [selectedSortOption, setSelectedSortOption] =
    useState<BooksManagerSortOptions>("title_asc");

  const debouncedSetAvailableSearchTerm = debounce(
    (newTerm: string) => setAvailableSearchTerm(newTerm),
    400
  );
  const debouncedSetSelectedSearchTerm = debounce(
    (newTerm: string) => setSelectedSearchTerm(newTerm),
    400
  );

  // Convert catalog data to tree structure for "Available" side
  const buildAvailableTree = (
    catalog: MasterCatalogV2Response,
    sort: BooksManagerSortOptions = "title_asc"
  ): TreeNode<T>[] => {
    const nodes = catalog.libraries.map((library) => {
      const libraryNode: TreeNode<T> = {
        id: `lib-${library.library}`,
        type: "library",
        label: getLibraryName(library.library),
        selectable: false,
        children: [],
      };

      // Add courses
      const courseNodes: TreeNode<T>[] = library.courses.map((course) => ({
        id: `course-${library.library}-${course.course}`,
        type: "course",
        label: course.course,
        selectable: false,
        children: sortBooks(course.books, sort)
          .filter(
            (book) => !selectedBooks.some((sb) => sb.bookID === book.bookID)
          )
          .map((book) => ({
            id: book.bookID,
            type: "book",
            label: book.title,
            book: book as T,
            selectable: true,
          })),
      }));

      // Add subjects
      const subjectNodes: TreeNode<T>[] = library.subjects.map((subject) => ({
        id: `subject-${library.library}-${subject.subject}`,
        type: "subject",
        label: subject.subject,
        selectable: false,
        children: sortBooks(subject.books, sort)
          .filter(
            (book) => !selectedBooks.some((sb) => sb.bookID === book.bookID)
          )
          .map((book) => ({
            id: book.bookID,
            type: "book",
            label: book.title,
            book: book as T,
            selectable: true,
          })),
      }));

      // Filter out empty course/subject nodes
      libraryNode.children = [
        ...courseNodes.filter((c) => c.children && c.children.length > 0),
        ...subjectNodes.filter((s) => s.children && s.children.length > 0),
      ];

      return libraryNode;
    });
    // Filter out libraries with no children
    return nodes.filter((lib) => lib.children && lib.children.length > 0);
  };

  // Build tree structure for "Selected" side
  const buildSelectedTree = (
    catalog: MasterCatalogV2Response,
    selectedBooks: T[],
    sort: BooksManagerSortOptions = "title_asc"
  ): TreeNode<T>[] => {
    if (flattenSelected) {
      return sortBooks(selectedBooks, sort).map((book) => ({
        id: book.bookID,
        type: "book" as const,
        label: book.title,
        book: book as T,
        selectable: true,
      }));
    }

    return catalog.libraries
      .map((library) => {
        const libraryNode: TreeNode<T> = {
          id: `lib-selected-${library.library}`,
          type: "library",
          label: getLibraryName(library.library),
          selectable: false,
          children: [],
        };

        // Add courses with only selected books
        const courseNodes: TreeNode<T>[] = library.courses
          .map((course) => ({
            id: `course-selected-${library.library}-${course.course}`,
            type: "course" as const,
            label: course.course,
            selectable: false,
            children: sortBooks(course.books, sort)
              .filter((book) =>
                selectedBooks.some((sb) => sb.bookID === book.bookID)
              )
              .map((book) => ({
                id: book.bookID,
                type: "book" as const,
                label: book.title,
                book: book as T,
                selectable: true,
              })),
          }))
          .filter((c) => c.children && c.children.length > 0);

        // Add subjects with only selected books
        const subjectNodes: TreeNode<T>[] = library.subjects
          .map((subject) => ({
            id: `subject-selected-${library.library}-${subject.subject}`,
            type: "subject" as const,
            label: subject.subject,
            selectable: false,
            children: sortBooks(subject.books, sort)
              .filter((book) =>
                selectedBooks.some((sb) => sb.bookID === book.bookID)
              )
              .map((book) => ({
                id: book.bookID,
                type: "book" as const,
                label: book.title,
                book: book as T,
                selectable: true,
              })),
          }))
          .filter((s) => s.children && s.children.length > 0);

        libraryNode.children = [...courseNodes, ...subjectNodes];

        return libraryNode;
      })
      .filter((lib) => lib.children && lib.children.length > 0);
  };

  const availableTree = useMemo(() => {
    const filteredCatalog = filterBooksBySearchTerm(
      availableData,
      availableSearchTerm
    );
    return buildAvailableTree(filteredCatalog, availableSortOption);
  }, [availableData, selectedBooks, availableSearchTerm, availableSortOption]);

  const selectedTree = useMemo(() => {
    const filteredSelectedBooks = filterBooksBySearchTerm(
      selectedBooks,
      selectedSearchTerm
    );
    return buildSelectedTree(
      availableData,
      filteredSelectedBooks,
      selectedSortOption
    );
  }, [availableData, selectedBooks, selectedSearchTerm, selectedSortOption]);

  const selectedTreeVirtualizer = useVirtualizer({
    count: selectedTree.length,
    getScrollElement: () => selectedListParentRef.current,
    estimateSize: () => 65,
  });

  // Get all selectable books from tree
  const getAllBooks = (nodes: TreeNode<T>[]): T[] => {
    const books: T[] = [];
    const traverse = (node: TreeNode<T>) => {
      if (node.type === "book" && node.book) {
        books.push(node.book);
      }
      if (node.children) {
        node.children.forEach(traverse);
      }
    };
    nodes.forEach(traverse);
    return books;
  };

  const allAvailableBooks = getAllBooks(availableTree);
  const checkedAvailableBooks = allAvailableBooks.filter((book) =>
    checkedBookIds.includes(book.bookID)
  );
  const checkedSelectedBooks = selectedBooks.filter((book) =>
    checkedBookIds.includes(book.bookID)
  );

  const handleCheckedRight = () => {
    const newSelected = [
      ...selectedBooks,
      ...checkedAvailableBooks.filter(
        (book) => !selectedBooks.some((sb) => sb.bookID === book.bookID)
      ),
    ] as T[];
    onSelectedBooksChange(newSelected);
    setCheckedBookIds(
      checkedBookIds.filter(
        (id) => !checkedAvailableBooks.some((book) => book.bookID === id)
      )
    );
  };

  const handleCheckedLeft = () => {
    const newSelected = selectedBooks.filter(
      (book) => !checkedSelectedBooks.some((cb) => cb.bookID === book.bookID)
    );
    onSelectedBooksChange(newSelected);
    setCheckedBookIds(
      checkedBookIds.filter(
        (id) => !checkedSelectedBooks.some((book) => book.bookID === id)
      )
    );
  };

  const handleCheckItem = (bookId: string) => {
    setCheckedBookIds((prev) =>
      prev.includes(bookId)
        ? prev.filter((id) => id !== bookId)
        : [...prev, bookId]
    );
  };

  const toggleExpand = (nodeId: string, isAvailable: boolean) => {
    const setter = isAvailable ? setExpandedAvailable : setExpandedSelected;
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const toggleExpandAll = (expand: boolean) => {
    setAllExpanded(expand);
    setExpandedAvailable((prev) => {
      const next = new Set(prev);
      const allNodes = availableTree;
      const traverse = (nodes: TreeNode<T>[]) => {
        nodes.forEach((node) => {
          if (node.children && node.children.length > 0) {
            if (expand) {
              next.add(node.id);
            } else {
              next.delete(node.id);
            }
            traverse(node.children);
          }
        });
      };
      traverse(allNodes);
      return next;
    });
    setExpandedSelected((prev) => {
      const next = new Set(prev);
      const allNodes = selectedTree;
      const traverse = (nodes: TreeNode<T>[]) => {
        nodes.forEach((node) => {
          if (node.children && node.children.length > 0) {
            if (expand) {
              next.add(node.id);
            } else {
              next.delete(node.id);
            }
            traverse(node.children);
          }
        });
      };
      traverse(allNodes);
      return next;
    });
  };

  const getNodeIcon = (type: NodeType) => {
    switch (type) {
      case "library":
        return <IconLibrary size={16} />;
      case "course":
        return <IconSchool size={16} />;
      case "subject":
        return <IconBooks size={16} />;
      case "book":
        return <IconBook size={16} />;
    }
  };

  const renderNode = (
    node: TreeNode<T>,
    isAvailable: boolean,
    depth: number = 0,
    virtualizedProps?: {
      key: string | number | bigint;
      size: number;
      start: number;
    }
  ): React.ReactNode => {
    const hasChildren = node.children && node.children.length > 0;
    const expandedSet = isAvailable ? expandedAvailable : expandedSelected;
    const isExpanded = expandedSet.has(node.id);
    const isChecked = node.book
      ? checkedBookIds.includes(node.book.bookID)
      : false;

    return (
      <div
        key={virtualizedProps?.key ?? node.id}
        style={
          virtualizedProps
            ? {
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: virtualizedProps.size,
                transform: `translateY(${virtualizedProps.start}px)`,
              }
            : undefined
        }
      >
        <div
          className={`flex flex-row items-center px-2 py-3 hover:bg-gray-100 group relative cursor-pointer ${
            ["library", "course", "subject"].includes(node.type)
              ? "font-semibold"
              : ""
          }`}
          style={{
            paddingLeft: `${
              flattenSelected && !isAvailable ? 0 : depth * 20 + 8
            }px`,
          }}
          onClick={() => {
            if (node.selectable && node.book) {
              handleCheckItem(node.book.bookID);
            } else {
              toggleExpand(node.id, isAvailable);
            }
          }}
        >
          {hasChildren ? (
            <div className="mr-1 p-0.5 hover:bg-gray-200 rounded">
              {isExpanded ? (
                <IconChevronDown size={16} />
              ) : (
                <IconChevronRight size={16} />
              )}
            </div>
          ) : (
            <span className="w-5 mr-1" />
          )}

          {/* Checkbox - only for selectable books */}
          {node.selectable ? (
            <Checkbox
              checked={isChecked}
              onChange={(e) => {
                e.stopPropagation();
                if (!node.book) return;
                handleCheckItem(node.book.bookID);
              }}
              className="mr-3"
            />
          ) : (
            <span className="w-1 mr-1" />
          )}

          {/* Node icon */}
          <span className="mr-2 text-base">{getNodeIcon(node.type)}</span>

          {/* Node label */}
          <span className="flex-1 text-lg tracking-wide">
            {node.book && renderBook ? renderBook(node.book) : node.label}
          </span>

          {/* Context menu for books */}
          {node.selectable && node.book && bookActions.length > 0 && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenu(
                    activeMenu === node.book!.bookID ? null : node.book!.bookID
                  );
                }}
                className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 rounded transition-opacity"
              >
                <IconDotsVertical size={20} />
              </button>

              {activeMenu === node.book.bookID && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setActiveMenu(null)}
                  />
                  <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-20 min-w-[150px]">
                    {bookActions.map((action, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          action.onClick(node.book!);
                          setActiveMenu(null);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-sm"
                      >
                        {action.icon}
                        {action.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Render children if expanded */}
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map((child) =>
              renderNode(
                child,
                isAvailable,
                depth + 1,
                virtualizedProps
                  ? {
                      ...virtualizedProps,
                      start: virtualizedProps.start + virtualizedProps.size,
                    }
                  : undefined
              )
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={classNames("flex flex-col w-full mb-4", className)}>
      <div className="flex flex-row gap-4">
        <div className="flex flex-col flex-1">
          <div className="flex items-center justify-between mb-1">
            <p className="font-bold text-gray-700">{availableTitle}</p>
            <span className="text-sm text-gray-500">
              {allAvailableBooks.length} books
            </span>
          </div>
          <div className="flex mb-2 gap-2 items-center">
            <Input
              name="availableSearch"
              placeholder="Search by title, author, ID, or URL..."
              label=""
              className="w-3/4"
              leftIcon={<IconSearch size={16} />}
              value={availableSearchTermUI}
              onChange={(e) => {
                setAvailableSearchTermUI(e.target.value);
                debouncedSetAvailableSearchTerm(e.target.value);
              }}
            />
            <Combobox
              name="availableSort"
              label=""
              placeholder="Sort by..."
              items={BOOKS_MANAGER_SORT_OPTIONS}
              multiple={false}
              value={availableSortOption}
              onChange={(newVal) =>
                setAvailableSortOption(newVal as BooksManagerSortOptions)
              }
              className="mt-1.5 w-1/4"
            />
          </div>
          <div className="flex flex-col border border-gray-300 rounded-lg max-h-[55vh] overflow-auto bg-white shadow-sm">
            {availableTree.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                No books available
              </div>
            ) : (
              availableTree.map((node) => renderNode(node, true))
            )}
          </div>
        </div>
        <div className="flex flex-col justify-center items-center gap-2 py-8">
          <Button
            icon="angle right"
            onClick={handleCheckedRight}
            disabled={checkedAvailableBooks.length === 0 || transferDisabled}
            size="medium"
            title={`Move ${checkedAvailableBooks.length} checked books to selected`}
          />
          <Button
            icon="angle left"
            onClick={handleCheckedLeft}
            disabled={checkedSelectedBooks.length === 0 || transferDisabled}
            size="medium"
            title={`Move ${checkedSelectedBooks.length} checked books to available`}
          />
          <Button
            icon={allExpanded ? "compress" : "expand"}
            onClick={() => toggleExpandAll(!allExpanded)}
            disabled={availableTree.length === 0}
            size="medium"
            title="Expand or Collapse All"
          />
        </div>
        <div className="flex flex-col flex-1 mb-2">
          <div className="flex items-center justify-between mb-1">
            <p className="font-bold text-gray-700">{selectedTitle}</p>
            <span className="text-sm text-gray-500">
              {selectedBooks.length} books
            </span>
          </div>
          <div className="flex mb-2 gap-2 items-center">
            <Input
              name="selectedSearch"
              placeholder="Search by title, author, ID, or URL..."
              label=""
              leftIcon={<IconSearch size={16} />}
              value={selectedSearchTermUI}
              onChange={(e) => {
                setSelectedSearchTermUI(e.target.value);
                debouncedSetSelectedSearchTerm(e.target.value);
              }}
              className="w-3/4"
            />
            <Combobox
              name="selectedSort"
              label=""
              placeholder="Sort by..."
              items={BOOKS_MANAGER_SORT_OPTIONS}
              multiple={false}
              value={selectedSortOption}
              onChange={(newVal) =>
                setSelectedSortOption(newVal as BooksManagerSortOptions)
              }
              className="mt-1.5 w-1/4"
            />
          </div>
          <div
            ref={selectedListParentRef}
            className="flex flex-col border border-gray-300 rounded-lg max-h-[55vh] overflow-auto bg-white shadow-sm"
          >
            <div
              style={{
                height: `${selectedTreeVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {selectedTree.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                  No books selected
                </div>
              ) : (
                selectedTreeVirtualizer
                  .getVirtualItems()
                  .map((item) =>
                    renderNode(selectedTree[item.index], false, undefined, item)
                  )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CatalogTransferList;
