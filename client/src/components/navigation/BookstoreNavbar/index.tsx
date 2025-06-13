import { useMediaQuery } from "react-responsive";
import withUserStateDependency from "../../../enhancers/withUserStateDependency";
import { useEffect, useState } from "react";
import { useTypedSelector } from "../../../state/hooks";
import BookstoreNavbarDesktop from "./BookstoreNavbarDesktop";

const BookstoreNavbar: React.FC = () => {
  const user = useTypedSelector((state) => state.user);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(true);
  const isTailwindLg = useMediaQuery(
    { minWidth: 1024 }, // Tailwind LG breakpoint
    undefined
  );

  useEffect(() => {
    // dont show search bar on /insight
    const split = window.location.href.split("/");
    const last = split[split.length - 1];
    if (last === "insight") {
      setShowSearch(false);
    } else {
      setShowSearch(true);
    }
  }, [window.location.href]);

  const handleSearch = () => {
    if (!search) return;
    window.location.href = `/insight/search?query=${encodeURIComponent(
      search
    )}`;
  };

  return (
    <BookstoreNavbarDesktop
      search={search}
      setSearch={setSearch}
      showSearch={showSearch}
      user={user}
      onSubmitSearch={handleSearch}
    />
  );

  // if (isTailwindLg) {
  //   return (
  //     <SupportCenterNavbarDesktop
  //       search={search}
  //       setSearch={setSearch}
  //       showSearch={showSearch}
  //       user={user}
  //       onSubmitSearch={handleSearch}
  //     />
  //   );
  // }
  // return (
  //   <SupportCenterNavbarMobile
  //     search={search}
  //     setSearch={setSearch}
  //     showSearch={showSearch}
  //     user={user}
  //     onSubmitSearch={handleSearch}
  //   />
  // );
};

export default withUserStateDependency(BookstoreNavbar);
