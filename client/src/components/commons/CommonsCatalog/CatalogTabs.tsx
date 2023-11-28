import {
  Tab,
  TabProps,
  TabPaneProps,
  Menu,
  Label,
  Icon,
} from "semantic-ui-react";

interface CatalogTabsProps extends TabProps {
  children: React.ReactNode;
  paneProps?: TabPaneProps;
  booksCount?: number;
  assetsCount?: number;
  projectsCount?: number;
}

const CatalogTabs: React.FC<CatalogTabsProps> = ({
  children,
  paneProps,
  booksCount,
  assetsCount,
  projectsCount,
  ...rest
}) => {
  const paneClasses = "!border-none !shadow-none !px-0 !pt-0 !rounded-md";
  const panes = [
    {
      menuItem: (
        <Menu.Item key="books">
          <Icon name="book" />
          Books
          <Label>{booksCount ?? 0}</Label>
        </Menu.Item>
      ),
      render: () => (
        <Tab.Pane attached={false} className={paneClasses} {...paneProps}>
          {!paneProps?.loading ? children : null}
        </Tab.Pane>
      ),
    },
    {
      menuItem: (
        <Menu.Item key="assets">
          <Icon name="file alternate outline" />
          Assets
          <Label>{assetsCount ?? 0}</Label>
        </Menu.Item>
      ),
      render: () => (
        <Tab.Pane attached={false} className={paneClasses} {...paneProps}>
          {!paneProps?.loading ? children : null}
        </Tab.Pane>
      ),
    },
    {
      menuItem: (
        <Menu.Item key="projects">
          <Icon name="wrench" />
          Projects
          <Label>{projectsCount ?? 0}</Label>
        </Menu.Item>
      ),
      render: () => (
        <Tab.Pane attached={false} className={paneClasses} {...paneProps}>
          {!paneProps?.loading ? children : null}
        </Tab.Pane>
      ),
    },
  ];

  return (
    <Tab menu={{ secondary: true, pointing: true }} panes={panes} {...rest} />
  );
};

export default CatalogTabs;
