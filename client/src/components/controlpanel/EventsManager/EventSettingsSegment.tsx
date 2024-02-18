import { UseFormGetValues } from "react-hook-form";
import { Grid, Header, Icon, Segment } from "semantic-ui-react";
import { copyToClipboard, parseAndFormatDate } from "../../../utils/misc";
import { OrgEvent, Organization } from "../../../types";
import { format as formatDate, parseISO } from "date-fns";
import { utcToZonedTime } from "date-fns-tz";
interface EventSettingsSegmentProps {
  getValuesFn: UseFormGetValues<OrgEvent>;
  manageMode: "create" | "edit";
  org: Organization;
  loading: boolean;
  projectSyncID?: string;
  projectSyncTitle?: string
}

const EventSettingsSegment: React.FC<EventSettingsSegmentProps> = ({
  getValuesFn,
  manageMode,
  org,
  loading,
  projectSyncID,
  projectSyncTitle,
  ...rest
}) => {
  const DATE_FORMAT_STRING = "MM/dd/yyyy hh:mm aa";

  return (
    <Segment loading={loading}>
      <Grid divided>
        <Grid.Row columns={2}>
          <Grid.Column>
            <Header as="h4">Event Information</Header>
            <p>
              <Header sub as="span">
                Event Start Date:
              </Header>
              <span>
                {" "}
                {getValuesFn("startDate")
                  ? formatDate(
                      getValuesFn("startDate"),
                      DATE_FORMAT_STRING
                    )
                  : "Unknown"}{" "}
                ({getValuesFn("timeZone.abbrev")})
              </span>
            </p>
            <p>
              <Header sub as="span">
                Event End Date:
              </Header>
              <span>
                {" "}
                {getValuesFn("endDate")
                  ? formatDate(
                      getValuesFn("endDate"),
                      DATE_FORMAT_STRING
                    )
                  : "Unknown"}{" "}
                ({getValuesFn("timeZone.abbrev")})
              </span>
            </p>
            {manageMode === "edit" && (
              <p>
                <Header sub as="span">
                  Registration URL:
                </Header>
                <a
                  href={`${org.domain}/events/${getValuesFn("eventID")}`}
                  target="_blank"
                >
                  {" "}
                  {`${org.domain}/events/${getValuesFn("eventID")}`}
                </a>
                <Icon
                  name="copy"
                  color="blue"
                  className="ml-1p"
                  style={{ cursor: "pointer" }}
                  onClick={async () => {
                    await copyToClipboard(
                      `${org.domain}/events/${getValuesFn("eventID")}`
                    );
                  }}
                />
              </p>
            )}
            {(projectSyncID && projectSyncTitle) && (
              <p>
                <Header sub as="span">
                  Synced Project:
                </Header>
                <a
                  href={`/projects/${projectSyncID}`}
                  target="_blank"
                >
                  {" "}
                  {projectSyncTitle}
                </a>
              </p>
            )}
          </Grid.Column>
          <Grid.Column>
            <Header as="h4">Registration Information</Header>
            <p>
              <Header sub as="span">
                <strong>Registration Open Date:</strong>{" "}
              </Header>
              <span>
                {" "}
                {getValuesFn("regOpenDate")
                  ? formatDate(
                      getValuesFn("regOpenDate"),
                      DATE_FORMAT_STRING
                    )
                  : "Unknown"}{" "}
                ({getValuesFn("timeZone.abbrev")})
              </span>
            </p>
            <p>
              <Header sub as="span">
                <strong>Registration Close Date:</strong>{" "}
              </Header>
              <span>
                {" "}
                {getValuesFn("regCloseDate")
                  ? formatDate(
                      getValuesFn("regCloseDate"),
                      DATE_FORMAT_STRING
                    )
                  : "Unknown"}{" "}
                ({getValuesFn("timeZone.abbrev")})
              </span>
            </p>
            {org.orgID === "libretexts" && (
              <p>
                <Header sub as="span">
                  <strong>Registration Fee:</strong>
                </Header>
                <span> ${getValuesFn("regFee") ?? "0.00"}</span>
              </p>
            )}
            <p>
              <Header sub as="span">
                <strong>Collect Shipping Address:</strong>{" "}
              </Header>
              <span>{getValuesFn("collectShipping") ? "Yes" : "No"}</span>
            </p>
          </Grid.Column>
        </Grid.Row>
      </Grid>
    </Segment>
  );
};

export default EventSettingsSegment;
