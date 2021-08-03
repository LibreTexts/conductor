import './Commons.css';

import { Link } from 'react-router-dom';
import { Grid, Image, Dropdown, Segment, Input, Pagination, Card } from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
//import axios from 'axios';

import {
    libraryOptions,
    getShelfOptions,
    licenseOptions,
    getGlyphAddress,
    getLibraryName
} from '../util/HarvestingMasterOptions.js';

import { getDemoBooks } from '../util/DemoBooks.js';

const CommonsCatalog = (props) => {

    const [catalogBooks, setCatalogBooks] = useState([]);
    const [filteredBooks, setFilteredBooks] = useState([]);

    const [libraryFilter, setLibraryFilter] = useState('');
    const [subjectFilter, setSubjectFilter] = useState('');
    const [subjectOptions, setSubjectOptions] = useState([]);
    const [disableSubjectFilter, setDisableSubjectFilter] = useState(true);

    const [authorFilter, setAuthorFilter] = useState('');
    const [authorOptions, setAuthorOptions] = useState([]);
    const [licenseFilter, setLicenseFilter] = useState('');


    const [sortChoice, setSortChoice] = useState('');
    const [searchString, setSearchString] = useState('');

    const sortOptions = [
        { key: 'empty', text: 'Sort by...', value: '' },
        { key: 'title', text: 'Sort by Title', value: 'title' },
        { key: 'author', text: 'Sort by Author', value: 'author' }
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
        filteredBooks.forEach((item, index) => {
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


    return (
        <Grid className='commons-container'>
            <Grid.Row>
                <Grid.Column>
                    <Segment.Group raised>
                        <Segment>
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
                                        />
                                        <Dropdown
                                            placeholder='Author'
                                            floating
                                            selection
                                            button
                                            options={authorOptions}
                                            onChange={(e, { value }) => { setAuthorFilter(value) }}
                                            value={authorFilter}
                                        />
                                        <Dropdown
                                            placeholder='License'
                                            floating
                                            selection
                                            button
                                            options={licenseOptions}
                                            onChange={(e, { value }) => { setLicenseFilter(value) }}
                                            value={licenseFilter}
                                        />
                                    </Grid.Column>
                                    <Grid.Column width={6}>
                                        <Input
                                            icon='search'
                                            placeholder='Search...'
                                            className='float-right'
                                            onChange={(e) => { setSearchString(e.target.value) }}
                                            value={searchString}
                                        />
                                        <Dropdown
                                            placeholder='Sort by...'
                                            floating
                                            selection
                                            button
                                            className='float-right'
                                            options={sortOptions}
                                            onChange={(e, { value }) => { setSortChoice(value) }}
                                            value={sortChoice}
                                        />
                                    </Grid.Column>
                                </Grid.Row>
                            </Grid>
                        </Segment>
                        <Segment>
                            <div className='commons-content-pagemenu'>
                                <div className='commons-content-pagemenu-left'>
                                    <span>Displaying </span>
                                    <Dropdown
                                        text='10'
                                        className='commons-content-pagemenu-dropdown'
                                    />
                                    <span> items per page of <strong>{filteredBooks.length}</strong> results.</span>
                                </div>
                                <div className='commons-content-pagemenu-right'>
                                    <Pagination
                                        defaultActivePage={1}
                                        totalPages={1}
                                        boundaryRange={1}
                                        siblingRange={1}
                                        firstItem={null}
                                        lastItem={null}
                                    />
                                </div>
                            </div>
                        </Segment>
                        <Segment className='commons-content'>
                            {(filteredBooks.length > 0) &&
                                <Card.Group itemsPerRow={5}>
                                    {filteredBooks.map((item, index) => {
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
                                                        <Image src={getGlyphAddress(item.library)} className='commons-content-glyph' />
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
                            }
                            {(filteredBooks.length === 0) &&
                                <p className='text-center'>No results found.</p>
                            }
                        </Segment>
                    </Segment.Group>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )
}

export default CommonsCatalog;
