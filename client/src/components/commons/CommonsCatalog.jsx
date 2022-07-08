import './Commons.css';

import { Link } from 'react-router-dom';
import {
    Grid,
    Image,
    Dropdown,
    Segment,
    Card,
    Table,
    Header,
    Icon,
    Button,
    Form
} from 'semantic-ui-react';
import React, { useEffect, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useHistory } from 'react-router-dom';
import Breakpoint from '../util/Breakpoints.jsx';
import ConductorPagination from '../util/ConductorPagination.jsx';
import axios from 'axios';
import queryString from 'query-string';

import {
    getShelfOptions,
} from '../util/HarvestingMasterOptions.js';
import {
    libraryOptions,
    getLibGlyphURL,
    getLibGlyphAltText,
    getLibraryName
} from '../util/LibraryOptions.js';
import { licenseOptions } from '../util/LicenseOptions.js';
import useGlobalError from '../error/ErrorHooks.js';
import { catalogItemsPerPageOptions } from '../util/PaginationOptions.js';
import {
    catalogDisplayOptions,
    catalogLocationOptions
} from '../util/CatalogOptions.js';
import { updateParams, isEmptyString } from '../util/HelperFunctions.js';

const CommonsCatalog = () => {

    const { handleGlobalError } = useGlobalError();

    // Global State and Location/History
    const location = useLocation();
    const history = useHistory();
    const org = useSelector((state) => state.org);

    // Data
    const [catalogBooks, setCatalogBooks] = useState([]);
    const [pageBooks, setPageBooks] = useState([]);

    /** UI **/
    const [itemsPerPage, setItemsPerPage] = useState(12);
    const [totalPages, setTotalPages] = useState(1);
    const [activePage, setActivePage] = useState(1);
    const [loadedData, setLoadedData] = useState(false);

    const [loadedFilters, setLoadedFilters] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    const initialSearch = useRef(false);
    const checkedParams = useRef(false);

    // Content Filters
    const [searchString, setSearchString] = useState('');
    const [libraryFilter, setLibraryFilter] = useState('');
    const [locationFilter, setLocationFilter] = useState(org.orgID === 'libretexts' ? 'central' : 'campus');
    const [subjectFilter, setSubjectFilter] = useState('');
    const [authorFilter, setAuthorFilter] = useState('');
    const [licenseFilter, setLicenseFilter] = useState('');
    const [affilFilter, setAffilFilter] = useState('');
    const [instrFilter, setInstrFilter] = useState('');
    const [courseFilter, setCourseFilter] = useState('');
    const [pubFilter, setPubFilter] = useState('');

    const [subjectOptions, setSubjectOptions] = useState([]);
    const [authorOptions, setAuthorOptions] = useState([]);
    const [affOptions, setAffOptions] = useState([]);
    const [courseOptions, setCourseOptions] = useState([]);
    const [pubOptions, setPubOptions] = useState([]);

    // Sort and Search Filters
    const [sortChoice, setSortChoice] = useState('title');
    const [displayChoice, setDisplayChoice] = useState('visual');

    const sortOptions = [
        { key: 'title', text: 'Sort by Title', value: 'title' },
        { key: 'author', text: 'Sort by Author', value: 'author' }
    ];

    /**
     * Get filter options from server
     * on initial load.
     */
    useEffect(() => {
        getFilterOptions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * Update the page title based on
     * Organization information.
     */
    useEffect(() => {
      if (org.orgID !== 'libretexts') {
        document.title = `${org.shortName} Commons | Catalog`;
      } else {
        document.title = 'LibreCommons | Catalog';
      }
    }, [org]);

    /**
     * Build the new search URL and
     * push it onto the history stack.
     * Change to location triggers the
     * network request to fetch results.
     */
    const performSearch = () => {
        if (!initialSearch.current) {
            initialSearch.current = true;
        }
        let searchURL = location.search;
        searchURL = updateParams(searchURL, 'search', searchString);
        searchURL = updateParams(searchURL, 'library', libraryFilter);
        searchURL = updateParams(searchURL, 'subject', subjectFilter)
        searchURL = updateParams(searchURL, 'location', locationFilter);
        searchURL = updateParams(searchURL, 'author', authorFilter);
        searchURL = updateParams(searchURL, 'license', licenseFilter);
        searchURL = updateParams(searchURL, 'affiliation', affilFilter);
        searchURL = updateParams(searchURL, 'course', courseFilter);
        searchURL = updateParams(searchURL, 'publisher', pubFilter);
        history.push({
            pathname: location.pathname,
            search: searchURL
        });
    };

    const resetSearch = () => {
        setSearchString('');
        setLibraryFilter('');
        setSubjectFilter('');
        setLocationFilter((org.orgID === 'libretexts') ? 'central' : 'campus');
        setAuthorFilter('');
        setLicenseFilter('');
        setAffilFilter('');
        setCourseFilter('');
        setPubFilter('');
        let searchURL = location.search;
        searchURL = updateParams(searchURL, 'search', '');
        searchURL = updateParams(searchURL, 'library', '');
        searchURL = updateParams(searchURL, 'subject', '');
        searchURL = updateParams(searchURL, 'location', '');
        searchURL = updateParams(searchURL, 'author', '');
        searchURL = updateParams(searchURL, 'license', '');
        searchURL = updateParams(searchURL, 'affiliation', '');
        searchURL = updateParams(searchURL, 'course', '');
        searchURL = updateParams(searchURL, 'publisher', '');
        history.push({
            pathname: location.pathname,
            search: searchURL
        });
    };

    /**
     * Perform GET request for books
     * and update catalogBooks.
     */
    const searchCommonsCatalog = () => {
        setLoadedData(false);
        var paramsObj = {
            sort: sortChoice
        };
        if (!isEmptyString(searchString)) {
            paramsObj.search = searchString;
        }
        if (!isEmptyString(libraryFilter)) {
            paramsObj.library = libraryFilter;
        }
        if (!isEmptyString(subjectFilter)) {
            paramsObj.subject = subjectFilter;
        }
        if (!isEmptyString(locationFilter)) {
            paramsObj.location = locationFilter;
        }
        if (!isEmptyString(authorFilter)) {
            paramsObj.author = authorFilter;
        }
        if (!isEmptyString(licenseFilter)) {
            paramsObj.license = licenseFilter;
        }
        if (!isEmptyString(affilFilter)) {
            paramsObj.affiliation = affilFilter;
        }
        if (!isEmptyString(courseFilter)) {
            paramsObj.course = courseFilter;
        }
        if (!isEmptyString(pubFilter)) {
            paramsObj.publisher = pubFilter;
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
                var newAuthorOptions = [{ key: 'empty', text: 'Clear...', value: '' }];
                var newSubjectOptions = [{ key: 'empty', text: 'Clear...', value: '' }];
                var newAffOptions = [{ key: 'empty', text: 'Clear...', value: '' }];
                var newCourseOptions = [{ key: 'empty', text: 'Clear...', value: '' }];
                var newPubOptions = [{ key: 'empty', text: 'Clear...', value: '' }];
                if (res.data.authors && Array.isArray(res.data.authors)) {
                    res.data.authors.forEach((author) => {
                        newAuthorOptions.push({
                            key: author,
                            text: author,
                            value: author
                        });
                    });
                }
                if (res.data.subjects && Array.isArray(res.data.subjects)) {
                    res.data.subjects.forEach((subject) => {
                        newSubjectOptions.push({
                            key: subject,
                            text: subject,
                            value: subject
                        });
                    });
                }
                if (res.data.affiliations && Array.isArray(res.data.affiliations)) {
                    res.data.affiliations.forEach((affiliation) => {
                        newAffOptions.push({
                            key: affiliation,
                            text: affiliation,
                            value: affiliation
                        });
                    });
                }
                if (res.data.courses && Array.isArray(res.data.courses)) {
                    res.data.courses.forEach((course) => {
                        newCourseOptions.push({
                            key: course,
                            text: course,
                            value: course
                        });
                    });
                }
                if (res.data.publishers && Array.isArray(res.data.publishers)) {
                    res.data.publishers.forEach((publisher) => {
                        newPubOptions.push({
                            key: publisher,
                            text: publisher,
                            value: publisher
                        });
                    });
                }
                setAuthorOptions(newAuthorOptions);
                setSubjectOptions(newSubjectOptions);
                setAffOptions(newAffOptions);
                setCourseOptions(newCourseOptions);
                setPubOptions(newPubOptions);
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
     * Perform the Catalog search based on
     * URL query change after ensuring the
     * initial URL params sync has been
     * performed.
     */
    useEffect(() => {
        if (checkedParams.current) {
            searchCommonsCatalog();
        }
    }, [checkedParams.current, initialSearch.current, location.search]);

    /**
     * Update the URL query with the sort choice
     * AFTER a search has been performed and a
     * change has been made.
     */
    useEffect(() => {
        if (initialSearch.current) {
            let searchURL = updateParams(location.search, 'sort', sortChoice);
            history.push({
                pathname: location.pathname,
                search: searchURL
            });
        }
    }, [sortChoice]);

    /**
     * Update the URL query with the display mode
     * AFTER a search has been performed and a
     * change has been made.
     */
    useEffect(() => {
        if (initialSearch.current) {
            let searchURL = updateParams(location.search, 'mode', displayChoice);
            history.push({
                pathname: location.pathname,
                search: searchURL
            });
        }
    }, [displayChoice]);

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
        if ((Object.keys(params).length > 0) && (!initialSearch.current)) {
            // enable results for those entering a direct search URL
            initialSearch.current = true;
        }
        if (params.mode && params.mode !== displayChoice) {
            if ((params.mode === 'visual') || (params.mode === 'itemized')) {
                setDisplayChoice(params.mode);
            }
        }
        if (params.items && params.items !== itemsPerPage) {
            if (!isNaN(parseInt(params.items))) {
                setItemsPerPage(params.items);
            }
        }
        if ((params.search !== undefined) && (params.search !== searchString)) {
            setSearchString(params.search);
        }
        if ((params.sort !== undefined) && (params.sort !== sortChoice)) {
            setSortChoice(params.sort);
        }
        if ((params.library !== undefined) && (params.library !== libraryFilter)) {
            setLibraryFilter(params.library);
        }
        if ((params.subject !== undefined) && (params.subject !== subjectFilter)) {
            setSubjectFilter(params.subject);
        }
        if ((params.location !== undefined) && (params.location !== locationFilter)) {
            setLocationFilter(params.location);
        }
        if ((params.license !== undefined) && (params.license !== licenseFilter)) {
            setLicenseFilter(params.license);
        }
        if ((params.author !== undefined) && (params.author !== authorFilter)) {
            setAuthorFilter(params.author);
        }
        if ((params.affiliation !== undefined) && (params.affiliation !== affilFilter)) {
            setAffilFilter(params.affiliation);
        }
        if ((params.course !== undefined) && (params.course !== courseFilter)) {
            setCourseFilter(params.course);
        }
        if ((params.publisher !== undefined) && (params.publisher !== pubFilter)) {
            setPubFilter(params.publisher);
        }
        if (!checkedParams.current) { // set the initial URL params sync to complete
            checkedParams.current = true;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.search]);

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
                                    loading='lazy'
                                />
                                <Card.Content>
                                    <Card.Header as='h3' className='commons-content-card-header'>{item.title}</Card.Header>
                                    <Card.Meta>
                                        <Image src={getLibGlyphURL(item.library)} className='library-glyph' />
                                        {getLibraryName(item.library)}
                                    </Card.Meta>
                                    <Card.Description>
                                        <p>{item.author}</p>
                                        <p><em>{item.affiliation}</em></p>
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
            <Table celled title='Search Results'>
                <Table.Header>
                    <Table.Row>
                        <Table.HeaderCell scope='col'>
                            <Image
                                centered
                                src={getLibGlyphURL('')}
                                className='commons-itemized-glyph'
                                alt={getLibGlyphAltText('')}
                            />
                        </Table.HeaderCell>
                        <Table.HeaderCell scope='col'><Header sub>Title</Header></Table.HeaderCell>
                        <Table.HeaderCell scope='col'><Header sub>Subject</Header></Table.HeaderCell>
                        <Table.HeaderCell scope='col'><Header sub>Author</Header></Table.HeaderCell>
                        <Table.HeaderCell scope='col'><Header sub>Affiliation</Header></Table.HeaderCell>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {(pageBooks.length > 0) &&
                        pageBooks.map((item, index) => {
                            return (
                                <Table.Row key={index}>
                                    <Table.Cell>
                                        <Image
                                            centered
                                            src={getLibGlyphURL(item.library)}
                                            className='commons-itemized-glyph'
                                            alt={getLibGlyphAltText(item.library)}
                                        />
                                    </Table.Cell>
                                    <Table.Cell>
                                        <p><strong><Link to={`/book/${item.bookID}`}>{item.title}</Link></strong></p>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <p>{item.subject}</p>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <p>{item.author}</p>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <p><em>{item.affiliation}</em></p>
                                    </Table.Cell>
                                </Table.Row>
                            )
                        })
                    }
                    {(pageBooks.length === 0) &&
                        <Table.Row>
                            <Table.Cell colSpan={5}>
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
                        {((org.commonsHeader && org.commonsHeader !== '') || (org.commonsMessage && org.commonsMessage !== '')) &&
                            <Segment padded>
                                <Breakpoint name='desktop'>
                                    {(org.commonsHeader && org.commonsHeader !== '') && (
                                      <Header id='commons-intro-header' as='h2'>{org.commonsHeader}</Header>
                                    )}
                                    <p id='commons-intro-message'>{org.commonsMessage}</p>
                                </Breakpoint>
                                <Breakpoint name='mobileOrTablet'>
                                    {(org.commonsHeader && org.commonsHeader !== '') && (
                                      <Header id='commons-intro-header' textAlign='center' as='h2'>{org.commonsHeader}</Header>
                                    )}
                                    <p id='commons-intro-message' className='text-center'>{org.commonsMessage}</p>
                                </Breakpoint>
                            </Segment>
                        }
                        <Segment>
                            <div id='commons-searchbar-container'>
                                <Form onSubmit={performSearch}>
                                    <Form.Input
                                        icon='search'
                                        placeholder='Search...'
                                        className='color-libreblue'
                                        id='commons-search-input'
                                        iconPosition='left'
                                        onChange={(e) => {
                                            setSearchString(e.target.value);
                                        }}
                                        fluid
                                        value={searchString}
                                        aria-label='Search query'
                                    />
                                </Form>
                            </div>
                            <div id='commons-searchbtns-container'>
                                <Button
                                    fluid
                                    id='commons-search-button'
                                    onClick={performSearch}
                                >
                                    Search Catalog
                                </Button>
                                {(initialSearch.current) &&
                                    <Button
                                        fluid
                                        id='commons-reset-button'
                                        onClick={resetSearch}
                                    >
                                        Clear
                                    </Button>
                                }
                                <button
                                    id='commons-advancedsrch-button'
                                    onClick={() => { setShowFilters(!showFilters) }}
                                >
                                    <Icon name={showFilters ? 'caret down' : 'caret right'} />
                                        <span>Advanced Search</span>
                                    <Icon name={showFilters ? 'caret down' : 'caret left'} />
                                </button>
                            </div>
                            <div id='commons-advancedsrch-container' className={showFilters ? 'commons-advancedsrch-show' : 'commons-advancedsrch-hide'}>
                                <div id='commons-advancedsrch-row1' className='commons-advancedsrch-row'>
                                    <Dropdown
                                        placeholder='Library'
                                        floating
                                        selection
                                        button
                                        options={libraryOptions}
                                        onChange={(_e, { value }) => {
                                            setLibraryFilter(value);
                                        }}
                                        value={libraryFilter}
                                        className='commons-filter'
                                        aria-label='Library filter'
                                    />
                                    <Dropdown
                                        placeholder='Location'
                                        floating
                                        search
                                        selection
                                        button
                                        options={catalogLocationOptions}
                                        onChange={(_e, { value }) => {
                                            setLocationFilter(value);
                                        }}
                                        value={locationFilter}
                                        className='commons-filter'
                                        aria-label='Location filter'
                                    />
                                    <Dropdown
                                        placeholder='Subject'
                                        floating
                                        search
                                        selection
                                        button
                                        options={subjectOptions}
                                        onChange={(_e, { value }) => {
                                            setSubjectFilter(value);
                                        }}
                                        value={subjectFilter}
                                        loading={!loadedFilters}
                                        className='commons-filter'
                                    />
                                </div>
                                <div id='commons-advancedsrch-row2' className='commons-advancedsrch-row'>
                                    <Dropdown
                                        placeholder='Author'
                                        floating
                                        search
                                        selection
                                        button
                                        options={authorOptions}
                                        onChange={(_e, { value }) => {
                                            setAuthorFilter(value);
                                        }}
                                        value={authorFilter}
                                        loading={!loadedFilters}
                                        className='commons-filter'
                                    />
                                    <Dropdown
                                        placeholder='Affiliation'
                                        floating
                                        search
                                        selection
                                        button
                                        options={affOptions}
                                        onChange={(_e, { value }) => {
                                            setAffilFilter(value);
                                        }}
                                        value={affilFilter}
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
                                            setLicenseFilter(value);
                                        }}
                                        value={licenseFilter}
                                        className='commons-filter'
                                    />
                                </div>
                                <div id='commons-advancedsrch-row3' className='commons-advancedsrch-row'>
                                    <Dropdown
                                        placeholder='Instructor/Remixer'
                                        floating
                                        search
                                        selection
                                        button
                                        options={[]}
                                        onChange={(_e, { value }) => {
                                            setInstrFilter(value);
                                        }}
                                        value={instrFilter}
                                        disabled
                                        tabIndex={-1}
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
                                            setCourseFilter(value);
                                        }}
                                        value={courseFilter}
                                        loading={!loadedFilters}
                                        className='commons-filter'
                                    />
                                    <Dropdown
                                        placeholder='Publisher'
                                        floating
                                        search
                                        selection
                                        button
                                        options={pubOptions}
                                        onChange={(_e, { value }) => {
                                            setPubFilter(value);
                                        }}
                                        value={pubFilter}
                                        loading={!loadedFilters}
                                        className='commons-filter'
                                    />
                                </div>
                            </div>
                        </Segment>
                        <Segment>
                            <Breakpoint name='desktop'>
                                <div className='commons-content-pagemenu'>
                                    <div className='commons-content-pagemenu-left'>
                                        <span>Displaying </span>
                                        <Dropdown
                                            className='commons-content-pagemenu-dropdown'
                                            selection
                                            options={catalogItemsPerPageOptions}
                                            onChange={(_e, { value }) => {
                                                setItemsPerPage(value);
                                            }}
                                            value={itemsPerPage}
                                            aria-label='Number of results to display per page'
                                        />
                                        <span> items per page of <strong>{Number(catalogBooks.length).toLocaleString()}</strong> results.</span>
                                    </div>
                                    <div className='commons-content-pagemenu-center'>
                                        <ConductorPagination
                                            activePage={activePage}
                                            totalPages={totalPages}
                                            firstItem={null}
                                            lastItem={null}
                                            onPageChange={setActivePage}
                                        />
                                    </div>
                                    <div className='commons-content-pagemenu-right'>
                                        <Dropdown
                                            placeholder='Sort by...'
                                            floating
                                            selection
                                            button
                                            options={sortOptions}
                                            onChange={(_e, { value }) => {
                                                setSortChoice(value);
                                            }}
                                            value={sortChoice}
                                            aria-label='Sort results by'
                                        />
                                        <Dropdown
                                            placeholder='Display mode...'
                                            floating
                                            selection
                                            button
                                            options={catalogDisplayOptions}
                                            onChange={(_e, { value }) => {
                                                setDisplayChoice(value);
                                            }}
                                            value={displayChoice}
                                            aria-label='Set results display mode'
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
                                                    options={catalogItemsPerPageOptions}
                                                    onChange={(_e, { value }) => {
                                                        setItemsPerPage(value);
                                                    }}
                                                    value={itemsPerPage}
                                                    aria-label='Number of results to display per page'
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
                                                options={catalogDisplayOptions}
                                                onChange={(_e, { value }) => {
                                                    setDisplayChoice(value);
                                                }}
                                                value={displayChoice}
                                                fluid
                                                aria-label='Set results display mode'
                                            />
                                            <Dropdown
                                                placeholder='Sort by...'
                                                floating
                                                selection
                                                button
                                                options={sortOptions}
                                                onChange={(_e, { value }) => {
                                                    setSortChoice(value);
                                                }}
                                                value={sortChoice}
                                                fluid
                                                className='commons-filter'
                                                aria-label='Sort results by'
                                            />
                                        </Grid.Column>
                                    </Grid.Row>
                                    <Grid.Row columns={1}>
                                        <Grid.Column className='commons-pagination-mobile-container'>
                                            <ConductorPagination
                                                activePage={activePage}
                                                totalPages={totalPages}
                                                siblingRange={1}
                                                firstItem={null}
                                                lastItem={null}
                                                onPageChange={setActivePage}
                                            />
                                        </Grid.Column>
                                    </Grid.Row>
                                </Grid>
                            </Breakpoint>
                        </Segment>
                        <Segment
                          className={(displayChoice === 'visual') ? 'commons-content' : 'commons-content commons-content-itemized'}
                          loading={!loadedData}
                          aria-live="polite"
                          aria-busy={!loadedData}
                        >
                            {displayChoice === 'visual'
                                ? (<VisualMode />)
                                : (<ItemizedMode />)
                            }
                        </Segment>
                        <Segment>
                            <Breakpoint name='desktop'>
                                <div className='commons-content-pagemenu'>
                                    <div className='commons-content-pagemenu-left'>
                                        <span>Displaying </span>
                                        <Dropdown
                                            className='commons-content-pagemenu-dropdown'
                                            selection
                                            options={catalogItemsPerPageOptions}
                                            onChange={(_e, { value }) => {
                                                setItemsPerPage(value);
                                            }}
                                            value={itemsPerPage}
                                            aria-label='Number of results to display per page'
                                        />
                                        <span> items per page of <strong>{Number(catalogBooks.length).toLocaleString()}</strong> results.</span>
                                    </div>
                                    <div className='commons-content-pagemenu-right'>
                                        <ConductorPagination
                                            activePage={activePage}
                                            totalPages={totalPages}
                                            firstItem={null}
                                            lastItem={null}
                                            onPageChange={setActivePage}
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
                                                    options={catalogItemsPerPageOptions}
                                                    onChange={(_e, { value }) => {
                                                        setItemsPerPage(value);
                                                    }}
                                                    value={itemsPerPage}
                                                    aria-label='Number of results to display per page'
                                                />
                                                <span> items per page of <strong>{Number(catalogBooks.length).toLocaleString()}</strong> results.</span>
                                            </div>
                                        </Grid.Column>
                                    </Grid.Row>
                                    <Grid.Row columns={1}>
                                        <Grid.Column className='commons-pagination-mobile-container'>
                                            <ConductorPagination
                                                activePage={activePage}
                                                totalPages={totalPages}
                                                siblingRange={1}
                                                firstItem={null}
                                                lastItem={null}
                                                onPageChange={setActivePage}
                                            />
                                        </Grid.Column>
                                    </Grid.Row>
                                </Grid>
                            </Breakpoint>
                        </Segment>
                    </Segment.Group>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )
}

export default CommonsCatalog;
