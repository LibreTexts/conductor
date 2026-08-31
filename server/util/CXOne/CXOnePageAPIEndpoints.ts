const DREAM_OUT_FORMAT = "dream.out.format=json";

const CXOnePageAPIEndpoints = {
  GET_Page: `?${DREAM_OUT_FORMAT}`,
  /**
   * Page contents endpoint.
   * @param format - Response envelope format.
   * @param mode - MindTouch content mode. Omitted (MindTouch default) means `view`, i.e. *rendered*
   * output with DekiScript/templates/transclusions expanded. Pass `edit` when the content will be
   * modified and written back, so authored source is preserved rather than baked into its expansion.
   */
  GET_Page_Contents: (
    format: 'html' | 'json',
    mode?: 'edit' | 'view' | 'raw'
  ) => {
    const params = [
      ...(mode ? [`mode=${mode}`] : []),
      ...(format === 'json' ? [DREAM_OUT_FORMAT] : []),
    ];
    return `contents${params.length ? `?${params.join('&')}` : ''}`;
  },
  GET_Page_Files: `files?${DREAM_OUT_FORMAT}`,
  GET_Page_File: (fileName: string) =>
    `files/${encodeURIComponent(fileName)}`,
  GET_Page_Images: `images?${DREAM_OUT_FORMAT}`,
  GET_Page_Info: `info?${DREAM_OUT_FORMAT}`,
  GET_Page_Properties: `properties?${DREAM_OUT_FORMAT}`,
  GET_Page_Security: `security?${DREAM_OUT_FORMAT}`,
  GET_Page_Tree: `tree?${DREAM_OUT_FORMAT}&include=properties,lastmodified`,
  GET_Subpages: `subpages?${DREAM_OUT_FORMAT}&limit=all`,
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
  GET_page_RawContents: `contents?mode=raw&${DREAM_OUT_FORMAT}`,
  DREAM_OUT_FORMAT: `?${DREAM_OUT_FORMAT}`,
  DREAM_OUT_FORMAT_LIMIT: (limit: number):string => `?${DREAM_OUT_FORMAT}&limit=${limit}`,
  ORDER_PAGES:(afterId:string):string=> `order?${DREAM_OUT_FORMAT}&origin=mt-web&afterid=${afterId}`,
};

export default CXOnePageAPIEndpoints;
