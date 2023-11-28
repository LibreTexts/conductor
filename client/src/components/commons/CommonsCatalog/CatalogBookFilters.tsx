import { Dropdown } from "semantic-ui-react";
import { useState } from "react";

const CatalogBookFilters = () => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  return (
    <div className="flex flex-row my-4 mx-2 flex-wrap h-10 items-center">
      <Dropdown
        text="Library"
        icon="university"
        floating
        labeled
        button
        className="icon"
      >
        <Dropdown.Menu>
          <Dropdown.Item>Important</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
      <Dropdown
        text="Subject"
        icon="filter"
        floating
        labeled
        button
        className="icon"
      >
        <Dropdown.Menu></Dropdown.Menu>
      </Dropdown>
      <Dropdown
        text="Location"
        icon="globe"
        floating
        labeled
        button
        className="icon"
      >
        <Dropdown.Menu>
          <Dropdown.Header icon="globe" content="Filter by Location" />
        </Dropdown.Menu>
      </Dropdown>
      <Dropdown
        text="License"
        icon="legal"
        floating
        labeled
        button
        className="icon"
      >
        <Dropdown.Menu></Dropdown.Menu>
      </Dropdown>
      {showAdvanced && (
        <>
          <Dropdown
            text="Author"
            icon="user"
            floating
            labeled
            button
            className="icon"
          >
            <Dropdown.Menu></Dropdown.Menu>
          </Dropdown>
          <Dropdown
            text="Course"
            icon="users"
            floating
            labeled
            button
            className="icon"
          >
            <Dropdown.Menu></Dropdown.Menu>
          </Dropdown>
          <Dropdown
            text="Publisher"
            icon="print"
            floating
            labeled
            button
            className="icon"
          >
            <Dropdown.Menu></Dropdown.Menu>
          </Dropdown>
          <Dropdown
            text="Affiliation"
            icon="filter"
            floating
            labeled
            button
            className="icon"
          >
            <Dropdown.Menu></Dropdown.Menu>
          </Dropdown>
          <Dropdown
            text="C-ID"
            icon="hashtag"
            floating
            labeled
            button
            className="icon"
          >
            <Dropdown.Menu></Dropdown.Menu>
          </Dropdown>
        </>
      )}
      <p
        className="ml-2 underline cursor-pointer"
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        {showAdvanced ? "Hide" : "Show"} Advanced Filters
      </p>
    </div>
  );
};

export default CatalogBookFilters;
