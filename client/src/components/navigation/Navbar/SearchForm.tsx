import { useState } from "react";
import { useHistory } from "react-router-dom";
import { IconButton } from "@libretexts/davis-react";
import { IconSearch, IconX } from "@tabler/icons-react";

interface SearchFormProps {
  className?: string;
}

const SearchForm: React.FC<SearchFormProps> = ({ className }) => {
  const history = useHistory();
  const [searchInput, setSearchInput] = useState("");

  /**
   * Process the search string and, if non-empty, navigate to the Search Results page.
   */
  const handlePerformSearch = () => {
    if (searchInput.trim() !== "") {
      history.push(`/search?query=${encodeURIComponent(searchInput.trim())}`);
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
      className={`flex items-center gap-2 ${className ?? ""}`}
    >
      <label htmlFor="navbar-search" className="sr-only">
        Search
      </label>
      <input
        id="navbar-search"
        type="search"
        value={searchInput}
        placeholder="Search..."
        onChange={(e) => setSearchInput(e.target.value)}
        className="h-[36px] rounded-md border border-neutral-300 bg-white px-3 text-sm text-text
                   placeholder:text-neutral-400 focus:outline-2 focus:outline-primary focus:outline-offset-0
                   !w-full !xl:w-[160px]"
      />
      {searchInput.length > 0 && (
        <IconButton
          icon={<IconX size={16} />}
          aria-label="Clear search"
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => setSearchInput("")}
          className="h-[36px]"
        />
      )}
      <IconButton
        icon={<IconSearch />}
        aria-label="Perform search"
        variant="primary"
        size="md"
        type="submit"
        className="h-[36px]"
      />
    </form>
  );
};

export default SearchForm;
