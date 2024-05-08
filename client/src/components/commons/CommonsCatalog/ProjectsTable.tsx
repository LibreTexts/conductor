import { Header, Image, Table, TableProps } from "semantic-ui-react";
import { Book, Project } from "../../../types";
import { getLibGlyphAltText, getLibGlyphURL } from "../../util/LibraryOptions";
import { Link } from "react-router-dom";
import { truncateString } from "../../util/HelperFunctions";
import {
  getClassificationText,
  getVisibilityText,
} from "../../util/ProjectHelpers";
import { format, parseISO } from "date-fns";

interface ProjectsTableProps extends TableProps {
  items: Project[];
  lastElementRef?: any;
  loading?: boolean;
}

const ProjectsTable: React.FC<ProjectsTableProps> = ({
  items,
  lastElementRef,
  loading,
  ...rest
}) => {
  return (
    <Table celled title="Search Results" {...rest}>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell width={6}>
            <Header sub>Title</Header>
          </Table.HeaderCell>
          <Table.HeaderCell width={4}>
            <Header sub>Author</Header>
          </Table.HeaderCell>
          <Table.HeaderCell width={2}>
            <Header sub>Progress (C/PR/A11Y)</Header>
          </Table.HeaderCell>
          <Table.HeaderCell width={2}>
            <Header sub>Classification</Header>
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
                  <p>
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
                  <div className="flex-row-div projectportal-progress-row">
                    <div className="projectportal-progress-col">
                      <span>{item.currentProgress}%</span>
                    </div>
                    <div className="projectportal-progresssep-col">
                      <span className="projectportal-progresssep">/</span>
                    </div>
                    <div className="projectportal-progress-col">
                      <span>{item.peerProgress}%</span>
                    </div>
                    <div className="projectportal-progresssep-col">
                      <span className="projectportal-progresssep">/</span>
                    </div>
                    <div className="projectportal-progress-col">
                      <span>{item.a11yProgress}%</span>
                    </div>
                  </div>
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
                  {item.updatedAt && (
                    <p>{format(parseISO(item.updatedAt), "MM/dd/yy")}</p>
                  )}
                </Table.Cell>
              </Table.Row>
            );
          })}
        <tr ref={lastElementRef}></tr>
        {loading && (
          <Table.Row>
            <Table.Cell colSpan={5}>
              <p className="text-center">
                <em>Loading...</em>
              </p>
            </Table.Cell>
          </Table.Row>
        )}
        {items.length === 0 && (
          <Table.Row>
            <Table.Cell colSpan={5}>
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
