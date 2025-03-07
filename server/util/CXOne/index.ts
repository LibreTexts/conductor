import CXOneFileAPIEndpoints from "./CXOneFileAPIEndpoints.js";
import CXOnePageAPIEndpoints from "./CXOnePageAPIEndpoints.js";
import CXOnePageProperties from "./CXOnePageProperties.js";
import CXOneTemplates from "./CXOneTemplates.js";

const CXOne = {
  API: {
    Page: CXOnePageAPIEndpoints,
    File: CXOneFileAPIEndpoints
  },
  PageProps: CXOnePageProperties,
  Templates: CXOneTemplates
};

export default CXOne;
