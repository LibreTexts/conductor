import NavTree from "./NavTree";

interface DefaultLayoutWNavTreeProps {
  children: React.ReactNode;
}

const DefaultLayoutWNavTree: React.FC<DefaultLayoutWNavTreeProps> = ({
  children,
}) => {
  return (
    <div className="bg-white h-screen-content !-mb-[2%]">
      <a
        href="#kb-main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:rounded focus:shadow-md focus:ring-2 focus:ring-primary"
      >
        Skip to main content
      </a>
      <div className="flex flex-row w-full h-screen-content">
        <NavTree />
        <main
          id="kb-main-content"
          tabIndex={-1}
          className="p-8 w-full h-screen-content overflow-y-auto focus:outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  );
};

export default DefaultLayoutWNavTree;
