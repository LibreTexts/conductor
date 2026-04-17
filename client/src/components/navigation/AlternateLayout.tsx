import classNames from "classnames";

/**
 * Alternative layout for non-typical pages, e.g. Support Center, Store, etc.
 */
const AlternateLayout = ({
  children,
  altBackground,
  noPadding,
  h = "screen",
  className,
}: {
  children: JSX.Element[] | JSX.Element;
  altBackground?: boolean;
  noPadding?: boolean;
  h?: "screen" | "screen-content";
  className?: string;
}) => {
  return (
    <div
      className={classNames(
        "flex flex-col",
        h === "screen" ? "min-h-screen" : "h-screen-content",
        altBackground ? "" : "bg-white",
        noPadding ? "" : "pt-5",
        className
      )}
    >
      {children}
    </div>
  );
};

export default AlternateLayout;
