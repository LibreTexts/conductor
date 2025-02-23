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
          <Table celled className="!mt-1">
            <Table.Header fullWidth>
              <Table.Row key="header">
                <Table.HeaderCell>Job ID</Table.HeaderCell>
                <Table.HeaderCell>Timestamp</Table.HeaderCell>
                <Table.HeaderCell>Type</Table.HeaderCell>
                <Table.HeaderCell>Source</Table.HeaderCell>
                <Table.HeaderCell>Processed Pages</Table.HeaderCell>
                <Table.HeaderCell>Failed Pages</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {project.batchUpdateJobs?.map((job, index) => (
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
                  <Table.Cell>{job.type}</Table.Cell>
                  <Table.Cell>{job.dataSource}</Table.Cell>
                  <Table.Cell>{job.processedPages}</Table.Cell>
                  <Table.Cell>{job.failedPages}</Table.Cell>
                  <Table.Cell>{job.status}</Table.Cell>
                </Table.Row>
              ))}
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
