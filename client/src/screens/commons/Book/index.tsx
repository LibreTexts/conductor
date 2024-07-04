import { useEffect, useState, useCallback, ReactElement } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
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
  Popup,
  SemanticCOLORS,
} from "semantic-ui-react";
import { PieChart, PieChartProps } from "react-minimal-pie-chart";
import axios from "axios";
import useGlobalError from "../../../components/error/ErrorHooks";
import {
  getLibGlyphURL,
  getLibraryName,
} from "../../../components/util/LibraryOptions.js";
import {
  getLicenseText,
  licenseOptions,
} from "../../../components/util/LicenseOptions.js";
import { isEmptyString } from "../../../components/util/HelperFunctions.js";
import { getLicenseColor } from "../../../components/util/BookHelpers.js";
import { getPeerReviewAuthorText } from "../../../components/util/ProjectHelpers.js";
import AdoptionReport from "../../../components/adoptionreport/AdoptionReport.jsx";
import TreeView from "../../../components/TreeView/index.jsx";
import PeerReview from "../../../components/peerreview/PeerReview.jsx";
import PeerReviewView from "../../../components/peerreview/PeerReviewView.jsx";
import StarRating from "../../../components/peerreview/StarRating.jsx";
import styles from "./Book.module.css";
import FileIcon from "../../../components/FileIcon/index.jsx";
import { truncateString } from "../../../components/util/HelperFunctions.js";
import { useTypedSelector } from "../../../state/hooks";
import {
  Book,
  License,
  LicenseReport,
  LicenseReportText,
  PeerReview as PeerReviewType,
  ProjectFile,
} from "../../../types";
import { isLicenseReport } from "../../../utils/typeHelpers";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import api from "../../../api";
type CustomPieChartData = {
  value: number;
  title: string;
  fill: string;
  color: string;
  raw: string;
};

/**
 * Displays a Commons Catalog Book entry and related information.
 */
