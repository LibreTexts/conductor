import './ControlPanel.css';

import { DateInput } from 'semantic-ui-calendar-react';
import {
  Grid,
  Header,
  Image,
  Segment,
  Form,
  Table,
  Modal,
  Button,
  Dropdown,
  Icon,
  Pagination,
  Input,
  Breadcrumb
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';

import {
    isEmptyString,
    truncateString,
    capitalizeFirstLetter
} from '../util/HelperFunctions.js';
import {
    getLibGlyphURL,
    getLibraryName
} from '../util/LibraryOptions.js';
import { getLicenseText } from '../util/LicenseOptions.js';
import { itemsPerPageOptions } from '../util/PaginationOptions.js';
import {
    getTermTaught,
    buildAccessMethodsList
} from '../adoptionreport/AdoptionReportOptions.js';
import useGlobalError from '../error/ErrorHooks.js';

const BooksManager = (props) => {

    // Global State
    const { handleGlobalError } = useGlobalError();
    const isSuperAdmin = useSelector((state) => state.user.isSuperAdmin);

    // Data
    const [syncResponse, setSyncResponse] = useState('');
    const [catalogBooks, setCatalogBooks] = useState([]);
    const [pageBooks, setPageBooks] = useState([]);

    // UI
    const [activePage, setActivePage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [loadedData, setLoadedData] = useState(false);

    const [searchString, setSearchString] = useState('');
    const [sortChoice, setSortChoice] = useState('title');

    // Sync Modal
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [syncInProgress, setSyncInProgress] = useState(false);
    const [syncFinished, setSyncFinished] = useState(false);

    // Add to Collection Modal
    const [showATCModal, setShowATCModal] = useState(false);
    const [atcBookID, setATCBookID] = useState('');
    const [atcBookTitle, setATCBookTitle] = useState('');
    const [atcCollections, setATCCollections] = useState([]);
    const [atcCollectionID, setATCCollectionID] = useState('');
    const [atcCollectionErr, setATCCollectionErr] = useState(false);
    const [atcLoadedColls, setATCLoadedColls] = useState(false);
    const [atcFinishedAdd, setATCFinishedAdd] = useState(true);

    // Enable/Disable on Commons Modal
    const [showEOCModal, setShowEOCModal] = useState(false);
    const [eocEnableMode, setEOCEnableMode] = useState(true);
    const [eocBookID, setEOCBookID] = useState('');
    const [eocBookTitle, setEOCBookTitle] = useState('');
    const [eocWorking, setEOCWorking] = useState(false);

    const sortOptions = [
        { key: 'title', text: 'Sort by Title', value: 'title' },
        { key: 'author', text: 'Sort by Author', value: 'author' },
    ];

    /*
    { key: 'lib', text: 'Sort by Library', value: 'lib' },
    { key: 'license', text: 'Sort by License', value: 'license' },
    { key: 'institution', text: 'Sort by Institution', value: 'institution' },
    { key: 'course', text: 'Sort by Campus or Course', value: 'course' },
    { key: 'commons', text: 'Sort by Commons Status', value: 'commons'}
    */

    /**
     * Set page title and retrieve
     * books on initial load.
     */
    useEffect(() => {
        document.title = "LibreTexts Conductor | Books Manager";
        date.plugin(ordinal);
        getBooks();
    }, []);

    /**
     * Track changes to the number of books loaded
     * and the selected itemsPerPage and update the
     * set of books to display.
     */
    useEffect(() => {
        setTotalPages(Math.ceil(catalogBooks.length/itemsPerPage));
        setPageBooks(catalogBooks.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage));
    }, [itemsPerPage, catalogBooks, activePage]);

    /**
     * Send a new query to the server when the sort
     * option or the search string change.
     */
    useEffect(() => {
        getBooks();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchString, sortChoice]);

    /**
     * Retrieve the master Catalog from
     * the server.
     */
    const getBooks = () => {
        setLoadedData(false);
        var paramsObj = {};
        if (!isEmptyString(sortChoice)) {
            paramsObj.sort = sortChoice;
        }
        if (!isEmptyString(searchString)) {
            paramsObj.search = searchString;
        }
        axios.get('/commons/mastercatalog', {
            params: paramsObj
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.books && Array.isArray(res.data.books)) {
                    setCatalogBooks(res.data.books);
                }
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setLoadedData(true);
        }).catch((err) => {
            handleGlobalError(err);
            setLoadedData(true);
        });
    };

    /**
     * Set Sync loading indicators and
     * send a request to the server to
     * sync the Commons Catalog with
     * the live libraries.
     */
    const syncWithLibs = () => {
        setSyncInProgress(true);
        axios.post('/commons/syncwithlibs').then((res) => {
            if (!res.data.err) {
                setSyncResponse(res.data.msg);
                getBooks();
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setSyncInProgress(false);
            setSyncFinished(true);
        }).catch((err) => {
            handleGlobalError(err);
            setSyncInProgress(false);
            setSyncFinished(true);
        });
    }

    /**
     * Open the Sync modal and
     * ensure it is reset to
     * initial state.
     */
    const openSyncModal = () => {
        setShowSyncModal(true);
        setSyncInProgress(false);
        setSyncFinished(false);
        setSyncResponse('');
    };

    /**
     * Close the Sync modal and
     * reset to initial state.
     */
    const closeSyncModal = () => {
        setShowSyncModal(false);
        setSyncInProgress(false);
        setSyncFinished(false);
        setSyncResponse('');
    };

    const getATCCollections = (bookID) => {
        setATCLoadedColls(false);
        axios.get('/commons/collections/all', {
            params: {
                detailed: "true"
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.colls && Array.isArray(res.data.colls)) {
                    var collOptions = [
                        { key: '', text: 'Clear...', value: '' }
                    ];
                    res.data.colls.forEach((coll) => {
                        if (coll.resources && Array.isArray(coll.resources)) {
                            if (coll.resources.includes(bookID)) {
                                collOptions.push({
                                    key: coll.collID,
                                    text: `${coll.title} (Book is already in Collection)`,
                                    value: coll.collID,
                                    disabled: true
                                });
                            } else {
                                collOptions.push({
                                    key: coll.collID,
                                    text: coll.title,
                                    value: coll.collID
                                });
                            }
                        }
                    });
                    console.log(collOptions);
                    setATCCollections(collOptions);
                }
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setATCLoadedColls(true);
        }).catch((err) => {
            handleGlobalError(err);
            setATCLoadedColls(true);
        });
    };

    const submitATCForm = () => {
        setATCCollectionErr(false);
        if (!isEmptyString(atcCollectionID) && !isEmptyString(atcBookID)) {
            setATCFinishedAdd(false);
            var collData = {
                collID: atcCollectionID,
                bookID: atcBookID
            };
            axios.put('/commons/collection/addresource', collData).then((res) => {
                if (!res.data.err) {
                    closeATCModal();
                } else {
                    handleGlobalError(res.data.errMsg);
                }
                setATCFinishedAdd(true);
            }).catch((err) => {
                handleGlobalError(err);
                setATCFinishedAdd(true);
            });
        } else {
            setATCCollectionErr(true);
        }
    };

    const openATCModal = (bookID, bookTitle) => {
        if (!isEmptyString(bookID)) {
            setATCBookID(bookID);
            setATCBookTitle(bookTitle);
            setATCCollections([]);
            setATCCollectionID('');
            setATCCollectionErr(false);
            setATCLoadedColls(false);
            setATCFinishedAdd(true);
            setShowATCModal(true);
            getATCCollections(bookID);
        }
    };

    const closeATCModal = () => {
        setShowATCModal(false);
        setATCBookID('');
        setATCBookTitle('');
        setATCCollections([]);
        setATCCollectionErr(false);
        setATCLoadedColls(false);
        setATCFinishedAdd(true);
        setATCCollectionID('');
    };

    const submitEOCForm = () => {
        setEOCWorking(true);
        var url = '';
        if (eocEnableMode) {
            url = '/commons/catalogs/addresource';
        } else {
            url = '/commons/catalogs/removeresource';
        }
        axios.put(url, {
            bookID: eocBookID
        }).then((res) => {
            if (!res.data.error) {
                closeEOCModal();
                getBooks();
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setEOCWorking(false);
        }).catch((err) => {
            handleGlobalError(err);
            setEOCWorking(false);
        });
    };

    const openEOCModal = (mode, bookID, bookTitle) => {
        if (mode === 'enable') {
            setEOCEnableMode(true);
        } else if (mode === 'disable') {
            setEOCEnableMode(false);
        }
        setEOCBookID(bookID);
        setEOCBookTitle(bookTitle);
        setEOCWorking(false);
        setShowEOCModal(true);
    };

    const closeEOCModal = () => {
        setShowEOCModal(false);
        setEOCBookID('');
        setEOCBookTitle('');
        setEOCWorking(false);
        setEOCEnableMode(true);
    };

    return (
        <Grid className='controlpanel-container' divided='vertically'>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Header className='component-header'>Books Manager</Header>
                </Grid.Column>
            </Grid.Row>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Segment.Group>
                        <Segment>
                            <Breadcrumb>
                                <Breadcrumb.Section as={Link} to='/controlpanel'>
                                    Control Panel
                                </Breadcrumb.Section>
                                <Breadcrumb.Divider icon='right chevron' />
                                <Breadcrumb.Section active>
                                    Books Manager
                                </Breadcrumb.Section>
                            </Breadcrumb>
                        </Segment>
                        <Segment>
                            <div className='flex-row-div'>
                                <div className='left-flex'>
                                    <span className='mr-1p'><strong>Last Sync:</strong> Today</span>
                                    <span className='ml-1p'><strong>Next Sync:</strong> Today</span>
                                </div>
                                <div className='right-flex'>
                                    {isSuperAdmin &&
                                        <Button
                                            color='blue'
                                            onClick={openSyncModal}
                                        >
                                            <Icon name='sync alternate' />
                                            Sync Commons with Libraries
                                        </Button>
                                    }
                                </div>
                            </div>
                        </Segment>
                        <Segment>
                            <Grid>
                                <Grid.Row>
                                    <Grid.Column width={11}>
                                        <Dropdown
                                            placeholder='Sort by...'
                                            floating
                                            selection
                                            button
                                            options={sortOptions}
                                            onChange={(_e, { value }) => { setSortChoice(value) }}
                                            value={sortChoice}
                                        />
                                    </Grid.Column>
                                    <Grid.Column width={5}>
                                        <Input
                                            icon='search'
                                            placeholder='Search...'
                                            onChange={(e) => { setSearchString(e.target.value) }}
                                            value={searchString}
                                            fluid
                                        />
                                    </Grid.Column>
                                </Grid.Row>
                            </Grid>
                        </Segment>
                        <Segment>
                            <div className='flex-row-div'>
                                <div className='left-flex'>
                                    <span>Displaying </span>
                                    <Dropdown
                                        className='commons-content-pagemenu-dropdown'
                                        selection
                                        options={itemsPerPageOptions}
                                        onChange={(_e, { value }) => {
                                            setItemsPerPage(value);
                                        }}
                                        value={itemsPerPage}
                                    />
                                    <span> items per page of <strong>{Number(catalogBooks.length).toLocaleString()}</strong> results.</span>
                                </div>
                                <div className='right-flex'>
                                    <Pagination
                                        activePage={activePage}
                                        totalPages={totalPages}
                                        firstItem={null}
                                        lastItem={null}
                                        onPageChange={(_e, data) => {
                                            setActivePage(data.activePage)
                                        }}
                                    />
                                </div>
                            </div>
                        </Segment>
                        <Segment loading={!loadedData}>
                            <Table striped celled fixed>
                                <Table.Header>
                                    <Table.Row>
                                        <Table.HeaderCell>
                                            {(sortChoice === 'title')
                                                ? <span><em>Book Title</em></span>
                                                : <span>Book Title</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            {(sortChoice === 'lib')
                                                ? <span><em>Library</em></span>
                                                : <span>Library</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            {(sortChoice === 'author')
                                                ? <span><em>Author</em></span>
                                                : <span>Author</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            {(sortChoice === 'license')
                                                ? <span><em>License</em></span>
                                                : <span>License</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            {(sortChoice === 'affiliation')
                                                ? <span><em>Affiliation</em></span>
                                                : <span>Affiliation</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            {(sortChoice === 'course')
                                                ? <span><em>Campus or Course</em></span>
                                                : <span>Campus or Course</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            {(sortChoice === 'commons')
                                                ? <span><em>Enabled on Commons</em></span>
                                                : <span>Actions</span>
                                            }
                                        </Table.HeaderCell>
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {(pageBooks.length > 0) &&
                                        pageBooks.map((item, index) => {
                                            return (
                                                <Table.Row key={index}>
                                                    <Table.Cell>
                                                        <p><strong>{item.title}</strong></p>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <Image src={getLibGlyphURL(item.library)} className='library-glyph' />
                                                        {getLibraryName(item.library)}
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <p>{item.author}</p>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <p>{getLicenseText(item.license)}</p>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <p>{item.affiliation}</p>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <p>{item.course}</p>
                                                    </Table.Cell>
                                                    <Table.Cell textAlign='center'>
                                                        <Button.Group vertical fluid>
                                                            {((process.env.REACT_APP_ORG_ID === 'libretexts') || (item.isCampusBook))
                                                                ? (
                                                                    <Button color='green' disabled>
                                                                        <Icon name='eye' />
                                                                        Enabled by Default
                                                                    </Button>
                                                                )
                                                                : ((!item.isCustomEnabled)
                                                                    ? (
                                                                        <Button
                                                                            color='green'
                                                                            onClick={() => { openEOCModal('enable', item.bookID, item.title) }}
                                                                        >
                                                                            <Icon name='eye' />
                                                                            Enable on Commons
                                                                        </Button>
                                                                    )
                                                                    : (
                                                                        <Button
                                                                            color='red'
                                                                            onClick={() => { openEOCModal('disable', item.bookID, item.title) }}
                                                                        >
                                                                            <Icon name='eye slash' />
                                                                            Disable on Commons
                                                                        </Button>
                                                                    ))
                                                            }
                                                            <Button
                                                                color='teal'
                                                                onClick={() => { openATCModal(item.bookID, item.title) }}
                                                            >
                                                                <Icon name='add' />
                                                                Add to a Collection
                                                            </Button>
                                                            {(item.links && item.links.online)
                                                                ? (
                                                                    <Button color='blue' as='a' href={item.links.online} target='_blank' rel='noopener noreferrer'>
                                                                        <Icon name='external' />
                                                                        View on LibreTexts
                                                                    </Button>
                                                                )
                                                                : (
                                                                    <Button color='blue' disabled>
                                                                        <Icon name='external' />
                                                                        View on LibreTexts
                                                                    </Button>
                                                                )
                                                            }
                                                        </Button.Group>
                                                    </Table.Cell>
                                                </Table.Row>
                                            )
                                        })
                                    }
                                    {(pageBooks.length === 0) &&
                                        <Table.Row>
                                            <Table.Cell colSpan={(process.env.REACT_APP_ORG_ID === 'libretexts') ? 4 : 3}>
                                                <p className='text-center'><em>No results found.</em></p>
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
                                    color='blue'
                                    onClick={syncWithLibs}
                                    fluid
                                    loading={syncInProgress}
                                >
                                    <Icon name='sync alternate' />
                                    Sync Commons with Libraries
                                </Button>
                            }
                            {(syncInProgress) &&
                                <p className='text-center mt-1p'><strong>Sync Status:</strong> <em>In progress...</em></p>
                            }
                            {(syncResponse !== '') &&
                                <p className='text-center mt-1p'><strong>Sync Status:</strong> {syncResponse}</p>
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
                                    color='blue'
                                >
                                    Done
                                </Button>
                            }
                        </Modal.Actions>
                    </Modal>
                    {/* Add to Collection Modal */}
                    <Modal
                        open={showATCModal}
                        closeOnDimmerClick={false}
                    >
                        <Modal.Header>Add to Collection</Modal.Header>
                        <Modal.Content>
                            <p>Choose a collection to add <em>{atcBookTitle}</em> to:</p>
                            <Dropdown
                                placeholder='Choose Collection...'
                                floating
                                selection
                                options={atcCollections}
                                onChange={(_e, { value }) => {
                                    setATCCollectionID(value);
                                }}
                                value={atcCollectionID}
                                error={atcCollectionErr}
                                loading={!atcLoadedColls}
                                fluid
                            />
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                onClick={closeATCModal}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={submitATCForm}
                                color='green'
                                loading={!atcFinishedAdd}
                            >
                                <Icon name='add' />
                                Add
                            </Button>
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
                                onClick={submitEOCForm}
                            >
                                <Icon name={eocEnableMode ? 'eye' : 'eye slash'} />
                                {eocEnableMode ? 'Enable' : 'Disable'}
                            </Button>
                        </Modal.Actions>
                    </Modal>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )

}

export default BooksManager;
