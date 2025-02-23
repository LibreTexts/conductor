import { Button, Modal, Table } from "semantic-ui-react";
import { Project } from "../../../types";

interface ViewBulkUpdateHistoryModalProps {
  project: Project;
  onClose: () => void;
}

const ViewBulkUpdateHistoryModal: React.FC<ViewBulkUpdateHistoryModalProps> = ({
  project,
  onClose,
}) => {
  return (
    <Modal open={true} onClose={() => onClose()} size="large">
      <Modal.Header>View Bulk Update History</Modal.Header>
      <Modal.Content scrolling>
        <div className="mb-8">
          <p className="text-lg mb-4">
            Please note some errors may be expected, such as when a page does
            not have sufficient content to generate metadata. This does not
            necessarily indicate a problem with your textbook or the system.
          </p>
          <Table celled className="!mt-1" striped>
            <Table.Header fullWidth>
              <Table.Row key="header">
                <Table.HeaderCell>Job ID</Table.HeaderCell>
                <Table.HeaderCell>Timestamp</Table.HeaderCell>
                <Table.HeaderCell>Type</Table.HeaderCell>
                <Table.HeaderCell>Source</Table.HeaderCell>
                <Table.HeaderCell>Updated Pages w/Meta</Table.HeaderCell>
                <Table.HeaderCell>Failed Pages w/Meta</Table.HeaderCell>
                <Table.HeaderCell>Updated Pages w/Alt Text</Table.HeaderCell>
                <Table.HeaderCell>Failed Pages w/Alt Text</Table.HeaderCell>
                <Table.HeaderCell>Error Messages</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {project.batchUpdateJobs?.map((job, index) => {
                const parsedMetaResults: Record<string, any> = Object.entries(
                  job.metaResults || {}
                ).filter(([_, value]) => value !== 0);
                const metaResultsString: string = parsedMetaResults
                  .map(([key, value]: [string, any]) => {
                    return `${value} pages failed with error: ${key}`;
                  })
                  .join(", ");

                const parsedImageResults: Record<string, any> = Object.entries(
                  job.imageResults || {}
                ).filter(([_, value]) => value !== 0);
                const imageResultsString: string = parsedImageResults
                  .map(([key, value]: [string, any]) => {
                    return `${value} pages with images failed with error: ${key}`;
                  })
                  .join(", ");

                const results = [];
                if (metaResultsString) results.push(metaResultsString);
                if (imageResultsString) results.push(imageResultsString);
                const resultsString = results.join("; ");

                return (
                  <Table.Row key={job.jobID}>
                    <Table.Cell>{job.jobID.slice(0, 8)}</Table.Cell>
                    <Table.Cell>
                      {job.startTimestamp
                        ? new Intl.DateTimeFormat("en-US", {
                            year: "numeric",
                            month: "numeric",
                            day: "numeric",
                            hour: "numeric",
                            minute: "numeric",
                            second: "numeric",
                          }).format(new Date(job.startTimestamp?.toString()))
                        : "N/A"}{" "}
                      -{" "}
                      {job.endTimestamp
                        ? new Intl.DateTimeFormat("en-US", {
                            year: "numeric",
                            month: "numeric",
                            day: "numeric",
                            hour: "numeric",
                            minute: "numeric",
                            second: "numeric",
                          }).format(new Date(job.endTimestamp?.toString()))
                        : "N/A"}
                    </Table.Cell>
                    <Table.Cell>
                      {Array.isArray(job.type) ? job.type.join(", ") : job.type}
                    </Table.Cell>
                    <Table.Cell>{job.dataSource}</Table.Cell>
                    <Table.Cell>{job.successfulMetaPages}</Table.Cell>
                    <Table.Cell>{job.failedMetaPages}</Table.Cell>
                    <Table.Cell>{job.successfulImagePages}</Table.Cell>
                    <Table.Cell>{job.failedImagePages}</Table.Cell>
                    <Table.Cell>{resultsString || "N/A"}</Table.Cell>
                    <Table.Cell>{job.status}</Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        </div>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={() => onClose()}>Close</Button>
      </Modal.Actions>
    </Modal>
  );
};

export default ViewBulkUpdateHistoryModal;
