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
import axios from 'axios';
import queryString from 'query-string';

import {
    getShelfOptions,

} from '../util/HarvestingMasterOptions.js';
import {
    libraryOptions,
    getLibGlyphURL,
    getLibraryName
} from '../util/LibraryOptions.js';
import { licenseOptions } from '../util/LicenseOptions.js';
import useGlobalError from '../error/ErrorHooks.js';
import { itemsPerPageOptions } from '../util/PaginationOptions.js';
import { catalogDisplayOptions } from '../util/CatalogOptions.js';
import { updateParams, isEmptyString } from '../util/HelperFunctions.js';

const CommonsCatalog = (_props) => {

    const { handleGlobalError } = useGlobalError();

    // Global State and Location/History
    const dispatch = useDispatch();
    const location = useLocation();
    const history = useHistory();
    const org = useSelector((state) => state.org);

    // Data
    const [catalogBooks, setCatalogBooks] = useState([]);
    const [pageBooks, setPageBooks] = useState([]);

    /** UI **/
    const itemsPerPage = useSelector((state) => state.filters.commonsCatalog.itemsPerPage);
    const [totalPages, setTotalPages] = useState(1);
    const [activePage, setActivePage] = useState(1);
    const [loadedData, setLoadedData] = useState(false);
    const [loadedFilters, setLoadedFilters] = useState(false);
    const [showMobileFilters, setShowMobileFilters] = useState(false);

    // Library, Subject, Author, and License Filters
    const libraryFilter = useSelector((state) => state.filters.commonsCatalog.library);
    const subjectFilter = useSelector((state) => state.filters.commonsCatalog.subject);
    const authorFilter = useSelector((state) => state.filters.commonsCatalog.author);
    const licenseFilter = useSelector((state) => state.filters.commonsCatalog.license);
    const instFilter = useSelector((state) => state.filters.commonsCatalog.institution);
    const courseFilter = useSelector((state) => state.filters.commonsCatalog.course);

    const [subjectOptions, setSubjectOptions] = useState([]);
    const [authorOptions, setAuthorOptions] = useState([]);
    const [instOptions, setInstOptions] = useState([]);
    const [courseOptions, setCourseOptions] = useState([]);

    // Sort and Search Filters
    const sortChoice = useSelector((state) => state.filters.commonsCatalog.sort);
    const [searchString, setSearchString] = useState('');
    const displayChoice = useSelector((state) => state.filters.commonsCatalog.mode);

    const sortOptions = [
        { key: 'title', text: 'Sort by Title', value: 'title' },
        { key: 'author', text: 'Sort by Author', value: 'author' }
    ];

    /**
     * Load books from server
     * on initial load.
     */
    useEffect(() => {
        getCommonsCatalog();
        getFilterOptions();
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
     * Send a new query to the server when filters,
     * the sort option, or the search
     * string change.
     */
    useEffect(() => {
        getCommonsCatalog();
    }, [libraryFilter, subjectFilter, authorFilter, licenseFilter,
        instFilter, courseFilter, searchString, sortChoice]);

    /**
     * Perform GET request for books
     * and update catalogBooks.
     */
    const getCommonsCatalog = () => {
        setLoadedData(false);
        var paramsObj = {
            sort: sortChoice
        };
        if (!isEmptyString(libraryFilter)) {
            paramsObj.library = libraryFilter;
        }
        if (!isEmptyString(subjectFilter)) {
            paramsObj.subject = subjectFilter;
        }
        if (!isEmptyString(authorFilter)) {
            paramsObj.author = authorFilter;
        }
        if (!isEmptyString(licenseFilter)) {
            paramsObj.license = licenseFilter;
        }
        if (!isEmptyString(instFilter)) {
            paramsObj.institution = instFilter;
        }
        if (!isEmptyString(courseFilter)) {
            paramsObj.course = courseFilter;
        }
        if (!isEmptyString(searchString)) {
            paramsObj.search = searchString;
        }
        axios.get('/commons/catalog', {
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
     * Retrieve the list(s) of dynamic
     * filter options from the server.
     */
    const getFilterOptions = () => {
        axios.get('/commons/filters').then((res) => {
            if (!res.data.err) {
                if (res.data.authors && Array.isArray(res.data.authors)) {
                    var authorOptions = [
                        { key: 'empty', text: 'Clear...', value: '' }
                    ];
                    res.data.authors.forEach((author) => {
                        authorOptions.push({
                            key: author,
                            text: author,
                            value: author
                        });
                    });
                    setAuthorOptions(authorOptions);
                }
                if (res.data.subjects && Array.isArray(res.data.subjects)) {
                    var subjectOptions = [
                        { key: 'empty', text: 'Clear...', value: '' }
                    ];
                    res.data.subjects.forEach((subject) => {
                        subjectOptions.push({
                            key: subject,
                            text: subject,
                            value: subject
                        });
                    })
                    setSubjectOptions(subjectOptions);
                }
                if (res.data.institutions && Array.isArray(res.data.institutions)) {
                    var instOptions = [
                        { key: 'empty', text: 'Clear...', value: '' }
                    ];
                    res.data.institutions.forEach((institution) => {
                        instOptions.push({
                            key: institution,
                            text: institution,
                            value: institution
                        });
                    });
                    setInstOptions(instOptions);
                }
                if (res.data.courses && Array.isArray(res.data.courses)) {
                    var courseOptions = [
                        { key: 'empty', text: 'Clear...', value: '' }
                    ];
                    res.data.courses.forEach((course) => {
                        courseOptions.push({
                            key: course,
                            text: course,
                            value: course
                        });
                    });
                    setCourseOptions(courseOptions);
                }
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setLoadedFilters(true);
        }).catch((err) => {
            handleGlobalError(err);
            setLoadedFilters(true);
        });
    };

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
            /*
            const newShelfOptions = getShelfOptions(params.library);
            setSubjectOptions(newShelfOptions[0]);
            setDisableSubjectFilter(newShelfOptions[1]);
            */
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
        if ((params.institution !== undefined) && (params.institution !== instFilter)) {
            dispatch({
                type: 'SET_CATALOG_INST',
                payload: params.institution
            });
        }
        if ((params.course !== undefined) && (params.course !== courseFilter)) {
            dispatch({
                type: 'SET_CATALOG_COURSE',
                payload: params.course
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.search]);

    /**
     * Set the chosen Library filter and
     * update the corresponding shelves list.
     */
    const setLibrary = (_e, { value }) => {
        var newLib = updateParams(location.search, 'library', value);
        //var newSearch = updateParams(newLib, 'subject', '');
        history.push({
            pathname: location.pathname,
            search: newLib
        });
    };

    const VisualMode = () => {
        if (pageBooks.length > 0) {
            return (
                <Card.Group itemsPerRow={6} stackable>
                    {pageBooks.map((item, index) => {
                        return (
                            <Card
                                key={index}
                                as={Link}
                                to={`/book/${item.bookID}`}
                            >
                                <Image
                                    className='commons-content-card-img'
                                    src={item.thumbnail}
                                    wrapped
                                    ui={false}
                                />
                                <Card.Content>
                                    <Card.Header>{item.title}</Card.Header>
                                    <Card.Meta>
                                        <Image src={getLibGlyphURL(item.library)} className='library-glyph' />
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
                                        <p><strong><Link to={`/book/${item.bookID}`}>{item.title}</Link></strong></p>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <p>{item.author}</p>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Image src={getLibGlyphURL(item.library)} className='library-glyph' />
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
                                        <Grid.Column width={6}>
                                            <Input
                                                icon='search'
                                                placeholder='Search...'
                                                className='commons-filter'
                                                iconPosition='left'
                                                onChange={(e) => { setSearchString(e.target.value) }}
                                                value={searchString}
                                                fluid
                                            />
                                        </Grid.Column>
                                        <Grid.Column width={10}>
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
                                <Input
                                    icon='search'
                                    placeholder='Search...'
                                    className='commons-filter'
                                    iconPosition='left'
                                    onChange={(e) => { setSearchString(e.target.value) }}
                                    value={searchString}
                                    fluid
                                />
                                <Accordion
                                    fluid
                                    className='mt-1p'
                                >
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
                                            search
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
                                            loading={!loadedFilters}
                                            fluid
                                            className='commons-filter'
                                        />
                                        <Dropdown
                                            placeholder='Author'
                                            floating
                                            search
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
                                            loading={!loadedFilters}
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
                                            placeholder='Institution'
                                            floating
                                            search
                                            selection
                                            button
                                            options={instOptions}
                                            onChange={(_e, { value }) => {
                                                history.push({
                                                    pathname: location.pathname,
                                                    search: updateParams(location.search, 'institution', value)
                                                });
                                            }}
                                            value={instFilter}
                                            loading={!loadedFilters}
                                            fluid
                                            className='commons-filter'
                                        />
                                        <Dropdown
                                            placeholder='Campus or Course'
                                            floating
                                            search
                                            selection
                                            button
                                            options={courseOptions}
                                            onChange={(_e, { value }) => {
                                                history.push({
                                                    pathname: location.pathname,
                                                    search: updateParams(location.search, 'course', value)
                                                });
                                            }}
                                            value={courseFilter}
                                            loading={!loadedFilters}
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
                            </Breakpoint>
                        </Segment>
                        <Breakpoint name='desktop'>
                            <Segment>
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
                                    search
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
                                    loading={!loadedFilters}
                                    className='commons-filter'
                                />
                                <Dropdown
                                    placeholder='Author'
                                    floating
                                    search
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
                                    loading={!loadedFilters}
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
                                <Dropdown
                                    placeholder='Institution'
                                    floating
                                    search
                                    selection
                                    button
                                    options={instOptions}
                                    onChange={(_e, { value }) => {
                                        history.push({
                                            pathname: location.pathname,
                                            search: updateParams(location.search, 'institution', value)
                                        });
                                    }}
                                    value={instFilter}
                                    loading={!loadedFilters}
                                    className='commons-filter'
                                />
                                <Dropdown
                                    placeholder='Campus or Course'
                                    floating
                                    search
                                    selection
                                    button
                                    options={courseOptions}
                                    onChange={(_e, { value }) => {
                                        history.push({
                                            pathname: location.pathname,
                                            search: updateParams(location.search, 'course', value)
                                        });
                                    }}
                                    value={courseFilter}
                                    loading={!loadedFilters}
                                    className='commons-filter'
                                />
                            </Segment>
                        </Breakpoint>
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
                                        <span> items per page of <strong>{Number(catalogBooks.length).toLocaleString()}</strong> results.</span>
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
                                                <span> items per page of <strong>{Number(catalogBooks.length).toLocaleString()}</strong> results.</span>
                                            </div>
                                        </Grid.Column>
                                    </Grid.Row>
                                    <Grid.Row columns={1}>
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
                                    </Grid.Row>
                                    <Grid.Row columns={1}>
                                        <Grid.Column id='commons-pagination-mobile-container'>
                                            <Pagination
                                                activePage={activePage}
                                                totalPages={totalPages}
                                                siblingRange={1}
                                                firstItem={null}
                                                lastItem={null}
                                                onPageChange={(_e, data) => { setActivePage(data.activePage) }}
                                            />
                                        </Grid.Column>
                                    </Grid.Row>
                                </Grid>
                            </Breakpoint>
                        </Segment>
                        <Segment className={(displayChoice === 'visual') ? 'commons-content' : 'commons-content commons-content-itemized'} loading={!loadedData}>
                            {displayChoice === 'visual'
                                ? (<VisualMode />)
                                : (<ItemizedMode />)
                            }
                        </Segment>
                    </Segment.Group>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )
}

export default CommonsCatalog;
