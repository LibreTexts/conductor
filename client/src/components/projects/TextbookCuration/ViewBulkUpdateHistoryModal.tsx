import { Button, Modal } from "@libretexts/davis-react";
import useProjectBatchUpdateJobs from "../../../hooks/useProjectBatchUpdateJobs";

interface ViewBulkUpdateHistoryModalProps {
  projectID: string;
  onClose: () => void;
}

const ViewBulkUpdateHistoryModal: React.FC<ViewBulkUpdateHistoryModalProps> = ({
  projectID,
  onClose,
}) => {
  const { batchUpdateJobs } = useProjectBatchUpdateJobs(projectID);
  return (
    <Modal open={true} onClose={(v) => !v && onClose()} size="lg">
      <Modal.Header>
        <Modal.Title>View Bulk Update History</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-8">
          <p className="text-lg mb-4">
            Please note some errors may be expected, such as when a page does
            not have sufficient content to generate metadata. This does not
            necessarily indicate a problem with your textbook or the system.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border border-gray-200 rounded text-sm mt-1">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-3 py-2 font-semibold">Job ID</th>
                  <th className="text-left px-3 py-2 font-semibold">Timestamp</th>
                  <th className="text-left px-3 py-2 font-semibold">Type</th>
                  <th className="text-left px-3 py-2 font-semibold">Source</th>
                  <th className="text-left px-3 py-2 font-semibold">Updated Pages w/Meta</th>
                  <th className="text-left px-3 py-2 font-semibold">Failed Pages w/Meta</th>
                  <th className="text-left px-3 py-2 font-semibold">Updated Pages w/Alt Text</th>
                  <th className="text-left px-3 py-2 font-semibold">Failed Pages w/Alt Text</th>
                  <th className="text-left px-3 py-2 font-semibold">Error Messages</th>
                  <th className="text-left px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {batchUpdateJobs?.map((job) => {
                  const parsedMetaResults = Object.entries(job.metaResults || {}).filter(
                    ([_, value]) => value !== 0
                  );
                  const metaResultsString = parsedMetaResults
                    .map(([key, value]) => `${value} pages failed with error: ${key}`)
                    .join(", ");

                  const parsedImageResults = Object.entries(job.imageResults || {}).filter(
                    ([_, value]) => value !== 0
                  );
                  const imageResultsString = parsedImageResults
                    .map(([key, value]) => `${value} pages with images failed with error: ${key}`)
                    .join(", ");

                  const results = [];
                  if (metaResultsString) results.push(metaResultsString);
                  if (imageResultsString) results.push(imageResultsString);
                  const resultsString = results.join("; ");

                  const fmt = new Intl.DateTimeFormat("en-US", {
                    year: "numeric",
                    month: "numeric",
                    day: "numeric",
                    hour: "numeric",
                    minute: "numeric",
                    second: "numeric",
                  });

                  return (
                    <tr key={job.jobID} className="border-b border-gray-200 last:border-0 even:bg-gray-50">
                      <td className="px-3 py-2">{job.jobID.slice(0, 8)}</td>
                      <td className="px-3 py-2">
                        {job.startTimestamp ? fmt.format(new Date(job.startTimestamp.toString())) : "N/A"}
                        {" - "}
                        {job.endTimestamp ? fmt.format(new Date(job.endTimestamp.toString())) : "N/A"}
                      </td>
                      <td className="px-3 py-2">
                        {Array.isArray(job.type) ? job.type.join(", ") : job.type}
                      </td>
                      <td className="px-3 py-2">{job.dataSource}</td>
                      <td className="px-3 py-2">{job.successfulMetaPages}</td>
                      <td className="px-3 py-2">{job.failedMetaPages}</td>
                      <td className="px-3 py-2">{job.successfulImagePages}</td>
                      <td className="px-3 py-2">{job.failedImagePages}</td>
                      <td className="px-3 py-2">{resultsString || "N/A"}</td>
                      <td className="px-3 py-2">{job.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onClose}>Close</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ViewBulkUpdateHistoryModal;
