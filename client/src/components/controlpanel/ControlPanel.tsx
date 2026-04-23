import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTypedSelector } from "../../state/hooks";
import {
  IconAddressBook,
  IconBook,
  IconCalendar,
  IconChartLine,
  IconChevronRight,
  IconDatabase,
  IconFolderOpen,
  IconKey,
  IconListCheck,
  IconMessages,
  IconQrcode,
  IconSchool,
  IconShoppingCart,
  IconSitemap,
  IconTags,
} from "@tabler/icons-react";

type ControlPanelListItem = {
  url: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  roles?: ("campusAdmin" | "superAdmin" | "support")[];
};

const ControlPanel = () => {
  const user = useTypedSelector((state) => state.user);
  const org = useTypedSelector((state) => state.org);

  useEffect(() => {
    document.title = "LibreTexts Conductor | Control Panel";
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!user.isCampusAdmin && !user.isSuperAdmin && !user.isSupport) {
      window.location.href = "/home";
    }
  }, [user]);

  const libretextsMasterTools: ControlPanelListItem[] = [
    {
      url: "/controlpanel/adoptionreports",
      icon: <IconChartLine size={20} />,
      title: "Adoption Reports",
      description: "View Adoption Reports submitted to the Conductor platform",
      roles: ["superAdmin"],
    },
    {
      url: "/controlpanel/analyticsrequests",
      icon: <IconDatabase size={20} />,
      title: "Analytics Access Requests",
      description: "View requests to access LibreTexts textbook analytics feeds",
      roles: ["superAdmin"],
    },
    {
      url: "/controlpanel/authorsmanager",
      icon: <IconAddressBook size={20} />,
      title: "Authors Manager",
      description:
        "Manage the master list of Authors that can be associated with Conductor projects and LibreTexts textbooks",
    },
    {
      url: "/controlpanel/eventsmanager",
      icon: <IconCalendar size={20} />,
      title: "Events Manager",
      description: "View and manage Events on the Conductor platform",
      roles: ["superAdmin"],
    },
    {
      url: "/controlpanel/homeworkmanager",
      icon: <IconListCheck size={20} />,
      title: "Homework Manager",
      description: "View and manage Homework resources listed on the LibreCommons",
      roles: ["superAdmin"],
    },
    {
      url: "/controlpanel/indexmanager",
      icon: <IconDatabase size={20} />,
      title: "Index Manager",
      description:
        "Manage Meilisearch indexes including status checks, re-syncing, and settings",
      roles: ["superAdmin"],
    },
    {
      url: "/controlpanel/libreone",
      icon: <IconKey size={20} />,
      title: "LibreOne Admin Consoles",
      description: "View and manage users and organizations on the LibreOne platform",
      roles: ["superAdmin"],
    },
    {
      url: "/controlpanel/orgsmanager",
      icon: <IconSitemap size={20} />,
      title: "Organizations Manager",
      description: "View and manage Organizations on the Conductor platform",
      roles: ["superAdmin"],
    },
    {
      url: "/controlpanel/qr-code-generator",
      icon: <IconQrcode size={20} />,
      title: "QR Code Generator",
      description: "Generate branded QR codes for sharing",
      roles: ["superAdmin"],
    },
    {
      url: "/controlpanel/store",
      icon: <IconShoppingCart size={20} />,
      title: "Store Manager",
      description: "Manage the LibreTexts Store",
      roles: ["superAdmin"],
    },
  ];

  const campusAdminTools: ControlPanelListItem[] = [
    ...(org.FEAT_AssetTagsManager
      ? [
          {
            url: "/controlpanel/assettagsmanager",
            icon: <IconTags size={20} />,
            title: "Asset Tags Manager",
            description:
              "Manage templates for metadata tags that can be applied to assets in Conductor projects",
          },
        ]
      : []),
    {
      url: "/controlpanel/booksmanager",
      icon: <IconBook size={20} />,
      title: "Books Manager",
      description:
        "See the master Commons Catalog and manage which texts appear on your Campus Commons",
    },
    {
      url: "/controlpanel/collectionsmanager",
      icon: <IconFolderOpen size={20} />,
      title: "Collections Manager",
      description:
        "Create new Collections for your Campus Commons and manage existing Collections",
    },
    {
      url: "/controlpanel/peerreviewrubrics",
      icon: <IconMessages size={20} />,
      title: "Peer Review Rubrics",
      description:
        "Manage Peer Review rubrics available for use in Conductor projects",
    },
    {
      url: "/controlpanel/campussettings",
      icon: <IconSchool size={20} />,
      title: "Campus Settings",
      description:
        "Manage branding settings for your Conductor instance and your Campus Commons",
    },
  ];

  const masterToolsToRender = useMemo(() => {
    return libretextsMasterTools.filter((item) => {
      if (user.isSuperAdmin) return true;
      if (user.isSupport && item.roles?.includes("support")) return true;
      return !item.roles || item.roles.length === 0;
    });
  }, [user]);

  const renderListItem = (item: ControlPanelListItem, idx: number) => (
    <Link
      to={item.url}
      key={idx}
      className="flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
    >
      <div className="flex items-center gap-3">
        <span className="text-gray-500 shrink-0">{item.icon}</span>
        <div className="flex flex-col">
          <span className="font-semibold text-gray-800 text-sm">{item.title}</span>
          <span className="text-gray-500 text-sm">{item.description}</span>
        </div>
      </div>
      <IconChevronRight size={18} className="text-gray-400 shrink-0" />
    </Link>
  );

  return (
    <div className="mx-[1%] mt-5 w-[98%]">
      <div className="flex flex-col mb-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Control Panel</h1>
        <div className="border-b border-gray-200 w-full" />
      </div>
      <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <span className="text-sm text-gray-700 font-medium">Control Panel</span>
        </div>
        <div className="px-4 py-4">
          <p className="text-gray-700 mb-4">
            Welcome to Control Panel. Here, you will find several tools to manage your
            Campus Conductor instance.
          </p>
          <div className="px-2">
            {(user.isSuperAdmin || user.isSupport) && org.orgID === "libretexts" && (
              <div className="mb-6">
                <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 pb-1 border-b border-gray-200">
                  LibreTexts Master Tools
                </h5>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {masterToolsToRender.map((item, idx) => renderListItem(item, idx))}
                </div>
              </div>
            )}
            {(user.isCampusAdmin || user.isSuperAdmin) && (
              <div className="mb-6">
                <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 pb-1 border-b border-gray-200">
                  Campus Admin Tools
                </h5>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {campusAdminTools.map((item, idx) => renderListItem(item, idx))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
