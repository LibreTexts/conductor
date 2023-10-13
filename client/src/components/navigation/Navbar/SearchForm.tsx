import { useState } from "react";
import { useHistory } from "react-router-dom";
import { Button, Form, Icon, Menu, MenuItemProps } from "semantic-ui-react";

const SearchForm: React.FC<MenuItemProps> = (props: MenuItemProps) => {
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
    <Menu.Item {...props}>
      <Form
        onSubmit={(e) => {
          e.preventDefault();
          handlePerformSearch();
        }}
      >
        <Form.Input
          type="text"
          placeholder="Search..."
          onChange={(_e, { value }) => setSearchInput(value)}
          value={searchInput}
          action
          className="nav-search-input"
        >
          <input />
          {searchInput.length > 0 && (
            <Button
              icon
              type="reset"
              onClick={() => setSearchInput("")}
              aria-label="Clear Search Input"
            >
              <Icon name="x" />
            </Button>
          )}
          <Button type="submit" color="blue" icon aria-label="Perform Search">
            <Icon name="search" />
          </Button>
        </Form.Input>
      </Form>
    </Menu.Item>
  );
};

export default SearchForm;
