const DREAM_OUT_FORMAT = "dream.out.format=json";

const CXOneFileAPIEndpoints = {
  GET_File: (
    size: "original" | "thumbnail" | "webview" | "bestfit" | "thumb"
  ) => `?size=${size}`,
  PUT_File_Properties: `properties?${DREAM_OUT_FORMAT}`,
};

export default CXOneFileAPIEndpoints;
