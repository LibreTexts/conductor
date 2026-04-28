import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import date from "date-and-time";
import AdoptionReportView from "../../../../components/AdoptionReportView";
import {
  isEmptyString,
  truncateString,
  capitalizeFirstLetter,
} from "../../../../components/util/HelperFunctions";
import {
  getLibGlyphURL,
  getLibraryName,
} from "../../../../components/util/LibraryOptions";
import useGlobalError from "../../../../components/error/ErrorHooks";
import {
  Avatar,
  Breadcrumb,
  Heading,
  Input,
  Select,
  Stack,
  Text,
} from "@libretexts/davis-react";
import { DataTable } from "@libretexts/davis-react-table";

const SORT_OPTIONS = [
  { value: "date", label: "Date" },
  { value: "type", label: "Report Type" },
  { value: "resname", label: "Resource Name" },
  { value: "reslib", label: "Resource Library" },
  { value: "institution", label: "Institution" },
];

function formatDateInputValue(value) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatApiDateParam(value) {
  const [year, month, day] = value.split("-");
  return `${Number(month)}-${Number(day)}-${year}`;
}

/**
 * The Adoption Reports interface allows administrators to view LibreText Adoption Reports
 * submitted to Conductor.
 */
const AdoptionReports = () => {
  const { handleGlobalError } = useGlobalError();

  // Data
  const [adoptionReports, setAdoptionReports] = useState([]);
  const [currentReport, setCurrentReport] = useState(null);

  // UI
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showARVModal, setShowARVModal] = useState(false);
  const [sortChoice, setSortChoice] = useState("date");
  const [loading, setLoading] = useState(false);

  /**
   * Set page title and initialize default date filters.
   */
  useEffect(() => {
    document.title = "LibreTexts Conductor | Adoption Reports";
    const now = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(now.getFullYear() - 1);
    setFromDate(formatDateInputValue(oneYearAgo));
    setToDate(formatDateInputValue(now));
  }, []);

  /**
   * Retrieves Report search results from the server and saves them to state.
   *
   * @param {string} fromDateString - The date to start the search from, in format 'MM-DD-YYYY'.
   * @param {string} toDateString - The date to end the search on, in format 'MM-DD-YYYY'.
   */
  const getAdoptionReports = useCallback(
    async (fromDateString, toDateString) => {
      setLoading(true);
      try {
        const arRes = await axios.get("/adoptionreports", {
          params: {
            startDate: fromDateString,
            endDate: toDateString,
          },
        });

        if (!arRes.data.err) {
          setAdoptionReports(arRes.data.reports);
        } else {
          throw new Error(arRes.data.errMsg);
        }
      } catch (e) {
        handleGlobalError(e);
      } finally {
        setLoading(false);
      }
    },
    [handleGlobalError]
  );

  /**
   * Trigger a new search when either date filter changes.
   */
  useEffect(() => {
    if (fromDate && toDate) {
      getAdoptionReports(formatApiDateParam(fromDate), formatApiDateParam(toDate));
    }
  }, [fromDate, toDate, getAdoptionReports]);

  /**
   * Sort the currently loaded reports according to the active sort control.
   */
  const sortedReports = useMemo(() => {
    switch (sortChoice) {
      case "type":
        return [...adoptionReports].sort((a, b) => a.role.localeCompare(b.role));
      case "institution":
        return [...adoptionReports].sort((a, b) => {
          let aInst = "";
          let bInst = "";

          if (a.role === "instructor") {
            aInst = a.instructor?.institution ?? "";
          } else if (a.role === "student" && !isEmptyString(a.student?.institution)) {
            aInst = a.student.institution;
          }

          if (b.role === "instructor") {
            bInst = b.instructor?.institution ?? "";
          } else if (b.role === "student" && !isEmptyString(b.student?.institution)) {
            bInst = b.student.institution;
          }

          return aInst.localeCompare(bInst);
        });
      case "resname":
        return [...adoptionReports].sort((a, b) => {
          if (a.resource?.title && b.resource?.title) {
            return a.resource.title.localeCompare(b.resource.title);
          }
          return 0;
        });
      case "reslib":
        return [...adoptionReports].sort((a, b) => {
          if (a.resource?.library && b.resource?.library) {
            return a.resource.library.localeCompare(b.resource.library);
          }
          return 0;
        });
      default:
        return [...adoptionReports].sort((a, b) => {
          const aDate = new Date(a.createdAt);
          const bDate = new Date(b.createdAt);
          if (aDate < bDate) return -1;
          if (aDate > bDate) return 1;
          return 0;
        });
    }
  }, [adoptionReports, sortChoice]);

  /**
   * Parses a date string into UI-ready format.
   *
   * @param {string} dateInput - ISO date representation.
   * @returns {string} The parsed and formatted date.
   */
  function parseDateAndTime(dateInput) {
    const dateInstance = new Date(dateInput);
    return date.format(dateInstance, "MM/DD/YYYY h:mm A");
  }

  /**
   * Opens the Adoption Report View modal for the selected report.
   *
   * @param {object} report - The selected report record.
   */
  function handleOpenARV(report) {
    setShowARVModal(true);
    setCurrentReport(report);
  }

  /**
   * Closes the Adoption Report View modal and resets its state.
   */
  function handleCloseARV() {
    setShowARVModal(false);
    setCurrentReport(null);
  }

  const columns = useMemo(
    () => [
      {
        accessorKey: "createdAt",
        header: "Date",
        cell: ({ row }) => (
          <button
            type="button"
            className="button-text-link text-left"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenARV(row.original);
            }}
          >
            {parseDateAndTime(row.original.createdAt)}
          </button>
        ),
      },
      {
        accessorKey: "role",
        header: "Report Type",
        cell: ({ getValue }) => capitalizeFirstLetter(getValue() ?? ""),
      },
      {
        id: "resourceName",
        header: "Resource Name",
        cell: ({ row }) => row.original.resource?.title ?? <em>Unknown</em>,
      },
      {
        id: "resourceLibrary",
        header: "Resource Library",
        cell: ({ row }) => {
          const resourceLib = row.original.resource?.library;

          if (!resourceLib) {
            return <em>Unknown</em>;
          }

          return (
            <div className="flex items-center gap-2">
              <Avatar
                src={getLibGlyphURL(resourceLib)}
                alt=""
                size="xs"
              />
              <span>{getLibraryName(resourceLib)}</span>
            </div>
          );
        },
      },
      {
        id: "institution",
        header: "Institution",
        cell: ({ row }) => {
          let institution = null;

          if (row.original.role === "instructor") {
            institution = row.original.instructor?.institution;
          } else if (row.original.role === "student") {
            institution = row.original.student?.institution;
          }

          return institution || <em>Unknown</em>;
        },
      },
      {
        accessorKey: "comments",
        header: "Comments",
        cell: ({ getValue }) => <em>{truncateString(getValue(), 150)}</em>,
      },
      {
        accessorKey: "name",
        header: "Name",
      },
    ],
    []
  );

  return (
    <div className="!bg-white !h-full !px-8 !pt-8">
      <Stack direction="vertical" gap="md" className="mb-4">
        <Heading level={2}>Adoption Reports</Heading>
        <Breadcrumb aria-label="Page navigation">
          <Breadcrumb.Item href="/controlpanel">Control Panel</Breadcrumb.Item>
          <Breadcrumb.Item isCurrent>Adoption Reports</Breadcrumb.Item>
        </Breadcrumb>
      </Stack>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3 xl:max-w-6xl">
        <Input
          name="adoption-reports-from-date"
          label="From"
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />
        <Input
          name="adoption-reports-to-date"
          label="To"
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />
        <Select
          name="adoption-reports-sort"
          label="Sort by"
          placeholder="Sort reports"
          options={SORT_OPTIONS}
          value={sortChoice}
          onChange={(e) => setSortChoice(e.target.value)}
        />
      </div>

      <DataTable
        data={sortedReports}
        columns={columns}
        loading={loading}
        density="compact"
        bordered
        striped
        stickyHeader
        caption="Adoption reports results"
        emptyState={
          <div className="py-8 text-center">
            <Text>
              <em>No results found.</em>
            </Text>
          </div>
        }
        onRowClick={(row) => handleOpenARV(row)}
      />

      <AdoptionReportView
        show={showARVModal}
        onClose={handleCloseARV}
        report={currentReport}
      />
    </div>
  );
};

export default AdoptionReports;
