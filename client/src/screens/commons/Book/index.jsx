import React, { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Image,
  Icon,
  Segment,
  Header,
  Button,
  Breadcrumb,
  Modal,
  List,
  Search,
  Popup
} from 'semantic-ui-react';
import { PieChart } from 'react-minimal-pie-chart';
import axios from 'axios';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';
import useGlobalError from '../../../components/error/ErrorHooks';
import {
  getLibGlyphURL,
  getLibraryName,
} from '../../../components/util/LibraryOptions.js';
import { getLicenseText } from '../../../components/util/LicenseOptions.js';
import { isEmptyString } from '../../../components/util/HelperFunctions.js';
import { getLicenseColor } from '../../../components/util/BookHelpers.js';
import { getPeerReviewAuthorText } from '../../../components/util/ProjectHelpers.js';
import AdoptionReport from '../../../components/adoptionreport/AdoptionReport.jsx';
import TreeView from '../../../components/TreeView';
import PeerReview from '../../../components/peerreview/PeerReview.jsx';
import PeerReviewView from '../../../components/peerreview/PeerReviewView.jsx';
import StarRating from '../../../components/peerreview/StarRating.jsx';
import styles from './Book.module.css';
import FileIcon from '../../../components/FileIcon/index.jsx';
import { truncateString } from '../../../components/util/HelperFunctions.js';

/**
 * Displays a Commons Catalog Book entry and related information.
 */
