import '../../../components/commons/Commons.css';
import {
    Breadcrumb,
    Card,
    Dropdown,
    Grid,
    Header,
    Image,
    Input,
    PaginationProps,
    Segment,
    Table,
} from 'semantic-ui-react';
import Breakpoint from '../../../components/util/Breakpoints';
import { catalogDisplayOptions } from '../../../components/util/CatalogOptions';
import {
    getLibGlyphURL,
    getLibGlyphAltText,
    getLibraryName
} from '../../../components/util/LibraryOptions';
import { Link, useParams } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import useGlobalError from '../../../components/error/ErrorHooks';
import { useQuery } from '@tanstack/react-query';
import { useTypedSelector } from "../../../state/hooks";
import api from "../../../api";
import {isBook} from "../../../utils/typeHelpers";
import {PaginationWithItemsSelect} from "../../../components/util/PaginationWithItemsSelect";

const CommonsCollection: React.FC<{}> = () => {
    const { handleGlobalError } = useGlobalError();
    const params = useParams<{ id: string }>();
    const org = useTypedSelector((state) => state.org);
    const [limit, setLimit] = useState(12);
    const [page, setPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [sort, setSort] = useState('title');
    const [query, setQuery] = useState<string | null>(null);
    const [displayChoice, setDisplayChoice] = useState('visual');

    const sortOptions = [
        { key: 'title', text: 'Sort by Title', value: 'title' },
        { key: 'author', text: 'Sort by Author', value: 'author' }
    ];

    const { data: collection, isFetching: collectionLoading } = useQuery({
        queryKey: ['collection', params.id],
        queryFn: () => getCollection(),
        refetchOnWindowFocus: false,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    async function getCollection() {
        try {
            const collRes = await api.getCollection(params.id);
            if (collRes.data.err) {
                throw new Error(collRes.data.errMsg);
            }
            return collRes.data.coll;
        } catch (err) {
            handleGlobalError(err);
        }
        return null;
    }

    const { data: resources, isFetching: resourcesLoading, isSuccess: resourcesLoaded } = useQuery({
        keepPreviousData: true,
        queryKey: ['collection-resources', params.id, sort, limit, page, query],
        queryFn: () => getCollectionResources({
            collIDOrTitle: collection?.collID,
            limit,
            page,
            query,
            sort,
        }),
        refetchOnWindowFocus: false,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    async function getCollectionResources(input : {
        collIDOrTitle?: string;
        limit?: number;
        page?: number;
        query?: string | null;
        sort?: string;
    }) {
        if (!input.collIDOrTitle) return [];
        try {
            const collRes = await api.getCollectionResources(input);
            if (collRes.data.err) {
                throw new Error(collRes.data.errMsg);
            }
            return collRes.data.resources;
        } catch (err) {
            handleGlobalError(err);
        }
        return [];
    }

    /**
     * Update the page title based on Organization information.
     */
    useEffect(() => {
        if (org.orgID !== 'libretexts' && collection?.title !== '') {
            document.title = `${org.shortName} Commons | Collections | ${collection?.title}`;
        } else if (org.orgID === 'libretexts' &&  collection?.title !== '') {
            document.title = `LibreCommons | Collections | ${collection?.title}`;
        } else {
            document.title = `LibreCommons | Collection`;
        }
    }, [org, collection?.title]);

    const VisualMode = () => {
        if (resourcesLoaded && resources.length > 0) {
            return (
                <div className='commons-content-card-grid'>
                    {resources.map((item, index) => {
                        const resourceData = item.resourceData;
                        const book = isBook(resourceData);
                        return (
                            <Card
                                key={index}
                                as={Link}
                                to={`/book/${item.resourceID}`}
                                className='commons-content-card'
                            >
                                <div
                                    className='commons-content-card-img'
                                    style={{backgroundImage: `url(${book ? resourceData.thumbnail : resourceData.coverPhoto})`}}
                                />
                                <Card.Content>
                                    <Card.Header className='commons-content-card-header'>{resourceData.title}</Card.Header>
                                    <Card.Meta>
                                        <Image src={getLibGlyphURL(book ? resourceData.library : '')} className='library-glyph' />
                                        {getLibraryName(book ? resourceData.library : '')}
                                    </Card.Meta>
                                    <Card.Description>
                                        <p>{book ? resourceData.author : ''}</p>
                                        <p><em>{book ? resourceData.affiliation : ''}</em></p>
                                    </Card.Description>
                                </Card.Content>
                            </Card>
                        )
                    })}
                </div>
            )
        } else {
            return (
                <p className='text-center'><em>No results found.</em></p>
            );
        }
    };

    const ItemizedMode = () => {
        return (
            <Table celled title='Collection Resources'>
                <Table.Header>
                    <Table.Row>
                        <Table.HeaderCell scope='col' role='columnheader'>
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
                    {(resourcesLoaded && resources.length > 0) &&
                        resources.map((item, index) => {
                            const resourceData = item.resourceData;
                            const book = isBook(resourceData);
                            return (
                                <Table.Row key={index}>
                                    <Table.Cell>
                                        <Image
                                            centered
                                            src={getLibGlyphURL(book ? resourceData.library : '')}
                                            className='commons-itemized-glyph'
                                            alt={getLibGlyphAltText(book ? resourceData.library : '')}
                                        />
                                    </Table.Cell>
                                    <Table.Cell>
                                        <p><strong><Link to={`/book/${book ? resourceData.bookID : ''}`}>{resourceData.title}</Link></strong></p>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <p>{book ? resourceData.subject : ''}</p>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <p>{book ? resourceData.author : ''}</p>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <p><em>{book ? resourceData.affiliation : ''}</em></p>
                                    </Table.Cell>
                                </Table.Row>
                            )
                        })
                    }
                    {(resourcesLoaded && resources.length === 0) &&
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

    const CollectionsPagination = () => (
        <PaginationWithItemsSelect
            activePage={page}
            activeSort={sort}
            itemsPerPage={limit}
            setActivePageFn={setPage}
            setActiveSortFn={setSort}
            setItemsPerPageFn={setLimit}
            sort={true}
            sortOptions={sortOptions.map((s) => s.value)}
            totalLength={totalItems}
            totalPages={totalPages}
        />
    );

    return (
        <Grid className='commons-container'>
            <Grid.Row>
                <Grid.Column>
                    <Segment.Group raised>
                        <Segment>
                            <Breadcrumb>
                                <Breadcrumb.Section as={Link} to='/collections'>
                                    <span>
                                        <span className='muted-text'>You are on: </span>
                                        Collections
                                    </span>
                                </Breadcrumb.Section>
                                <Breadcrumb.Divider icon='right chevron' />
                                <Breadcrumb.Section active>
                                    {collection?.title}
                                </Breadcrumb.Section>
                            </Breadcrumb>
                        </Segment>
                        <Segment>
                            <Breakpoint name='desktop'>
                                <Header size='large' as='h2'>{collection?.title}</Header>
                            </Breakpoint>
                            <Breakpoint name='mobileOrTablet'>
                                <Header size='large' textAlign='center'>{collection?.title}</Header>
                            </Breakpoint>
                            <h2>CollectionScreen</h2>
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
                                                    setSort(value as string);
                                                }}
                                                value={sort}
                                                aria-label='Sort results by'
                                            />
                                        </Grid.Column>
                                        <Grid.Column width={6}>
                                            <Input
                                                icon='search'
                                                iconPosition='left'
                                                placeholder='Search...'
                                                className='commons-filter'
                                                onChange={(e) => { setQuery(e.target.value) }}
                                                value={query}
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
                                    onChange={(e) => { setQuery(e.target.value) }}
                                    value={query}
                                    fluid
                                    className='commons-filter'
                                />
                            </Breakpoint>
                        </Segment>
                        <Segment>
                            <Breakpoint name='desktop'>
                                <div className='commons-content-pagemenu'>
                                    <div className='commons-content-pagemenu-left'>
                                        <CollectionsPagination />
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
                                                setDisplayChoice(value as string);
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
                                            <Dropdown
                                                placeholder='Display mode...'
                                                floating
                                                selection
                                                button
                                                className='float-right'
                                                options={catalogDisplayOptions}
                                                onChange={(_e, { value }) => {
                                                    setDisplayChoice(value as string);
                                                }}
                                                value={displayChoice}
                                                fluid
                                                aria-label='Set results display mode'
                                            />
                                        </Grid.Column>
                                    </Grid.Row>
                                    <Grid.Row columns={1}>
                                        <Grid.Column>
                                            <div className='center-flex flex-wrap'>
                                                <CollectionsPagination />
                                            </div>
                                        </Grid.Column>
                                    </Grid.Row>
                                </Grid>
                            </Breakpoint>
                        </Segment>
                        <Segment
                            className={(displayChoice === 'visual') ? 'commons-content' : 'commons-content commons-content-itemized'}
                            loading={collectionLoading || resourcesLoading}
                        >
                            {displayChoice === 'visual'
                                ? (<VisualMode />)
                                : (<ItemizedMode />)
                            }
                        </Segment>
                        <Segment>
                            <Breakpoint name='desktop'>
                                <div className='commons-content-pagemenu'>
                                    <div className='commons-content-pagemenu-right'>
                                        <CollectionsPagination />
                                    </div>
                                </div>
                            </Breakpoint>
                            <Breakpoint name='mobileOrTablet'>
                                <Grid>
                                    <Grid.Row columns={1}>
                                        <Grid.Column className='commons-pagination-mobile-container'>
                                            <CollectionsPagination />
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

export default CommonsCollection;
