const DefaultLayout = ({ children }: { children: JSX.Element[] | JSX.Element }) => {
  return <div className="bg-white min-h-screen">{children}</div>;
};

export default DefaultLayout;
