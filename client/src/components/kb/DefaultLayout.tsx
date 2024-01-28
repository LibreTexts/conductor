const DefaultLayout = ({
  children,
  altBackground,
}: {
  children: JSX.Element[] | JSX.Element;
  altBackground?: boolean;
}) => {
  return (
    <div
      className={`${altBackground ? "" : "bg-white"} min-h-screen`}
    >
      {children}
    </div>
  );
};

export default DefaultLayout;
