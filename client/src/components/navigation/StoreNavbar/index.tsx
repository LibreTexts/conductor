import withUserStateDependency from "../../../enhancers/withUserStateDependency";
import { useEffect, useState } from "react";
import { useTypedSelector } from "../../../state/hooks";
import StoreNavbarDesktop from "./StoreNavbarDesktop";
import StoreNavbarMobile from "./StoreNavbarMobile";
import EnvironmentBanner from "../EnvironmentBanner";
import { useMediaQuery } from "react-responsive";

const StoreNavbar: React.FC = () => {
  const user = useTypedSelector((state) => state.user);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(true);
  const isTailwindLg = useMediaQuery({ minWidth: 1024 });

  useEffect(() => {
    // if there is a query parameter in the URL on first render, set it as the search value
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get("query");
    if (query) {
      setSearch(query);
    } else {
      setSearch("");
    }
  }, []);

  const handleSearch = () => {
    const currQuery =
      window.location.pathname === "/store/catalog"
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();

    const queryChanged = currQuery.get("query") !== search;
    if (queryChanged) {
      if (search.trim() === "") {
        currQuery.delete("query"); // Remove query if search is empty
      } else {
        currQuery.set("query", search);
      }
    }

    window.location.href = `/store/catalog?${currQuery.toString()}`;
  };

  return (
    <>
      <EnvironmentBanner />
      {isTailwindLg ? (
        <StoreNavbarDesktop
          search={search}
          setSearch={setSearch}
          showSearch={showSearch}
          user={user}
          onSubmitSearch={handleSearch}
        />
      ) : (
        <StoreNavbarMobile
          search={search}
          setSearch={setSearch}
          showSearch={showSearch}
          user={user}
          onSubmitSearch={handleSearch}
        />
      )}
    </>
  );
};

export default withUserStateDependency(StoreNavbar);
