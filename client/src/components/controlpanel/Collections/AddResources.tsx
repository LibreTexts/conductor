import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  FC,
  ReactElement,
} from "react";
import {
  Form,
  Modal,
  Button,
  Icon,
  Input,
  Message,
  Table,
  Image,
  Segment,
  Grid,
  Dropdown,
  Pagination,
  Checkbox,
  PaginationProps,
} from "semantic-ui-react";
import axios from "axios";

import {
  isEmptyString,
  isEmptyArray,
  basicArraysEqual,
} from "../../util/HelperFunctions.js";
import { getLicenseText } from "../../util/LicenseOptions.js";
import { getLibGlyphURL, getLibraryName } from "../../util/LibraryOptions.js";
import useGlobalError from "../../error/ErrorHooks.js";
import { Book, Collection, CollectionLocations } from "../../../types";
import { itemsPerPageOptions } from "../../util/PaginationOptions.js";

type AddResourcesProps = {
  show: boolean;
  onCloseFunc: () => void;
  collectionToEdit?: Collection;
};
const AddResources: FC<AddResourcesProps> = ({
  show,
  onCloseFunc,
  collectionToEdit,
}): ReactElement => {
  const SORT_OPTIONS = [
    { key: "title", text: "Sort by Title", value: "title" },
    { key: "author", text: "Sort by Author", value: "author" },
  ];

  const COLUMNS = [
    { key: "select", text: "Selected" },
    { key: "title", text: "Title" },
    { key: "lib", text: "Library" },
    { key: "author", text: "Author" },
    { key: "license", text: "License" },
    { key: "affiliation", text: "Affiliation" },
    { key: "course", text: "Course" },
  ];
  const { handleGlobalError } = useGlobalError();

  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [pageBooks, setPageBooks] = useState<Book[]>([]);

  // UI
  const [activePage, setActivePage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<string>("");
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [searchString, setSearchString] = useState<string>("");
  const [sortChoice, setSortChoice] = useState<string>("title");

  /**
   * Retrieve the master catalog from the server and save it into state.
   */
  const getBooks = useCallback(async () => {
    setLoadingData(true);
    let params = {
      sort: "",
      search: "",
    };
    if (!isEmptyString(sortChoice)) {
      params.sort = sortChoice;
    }
    if (!isEmptyString(searchString)) {
      params.search = searchString;
    }
    try {
      const catalogRes = await axios.get("/commons/mastercatalog", {
        params,
      });
      if (!catalogRes.data.err) {
        if (Array.isArray(catalogRes.data.books)) {
          setTotalItems(Number(catalogRes.data.books.length).toLocaleString());
          setBooks(catalogRes.data.books);
          setLoadingData(false);
        }
      } else {
        handleGlobalError(catalogRes.data.errMsg);
      }
    } catch (e) {
      handleGlobalError(e);
    }
    setLoadingData(false);
  }, [
    sortChoice,
    searchString,
    setBooks,
    setTotalItems,
    setLoadingData,
    handleGlobalError,
  ]);

  /**
   * Send a new query when the sort option or search string change and when modal opens
   */
  useEffect(() => {
    if (!show) return;
    getBooks();
  }, [show, searchString, sortChoice, getBooks]);

  /**
   * Update the set of books to display when the number of books loaded or
   * pagination options change.
   */
  useEffect(() => {
    setTotalPages(Math.ceil(books.length / itemsPerPage));
    setPageBooks(
      books.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage)
    );
  }, [books, itemsPerPage, activePage, setTotalPages, setPageBooks]);

  /**
   * Sends a request to the server to add a Book to a Collection, then closes the Add
   * Resources modal.
   */
  async function submitAddToCollection() {
    if (
      collectionToEdit &&
      !isEmptyString(collectionToEdit.collID) &&
      !isEmptyArray(selectedBooks)
    ) {
      setLoading(true);
      try {
        const addRes = await axios.post(`/commons/collection/${collectionToEdit.collID}/resources`, {
          books: selectedBooks,
        });
        if (!addRes.data.err) {
          setLoading(false);
          handleCloseModal();
        } else {
          handleGlobalError(addRes.data.errMsg);
        }
      } catch (e) {
        handleGlobalError(e);
      }
      setLoading(false);
      handleCloseModal();
    } else {
      handleCloseModal();
    }
  }

  /**
   * Updates the Sort Choice in state.
   *
   * @param {React.ChangeEvent} _e - The event that activated the handler.
   * @param {object} data - Data passed from the calling component.
   * @param {string} data.value - The new sort choice value.
   */
  function handleSortChoiceChange(_e: any, value: string) {
    setSortChoice(value);
  }

  /**
   * Updates the Search String in state.
   *
   * @param {React.ChangeEvent} e - The event that activated the handler.
   */
  function handleSearchStringChange(e: any) {
    setSearchString(e.target.value);
  }

  /**
   * Updates the Items per Page selection in state.
   *
   * @param {React.ChangeEvent} _e - The event that activated the handler.
   * @param {object} data - Data passed from the calling component.
   * @param {number} data.value - The new items per page selection.
   */
  function handleItemsPerPageChange(_e: any, value: number) {
    setItemsPerPage(value);
  }

  /**
   * Updates the Active Page selection in state.
   *
   * @param {React.ChangeEvent} _e - The event that activated the handler.
   * @param {object} data - Data passed from the calling component.
   */
  function handleActivePageChange(_e: any, data: PaginationProps) {
    if (data.activePage && typeof data.activePage === "number") {
      return setActivePage(data.activePage);
    }
    setActivePage(1);
  }

  function handleBookSelect(bookID: string) {
    if (selectedBooks.includes(bookID)) {
      selectedBooks.splice(selectedBooks.indexOf(bookID));
    } else {
      selectedBooks.push(bookID);
    }
  }

  /**
   * Resets state and triggers modal close
   */
  function handleCloseModal() {
    setSearchString("");
    setActivePage(1);
    setItemsPerPage(10);
    setSortChoice("title");
    setSelectedBooks([]);
    onCloseFunc();
  }

  /**
   * Renders a row for a Book in the catalog table with potential actions.
   *
   * @param {object} data - Data to use in rendering.
   * @param {object} data.book - Information about the Book returned from the server.
   * @returns {React.ReactElement} The rendered table row.
   */
  function BookRow({ book, ...props }: { book: Book }) {
    const libName = getLibraryName(book.library);
    const libGlyphURL = getLibGlyphURL(book.library);
    const licText = getLicenseText(book.license);
    return (
      <Table.Row {...props}>
        <Table.Cell>
          <Checkbox onChange={() => handleBookSelect(book.bookID)} />
        </Table.Cell>
        <Table.Cell>
          <span>
            <strong>{book.title}</strong>
          </span>
        </Table.Cell>
        <Table.Cell>
          <Image src={libGlyphURL} className="library-glyph" />
          {libName}
        </Table.Cell>
        <Table.Cell>
          <span>{book.author}</span>
        </Table.Cell>
        <Table.Cell>
          <span>{licText}</span>
        </Table.Cell>
        <Table.Cell>
          <span>{book.affiliation}</span>
        </Table.Cell>
        <Table.Cell>
          <span>{book.course}</span>
        </Table.Cell>
        <Table.Cell textAlign="center">
          {book.links?.online ? (
            <Button
              color="blue"
              as="a"
              href={book.links.online}
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="external" />
              View
            </Button>
          ) : (
            <Button color="blue" disabled>
              <Icon name="external" />
              View
            </Button>
          )}
        </Table.Cell>
      </Table.Row>
    );
  }

  return (
    <Modal open={show} closeOnDimmerClick={false} size="fullscreen">
      <Modal.Header>Add Resource to Collection</Modal.Header>
      <Modal.Content>
        <p>
          <em>
            This resource will be added to{" "}
            <strong>{collectionToEdit?.title}</strong>.
          </em>
        </p>
        <Segment.Group>
          <Segment>
            <Grid>
              <Grid.Row>
                <Grid.Column width={11}>
                  <Dropdown
                    placeholder="Sort by..."
                    floating
                    selection
                    button
                    options={SORT_OPTIONS}
                    onChange={(e, { value }) =>
                      handleSortChoiceChange(e, value as string)
                    }
                    value={sortChoice}
                  />
                </Grid.Column>
                <Grid.Column width={5}>
                  <Input
                    icon="search"
                    placeholder="Search..."
                    onChange={handleSearchStringChange}
                    value={searchString}
                    fluid
                  />
                </Grid.Column>
              </Grid.Row>
            </Grid>
          </Segment>
          <Segment>
            <div className="flex-row-div">
              <div className="left-flex">
                <span>Displaying </span>
                <Dropdown
                  className="commons-content-pagemenu-dropdown"
                  selection
                  options={itemsPerPageOptions}
                  onChange={(e, { value }) =>
                    handleItemsPerPageChange(e, value as number)
                  }
                  value={itemsPerPage}
                />
                <span>
                  {" "}
                  items per page of <strong>{totalItems}</strong> results.
                </span>
              </div>
              <div className="right-flex">
                <Pagination
                  activePage={activePage}
                  totalPages={totalPages}
                  firstItem={null}
                  lastItem={null}
                  onPageChange={handleActivePageChange}
                />
              </div>
            </div>
          </Segment>
          <Segment loading={loadingData}>
            <Table striped celled fixed compact singleLine>
              <Table.Header>
                <Table.Row>
                  {COLUMNS.map((item) => (
                    <Table.HeaderCell key={item.key}>
                      {sortChoice === item.key ? (
                        <span>
                          <em>{item.text}</em>
                        </span>
                      ) : (
                        <span>{item.text}</span>
                      )}
                    </Table.HeaderCell>
                  ))}
                  <Table.HeaderCell>
                    <span>Actions</span>
                  </Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {pageBooks.length > 0 &&
                  pageBooks.map((item) => (
                    <BookRow book={item} key={item.bookID} />
                  ))}
                {pageBooks.length === 0 && (
                  <Table.Row>
                    <Table.Cell colSpan={8}>
                      <p className="text-center">
                        <em>No results found.</em>
                      </p>
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table>
          </Segment>
        </Segment.Group>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={handleCloseModal}>Cancel</Button>
        <Button color="green" onClick={submitAddToCollection} loading={loading}>
          <Icon name="add" />
          Add Resources
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default AddResources;
