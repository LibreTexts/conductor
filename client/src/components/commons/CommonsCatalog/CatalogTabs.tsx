import { forwardRef, ForwardedRef, useImperativeHandle, useState } from "react";
import {
  Tab,
  TabProps,
  TabPaneProps,
  Menu,
  Label,
  Icon,
} from "semantic-ui-react";

interface CatalogTabsProps extends TabProps {
  booksContent: React.ReactNode;
  assetsContent: React.ReactNode;
  projectsContent: React.ReactNode;
  booksCount?: number;
  assetsCount?: number;
  projectsCount?: number;
  paneProps?: TabPaneProps;
}

type CatalogTabsRef = {
  getActiveTab: () => "books" | "assets" | "projects";
};

const CatalogTabs = forwardRef(
  (props: CatalogTabsProps, ref: ForwardedRef<CatalogTabsRef>) => {
    const [activeIndex, setActiveIndex] = useState<0 | 1| 2>(0);
    const {
      booksContent,
      assetsContent,
      projectsContent,
      booksCount,
      assetsCount,
      projectsCount,
      paneProps,
      ...rest
    } = props;

    useImperativeHandle(ref, () => ({
      getActiveTab: () => {
        const activeTab =
          activeIndex === 0
            ? "books"
            : activeIndex === 1
            ? "assets"
            : "projects";
        return activeTab;
      },
    }));

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
            {!paneProps?.loading ? booksContent : <Icon name="spinner" loading />}
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
            {!paneProps?.loading ? assetsContent : <Icon name="spinner" loading />}
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
            {!paneProps?.loading ? projectsContent : <Icon name="spinner" loading />}
          </Tab.Pane>
        ),
      },
    ];

    return (
      <Tab
        menu={{ secondary: true, pointing: true }}
        panes={panes}
        activeIndex={activeIndex}
        onTabChange={(e, data) => setActiveIndex(data.activeIndex as 0 | 1 | 2)}
        {...rest}
      />
    );
  }
);

export default CatalogTabs;
