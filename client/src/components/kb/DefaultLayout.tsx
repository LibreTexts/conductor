const DefaultLayout = ({
  children,
  altBackground,
  h = "screen",
}: {
  children: JSX.Element[] | JSX.Element;
  altBackground?: boolean;
  h?: "screen" | "screen-content";
}) => {
  return (
    <div
      className={`${
        altBackground ? "" : "bg-white"
      } flex flex-col ${h === "screen" ? "min-h-screen" : "h-screen-content"}`}
    >
      {children}
    </div>
  );
};

export default DefaultLayout;
