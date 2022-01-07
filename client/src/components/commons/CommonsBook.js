import './Commons.css';

import { Link } from 'react-router-dom';
import {
    Grid,
    Image,
    Icon,
    Segment,
    Header,
    Button,
    Breadcrumb
} from 'semantic-ui-react';
import { PieChart } from 'react-minimal-pie-chart';
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
import { getLicenseColor } from '../util/BookHelpers.js';

import AdoptionReport from '../adoptionreport/AdoptionReport.js';
import ConductorTreeView from '../util/ConductorTreeView';

const CommonsBook = (props) => {

    const { handleGlobalError } = useGlobalError();

    // Data
    const [book, setBook] = useState({
        bookID: '',
        title: '',
        author: '',
        affiliation: '',
        library: '',
        subject: '',
        course: '',
        license: '',
        thumbnail: '',
        summary: '',
        links: {
            online: '',
            pdf: '',
            buy: '',
            zip: '',
            files: '',
            lms: '',
        },
        adaptID: ''
    });
    const [bookTOC, setBookTOC] = useState([]);

    // UI
    const [showMobileReadingOpts, setShowMobileReadingOpts] = useState(false);
    const [showAdoptionReport, setShowAdoptionReport] = useState(false);
    const [loadedData, setLoadedData] = useState(false);
    const [loadedTOC, setLoadedTOC] = useState(false);
    const [loadedLicensing, setLoadedLicensing] = useState(false);
    const [showTOC, setShowTOC] = useState(false);
    const [showLicensing, setShowLicensing] = useState(false);

    // Licensing Report
    const [foundCLR, setFoundCLR] = useState(false);
    const [pieChartData, setPieChartData] = useState(false);
    const [clrData, setCLRData] = useState({});
    const [clrChapters, setCLRChapters] = useState([]);

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
                if (res.data.book) {
                    res.data.book.license = ''; // hotfix for new license infrastructure
                    setBook(res.data.book);
                    getBookTOC();
                }
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setLoadedData(true);
        }).catch((err) => {
            handleGlobalError(err);
            setLoadedData(true);
        });
        if (localStorage.getItem('commons_show_toc') === 'true') {
            setShowTOC(true);
        }
        if (localStorage.getItem('commons_show_licensing') === 'true') {
            setShowLicensing(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    /**
     * Only load licensing once main information has been loaded.
     */
    useEffect(() => {
        if (loadedData && !loadedLicensing) getBookLicenseReport();
    }, [loadedData])


    /**
     * Update page title.
     */
    useEffect(() => {
        if (book.title && book.title !== '') {
            document.title = "LibreCommons | " + book.title;
        }
    }, [book]);


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
                if (res.data.toc && typeof(res.data.toc) === 'object') {
                    if (Array.isArray(res.data.toc.children)) { // skip first level
                        setBookTOC(res.data.toc.children);
                    }
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


    const processLicensingTOCRecursive = (pages) => {
        if (Array.isArray(pages)) {
            return pages.map((item) => {
                let processedItem = {...item};
                if (item.license?.raw) processedItem.color = getLicenseColor(item.license.raw);
                if (item.license?.link && item.license.link !== '#') {
                    processedItem.metaLink = {
                        url: item.license.link,
                        text: `${item.license.label} ${item.license.version}`
                    };
                } else processedItem.meta = { text: item.license.label };
                if (Array.isArray(item.children)) processedItem.children = processLicensingTOCRecursive(item.children);
                return processedItem;
            });
        }
        return [];
    };


    /**
     * Attempts to retrieve the resource's Licensing Report
     * from the server and inserts it into the UI if found.
     */
    const getBookLicenseReport = () => {
        axios.get('/commons/book/licensereport', {
            params: {
                bookID: props.match.params.id
            }
        }).then((res) => {
            if (!res.data?.err) {
                if (res.data.data) {
                    setFoundCLR(true);
                    let licenseReport = res.data.data;
                    setCLRData(licenseReport);
                    let pieChart = [];
                    if (licenseReport.meta?.licenses && Array.isArray(licenseReport.meta.licenses)) {
                        if (licenseReport.meta.licenses.length > 1) {
                            setBook({
                                ...book,
                                license: 'mixed'
                            });
                        } else if (licenseReport.meta.licenses.length === 1) {
                            let singleLicense = licenseReport.meta.licenses[0];
                            if (typeof(singleLicense.raw) === 'string') {
                                setBook({
                                    ...book,
                                    license: singleLicense.raw
                                });
                            }
                        }
                        licenseReport.meta.licenses.forEach((item) => {
                            let title = item.label;
                            let percent = parseFloat(item.percent);
                            if (item.version) title += ` ${item.version}`;
                            if (!isNaN(percent)) {
                                pieChart.push({
                                    title: title,
                                    value: percent,
                                    color: getLicenseColor(item.raw),
                                    raw: item.raw
                                });
                            }
                        });
                    }
                    setPieChartData(pieChart);
                    if (licenseReport.text?.children && Array.isArray(licenseReport.text.children)) {
                        setCLRChapters(processLicensingTOCRecursive(licenseReport.text.children));
                    }
                    setLoadedLicensing(true);
                }
            } else {
                throw(res.data.errMsg);
            }
        }).catch((err) => {
            console.log(err); // fail silently
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

    const handleChangeTOCVis = () => {
        setShowTOC(!showTOC);
        localStorage.setItem('commons_show_toc', !showTOC);
    };

    const handleChangeLicensingVis = () => {
        setShowLicensing(!showLicensing);
        localStorage.setItem('commons_show_licensing', !showLicensing);
    };

    const renderLicenseLink = (licenseObj) => {
        if (typeof(licenseObj) === 'object') {
            if (licenseObj.link && licenseObj.link !== '#') {
                return <a href={licenseObj?.link} target='_blank' rel='noopener noreferrer'>{licenseObj.label} {licenseObj.version}</a>
            } else {
                return <span>{licenseObj.label} {licenseObj.version}</span>
            }
        }
        return null;
    };

    const renderLicenseSpecialRestrictions = (specialRestrictions) => {
        if (Array.isArray(specialRestrictions)) {
            let restrString = '';
            let restrCount = 0;
            if (specialRestrictions.includes('noncommercial')) {
                if (restrCount > 0) restrString += `, `;
                restrString += `Noncommercial`;
                restrCount++;
            }
            if (specialRestrictions.includes('noderivatives')) {
                if (restrCount > 0) restrString += `, `;
                restrString += `No Derivatives`;
                restrCount++;
            }
            if (specialRestrictions.includes('fairuse')) {
                if (restrCount > 0) restrString += `, `;
                restrString += `Fair Use`;
                restrCount++;
            }
            return restrString;
        }
        return '';
    };

    return (
        <Grid className='commons-container'>
            <Grid.Row>
                <Grid.Column>
                    <Segment.Group raised>
                        <Segment>
                            <Breadcrumb>
                                <Breadcrumb.Section as={Link} to='/catalog'>
                                    <span>
                                        <span className='muted-text'>You are on: </span>
                                        Catalog
                                    </span>
                                </Breadcrumb.Section>
                                <Breadcrumb.Divider icon='right chevron' />
                                <Breadcrumb.Section active>
                                    {book.title}
                                </Breadcrumb.Section>
                            </Breadcrumb>
                        </Segment>
                        <Segment loading={!loadedData} className='pt-2p'>
                            <Breakpoint name='tabletOrDesktop'>
                                <Grid divided>
                                    <Grid.Row>
                                        <Grid.Column width={4}>
                                            <Image
                                                id='commons-book-image'
                                                src={book.thumbnail}
                                                aria-hidden='true'
                                            />
                                            <div id='commons-book-details'>
                                                {(book.author && !isEmptyString(book.author)) &&
                                                    <p><Icon name='user'/> {book.author}</p>
                                                }
                                                <p>
                                                    <Image
                                                        src={getLibGlyphURL(book.library)}
                                                        className='library-glyph'
                                                        inline
                                                        aria-hidden='true'
                                                    />
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
                                            {(book.hasOwnProperty('adaptID') && book.adaptID !== '') &&
                                                <Button
                                                    icon='tasks'
                                                    content='View Homework on ADAPT'
                                                    color='teal'
                                                    fluid
                                                    as='a'
                                                    href={`https://adapt.libretexts.org/courses/${book.adaptID}/anonymous`}
                                                    target='_blank'
                                                    rel='noopener noreferrer'
                                                    className='mb-2p'
                                                />
                                            }
                                            <Button icon='hand paper' content='Submit an Adoption Report' color='green' fluid onClick={() => { setShowAdoptionReport(true) }} />
                                            <Button.Group id='commons-book-actions' vertical labeled icon fluid color='blue'>
                                                <Button icon='linkify' content='Read Online' as='a' href={book.links?.online} target='_blank' rel='noopener noreferrer' tabIndex={0} />
                                                <Button icon='file pdf' content='Download PDF' as='a' href={book.links?.pdf} target='_blank' rel='noopener noreferrer' tabIndex={0} />
                                                <Button icon='shopping cart' content='Buy Print Copy' as='a' href={book.links?.buy} target='_blank' rel='noopener noreferrer' tabIndex={0} />
                                                <Button icon='zip' content='Download Pages ZIP' as='a' href={book.links?.zip} target='_blank' rel='noopener noreferrer' tabIndex={0} />
                                                <Button icon='book' content='Download Print Files' as='a' href={book.links?.files} target='_blank' rel='noopener noreferrer' tabIndex={0} />
                                                <Button icon='graduation cap' content='Download LMS File' as='a' href={book.links?.lms} target='_blank' rel='noopener noreferrer' tabIndex={0} />
                                            </Button.Group>
                                        </Grid.Column>
                                        <Grid.Column width={12}>
                                            <Header as='h2'>{book.title}</Header>
                                            {(book.summary && !isEmptyString(book.summary)) &&
                                                <Segment>
                                                    <Header as='h3' dividing>Summary</Header>
                                                    <p className='commons-book-summary'>{book.summary}</p>
                                                </Segment>
                                            }
                                            {showTOC
                                                ? (
                                                    <Segment loading={!loadedTOC}>
                                                        <div className='ui dividing header'>
                                                            <div className='hideablesection'>
                                                                <h3 className='header'>
                                                                    Table of Contents
                                                                </h3>
                                                                <div className='button-container'>
                                                                    <Button
                                                                            compact
                                                                            floated='right'
                                                                            onClick={handleChangeTOCVis}
                                                                        >
                                                                            Hide
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {(bookTOC.length > 0)
                                                            ? (
                                                                <ConductorTreeView
                                                                    items={bookTOC}
                                                                    asLinks={true}
                                                                    hrefKey='url'
                                                                    textKey='title'
                                                                />
                                                            )
                                                            : (<p className='commons-book-toc'><em>Table of contents unavailable.</em></p>)
                                                        }
                                                    </Segment>
                                                )
                                                : (
                                                    <Segment>
                                                        <div className='hiddensection'>
                                                            <div className='header-container'>
                                                                <Header as='h3'>Table of Contents</Header>
                                                            </div>
                                                            <div className='button-container'>
                                                                <Button
                                                                    floated='right'
                                                                    onClick={handleChangeTOCVis}
                                                                >
                                                                    Show
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </Segment>
                                                )
                                            }
                                            {foundCLR &&
                                                (showLicensing
                                                    ? (
                                                        <Segment>
                                                            <div className='ui dividing header'>
                                                                <div className='hideablesection'>
                                                                    <h3 className='header'>
                                                                        Licensing
                                                                    </h3>
                                                                    <div className='button-container'>
                                                                        <Button
                                                                                compact
                                                                                floated='right'
                                                                                onClick={handleChangeLicensingVis}
                                                                            >
                                                                                Hide
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <Grid className='commons-book-clr-grid'>
                                                                <Grid.Row className='commons-book-clr-row'>
                                                                        <Grid.Column width={10}>
                                                                            <Header as='h4' className='mt-2p' dividing>Overview</Header>
                                                                            <div className='commons-book-clr-overview-flex'>
                                                                                <span><strong>Webpages: </strong></span>
                                                                                <span className='right'>{clrData.text?.totalPages || 'Unknown'}</span>
                                                                            </div>
                                                                            {(Array.isArray(clrData.meta?.specialRestrictions) && clrData.meta?.specialRestrictions.length > 0) &&
                                                                                <div className='commons-book-clr-overview-flex'>
                                                                                    <span>
                                                                                        <strong>Applicable Restrictions:</strong>
                                                                                    </span>
                                                                                    <span className='right'>{renderLicenseSpecialRestrictions(clrData.meta.specialRestrictions)}</span>
                                                                                </div>
                                                                            }
                                                                            <div className='commons-book-clr-overview-flex'>
                                                                                <span>
                                                                                    <strong>All licenses:</strong>
                                                                                </span>
                                                                            </div>
                                                                            {(pieChartData.length > 0) &&
                                                                                <ul>
                                                                                    {pieChartData.map((pieItem, idx) => {
                                                                                        let licItem = null;
                                                                                        if (clrData.meta?.licenses && Array.isArray(clrData.meta.licenses)) {
                                                                                            licItem = clrData.meta.licenses.find(findItem => pieItem.value === findItem.percent && pieItem.raw === findItem.raw);
                                                                                        }
                                                                                        if (licItem !== null && licItem !== undefined) {
                                                                                            let licPercent = licItem.percent;
                                                                                            if (typeof(licPercent) === 'number') licPercent = licPercent.toFixed(1);
                                                                                            return (
                                                                                                <li key={`pie-${idx}`}>
                                                                                                    <div className='commons-book-clr-overview-flex'>
                                                                                                        <span>{renderLicenseLink(licItem)}</span>
                                                                                                        <span className='right'>({licItem.count} {licItem.count > 1 ? 'pages' : 'page'}) {licPercent}% <Icon name='square full' style={{color: pieItem.color}} className='ml-2p'></Icon></span>
                                                                                                    </div>
                                                                                                </li>
                                                                                            )
                                                                                        } else return null;
                                                                                    })}
                                                                                </ul>
                                                                            }
                                                                        </Grid.Column>
                                                                    <Grid.Column width={6}>
                                                                        {(pieChartData.length > 0) &&
                                                                            <PieChart
                                                                                data={pieChartData}
                                                                                label={({ dataEntry }) => `${dataEntry.value.toFixed(1)}%`}
                                                                                labelStyle={(index) => ({
                                                                                    fill: pieChartData[index].color,
                                                                                    fontSize: '5px'
                                                                                })}
                                                                                animate
                                                                                style={{
                                                                                    maxHeight: '250px'
                                                                                }}
                                                                                radius={42}
                                                                                labelPosition={112}
                                                                            />
                                                                        }
                                                                    </Grid.Column>
                                                                </Grid.Row>
                                                                <Grid.Row className='commons-book-clr-row'>
                                                                    <Grid.Column>
                                                                        <Header as='h4' className='mt-2p' dividing>Breakdown</Header> 
                                                                        {(clrChapters.length > 0)
                                                                            ? (
                                                                                <ConductorTreeView
                                                                                    items={clrChapters}
                                                                                    asLinks={true}
                                                                                    hrefKey='url'
                                                                                    textKey='title'
                                                                                />
                                                                            )
                                                                            : (<p className='commons-book-toc'><em>Licensing breakdown unavailable.</em></p>)
                                                                        }
                                                                    </Grid.Column>
                                                                </Grid.Row>
                                                            </Grid>
                                                        </Segment>
                                                    )
                                                    : (
                                                        <Segment>
                                                            <div className='hiddensection'>
                                                                <div className='header-container'>
                                                                    <Header as='h3'>Licensing</Header>
                                                                </div>
                                                                <div className='button-container'>
                                                                    <Button
                                                                        floated='right'
                                                                        onClick={handleChangeLicensingVis}
                                                                    >
                                                                        Show
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </Segment>
                                                    )
                                                )
                                            }
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
                                                {(book.hasOwnProperty('adaptID') && book.adaptID !== '') &&
                                                    <Button
                                                        icon='tasks'
                                                        content='View Homework on ADAPT'
                                                        color='teal'
                                                        labelPosition='right'
                                                        fluid
                                                        as='a'
                                                        href={`https://adapt.libretexts.org/courses/${book.adaptID}/anonymous`}
                                                        target='_blank'
                                                        rel='noopener noreferrer'
                                                    />
                                                }
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
                                            {(book.summary && !isEmptyString(book.summary)) &&
                                                <Segment>
                                                    <Header as='h3' dividing>Summary</Header>
                                                    <p>{book.summary}</p>
                                                </Segment>
                                            }
                                            {showTOC
                                                ? (
                                                    <Segment loading={!loadedTOC}>
                                                        <div className='ui dividing header'>
                                                            <div className='hideablesection'>
                                                                <h3 className='header'>
                                                                    Table of Contents
                                                                </h3>
                                                                <div className='button-container'>
                                                                    <Button
                                                                            compact
                                                                            floated='right'
                                                                            onClick={handleChangeTOCVis}
                                                                        >
                                                                            Hide
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {(bookTOC.length > 0)
                                                            ? (
                                                                <ConductorTreeView
                                                                    items={bookTOC}
                                                                    asLinks={true}
                                                                    hrefKey='url'
                                                                    textKey='title'
                                                                />
                                                            )
                                                            : (<p><em>Table of contents unavailable.</em></p>)
                                                        }
                                                    </Segment>
                                                )
                                                : (
                                                    <Segment>
                                                        <div className='hiddensection'>
                                                            <div className='header-container'>
                                                                <Header as='h3'>Table of Contents</Header>
                                                            </div>
                                                            <div className='button-container'>
                                                                <Button
                                                                    floated='right'
                                                                    onClick={handleChangeTOCVis}
                                                                >
                                                                    Show
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </Segment>
                                                )
                                            }
                                            {foundCLR &&
                                                (showLicensing
                                                    ? (
                                                        <Segment>
                                                            <div className='ui dividing header'>
                                                                <div className='hideablesection'>
                                                                    <h3 className='header'>
                                                                        Licensing
                                                                    </h3>
                                                                    <div className='button-container'>
                                                                        <Button
                                                                            compact
                                                                            floated='right'
                                                                            onClick={handleChangeLicensingVis}
                                                                            className=''
                                                                        >
                                                                            Hide
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <Grid>
                                                                {(pieChartData.length > 0) &&
                                                                    <Grid.Row>
                                                                        <Grid.Column>
                                                                            <PieChart
                                                                                data={pieChartData}
                                                                                label={({ dataEntry }) => `${dataEntry.value.toFixed(1)}%`}
                                                                                labelStyle={(index) => ({
                                                                                    fill: pieChartData[index].color,
                                                                                    fontSize: '5px'
                                                                                })}
                                                                                animate
                                                                                style={{
                                                                                maxHeight: '250px'
                                                                                }}
                                                                                radius={42}
                                                                                labelPosition={112}
                                                                            />
                                                                        </Grid.Column>
                                                                    </Grid.Row>
                                                                }
                                                                <Grid.Row>
                                                                    <Grid.Column>
                                                                        <Header as='h4' className='mt-2p' dividing>Overview</Header>
                                                                        <div className='commons-book-clr-overview-flex'>
                                                                            <span><strong>Webpages: </strong></span>
                                                                            <span className='right'>{clrData.text?.totalPages || 'Unknown'}</span>
                                                                        </div>
                                                                        {(Array.isArray(clrData.meta?.specialRestrictions) && clrData.meta?.specialRestrictions.length > 0) &&
                                                                            <div className='commons-book-clr-overview-flex'>
                                                                                <span>
                                                                                    <strong>Applicable Restrictions:</strong>
                                                                                </span>
                                                                                <span className='right'>{renderLicenseSpecialRestrictions(clrData.meta.specialRestrictions)}</span>
                                                                            </div>
                                                                        }
                                                                        <div className='commons-book-clr-overview-flex'>
                                                                            <span>
                                                                                <strong>All licenses:</strong>
                                                                            </span>
                                                                        </div>
                                                                        {(pieChartData.length > 0) &&
                                                                            <ul>
                                                                                {pieChartData.map((pieItem, idx) => {
                                                                                    let licItem = null;
                                                                                    if (clrData.meta?.licenses && Array.isArray(clrData.meta.licenses)) {
                                                                                        licItem = clrData.meta.licenses.find(findItem => pieItem.value === findItem.percent && pieItem.raw === findItem.raw);
                                                                                    }
                                                                                    if (licItem !== null && licItem !== undefined) {
                                                                                        let licPercent = licItem.percent;
                                                                                        if (typeof(licPercent) === 'number') licPercent = licPercent.toFixed(1);
                                                                                        return (
                                                                                            <li key={`pie-${idx}`}>
                                                                                                <div className='commons-book-clr-overview-flex'>
                                                                                                    <span>{renderLicenseLink(licItem)}</span>
                                                                                                    <span className='right'>({licItem.count} {licItem.count > 1 ? 'pages' : 'page'}) {licPercent}% <Icon name='square full' style={{color: pieItem.color}} className='ml-2p'></Icon></span>
                                                                                                </div>
                                                                                            </li>
                                                                                        )
                                                                                    } else return null;
                                                                                })}
                                                                            </ul>
                                                                        }
                                                                    </Grid.Column>
                                                                </Grid.Row>
                                                                <Grid.Row className='commons-book-clr-row'>
                                                                    <Grid.Column>
                                                                        <Header as='h4' className='mt-2p' dividing>Breakdown</Header> 
                                                                        {(clrChapters.length > 0)
                                                                            ? (
                                                                                <ConductorTreeView
                                                                                    items={clrChapters}
                                                                                    asLinks={true}
                                                                                    hrefKey='url'
                                                                                    textKey='title'
                                                                                />
                                                                            )
                                                                            : (<p className='commons-book-toc'><em>Licensing breakdown unavailable.</em></p>)
                                                                        }
                                                                    </Grid.Column>
                                                                </Grid.Row>
                                                            </Grid>
                                                        </Segment>
                                                    )
                                                    : (
                                                        <Segment>
                                                            <div className='hiddensection'>
                                                                <div className='header-container'>
                                                                    <Header as='h3'>Licensing</Header>
                                                                </div>
                                                                <div className='button-container'>
                                                                    <Button
                                                                        floated='right'
                                                                        onClick={handleChangeLicensingVis}
                                                                    >
                                                                        Show
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </Segment>
                                                    )
                                                )
                                            }
                                        </Grid.Column>
                                    </Grid.Row>
                                </Grid>
                            </Breakpoint>
                        </Segment>
                    </Segment.Group>
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
