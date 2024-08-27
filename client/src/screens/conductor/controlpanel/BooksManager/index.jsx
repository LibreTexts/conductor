import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Breadcrumb,
  Button,
  Dropdown,
  Grid,
  Header,
  Icon,
  Image,
  Input,
  Modal,
  Pagination,
  Segment,
  Table,
} from 'semantic-ui-react';
import { DeleteBookModal } from "../../../../components/controlpanel/BooksManager/DeleteBookModal";
import useGlobalError from '../../../../components/error/ErrorHooks';
import { useModals } from "../../../../context/ModalContext";
import { itemsPerPageOptions } from '../../../../components/util/PaginationOptions';
import { getLibGlyphURL, getLibraryName } from '../../../../components/util/LibraryOptions';
import { getLicenseText } from '../../../../components/util/LicenseOptions';
import { isEmptyString } from '../../../../components/util/HelperFunctions';
import '../../../../components/controlpanel/ControlPanel.css';

/**
 * The Books Manager interface allows administrators to manage the Books
 * displayed in their Campus Commons and add them to Collections.
 */
const BooksManager = () => {

  const SORT_OPTIONS = [
    { key: 'title', text: 'Sort by Title', value: 'title' },
    { key: 'author', text: 'Sort by Author', value: 'author' },
  ];

  const COLUMNS = [
    { key: 'title', text: 'Title' },
    { key: 'lib', text: 'Library' },
    { key: 'author', text: 'Author' },
    { key: 'license', text: 'License' },
    { key: 'affiliation', text: 'Affiliation' },
    { key: 'course', text: 'Course' },
  ];

  // Global State and Error Handling
  const org = useSelector((state) => state.org);
  const isSuperAdmin = useSelector((state) => state.user.isSuperAdmin);
  const { handleGlobalError } = useGlobalError();
  const { closeAllModals, openModal } = useModals();

  // Data
  const [syncResponse, setSyncResponse] = useState('');
  const [catalogBooks, setCatalogBooks] = useState([]);
  const [pageBooks, setPageBooks] = useState([]);

  // UI
  const [activePage, setActivePage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchString, setSearchString] = useState('');
  const [sortChoice, setSortChoice] = useState('title');
  const [loadedData, setLoadedData] = useState(false);

  // Sync Modal
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [syncFinished, setSyncFinished] = useState(false);

  // Enable/Disable on Commons Modal
  const [showEOCModal, setShowEOCModal] = useState(false);
  const [eocEnableMode, setEOCEnableMode] = useState(true);
  const [eocBookID, setEOCBookID] = useState('');
  const [eocBookTitle, setEOCBookTitle] = useState('');
  const [eocWorking, setEOCWorking] = useState(false);

  /**
   * Retrieve the master catalog from the server and save it into state.
   */
  const getBooks = useCallback(async () => {
    setLoadedData(false);
    let params = {};
    if (!isEmptyString(sortChoice)) {
      params.sort = sortChoice;
    }
    if (!isEmptyString(searchString)) {
      params.search = searchString;
    }
    try {
      const catalogRes = await axios.get('/commons/mastercatalog', {
        params,
      });
      if (!catalogRes.data.err) {
        if (Array.isArray(catalogRes.data.books)) {
          setTotalItems(Number(catalogRes.data.books.length).toLocaleString());
          setCatalogBooks(catalogRes.data.books);
        }
      } else {
        handleGlobalError(catalogRes.data.errMsg);
      }
    } catch (e) {
      handleGlobalError(e);
    }
    setLoadedData(true);
  }, [sortChoice, searchString, setCatalogBooks, setTotalItems, setLoadedData, handleGlobalError]);

  /**
   * Set page title on initial load.
   */
  useEffect(() => {
    document.title = "LibreTexts Conductor | Books Manager";
  }, []);

  /**
   * Send a new query when the sort option or search string change.
   */
  useEffect(() => {
    getBooks();
  }, [searchString, sortChoice, getBooks]);

  /**
   * Update the set of books to display when the number of books loaded or
   * pagination options change.
   */
  useEffect(() => {
    setTotalPages(Math.ceil(catalogBooks.length / itemsPerPage));
    setPageBooks(catalogBooks.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage));
  }, [catalogBooks, itemsPerPage, activePage, setTotalPages, setPageBooks]);

  /**
   * Send a Commons-to-Libraries sync request to the server, then refresh catalog when done.
   */
  async function syncWithLibs() {
    try {
      setSyncInProgress(true);
      const syncRes = await axios.post('/commons/syncwithlibs');
      if (!syncRes.data.err) {
        setSyncResponse(syncRes.data.msg);
        getBooks();
      } else {
        handleGlobalError(syncRes.data.errMsg);
      }
    } catch (e) {
      handleGlobalError(e);
    }
    setSyncInProgress(false);
    setSyncFinished(true);
  }

  /**
   * Open the Sync modal and ensure its state is reset.
   */
  function openSyncModal() {
    setShowSyncModal(true);
    setSyncInProgress(false);
    setSyncFinished(false);
    setSyncResponse('');
  };

  /**
   * Close the Sync modal and reset its state.
   */
  function closeSyncModal() {
    setShowSyncModal(false);
    setSyncInProgress(false);
    setSyncFinished(false);
    setSyncResponse('');
  }

  /**
   * Opens the Enable on Commons modal and saves mode setting and book information in sate.
   *
   * @param {string} mode - The mode to open the modal in, either 'enable' or 'disable'. 
   * @param {string} bookID - Identifier of the book to enable/disable. 
   * @param {string} bookTitle - Title of the book to work on. 
   */
  function openEOCModal(mode, bookID, bookTitle) {
    if (mode === 'enable') {
      setEOCEnableMode(true);
    } else {
      setEOCEnableMode(false);
    }
    setEOCBookID(bookID);
    setEOCBookTitle(bookTitle);
    setShowEOCModal(true);
  }

  /**
   * Closes the Enable on Commons modal and resets its state.
   */
  function closeEOCModal() {
    setShowEOCModal(false);
    setEOCBookID('');
    setEOCBookTitle('');
    setEOCWorking(false);
    setEOCEnableMode(true);
  }

  /**
   * Submits a request to enable/disable the book currently in state on Commons,
   * then closes the Enable on Commons modal.
   */
  async function submitEnableOnCommons() {
    try {
      setEOCWorking(true);
      let url = '';
      if (eocEnableMode) {
        url = '/commons/catalogs/addresource';
      } else {
        url = '/commons/catalogs/removeresource';
      }
      const eocRes = await axios.put(url, { bookID: eocBookID });
      if (!eocRes.data.err) {
        closeEOCModal();
        getBooks();
      } else {
        handleGlobalError(eocRes.data.errMsg);
      }
    } catch (e) {
      handleGlobalError(e);
    }
    setEOCWorking(false);
  }

  function closeDeleteModal() {
    closeAllModals();
    getBooks();
  }

  function openDeleteModal(bookID, bookTitle) {
    if (!bookID) return;

    openModal(
        <DeleteBookModal
            bookID={bookID}
            bookTitle={bookTitle}
            onClose={closeDeleteModal}
            open={true}
        />
    );
  }

  /**
   * Updates the Sort Choice in state.
   *
   * @param {React.ChangeEvent} _e - The event that activated the handler. 
   * @param {object} data - Data passed from the calling component.
   * @param {string} data.value - The new sort choice value. 
   */
  function handleSortChoiceChange(_e, { value }) {
    setSortChoice(value);
  }

  /**
   * Updates the Search String in state.
   *
   * @param {React.ChangeEvent} e - The event that activated the handler. 
   */
  function handleSearchStringChange(e) {
    setSearchString(e.target.value);
  }

  /**
   * Updates the Items per Page selection in state.
   *
   * @param {React.ChangeEvent} _e - The event that activated the handler. 
   * @param {object} data - Data passed from the calling component.
   * @param {number} data.value - The new items per page selection.
   */
  function handleItemsPerPageChange(_e, { value }) {
    setItemsPerPage(value);
  }

  /**
   * Updates the Active Page selection in state.
   *
   * @param {React.ChangeEvent} _e - The event that activated the handler.
   * @param {object} data - Data passed from the calling component.
   */
  function handleActivePageChange(_e, data) {
    setActivePage(data.activePage);
  }

  /**
   * Renders a button to Enable or Disable a book on Commons depending on the
   * Book's current state and the current Organization.
   *
   * @param {object} book - Information about the book context.
   * @returns {React.ReactElement} The rendered Button with attached handlers.
   */
  function renderEnableOnCommonsButton(book) {
    if (org.orgID === 'libretexts' || book.isCampusBook) {
      return (
        <Button color="green" disabled>
          <Icon name="eye" />
          Enabled by Default
        </Button>
      );
    }
    if (book.isCustomEnabled) {
      return (
        <Button color="red" onClick={() => openEOCModal('disable', book.bookID, book.title)}>
          <Icon name="eye slash" />
          Disable on Commons
        </Button>
      );
    }
    return (
      <Button color="green" onClick={() => openEOCModal('enable', book.bookID, book.title)}>
        <Icon name="eye" />
        Enable on Commons
      </Button>
    );
  }

  /**
   * Renders a row for a Book in the catalog table with potential actions.
   *
   * @param {object} data - Data to use in rendering.
   * @param {object} data.book - Information about the Book returned from the server. 
   * @returns {React.ReactElement} The rendered table row.
   */
  function BookRow({ book, ...props}) {
    const libName = getLibraryName(book.library);
    const libGlyphURL = getLibGlyphURL(book.library);
    const licText = getLicenseText(book.license);
    return (
      <Table.Row {...props}>
        <Table.Cell>
          <span><strong>{book.title}</strong></span>
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
          <Button.Group vertical fluid>
            {renderEnableOnCommonsButton(book)}
            {book.links?.online ? (
              <Button
                color="blue"
                as="a"
                href={book.links.online}
                target="_blank"
                rel="noreferrer"
              >
                <Icon name="external" />
                View on LibreTexts
              </Button>
            ) : (
              <Button color="blue" disabled>
                <Icon name="external" />
                View on LibreTexts
              </Button>
            )}
            {isSuperAdmin && (
                <Button
                    color="red"
                    onClick={() => openDeleteModal(book.bookID, book.title)}
                >
                  <Icon name="trash" />
                  Delete Book
                </Button>
            )}
          </Button.Group>
        </Table.Cell>
      </Table.Row>
    );
  }

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header">Books Manager</Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={16}>
          <Segment.Group>
            <Segment>
              <Breadcrumb>
                <Breadcrumb.Section as={Link} to="/controlpanel">
                  Control Panel
                </Breadcrumb.Section>
                <Breadcrumb.Divider icon="right chevron" />
                <Breadcrumb.Section active>
                  Books Manager
                </Breadcrumb.Section>
              </Breadcrumb>
            </Segment>
            <Segment>
              <div className="flex-row-div">
                <div className="left-flex">
                  <span className="ml-1p"><strong>Sync Schedule:</strong> Daily at 6:30 AM PST</span>
                </div>
                <div className="right-flex">
                  {(isSuperAdmin && org.orgID === 'libretexts') && (
                    <Button
                      color="blue"
                      onClick={openSyncModal}
                    >
                      <Icon name="sync alternate" />
                      Sync Commons with Libraries
                    </Button>
                  )}
                </div>
              </div>
            </Segment>
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
                      onChange={handleSortChoiceChange}
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
                    onChange={handleItemsPerPageChange}
                    value={itemsPerPage}
                  />
                  <span> items per page of <strong>{totalItems}</strong> results.</span>
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
            <Segment loading={!loadedData}>
              <Table striped celled fixed>
                <Table.Header>
                  <Table.Row>
                    {COLUMNS.map((item) => (
                      <Table.HeaderCell key={item.key}>
                        {(sortChoice === item.key) ? (
                          <span><em>{item.text}</em></span>
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
                  {(pageBooks.length > 0) &&
                    pageBooks.map((item) => <BookRow book={item} key={item.bookID} />)
                  }
                  {(pageBooks.length === 0) &&
                    <Table.Row>
                      <Table.Cell colSpan={7}>
                        <p className="text-center"><em>No results found.</em></p>
                      </Table.Cell>
                    </Table.Row>
                  }
                </Table.Body>
              </Table>
            </Segment>
          </Segment.Group>
          {/* Commons Sync Modal */}
          <Modal
            open={showSyncModal}
            closeOnDimmerClick={false}
          >
            <Modal.Header>Commons Sync</Modal.Header>
            <Modal.Content>
              <p><strong>Caution:</strong> you are about to manually sync Commons with the LibreTexts libraries. This operation is resource-intensive and should not be performed often.</p>
              <p><em>This may result in a brief service interruption while the database is updated.</em></p>
              {!syncFinished &&
                <Button
                  color="blue"
                  onClick={syncWithLibs}
                  fluid
                  loading={syncInProgress}
                >
                  <Icon name="sync alternate" />
                  Sync Commons with Libraries
                </Button>
              }
              {(syncInProgress) &&
                <p className="text-center mt-1p"><strong>Sync Status:</strong> <em>In progress...</em></p>
              }
              {(syncResponse !== "") &&
                <p className="text-center mt-1p"><strong>Sync Status:</strong> {syncResponse}</p>
              }
            </Modal.Content>
            <Modal.Actions>
              {!syncFinished &&
                <Button
                  onClick={closeSyncModal}
                  disabled={syncInProgress}
                >
                  Cancel
                </Button>
              }
              {syncFinished &&
                <Button
                  onClick={closeSyncModal}
                  disabled={syncInProgress}
                  color="blue"
                >
                  Done
                </Button>
              }
            </Modal.Actions>
          </Modal>
          {/* Enable/Disable on Commons Modal */}
          <Modal
            open={showEOCModal}
            closeOnDimmerClick={false}
          >
            <Modal.Header>
              {(eocEnableMode) ? 'Enable on Commons' : 'Disable on Commons'}
            </Modal.Header>
            <Modal.Content>
              {(eocEnableMode)
                ? (<p>Are you sure you want to enable <em>{eocBookTitle}</em> on your Campus Commons? It will appear in search results immediately.</p>)
                : (<p>Are you sure you want to disable <em>{eocBookTitle}</em> on your Campus Commons? It will be removed search results immediately.</p>)
              }
            </Modal.Content>
            <Modal.Actions>
              <Button
                onClick={closeEOCModal}
              >
                Cancel
              </Button>
              <Button
                color={eocEnableMode ? 'green' : 'red'}
                loading={eocWorking}
                onClick={submitEnableOnCommons}
              >
                <Icon name={eocEnableMode ? 'eye' : 'eye slash'} />
                {eocEnableMode ? 'Enable' : 'Disable'}
              </Button>
            </Modal.Actions>
          </Modal>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default BooksManager;
