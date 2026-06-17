import { useTypedSelector } from "../../state/hooks";
import { SupportTicket } from "../../types";
import { camelCaseToSpaces } from "../../utils/misc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../api";
import { useNotifications } from "../../context/NotificationContext";
import { Link } from "react-router-dom";
import { Button, Card, Link as DavisLink, Heading, Stack } from "@libretexts/davis-react";
import useClientConfig from "../../hooks/useClientConfig";
import { IconEye, IconPlus } from "@tabler/icons-react";

interface TicketMetadataProps {
  ticket: SupportTicket;
}

const TicketMetadata: React.FC<TicketMetadataProps> = ({ ticket }) => {
  const user = useTypedSelector((state) => state.user);
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();
  const { clientConfig } = useClientConfig();
  const projectID = ticket?.metadata?.projectID as string | undefined;
  const commonsURL =
    clientConfig?.main_commons_url || "https://commons.libretexts.org";

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
            <div className="flex flex-row items-center">
              <span className="font-semibold">{camelCaseToSpaces(key)}:</span>
              &nbsp;
              {key === "orderID" && value ? (
                <DavisLink
                  href={`${commonsURL}/controlpanel/store/orders/${value}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all"
                >
                  {String(value)}
                </DavisLink>
              ) : typeof value === "object" ? null : (
                String(value)
              )}
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
    <Card padding="sm" variant="elevated">
      <Card.Header>
        <Heading level={4} align="center">
          Ticket Metadata
        </Heading>
      </Card.Header>
      <Card.Body className="py-4">
        <Stack gap="xs" align="start">
          <RenderObject obj={ticket.metadata} />
          {(user.isSupport || user.isHarvester) &&
            ticket.queue?.slug === "harvesting" &&
            !projectID && (
              <Button
                className="w-full!"
                variant="primary"
                onClick={() => createProjectMutation.mutate()}
                loading={createProjectMutation.isLoading}
                icon={<IconPlus size={16} />}
              >
                Create Project
              </Button>
            )}
          {projectID && (
            <Button
              className="w-full!"
              variant="outline"
              as={Link}
              to={`/projects/${projectID}`}
              target="_blank"
              rel="noopener noreferrer"
              icon={<IconEye size={16} />}
            >
              View Project
            </Button>
          )}
        </Stack>
      </Card.Body>
    </Card>
  );
};

export default TicketMetadata;
