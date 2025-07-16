import classNames from "classnames";
import * as TablerIcons from "@tabler/icons-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "tertiary";
  size?: "small" | "medium" | "large";
  icon?: keyof typeof TablerIcons;
  loading?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "medium",
  className,
  children,
  icon,
  ...props
}) => {
  const baseClasses =
    "flex items-center justify-center font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:pointer-events-none";
  const variantClasses = {
    primary:
      "rounded-md border border-transparent bg-primary px-6 py-2 font-medium text-white hover:shadow-sm hover:text-gray-300 text-center",
    secondary:
      "rounded-md border border-transparent bg-secondary p-4 font-medium text-white hover:shadow-sm hover:text-gray-300 text-center",
    tertiary:
      "rounded-md border border-transparent bg-tertiary p-4 font-medium text-white hover:shadow-sm hover:text-gray-300 text-center",
  };
  const sizeClasses = {
    small: "small",
    medium: "medium",
    large: "large",
  };

  const IconComponent = () => {
    if (!icon) return null;
    const Icon: JSX.Element = (TablerIcons[icon] ||
      TablerIcons["IconQuestionMark"]) as unknown as JSX.Element;
    // @ts-ignore
    return Icon ? <Icon className="h-5 w-5" stroke={2} /> : null;
  };

  return (
    <button
      {...props}
      disabled={props.disabled || props.loading}
      className={classNames(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {props.loading ? (
        <span className="animate-spin">
          <TablerIcons.IconLoader2 className="h-5 w-5" stroke={2} />
        </span>
      ) : (
        <>
          {IconComponent && (
            <span className="mr-2">
              <IconComponent />
            </span>
          )}
          {children}
        </>
      )}
    </button>
  );
};

export default Button;
