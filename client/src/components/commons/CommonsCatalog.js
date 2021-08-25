import './Commons.css';

import { Link } from 'react-router-dom';
import {
    Grid,
    Image,
    Dropdown,
    Segment,
    Input,
    Pagination,
    Card,
    Table,
    Header,
    Accordion,
    Icon
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useHistory } from 'react-router-dom';
import Breakpoint from '../util/Breakpoints.js';
//import axios from 'axios';
import queryString from 'query-string';

import {
    libraryOptions,
    getShelfOptions,
    licenseOptions,
    getGlyphAddress,
    getLibraryName
} from '../util/HarvestingMasterOptions.js';
import { getDemoBooks } from '../util/DemoBooks.js';
import { itemsPerPageOptions } from '../util/PaginationOptions.js';
import { catalogDisplayOptions } from '../util/CatalogOptions.js';
import { updateParams } from '../util/HelperFunctions.js';

const CommonsCatalog = (_props) => {

    // Global State and Location/History
    const dispatch = useDispatch();
    const location = useLocation();
    const history = useHistory();
    const org = useSelector((state) => state.org);

    // Data
    const [catalogBooks, setCatalogBooks] = useState([]);
    const [filteredBooks, setFilteredBooks] = useState([]);
    const [pageBooks, setPageBooks] = useState([]);

    /** UI **/
    const itemsPerPage = useSelector((state) => state.filters.commonsCatalog.itemsPerPage);
    const [totalPages, setTotalPages] = useState(1);
    const [activePage, setActivePage] = useState(1);
    const [loadedData, setLoadedData] = useState(false);
    const [showMobileFilters, setShowMobileFilters] = useState(false);

    // Library, Subject, Author, and License Filters
    const libraryFilter = useSelector((state) => state.filters.commonsCatalog.library);
    const subjectFilter = useSelector((state) => state.filters.commonsCatalog.subject);
    const authorFilter = useSelector((state) => state.filters.commonsCatalog.author);
    const licenseFilter = useSelector((state) => state.filters.commonsCatalog.license);

    const [subjectOptions, setSubjectOptions] = useState([]);
    const [disableSubjectFilter, setDisableSubjectFilter] = useState(true);
    const [authorOptions, setAuthorOptions] = useState([]);

    // Sort and Search Filters
    const sortChoice = useSelector((state) => state.filters.commonsCatalog.sort);
    const [searchString, setSearchString] = useState('');
    const displayChoice = useSelector((state) => state.filters.commonsCatalog.mode);

    const sortOptions = [
        { key: 'empty', text: 'Sort by...', value: '' },
        { key: 'title', text: 'Sort by Title', value: 'title' },
        { key: 'author', text: 'Sort by Author', value: 'author' }
    ];

    /**
     * Load demo books
     * and set the loaded flag.
     */
    useEffect(() => {
        const demoBooks = getDemoBooks(process.env.REACT_APP_ORG_ID);
        setCatalogBooks(demoBooks);
        setFilteredBooks(demoBooks);
        setLoadedData(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * Update the page title based on
     * Organization information.
     */
    useEffect(() => {
        if (process.env.REACT_APP_ORG_ID && process.env.REACT_APP_ORG_ID !== 'libretexts' && org.shortName) {
            document.title = org.shortName + " Commons | Catalog";
        } else {
            document.title = "LibreCommons | Catalog";
        }
    }, [org]);

    /**
     * Regenerate the authors list
     * when the filtered books pool changes.
     */
    useEffect(() => {
        generateAuthorList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredBooks]);

    /**
     * Resort the current books
     * when the sortChoice changes.
     */
    useEffect(() => {
        sortBooks();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortChoice]);

    /**
     * Track changes to the number of books loaded
     * and the selected itemsPerPage and update the
     * set of books to display.
     */
    useEffect(() => {
        setTotalPages(Math.ceil(filteredBooks.length/itemsPerPage));
        setPageBooks(filteredBooks.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage));
    }, [itemsPerPage, filteredBooks, activePage]);

    /**
     * Subscribe to changes in the URL search string
     * and update state accordingly.
     */
    useEffect(() => {
        var params = queryString.parse(location.search);
        if (params.mode && params.mode !== displayChoice) {
            if ((params.mode === 'visual') || (params.mode === 'itemized')) {
                dispatch({
                    type: 'SET_CATALOG_MODE',
                    payload: params.mode
                });
            }
        }
        if (params.items && params.items !== itemsPerPage) {
            if (!isNaN(parseInt(params.items))) {
                dispatch({
                    type: 'SET_CATALOG_ITEMS',
                    payload: parseInt(params.items)
                });
            }
        }
        if ((params.sort !== undefined) && (params.sort !== sortChoice)) {
            dispatch({
                type: 'SET_CATALOG_SORT',
                payload: params.sort
            });
        }
        if ((params.library !== undefined) && (params.library !== libraryFilter)) {
            dispatch({
                type: 'SET_CATALOG_LIBRARY',
                payload: params.library
            });
            const newShelfOptions = getShelfOptions(params.library);
            setSubjectOptions(newShelfOptions[0]);
            setDisableSubjectFilter(newShelfOptions[1]);
        }
        if ((params.subject !== undefined) && (params.subject !== subjectFilter)) {
            dispatch({
                type: 'SET_CATALOG_SUBJECT',
                payload: params.subject
            });
        }
        if ((params.license !== undefined) && (params.license !== licenseFilter)) {
            dispatch({
                type: 'SET_CATALOG_LICENSE',
                payload: params.license
            });
        }
        if ((params.author !== undefined) && (params.author !== authorFilter)) {
            dispatch({
                type: 'SET_CATALOG_AUTHOR',
                payload: params.author
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.search]);

    /**
     * Sort the books according to
     * the current sortChoice and update
     * filteredBooks.
     */
    const sortBooks = () => {
        if (sortChoice === 'title') {
            const sorted = [...filteredBooks].sort((a, b) => {
                if (a.title < b.title) {
                    return -1;
                }
                if (a.title > b.title) {
                    return 1;
                }
                return 0;
            });
            setFilteredBooks(sorted);
        } else if (sortChoice === 'author') {
            const sorted = [...filteredBooks].sort((a, b) => {
                if (a.author < b.author) {
                    return -1;
                }
                if (a.author > b.author) {
                    return 1;
                }
                return 0;
            });
            setFilteredBooks(sorted);
        }
    };

    /**
     * Set the chosen Library filter and
     * update the corresponding shelves list.
     */
    const setLibrary = (_e, { value }) => {
        var newLib = updateParams(location.search, 'library', value);
        var newSearch = updateParams(newLib, 'subject', '');
        history.push({
            pathname: location.pathname,
            search: newSearch
        });
    };

    /**
     * Generate a list of (unique, non-repeating)
     * authors from the pool of filtered books.
     */
    const generateAuthorList = () => {
        var newAuthorList = [];
        var newAuthorOptions = [
            { key: 'empty', text: 'Clear...', value: '' }
        ];
        filteredBooks.forEach((item) => {
            if ((newAuthorList.includes(item.author) === false) && (item.author !== '')) {
                newAuthorList.push(item.author);
                newAuthorOptions.push({
                    key: String(item.author).toLowerCase().replace(/\s/g, ""),
                    text: item.author,
                    value: item.author
                });
            }
        });
        setAuthorOptions(newAuthorOptions);
    };

    /**
     * Filter books according to user's
     * choices, then update the list and
     * regenerate the author list.
     */
    useEffect(() => {
        let filtered = catalogBooks.filter((book) => {
            var include = true;
            var descripString = String(book.title).toLowerCase() + String(book.author).toLowerCase() +
                String(book.library).toLowerCase() + String(book.subject).toLowerCase() +
                String(book.license).toLowerCase();
            if (libraryFilter !== '' && book.library !== libraryFilter) {
                include = false;
            }
            if (subjectFilter !== '' && book.subject !== subjectFilter) {
                include = false;
            }
            if (authorFilter !== '' && book.author !== authorFilter) {
                include = false;
            }
            if (licenseFilter !== '' && book.license !== licenseFilter) {
                include = false;
            }
            if (searchString !== '' && String(descripString).indexOf(String(searchString).toLowerCase()) === -1) {
                include = false;
            }
            if (include) {
                return book;
            } else {
                return false;
            }
        });
        setFilteredBooks(filtered);
        generateAuthorList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [catalogBooks, libraryFilter, subjectFilter, authorFilter, licenseFilter, searchString]);

    const VisualMode = () => {
        if (pageBooks.length > 0) {
            return (
                <Card.Group itemsPerRow={5} stackable>
                    {pageBooks.map((item, index) => {
                        return (
                            <Card
                                key={index}
                                as={Link}
                                to={`/book/${item.id}`}
                            >
                                <Image className='commons-content-card-img' src={item.thumbnail} wrapped ui={false} />
                                <Card.Content>
                                    <Card.Header>{item.title}</Card.Header>
                                    <Card.Meta>
                                        <Image src={getGlyphAddress(item.library)} className='library-glyph' />
                                        {getLibraryName(item.library)}
                                    </Card.Meta>
                                    <Card.Description>
                                        <p>{item.author}</p>
                                        {((process.env.REACT_APP_ORG_ID === 'libretexts') && (item.institution !== '')) &&
                                            <p><em>{item.institution}</em></p>
                                        }
                                    </Card.Description>
                                </Card.Content>
                            </Card>
                        )
                    })}
                </Card.Group>
            )
        } else {
            return (
                <p className='text-center'><em>No results found.</em></p>
            );
        }
    };

    const ItemizedMode = () => {
        return (
            <Table celled>
                <Table.Header>
                    <Table.Row>
                        <Table.HeaderCell width={5}><Header sub>Title</Header></Table.HeaderCell>
                        <Table.HeaderCell width={2}><Header sub>Author</Header></Table.HeaderCell>
                        <Table.HeaderCell width={2}><Header sub>Library</Header></Table.HeaderCell>
                        {(process.env.REACT_APP_ORG_ID === 'libretexts') &&
                            <Table.HeaderCell width={3}><Header sub>Institution</Header></Table.HeaderCell>
                        }
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {(pageBooks.length > 0) &&
                        pageBooks.map((item, index) => {
                            return (
                                <Table.Row key={index}>
                                    <Table.Cell>
                                        <p><strong><Link to={`/book/${item.id}`}>{item.title}</Link></strong></p>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <p>{item.author}</p>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Image src={getGlyphAddress(item.library)} className='library-glyph' />
                                        {getLibraryName(item.library)}
                                    </Table.Cell>
                                    {(process.env.REACT_APP_ORG_ID === 'libretexts') &&
                                        <Table.Cell>
                                            <p><em>{item.institution}</em></p>
                                        </Table.Cell>
                                    }
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
        )
    };


    return (
        <Grid className='commons-container'>
            <Grid.Row>
                <Grid.Column>
                    <Segment.Group raised>
                        <Segment>
                            <Breakpoint name='desktop'>
                                <Grid>
                                    <Grid.Row>
                                        <Grid.Column width={10}>
                                            <Dropdown
                                                placeholder='Library'
                                                floating
                                                selection
                                                button
                                                options={libraryOptions}
                                                onChange={setLibrary}
                                                value={libraryFilter}
                                                className='commons-filter'
                                            />
                                            <Dropdown
                                                placeholder='Subject'
                                                floating
                                                selection
                                                button
                                                options={subjectOptions}
                                                onChange={(_e, { value }) => {
                                                    history.push({
                                                        pathname: location.pathname,
                                                        search: updateParams(location.search, 'subject', value)
                                                    });
                                                }}
                                                value={subjectFilter}
                                                disabled={disableSubjectFilter}
                                                className='commons-filter'
                                            />
                                            <Dropdown
                                                placeholder='Author'
                                                floating
                                                selection
                                                button
                                                options={authorOptions}
                                                onChange={(_e, { value }) => {
                                                    history.push({
                                                        pathname: location.pathname,
                                                        search: updateParams(location.search, 'author', value)
                                                    });
                                                }}
                                                value={authorFilter}
                                                className='commons-filter'
                                            />
                                            <Dropdown
                                                placeholder='License'
                                                floating
                                                selection
                                                button
                                                options={licenseOptions}
                                                onChange={(_e, { value }) => {
                                                    history.push({
                                                        pathname: location.pathname,
                                                        search: updateParams(location.search, 'license', value)
                                                    });
                                                }}
                                                value={licenseFilter}
                                                className='commons-filter'
                                            />
                                        </Grid.Column>
                                        <Grid.Column width={6}>
                                            <Input
                                                icon='search'
                                                placeholder='Search...'
                                                className='float-right commons-filter'
                                                onChange={(e) => { setSearchString(e.target.value) }}
                                                value={searchString}
                                            />
                                            <Dropdown
                                                placeholder='Sort by...'
                                                floating
                                                selection
                                                button
                                                className='float-right commons-filter'
                                                options={sortOptions}
                                                onChange={(_e, { value }) => {
                                                    history.push({
                                                        pathname: location.pathname,
                                                        search: updateParams(location.search, 'sort', value)
                                                    });
                                                }}
                                                value={sortChoice}
                                            />
                                        </Grid.Column>
                                    </Grid.Row>
                                </Grid>
                            </Breakpoint>
                            <Breakpoint name='mobileOrTablet'>
                                <Accordion fluid>
                                    <Accordion.Title
                                        active={showMobileFilters}
                                        onClick={() => { setShowMobileFilters(!showMobileFilters) }}
                                    >
                                        <Icon name='dropdown' />
                                        <strong>Filter and Sort</strong>
                                    </Accordion.Title>
                                    <Accordion.Content active={showMobileFilters}>
                                        <Dropdown
                                            placeholder='Library'
                                            floating
                                            selection
                                            button
                                            options={libraryOptions}
                                            onChange={setLibrary}
                                            value={libraryFilter}
                                            fluid
                                            className='commons-filter'
                                        />
                                        <Dropdown
                                            placeholder='Subject'
                                            floating
                                            selection
                                            button
                                            options={subjectOptions}
                                            onChange={(_e, { value }) => {
                                                history.push({
                                                    pathname: location.pathname,
                                                    search: updateParams(location.search, 'subject', value)
                                                });
                                            }}
                                            value={subjectFilter}
                                            disabled={disableSubjectFilter}
                                            fluid
                                            className='commons-filter'
                                        />
                                        <Dropdown
                                            placeholder='Author'
                                            floating
                                            selection
                                            button
                                            options={authorOptions}
                                            onChange={(_e, { value }) => {
                                                history.push({
                                                    pathname: location.pathname,
                                                    search: updateParams(location.search, 'author', value)
                                                });
                                            }}
                                            value={authorFilter}
                                            fluid
                                            className='commons-filter'
                                        />
                                        <Dropdown
                                            placeholder='License'
                                            floating
                                            selection
                                            button
                                            options={licenseOptions}
                                            onChange={(_e, { value }) => {
                                                history.push({
                                                    pathname: location.pathname,
                                                    search: updateParams(location.search, 'license', value)
                                                });
                                            }}
                                            value={licenseFilter}
                                            fluid
                                            className='commons-filter'
                                        />
                                        <Dropdown
                                            placeholder='Sort by...'
                                            floating
                                            selection
                                            button
                                            options={sortOptions}
                                            onChange={(_e, { value }) => {
                                                history.push({
                                                    pathname: location.pathname,
                                                    search: updateParams(location.search, 'sort', value)
                                                });
                                            }}
                                            value={sortChoice}
                                            fluid
                                            className='commons-filter'
                                        />
                                    </Accordion.Content>
                                </Accordion>
                                <Input
                                    icon='search'
                                    placeholder='Search...'
                                    onChange={(e) => { setSearchString(e.target.value) }}
                                    value={searchString}
                                    fluid
                                    className='commons-filter'
                                />
                            </Breakpoint>
                        </Segment>
                        <Segment>
                            <Breakpoint name='desktop'>
                                <div className='commons-content-pagemenu'>
                                    <div className='commons-content-pagemenu-left'>
                                        <span>Displaying </span>
                                        <Dropdown
                                            className='commons-content-pagemenu-dropdown'
                                            selection
                                            options={itemsPerPageOptions}
                                            onChange={(_e, { value }) => {
                                                history.push({
                                                    pathname: location.pathname,
                                                    search: updateParams(location.search, 'items', value)
                                                });
                                            }}
                                            value={itemsPerPage}
                                        />
                                        <span> items per page of <strong>{filteredBooks.length}</strong> results.</span>
                                    </div>
                                    <div className='commons-content-pagemenu-right'>
                                        <Dropdown
                                            placeholder='Display mode...'
                                            floating
                                            selection
                                            button
                                            className='float-right'
                                            options={catalogDisplayOptions}
                                            onChange={(_e, { value }) => {
                                                history.push({
                                                    pathname: location.pathname,
                                                    search: updateParams(location.search, 'mode', value)
                                                });
                                            }}
                                            value={displayChoice}
                                        />
                                        <Pagination
                                            activePage={activePage}
                                            totalPages={totalPages}
                                            firstItem={null}
                                            lastItem={null}
                                            onPageChange={(_e, data) => { setActivePage(data.activePage) }}
                                        />
                                    </div>
                                </div>
                            </Breakpoint>
                            <Breakpoint name='mobileOrTablet'>
                                <Grid>
                                    <Grid.Row columns={1}>
                                        <Grid.Column>
                                            <div className='center-flex flex-wrap'>
                                                <span>Displaying </span>
                                                <Dropdown
                                                    className='commons-content-pagemenu-dropdown'
                                                    selection
                                                    options={itemsPerPageOptions}
                                                    onChange={(_e, { value }) => {
                                                        history.push({
                                                            pathname: location.pathname,
                                                            search: updateParams(location.search, 'items', value)
                                                        });
                                                    }}
                                                    value={itemsPerPage}
                                                />
                                                <span> items per page of <strong>{filteredBooks.length}</strong> results.</span>
                                            </div>
                                        </Grid.Column>
                                    </Grid.Row>
                                    <Grid.Row columns={2}>
                                        <Grid.Column>
                                            <Dropdown
                                                placeholder='Display mode...'
                                                floating
                                                selection
                                                button
                                                className='float-right'
                                                options={catalogDisplayOptions}
                                                onChange={(_e, { value }) => {
                                                    history.push({
                                                        pathname: location.pathname,
                                                        search: updateParams(location.search, 'mode', value)
                                                    });
                                                }}
                                                value={displayChoice}
                                                fluid
                                            />
                                        </Grid.Column>
                                        <Grid.Column>
                                            <Pagination
                                                activePage={activePage}
                                                totalPages={totalPages}
                                                firstItem={null}
                                                lastItem={null}
                                                onPageChange={(_e, data) => { setActivePage(data.activePage) }}
                                                className='float-right'
                                            />
                                        </Grid.Column>
                                    </Grid.Row>
                                </Grid>
                            </Breakpoint>
                        </Segment>
                        {displayChoice === 'visual'
                            ? (
                                <Segment className='commons-content' loading={!loadedData}>
                                    <VisualMode />
                                </Segment>
                            )
                            : (
                                <Segment className='commons-content commons-content-itemized' loading={!loadedData}>
                                    <ItemizedMode />
                                </Segment>
                            )
                        }
                    </Segment.Group>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )
}

export default CommonsCatalog;
