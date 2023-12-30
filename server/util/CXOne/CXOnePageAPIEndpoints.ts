const DREAM_OUT_FORMAT = "dream.out.format=json";

const CXOnePageAPIEndpoints = {
  GET_Page_Info: `info?${DREAM_OUT_FORMAT}`,
  POST_Contents_Title: (title: string) =>
    `contents?title=${encodeURIComponent(title)}&${DREAM_OUT_FORMAT}`,
  POST_Properties: `properties?${DREAM_OUT_FORMAT}`,
  POST_Security: `security?${DREAM_OUT_FORMAT}`,
  PUT_File_Default_Thumbnail: "files/=mindtouch.page%2523thumbnail",
  PUT_Security: `security?${DREAM_OUT_FORMAT}`,
};

export default CXOnePageAPIEndpoints;
