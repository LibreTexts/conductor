import { useEffect, useState } from "react";
import { Icon, SemanticICONS } from "semantic-ui-react";

interface ProjectSidePanelProps {
  activePane: string;
  setActivePane?: (pane: string) => void;
}

const ProjectSidePanel: React.FC<ProjectSidePanelProps> = ({
  activePane,
  setActivePane,
}) => {
  const [settingsMode, setSettingsMode] = useState<boolean>(false);

  useEffect(() => {
    if (activePane === "settings") {
      setSettingsMode(true);
    } else {
      setSettingsMode(false);
    }
  }, [activePane]);

  const MAIN_ITEMS: { name: string; iconName: SemanticICONS }[] = [
    {
      name: "Home",
      iconName: "home",
    },
    {
      name: "Discussion",
      iconName: "chat",
    },
    {
      name: "Assets",
      iconName: "file",
    },
    {
      name: "Settings",
      iconName: "settings",
    },
  ];

  const BOOK_ITEMS: { name: string; iconName: SemanticICONS }[] = [
    {
      name: "About",
      iconName: "info circle",
    },
    {
      name: "Structure",
      iconName: "list",
    },
    {
      name: "Peer Review",
      iconName: "clipboard list",
    },
    {
      name: "Accessibility",
      iconName: "universal access",
    },
  ];

  const ListItem = ({
    iconName,
    name,
  }: {
    iconName: SemanticICONS;
    name: string;
  }) => {
    return (
      <li>
        <a
          className={`block my-2 mx-1 h-10 rounded-lg leading-10 pl-4 text-black hover:text-black ${
            activePane === name.toLowerCase()
              ? "bg-slate-200"
              : "hover:bg-slate-200"
          }`}
          href={`#${name.toLowerCase()}`}
          onClick={() => setActivePane && setActivePane(name.toLowerCase())}
        >
          <Icon name={iconName} />
          <span className="ml-1">{name}</span>
        </a>
      </li>
    );
  };

  return (
    <div className="flex flex-col basis-2/12 bg-slate-50 border-r border-slate-200">

        <nav
          aria-label="Project Settings Navigation"
          className="h-full w-full pl-4 mt-8"
        >
          <ul>
            <li>
              <a
                className="block my-2 mx-0 h-10 hover:bg-slate-200 pl-2 rounded-lg leading-10 text-black hover:text-black"
                href="/projects"
              >
                <Icon name="arrow left" />
                <span className="ml-1">Back to Project</span>
              </a>
            </li>
            <li>
              <span className="mb-8 lg:mb-3 font-semibold text-slate-900 pl-2">
                Main
              </span>
              <ul>
                {MAIN_ITEMS.map((item) => (
                  <ListItem iconName={item.iconName} name={item.name} />
                ))}
              </ul>
            </li>
          </ul>
        </nav>
    </div>
  );
};

export default ProjectSidePanel;
