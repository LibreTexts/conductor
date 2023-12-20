import {
  forwardRef,
  ForwardedRef,
  useImperativeHandle,
  useState,
  useRef,
} from "react";
import { Tab, TabProps, Menu, Label, Icon } from "semantic-ui-react";
import CatalogBookTab from "./CatalogBookTab";
import CatalogAssetTab from "./CatalogAssetTab";
import CatalogProjectTab from "./CatalogProjectTab";

interface CatalogTabsProps extends TabProps {
  searchString: string;
}

type CatalogTabsRef = {
  getActiveTab: () => "books" | "assets" | "projects";
  loadInitialCatalogs: () => void;
  runSearch: () => void;
  resetSearch: () => void;
};

const CatalogTabs = forwardRef(
  (props: CatalogTabsProps, ref: ForwardedRef<CatalogTabsRef>) => {
    const [activeIndex, setActiveIndex] = useState<0 | 1 | 2>(0);
    const [booksCount, setBooksCount] = useState<number | null>(null);
    const [assetsCount, setAssetsCount] = useState<number | null>(null);
    const [projectsCount, setProjectsCount] = useState<number | null>(null);
    const { searchString, paneProps, ...rest } = props;

    const catalogBookTabRef =
      useRef<React.ElementRef<typeof CatalogBookTab>>(null);
    const catalogAssetTabRef =
      useRef<React.ElementRef<typeof CatalogAssetTab>>(null);
    const catalogProjectTabRef =
      useRef<React.ElementRef<typeof CatalogProjectTab>>(null);

    useImperativeHandle(ref, () => ({
      getActiveTab: () => {
        return computeActiveTabFromIDX(activeIndex);
      },
      loadInitialCatalogs: () => {
        catalogBookTabRef.current?.loadInitialCatalog();
        catalogAssetTabRef.current?.loadInitialCatalog();
        catalogProjectTabRef.current?.loadInitialCatalog();
      },
      runSearch: () => {
        catalogBookTabRef.current?.runSearch();
        catalogAssetTabRef.current?.runSearch();
        catalogProjectTabRef.current?.runSearch();
      },
      resetSearch: () => {
        catalogBookTabRef.current?.resetSearch();
        catalogAssetTabRef.current?.resetSearch();
        catalogProjectTabRef.current?.resetSearch();
      }
    }));

    function computeActiveTabFromIDX(idx: 0 | 1 | 2) {
      const activeTab = idx === 0 ? "books" : idx === 1 ? "assets" : "projects";
      return activeTab;
    }

    const panes = [
      {
        menuItem: (
          <Menu.Item key="books">
            <Icon name="book" />
            Books
            <Label>{booksCount ?? 0}</Label>
          </Menu.Item>
        ),
        pane: (
          <CatalogBookTab
            key={"books-tab"}
            searchString={searchString}
            countUpdate={setBooksCount}
            ref={catalogBookTabRef}
          />
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
        pane: (
          <CatalogAssetTab
            key={"assets-tab"}
            searchString={searchString}
            countUpdate={setAssetsCount}
            ref={catalogAssetTabRef}
          />
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
        pane: (
          <CatalogProjectTab
            key={"projects-tab"}
            searchString={searchString}
            countUpdate={setProjectsCount}
            ref={catalogProjectTabRef}
          />
        ),
      },
    ];

    return (
      <Tab
        menu={{ secondary: true, pointing: true }}
        panes={panes}
        activeIndex={activeIndex}
        renderActiveOnly={false}
        onTabChange={(e, data) => setActiveIndex(data.activeIndex as 0 | 1 | 2)}
        {...rest}
      />
    );
  }
);

export default CatalogTabs;
