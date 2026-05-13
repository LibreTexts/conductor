import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useHistory } from "react-router-dom";
import axios from "axios";
import {
  Breadcrumb,
  Button,
  Heading,
  Stack,
  Text,
} from "@libretexts/davis-react";
import { DataTable, ColumnDef } from "@libretexts/davis-react-table";
import { IconCopy, IconEye, IconPlus } from "@tabler/icons-react";
import useGlobalError from "../../../../components/error/ErrorHooks";
import { parseAndFormatDate } from "../../../../utils/misc";
import { OrgEvent } from "../../../../types";
import { initOrgEventDates } from "../../../../utils/orgEventsHelpers";

const DATE_FORMAT_STRING = "MM/dd/yyyy hh:mm aa";

const EventsManager = () => {
  const { handleGlobalError } = useGlobalError();
  const history = useHistory();

  const [orgEvents, setOrgEvents] = useState<OrgEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const getOrgEvents = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all events (no page param) — DataTable handles client-side pagination
      const res = await axios.get("/orgevents?limit=1000");
      if (res.data.err) throw new Error(res.data.errMsg);
      if (!Array.isArray(res.data.orgEvents)) throw new Error("Error parsing server data.");
      setOrgEvents(res.data.orgEvents.map((item: OrgEvent) => initOrgEventDates(item)));
    } catch (e) {
      handleGlobalError(e);
    } finally {
      setLoading(false);
    }
  }, [handleGlobalError]);

  useEffect(() => {
    document.title = "LibreTexts Conductor | Events Manager";
    getOrgEvents();
  }, []);

  const columns = useMemo<ColumnDef<OrgEvent>[]>(() => [
    {
      id: "title",
      header: "Title",
      accessorKey: "title",
      cell: ({ row }) => (
        <Link
          to={`/controlpanel/eventsmanager/edit/${row.original.eventID}`}
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {row.original.title}
        </Link>
      ),
    },
    {
      id: "regOpen",
      header: "Registration Open Date",
      cell: ({ row }) => (
        <span>
          {parseAndFormatDate(row.original.regOpenDate, DATE_FORMAT_STRING)} ({row.original.timeZone?.abbrev})
        </span>
      ),
    },
    {
      id: "regClose",
      header: "Registration Close Date",
      cell: ({ row }) => (
        <span>
          {parseAndFormatDate(row.original.regCloseDate, DATE_FORMAT_STRING)} ({row.original.timeZone?.abbrev})
        </span>
      ),
    },
    {
      id: "startDate",
      header: "Event Start Date",
      cell: ({ row }) => (
        <span>
          {parseAndFormatDate(row.original.startDate, DATE_FORMAT_STRING)} ({row.original.timeZone?.abbrev})
        </span>
      ),
    },
    {
      id: "endDate",
      header: "Event End Date",
      cell: ({ row }) => (
        <span>
          {parseAndFormatDate(row.original.endDate, DATE_FORMAT_STRING)} ({row.original.timeZone?.abbrev})
        </span>
      ),
    },
    {
      id: "action",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="primary"
            icon={<IconEye size={14} />}
            onClick={() => history.push(`/controlpanel/eventsmanager/edit/${row.original.eventID}`)}
          >
            View
          </Button>
          <Button
            variant="secondary"
            icon={<IconCopy size={14} />}
            onClick={() => history.push(`/controlpanel/eventsmanager/create?duplicateID=${row.original.eventID}`)}
          >
            Duplicate
          </Button>
        </div>
      ),
    },
  ], [history]);

  return (
    <div className="bg-white h-full px-8 pt-8">
      <Stack direction="vertical" gap="md" className="mb-4">
        <Heading level={2}>Events Manager</Heading>
        <div className="flex items-center justify-between">
          <Breadcrumb aria-label="Page navigation">
            <Breadcrumb.Item href="/controlpanel">Control Panel</Breadcrumb.Item>
            <Breadcrumb.Item isCurrent>Events Manager</Breadcrumb.Item>
          </Breadcrumb>
          <Button
            variant="primary"
            icon={<IconPlus size={16} />}
            onClick={() => history.push("/controlpanel/eventsmanager/create")}
          >
            New Event
          </Button>
        </div>
      </Stack>

      <div className="border border-gray-200 rounded-lg overflow-x-auto">
        <DataTable
          data={orgEvents}
          columns={columns}
          loading={loading}
          density="compact"
          bordered
          striped
          stickyHeader
          caption="Events list"
          enablePagination
          pageSize={25}
          pageSizeOptions={[10, 25, 50, 100]}
          emptyState={
            <div className="py-8 text-center">
              <Text><em>No events found.</em></Text>
            </div>
          }
          onRowClick={(row) => history.push(`/controlpanel/eventsmanager/edit/${row.eventID}`)}
        />
      </div>
    </div>
  );
};

export default EventsManager;
