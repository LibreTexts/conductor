import { Dropdown, Icon, Menu, DropdownProps } from "semantic-ui-react";
import { useRef, useCallback, useEffect, useState } from "react";
import axios from "axios";


interface CommonsListProps {
  isMobile?: boolean;
}

const CommonsList: React.FC<CommonsListProps> = ({ isMobile = false }) => {
  // Data
  const [campusCommons, setCampusCommons] = useState<
    { key: string; name: string; link: string }[]
  >([]);

  const [mouseIndex,setMouseIndex] = useState(0);

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
      <Menu.Menu className="commons-mobilenav-commonslist">
        {itemsArr.map((item) => (
          <Menu.Item {...item.props}>
            <Icon name="university" />
            {item.name}
          </Menu.Item>
        ))}
      </Menu.Menu>
    );
  }




  const handleKeyPress = (e:React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown') {
      setMouseIndex((prevIndex) => Math.min(prevIndex + 1, itemsArr.length - 1));
      const element = document.getElementById("active");
      if (element) {
        element?.scrollIntoView({
          behavior: "auto",
          block: "start"
        });
      }
    } else if (e.key === 'ArrowUp') {
      setMouseIndex((prevIndex) => Math.max(prevIndex - 1, 0));
      const element = document.getElementById("active");
      if (element) {
        element?.scrollIntoView({
          behavior: "auto",
          block: "start"
        });
      }
    } else if (e.key == "Enter"){
      window.location.href = itemsArr[mouseIndex].props.href;
    }
  };



  return (
    <div onKeyDown={handleKeyPress} className = "flex flex-row items-center" >
    <Dropdown item text="Campus Commons">
      <Dropdown.Menu direction="left" className="commons-desktopnav-commonslist"  >
        {itemsArr.map((item,index) => (
          <Dropdown.Item {...item.props} selected = {index==mouseIndex}  id={index==mouseIndex?"active":"inactive"}  >
            <Icon name="university" />
            {item.name}
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
    </div>
  );
};

export default CommonsList;