const CommonsBook = () => {
  const { id: bookID } = useParams<{ id: string }>();
  const location = useLocation();

  // Global Error Handling
  const { handleGlobalError } = useGlobalError();

  // Global State
  const isConductorUser = useTypedSelector(
    (state) => state.user?.isAuthenticated
  );

  // Data
  const [book, setBook] = useState<Book>({
    coverID: "",
    bookID: "",
    title: "",
    author: "",
    affiliation: "",
    library: "",
    subject: "",
    course: "",
    license: "",
    thumbnail: "",
    summary: "",
    rating: 0,
    links: {
      online: "",
      pdf: "",
      buy: "",
      zip: "",
      files: "",
      lms: "",
    },
    location: "",
    program: "",
    lastUpdated: "",
    libraryTags: [],
    readerResources: [],
    hasReaderResources: false,
    hasAdaptCourse: false,
    allowAnonPR: false,
    hasPeerReviews: false,
  });

  // General UI
  const [showAdoptionReport, setShowAdoptionReport] = useState<boolean>(false);
  const [loadedData, setLoadedData] = useState<boolean>(false);
  const [loadedTOC, setLoadedTOC] = useState<boolean>(false);
  const [loadedLicensing, setLoadedLicensing] = useState<boolean>(false);
  const [showFiles, setShowFiles] = useState<boolean>(true); // show files by default
  const [showTOC, setShowTOC] = useState<boolean>(false);
  const [showLicensing, setShowLicensing] = useState<boolean>(false);

  // Project Files
  const [currDirectory, setCurrDirectory] = useState<string>("");
  const [currDirPath, setCurrDirPath] = useState([
    {
      fileID: "",
      name: "",
    },
  ]);
  const { data: projFiles, isFetching: loadingFiles } = useQuery<ProjectFile[]>(
    {
      queryKey: ["book-files", book.projectID, currDirectory],
      queryFn: getProjectFiles,
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    }
  );

  // File Search
  const [fileSearchLoading, setFileSearchLoading] = useState<boolean>(false);
  const [fileSearchQuery, setFileSearchQuery] = useState<string>("");
  const [fileSearchResults, setFileSearchResults] = useState<
    { title: string; description: string }[]
  >([]);

  // TOC
  const [bookTOC, setBookTOC] = useState([]);

  // Licensing Report
  const [foundCLR, setFoundCLR] = useState(false);
  const [pieChartData, setPieChartData] = useState<CustomPieChartData[]>([]);
  const [clrData, setCLRData] = useState<LicenseReport>({} as LicenseReport);
  const [clrChapters, setCLRChapters] = useState<any[]>([]);

  // Peer Reviews
  const [prAllow, setPRAllow] = useState<boolean>(false);
  const [prProjectID, setPRProjectID] = useState<string>("");
  const [prShow, setPRShow] = useState<boolean>(false);
  const [prReviews, setPRReviews] = useState<PeerReviewType[]>([]);
  const [prReviewsShow, setPRReviewsShow] = useState<boolean>(false);
  // const [prRating, setPRRating] = useState(0);
  const [prViewShow, setPRViewShow] = useState<boolean>(false);
  const [prViewData, setPRViewData] = useState<PeerReviewType>();

  const accessLinks = [
    {
      key: "online",
      text: "Read Online",
      href: book.links?.online,
      icon: "linkify",
    },
    {
      key: "pdf",
      text: "Download PDF",
      href: book.links?.pdf,
      icon: "file pdf",
    },
    {
      key: "print",
      text: "Buy Print Copy",
      href: book.links?.buy,
      icon: "shopping cart",
    },
    {
      key: "zip",
      text: "Download Pages ZIP",
      href: book.links?.zip,
      icon: "zip",
    },
    {
      key: "files",
      text: "Download Print Files",
      href: book.links?.files,
      icon: "book",
    },
    {
      key: "lms",
      text: "Download LMS File",
      href: book.links?.lms,
      icon: "graduation cap",
    },
  ];

  /**
   * Load the Book's Table of Contents from the server and save to state.
   */
  const getTOC = useCallback(async () => {
    try {
      const tocRes = await axios.get(`/commons/book/${bookID}/toc`);
      if (tocRes.data.err) {
        throw new Error(tocRes.data.err);
      }

      if (typeof tocRes.data.toc !== "object") {
        throw new Error("Error parsing server data.");
      }
      if (Array.isArray(tocRes.data.toc.children)) {
        // skip first level
        setBookTOC(tocRes.data.toc.children);
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
    const processTOC = (pages: LicenseReportText[]) => {
      if (Array.isArray(pages)) {
        return pages.map((item) => {
          const processedItem: LicenseReportText & {
            color: string;
            metaLink: object;
            meta: object;
          } = {
            color: "",
            metaLink: {},
            meta: {},
            ...item,
          };
          if (item.license?.raw) {
            processedItem.color = getLicenseColor(item.license.raw);
          }
          if (item.license?.link && item.license.link !== "#") {
            processedItem.metaLink = {
              url: item.license.link,
              text: `${item.license.label} ${
                item.license.version ? item.license.version : ""
              }`,
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
      if (licRes.data.err) {
        throw new Error(licRes.data.errMsg);
      }
      if (!licRes.data.data) {
        throw new Error("Error processing server data");
      }

      const licenseReport = licRes.data.data;
      if (!isLicenseReport(licenseReport)) {
        return;
      }

      setFoundCLR(true);
      setCLRData(licenseReport);
      let pieChart: CustomPieChartData[] = [];
      if (Array.isArray(licenseReport.meta?.licenses)) {
        const nonUnclassedLics = licenseReport.meta.licenses.filter(
          (item) => item.raw !== "notset"
        );
        if (nonUnclassedLics.length > 1) {
          setBook((b) => ({
            ...b,
            license: "multiple",
            licenseVersion: null,
          }));
        } else if (nonUnclassedLics.length === 1) {
          const singleLicense = licenseReport.meta.licenses[0];
          if (typeof singleLicense.raw === "string") {
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
          const value = parseFloat(item.percent?.toString() ?? "0"); // Default to zero if not present
          if (Number.isNaN(value)) {
            return;
          }

          pieChart.push({
            value,
            title,
            fill: getLicenseColor(item.raw),
            color: getLicenseColor(item.raw),
            raw: item.raw,
          });
        });
        setPieChartData(pieChart);
        if (Array.isArray(licenseReport.text?.children)) {
          setCLRChapters(processTOC(licenseReport.text.children));
        }
        setLoadedLicensing(true);
      }
    } catch (e) {
      console.error(e); // fail silently
    }
  }, [
    bookID,
    setBook,
    setFoundCLR,
    setCLRData,
    setPieChartData,
    setCLRChapters,
    setLoadedLicensing,
  ]);

  /**
   * Load any Peer Reviews from the server and save to state.
   */
  const getPeerReviews = useCallback(async () => {
    try {
      const prRes = await axios.get(`/commons/book/${bookID}/peerreviews`);
      if (!prRes.data.err) {
        if (
          Array.isArray(prRes.data.reviews) &&
          prRes.data.reviews.length > 0
        ) {
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
        throw new Error(prRes.data.errMsg);
      }
    } catch (e) {
      console.error(e); // fail silently
    }
  }, [bookID, setPRReviews]);

  /**
   * Load the Files list from the server, prepare it for the UI, then save it to state.
   */
  async function getProjectFiles() {
    try {
      if (!book.projectID) return [];

      const res = await api.getProjectFiles(book.projectID, currDirectory, true);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.files || !Array.isArray(res.data.files)) return [];

      if (Array.isArray(res.data.path)) {
        setCurrDirPath(res.data.path);
      }

      return res.data.files;
    } catch (e) {
      handleGlobalError(e);
      return [];
    }
  }

  /**
   * Load information about the Book from the server catalog.
   */
  const getBook = useCallback(async () => {
    setLoadedData(false);
    try {
      const bookRes = await axios.get(`/commons/book/${bookID}`);
      if (bookRes.data.err) {
        throw new Error(bookRes.data.err);
      }
      if (!bookRes.data.book) {
        throw new Error("Error processing server data.");
      }

      const bookData = bookRes.data.book;
      bookData.license = ""; // hotfix for new license infrastructure
      setBook(bookData);
      if (
        bookData.allowAnonPR &&
        typeof bookData.projectID === "string" &&
        bookData.projectID.length > 0
      ) {
        setPRAllow(true);
        setPRProjectID(bookData.projectID);
      }
      if (bookData.hasPeerReviews) {
        getPeerReviews();
      }
      getTOC();
    } catch (e) {
      handleGlobalError(e);
    }
    setLoadedData(true);
  }, [
    bookID,
    getTOC,
    getPeerReviews,
    setBook,
    setPRAllow,
    setPRProjectID,
    setLoadedData,
    handleGlobalError,
  ]);

  /**
   * Register plugins and load data and preferences on initialization.
   */
  useEffect(() => {
    getBook();
    if (localStorage.getItem("commons_show_toc") === "true") {
      setShowTOC(true);
    }
    if (localStorage.getItem("commons_show_licensing") === "true") {
      setShowLicensing(true);
    }
  }, [getBook, setShowTOC, setShowLicensing]);

  /**
   * Update page title when data is available.
   */
  useEffect(() => {
    if (book.title && book.title !== "") {
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
    if (searchParams.get("adoptionreport") === "show") {
      setShowAdoptionReport(true);
    }
    if (searchParams.get("peerreview") === "show" && prAllow) {
      setPRShow(true);
    }
    if (searchParams.get("files") === "show") {
      setShowFiles(true);
    }
  }, [location, prAllow, setShowAdoptionReport, setPRShow, setShowFiles]);

  /**
   * Updates state and localStorage with the user's preference to display a Book's Table of Contents.
   */
  function handleChangeTOCVis() {
    setShowTOC(!showTOC);
    localStorage.setItem("commons_show_toc", JSON.stringify(!showTOC));
  }

  /**
   * Updates state and localStorage with the user's preference to display Book Licensing.
   */
  function handleChangeLicensingVis() {
    setShowLicensing(!showLicensing);
    localStorage.setItem(
      "commons_show_licensing",
      JSON.stringify(!showLicensing)
    );
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
  function handleOpenPeerReviewView(peerReview: PeerReviewType) {
    setPRViewData(peerReview);
    setPRViewShow(true);
  }

  /**
   * Closes the Peer Review View Modal and resets its state.
   */
  function handleClosePeerReviewView() {
    setPRViewShow(false);
    setPRViewData(undefined);
  }

  /**
   * Updates state with the a new directory to bring into view.
   *
   * @param {string} directoryID - Identifier of the directory entry.
   */
  function handleDirectoryClick(directoryID: string) {
    setCurrDirectory(directoryID);
  }

  const handleChangeFilesVis = () => {
    setShowFiles(!showFiles);
    localStorage.setItem("commons_show_files", JSON.stringify(!showFiles));
  };

  const handleFileSearch = (_e: any, { value }: { value: string }) => {
    setFileSearchLoading(true);
    setFileSearchQuery(value);
    let searchRegExp = new RegExp(value.toLowerCase(), "g");
    let filterResults = projFiles?.filter((file) => {
      let descripString =
        String(file.name).toLowerCase() +
        " " +
        String(file.description).toLocaleLowerCase();
      if (value !== "") {
        let match = descripString.match(searchRegExp);
        if (match !== null && match.length > 0) {
          return file;
        }
      }
      return false;
    });

    let results = filterResults?.map((item) => {
      return {
        title: item.name,
        description: item.description,
      };
    });
    setFileSearchResults(results ?? []);
    setFileSearchLoading(false);
  };

  const handleFileSearchSelect = (resultID: string) => {
    const foundFile = projFiles?.find((file) => file.fileID === resultID);
    if (!foundFile) return;

    if (foundFile.storageType === "folder") {
      handleDirectoryClick(foundFile.fileID);
    }
    if (foundFile.storageType === "file") {
      handleDownloadFile(foundFile.fileID);
    }
  };

  /**
   * Requests a download link from the server for a File entry, then opens it in a new tab.
   *
   * @param {string} fileID - Identifier of the File to download.
   */
  async function handleDownloadFile(fileID: string) {
    try {
      const downloadRes = await axios.get(
        `/commons/book/${bookID}/files/${fileID}/download`
      );
      if (downloadRes.data.err) {
        throw new Error(downloadRes.data.err);
      }
      if (typeof downloadRes.data.url === "string") {
        window.open(downloadRes.data.url, "_blank", "noreferrer");
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
  function renderLicenseLink(licenseObj: License) {
    if (typeof licenseObj === "object") {
      if (licenseObj.link && licenseObj.link !== "#") {
        return (
          <a href={licenseObj?.link} target="_blank" rel="noopener noreferrer">
            {licenseObj.label} {licenseObj.version}
          </a>
        );
      }
      return (
        <span>
          {licenseObj.label} {licenseObj.version}
        </span>
      );
    }
    return null;
  }

  /**
   * Prepares a UI-ready representation of the Book's applicable license restrictions.
   *
   * @param {string[]} specialRestrictions - An array of internal license restriction identifiers.
   * @returns {string} A UI-ready string listing applicable license restrictions.
   */
  function renderLicenseSpecialRestrictions(specialRestrictions: string[]) {
    let restrString = "";
    let restrCount = 0;

    const addToRestrictionsString = (restriction: string) => {
      if (restrCount > 0) {
        restrString = `${restrString}, `;
      }
      restrString = `${restrString}${restriction}`;
      restrCount += 1;
    };

    if (Array.isArray(specialRestrictions)) {
      if (specialRestrictions.includes("noncommercial")) {
        addToRestrictionsString("Noncommercial");
      }
      if (specialRestrictions.includes("noderivatives")) {
        addToRestrictionsString("No Derivatives");
      }
      if (specialRestrictions.includes("fairuse")) {
        addToRestrictionsString("Fair Use");
      }
    }
    return restrString;
  }

  /**
   * Renders UI buttons related to Peer Reviews, depending on access and visibility settings
   * of project (if applicable).
   *
   * @returns {React.ReactElement} The rendered Button or Button.Group.
   */
  function PeerReviewButtons() {
    const buttonProps = {
      icon: "clipboard list",
      color: "orange" as SemanticCOLORS,
      fluid: true,
    };
    const submitButtonProps = {
      ...buttonProps,
      icon: "clipboard list",
      content: "Submit a Peer Review",
      onClick: handleOpenPeerReviewForm,
    };
    const viewButtonProps = {
      ...buttonProps,
      icon: "ul list",
      content: "View Peer Reviews",
      onClick: handleOpenPeerReviews,
    };
    if (prAllow && prReviews.length > 0) {
      // allows reviews and has existing reviews
      return (
        <Button.Group vertical labeled icon fluid className="mt-05r">
          <Button {...submitButtonProps} />
          <Button {...viewButtonProps} />
        </Button.Group>
      );
    }
    if (prAllow) {
      // allows reviews, none yet
      return <Button className="mt-05r" {...submitButtonProps} />;
    }
    if (prReviews.length > 0) {
      // doesn't allow reviews, but existing are visible
      return <Button className="mt-05r" {...viewButtonProps} />;
    }
    return null;
  }

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
          fontSize: "5px",
        })}
        animate
        style={{
          maxHeight: "250px",
        }}
        radius={42}
        labelPosition={112}
      />
    );
  }

  /**
   * Renders a list of all licenses found in the Book's Licensing Report data.
   *
   * @returns {React.ReactElement} The rendered list.
   */
  function LicensingList() {
    return (
      <ul>
        {pieChartData.map((pieDataItem) => {
          let licItem = null;
          if (Array.isArray(clrData.meta?.licenses)) {
            licItem = clrData.meta.licenses.find(
              (findItem) =>
                pieDataItem.value === findItem.percent &&
                pieDataItem.raw === findItem.raw
            );
          }
          if (!licItem || !licItem.count || !licItem.percent) {
            return null;
          }

          let licPercent;
          if (licItem.percent) {
            licPercent = parseInt(licItem.percent.toString());
            licPercent = licPercent;
          }

          return (
            <li key={`pie-${licItem.raw}`}>
              <div className="commons-book-clr-overview-flex">
                <span>{renderLicenseLink(licItem)}</span>
                <span className="right">
                  ({licItem.count} {licItem.count > 1 ? "pages" : "page"}){" "}
                  {licPercent}%
                  <Icon
                    name="square full"
                    style={{ color: pieDataItem.color }}
                    className="ml-2p"
                  />
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    );
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
          <Header as="h4" className="mt-2p" dividing>
            Overview
          </Header>
          <div className="commons-book-clr-overview-flex">
            <span>
              <strong>Webpages: </strong>
            </span>
            <span className="right">
              {clrData.text?.totalPages || "Unknown"}
            </span>
          </div>
          {Array.isArray(clrData.meta?.specialRestrictions) &&
            clrData.meta.specialRestrictions.length > 0 && (
              <div className="commons-book-clr-overview-flex">
                <span>
                  <strong>Applicable Restrictions:</strong>
                </span>
                <span className="right">
                  {renderLicenseSpecialRestrictions(
                    clrData.meta.specialRestrictions
                  )}
                </span>
              </div>
            )}
          <div className="commons-book-clr-overview-flex">
            <span>
              <strong>All licenses:</strong>
            </span>
          </div>
          {pieChartData.length > 0 && <LicensingList />}
        </div>
        <div className={styles.clr_breakdown}>
          <Header as="h4" className="mt-2p" dividing>
            Breakdown
          </Header>
          {clrChapters.length > 0 ? (
            <TreeView
              items={clrChapters}
              asLinks={true}
              hrefKey="url"
              textKey="title"
            />
          ) : (
            <p className={styles.meta_largefont}>
              Licensing breakdown unavailable.
            </p>
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
    const nodes: ReactElement[] = [];
    currDirPath.forEach((item, idx) => {
      let shouldLink = true;
      let name = item.name;
      if (item.name === "" && item.fileID === "") {
        name = "Assets";
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
              <img
                id={styles.thumbnail}
                src={book.thumbnail}
                aria-hidden={true}
                alt=""
              />
              <h2 id={styles.title} className="text-center">
                {book.title}
              </h2>
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
                    <Icon name="shield" />{" "}
                    {getLicenseText(
                      book.license,
                      clrData.meta.mostRestrictiveLicense.version
                    )}
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
                {!isEmptyString(book.thumbnail) && (
                  <p className={styles.book_detail}>
                    <Icon name="file image" />
                    <a href={book.thumbnail} target="_blank">
                      {" "}
                      Thumbnail Source{" "}
                    </a>
                    <Icon name="external" />
                  </p>
                )}
                {prReviews.length > 0 && (
                  <p className={styles.book_detail}>
                    <Icon name="clipboard list" />
                    {prReviews.length} Peer Review{prReviews.length > 1 && "s"}
                  </p>
                )}
              </div>
              {typeof book.rating === "number" && book.rating > 0 && (
                <div id={styles.rating_wrapper}>
                  <StarRating value={book.rating} displayMode={true} />
                </div>
              )}
              {isConductorUser && book.projectID && (
                <Button
                  as="a"
                  icon="file alternate outline"
                  content="View Conductor Project"
                  color="blue"
                  fluid
                  className="mt-2e"
                  href={`/projects/${book.projectID}`}
                  target="_blank"
                  rel="noreferrer"
                />
              )}
              <Button
                icon="hand paper"
                content="Submit an Adoption Report"
                color="green"
                fluid
                onClick={handleOpenAdoptionReport}
                className="mt-05r"
              />
              <PeerReviewButtons />
              {book.hasAdaptCourse && book.adaptCourseID !== "" && (
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
              <Button.Group
                fluid
                vertical
                labeled
                icon
                color="blue"
                className="mt-2r"
              >
                {accessLinks.map((item) => (
                  <Button
                    key={item.key}
                    icon={item.icon}
                    content={item.text}
                    as="a"
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    tabIndex={0}
                  />
                ))}
              </Button.Group>
            </div>
            <div className={styles.book_info}>
              {!isEmptyString(book.summary) && (
                <Segment>
                  <Header as="h3" dividing>
                    Summary
                  </Header>
                  <p className={styles.meta_largefont}>{book.summary}</p>
                </Segment>
              )}
              {showFiles && projFiles && projFiles.length > 0 && (
                <Segment.Group size="large">
                  <Segment>
                    <div className="ui dividing header">
                      <div className="hideablesection">
                        <h3 className="header">Assets</h3>
                        <div className="button-container">
                          <Button
                            compact
                            floated="right"
                            onClick={() => {
                              setFileSearchQuery("");
                              handleChangeFilesVis();
                            }}
                          >
                            Hide
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="flex-row-div">
                      <div className="left-flex ml-05e">
                        <DirectoryBreadcrumbs />
                      </div>
                      <div className="right-flex">
                        <Search
                          input={{
                            icon: "search",
                            iconPosition: "left",
                            placeholder: "Search assets...",
                          }}
                          loading={fileSearchLoading}
                          onResultSelect={(_e, { result }) =>
                            handleFileSearchSelect(result.id)
                          }
                          onSearchChange={(_e, { value }) =>
                            handleFileSearch(_e, { value: value ?? "" })
                          }
                          results={fileSearchResults}
                          value={fileSearchQuery}
                          size="mini"
                        />
                      </div>
                    </div>
                  </Segment>
                  <Segment
                    loading={loadingFiles}
                    className={projFiles.length === 0 ? "muted-segment" : ""}
                  >
                    {projFiles.length > 0 ? (
                      <List divided verticalAlign="middle">
                        {projFiles.map((file, idx) => {
                          return (
                            <List.Item key={file.fileID}>
                              <div className="flex-col-div">
                                <div className="flex-row-div">
                                  <div className="left-flex">
                                    <div className="project-file-title-column">
                                      <div
                                        className={
                                          file.description ? "mb-01e" : ""
                                        }
                                      >
                                        {file.storageType === "folder" ? (
                                          <Icon name="folder outline" />
                                        ) : (
                                          <FileIcon filename={file.name} />
                                        )}
                                        {file.storageType === "folder" ? (
                                          <span
                                            className={`text-link ${styles.project_file_title}`}
                                            onClick={() =>
                                              handleDirectoryClick(file.fileID)
                                            }
                                          >
                                            {file.name}
                                          </span>
                                        ) : (
                                          <a
                                            onClick={() =>
                                              handleDownloadFile(file.fileID)
                                            }
                                            className={
                                              styles.project_file_title +
                                              " cursor-pointer"
                                            }
                                          >
                                            {file.name}
                                          </a>
                                        )}
                                      </div>
                                      <div>
                                        {file.description && (
                                          <span
                                            className={`muted-text ml-2e ${styles.project_file_descrip}`}
                                          >
                                            {truncateString(
                                              file.description,
                                              100
                                            )}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="right-flex">
                                    <Popup
                                      content="Download Asset"
                                      trigger={
                                        file.storageType === "file" && (
                                          <Button
                                            icon
                                            size="small"
                                            title="Download asset (opens in new tab)"
                                            onClick={() =>
                                              handleDownloadFile(file.fileID)
                                            }
                                          >
                                            <Icon name="download" />
                                          </Button>
                                        )
                                      }
                                      position="top center"
                                    />
                                    <Popup
                                      content="Open Folder"
                                      trigger={
                                        file.storageType === "folder" && (
                                          <Button
                                            icon
                                            size="small"
                                            title="Open Folder"
                                            onClick={() =>
                                              handleDirectoryClick(file.fileID)
                                            }
                                          >
                                            <Icon name="folder open outline" />
                                          </Button>
                                        )
                                      }
                                      position="top center"
                                    />
                                  </div>
                                </div>
                              </div>
                            </List.Item>
                          );
                        })}
                      </List>
                    ) : (
                      <div>
                        <p className="text-center muted-text">
                          <em>No assets yet.</em>
                        </p>
                      </div>
                    )}
                  </Segment>
                </Segment.Group>
              )}
              {!showFiles && projFiles && projFiles.length > 0 && (
                <Segment>
                  <div className="hiddensection">
                    <div className="header-container">
                      <Header as="h3">Assets</Header>
                    </div>
                    <div className="button-container">
                      <Button floated="right" onClick={handleChangeFilesVis}>
                        Show
                      </Button>
                    </div>
                  </div>
                </Segment>
              )}
              {showTOC ? (
                <Segment loading={!loadedTOC}>
                  <div className="ui dividing header">
                    <div className="hideablesection">
                      <h3 className="header">Table of Contents</h3>
                      <div className="button-container">
                        <Button
                          compact
                          floated="right"
                          onClick={handleChangeTOCVis}
                        >
                          Hide
                        </Button>
                      </div>
                    </div>
                  </div>
                  {bookTOC.length > 0 ? (
                    <TreeView
                      items={bookTOC}
                      asLinks={true}
                      hrefKey="url"
                      textKey="title"
                    />
                  ) : (
                    <p className={styles.meta_largefont}>
                      <em>Table of contents unavailable.</em>
                    </p>
                  )}
                </Segment>
              ) : (
                <Segment>
                  <div className="hiddensection">
                    <div className="header-container">
                      <Header as="h3">Table of Contents</Header>
                    </div>
                    <div className="button-container">
                      <Button floated="right" onClick={handleChangeTOCVis}>
                        Show
                      </Button>
                    </div>
                  </div>
                </Segment>
              )}
              {foundCLR &&
                (showLicensing ? (
                  <Segment>
                    <div className="ui dividing header">
                      <div className="hideablesection">
                        <h3 className="header">Licensing</h3>
                        <div className="button-container">
                          <Button
                            compact
                            floated="right"
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
                    <div className="hiddensection">
                      <div className="header-container">
                        <Header as="h3">Licensing</Header>
                      </div>
                      <div className="button-container">
                        <Button
                          floated="right"
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
        size="fullscreen"
      >
        <Modal.Header>
          Peer Reviews for <em>{book.title}</em>
        </Modal.Header>
        <Modal.Content>
          {prReviews.length > 0 ? (
            <List divided>
              {prReviews.map((item) => {
                let itemDate;
                if (item.createdAt) {
                  itemDate = format(new Date(item.createdAt), "MM/dd/yyyy");
                }
                return (
                  <List.Item key={item.peerReviewID}>
                    <div className="flex-row-div mt-05p mb-05p">
                      <div className="left-flex">
                        <div className="flex-col-div">
                          <span className="project-peerreview-title">
                            {item.author || "Unknown Reviewer"}
                          </span>
                          <span className="project-peerreview-detail muted-text">
                            <em>{getPeerReviewAuthorText(item.authorType)}</em>{" "}
                            <>&#8226;</> {itemDate}
                          </span>
                        </div>
                      </div>
                      <div className="right-flex">
                        <Button
                          color="blue"
                          onClick={() => handleOpenPeerReviewView(item)}
                        >
                          <Icon name="eye" /> View
                        </Button>
                      </div>
                    </div>
                  </List.Item>
                );
              })}
            </List>
          ) : (
            <p className="muted-text mt-2p mb-2p">No reviews found.</p>
          )}
        </Modal.Content>
        <Modal.Actions>
          <Button color="blue" onClick={() => setPRReviewsShow(false)}>
            Done
          </Button>
        </Modal.Actions>
      </Modal>
      <AdoptionReport
        open={showAdoptionReport}
        onClose={() => {
          setShowAdoptionReport(false);
        }}
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
  );
};

export default CommonsBook;
