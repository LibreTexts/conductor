import { Header, Table, TableProps } from "semantic-ui-react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import type { Project } from "../../types";
import {
  getClassificationText,
  getVisibilityText,
} from "../util/ProjectHelpers";
import { truncateString } from "../util/HelperFunctions";

interface ProjectsTableProps extends TableProps {
  items: Project[];
  loading?: boolean;
}

const ProjectsTable: React.FC<ProjectsTableProps> = ({
  items,
  loading,
  ...rest
}) => {
  return (
    <Table celled title="Project Search Results" {...rest}>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell width={5}>
            <Header sub>Title</Header>
          </Table.HeaderCell>
          <Table.HeaderCell width={4}>
            <Header sub>Author</Header>
          </Table.HeaderCell>
          <Table.HeaderCell width={2}>
            <Header sub>Classification</Header>
          </Table.HeaderCell>
          <Table.HeaderCell width={2}>
            <Header sub>Visibility</Header>
          </Table.HeaderCell>
          <Table.HeaderCell width={2}>
            <Header sub>Lead</Header>
          </Table.HeaderCell>
          <Table.HeaderCell width={2}>
            <Header sub>Last Updated</Header>
          </Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {items.length > 0 &&
          items.map((item, index) => {
            let projectLead = "Unknown";
            if (item.leads && Array.isArray(item.leads)) {
              item.leads.forEach((lead, leadIdx) => {
                if (lead.firstName && lead.lastName) {
                  if (leadIdx > 0)
                    projectLead += `, ${lead.firstName} ${lead.lastName}`;
                  else if (leadIdx === 0)
                    projectLead = `${lead.firstName} ${lead.lastName}`;
                }
              });
            }
            if (!item.hasOwnProperty("peerProgress")) item.peerProgress = 0;
            if (!item.hasOwnProperty("a11yProgress")) item.a11yProgress = 0;
            return (
              <Table.Row key={index}>
                <Table.Cell>
                  <p className="truncate">
                    <strong>
                      <Link to={`/projects/${item.projectID}`}>
                        {truncateString(item.title, 100)}
                      </Link>
                    </strong>
                  </p>
                </Table.Cell>
                <Table.Cell>
                  <p>{truncateString(item.author, 50)}</p>
                </Table.Cell>
                <Table.Cell>
                  {item.classification &&
                  typeof item.classification === "string" ? (
                    <p>{getClassificationText(item.classification)}</p>
                  ) : (
                    <p>
                      <em>Unclassified</em>
                    </p>
                  )}
                </Table.Cell>
                <Table.Cell>
                  {typeof item.visibility === "string" && item.visibility ? (
                    <p>{getVisibilityText(item.visibility)}</p>
                  ) : (
                    <p>
                      <em>Unknown</em>
                    </p>
                  )}
                </Table.Cell>
                <Table.Cell>
                  <p>{truncateString(projectLead, 50)}</p>
                </Table.Cell>
                <Table.Cell>
                  {item.updatedAt && (
                    <p>{format(parseISO(item.updatedAt), "MM/dd/yy")}</p>
                  )}
                </Table.Cell>
              </Table.Row>
            );
          })}
        {loading && (
          <Table.Row>
            <Table.Cell colSpan={6}>
              <p className="text-center">
                <em>Loading...</em>
              </p>
            </Table.Cell>
          </Table.Row>
        )}
        {items.length === 0 && !loading && (
          <Table.Row>
            <Table.Cell colSpan={6}>
              <p className="text-center">
                <em>No results found.</em>
              </p>
            </Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table>
  );
};

export default ProjectsTable;
