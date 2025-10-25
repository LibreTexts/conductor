import classNames from "classnames";
import * as TablerIcons from "@tabler/icons-react";
import DynamicIcon from "./DynamicIcon";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "tertiary";
  size?: "small" | "medium" | "large";
  icon?: keyof typeof TablerIcons;
  loading?: boolean;
  fluid?: boolean;
  className?: string;
}

const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "medium",
  className,
  children,
  icon,
  fluid = false,
  ...props
}) => {
  const baseClasses =
    "flex items-center justify-center font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:pointer-events-none";
  const variantClasses = {
    primary:
      "rounded-md border border-transparent bg-primary font-medium text-white hover:shadow-sm hover:text-gray-300 text-center",
    secondary:
      "rounded-md border border-primary bg-transparent font-medium text-primary hover:shadow-sm hover:bg-primary hover:text-white text-center",
    tertiary:
      "rounded-md border border-transparent bg-tertiary p-4 font-medium text-white hover:shadow-sm hover:text-gray-300 text-center",
  };
  const sizeClasses = {
    small: "px-3 py-1.5 text-sm",
    medium: "px-6 py-2",
    large: "px-8 py-3 text-lg",
  };

  return (
    <button
      {...props}
      disabled={props.disabled || props.loading}
      className={classNames(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        fluid && "!w-full",
        props.loading && "cursor-wait",
        className
      )}
    >
      {props.loading ? (
        <span className="animate-spin">
          <TablerIcons.IconLoader2 className="h-5 w-5" stroke={2} />
        </span>
      ) : (
        <>
          {icon && (
            <span className={classNames(children ? "mr-2" : "", "flex")}>
              <DynamicIcon icon={icon} />
            </span>
          )}
          {children}
        </>
      )}
    </button>
  );
};

export default Button;
