import { IconClock, IconX } from "@tabler/icons-react";
import { isBefore, isAfter, format as formatDate, parseISO } from "date-fns";
import Breakpoint from "../../util/Breakpoints";
import { TimeZoneOption } from "../../../types";

interface RegistrationOpenStatusMessageProps {
  regOpenDate?: Date;
  regCloseDate?: Date;
  timeZone?: TimeZoneOption;
  className?: string;
}

const RegistrationOpenStatusMessage: React.FC<RegistrationOpenStatusMessageProps> = ({
  regOpenDate,
  regCloseDate,
  timeZone,
  className,
}) => {
  const getRegStatus = (): "notOpen" | "closed" => {
    if (!regOpenDate || !regCloseDate || !timeZone) return "notOpen";
    if (isBefore(new Date(), parseISO(regOpenDate.toString()))) return "notOpen";
    if (isAfter(new Date(), parseISO(regCloseDate.toString()))) return "closed";
    return "notOpen";
  };

  const getNotOpenText = () => {
    if (!regOpenDate || !timeZone || !timeZone.abbrev) {
      return "Sorry, registration for this event is not open yet. Please check back later.";
    }
    return `Registration for this event opens on ${formatDate(parseISO(regOpenDate.toString()), "MM/dd/yyyy")} ${formatDate(parseISO(regOpenDate.toString()), "hh:mm aa")} (${timeZone.abbrev}). Please return to this screen at that time to register.`;
  };

  const getClosedText = () => {
    if (!regCloseDate || !timeZone || !timeZone.abbrev) {
      return "Sorry, registration for this event has already closed.";
    }
    return `Sorry, registration for this event closed on ${formatDate(parseISO(regCloseDate.toString()), "MM/dd/yyyy")} at ${formatDate(parseISO(regCloseDate.toString()), "hh:mm aa")} (${timeZone.abbrev})`;
  };

  const status = getRegStatus();

  return (
    <div className={`flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-md text-red-800 ${className ?? ""}`}>
      <Breakpoint name="desktop">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0 mt-0.5">
            <IconClock size={24} />
            <IconX size={10} className="absolute -bottom-0.5 -right-0.5" />
          </div>
          <span className="text-sm">
            {status === "notOpen" && regOpenDate && getNotOpenText()}
            {status === "closed" && regCloseDate && getClosedText()}
          </span>
        </div>
      </Breakpoint>
      <Breakpoint name="mobileOrTablet">
        <div className="text-center w-full">
          <div className="flex justify-center mb-2 relative inline-block">
            <IconClock size={24} />
            <IconX size={10} className="absolute -bottom-0.5 -right-0.5" />
          </div>
          {status === "notOpen" && regOpenDate && <p className="text-sm">{getNotOpenText()}</p>}
          {status === "closed" && regCloseDate && <p className="text-sm">{getClosedText()}</p>}
        </div>
      </Breakpoint>
    </div>
  );
};

export default RegistrationOpenStatusMessage;
