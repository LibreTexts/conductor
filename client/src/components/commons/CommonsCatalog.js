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
import Breakpoint from '../util/Breakpoints.js';
//import axios from 'axios';

import {
    libraryOptions,
    getShelfOptions,
    licenseOptions,
    getGlyphAddress,
    getLibraryName
} from '../util/HarvestingMasterOptions.js';

import { getDemoBooks } from '../util/DemoBooks.js';
import { itemsPerPageOptions } from '../util/PaginationOptions.js';

const CommonsCatalog = (props) => {

    // UI
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [activePage, setActivePage] = useState(1);
    const [showMobileFilters, setShowMobileFilters] = useState(false);

    const [catalogBooks, setCatalogBooks] = useState([]);
    const [filteredBooks, setFilteredBooks] = useState([]);
    const [pageBooks, setPageBooks] = useState([]);

    const [libraryFilter, setLibraryFilter] = useState('');
    const [subjectFilter, setSubjectFilter] = useState('');
    const [subjectOptions, setSubjectOptions] = useState([]);
    const [disableSubjectFilter, setDisableSubjectFilter] = useState(true);

    const [authorFilter, setAuthorFilter] = useState('');
    const [authorOptions, setAuthorOptions] = useState([]);
    const [licenseFilter, setLicenseFilter] = useState('');

    const [sortChoice, setSortChoice] = useState('');
    const [searchString, setSearchString] = useState('');
    const [displayChoice, setDisplayChoice] = useState('visual');

    const sortOptions = [
        { key: 'empty', text: 'Sort by...', value: '' },
        { key: 'title', text: 'Sort by Title', value: 'title' },
        { key: 'author', text: 'Sort by Author', value: 'author' }
    ];

    const displayOptions = [
        { key: 'visual', text: 'Visual Mode', value: 'visual' },
        { key: 'itemized', text: 'Itemized Mode', value: 'itemized' }
    ];

    useEffect(() => {
        const demoBooks = getDemoBooks(process.env.REACT_APP_ORG_ID);
        setCatalogBooks(demoBooks);
        setFilteredBooks(demoBooks);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        generateAuthorList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredBooks]);

    useEffect(() => {
        sortBooks();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortChoice]);

    useEffect(() => {
        setTotalPages(Math.ceil(filteredBooks.length/itemsPerPage));
        setPageBooks(filteredBooks.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage));
    }, [itemsPerPage, filteredBooks, activePage]);


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

    const setLibrary = (e, { value }) => {
        const newShelfOptions = getShelfOptions(value);
        setLibraryFilter(value);
        setSubjectFilter('');
        setSubjectOptions(newShelfOptions[0]);
        setDisableSubjectFilter(newShelfOptions[1]);
    };

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
        if (pageBooks.length > 0) {
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
                        {pageBooks.map((item, index) => {
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
                        })}
                    </Table.Body>
                </Table>
            )
        } else {
            return (
                <p className='text-center'><em>No results found.</em></p>
            )
        }
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
                                                onChange={(e, { value }) => { setSubjectFilter(value) }}
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
                                                onChange={(e, { value }) => { setAuthorFilter(value) }}
                                                value={authorFilter}
                                                className='commons-filter'
                                            />
                                            <Dropdown
                                                placeholder='License'
                                                floating
                                                selection
                                                button
                                                options={licenseOptions}
                                                onChange={(e, { value }) => { setLicenseFilter(value) }}
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
                                                onChange={(e, { value }) => { setSortChoice(value) }}
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
                                            onChange={(e, { value }) => { setSubjectFilter(value) }}
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
                                            onChange={(e, { value }) => { setAuthorFilter(value) }}
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
                                            onChange={(e, { value }) => { setLicenseFilter(value) }}
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
                                            onChange={(e, { value }) => { setSortChoice(value) }}
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
                                            onChange={(_e, { value }) => { setItemsPerPage(value) }}
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
                                            options={displayOptions}
                                            onChange={(e, { value }) => { setDisplayChoice(value) }}
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
                                                    onChange={(_e, { value }) => { setItemsPerPage(value) }}
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
                                                options={displayOptions}
                                                onChange={(e, { value }) => { setDisplayChoice(value) }}
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
                                <Segment className='commons-content'>
                                    <VisualMode />
                                </Segment>
                            )
                            : (
                                <Segment className='commons-content commons-content-itemized'>
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
