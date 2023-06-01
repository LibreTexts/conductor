import { Message, Icon, MessageProps } from "semantic-ui-react";
import { isBefore, isAfter, format as formatDate, parseISO } from "date-fns";
import Breakpoint from "../../util/Breakpoints";
import { TimeZoneOption } from "../../../types";

interface RegistrationOpenStatusMessageProps extends MessageProps {
  regOpenDate?: Date;
  regCloseDate?: Date;
  timeZone?: TimeZoneOption;
}

const RegistrationOpenStatusMessage: React.FC<
  RegistrationOpenStatusMessageProps
> = ({ regOpenDate, regCloseDate, timeZone, ...rest }) => {
  const getRegStatus = (): "notOpen" | "closed" => {
    if (!regOpenDate || !regCloseDate || !timeZone) return "notOpen";
    if (isBefore(new Date(), parseISO(regOpenDate.toString()))) {
      return "notOpen";
    }
    if (isAfter(new Date(), parseISO(regCloseDate.toString()))) {
      return "closed";
    }

    return "notOpen";
  };

  //The registration open date is in the future
  const getNotOpenText = () => {
    if (!regOpenDate || !timeZone || !timeZone.abbrev) {
      return "Sorry, registration for this event is not open yet. Please check back later."; //fallback to basic message if we don't have the data we need
    }

    return `Registration for this event opens on 
    ${formatDate(parseISO(regOpenDate.toString()), "MM/dd/yyyy")}
    ${formatDate(parseISO(regOpenDate.toString()), "hh:mm aa")} (${
      timeZone.abbrev
    }). Please
    return to this screen at that time to register.`;
  };

  //The registration close date is in the past
  const getClosedText = () => {
    if (!regCloseDate || !timeZone || !timeZone.abbrev) {
      return "Sorry, registration for this event has already closed."; //fallback to basic message if we don't have the data we need
    }

    return `Sorry, registration for this event closed on
    ${formatDate(parseISO(regCloseDate.toString()), "MM/dd/yyyy")} at
    ${formatDate(parseISO(regCloseDate.toString()), "hh:mm aa")} (${
      timeZone.abbrev
    })`;
  };

  return (
    <Message error {...rest}>
      <Message.Content>
        <Breakpoint name="desktop">
          <Icon.Group size="big">
            <Icon name="clock" />
            <Icon corner name="close" />
          </Icon.Group>
          {getRegStatus() === "notOpen" && regOpenDate && (
            <span className="ml-1p">{getNotOpenText()}</span>
          )}
          {getRegStatus() === "closed" && regCloseDate && (
            <span className="ml-1p">{getClosedText()}</span>
          )}
        </Breakpoint>
        <Breakpoint name="mobileOrTablet">
          <div className="text-center">
            <div>
              <Icon.Group size="big">
                <Icon name="clock" />
                <Icon corner name="close" />
              </Icon.Group>
            </div>
            {getRegStatus() === "notOpen" && regOpenDate && (
              <p>{getNotOpenText()}</p>
            )}
            {getRegStatus() === "closed" && regCloseDate && (
              <p>{getClosedText()}</p>
            )}
          </div>
        </Breakpoint>
      </Message.Content>
    </Message>
  );
};

export default RegistrationOpenStatusMessage;
