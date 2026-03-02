import { Button, Icon, Label } from "semantic-ui-react";
import { Link } from "react-router-dom";

interface SearchSummaryHeaderProps {
  query: string;
  totalResults: number;
  onCreateAlert: () => void;
}

const SearchSummaryHeader: React.FC<SearchSummaryHeaderProps> = ({
  query,
  totalResults,
  onCreateAlert,
}) => {
  return (
    <div className="flex-row-div">
      <div className="left-flex">
        <Label color="blue">
          <Icon name="search" />
          Query
          <Label.Detail>{query}</Label.Detail>
        </Label>
        <Label color="grey">
          <Icon name="hashtag" />
          Results
          <Label.Detail>{totalResults}</Label.Detail>
        </Label>
      </div>
      <div className="right-flex">
        <Button.Group>
          <Button
            color="blue"
            as={Link}
            to="/alerts"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="alarm" />
            My Alerts
          </Button>
          <Button color="green" onClick={onCreateAlert}>
            <Icon name="add" />
            Create Alert
          </Button>
        </Button.Group>
      </div>
    </div>
  );
};

export default SearchSummaryHeader;
