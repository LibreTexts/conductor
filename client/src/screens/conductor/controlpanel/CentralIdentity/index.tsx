import { Breadcrumb, Heading, Stack } from "@libretexts/davis-react";
import {
  IconBuilding,
  IconChevronRight,
  IconCircleCheck,
  IconKey,
  IconServer,
  IconUsers,
} from "@tabler/icons-react";
import { useEffect } from "react";
import { useHistory } from "react-router-dom";
import { useTypedSelector } from "../../../../state/hooks";

type CentralIdentityListItem = {
  url: string;
  icon: React.ReactNode;
  title: string;
  description: string;
};

const CentralIdentity = () => {
  // Global State
  const isSuperAdmin = useTypedSelector((state) => state.user.isSuperAdmin);
  const org = useTypedSelector((state) => state.org);
  const history = useHistory();

  /**
   * Set page title on initial load.
   */
  useEffect(() => {
    document.title = "LibreTexts Conductor | LibreOne Management";
  }, []);

  const listItems: CentralIdentityListItem[] = [
    {
      url: "/controlpanel/libreone/app-licenses",
      icon: <IconKey size={20} />,
      title: "App Licenses",
      description: "View and manage App Licenses",
    },
    {
      url: "/controlpanel/libreone/instructor-verifications",
      icon: <IconCircleCheck size={20} />,
      title: "Instructor Verification Requests",
      description: "View and manage Instructor Verification Requests",
    },
    {
      url: "/controlpanel/libreone/orgs",
      icon: <IconBuilding size={20} />,
      title: "Organizations & Systems",
      description:
        "View and manage Organizations and Systems on the LibreOne platform",
    },
    {
      url: "/controlpanel/libreone/users",
      icon: <IconUsers size={20} />,
      title: "Users",
      description: "View and manage Users on the LibreOne platform",
    },
    {
      url: "/controlpanel/libreone/services",
      icon: <IconServer size={20} />,
      title: "Services",
      description: "View and manage Services on the LibreOne platform",
    },
  ];

  return (
    <div className="bg-white h-full px-8 pt-8">
      <Stack direction="vertical" gap="md" className="mb-4">
        <Heading level={2}>LibreOne Admin Consoles</Heading>
        <Breadcrumb aria-label="Page navigation">
          <Breadcrumb.Item href="/controlpanel">Control Panel</Breadcrumb.Item>
          <Breadcrumb.Item isCurrent>LibreOne Admin Consoles</Breadcrumb.Item>
        </Breadcrumb>
      </Stack>

      <p className="text-gray-700 mb-6">
        Welcome to the LibreOne Admin Consoles. Here, you will find several
        tools to manage users throughout the LibreVerse via the LibreOne CAS.
      </p>

      {isSuperAdmin && org.orgID === "libretexts" && (
        <div>
          <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-2">
            LibreOne Admin Consoles
          </h3>
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
            {listItems.map((item) => (
              <button
                key={item.url}
                type="button"
                onClick={() => history.push(item.url)}
                className="w-full flex items-center justify-between gap-4 px-4 py-4 text-left hover:bg-gray-50 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary"
              >
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">{item.icon}</span>
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">
                      {item.title}
                    </span>
                    <span className="text-sm text-gray-600">
                      {item.description}
                    </span>
                  </div>
                </div>
                <IconChevronRight
                  size={18}
                  className="text-gray-400 shrink-0"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CentralIdentity;
