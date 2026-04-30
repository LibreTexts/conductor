import { useEffect, useState, useCallback, ReactElement } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import {
  Icon,
  Segment,
  Header,
  Button as SUIButton,
  Breadcrumb,
  List,
  Search,
  Popup,
} from "semantic-ui-react";
import {
  Button,
  Heading,
  Text,
  Stack,
  Card,
  Avatar,
  Link as DavisLink,
  Spinner,
  Breadcrumb as DavisBreadcrumb,
} from "@libretexts/davis-react";
import {
  IconUser,
  IconShield,
  IconBuildingBank,
  IconSitemap,
  IconBookmark,
  IconArchive,
  IconCalendar,
  IconCalendarPlus,
  IconCalendarCheck,
  IconLanguage,
  IconPhoto,
  IconExternalLink,
  IconClipboardList,
  IconList,
  IconLink,
  IconFileText,
  IconShoppingCart,
  IconDownload,
  IconBook,
  IconSchool,
  IconHandStop,
  IconFileZip,
} from "@tabler/icons-react";
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
import AdoptionReport from "../../../components/adoptionreport/AdoptionReport.jsx";
import TreeView from "../../../components/TreeView/index.jsx";
import PeerReview from "../../../components/peerreview/PeerReview.jsx";
import StarRating from "../../../components/peerreview/StarRating.jsx";
import styles from "./Book.module.css";
import FileIcon from "../../../components/FileIcon/index.jsx";
import { truncateString } from "../../../components/util/HelperFunctions.js";
import { useTypedSelector } from "../../../state/hooks";
import {
  Book,
  BookWithSourceData,
  LicenseReport,
  LicenseReportLicense,
  LicenseReportText,
  PeerReview as PeerReviewType,
  ProjectFile,
  TableOfContents,
} from "../../../types";
import { isLicenseReport } from "../../../utils/typeHelpers";
import { useQuery } from "@tanstack/react-query";
import api from "../../../api";
import BookPeerReviewsModal from "../../../components/peerreview/BookPeerReviewsModal";
import { format, parseISO } from "date-fns";
import { getLanguageName } from "../../../utils/languageCodes";
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

  // Global State & Error Handling
  const { handleGlobalError } = useGlobalError();
  const user = useTypedSelector((state) => state.user);

  // Data
  const [book, setBook] = useState<BookWithSourceData>({
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
  const [loadedLicensing, setLoadedLicensing] = useState<boolean>(false);
  const [showFiles, setShowFiles] = useState<boolean>(true); // show files by default
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
  const { data: bookTOC, isLoading: loadingTOC } = useQuery<TableOfContents[]>({
    queryKey: ["book-toc", bookID],
    queryFn: async () => {
      const res = await api.getBookTOC(bookID);
      return res.data?.toc?.children // skip first level
    },
    enabled: !!bookID,
  })

  // Licensing Report
  const [foundCLR, setFoundCLR] = useState(false);
  const [pieChartData, setPieChartData] = useState<CustomPieChartData[]>([]);
  const [clrData, setCLRData] = useState<LicenseReport>({} as LicenseReport);
  const [clrChapters, setCLRChapters] = useState<any[]>([]);
  const [clrExpandAll, setCLRExpandAll] = useState<boolean>(false);

  // Peer Reviews
  const [prAllow, setPRAllow] = useState<boolean>(false);
  const [prProjectID, setPRProjectID] = useState<string>("");
  const [prShow, setPRShow] = useState<boolean>(false);
  const [prReviewsShow, setPRReviewsShow] = useState<boolean>(false);

  const accessLinks = [
    {
      key: "online",
      text: "Read Online",
      href: book.links?.online,
      icon: <IconBook size={16} />,
    },
    {
      key: "pdf",
      text: "Download PDF",
      href: book.links?.pdf,
      icon: <IconFileText size={16} />,
    },
    {
      key: "print",
      text: "Buy Print Copy",
      href: `https://commons.libretexts.org/store/product/${book.bookID}`,
      icon: <IconShoppingCart size={16} />,
    },
    {
      key: "zip",
      text: "Download Pages ZIP",
      href: book.links?.zip,
      icon: <IconFileZip size={16} />,
    },
    {
      key: "files",
      text: "Download Print Files",
      href: book.links?.files,
      icon: <IconDownload size={16} />,
    },
    {
      key: "lms",
      text: "Download LMS File",
      href: book.links?.lms,
      icon: <IconDownload size={16} />,
    },
  ];

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
              text: `${item.license.label} ${item.license.version ? item.license.version : ""
                }`,
            };
          } else {
            processedItem.meta = { text: item.license.label };
          }
          if (item.license?.label) {
            const licenseText = item.license.version
              ? `${item.license.label} ${item.license.version}`
              : item.license.label;
            processedItem.title = `${item.title} (${licenseText})`;
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
   * Load the Files list from the server, prepare it for the UI, then save it to state.
   */
  async function getProjectFiles() {
    try {
      if (!book.projectID) return [];

      const res = await api.getProjectFiles(
        book.projectID,
        currDirectory,
        !(user.isAuthenticated ?? false) // default to public only (true) if can't determine auth
      );
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
    } catch (e) {
      handleGlobalError(e);
    }
    setLoadedData(true);
  }, [
    bookID,
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
    if (localStorage.getItem("commons_show_licensing") === "true") {
      setShowLicensing(true);
    }
  }, [getBook, setShowLicensing]);

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
  function renderLicenseLink(licenseObj: LicenseReportLicense) {
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
    if (prAllow && book.hasPeerReviews) {
      return (
        <Stack direction="vertical" gap="xs">
          <Button
            variant="secondary"
            icon={<IconClipboardList size={16} />}
            fullWidth
            onClick={handleOpenPeerReviewForm}
          >
            Submit a Peer Review
          </Button>
          <Button
            variant="secondary"
            icon={<IconList size={16} />}
            fullWidth
            onClick={() => setPRReviewsShow(true)}
          >
            View Peer Reviews
          </Button>
        </Stack>
      );
    }
    if (prAllow) {
      return (
        <Button
          variant="secondary"
          icon={<IconClipboardList size={16} />}
          fullWidth
          onClick={handleOpenPeerReviewForm}
        >
          Submit a Peer Review
        </Button>
      );
    }
    if (book.hasPeerReviews) {
      return (
        <Button
          variant="secondary"
          icon={<IconList size={16} />}
          fullWidth
          onClick={() => setPRReviewsShow(true)}
        >
          View Peer Reviews
        </Button>
      );
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
                <span>{renderLicenseLink(licItem)}{" "}</span>
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
                  <strong>Applicable Restrictions:{" "}</strong>
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
            <div className="flex items-center justify-between">
              <span>Breakdown</span>
              {clrChapters.length > 0 && (
                <Button
                  variant="tertiary"
                  onClick={() => setCLRExpandAll((prev) => !prev)}
                  size="sm"
                >
                  <Text size="sm" className="text-white">
                    {clrExpandAll ? "Collapse All" : "Expand All"}
                  </Text>
                </Button>
              )}
            </div>
          </Header>
          {clrChapters.length > 0 ? (
            <TreeView
              items={clrChapters}
              asLinks={true}
              hrefKey="url"
              textKey="title"
              expandAll={clrExpandAll}
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
    <>
      {/* Breadcrumb Navigation */}
      <div className="px-6 py-3 border-b border-neutral-200">
        <DavisBreadcrumb aria-label="Page navigation">
          <DavisBreadcrumb.Item href="/catalog">
            Catalog
          </DavisBreadcrumb.Item>
          <DavisBreadcrumb.Item isCurrent>{book.title}</DavisBreadcrumb.Item>
        </DavisBreadcrumb>
      </div>

      {/* Main Content */}
      {!loadedData ? (
        <div className="flex justify-center items-center p-16">
          <Spinner />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_3fr] gap-6 p-6">
          {/* Left Column — Book Meta */}
          <Card padding="sm">
            <Stack direction="vertical" gap="md">
              <img
                src={book.thumbnail}
                aria-hidden={true}
                alt=""
                className="w-full rounded-md"
              />
              <Heading level={1} className="text-center">
                {book.title}
              </Heading>
              <Stack direction="vertical" gap="sm">
                {!isEmptyString(book.library) && (
                  <Stack direction="horizontal" gap="sm" align="center">
                    <Avatar
                      src={getLibGlyphURL(book.library)}
                      alt=""
                      size="xs"
                    />
                    <Text as="p" className="flex items-center gap-1">
                      {getLibraryName(book.library)}
                    </Text>
                  </Stack>
                )}
                {!isEmptyString(book.author) && (
                  <Stack direction="horizontal" gap="sm" align="center">
                    <IconUser size={16} className="inline mr-1 shrink-0" aria-hidden="true" />
                    <Text as="p">
                      {book.author}
                    </Text>
                  </Stack>
                )}
                {!isEmptyString(book.license) && (
                  <Stack direction="horizontal" gap="sm" align="center">
                    <IconShield size={16} className="inline mr-1 shrink-0" aria-hidden="true" />
                    <Text as="p">
                      {getLicenseText(
                        book.license,
                        clrData.meta?.mostRestrictiveLicense?.version
                      )}
                    </Text>
                  </Stack>
                )}
                {!isEmptyString(book.affiliation) && (
                  <Stack direction="horizontal" gap="sm" align="center">
                    <IconBuildingBank size={16} className="inline mr-1 shrink-0" aria-hidden="true" />
                    <Text as="p">
                      {book.affiliation}
                    </Text>
                  </Stack>
                )}
                {!isEmptyString(book.course) && (
                  <Stack direction="horizontal" gap="sm" align="center">
                    <IconSitemap size={16} className="inline mr-1 shrink-0" aria-hidden="true" />
                    <Text as="p">
                      {book.course}
                    </Text>
                  </Stack>
                )}
                {book.isbns && book.isbns.length > 0 && book.isbns.map((isbnObj) => (
                  <Stack direction="horizontal" gap="sm" align="center">
                    <IconBookmark size={16} className="inline mr-1 shrink-0" aria-hidden="true" />

                    <Text as="p" key={isbnObj.isbn}>
                      <strong>ISBN:</strong> {isbnObj.isbn} ({isbnObj.medium}, {isbnObj.format})
                    </Text>
                  </Stack>
                ))}
                {book.doi && (
                  <Stack direction="horizontal" gap="sm" align="center">
                    <IconArchive size={16} className="inline mr-1 shrink-0" aria-hidden="true" />
                    <Text as="p">
                      <strong>DOI:</strong> {book.doi}
                    </Text>
                  </Stack>
                )}
                {book.sourceOriginalPublicationDate && (
                  <Stack direction="horizontal" gap="sm" align="center">
                    <IconCalendar size={16} className="inline mr-1 shrink-0" aria-hidden="true" />
                    <Text as="p">
                      <strong>Original Publication Date:</strong>{" "}
                      {format(parseISO(book.sourceOriginalPublicationDate.toString()), "MM/dd/yyyy")}
                    </Text>
                  </Stack>
                )}
                {book.sourceHarvestDate && (
                  <Stack direction="horizontal" gap="sm" align="center">
                    <IconCalendarPlus size={16} className="inline mr-1 shrink-0" aria-hidden="true" />

                    <Text as="p">
                      <strong>Harvest/Import Date:</strong>{" "}
                      {format(parseISO(book.sourceHarvestDate.toString()), "MM/dd/yyyy")}
                    </Text>
                  </Stack>
                )}
                {book.sourceLastModifiedDate && (
                  <Stack direction="horizontal" gap="sm" align="center">
                    <IconCalendarCheck size={16} className="inline mr-1 shrink-0" aria-hidden="true" />

                    <Text as="p">
                      <strong>Last Modified Date:</strong>{" "}
                      {format(parseISO(book.sourceLastModifiedDate.toString()), "MM/dd/yyyy")}
                    </Text>
                  </Stack>
                )}
                {book.sourceLanguage && (
                  <Stack direction="horizontal" gap="sm" align="center">
                    <IconLanguage size={16} className="inline mr-1 shrink-0" aria-hidden="true" />

                    <Text as="p">
                      <strong>Language:</strong> {getLanguageName(book.sourceLanguage)}
                    </Text>
                  </Stack>
                )}
                {!isEmptyString(book.thumbnail) && (
                  <Stack direction="horizontal" gap="sm" align="center">
                    <IconPhoto size={16} className="inline mr-1 shrink-0" aria-hidden="true" />
                    <DavisLink href={book.thumbnail} external target="_blank" rel="noopener noreferrer">
                      View Thumbnail
                    </DavisLink>
                  </Stack>
                )}
              </Stack>

              {typeof book.rating === "number" && book.rating > 0 && (
                <StarRating value={book.rating} displayMode={true} />
              )}

              <Stack direction="vertical" gap="xs">
                <Button
                  variant="secondary"
                  icon={<IconHandStop size={16} />}
                  fullWidth
                  onClick={handleOpenAdoptionReport}
                >
                  Submit an Adoption Report
                </Button>
                <PeerReviewButtons />
                {user?.isAuthenticated && book.projectID && (
                  <Button
                    as={Link}
                    variant="primary"
                    icon={<IconFileText size={16} />}
                    fullWidth
                    to={`/projects/${book.projectID}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View Conductor Project
                  </Button>
                )}
                {book.hasAdaptCourse && book.adaptCourseID !== "" && (
                  <Button
                    variant="outline"
                    fullWidth
                    as="a"
                    href={`https://adapt.libretexts.org/courses/${book.adaptCourseID}/anonymous`}
                    target="_blank"
                    rel="noreferrer"
                    icon={<img src="/adapt_icon_white.png" aria-hidden="true" alt="" className="h-[1.1em]" />}
                  >
                    View Homework on ADAPT
                  </Button>
                )}
              </Stack>

              <Stack direction="vertical" gap="xs" className="mt-6">
                {accessLinks.map((item) => (
                  <Button
                    key={item.key}
                    variant="outline"
                    icon={item.icon}
                    fullWidth
                    as={DavisLink}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="justify-start"
                    external
                  >
                    {item.text}
                  </Button>
                ))}
              </Stack>
            </Stack>
          </Card>
          {/* Right Column — Book Info */}
          <Stack direction="vertical" gap="md">
            {!isEmptyString(book.summary) && (
              <Card padding="sm">
                <Stack direction="vertical" gap="sm">
                  <Heading level={3}>Summary</Heading>
                  <Text as="p" className={styles.meta_largefont}>
                    {book.summary}
                  </Text>
                </Stack>
              </Card>
            )}

            {/* Assets */}
            {projFiles && (projFiles.length > 0 || currDirectory !== "") && (
              <Card padding="sm">
                <Stack direction="horizontal" gap="sm" align="center" justify="between">
                  <Heading level={3}>Assets</Heading>
                  <Button
                    variant="tertiary"
                    onClick={() => {
                      setFileSearchQuery("");
                      handleChangeFilesVis();
                    }}
                  >
                    {showFiles ? "Hide" : "Show"}
                  </Button>
                </Stack>
                {showFiles && (
                  <>
                    <div className="px-4 py-2 border-b border-neutral-200">
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
                    </div>
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
                                          {
                                            file.access === 'instructors' && user?.isAuthenticated && user?.verifiedInstructor && (
                                              <Popup
                                                content="This asset is restricted to verified instructors. You're good to go!"
                                                trigger={
                                                  <Icon
                                                    name="graduation cap"
                                                    color="blue"
                                                    className="!ml-2 !mt-0.5"
                                                  />
                                                }
                                                position="top center"
                                              />
                                            )
                                          }
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
                                            <SUIButton
                                              icon
                                              size="small"
                                              title="Download asset (opens in new tab)"
                                              onClick={() =>
                                                handleDownloadFile(file.fileID)
                                              }
                                            >
                                              <Icon name="download" />
                                            </SUIButton>
                                          )
                                        }
                                        position="top center"
                                      />
                                      <Popup
                                        content="Open Folder"
                                        trigger={
                                          file.storageType === "folder" && (
                                            <SUIButton
                                              icon
                                              size="small"
                                              title="Open Folder"
                                              onClick={() =>
                                                handleDirectoryClick(file.fileID)
                                              }
                                            >
                                              <Icon name="folder open outline" />
                                            </SUIButton>
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
                  </>
                )}
              </Card>
            )}

            {/* Table of Contents */}
            <Card padding="sm">
              <Stack direction="horizontal" gap="sm" align="center" justify="between">
                <Heading level={3}>Table of Contents</Heading>
              </Stack>
              {bookTOC && bookTOC.length > 0 ? (
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
            </Card>

            {/* Licensing */}
            {foundCLR && (
              <Card padding="sm">
                <Stack direction="horizontal" gap="sm" align="center" justify="between">
                  <Heading level={3}>Licensing Stack</Heading>
                  <Button variant="tertiary" onClick={handleChangeLicensingVis}>
                    {showLicensing ? "Hide" : "Show"}
                  </Button>
                </Stack>
                {showLicensing && <LicensingReport />}
              </Card>
            )}
          </Stack>
        </div>
      )}
      <BookPeerReviewsModal
        open={prReviewsShow}
        onClose={() => setPRReviewsShow(false)}
        bookID={bookID}
        bookTitle={book.title}
      />
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
    </>
  );
};

export default CommonsBook;
