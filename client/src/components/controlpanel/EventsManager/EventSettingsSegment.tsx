import { UseFormGetValues } from "react-hook-form";
import { Grid, Header, Icon, Segment } from "semantic-ui-react";
import { parseAndFormatDate } from "../../../utils/misc";
import { OrgEvent, Organization } from "../../../types";
interface EventSettingsSegmentProps {
  getValuesFn: UseFormGetValues<OrgEvent>;
  manageMode: "create" | "edit";
  org: Organization;
  loading: boolean;
}

const EventSettingsSegment: React.FC<EventSettingsSegmentProps> = ({
  getValuesFn,
  manageMode,
  org,
  loading,
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
                  ? parseAndFormatDate(getValuesFn("startDate"), DATE_FORMAT_STRING)
                  : "Unknown"}
                {" "}
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
                  ? parseAndFormatDate(getValuesFn("endDate"), DATE_FORMAT_STRING)
                  : "Unknown"}
                {" "}
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
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${org.domain}/events/${getValuesFn("eventID")}`
                    );
                    alert("Copied registration form URL to clipboard");
                  }}
                />
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
                  ? parseAndFormatDate(getValuesFn("regOpenDate"), DATE_FORMAT_STRING)
                  : "Unknown"}
                {" "}
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
                  ? parseAndFormatDate(getValuesFn("regCloseDate"), DATE_FORMAT_STRING)
                  : "Unknown"}
                {" "}
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
          </Grid.Column>
        </Grid.Row>
      </Grid>
    </Segment>
  );
};

export default EventSettingsSegment;
