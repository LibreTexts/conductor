import { IconUserCircle, IconKey } from "@tabler/icons-react";
import Breakpoint from "../util/Breakpoints";
import { User } from "../../types";

interface AuthenticatedStatusMessageProps {
  user: User;
  className?: string;
}

const AuthenticatedStatusMessage: React.FC<AuthenticatedStatusMessageProps> = ({
  user,
  className,
}) => {
  const msgText = user.isAuthenticated
    ? <>You're logged into Conductor as <strong>{user.firstName} {user.lastName}</strong>.</>
    : <>You are not logged in. You must login to Conductor to register for this event.</>;

  const colorClass = user.isAuthenticated
    ? "bg-blue-50 border-blue-200 text-blue-800"
    : "bg-yellow-50 border-yellow-200 text-yellow-800";

  return (
    <div className={`flex items-start gap-3 p-4 border rounded-md ${colorClass} ${className ?? ""}`}>
      <Breakpoint name="desktop">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <IconUserCircle size={24} />
            <IconKey size={12} className="absolute -bottom-1 -right-1" />
          </div>
          <span className="text-sm">{msgText}</span>
        </div>
      </Breakpoint>
      <Breakpoint name="mobileOrTablet">
        <div className="text-center w-full text-sm">
          <div className="flex justify-center mb-2 relative inline-block">
            <IconUserCircle size={24} />
            <IconKey size={12} className="absolute -bottom-1 -right-1" />
          </div>
          <p>{msgText}</p>
        </div>
      </Breakpoint>
    </div>
  );
};

export default AuthenticatedStatusMessage;
