import { useRef, useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Link, Menu, MenuItemProps } from "@libretexts/davis-react";
import { IconSchool } from "@tabler/icons-react";


interface CommonsListProps {
  isMobile?: boolean;
}

const CommonsList: React.FC<CommonsListProps> = ({ isMobile = false }) => {
  // Data
  const [campusCommons, setCampusCommons] = useState<
    { key: string; name: string; link: string }[]
  >([]);

  const [mouseIndex, setMouseIndex] = useState(0);

  const selectRef = useRef(null);

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

  const itemsArr: MenuItemProps[] = campusCommons.map((inst) => ({
    key: inst.key,
    children: inst.name,
    onClick() {
      window.open(inst.link, "_blank", "noopener");
    },
  }));

  return (
    <Menu>
      <Menu.Button>
        Campus Commons
      </Menu.Button>
      <Menu.Items className="!w-72">
        {itemsArr.map((item) => (
          <Menu.Item {...item} />
        ))}
      </Menu.Items>
    </Menu>
  );
};

export default CommonsList;
