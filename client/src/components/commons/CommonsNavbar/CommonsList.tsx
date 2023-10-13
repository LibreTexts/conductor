import { Dropdown, Icon, Menu } from "semantic-ui-react";
import { useCallback, useEffect, useState } from "react";
import axios from "axios";

interface CommonsListProps {
  isMobile?: boolean;
}

const CommonsList: React.FC<CommonsListProps> = ({ isMobile = false }) => {
  // Data
  const [campusCommons, setCampusCommons] = useState<
    { key: string; name: string; link: string }[]
  >([]);

  /**
   * Retrieves a list of LibreGrid/Campus Commons instances from the server and saves it to state.
   */
  const getCampusCommons = useCallback(async () => {
    try {
      const commonsRes = await axios.get("/orgs/libregrid");
      if (!commonsRes.data.err) {
        if (Array.isArray(commonsRes.data.orgs)) {
          const orgs = [...commonsRes.data.orgs].map((item) => ({
            key: item.orgID,
            name: item.name,
            link: item.domain,
          }));
          setCampusCommons(orgs);
        }
      } else {
        throw new Error(commonsRes.data.errMsg);
      }
    } catch (e) {
      console.warn("Error retrieving Campus Commons list:");
      console.warn(e);
    }
  }, [setCampusCommons]);

  /**
   * Load the list of Campus Commons
   */
  useEffect(() => {
    getCampusCommons();
  }, []);

  if (campusCommons.length === 0) {
    return null;
  }

  const itemsArr = campusCommons.map((inst) => ({
    ...inst,
    props: {
      key: inst.key,
      as: "a",
      href: inst.link,
      target: "_blank",
      rel: "noopener noreferrer",
    },
  }));

  if (isMobile) {
    return (
      <Menu.Menu id="commons-mobilenav-libmenu">
        {itemsArr.map((item) => (
          <Menu.Item {...item.props}>
            <Icon name="university" />
            {item.name}
          </Menu.Item>
        ))}
      </Menu.Menu>
    );
  }
  return (
    <Dropdown item text="Campus Commons">
      <Dropdown.Menu direction="left">
        {itemsArr.map((item) => (
          <Dropdown.Item {...item.props}>
            <Icon name="university" />
            {item.name}
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
};

export default CommonsList;
