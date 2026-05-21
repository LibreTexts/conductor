import { UseFormGetValues } from "react-hook-form";
import { Spinner } from "@libretexts/davis-react";
import { IconCopy } from "@tabler/icons-react";
import { copyToClipboard } from "../../../utils/misc";
import { OrgEvent, Organization } from "../../../types";
import { format as formatDate } from "date-fns";

interface EventSettingsSegmentProps {
  getValuesFn: UseFormGetValues<OrgEvent>;
  manageMode: "create" | "edit";
  org: Organization;
  loading: boolean;
  projectSyncID?: string;
  projectSyncTitle?: string;
}

const DATE_FORMAT_STRING = "MM/dd/yyyy hh:mm aa";

const EventSettingsSegment: React.FC<EventSettingsSegmentProps> = ({
  getValuesFn,
  manageMode,
  org,
  loading,
  projectSyncID,
  projectSyncTitle,
}) => {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-md p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 divide-y md:divide-y-0 md:divide-x divide-gray-200">
        <div>
          <p className="font-semibold text-sm text-gray-700 mb-3">Event Information</p>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="font-semibold uppercase text-xs text-gray-500 tracking-wide w-40 shrink-0">Event Start Date:</dt>
              <dd>{getValuesFn("startDate") ? formatDate(getValuesFn("startDate"), DATE_FORMAT_STRING) : "Unknown"} ({getValuesFn("timeZone.abbrev")})</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-semibold uppercase text-xs text-gray-500 tracking-wide w-40 shrink-0">Event End Date:</dt>
              <dd>{getValuesFn("endDate") ? formatDate(getValuesFn("endDate"), DATE_FORMAT_STRING) : "Unknown"} ({getValuesFn("timeZone.abbrev")})</dd>
            </div>
            {manageMode === "edit" && (
              <div className="flex gap-2 items-center">
                <dt className="font-semibold uppercase text-xs text-gray-500 tracking-wide w-40 shrink-0">Registration URL:</dt>
                <dd className="flex items-center gap-1">
                  <a
                    href={`${org.domain}/events/${getValuesFn("eventID")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline truncate max-w-48"
                  >
                    {`${org.domain}/events/${getValuesFn("eventID")}`}
                  </a>
                  <button
                    type="button"
                    className="text-primary hover:text-primary/80 cursor-pointer"
                    onClick={() => copyToClipboard(`${org.domain}/events/${getValuesFn("eventID")}`)}
                    title="Copy URL"
                  >
                    <IconCopy size={14} />
                  </button>
                </dd>
              </div>
            )}
            {projectSyncID && projectSyncTitle && (
              <div className="flex gap-2">
                <dt className="font-semibold uppercase text-xs text-gray-500 tracking-wide w-40 shrink-0">Synced Project:</dt>
                <dd>
                  <a href={`/projects/${projectSyncID}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {projectSyncTitle}
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </div>
        <div className="pt-4 md:pt-0 md:pl-6">
          <p className="font-semibold text-sm text-gray-700 mb-3">Registration Information</p>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="font-semibold uppercase text-xs text-gray-500 tracking-wide w-44 shrink-0">Registration Open Date:</dt>
              <dd>{getValuesFn("regOpenDate") ? formatDate(getValuesFn("regOpenDate"), DATE_FORMAT_STRING) : "Unknown"} ({getValuesFn("timeZone.abbrev")})</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-semibold uppercase text-xs text-gray-500 tracking-wide w-44 shrink-0">Registration Close Date:</dt>
              <dd>{getValuesFn("regCloseDate") ? formatDate(getValuesFn("regCloseDate"), DATE_FORMAT_STRING) : "Unknown"} ({getValuesFn("timeZone.abbrev")})</dd>
            </div>
            {org.orgID === "libretexts" && (
              <div className="flex gap-2">
                <dt className="font-semibold uppercase text-xs text-gray-500 tracking-wide w-44 shrink-0">Registration Fee:</dt>
                <dd>${getValuesFn("regFee") ?? "0.00"}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="font-semibold uppercase text-xs text-gray-500 tracking-wide w-44 shrink-0">Collect Shipping Address:</dt>
              <dd>{getValuesFn("collectShipping") ? "Yes" : "No"}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
};

export default EventSettingsSegment;
