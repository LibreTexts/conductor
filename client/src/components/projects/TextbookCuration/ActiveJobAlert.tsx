import { Button, Icon, Message } from "semantic-ui-react";
import { ProjectBookBatchUpdateJob } from "../../../types";

interface ActiveJobAlertProps {
  job: ProjectBookBatchUpdateJob;
  onRefresh: () => void;
  loading: boolean;
}

const ActiveJobAlert: React.FC<ActiveJobAlertProps> = ({
  job,
  onRefresh,
  loading,
}) => {
  return (
    <Message icon info>
      <Icon name="info circle" />
      <Message.Content>
        <div className="flex flex-row justify-between">
          <div className="flex flex-col">
            <Message.Header>Bulk Update Job In Progress</Message.Header>
            <p>
              {job.dataSource === "generated"
                ? "AI-generated metadata is "
                : "Metadata updates are "}
              currently being applied. This may take some time to complete.
              Editing is not available while this job is running.
            </p>
          </div>
          <Button onClick={onRefresh} icon color="blue" loading={loading}>
            <Icon name="refresh" />
          </Button>
        </div>
      </Message.Content>
    </Message>
  );
};

export default ActiveJobAlert;
