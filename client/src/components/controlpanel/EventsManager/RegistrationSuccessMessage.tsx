import { IconCheck } from "@tabler/icons-react";
import Breakpoint from "../../util/Breakpoints";

const RegistrationSuccessMessage: React.FC<{ paid?: boolean; className?: string }> = ({
  paid,
  className,
}) => {
  return (
    <div className={`flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-md text-green-800 ${className ?? ""}`}>
      <Breakpoint name="desktop">
        <div className="flex items-start gap-3">
          <IconCheck size={24} className="shrink-0 mt-0.5" />
          <div className="text-sm">
            <p>
              Success! Your registration has been confirmed. We will be sending a
              confirmation email shortly to the email address associated with your
              Conductor account.
            </p>
            {paid && <p className="mt-1">You should also be receiving a receipt of your payment soon.</p>}
          </div>
        </div>
      </Breakpoint>
      <Breakpoint name="mobileOrTablet">
        <div className="text-center w-full text-sm">
          <div className="flex justify-center mb-2">
            <IconCheck size={24} />
          </div>
          <p>
            Success! Your registration has been confirmed. We will be sending a
            confirmation email shortly to the email address associated with your
            Conductor account.
          </p>
          {paid && <p className="mt-1">You should also be receiving a receipt of your payment soon.</p>}
        </div>
      </Breakpoint>
    </div>
  );
};

export default RegistrationSuccessMessage;
