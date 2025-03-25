const DREAM_OUT_FORMAT = "dream.out.format=json";

const CXOnePageAPIEndpoints = {
  GET_Page: `?${DREAM_OUT_FORMAT}`,
  GET_Page_Contents: (format: 'html' | 'json') => `contents${format === 'json' ? `?${DREAM_OUT_FORMAT}` : ''}`,
  GET_Page_Files: `files?${DREAM_OUT_FORMAT}`,
  GET_Page_File: (fileName: string) =>
    `files/${encodeURIComponent(fileName)}`,
  GET_Page_Images: `images?${DREAM_OUT_FORMAT}`,
  GET_Page_Info: `info?${DREAM_OUT_FORMAT}`,
  GET_Page_Properties: `properties?${DREAM_OUT_FORMAT}`,
  GET_Page_Security: `security?${DREAM_OUT_FORMAT}`,
  GET_Page_Tree: `tree?${DREAM_OUT_FORMAT}&include=properties,lastmodified`,
  GET_Subpages: `subpages?${DREAM_OUT_FORMAT}`,
  GET_Page_Tags: `tags?${DREAM_OUT_FORMAT}`,
  POST_Contents: `contents?${DREAM_OUT_FORMAT}`,
  POST_Contents_Title: (title: string) =>
    `contents?title=${encodeURIComponent(title)}&${DREAM_OUT_FORMAT}`,
  POST_Properties: `properties?${DREAM_OUT_FORMAT}`,
  POST_Security: `security?${DREAM_OUT_FORMAT}`,
  PUT_File_Default_Thumbnail: "files/=mindtouch.page%2523thumbnail",
  PUT_Page_Overview: `overview?${DREAM_OUT_FORMAT}`,
  PUT_Page_Property: (property: string) =>
    `properties/${encodeURIComponent(property)}?${DREAM_OUT_FORMAT}`,
  PUT_Page_Tags: `tags?${DREAM_OUT_FORMAT}`,
  PUT_Security: `security?${DREAM_OUT_FORMAT}`,
};

export default CXOnePageAPIEndpoints;
