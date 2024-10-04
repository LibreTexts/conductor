import { Link } from "react-router-dom-v5-compat";
import { Header, Table, TableProps } from "semantic-ui-react";
import { truncateString } from "../util/HelperFunctions";
import { Project } from "../../types";
import {
  getClassificationText,
  getVisibilityText,
} from "../util/ProjectHelpers";
import { format, parseISO } from "date-fns";

interface MyProjectsTableProps extends TableProps {
  data: Project[];
}

const MyProjectsTable: React.FC<MyProjectsTableProps> = ({ data, ...rest }) => {
  return (
    <Table celled {...rest}>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell width={6}>
            <Header sub>Title</Header>
          </Table.HeaderCell>
          <Table.HeaderCell width={2}>
            <Header sub>Progress (C/PR/A11Y)</Header>
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
        {data.length > 0 &&
          data.map((item, index) => {
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
                      <Link to={`/projects/${item.projectID}?reviewer=true`}>
                        {truncateString(item.title, 100)}
                      </Link>
                    </strong>
                  </p>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex-row-div projectprotal-progress-row">
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
                  {item.classification ? (
                    <p>{getClassificationText(item.classification)}</p>
                  ) : (
                    <p>
                      <em>Unclassified</em>
                    </p>
                  )}
                </Table.Cell>
                <Table.Cell>
                  {item.visibility ? (
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
                  <p>
                    {format(parseISO(item.updatedAt || ""), "MM/dd/yyyy")} at{" "}
                    {format(parseISO(item.updatedAt || ""), "hh:mm a")}
                  </p>
                </Table.Cell>
              </Table.Row>
            );
          })}
        {data.length === 0 && (
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

export default MyProjectsTable;
