import './SupervisorDashboard.css';

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
  Input
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
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
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [syncInProgress, setSyncInProgress] = useState(false);
    const [syncFinished, setSyncFinished] = useState(false);
    const [sortChoice, setSortChoice] = useState('');

    useEffect(() => {
        document.title = "LibreTexts Conductor | Book Manager";
        date.plugin(ordinal);
        getBooks();
    }, []);

    const sortOptions = [
        { key: 'lib', text: 'Library', value: 'lib' },
        { key: 'title', text: 'Title', value: 'title' },
        { key: 'author', text: 'Author', value: 'author' },
        { key: 'license', text: 'License', value: 'license' },
        { key: 'institution', text: 'Institution', value: 'institution' },
        { key: 'commons', text: 'Enabled on Commons', value: 'commons'}
    ];

    useEffect(() => {
        setTotalPages(Math.ceil(catalogBooks.length/itemsPerPage));
        setPageBooks(catalogBooks.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage));
    }, [itemsPerPage, catalogBooks, activePage]);

    const getBooks = () => {
        axios.get('/commons/catalog').then((res) => {
            if (!res.data.err) {
                if (res.data.books && Array.isArray(res.data.books) && res.data.books.length > 0) {
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
    }

    const syncWithLibs = () => {
        setSyncInProgress(true);
        axios.post('/commons/syncwithlibs').then((res) => {
            if (!res.data.err) {
                setSyncResponse(res.data.msg);
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

    const openSyncModal = () => {
        setShowSyncModal(true);
        setSyncInProgress(false);
        setSyncFinished(false);
        setSyncResponse('');
    };

    const closeSyncModal = () => {
        setShowSyncModal(false);
        setSyncInProgress(false);
        setSyncFinished(false);
        setSyncResponse('');
    };

    return (
        <Grid className='component-container' divided='vertically'>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Header className='component-header'>Books Manager</Header>
                </Grid.Column>
            </Grid.Row>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Segment.Group>
                        <Segment>
                            <div className='booksmanager-options'>
                                <div className='booksmanager-options-left'>
                                    <span className='mr-1p'><strong>Last Sync:</strong> Today</span>
                                    <span className='ml-1p'><strong>Next Sync:</strong> Today</span>
                                </div>
                                <div className='booksmanager-options-right'>
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
                            <div className='booksmanager-options'>
                                <div className='booksmanager-options-left'>
                                    <Form>
                                        <Form.Field inline>
                                            <label>Sort by</label>
                                            <Dropdown
                                                placeholder='Sort by...'
                                                floating
                                                selection
                                                button
                                                options={sortOptions}
                                                onChange={(_e, { value }) => { setSortChoice(value) }}
                                                value={sortChoice}
                                            />
                                        </Form.Field>
                                    </Form>
                                </div>
                                <div className='booksmanager-options-right'>
                                    <Input
                                        icon='search'
                                        placeholder='Search...'
                                        onChange={(e) => { setSearchString(e.target.value) }}
                                        value={searchString}
                                        fluid
                                    />
                                </div>
                            </div>
                        </Segment>
                        <Segment>
                            <div className='booksmanager-options'>
                                <div className='booksmanager-options-left'>
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
                                <div className='booksmanager-options-right'>
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
                                            {(sortChoice === 'lib')
                                                ? <span><em>Library</em></span>
                                                : <span>Library</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            {(sortChoice === 'title')
                                                ? <span><em>Book Title</em></span>
                                                : <span>Book Title</span>
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
                                            {(sortChoice === 'institution')
                                                ? <span><em>Institution</em></span>
                                                : <span>Institution</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            {(sortChoice === 'commons')
                                                ? <span><em>Enabled on Commons</em></span>
                                                : <span>Enabled on Commons</span>
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
                                                        <Image src={getLibGlyphURL(item.library)} className='library-glyph' />
                                                        {getLibraryName(item.library)}
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <p><strong>{item.title}</strong></p>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <p>{item.author}</p>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <p>{getLicenseText(item.license)}</p>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <p>{item.institution}</p>
                                                    </Table.Cell>
                                                    <Table.Cell textAlign='center'>
                                                        {(process.env.REACT_APP_ORG_ID === 'libretexts') &&
                                                            <Icon name='checkmark' color='green' size='large' />
                                                        }
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
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )

}

export default BooksManager;
