import { IconCircleCheck, IconX } from "@tabler/icons-react";
import classNames from "classnames";

interface AlertProps {
  message?: string;
  variant?: "success" | "error" | "info";
  withDismiss?: boolean;
  onDismiss?: () => void;
  className?: string;
  large?: boolean;
}

export default function Alert({
  message,
  variant = "info",
  withDismiss = false,
  onDismiss,
  className = "",
  large = false,
}: AlertProps) {
  const getVariantStyles = () => {
    const iconSize = large ? "size-10" : "size-5";
    switch (variant) {
      case "success":
        return {
          background: "bg-green-50",
          text: "text-green-800",
          icon: (
            <IconCircleCheck
              aria-hidden="true"
              className={`${iconSize} text-green-400`}
            />
          ),
        };
      case "error":
        return {
          background: "bg-red-50",
          text: "text-red-800",
          icon: <IconX aria-hidden="true" className={`${iconSize} text-red-400`} />,
        };
      case "info":
      default:
        return {
          background: "bg-blue-50",
          text: "text-blue-800",
          icon: (
            <IconCircleCheck
              aria-hidden="true"
              className={`${iconSize} text-blue-400`}
            />
          ),
        };
    }
  };

  const { background, text, icon } = getVariantStyles();

  return (
    <div className={classNames("rounded-md p-4", background, className)}>
      <div className="flex">
        <div className="shrink-0">{icon}</div>
        <div className="ml-3">
          <p className={classNames(
            "font-medium",
            large ? "text-base" : "text-sm",
            text
          )}>
            {message}
          </p>
        </div>
        {withDismiss && onDismiss && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                type="button"
                className={`inline-flex rounded-md p-1.5 ${text} hover:bg-opacity-50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden`}
                onClick={onDismiss}
              >
                <span className="sr-only">Dismiss</span>
                <IconX aria-hidden="true" className="size-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
