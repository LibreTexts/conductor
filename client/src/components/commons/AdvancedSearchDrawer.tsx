import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useReducer,
  useState,
} from "react";
import { Divider, Form, Icon } from "semantic-ui-react";
import CatalogAssetFilters from "./CommonsCatalog/CatalogAssetFilters";
import {
  AssetFilters,
  AssetFiltersAction,
  BookFilters,
  BookFiltersAction,
} from "../../types";
import CatalogBookFilters from "./CommonsCatalog/CatalogBookFilters";

interface AdvancedSearchDrawerProps {
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  searchString: string;
  onAssetFiltersChange: (filters: AssetFilters) => void;
  onBookFiltersChange: (filters: BookFilters) => void;
  onReset: () => void;
}

type AdvancedSearchDrawerRef = {
  reset: () => void;
  bookFiltersApplied: boolean;
  assetFiltersApplied: boolean;
  removeAssetFilter: (type: string) => void;
  removeBookFilter: (type: string) => void;
};

function assetsReducer(
  state: AssetFilters,
  action: AssetFiltersAction
): AssetFilters {
  switch (action.type) {
    case "license":
      return { ...state, license: action.payload };
    case "org":
      return { ...state, org: action.payload };
    case "fileType":
      return { ...state, fileType: action.payload };
    case "reset":
      return {};
    case "reset_one": {
      const newState = { ...state };
      delete newState[action.payload as keyof AssetFilters];
      return newState;
    }
    default:
      return state;
  }
}

function booksReducer(
  state: BookFilters,
  action: BookFiltersAction
): BookFilters {
  switch (action.type) {
    case "author":
      return { ...state, author: action.payload };
    case "library":
      return { ...state, library: action.payload };
    case "subject":
      return { ...state, subject: action.payload };
    case "affiliation":
      return { ...state, affiliation: action.payload };
    case "reset":
      return {};
    case "reset_one":
      const newState = { ...state };
      delete newState[action.payload as keyof BookFilters];
      return newState;
    default:
      return state;
  }
}

const AdvancedSearchDrawer = forwardRef(
  (
    props: AdvancedSearchDrawerProps,
    ref: React.ForwardedRef<AdvancedSearchDrawerRef>
  ) => {
    const {
      activeIndex,
      setActiveIndex,
      searchString,
      onAssetFiltersChange,
      onBookFiltersChange,
      onReset,
    } = props;
    const [assetsState, assetsDispatch] = useReducer(assetsReducer, {});
    const [booksState, booksDispatch] = useReducer(booksReducer, {});
    const [showAdvanced, setShowAdvanced] = useState(false);

    useImperativeHandle(ref, () => ({
      reset: () => handleReset(),
      bookFiltersApplied: Object.keys(booksState).length !== 0,
      assetFiltersApplied: Object.keys(assetsState).length !== 0,
      removeAssetFilter: (key: string) =>
        assetsDispatch({ type: "reset_one", payload: key }),
      removeBookFilter: (key: string) =>
        booksDispatch({ type: "reset_one", payload: key }),
    }));

    useEffect(() => {
      onAssetFiltersChange(assetsState);
    }, [assetsState]);

    useEffect(() => {
      onBookFiltersChange(booksState);
    }, [booksState]);

    function handleReset() {
      setActiveIndex(0);
      assetsDispatch({ type: "reset" });
      booksDispatch({ type: "reset" });
      onReset();
    }

    function handleChangeResourceType(idx: number) {
      setActiveIndex(idx);
      booksDispatch({ type: "reset" });
      assetsDispatch({ type: "reset" });
    }

    return (
      <div className="flex flex-col">
        <div
          className="flex flex-row items-center justify-center text-primary font-semibold cursor-pointer text-center mt-4"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <Icon
            name={showAdvanced ? "caret down" : "caret right"}
            className="mr-1 !mb-2"
          />
          <p className="">Advanced Search</p>
          <Icon
            name={showAdvanced ? "caret down" : "caret left"}
            className="ml-1 !mb-2"
          />
        </div>
        <div className="flex flex-row justify-center mt-2">
          {showAdvanced && (
            <div className="border-2 rounded-md shadow-md p-4 w-2/3">
              <Form onSubmit={(e) => e.preventDefault()}>
                <div className="flex flex-row mt-2">
                  <label className="font-bold">Resource Type:</label>
                  <div className="flex flex-row">
                    <input
                      type="radio"
                      name="resource-type"
                      id="books"
                      className="!ml-4"
                      checked={activeIndex === 0}
                      onChange={() => handleChangeResourceType(0)}
                    />
                    <label htmlFor="books" className="ml-1">
                      Books
                    </label>
                  </div>
                  <div className="flex flex-row">
                    <input
                      type="radio"
                      name="resource-type"
                      id="assets"
                      className="!ml-4"
                      checked={activeIndex === 1}
                      onChange={() => handleChangeResourceType(1)}
                    />
                    <label htmlFor="assets" className="ml-1">
                      Assets
                    </label>
                  </div>
                  <div className="flex flex-row">
                    <input
                      type="radio"
                      name="resource-type"
                      id="projects"
                      className="!ml-4"
                      checked={activeIndex === 2}
                      onChange={() => handleChangeResourceType(2)}
                    />
                    <label htmlFor="projects" className="ml-1">
                      Projects
                    </label>
                  </div>
                </div>
                <Divider />
                <div className="mb-4">
                  <label htmlFor="" className="font-bold">
                    Additional Filters
                  </label>
                  {activeIndex === 0 ? (
                    <CatalogBookFilters
                      filters={booksState}
                      onFilterChange={(type, value) =>
                        booksDispatch({ type, payload: value })
                      }
                    />
                  ) : activeIndex === 1 ? (
                    <CatalogAssetFilters
                      filters={assetsState}
                      onFilterChange={(type, value) =>
                        assetsDispatch({ type, payload: value })
                      }
                    />
                  ) : (
                    <div>
                      <p className="italic text-slate-500">
                        No additional filters available for this resource type.
                      </p>
                    </div>
                  )}
                </div>
              </Form>
            </div>
          )}
        </div>
        {(searchString !== "" ||
          Object.keys(assetsState).length !== 0 ||
          Object.keys(booksState).length !== 0) && (
          <p
            className="italic font-semibold cursor-pointer underline text-center mt-2"
            onClick={handleReset}
          >
            Reset Search
          </p>
        )}
      </div>
    );
  }
);

export default AdvancedSearchDrawer;
