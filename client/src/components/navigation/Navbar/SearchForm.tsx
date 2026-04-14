import { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { Input } from "@libretexts/davis-react";
import { IconSearch } from "@tabler/icons-react";
import { NavbarContext } from "../../../types";

interface SearchFormProps {
  context: NavbarContext;
  className?: string;
}

const SearchForm: React.FC<SearchFormProps> = ({ context, className }) => {
  const history = useHistory();
  const [searchInput, setSearchInput] = useState("");


  // Store: hydrate search input from the ?query= URL param on mount.
  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get("query");
    setSearchInput(query ?? "");
  }, []);

  const handlePerformSearch = () => {
    if (searchInput.trim() === "") return; // don't perform search if input is empty or just whitespace

    if (context === "conductor") {
      history.push(`/search?query=${encodeURIComponent(searchInput.trim())}`);
    }
    if (context === "support") {
      history.push(`/insight/search?query=${encodeURIComponent(searchInput.trim())}`);
    }
    if (context === "store") {
      history.push(`/store/search?query=${encodeURIComponent(searchInput.trim())}`);
    }
  };

  const getPlaceholder = () => {
    switch (context) {
      case "conductor":
        return "Search Commons & Conductor";
      case "support":
        return "Search Insight Knowledge Base...";
      case "store":
        return "Search LibreTexts Store...";
      default:
        return "Search...";
    }
  };

  return (
    <form
      role="search"
      aria-label="Site search"
      onSubmit={(e) => {
        e.preventDefault();
        handlePerformSearch();
      }}
      className={className}
    >
      <Input
        name="search-input"
        label=""
        placeholder={getPlaceholder()}
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        rightIcon={<IconSearch />}
        className="w-full! lg:w-96!"
      />
    </form>
  );
};

export default SearchForm;
