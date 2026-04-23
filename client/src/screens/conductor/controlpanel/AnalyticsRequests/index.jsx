import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import date from "date-and-time";
import { Breadcrumb, Heading, Stack, Text } from "@libretexts/davis-react";
import { DataTable } from "@libretexts/davis-react-table";
import ViewAnalyticsRequest from "../../../../components/analytics/ViewAnalyticsRequest";
import useGlobalError from "../../../../components/error/ErrorHooks";

/**
 * The Analytics Requests interface allows administrators to view Analytics Access Requests
 * submitted via Conductor Analytics.
 */
const AnalyticsRequests = () => {
  // Global error handling
  const { handleGlobalError } = useGlobalError();

  // UI
  const [loading, setLoading] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);

  // Data
  const [analyticsRequests, setAnalyticsRequests] = useState([]);
  const [currentRequest, setCurrentRequest] = useState(null);

  /**
   * Loads Analytics Requests from the server and saves them to state.
   */
  const getAnalyticsRequests = useCallback(async () => {
    try {
      setLoading(true);
      const arRes = await axios.get("/analytics/accessrequests");
      if (!arRes.data.err) {
        setAnalyticsRequests(arRes.data.requests);
      } else {
        throw new Error(arRes.data.errMsg);
      }
    } catch (e) {
      handleGlobalError(e);
    } finally {
      setLoading(false);
    }
  }, [handleGlobalError]);

  /**
   * Set the page title and gather data from server on first load.
   */
  useEffect(() => {
    document.title = "LibreText Conductor | Analytics Requests";
    getAnalyticsRequests();
  }, [getAnalyticsRequests]);

  /**
   * Accepts a standard ISO 8601 Date or date-string and parses the date and time
   * to a UI-ready, human-readable format.
   *
   * @param {Date|string} dateInput - Date to parse and format.
   * @returns {string} The formatted date.
   */
  function parseDateAndTime(dateInput) {
    const dateInstance = new Date(dateInput);
    return date.format(dateInstance, "MM/DD/YYYY h:mm A");
  }

  /**
   * Saves the selected Analytics Request to state and opens the View Analytics Request tool.
   *
   * @param {object} request - Analytics Request data.
   */
  function handleOpenRequestView(request) {
    setCurrentRequest(request);
    setShowViewModal(true);
  }

  /**
   * Closes the View Analytics Request tool.
   */
  function handleViewModalClose() {
    setShowViewModal(false);
    setCurrentRequest(null);
  }

  /**
   * Refreshes the list of Analytics Requests when a child component indicates
   * the server's data may have changed.
   */
  function handleDataChangeNotification() {
    getAnalyticsRequests();
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
              handleOpenRequestView(row.original);
            }}
          >
            {Object.prototype.hasOwnProperty.call(row.original, "createdAt")
              ? parseDateAndTime(row.original.createdAt)
              : <em>Unknown</em>}
          </button>
        ),
      },
      {
        id: "name",
        header: "Name",
        cell: ({ row }) => (
          <span>{row.original.requester?.firstName} {row.original.requester?.lastName}</span>
        ),
      },
      {
        id: "course",
        header: "Course",
        cell: ({ row }) => <span>{row.original.course?.title}</span>,
      },
      {
        id: "libretext",
        header: "LibreText Identifier",
        cell: ({ row }) => (
          row.original.course?.pendingTextbookID ? (
            <a
              href={`https://go.libretexts.org/${row.original.course.pendingTextbookID}`}
              rel="noreferrer"
              target="_blank"
              onClick={(e) => e.stopPropagation()}
            >
              {row.original.course.pendingTextbookID}
            </a>
          ) : (
            <span>Unknown</span>
          )
        ),
      },
    ],
    []
  );

  return (
    <div className="!bg-white !h-full !px-8 !pt-8">
      <Stack direction="vertical" gap="md" className="mb-4">
        <Heading level={2}>Analytics Requests</Heading>
        <Breadcrumb>
          <Breadcrumb.Item href="/controlpanel">Control Panel</Breadcrumb.Item>
          <Breadcrumb.Item isCurrent>Analytics Requests</Breadcrumb.Item>
        </Breadcrumb>
      </Stack>

      <DataTable
        data={analyticsRequests}
        columns={columns}
        loading={loading}
        density="compact"
        bordered
        striped
        stickyHeader
        caption="Analytics access requests"
        emptyState={
          <div className="py-8 text-center">
            <Text>
              <em>No results found.</em>
            </Text>
          </div>
        }
        onRowClick={(row) => handleOpenRequestView(row)}
      />

      <ViewAnalyticsRequest
        show={showViewModal}
        onClose={handleViewModalClose}
        request={currentRequest}
        onDataChange={handleDataChangeNotification}
      />
    </div>
  );
};

export default AnalyticsRequests;
