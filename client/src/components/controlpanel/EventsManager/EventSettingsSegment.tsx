import { UseFormGetValues } from "react-hook-form";
import { Grid, Header, Icon, Segment } from "semantic-ui-react";
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
                {/* {formatDate(
                        parseISO(getValues("startDate").toISOString()),
                        "MM/dd/yyyy hh:mm aa"
                      )}{" "}
                      ({getValues("timeZone.abbrev")}) */}
              </span>
            </p>
            <p>
              <Header sub as="span">
                Event End Date:
              </Header>
              <span>
                {" "}
                {getValuesFn("endDate").toString()}
                {/* {formatDate(
                                  parseISO(getValues("endDate").toISOString()),
                                  "MM/dd/yyyy"
                                )} */}
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
                {/* {formatDate(
                        parseISO(getValues("regOpenDate").toISOString()),
                        "MM/dd/yyyy hh:mm aa"
                      )}{" "}
                      ({getValues("timeZone.abbrev")}) */}
              </span>
            </p>
            <p>
              <Header sub as="span">
                <strong>Registration Close Date:</strong>{" "}
              </Header>
              <span>
                {" "}
                {/* {formatDate(
                        parseISO(getValues("regCloseDate").toISOString()),
                        "MM/dd/yyyy hh:mm aa"
                      )}{" "}
                      (getValues("timeZone.abbrev")}) */}
              </span>
            </p>
            {org.orgID === "libretexts" && (
              <p>
                <Header sub as="span">
                  <strong>Registration Fee:</strong>
                </Header>
                <span> ${getValuesFn("regFee")}</span>
              </p>
            )}
          </Grid.Column>
        </Grid.Row>
      </Grid>
    </Segment>
  );
};

export default EventSettingsSegment;
