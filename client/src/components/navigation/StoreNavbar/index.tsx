import { useMediaQuery } from "react-responsive";
import withUserStateDependency from "../../../enhancers/withUserStateDependency";
import { useEffect, useState } from "react";
import { useTypedSelector } from "../../../state/hooks";
import StoreNavbarDesktop from "./StoreNavbarDesktop";

const StoreNavbar: React.FC = () => {
  const user = useTypedSelector((state) => state.user);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(true);
  const isTailwindLg = useMediaQuery(
    { minWidth: 1024 }, // Tailwind LG breakpoint
    undefined
  );

  useEffect(() => {
    // if there is a query parameter in the URL on first render, set it as the search value
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get("query");
    if (query) {
      setSearch(query);
    } else {
      setSearch("");
    }
  }, [])

  const handleSearch = () => {
    if (!search) return;

    const currQuery =
      window.location.pathname === "/store/catalog"
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();

    const queryChanged = currQuery.get("query") !== search;
    if (queryChanged){
      currQuery.set("query", search);
      currQuery.set("page", "1"); // Reset to first page on new search
    }

    window.location.href = `/store/catalog?${currQuery.toString()}`;
  };

  return (
    <StoreNavbarDesktop
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

export default withUserStateDependency(StoreNavbar);
