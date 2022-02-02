import './Commons.css';

import {
    Grid,
    Image,
    Icon,
    Segment,
    Header,
    Button,
    Breadcrumb,
    Modal,
    List
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PieChart } from 'react-minimal-pie-chart';
import axios from 'axios';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';

import Breakpoint from '../util/Breakpoints.jsx';
import useGlobalError from '../error/ErrorHooks.js';
import {
    getLibGlyphURL,
    getLibraryName
} from '../util/LibraryOptions.js';
import { getLicenseText } from '../util/LicenseOptions.js';
import { isEmptyString } from '../util/HelperFunctions.js';
import { getLicenseColor } from '../util/BookHelpers.js';
import { getPeerReviewAuthorText } from '../util/ProjectHelpers.js';

import AdoptionReport from '../adoptionreport/AdoptionReport.jsx';
import ConductorTreeView from '../util/ConductorTreeView';
import PeerReview from '../peerreview/PeerReview.jsx';
import PeerReviewView from '../peerreview/PeerReviewView.jsx';
import StarRating from '../peerreview/StarRating.jsx';;

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
        rating: 0,
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

    // General UI
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


    // Peer Reviews
    const [prAllow, setPRAllow] = useState(false);
    const [prProjectID, setPRProjectID] = useState('');
    const [prShow, setPRShow] = useState(false);
    const [prReviews, setPRReviews] = useState([]);
    const [prReviewsShow, setPRReviewsShow] = useState(false);
    const [prRating, setPRRating] = useState(0);
    const [prViewShow, setPRViewShow] = useState(false);
    const [prViewData, setPRViewData] = useState({});


    /**
     * Register plugins on initialization.
     */
    useEffect(() => {
        date.plugin(ordinal);
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
    }, [setBook, setLoadedData, setShowTOC, setShowLicensing, handleGlobalError]);


    /**
     * Only load licensing once main information has been loaded.
     */
    useEffect(() => {
        if (loadedData && !loadedLicensing) {
            getBookLicenseReport();
            getBookPeerReviews();
        }
    }, [loadedData])


    /**
     * Retrieves the book's Table of Contents from the server and builds the UI list,
     * then pushes to state.
     */
    const getBookTOC = () => {
        axios.get('/commons/book/toc', {
            params: {
                bookID: props.match.params.id
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.toc && typeof (res.data.toc) === 'object') {
                    if (Array.isArray(res.data.toc.children)) { // skip first level
                        setBookTOC(res.data.toc.children);
                    }
                }
            } else {
                console.error(res.data.errMsg); // fail silently
            }
            setLoadedTOC(true);
        }).catch((err) => {
            console.error(err); // fail silently
            setLoadedTOC(true);
        });
    };


    /**
     * Processes an array of page information to include UI helpers for Licensing presentation.
     * @param {Object[]} pages - Array of page information, typically a Table of Contents.
     * @returns {Object[]} The processes array of page information with Licensing UI helpers, or an empty array if error encountered.
     */
    const processLicensingTOCRecursive = (pages) => {
        if (Array.isArray(pages)) {
            return pages.map((item) => {
                let processedItem = { ...item };
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
                            if (typeof (singleLicense.raw) === 'string') {
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
                throw (res.data.errMsg);
            }
        }).catch((err) => {
            console.error(err); // fail silently
        });
    };

    /**
     * Attempts to retrieve the resource's Peer Reviews from the server
     * and enables the Peer Review features in the UI if found.
     */
    const getBookPeerReviews = () => {
        axios.get('/commons/book/peerreviews', {
            params: {
                bookID: props.match.params.id
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.allowsAnon === true && typeof (res.data.projectID) === 'string' && res.data.projectID.length > 0) {
                    setPRAllow(true);
                    setPRProjectID(res.data.projectID);
                }
                if (Array.isArray(res.data.reviews) && res.data.reviews.length > 0) {
                    let sorted = [...res.data.reviews].sort((a, b) => {
                        let aKey = new Date(a.createdAt);
                        let bKey = new Date(b.createdAt);
                        if (aKey < bKey) return -1;
                        if (aKey > bKey) return 1;
                        return 0;
                    });
                    setPRReviews(sorted);
                }
                if (typeof (res.data.averageRating) === 'number') {
                    setPRRating(res.data.averageRating);
                }
            } else {
                throw (res.data.errMsg);
            }
        }).catch((err) => {
            console.error(err); // fail silently
        });
    };

    /**
     * Updates state and localStorage with the user's preference to display a Book's Table of Contents.
     */
    const handleChangeTOCVis = () => {
        setShowTOC(!showTOC);
        localStorage.setItem('commons_show_toc', !showTOC);
    };


    /**
     * Updates state and localStorage with the user's preference to display Book Licensing.
     */
    const handleChangeLicensingVis = () => {
        setShowLicensing(!showLicensing);
        localStorage.setItem('commons_show_licensing', !showLicensing);
    };


    /**
     * Enters a specified Peer Review into state and opens the Peer Review View Modal.
     * @param {Object} peerReview - The Peer Review to be opened.
     */
    const handleOpenPeerReviewView = (peerReview) => {
        if (typeof (peerReview) === 'object' && Object.keys(peerReview).length > 0) {
            setPRViewData(peerReview);
            setPRViewShow(true);
        }
    };


    /**
     * Closes the Peer Review View Modal and resets its state.
     */
    const handleClosePeerReviewView = () => {
        setPRViewShow(false);
        setPRViewData({});
    };


    /**
     * Attempts to render attribution information about a Book's thumbnail.
     * @returns {JSX.Element} A paragraph with thumbnail attribution information.
     */
    const ThumbnailAttribution = () => {
        if (book.thumbnailAttr) {
            if (book.thumbnailAttr.title && book.thumbnailAttr.link && book.thumbnailAttr.license && book.thumbnailAttr.licLink) {
                return (
                    <p><Icon name='file image' /> Thumbnail via <a href={book.thumbnailAttr.link} target='_blank' rel='noopener noreferrer'>{book.thumbnailAttr.title}</a>, licensed under the <a href={book.thumbnailAttr.licLink} target='_blank' rel='noopener noreferrer'>{book.thumbnailAttr.license}</a> license.</p>
                )
            } else if (book.thumbnailAttr.title && book.thumbnailAttr.link && book.thumbnailAttr.license) {
                return (
                    <p><Icon name='file image' /> Thumbnail via <a href={book.thumbnailAttr.link} target='_blank' rel='noopener noreferrer'>{book.thumbnailAttr.title}</a>, licensed under the {book.thumbnailAttr.license} license.</p>
                )
            } else if (book.thumbnailAttr.title && book.thumbnailAttr.link) {
                return (
                    <p><Icon name='file image' /> Thumbnail via <a href={book.thumbnailAttr.link} target='_blank' rel='noopener noreferrer'>{book.thumbnailAttr.title}</a>.</p>
                )
            } else if (book.thumbnailAttr.title) {
                return (
                    <p><Icon name='file image' /> Thumbnail via {book.thumbnailAttr.title}.</p>
                )
            }
        } else {
            return null;
        }
    };


    /**
     * Renders a link or span with information about a given License.
     * @param {Object} licenseObj - License information object, including label, link, and version (if applicable).
     * @returns {JSX.Element} The UI-ready license information presentation.
     */
    const renderLicenseLink = (licenseObj) => {
        if (typeof (licenseObj) === 'object') {
            if (licenseObj.link && licenseObj.link !== '#') {
                return <a href={licenseObj?.link} target='_blank' rel='noopener noreferrer'>{licenseObj.label} {licenseObj.version}</a>
            } else {
                return <span>{licenseObj.label} {licenseObj.version}</span>
            }
        }
        return null;
    };


    /**
     * Prepares a UI-ready representation of the Book's applicable license restrictions.
     * @param {String[]} specialRestrictions - An array of internal license restriction identifiers.
     * @returns {String} A UI-ready string listing applicable license restrictions.
     */
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


    /**
     * Renders UI buttons related to Peer Reviews, depending on access and visibility settings
     * of project (if applicable).
     * @param {Boolean} [isMobile=false] - If the buttons should be rendered for a mobile view.
     * @returns {JSX.Element} The rendered Button or Button.Group.
     */
    const PeerReviewButtons = ({ isMobile }) => {
        let buttonProps = {
            icon: 'clipboard list',
            color: 'orange',
            fluid: true
        };
        if (isMobile) buttonProps.labelPosition = 'right';
        let submitButtonProps = {
            ...buttonProps,
            icon: 'clipboard list',
            content: 'Submit a Peer Review',
            onClick: () => { setPRShow(true) }
        };
        let viewButtonProps = {
            ...buttonProps,
            icon: 'ul list',
            content: 'View Peer Reviews',
            onClick: () => { setPRReviewsShow(true) }
        };
        if (prAllow && prReviews.length > 0) {
            // allows reviews and has existing reviews
            if (isMobile) {
                return (
                    <>
                        <Button {...submitButtonProps} />
                        <Button {...viewButtonProps} />
                    </>
                )
            }
            return (
                <Button.Group
                    vertical
                    labeled
                    icon
                    fluid
                    className='mt-1r'
                >
                    <Button {...submitButtonProps} />
                    <Button {...viewButtonProps} />
                </Button.Group>
            )
        } else if (prAllow) {
            // allows reviews, none yet
            return <Button className={!isMobile ? 'mt-2p' : ''} {...submitButtonProps} />
        } else if (prReviews.length > 0) {
            // doesn't allow reviews, but existing are visible
            return <Button className={!isMobile ? 'mt-2p' : ''} {...viewButtonProps} />
        }
        return null;
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
                                                    <p><Icon name='user' /> {book.author}</p>
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
                                                {prReviews.length > 0 && (
                                                    <p><Icon name='clipboard list' /> {prReviews.length} Peer Review{(prReviews.length > 1) && 's'}</p>
                                                )}
                                            </div>
                                            {(typeof (book.rating) === 'number' && book.rating > 0) && (
                                                <div className='mt-2p mb-4p'>
                                                    <StarRating
                                                        value={book.rating}
                                                        displayMode={true}
                                                    />
                                                </div>
                                            )}
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
                                            <Button
                                                icon='hand paper'
                                                content='Submit an Adoption Report'
                                                color='green'
                                                fluid
                                                onClick={() => setShowAdoptionReport(true)}
                                            />
                                            <PeerReviewButtons />
                                            <Button.Group
                                                className='mt-1r'
                                                vertical
                                                labeled
                                                icon
                                                fluid
                                                color='blue'
                                            >
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
                                                                                        if (typeof (licPercent) === 'number') licPercent = licPercent.toFixed(1);
                                                                                        return (
                                                                                            <li key={`pie-${idx}`}>
                                                                                                <div className='commons-book-clr-overview-flex'>
                                                                                                    <span>{renderLicenseLink(licItem)}</span>
                                                                                                    <span className='right'>({licItem.count} {licItem.count > 1 ? 'pages' : 'page'}) {licPercent}% <Icon name='square full' style={{ color: pieItem.color }} className='ml-2p'></Icon></span>
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
                                                    <p className='commons-book-mobile-detail'><Icon name='user' /> {book.author}</p>
                                                }
                                                <p className='commons-book-mobile-detail'>
                                                    <Image src={getLibGlyphURL(book.library)} className='library-glyph' inline />
                                                    {getLibraryName(book.library)}
                                                </p>
                                                {(book.license && !isEmptyString(book.license)) &&
                                                    <p className='commons-book-mobile-detail'><Icon name='shield' /> {getLicenseText(book.license)}</p>
                                                }
                                                {(book.affiliation && !isEmptyString(book.affiliation)) &&
                                                    <p className='commons-book-mobile-detail'><Icon name='university' /> {book.affiliation}</p>
                                                }
                                                {(book.course && !isEmptyString(book.course)) &&
                                                    <p className='commons-book-mobile-detail'><Icon name='sitemap' /> {book.course}</p>
                                                }
                                                <ThumbnailAttribution />
                                                {prReviews.length > 0 && (
                                                    <p><Icon name='clipboard list' /> {prReviews.length} Peer Review{(prReviews.length > 1) && 's'}</p>
                                                )}
                                            </div>
                                            {(typeof (book.rating) === 'number' && book.rating > 0) && (
                                                <div className='mt-3p mb-2p center-flex'>
                                                    <StarRating
                                                        value={book.rating}
                                                        displayMode={true}
                                                    />
                                                </div>
                                            )}
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
                                                <Button
                                                    icon='hand paper'
                                                    labelPosition='right'
                                                    content='Submit an Adoption Report'
                                                    color='green'
                                                    onClick={() => setShowAdoptionReport(true)}
                                                />
                                                <PeerReviewButtons isMobile={true} />
                                                <Button
                                                    icon={(showMobileReadingOpts) ? 'angle up' : 'angle down'}
                                                    labelPosition='right'
                                                    content='See Reading Options'
                                                    color='blue'
                                                    onClick={() => setShowMobileReadingOpts(!showMobileReadingOpts)}
                                                />
                                                {(showMobileReadingOpts) &&
                                                    <div id='commons-book-mobile-readoptions'>
                                                        <Button icon='linkify' labelPosition='left' color='blue' content='Read Online' as='a' href={book.links.online} target='_blank' rel='noopener noreferrer' />
                                                        <Button icon='file pdf' labelPosition='left' color='blue' content='Download PDF' as='a' href={book.links.pdf} target='_blank' rel='noopener noreferrer' />
                                                        <Button icon='shopping cart' labelPosition='left' color='blue' content='Buy Print Copy' as='a' href={book.links.buy} target='_blank' rel='noopener noreferrer' />
                                                        <Button icon='zip' labelPosition='left' color='blue' content='Download Pages ZIP' as='a' href={book.links.zip} target='_blank' rel='noopener noreferrer' />
                                                        <Button icon='book' labelPosition='left' color='blue' content='Download Print Files' as='a' href={book.links.files} target='_blank' rel='noopener noreferrer' />
                                                        <Button icon='graduation cap' labelPosition='left' color='blue' content='Download LMS File' as='a' href={book.links.lms} target='_blank' rel='noopener noreferrer' />
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
                                                                                        if (typeof (licPercent) === 'number') licPercent = licPercent.toFixed(1);
                                                                                        return (
                                                                                            <li key={`pie-${idx}`}>
                                                                                                <div className='commons-book-clr-overview-flex'>
                                                                                                    <span>{renderLicenseLink(licItem)}</span>
                                                                                                    <span className='right'>({licItem.count} {licItem.count > 1 ? 'pages' : 'page'}) {licPercent}% <Icon name='square full' style={{ color: pieItem.color }} className='ml-2p'></Icon></span>
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
                    {/* View Peer Review Modal */}
                    <Modal
                        open={prReviewsShow}
                        onClose={() => setPRReviewsShow(false)}
                        size='fullscreen'
                    >
                        <Modal.Header>Peer Reviews for <em>{book.title}</em></Modal.Header>
                        <Modal.Content>
                            {(prReviews.length > 0) ? (
                                <List divided>
                                    {prReviews.map((item) => {
                                        const itemDate = new Date(item.createdAt);
                                        item.date = date.format(itemDate, 'MMM DDD, YYYY');
                                        return (
                                            <List.Item key={item.peerReviewID}>
                                                <div className='flex-row-div mt-05p mb-05p'>
                                                    <div className='left-flex'>
                                                        <div className='flex-col-div'>
                                                            <span className='project-peerreview-title'>{item.author || "Unknown Reviewer"}</span>
                                                            <span className='project-peerreview-detail muted-text'>
                                                                <em>{getPeerReviewAuthorText(item.authorType)}</em> <>&#8226;</> {item.date}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className='right-flex'>
                                                        <Button
                                                            color='blue'
                                                            onClick={() => handleOpenPeerReviewView(item)}
                                                        >
                                                            <Icon name='eye' /> View
                                                        </Button>
                                                    </div>
                                                </div>
                                            </List.Item>
                                        )
                                    })}
                                </List>
                            ) : (
                                <p className='muted-text mt-2p mb-2p'>No reviews found.</p>
                            )}
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                color='blue'
                                onClick={() => setPRReviewsShow(false)}
                            >
                                Done
                            </Button>
                        </Modal.Actions>
                    </Modal>
                    <AdoptionReport
                        open={showAdoptionReport}
                        onClose={() => { setShowAdoptionReport(false) }}
                        resourceID={book.bookID}
                        resourceTitle={book.title}
                        resourceLibrary={book.library}
                    />
                    <PeerReview
                        open={prShow}
                        onClose={() => setPRShow(false)}
                        projectID={prProjectID}
                    />
                    <PeerReviewView
                        open={prViewShow}
                        onClose={handleClosePeerReviewView}
                        peerReviewData={prViewData}
                        publicView={true}
                    />
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )
}

export default CommonsBook;
