import { useEffect, useRef, useState, useCallback, ReactElement } from "react";
import { Link, useParams, useLocation, useHistory } from "react-router-dom";
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
  IconButton,
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
  IconFolder,
  IconFileDescription,
  IconFolderOpen,
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
import PausableImage from "../../../components/util/PausableImage";
import AssetsSection from "../../../components/commons/Book/AssetsSection";
import { useDocumentTitle } from "usehooks-ts";
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
  const history = useHistory();

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
  useDocumentTitle(book.title ? `LibreCommons | ${book.title}` : "LibreCommons");
  const [showAdoptionReport, setShowAdoptionReport] = useState<boolean>(false);
  const [loadedData, setLoadedData] = useState<boolean>(false);
  const [loadedLicensing, setLoadedLicensing] = useState<boolean>(false);
  const [showFiles, setShowFiles] = useState<boolean>(true); // show files by default
  const [showLicensing, setShowLicensing] = useState<boolean>(false);

  // TOC
  const { data: bookTOC, isLoading: loadingTOC } = useQuery<TableOfContents[]>({
    queryKey: ["book-toc", bookID],
    queryFn: async () => {
      const res = await api.getBookTOC(bookID);
      return res.data?.toc?.children // skip first level
    },
    enabled: !!bookID,
    retry: 2
  })

  // Licensing Report
  const [foundCLR, setFoundCLR] = useState(false);
  const [pieChartData, setPieChartData] = useState<CustomPieChartData[]>([]);
  const [clrData, setCLRData] = useState<LicenseReport>({} as LicenseReport);
  const [clrChapters, setCLRChapters] = useState<any[]>([]);
  const [clrExpandAll, setCLRExpandAll] = useState<boolean>(false);
  // Focus management for the licensing Expand All / Collapse All toggle
  // (SC 2.4.3): on expand move focus into the revealed breakdown tree; on
  // collapse return focus to the toggle button.
  const clrExpandAllBtnRef = useRef<HTMLButtonElement>(null);
  const clrTreeRef = useRef<HTMLDivElement>(null);
  const clrExpandDidMount = useRef(false);

  useEffect(() => {
    if (!clrExpandDidMount.current) {
      clrExpandDidMount.current = true;
      return;
    }
    if (clrExpandAll) {
      clrTreeRef.current?.focus();
    } else {
      clrExpandAllBtnRef.current?.focus();
    }
  }, [clrExpandAll]);

  // Peer Reviews
  const [prAllow, setPRAllow] = useState<boolean>(false);
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
      href: `https://downloads.libretexts.org/api/v1/download/${book.bookID}/pdf`,
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
      href: `https://downloads.libretexts.org/api/v1/download/${book.bookID}/pages`,
      icon: <IconFileZip size={16} />,
    },
    {
      key: "files",
      text: "Download Print Files",
      href: `https://downloads.libretexts.org/api/v1/download/${book.bookID}/publication`,
      icon: <IconDownload size={16} />,
    },
    {
      key: "lms",
      text: "Download LMS File (Thin CC)",
      href: `https://downloads.libretexts.org/api/v1/download/${book.bookID}/thincc`,
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
      }
    } catch (e) {
      handleGlobalError(e);
    }
    setLoadedData(true);
  }, [
    bookID,
    setBook,
    setPRAllow,
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
      history.push(`/book/${bookID}/submit-peer-review`);
    }
    if (searchParams.get("files") === "show") {
      setShowFiles(true);
    }
  }, [location, prAllow, history, bookID, setShowAdoptionReport, setShowFiles]);

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

  function handleOpenAdoptionReport() {
    window.scrollTo(0, 0);
    setShowAdoptionReport(true);
  }

  function handleOpenPeerReviews() {
    window.scrollTo(0, 0);
    setPRReviewsShow(true);
  }

  /**
   * Navigates to the peer review submission page.
   */
  function handleOpenPeerReviewForm() {
    history.push(`/book/${bookID}/submit-peer-review`);
  }

  const handleChangeFilesVis = () => {
    setShowFiles(!showFiles);
    localStorage.setItem("commons_show_files", JSON.stringify(!showFiles));
  };

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
          <DavisLink href={licenseObj.link} external underline="always">
            {licenseObj.label} {licenseObj.version}
          </DavisLink>
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
            onClick={handleOpenPeerReviews}
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
          onClick={handleOpenPeerReviews}
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
      // Ordered list — the ACR requires the "All licenses" breakdown to be a
      // programmatic ordered list (SC 1.3.1). list-none keeps the visual style.
      <ol className="list-none">
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
                    aria-hidden="true"
                  />
                </span>
              </div>
            </li>
          );
        })}
      </ol>
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
          <Header as="h3" className="mt-2p" dividing>
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
          <Header as="h3" className="mt-2p" dividing>
            <div className="flex items-center justify-between">
              <span>Breakdown</span>
              {clrChapters.length > 0 && (
                <Button
                  ref={clrExpandAllBtnRef}
                  variant="tertiary"
                  onClick={() => setCLRExpandAll((prev) => !prev)}
                  size="sm"
                  aria-expanded={clrExpandAll}
                  aria-controls="clr-breakdown-tree"
                >
                  <Text size="sm" className="text-white">
                    {clrExpandAll ? "Collapse All" : "Expand All"}
                  </Text>
                </Button>
              )}
            </div>
          </Header>
          {clrChapters.length > 0 ? (
            <div
              ref={clrTreeRef}
              id="clr-breakdown-tree"
              tabIndex={-1}
              className="scroll-mt-20 focus:outline-none"
            >
              <TreeView
                items={clrChapters}
                asLinks={true}
                hrefKey="url"
                textKey="title"
                expandAll={clrExpandAll}
              />
            </div>
          ) : (
            <Text>
              Licensing breakdown unavailable.
            </Text>
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
              <PausableImage
                src={book.thumbnail}
                alt="" // Thumbnails are purely decorative
                className="w-full rounded-md"
                isAnimated={book.thumbnailIsAnimated}
              />
              <Heading level={1} className="text-center break-words">
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
                    <DavisLink href={book.thumbnail} external target="_blank" rel="noopener noreferrer nofollow">
                      Thumbnail Source
                    </DavisLink>
                  </Stack>
                )}
              </Stack>

              {typeof book.rating === "number" && book.rating > 0 && (
                <div className="overflow-x-auto">
                  <StarRating value={book.rating} displayMode={true} />
                </div>
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

              {/* Access links rendered as a programmatic unordered list (SC 1.3.1) */}
              <ul className="mt-6 flex list-none flex-col gap-2">
                {accessLinks.map((item) => (
                  <li key={item.key}>
                    <Button
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
                  </li>
                ))}
              </ul>
            </Stack>
          </Card>
          {/* Right Column — Book Info */}
          <Stack direction="vertical" gap="md">
            {!isEmptyString(book.summary) && (
              <Card padding="sm">
                <Stack direction="vertical" gap="sm">
                  <Heading level={2}>Summary</Heading>
                  <Text as="p">
                    {book.summary}
                  </Text>
                </Stack>
              </Card>
            )}

            {/* Assets */}
            <AssetsSection
              book={book}
              showFiles={showFiles}
              handleChangeFilesVis={handleChangeFilesVis}
            />

            {/* Table of Contents */}
            <Card padding="sm">
              <Stack direction="horizontal" gap="sm" align="center" justify="between">
                <Heading level={2}>Table of Contents</Heading>
              </Stack>
              {bookTOC && bookTOC.length > 0 ? (
                <TreeView
                  items={bookTOC}
                  asLinks={true}
                  hrefKey="url"
                  textKey="title"
                />
              ) : (
                <Text as="p" italic>
                  Table of contents unavailable.
                </Text>
              )}
            </Card>

            {/* Licensing */}
            {foundCLR && (
              <Card padding="sm">
                <Stack direction="horizontal" gap="sm" align="center" justify="between">
                  <Heading level={2}>Licensing Stack</Heading>
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
    </>
  );
};

export default CommonsBook;
