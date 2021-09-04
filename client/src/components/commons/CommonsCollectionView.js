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
    Header
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useHistory } from 'react-router-dom';
import Breakpoint from '../util/Breakpoints.js';
import axios from 'axios';
//import queryString from 'query-string';

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
import { catalogItemsPerPageOptions } from '../util/PaginationOptions.js';
import { catalogDisplayOptions } from '../util/CatalogOptions.js';
import { updateParams, isEmptyString } from '../util/HelperFunctions.js';

const CommonsCollectionView = (props) => {

    const { handleGlobalError } = useGlobalError();

    // Global State and Location/History
    const dispatch = useDispatch();
    const location = useLocation();
    const history = useHistory();
    const org = useSelector((state) => state.org);

    // Data
    const [collName, setCollName] = useState('');
    const [collBooks, setCollBooks] = useState([]);
    const [displayBooks, setDisplayBooks] = useState([]);
    const [pageBooks, setPageBooks] = useState([]);

    /** UI **/
    const [itemsPerPage, setItemsPerPage] = useState(12);
    const [totalPages, setTotalPages] = useState(1);
    const [activePage, setActivePage] = useState(1);
    const [loadedData, setLoadedData] = useState(false);

    // Sort and Search Filters
    const [sortChoice, setSortChoice] = useState('title');
    const [searchString, setSearchString] = useState('');
    const [displayChoice, setDisplayChoice] = useState('visual');

    const sortOptions = [
        { key: 'title', text: 'Sort by Title', value: 'title' },
        { key: 'author', text: 'Sort by Author', value: 'author' }
    ];

    /**
     * Load books from server
     */
    useEffect(() => {
        getCollectionBooks();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * Update the page title based on
     * Organization information.
     */
    useEffect(() => {
        if (process.env.REACT_APP_ORG_ID && process.env.REACT_APP_ORG_ID !== 'libretexts' && org.shortName && collName !== '') {
            document.title = org.shortName + " Commons | Collection " + collName;
        } else if (process.env.REACT_APP_ORG_ID && process.env.REACT_APP_ORG_ID !== 'libretexts' && org.shortName) {
            document.title = org.shortName + " Commons | Collection";
        } else {
            document.title = "LibreCommons | Collection";
        }
    }, [org, collName]);

    /**
     * Perform GET request for books
     * and update collBooks.
     */
    const getCollectionBooks = () => {
        axios.get('/commons/collection', {
            params: {
                collID: props.match.params.id
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.coll) {
                    if (res.data.coll.title) {
                        setCollName(res.data.coll.title);
                    }
                    if (res.data.coll.resources && Array.isArray(res.data.coll.resources)) {
                        setCollBooks(res.data.coll.resources);
                    }
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
     * Track changes to the number of books loaded
     * and the selected itemsPerPage and update the
     * set of books to display.
     */
    useEffect(() => {
        setTotalPages(Math.ceil(displayBooks.length/itemsPerPage));
        setPageBooks(displayBooks.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage));
    }, [itemsPerPage, displayBooks, activePage]);


    /**
     * Filter and sort books according to
     * user's choices, then update the list.
     */
    useEffect(() => {
        filterAndSortBooks();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [collBooks, searchString, sortChoice]);

    /**
     * Filter and sort books according
     * to current filters and sort
     * choice.
     */
    const filterAndSortBooks = () => {
        setLoadedData(false);
        let filtered = collBooks.filter((book) => {
            var include = true;
            var descripString = String(book.title).toLowerCase() + String(book.author).toLowerCase() +
                String(book.library).toLowerCase() + String(book.subject).toLowerCase() +
                String(book.license).toLowerCase();
            if (searchString !== '' && String(descripString).indexOf(String(searchString).toLowerCase()) === -1) {
                include = false;
            }
            if (include) {
                return book;
            } else {
                return false;
            }
        });
        if (sortChoice === 'title') {
            const sorted = [...filtered].sort((a, b) => {
                var normalA = String(a.title).toLowerCase().replace(/[^A-Za-z]+/g, "");
                var normalB = String(b.title).toLowerCase().replace(/[^A-Za-z]+/g, "");
                if (normalA < normalB) {
                    return -1;
                }
                if (normalA > normalB) {
                    return 1;
                }
                return 0;
            });
            setDisplayBooks(sorted);
        } else if (sortChoice === 'author') {
            const sorted = [...filtered].sort((a, b) => {
                var normalA = String(a.author).toLowerCase().replace(/[^A-Za-z]+/g, "");
                var normalB = String(b.author).toLowerCase().replace(/[^A-Za-z]+/g, "");
                if (normalA < normalB) {
                    return -1;
                }
                if (normalA > normalB) {
                    return 1;
                }
                return 0;
            });
            setDisplayBooks(sorted);
        }
        setLoadedData(true);
    }

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
            <Table celled>
                <Table.Header>
                    <Table.Row>
                        <Table.HeaderCell width={5}><Header sub>Title</Header></Table.HeaderCell>
                        <Table.HeaderCell width={2}><Header sub>Author</Header></Table.HeaderCell>
                        <Table.HeaderCell width={2}><Header sub>Library</Header></Table.HeaderCell>
                        <Table.HeaderCell width={3}><Header sub>Affiliation</Header></Table.HeaderCell>
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
                                    <Table.Cell>
                                        <p><em>{item.affiliation}</em></p>
                                    </Table.Cell>
                                </Table.Row>
                            )
                        })
                    }
                    {(pageBooks.length === 0) &&
                        <Table.Row>
                            <Table.Cell colSpan={4}>
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
                                <Header size='large'>{collName}</Header>
                            </Breakpoint>
                            <Breakpoint name='mobileOrTablet'>
                                <Header size='large' textAlign='center'>{collName}</Header>
                            </Breakpoint>
                        </Segment>
                        <Segment>
                            <Breakpoint name='desktop'>
                                <Grid>
                                    <Grid.Row>
                                        <Grid.Column width={10}>
                                            <Dropdown
                                                placeholder='Sort by...'
                                                floating
                                                selection
                                                button
                                                className='commons-filter'
                                                options={sortOptions}
                                                onChange={(_e, { value }) => {
                                                    setSortChoice(value);
                                                }}
                                                value={sortChoice}
                                            />
                                        </Grid.Column>
                                        <Grid.Column width={6}>
                                            <Input
                                                icon='search'
                                                iconPosition='left'
                                                placeholder='Search...'
                                                className='commons-filter'
                                                onChange={(e) => { setSearchString(e.target.value) }}
                                                value={searchString}
                                                fluid
                                            />
                                        </Grid.Column>
                                    </Grid.Row>
                                </Grid>
                            </Breakpoint>
                            <Breakpoint name='mobileOrTablet'>
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
                                            options={catalogItemsPerPageOptions}
                                            onChange={(_e, { value }) => {
                                                setItemsPerPage(value);
                                            }}
                                            value={itemsPerPage}
                                        />
                                        <span> items per page of <strong>{Number(displayBooks.length).toLocaleString()}</strong> results.</span>
                                    </div>
                                    <div className='commons-content-pagemenu-center'>
                                        <Pagination
                                            activePage={activePage}
                                            totalPages={totalPages}
                                            firstItem={null}
                                            lastItem={null}
                                            onPageChange={(_e, data) => { setActivePage(data.activePage) }}
                                        />
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
                                                setDisplayChoice(value);
                                            }}
                                            value={displayChoice}
                                        />
                                    </div>
                                </div>
                            </Breakpoint>
                            <Breakpoint name='mobileOrTablet'>
                                <Grid>
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
                                                    setDisplayChoice(value);
                                                }}
                                                value={displayChoice}
                                                fluid
                                            />
                                        </Grid.Column>
                                    </Grid.Row>
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
                                                />
                                                <span> items per page of <strong>{Number(displayBooks.length).toLocaleString()}</strong> results.</span>
                                            </div>
                                        </Grid.Column>
                                    </Grid.Row>
                                    <Grid.Row columns={1}>
                                        <Grid.Column className='commons-pagination-mobile-container'>
                                            <Pagination
                                                activePage={activePage}
                                                totalPages={totalPages}
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
                                        />
                                        <span> items per page of <strong>{Number(displayBooks.length).toLocaleString()}</strong> results.</span>
                                    </div>
                                    <div className='commons-content-pagemenu-right'>
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
                                                    options={catalogItemsPerPageOptions}
                                                    onChange={(_e, { value }) => {
                                                        setItemsPerPage(value);
                                                    }}
                                                    value={itemsPerPage}
                                                />
                                                <span> items per page of <strong>{Number(displayBooks.length).toLocaleString()}</strong> results.</span>
                                            </div>
                                        </Grid.Column>
                                    </Grid.Row>
                                    <Grid.Row columns={1}>
                                        <Grid.Column className='commons-pagination-mobile-container'>
                                            <Pagination
                                                activePage={activePage}
                                                totalPages={totalPages}
                                                firstItem={null}
                                                lastItem={null}
                                                onPageChange={(_e, data) => { setActivePage(data.activePage) }}
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

export default CommonsCollectionView;
