import { UseFormGetValues } from "react-hook-form";
import { Grid, Header, Icon, Segment } from "semantic-ui-react";
import { OrgEvent, Organization } from "../../../types";
import { format as formatDate, parseISO, parse as parseDate } from "date-fns";
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
                      parseISO(getValuesFn("startDate").toString()),
                      "MM/dd/yyyy hh:mm aa"
                    )
                  : "Unknown"}
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
                      parseISO(getValuesFn("endDate").toString()),
                      "MM/dd/yyyy hh:mm aa"
                    )
                  : "Unknown"}
                ({getValuesFn("timeZone.abbrev")})
              </span>
            </p>
            {manageMode === "edit" && (
              <p>
                <Header sub as="span">
                  Registration URL:
                </Header>
                <a
                  href={`${org.domain}/events/${org.orgID}/${getValuesFn(
                    "eventID"
                  )}`}
                  target="_blank"
                >
                  {" "}
                  {`${org.domain}/events/${org.orgID}/${getValuesFn(
                    "eventID"
                  )}`}
                </a>
                <Icon
                  name="copy"
                  color="blue"
                  className="ml-1p"
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${org.domain}/events/${org.orgID}/${getValuesFn(
                        "eventID"
                      )}`
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
                  ? formatDate(
                      parseISO(getValuesFn("regOpenDate").toString()),
                      "MM/dd/yyyy hh:mm aa"
                    )
                  : "Unknown"}
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
                      parseISO(getValuesFn("regCloseDate").toString()),
                      "MM/dd/yyyy hh:mm aa"
                    )
                  : "Unknown"}
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
