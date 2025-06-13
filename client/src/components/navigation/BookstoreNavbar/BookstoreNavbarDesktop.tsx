import { Link } from "react-router-dom";
import { Form, Icon, Image } from "semantic-ui-react";
import Launchpad from "../Launchpad.js";
import UserDropdown from "../UserDropdown.js";
import { User } from "../../../types/User.js";

interface BookstoreNavbarDesktopProps {
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  showSearch: boolean;
  user: User;
  onSubmitSearch: () => void;
}

const BookstoreNavbarDesktop: React.FC<BookstoreNavbarDesktopProps> = ({
  search,
  setSearch,
  showSearch,
  user,
  onSubmitSearch,
}) => {
  return (
    <div className="flex flex-row bg-white h-fit py-2 px-4 shadow-md border-b items-center justify-between">
      <div className="flex flex-row items-center flex-shrink-0">
        <div className="flex ml-2 mt-0.5">
          <Launchpad />
        </div>
        <div
          className="flex flex-row items-center cursor-pointer"
          onClick={() => window.location.assign("/bookstore")}>
          <Image
            src="https://cdn.libretexts.net/Logos/libretexts_full.png"
            className="h-12 ml-6"
          />
          <span className="flex ml-2 base:text-xl lg:text-2xl font-semibold text-nowrap">
            | Bookstore
          </span>
        </div>
      </div>
      <div className="flex flex-1 justify-center px-4">
        <Form
          className="ml-8 w-full mt-1"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmitSearch();
          }}
        >
          {showSearch && (
            <Form.Input
              placeholder="Search LibreTexts Bookstore..."
              icon="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
        </Form>
      </div>
      <div className="flex flex-row items-center flex-shrink-0 ml-8">
        <div
          className="flex items-center text-gray-700 hover:text-gray-900 mr-8 justify-center"
          
        >
          <Icon name="shopping cart" size="large" />
          <span className="ml-2 text-lg">Cart</span>
        </div>

        <div className="ml-4">{user && user.uuid && <UserDropdown />}</div>
      </div>
    </div>
  );
};

export default BookstoreNavbarDesktop;