const CommonsBook = () => {

  const { id: bookID } = useParams();
  const location = useLocation();

  // Global Error Handling
  const { handleGlobalError } = useGlobalError();

  // Global State
  const isConductorUser = useSelector((state) => state.user?.isAuthenticated);

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
    licenseVersion: null,
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
    adaptID: '',
  });

  // General UI
  const [showAdoptionReport, setShowAdoptionReport] = useState(false);
  const [loadedData, setLoadedData] = useState(false);
  const [loadedTOC, setLoadedTOC] = useState(false);
  const [loadedLicensing, setLoadedLicensing] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [showTOC, setShowTOC] = useState(false);
  const [showLicensing, setShowLicensing] = useState(false);

  // Project Files
  const [projFiles, setProjFiles] = useState([]);
  const [currDirectory, setCurrDirectory] = useState('');
  const [currDirPath, setCurrDirPath] = useState([
    {
      fileID: "",
      name: "",
    },
  ]);

  // File Search
  const [fileSearchLoading, setFileSearchLoading] = useState(false);
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [fileSearchResults, setFileSearchResults] = useState([]);

  // TOC
  const [bookTOC, setBookTOC] = useState([]);

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
  // const [prRating, setPRRating] = useState(0);
  const [prViewShow, setPRViewShow] = useState(false);
  const [prViewData, setPRViewData] = useState({});

  const accessLinks = [
    { key: 'online', text: 'Read Online', href: book.links?.online, icon: 'linkify' },
    { key: 'pdf', text: 'Download PDF', href: book.links?.pdf, icon: 'file pdf' },
    { key: 'print', text: 'Buy Print Copy', href: book.links?.buy, icon: 'shopping cart' },
    { key: 'zip', text: 'Download Pages ZIP', href: book.links?.zip, icon: 'zip' },
    { key: 'files', text: 'Download Print Files', href: book.links?.files, icon: 'book' },
    { key: 'lms', text: 'Download LMS File', href: book.links?.lms, icon: 'graduation cap' },
  ];

  /**
   * Load the Book's Table of Contents from the server and save to state.
   */
  const getTOC = useCallback(async () => {
    try {
      const tocRes = await axios.get(`/commons/book/${bookID}/toc`);
      if (!tocRes.data.err) {
        if (typeof (tocRes.data.toc) === 'object') {
          if (Array.isArray(tocRes.data.toc.children)) { // skip first level
            setBookTOC(tocRes.data.toc.children);
          }
        }
      } else {
        handleGlobalError(tocRes.data.errMsg);
      }
    } catch (e) {
      handleGlobalError(e);
    }
    setLoadedTOC(true);
  }, [bookID, setBookTOC, setLoadedTOC, handleGlobalError]);

  /**
   * Load the Licensing Report from the server and, if found, compute
   * the information to display in the pie chart.
   */
  const getLicenseReport = useCallback(async () => {
    const processTOC = (pages) => {
      if (Array.isArray(pages)) {
        return pages.map((item) => {
          const processedItem = { ...item };
          if (item.license?.raw) {
            processedItem.color = getLicenseColor(item.license.raw);
          }
          if (item.license?.link && item.license.link !== '#') {
            processedItem.metaLink = {
              url: item.license.link,
              text: `${item.license.label} ${item.license.version ? item.license.version : ''}`,
            };
          } else {
            processedItem.meta = { text: item.license.label };
          }
          if (Array.isArray(item.children)) {
            processedItem.children = processTOC(item.children);
          }
          return processedItem;
        });
      }
      return [];
    };
    try {
      const licRes = await axios.get(`/commons/book/${bookID}/licensereport`);
      if (!licRes.data.err) {
        if (licRes.data.data) {
          setFoundCLR(true);
          const licenseReport = licRes.data.data;
          setCLRData(licenseReport);
          const pieChart = [];
          if (Array.isArray(licenseReport.meta?.licenses)) {
            const nonUnclassedLics = licenseReport.meta.licenses.filter((item) => (
              item.raw !== 'notset'
            ));
            if (nonUnclassedLics.length > 1) {
              setBook((b) => ({
                ...b,
                license: 'multiple',
                licenseVersion: null,
              }));
            } else if (nonUnclassedLics.length === 1) {
              const singleLicense = licenseReport.meta.licenses[0];
              if (typeof (singleLicense.raw) === 'string') {
                setBook((b) => ({
                  ...b,
                  license: singleLicense.raw,
                  licenseVersion: singleLicense.version,
                }));
              }
            }
            licenseReport.meta.licenses.forEach((item) => {
              let title = item.label;
              if (item.version) {
                title = `${title} ${item.version}`;
              }
              const value = parseFloat(item.percent);
              if (!Number.isNaN(value)) {
                pieChart.push({
                  color: getLicenseColor(item.raw),
                  raw: item.raw,
                  value,
                  title,
                });
              }
            });
            setPieChartData(pieChart);
            if (Array.isArray(licenseReport.text?.children)) {
              setCLRChapters(processTOC(licenseReport.text.children));
            }
            setLoadedLicensing(true);
          }
        }
      } else {
        throw (new Error(licRes.data.errMsg));
      }
    } catch (e) {
      console.error(e); // fail silently
    }
  }, [bookID, setBook, setFoundCLR, setCLRData, setPieChartData,
    setCLRChapters, setLoadedLicensing]);

  /**
   * Load any Peer Reviews from the server and save to state.
   */
  const getPeerReviews = useCallback(async () => {
    try {
      const prRes = await axios.get(`/commons/book/${bookID}/peerreviews`);
      if (!prRes.data.err) {
        if (Array.isArray(prRes.data.reviews) && prRes.data.reviews.length > 0) {
          const sorted = [...prRes.data.reviews].sort((a, b) => {
            const aKey = new Date(a.createdAt);
            const bKey = new Date(b.createdAt);
            if (aKey < bKey) {
              return -1;
            }
            if (aKey > bKey) {
              return 1;
            }
            return 0;
          });
          setPRReviews(sorted);
        }
        /*
        if (typeof (prRes.data.averageRating) === 'number') {
          setPRRating(prRes.data.averageRating);
        }
        */
      } else {
        throw (new Error(prRes.data.errMsg));
      }
    } catch (e) {
      console.error(e); // fail silently
    }
  }, [bookID, setPRReviews]);

  /**
   * Load the Files list from the server, prepare it for the UI, then save it to state.
   */
  const getProjectFiles = useCallback(async () => {
    setLoadingFiles(true);
    axios.get(`/commons/book/${bookID}/files/${currDirectory}`).then((res) => {
      if (!res.data.err) {
        if (Array.isArray(res.data.files)) {
          setProjFiles(res.data.files);
        }
        if (Array.isArray(res.data.path)) {
          setCurrDirPath(res.data.path);
        }
      } else {
        throw new Error(res.data.errMsg);
      }
      if(!res.data.err) {
        setProjFiles(res.data.files)
      }
      else {
        handleGlobalError(res.data.errMsg)
      }
      setLoadingFiles(false)
    }).catch((err) => {
      handleGlobalError(err);
      setLoadingFiles(false);
    });
  }, [bookID, currDirectory, setProjFiles, setCurrDirPath, setLoadingFiles, handleGlobalError]);

  /**
   * Load information about the Book from the server catalog.
   */
  const getBook = useCallback(async () => {
    setLoadedData(false);
    try {
      const bookRes = await axios.get(`/commons/book/${bookID}`);
      if (!bookRes.data.err) {
        if (bookRes.data.book) {
          const bookData = bookRes.data.book;
          bookData.license = ''; // hotfix for new license infrastructure
          setBook(bookData);
          if (
            bookData.allowAnonPR
            && typeof (bookData.projectID) === 'string'
            && bookData.projectID.length > 0
          ) {
            setPRAllow(true);
            setPRProjectID(bookData.projectID)
          }
          if (bookData.hasPeerReviews) {
            getPeerReviews();
          }
          getTOC();
        }
      } else {
        handleGlobalError(bookRes.data.errMsg);
      }
    } catch (e) {
      handleGlobalError(e);
    }
    setLoadedData(true);
  }, [bookID, getTOC, getPeerReviews, setBook, setPRAllow,
      setPRProjectID, setLoadedData, handleGlobalError]);

  /**
   * Register plugins and load data and preferences on initialization.
   */
  useEffect(() => {
    date.plugin(ordinal);
    getBook();
    if (localStorage.getItem('commons_show_toc') === 'true') {
      setShowTOC(true);
    }
    if (localStorage.getItem('commons_show_licensing') === 'true') {
      setShowLicensing(true);
    }
  }, [getBook, setShowTOC, setShowLicensing]);

  /**
   * Update page title when data is available.
   */
  useEffect(() => {
    if (book.title && book.title !== '') {
      document.title = "LibreCommons | " + book.title;
    }
  }, [book]);

  /**
   * Look for licensing report once book information is loaded.
   */
  useEffect(() => {
    if (loadedData && !loadedLicensing) {
      getLicenseReport();
    }
  }, [loadedData, loadedLicensing, getLicenseReport]);

  /**
   * Read URL Search Parameters to automatically open any requested tools
   * (e.g. from a direct link from the LibreTexts Libraries).
   */
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('adoptionreport') === 'show') {
      setShowAdoptionReport(true); 
    }
    if (searchParams.get('peerreview') === 'show' && prAllow) {
      setPRShow(true);
    }
    if (searchParams.get('files') === 'show') {
      setShowFiles(true)
    }
  }, [location, prAllow, setShowAdoptionReport, setPRShow, setShowFiles]);

  /**
   * Updates state and localStorage with the user's preference to display a Book's Table of Contents.
   */
  function handleChangeTOCVis() {
    setShowTOC(!showTOC);
    localStorage.setItem('commons_show_toc', !showTOC);
  }

  /**
   * Updates state and localStorage with the user's preference to display Book Licensing.
   */
  function handleChangeLicensingVis() {
    setShowLicensing(!showLicensing);
    localStorage.setItem('commons_show_licensing', !showLicensing);
  }

  /**
   * Handles requests to open the Adoption Report modal.
   */
  function handleOpenAdoptionReport() {
    setShowAdoptionReport(true);
  }

  /**
   * Handles requests to open the new Peer Review modal.
   */
  function handleOpenPeerReviewForm() {
    setPRShow(true);
  }

  /**
   * Handles requests to open the Peer Reviews modal.
   */
  function handleOpenPeerReviews() {
    setPRReviewsShow(true);
  }

  /**
   * Enters a specified Peer Review into state and opens the Peer Review View Modal.
   *
   * @param {Object} peerReview - The Peer Review to be opened.
   */
  function handleOpenPeerReviewView(peerReview) {
    if (typeof (peerReview) === 'object' && Object.keys(peerReview).length > 0) {
      setPRViewData(peerReview);
      setPRViewShow(true);
    }
  }

  /**
   * Closes the Peer Review View Modal and resets its state.
   */
  function handleClosePeerReviewView() {
    setPRViewShow(false);
    setPRViewData({});
  }

  /**
   * Refresh Project Files when currDirectory (folder) changes
   */
  useEffect(() => {
    getProjectFiles();
  }, [getProjectFiles])

  /**
   * Updates state with the a new directory to bring into view.
   *
   * @param {string} directoryID - Identifier of the directory entry.
   */
  function handleDirectoryClick(directoryID) {
    setCurrDirectory(directoryID);
  }

  const handleChangeFilesVis = () => {
    setShowFiles(!showFiles);
    localStorage.setItem('commons_show_files', !showFiles);
  };

  const handleFileSearch = (_e, { value }) => {
    setFileSearchLoading(true);
    setFileSearchQuery(value);
    let searchRegExp = new RegExp(value.toLowerCase(), 'g');
    let results = projFiles.filter((file) => {
      let descripString = String(file.name).toLowerCase() + ' ' + String(file.description).toLocaleLowerCase();
      if (value !== '') {
        let match = descripString.match(searchRegExp);
        if (match !== null && match.length > 0) {
          return file;
        }
      }
      return false;
    }).map((item) => {
      return {
        id: item.fileID,
        title: item.name,
      }
    });
    setFileSearchResults(results);
    setFileSearchLoading(false);
  };

  const handleFileSearchSelect = (resultID) => {
    const foundFile = projFiles.find((file) => file.fileID === resultID)
    if(foundFile){
      if(foundFile.storageType === 'folder') handleDirectoryClick(foundFile.fileID)
      if(foundFile.storageType === 'file') handleDownloadFile(foundFile.fileID)
    }
  }

  /**
   * Requests a download link from the server for a File entry, then opens it in a new tab.
   *
   * @param {string} fileID - Identifier of the File to download.
   */
  async function handleDownloadFile(fileID) {
    try {
      const downloadRes = await axios.get(`/commons/book/${bookID}/files/${fileID}/download`);
      if (!downloadRes.data.err) {
        if (typeof (downloadRes.data.url) === 'string') {
          window.open(downloadRes.data.url, '_blank', 'noreferrer');
        }
      } else {
        throw (new Error(downloadRes.data.errMsg));
      }
    } catch (e) {
      handleGlobalError(e);
    }
  }

  /**
   * Renders a link or span with information about a given License.
   *
   * @param {Object} licenseObj - License information object, including label, link,
   *  and version (if applicable).
   * @returns {React.ReactElement | null} The UI-ready license information presentation.
   */
  function renderLicenseLink(licenseObj) {
    if (typeof (licenseObj) === 'object') {
      if (licenseObj.link && licenseObj.link !== '#') {
        return (
          <a href={licenseObj?.link} target='_blank' rel='noopener noreferrer'>
            {licenseObj.label} {licenseObj.version}
          </a>
        );
      }
      return <span>{licenseObj.label} {licenseObj.version}</span>;
    }
    return null;
  };

  /**
   * Prepares a UI-ready representation of the Book's applicable license restrictions.
   *
   * @param {string[]} specialRestrictions - An array of internal license restriction identifiers.
   * @returns {string} A UI-ready string listing applicable license restrictions.
   */
  function renderLicenseSpecialRestrictions(specialRestrictions) {
    let restrString = '';
    let restrCount = 0;

    const addToRestrictionsString = (restriction) => {
      if (restrCount > 0) {
        restrString = `${restrString}, `;
      }
      restrString = `${restrString}${restriction}`;
      restrCount += 1;
    };

    if (Array.isArray(specialRestrictions)) {
      if (specialRestrictions.includes('noncommercial')) {
        addToRestrictionsString('Noncommercial');
      }
      if (specialRestrictions.includes('noderivatives')) {
        addToRestrictionsString('No Derivatives');
      }
      if (specialRestrictions.includes('fairuse')) {
        addToRestrictionsString('Fair Use');
      }
    }
    return restrString;
  };

  /**
   * Attempts to render attribution information about a Book's thumbnail.
   *
   * @param {Object} opts - Options to use during rendering.
   * @returns {React.ReactElement} A paragraph with thumbnail attribution information.
   */
  function ThumbnailAttribution(opts) {
    if (book.thumbnailAttr) {
      const {
        title: thmbnlTitle,
        link: thmbnlLink,
        license: thmbnlLic,
        licLink: thmbnlLicLink,
      } = book.thumbnailAttr;
      const icon = <Icon name="file image" />;
      const parts = ['Thumbnail via '];
      if (thmbnlTitle && thmbnlLink) {
        parts.push(<a href={thmbnlLink} target="_blank" rel="noreferrer">{thmbnlTitle}</a>);
      } else {
        parts.push(thmbnlTitle);
      }
      if (thmbnlLic) {
        parts.push(', licensed under the ');
        if (thmbnlLicLink) {
          parts.push(<a href={thmbnlLicLink} target="_blank" rel="noreferrer">{thmbnlLic}</a>)
        } else {
          parts.push(thmbnlLic);
        }
        parts.push(' license.');
      }
      return (
        <p {...opts}>{icon} {parts.map((part, idx) => <span key={idx}>{part}</span>)}</p>
      )
    }
    return null;
  }

  /**
   * Renders UI buttons related to Peer Reviews, depending on access and visibility settings
   * of project (if applicable).
   *
   * @returns {React.ReactElement} The rendered Button or Button.Group.
   */
  function PeerReviewButtons() {
    const buttonProps = {
      icon: 'clipboard list',
      color: 'orange',
      fluid: true,
    };
    const submitButtonProps = {
      ...buttonProps,
      icon: 'clipboard list',
      content: 'Submit a Peer Review',
      onClick: handleOpenPeerReviewForm,
    };
    const viewButtonProps = {
      ...buttonProps,
      icon: 'ul list',
      content: 'View Peer Reviews',
      onClick: handleOpenPeerReviews,
    };
    if (prAllow && prReviews.length > 0) {
      // allows reviews and has existing reviews
      return (
        <Button.Group
          vertical
          labeled
          icon
          fluid
          className="mt-05r"
        >
          <Button {...submitButtonProps} />
          <Button {...viewButtonProps} />
        </Button.Group>
      )
    }
    if (prAllow) {
      // allows reviews, none yet
      return <Button className="mt-05r" {...submitButtonProps} />
    }
    if (prReviews.length > 0) {
      // doesn't allow reviews, but existing are visible
      return <Button className="mt-05r" {...viewButtonProps} />
    }
    return null;
  };

  /**
   * Renders a Pie Chart using the Book's Licensing Report data.
   *
   * @returns {React.ReactElement} The pie chart with data and labels.
   */
  function LicensingPieChart() {
    return (
      <PieChart
        data={pieChartData}
        label={({ dataEntry }) => `${dataEntry.value.toFixed(1)}%`}
        labelStyle={(index) => ({
          fill: pieChartData[index].color,
          fontSize: '5px',
        })}
        animate
        style={{
          maxHeight: '250px'
        }}
        radius={42}
        labelPosition={112}
      />
    )
  }

  /**
   * Renders a list of all licenses found in the Book's Licensing Report data.
   *
   * @returns {React.ReactElement} The rendered list.
   */
  function LicensingList() {
    return (
      <ul>
        {pieChartData.map((pieItem) => {
          let licItem = null;
          if (Array.isArray(clrData.meta?.licenses)) {
            licItem = clrData.meta.licenses.find((findItem) => (
              pieItem.value === findItem.percent && pieItem.raw === findItem.raw
            ));
          }
          if (licItem) {
            let licPercent = licItem.percent;
            if (typeof (licPercent) === 'number') {
              licPercent = licPercent.toFixed(1);
            }
            return (
              <li key={`pie-${licItem.raw}`}>
                <div className="commons-book-clr-overview-flex">
                  <span>{renderLicenseLink(licItem)}</span>
                  <span className="right">
                    ({licItem.count} {licItem.count > 1 ? 'pages' : 'page'}) {licPercent}%
                    <Icon name="square full" style={{ color: pieItem.color }} className="ml-2p" />
                  </span>
                </div>
              </li>
            )
          }
          return null;
        })}
      </ul>
    )
  }

  /**
   * Renders the Book's Licensing Report.
   *
   * @returns {React.ReactElement} The rendered Licensing Report.
   */
  function LicensingReport() {
    return (
      <div className={styles.clr_wrapper}>
        <div className={styles.clr_overview}>
          <Header as="h4" className="mt-2p" dividing>Overview</Header>
          <div className="commons-book-clr-overview-flex">
            <span><strong>Webpages: </strong></span>
            <span className="right">{clrData.text?.totalPages || 'Unknown'}</span>
          </div>
          {(Array.isArray(clrData.meta?.specialRestrictions) && clrData.meta.specialRestrictions.length > 0) && (
            <div className="commons-book-clr-overview-flex">
              <span><strong>Applicable Restrictions:</strong></span>
              <span className="right">{renderLicenseSpecialRestrictions(clrData.meta.specialRestrictions)}</span>
            </div>
          )}
          <div className="commons-book-clr-overview-flex">
            <span><strong>All licenses:</strong></span>
          </div>
          {pieChartData.length > 0 && (
            <LicensingList />
          )}
        </div>
        <div className={styles.clr_breakdown}>
          <Header as="h4" className="mt-2p" dividing>Breakdown</Header>
          {clrChapters.length > 0 ? (
            <TreeView
              items={clrChapters}
              asLinks={true}
              hrefKey="url"
              textKey="title"
            />
          ) : (
            <p className={styles.meta_largefont}>Licensing breakdown unavailable.</p>
          )}
        </div>
        {pieChartData.length > 0 && (
          <div className={styles.clr_chart}>
            <LicensingPieChart />
          </div>
        )}
      </div>
    );
  }

  /**
   * Generates path breadcrumbs based on the current directory in view.
   *
   * @returns {React.ReactElement} The generated breadcrumbs.
   */
  function DirectoryBreadcrumbs() {
    const nodes = [];
    currDirPath.forEach((item, idx) => {
      let shouldLink = true;
      let name = item.name;
      if (item.name === "" && item.fileID === "") {
        name = "Files";
      } else {
        nodes.push(
          <Breadcrumb.Divider
            key={`divider-${item.fileID}`}
            icon="right chevron"
          />
        );
      }
      if (idx === currDirPath.length - 1) {
        shouldLink = false; // don't click active directory
      }
      nodes.push(
        <span
          key={`section-${item.fileID}`}
          onClick={
            shouldLink ? () => handleDirectoryClick(item.fileID) : undefined
          }
          className={shouldLink ? "text-link" : ""}
        >
          {name}
        </span>
      );
    });
    return <Breadcrumb>{nodes}</Breadcrumb>;
  }

  return (
    <div className="commons-page-container">
      <Segment.Group raised>
        <Segment>
          <Breadcrumb>
            <Breadcrumb.Section as={Link} to="/catalog">
              <span>
                <span className="muted-text">You are on: </span>
                Catalog
              </span>
            </Breadcrumb.Section>
            <Breadcrumb.Divider icon="right chevron" />
            <Breadcrumb.Section active>{book.title}</Breadcrumb.Section>
          </Breadcrumb>
        </Segment>
        <Segment loading={!loadedData} className="pt-1p">
          <div className={styles.grid}>
            <div className={styles.book_meta}>
              <img id={styles.thumbnail} src={book.thumbnail} aria-hidden={true} alt="" />
              <h2 id={styles.title} className="text-center">{book.title}</h2>
              <div className={styles.attributes}>
                {!isEmptyString(book.author) && (
                  <p className={styles.book_detail}>
                    <Icon name="user" /> {book.author}
                  </p>
                )}
                {!isEmptyString(book.library) && (
                  <p className={styles.book_detail}>
                    <Image
                      src={getLibGlyphURL(book.library)}
                      className="library-glyph"
                      inline
                      aria-hidden="true"
                    />
                    {getLibraryName(book.library)}
                  </p>
                )}
                {!isEmptyString(book.license) && (
                  <p className={styles.book_detail}>
                    <Icon name="shield" /> {getLicenseText(book.license, book.licenseVersion)}
                  </p>
                )}
                {!isEmptyString(book.affiliation) && (
                  <p className={styles.book_detail}>
                    <Icon name="university" /> {book.affiliation}
                  </p>
                )}
                {!isEmptyString(book.course) && (
                  <p className={styles.book_detail}>
                    <Icon name="sitemap" /> {book.course}
                  </p>
                )}
                <ThumbnailAttribution className={styles.book_detail} />
                {prReviews.length > 0 && (
                  <p className={styles.book_detail}>
                    <Icon name="clipboard list" />
                    {prReviews.length} Peer Review{prReviews.length > 1 && 's'}
                  </p>
                )}
              </div>
              {(typeof (book.rating) === 'number' && book.rating > 0) && (
                <div id={styles.rating_wrapper}>
                  <StarRating value={book.rating} displayMode={true} />
                </div>
              )}
              <Button
                icon="hand paper"
                content="Submit an Adoption Report"
                color="green"
                fluid
                onClick={handleOpenAdoptionReport}
                className="mt-2e"
              />
              <PeerReviewButtons />
              {(book.hasAdaptCourse && book.adaptCourseID !== '') && (
                <Button
                  color="teal"
                  fluid
                  as="a"
                  href={`https://adapt.libretexts.org/courses/${book.adaptCourseID}/anonymous`}
                  target="_blank"
                  rel="noreferrer"
                  className={`mt-05r ${styles.adapt_button}`}
                >
                  <img src="/adapt_icon_white.png" aria-hidden="true" alt="" />
                  <span>View Homework on ADAPT</span>
                </Button>
              )}
              <Button.Group fluid vertical labeled icon color="blue" className="mt-2r">
                {accessLinks.map((item) => (
                  <Button
                    key={item.key}
                    icon={item.icon}
                    content={item.text}
                    as='a'
                    href={item.href}
                    target='_blank'
                    rel='noreferrer'
                    tabIndex={0}
                  />
                ))}
              </Button.Group>
            </div>
            <div className={styles.book_info}>
              {!isEmptyString(book.summary) && (
                <Segment>
                  <Header as='h3' dividing>Summary</Header>
                  <p className={styles.meta_largefont}>{book.summary}</p>
                </Segment>
              )}
                  {showFiles &&
                      <Segment.Group size='large' raised className='mb-4p'>
                        <Segment>
                          <div className='ui dividing header'>
                            <div className='hideablesection'>
                              <h3 className='header'>
                                Files
                              </h3>
                              <div className='button-container'>
                                <Button
                                compact
                                floated='right'
                                onClick={() => { setFileSearchQuery(''); handleChangeFilesVis() }}
                                >
                                Hide
                                </Button>
                              </div>
                            </div>
                          </div>
                          <div className='flex-row-div'>
                            <div className='left-flex ml-05e'>
                              <DirectoryBreadcrumbs />
                            </div>
                            <div className='right-flex'>
                              <Search
                                input={{
                                  icon: 'search',
                                  iconPosition: 'left',
                                  placeholder: 'Search files...'
                                }}
                                loading={fileSearchLoading}
                                onResultSelect={(_e, {result} ) => handleFileSearchSelect(result.id)}
                                onSearchChange={handleFileSearch}
                                results={fileSearchResults}
                                value={fileSearchQuery}
                                size='mini'
                              />
                            </div>
                          </div>
                        </Segment>
                        <Segment loading={loadingFiles} className={(projFiles.length === 0) ? 'muted-segment' : ''}>
                          {(projFiles.length > 0)
                            ? (
                              <List divided verticalAlign='middle'>
                                {projFiles.map((file, idx) => {
                                  return (
                                    <List.Item key={file.fileID}>
                                      <div className='flex-col-div'>
                                        <div className='flex-row-div'>
                                          <div className='left-flex'>
                                            <div className='project-file-title-column'>
                                              <div className={file.description ? 'mb-01e' : ''}>
                                              {file.storageType === 'folder' ? (
                                                <Icon name="folder outline" />
                                                ) : (
                                                <FileIcon filename={file.name} />
                                                )}
                                                {file.storageType === 'folder' ? (
                                                <span
                                                  className={`text-link ${styles.project_file_title}`}
                                                  onClick={() => handleDirectoryClick(file.fileID)}
                                                  >
                                                  {file.name}
                                                </span>
                                                ) : (
                                                <span className={styles.project_file_title}>{file.name}</span>
                                              )}
                                              </div>
                                              <div>
                                                {file.description && (
                                                  <span className={`muted-text ml-2e ${styles.project_file_descrip}`}>{truncateString(file.description, 100)}</span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                          <div className='right-flex'>
                                            <Popup
                                              content='Download File'
                                              trigger={
                                                (file.storageType === 'file') && (
                                                  <Button
                                                    icon
                                                    size="small"
                                                    title="Download file (opens in new tab)"
                                                    onClick={() => handleDownloadFile(file.fileID)}
                                                  >
                                                    <Icon name="download" />
                                                  </Button>
                                                )
                                              }
                                              position='top center'
                                            />
                                            <Popup
                                              content='Open Folder'
                                              trigger={
                                                (file.storageType === 'folder') && (
                                                  <Button
                                                    icon
                                                    size="small"
                                                    title="Open Folder"
                                                    onClick={() => handleDirectoryClick(file.fileID)}
                                                  >
                                                    <Icon name="folder open outline" />
                                                  </Button>
                                                )
                                              }
                                              position='top center'
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    </List.Item>
                                  )
                                })}
                              </List>
                            )
                            : (
                              <div>
                                <p className='text-center muted-text'><em>No files yet.</em></p>
                              </div>
                            )
                          }
                        </Segment>
                      </Segment.Group>
                  }
              {!showFiles &&
                  <Segment>
                  <div className='hiddensection'>
                    <div className='header-container'>
                      <Header as='h3'>Files</Header>
                    </div>
                    <div className='button-container'>
                      <Button
                        floated='right'
                        onClick={handleChangeFilesVis}
                      >
                        Show
                      </Button>
                    </div>
                  </div>
                </Segment>
              }
              {showTOC ? (
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
                  {(bookTOC.length > 0) ? (
                    <TreeView
                      items={bookTOC}
                      asLinks={true}
                      hrefKey='url'
                      textKey='title'
                    />
                  ) : (
                    <p className={styles.meta_largefont}><em>Table of contents unavailable.</em></p>
                  )}
                </Segment>
              ) : (
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
              )}
              {foundCLR &&
                (showLicensing ? (
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
                    <LicensingReport />
                  </Segment>
                ) : (
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
                ))}
            </div>
          </div>
        </Segment>
      </Segment.Group>
      {/* View Peer Reviews Modal */}
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
    </div>
  )
};

export default CommonsBook;
