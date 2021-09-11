import './Commons.css';

import {
    Grid,
    Image,
    Icon,
    Segment,
    Header,
    Button,
    Accordion,
    List
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import axios from 'axios';

import Breakpoint from '../util/Breakpoints.js';
import useGlobalError from '../error/ErrorHooks.js';
import {
    getLibGlyphURL,
    getLibraryName
} from '../util/LibraryOptions.js';
import { getLicenseText } from '../util/LicenseOptions.js';
import { isEmptyString } from '../util/HelperFunctions.js';

import AdoptionReport from '../adoptionreport/AdoptionReport.js';

const CommonsBook = (props) => {

    const { handleGlobalError } = useGlobalError();

    // Data
    const [book, setBook] = useState({
        bookID: '',
        title: '',
        author: '',
        library: '',
        subject: '',
        course: '',
        license: '',
        thumbnail: '',
        links: {
            online: '',
            pdf: '',
            buy: '',
            zip: '',
            files: '',
            lms: '',
        },
        affiliation: ''
    });
    const [bookSummary, setBookSummary] = useState('');
    const [bookChapters, setBookChapters] = useState([]);

    // UI
    const [showMobileReadingOpts, setShowMobileReadingOpts] = useState(false);
    const [showAdoptionReport, setShowAdoptionReport] = useState(false);
    const [loadedData, setLoadedData] = useState(false);
    const [loadedSummary, setLoadedSummary] = useState(false);
    const [loadedTOC, setLoadedTOC] = useState(false);

    /**
     * Retrieve book data from the server.
     */
    useEffect(() => {
        axios.get('/commons/book', {
            params: {
                bookID: props.match.params.id
            }
        }).then((res) => {
            if (!res.data.err) {
                setBook(res.data.book);
                getBookSummary();
                getBookTOC();
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setLoadedData(true);
        }).catch((err) => {
            handleGlobalError(err);
            setLoadedData(true);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    /**
     * Update page title.
     */
    useEffect(() => {
        if (book.title && book.title !== '') {
            document.title = "LibreCommons | " + book.title;
        }
    }, [book]);

    /**
     * Retrieve the book summary from
     * the server.
     */
    const getBookSummary = () => {
        axios.get('/commons/book/summary', {
            params: {
                bookID: props.match.params.id
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.summary) {
                    var summary = String(res.data.summary);
                    if (summary[summary.length - 1] !== '.') {
                        summary = summary.slice(0, summary.length-1) + "...";
                    }
                    setBookSummary(summary);
                }
            } else {
                console.log(res.data.errMsg);
            }
            setLoadedSummary(true);
        }).catch((err) => {
            console.log(err); // fail silently
            setLoadedSummary(true);
        });
    };

    /**
     * Retrieve the book's Table of Contents
     * from the server and build the UI list,
     * then push to state.
     */
    const getBookTOC = () => {
        axios.get('/commons/book/toc', {
            params: {
                bookID: props.match.params.id
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.toc && Array.isArray(res.data.toc)) {
                    var chapterPanels = [];
                    res.data.toc.forEach((chapter) => {
                        var chapterPages = null;
                        if (chapter.pages && Array.isArray(chapter.pages)) {
                            chapterPages = (
                                <List
                                    selection
                                    verticalAlign='middle'
                                    className='commons-toc-pagelist'
                                >
                                    {chapter.pages.map((item, idx) => {
                                        return (
                                            <List.Item
                                                key={idx}
                                            >
                                                <List.Header
                                                    as='a'
                                                    href={item.link}
                                                    target='_blank'
                                                    rel='noopener noreferrer'
                                                >
                                                    {item.title}
                                                </List.Header>
                                            </List.Item>
                                        )
                                    })}
                                </List>
                            )
                        }
                        chapterPanels.push({
                            key: `panel-c${chapter.idx}`,
                            title: {
                                content: (
                                    <a
                                        href={chapter.link}
                                        target='_blank'
                                        rel='noopener noreferrer'
                                    >
                                        {chapter.title}
                                    </a>
                                )
                            },
                            content: {
                                content: chapterPages
                            }
                        })
                    });
                    setBookChapters(chapterPanels);
                }
            } else {
                console.log(res.data.errMsg);
            }
            setLoadedTOC(true);
        }).catch((err) => {
            console.log(err); // fail silently
            setLoadedTOC(true);
        });
    };

    const ThumbnailAttribution = () => {
        if (book.thumbnailAttr) {
            if (book.thumbnailAttr.title && book.thumbnailAttr.link && book.thumbnailAttr.license && book.thumbnailAttr.licLink) {
                return (
                    <p><Icon name='file image'/> Thumbnail via <a href={book.thumbnailAttr.link} target='_blank' rel='noopener noreferrer'>{book.thumbnailAttr.title}</a>, licensed under the <a href={book.thumbnailAttr.licLink} target='_blank' rel='noopener noreferrer'>{book.thumbnailAttr.license}</a> license.</p>
                )
            } else if (book.thumbnailAttr.title && book.thumbnailAttr.link && book.thumbnailAttr.license) {
                return (
                    <p><Icon name='file image'/> Thumbnail via <a href={book.thumbnailAttr.link} target='_blank' rel='noopener noreferrer'>{book.thumbnailAttr.title}</a>, licensed under the {book.thumbnailAttr.license} license.</p>
                )
            } else if (book.thumbnailAttr.title && book.thumbnailAttr.link) {
                return (
                    <p><Icon name='file image'/> Thumbnail via <a href={book.thumbnailAttr.link} target='_blank' rel='noopener noreferrer'>{book.thumbnailAttr.title}</a>.</p>
                )
            } else if (book.thumbnailAttr.title) {
                return (
                    <p><Icon name='file image'/> Thumbnail via {book.thumbnailAttr.title}.</p>
                )
            }
        } else {
            return null;
        }
    };

    return (
        <Grid className='commons-container'>
            <Grid.Row>
                <Grid.Column>
                    <Segment loading={!loadedData}>
                        <Breakpoint name='tabletOrDesktop'>
                            <Grid divided>
                                <Grid.Row>
                                    <Grid.Column width={4}>
                                        <Image id='commons-book-image' src={book.thumbnail} />
                                        <div id='commons-book-details'>
                                            {(book.author && !isEmptyString(book.author)) &&
                                                <p><Icon name='user'/> {book.author}</p>
                                            }
                                            <p>
                                                <Image src={getLibGlyphURL(book.library)} className='library-glyph' inline/>
                                                {getLibraryName(book.library)}
                                            </p>
                                            {(book.license && !isEmptyString(book.license)) &&
                                                <p><Icon name='shield' /> {getLicenseText(book.license)}</p>
                                            }
                                            {(book.affiliation && !isEmptyString(book.affiliation)) &&
                                                <p><Icon name='university' /> {book.affiliation}</p>
                                            }
                                            {(book.course && !isEmptyString(book.course)) &&
                                                <p><Icon name='sitemap' /> {book.course}</p>
                                            }
                                            <ThumbnailAttribution />
                                        </div>
                                        <Button icon='hand paper' content='Submit an Adoption Report' color='green' fluid onClick={() => { setShowAdoptionReport(true) }} />
                                        <Button.Group id='commons-book-actions' vertical labeled icon fluid color='blue'>
                                            <Button icon='linkify' content='Read Online' as='a' href={book.links.online} target='_blank' rel='noopener noreferrer' />
                                            <Button icon='file pdf' content='Download PDF' as='a' href={book.links.pdf} target='_blank' rel='noopener noreferrer'/>
                                            <Button icon='shopping cart' content='Buy Print Copy' as='a' href={book.links.buy} target='_blank' rel='noopener noreferrer'/>
                                            <Button icon='zip' content='Download Pages ZIP' as='a' href={book.links.zip} target='_blank' rel='noopener noreferrer'/>
                                            <Button icon='book' content='Download Print Files' as='a' href={book.links.files} target='_blank' rel='noopener noreferrer'/>
                                            <Button icon='graduation cap' content='Download LMS File' as='a' href={book.links.lms} target='_blank' rel='noopener noreferrer'/>
                                        </Button.Group>
                                    </Grid.Column>
                                    <Grid.Column width={12}>
                                        <Header as='h2'>{book.title}</Header>
                                        <Segment loading={!loadedSummary}>
                                            <Header as='h3' dividing>Summary</Header>
                                            {(bookSummary !== '')
                                                ? (<p>{bookSummary}</p>)
                                                : (<p><em>No summary available.</em></p>)
                                            }
                                        </Segment>
                                        <Segment loading={!loadedTOC}>
                                            <Header as='h3' dividing>Table of Contents</Header>
                                            {(bookChapters.length > 0)
                                                ? (<Accordion fluid panels={bookChapters} />)
                                                : (<p><em>Table of contents unavailable.</em></p>)
                                            }
                                        </Segment>
                                    </Grid.Column>
                                </Grid.Row>
                            </Grid>
                        </Breakpoint>
                        <Breakpoint name='mobile'>
                            <Grid divided='vertically'>
                                <Grid.Row>
                                    <Grid.Column>
                                        <Image id='commons-book-mobile-image' src={book.thumbnail} centered />
                                        <Header as='h2' textAlign='center'>{book.title}</Header>
                                        <div id='commons-book-mobiledetails'>
                                            {(book.author && !isEmptyString(book.author)) &&
                                                <p className='commons-book-mobile-detail'><Icon name='user'/> {book.author}</p>
                                            }
                                            <p className='commons-book-mobile-detail'>
                                                <Image src={getLibGlyphURL(book.library)} className='library-glyph' inline/>
                                                {getLibraryName(book.library)}
                                            </p>
                                            {(book.license && !isEmptyString(book.license)) &&
                                                <p className='commons-book-mobile-detail'><Icon name='shield'/> {getLicenseText(book.license)}</p>
                                            }
                                            {(book.affiliation && !isEmptyString(book.affiliation)) &&
                                                <p className='commons-book-mobile-detail'><Icon name='university'/> {book.affiliation}</p>
                                            }
                                            {(book.course && !isEmptyString(book.course)) &&
                                                <p className='commons-book-mobile-detail'><Icon name='sitemap'/> {book.course}</p>
                                            }
                                            <ThumbnailAttribution />
                                        </div>
                                    </Grid.Column>
                                </Grid.Row>
                                <Grid.Row>
                                    <Grid.Column>
                                        <Button.Group fluid vertical>
                                            <Button icon='hand paper' labelPosition='right' content='Submit an Adoption Report' color='green' onClick={() => { setShowAdoptionReport(true) }} />
                                            <Button icon={(showMobileReadingOpts) ? 'angle up' : 'angle down'} labelPosition='right' content='See Reading Options' color='blue' onClick={() => { setShowMobileReadingOpts(!showMobileReadingOpts) }} />
                                            {(showMobileReadingOpts) &&
                                                <div id='commons-book-mobile-readoptions'>
                                                    <Button icon='linkify' labelPosition='left' color='blue' content='Read Online' as='a' href={book.links.online} target='_blank' rel='noopener noreferrer' />
                                                    <Button icon='file pdf' labelPosition='left' color='blue' content='Download PDF' as='a' href={book.links.pdf} target='_blank' rel='noopener noreferrer'/>
                                                    <Button icon='shopping cart' labelPosition='left' color='blue' content='Buy Print Copy' as='a' href={book.links.buy} target='_blank' rel='noopener noreferrer'/>
                                                    <Button icon='zip' labelPosition='left' color='blue' content='Download Pages ZIP' as='a' href={book.links.zip} target='_blank' rel='noopener noreferrer'/>
                                                    <Button icon='book' labelPosition='left' color='blue' content='Download Print Files' as='a' href={book.links.files} target='_blank' rel='noopener noreferrer'/>
                                                    <Button icon='graduation cap' labelPosition='left' color='blue' content='Download LMS File' as='a' href={book.links.lms} target='_blank' rel='noopener noreferrer'/>
                                                </div>
                                            }
                                        </Button.Group>
                                        <Segment loading={!loadedSummary}>
                                            <Header as='h3' dividing>Summary</Header>
                                            {(bookSummary !== '')
                                                ? (<p>{bookSummary}</p>)
                                                : (<p><em>No summary available.</em></p>)
                                            }
                                        </Segment>
                                        <Segment loading={!loadedTOC}>
                                            <Header as='h3' dividing>Table of Contents</Header>
                                            {(bookChapters.length > 0)
                                                ? (<Accordion fluid panels={bookChapters} />)
                                                : (<p><em>Table of contents unavailable.</em></p>)
                                            }
                                        </Segment>
                                    </Grid.Column>
                                </Grid.Row>
                            </Grid>
                        </Breakpoint>
                    </Segment>
                    <AdoptionReport
                        open={showAdoptionReport}
                        onClose={() => { setShowAdoptionReport(false) }}
                        resourceID={book.bookID}
                        resourceTitle={book.title}
                        resourceLibrary={book.library}
                    />
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )
}

export default CommonsBook;
