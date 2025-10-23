import { Button, Icon } from "semantic-ui-react";
import { useTypedSelector } from "../../state/hooks";
import { SupportTicket } from "../../types";
import { camelCaseToSpaces } from "../../utils/misc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../api";
import { useNotifications } from "../../context/NotificationContext";
import { Link } from "react-router-dom";

interface TicketMetadataProps {
  ticket: SupportTicket;
}

const TicketMetadata: React.FC<TicketMetadataProps> = ({ ticket }) => {
  const user = useTypedSelector((state) => state.user);
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();
  const projectID = ticket?.metadata?.projectID as string | undefined;

  const createProjectMutation = useMutation({
    mutationFn: async () => {
      const res = await api.createProjectFromHarvestingRequest(ticket.uuid);
      return res.data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: ["ticket", ticket.uuid],
      });
      addNotification({
        type: "success",
        message: `Project created successfully with ID: ${data.project?.projectID}`,
      });
    },
    onError(error, variables, context) {
      addNotification({
        type: "error",
        message: "An error occurred while creating the project.",
      });
    },
  });

  const RenderObject = ({ obj }: { obj: Record<string, any> }): JSX.Element => {
    return (
      <>
        {Object.entries(obj).map(([key, value]) => (
          <div key={key} className="flex flex-col">
            <div className="flex flex-row">
              <span className="font-semibold">{camelCaseToSpaces(key)}:</span>
              &nbsp;
              {typeof value === "object" ? null : String(value)}
            </div>
            {typeof value === "object" && (
              <div className="ml-4">
                <RenderObject obj={value} />
              </div>
            )}
          </div>
        ))}
      </>
    );
  };

  if (!ticket.metadata || Object.keys(ticket.metadata).length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col border rounded-md p-4 shadow-md bg-white h-fit space-y-2">
      <div className="relative flex items-center justify-center mb-2">
        <p className="text-2xl font-semibold text-center mb-0">
          Ticket Metadata
        </p>
      </div>
      <div className="flex flex-col space-y-1">
        <RenderObject obj={ticket.metadata} />
      </div>
      {(user.isSupport || user.isHarvester) &&
        ticket.queue?.slug === "harvesting" &&
        !projectID && (
          <Button
            color="green"
            onClick={() => createProjectMutation.mutate()}
            loading={createProjectMutation.isLoading}
          >
            <Icon name="plus" />
            Create Project
          </Button>
        )}
      {projectID && (
        <Button
          color="blue"
          as={Link}
          to={`/projects/${projectID}`}
          target="_blank"
        >
          <Icon name="eye" />
          View Project
        </Button>
      )}
    </div>
  );
};

export default TicketMetadata;
