import axios, { AxiosRequestConfig } from "axios";
import {
  Announcement,
  AssetFilters,
  AssetSearchParams,
  AssetTagFramework,
  AssetTagFrameworkWithCampusDefault,
  Author,
  Book,
  BookFilters,
  BookSearchParams,
  CentralIdentityApp,
  CentralIdentityLicense,
  CentralIdentityOrg,
  CentralIdentitySystem,
  CentralIdentityUser,
  CentralIdentityService,
  CentralIdentityVerificationRequest,
  CollectionResource,
  ConductorBaseResponse,
  ConductorSearchResponse,
  HarvestRequest,
  Homework,
  HomeworkSearchParams,
  Library,
  PageDetailsResponse,
  PageTag,
  PeerReview,
  Project,
  ProjectFile,
  ProjectSearchParams,
  SupportTicket,
  TableOfContents,
  User,
  UserSearchParams,
  BaseInvitation,
  Sender,
  ProjectSummary,
  InvitationsResponse,
  PageSimpleWTags,
  PageSimpleWOverview,
  TableOfContentsDetailed,
  Note,
  StoreProduct,
  StoreCheckoutSessionItem,
  ClientConfig,
  StoreGetShippingOptionsRes,
  StoreCheckoutForm,
  StoreShippingOption,
  EditAcademyOnlineAccessFormValues,
  CentralIdentityUserLicenseResult,
  CentralIdentityAppLicense,
  StoreDigitalDeliveryOption,
  StoreOrder,
  GetStoreOrdersResponse,
  StoreOrderWithStripeSession,
  OrderCharge,
  OrderSession,
  CentralIdentityOrgAdminResult,
  AssetTag,
  SupportQueue,
  SupportQueueMetrics,
  SupportTicketPriority,
  MasterCatalogV2Response,
  BookWithAutoMatched,
  Organization,
} from "./types";
import {
  AddableProjectTeamMember,
  CIDDescriptor,
  ProjectBookBatchUpdateJob,
  ProjectFileAuthor,
  ProjectTag,
} from "./types/Project";
import { Collection } from "./types/Collection";
import {
  AuthorSearchParams,
  ConductorSearchResponseFile,
  CustomFilter,
  MiniRepoSearchParams,
} from "./types/Search";
import { CloudflareCaptionData, SortDirection } from "./types/Misc";
import {
  TrafficAnalyticsAggregatedMetricsByPageDataPoint,
  TrafficAnalyticsBaseRequestParams,
  TrafficAnalyticsPageViewsDataPoint,
  TrafficAnalyticsUniqueVisitorsDataPoint,
  TrafficAnalyticsVisitorCountriesDataPoint,
} from "./types/TrafficAnalytics";
import { EventSource } from "extended-eventsource";

/**
 * @fileoverview
 * We don't create an Axios instance here because not all api calls
 * have been converted to use this class yet, but we still want global config to apply
 */

class API {
  private readonly BASE_URL: string =
    import.meta.env.MODE === "development"
      ? `${import.meta.env.VITE_DEV_BASE_URL}/api/v1`
      : "/api/v1";

  // ANNOUNCEMENTS
  async getSystemAnnouncement() {
    const res = await axios.get<
      {
        sysAnnouncement: Announcement | null;
      } & ConductorBaseResponse
    >("/announcements/system");

    return res;
  }

  // ASSET TAGS FRAMEWORKS
  async getFrameworks({
    page,
    limit,
    sort,
    query,
  }: {
    page?: number;
    limit?: number;
    sort?: string;
    query?: string;
  }) {
    const res = await axios.get<
      {
        frameworks: AssetTagFrameworkWithCampusDefault[];
        totalCount: number;
      } & ConductorBaseResponse
    >("/assettagframeworks", {
      params: {
        page,
        limit,
        sort,
        query,
      },
    });
    return res;
  }

  async getFramework(id: string) {
    const res = await axios.get<
      {
        framework: AssetTagFramework;
      } & ConductorBaseResponse
    >(`/assettagframeworks/${id}`);
    return res;
  }

  async getCampusDefaultFramework(orgID: string) {
    const res = await axios.get<
      {
        framework: AssetTagFramework | null;
      } & ConductorBaseResponse
    >(`/assettagframeworks/campusdefault/${orgID}`);
    return res;
  }

  async createFramework(framework: AssetTagFramework) {
    const res = await axios.post<
      {
        framework: AssetTagFramework;
      } & ConductorBaseResponse
    >("/assettagframeworks", framework);
    return res;
  }

  async updateFramework(framework: AssetTagFramework) {
    const res = await axios.patch<
      {
        framework: AssetTagFramework;
      } & ConductorBaseResponse
    >(`/assettagframeworks/${framework.uuid}`, framework);
    return res;
  }

  async setAsCampusDefaultFramework(orgID: string, frameworkID: string) {
    const res = await axios.put<ConductorBaseResponse>(`/org/${orgID}`, {
      defaultAssetTagFrameworkUUID: frameworkID,
    });
    return res;
  }

  // ASSETS
  async addProjectFile(
    projectID: string,

    file: FormData,

    opts?: AxiosRequestConfig
  ) {
    const res = await axios.post<ConductorBaseResponse>(
      `/project/${projectID}/files`,
      file,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        ...opts,
      }
    );
    return res;
  }

  async addProjectFileFolder(
    projectID: string,
    name: string,
    parentID?: string
  ) {
    const res = await axios.post<ConductorBaseResponse>(
      `/project/${projectID}/files/folder`,
      {
        name,
        parentID,
      }
    );
    return res;
  }

  async replaceProjectFile_FormData(
    projectID: string,
    fileID: string,
    file: FormData,
    opts?: AxiosRequestConfig
  ) {
    const res = await axios.put<ConductorBaseResponse>(
      `/project/${projectID}/files/${fileID}`,
      file,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        ...opts,
      }
    );
    return res;
  }

  async getProjectFileCaptions(projectID: string, fileID: string) {
    const res = await axios.get<
      {
        captions: CloudflareCaptionData[];
      } & ConductorBaseResponse
    >(`/project/${projectID}/files/${fileID}/captions`);
    return res;
  }

  async uploadProjectFileCaptions(
    projectID: string,
    fileID: string,
    captions: FormData
  ) {
    const res = await axios.put<ConductorBaseResponse>(
      `/project/${projectID}/files/${fileID}/captions`,
      captions,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return res;
  }

  async getProjectFileEmbedHTML(projectID: string, fileID: string) {
    const res = await axios.get<
      {
        media_id: string;
        embed_url: string;
        embed_html: string;
      } & ConductorBaseResponse
    >(`/project/${projectID}/files/${fileID}/embed`);
    return res;
  }

  public cloudflareStreamUploadURL: string = `${
    import.meta.env.MODE === "development"
      ? import.meta.env.VITE_DEV_BASE_URL
      : ""
  }/api/v1/cloudflare/stream-url`;

  async getPermanentLink(projectID: string, fileID: string) {
    const res = await axios.get<
      {
        url: string;
      } & ConductorBaseResponse
    >(`/project/${projectID}/files/${fileID}/permanent`);
    return res;
  }

  // Authors
  async getAuthors({
    page,
    limit,
    sort,
    query,
  }: {
    page?: number;
    limit?: number;
    sort?: string;
    query?: string;
  }) {
    const res = await axios.get<
      {
        authors: Author[];
        totalCount: number;
      } & ConductorBaseResponse
    >("/authors", {
      params: {
        page,
        limit,
        sort,
        query,
      },
    });
    return res;
  }

  async getAuthor(id: string) {
    const res = await axios.get<
      {
        author: Author & { projects: Pick<Project, "projectID" | "title">[] };
      } & ConductorBaseResponse
    >(`/authors/${id}`);
    return res;
  }

  async getAuthorAssets(
    id: string,
    paramsObj?: { page?: number; limit?: number }
  ) {
    const res = await axios.get<
      {
        assets: ConductorSearchResponseFile[];
        total: number;
      } & ConductorBaseResponse
    >(`/authors/${id}/assets`, {
      params: paramsObj,
    });
    return res;
  }

  async createAuthor(author: Omit<Author, "_id">) {
    const res = await axios.post<
      {
        author: Author;
      } & ConductorBaseResponse
    >("/authors", author);
    return res;
  }

  async bulkCreateAuthors(authors: Omit<Author, "_id">[]) {
    const res = await axios.post<
      {
        authors: Author[];
      } & ConductorBaseResponse
    >("/authors/bulk", { authors });
    return res;
  }

  async updateAuthor(id: string, data: Author) {
    const res = await axios.patch<
      {
        author: Author;
      } & ConductorBaseResponse
    >(`/authors/${id}`, data);

    return res;
  }

  async deleteAuthor(id: string) {
    const res = await axios.delete<
      {
        deleted: boolean;
      } & ConductorBaseResponse
    >(`/authors/${id}`);
    return res;
  }

  // Books
  async getBookPeerReviews(bookID: string) {
    const res = await axios.get<
      {
        reviews: PeerReview[];
      } & ConductorBaseResponse
    >(`/commons/book/${bookID}/peerreviews`);
    return res;
  }

  async getBookTOC(bookID: string) {
    const res = await axios.get<
      {
        toc: TableOfContents;
      } & ConductorBaseResponse
    >(`/commons/book/${bookID}/toc`);
    return res;
  }

  async getBookPagesDetails(bookID: string) {
    const nonce = Math.random().toString(36).substring(7);
    const res = await axios.get<
      {
        toc: TableOfContentsDetailed;
      } & ConductorBaseResponse
    >(`/commons/book/${bookID}/pages-details?nonce=${nonce}`);
    return res;
  }

  async getPageDetails(pageID: string, coverPageID: string) {
    const nonce = Math.random().toString(36).substring(7);
    const res = await axios.get<PageDetailsResponse & ConductorBaseResponse>(
      `/commons/pages/${pageID}?coverPageID=${coverPageID}?nonce=${nonce}`
    );
    return res;
  }

  async getPageAISummary(pageID: string, coverPageID: string) {
    const res = await axios.get<
      {
        summary: string;
      } & ConductorBaseResponse
    >(`/co-author/pages/${pageID}/ai-summary?coverPageID=${coverPageID}`);
    return res;
  }

  async getPageAITags(pageID: string, coverPageID: string) {
    const res = await axios.get<
      {
        tags: string[];
      } & ConductorBaseResponse
    >(`/co-author/pages/${pageID}/ai-tags?coverPageID=${coverPageID}`);
    return res;
  }

  async generatePageImagesAltText(
    pageID: string,
    coverPageID: string,
    overwrite: boolean
  ) {
    const res = await axios.post<
      {
        success: boolean;
        modified_count: number;
      } & ConductorBaseResponse
    >(`/co-author/pages/${pageID}/ai-alt-text?coverPageID=${coverPageID}`, {
      overwrite,
    });
    return res;
  }

  /**
   * Generates and applies AI-generated summaries, tags, or both, to all pages in a book
   * @param {string} bookID - the cover page of the book to apply the summaries to
   */
  batchGenerateAIMetadata(
    bookID: string,
    config: {
      summaries: { generate: boolean; overwrite: boolean };
      tags: { generate: boolean; overwrite: boolean };
      alttext: { generate: boolean; overwrite: boolean };
    }
  ) {
    return new EventSource(
      `${this.BASE_URL}/co-author/books/${bookID}/ai-metadata-batch`,
      {
        headers: {
          "Content-Type": "application/json",
        },
        withCredentials: true,
        method: "POST",
        body: JSON.stringify(config),
      }
    );
  }

  /**
   * Applies user-supplied summaries and tags to the respective pages in a book
   * @param {string} bookID - the cover page of the book to apply the metadata to
   * @param {Array<{ id: string; summary: string; tags: string[] }>} pages - the pages & data to update
   */
  batchUpdateBookMetadata(
    bookID: string,
    pages: { id: string; summary: string; tags: string[] }[]
  ) {
    return new EventSource(
      `${this.BASE_URL}/co-author/books/${bookID}/update-metadata-batch`,
      {
        headers: {
          "Content-Type": "application/json",
        },
        withCredentials: true,
        method: "POST",
        body: JSON.stringify({ pages }),
      }
    );
  }

  async updatePageDetails(
    pageID: string,
    coverPageID: string,
    data: { summary: string; tags: string[] }
  ) {
    const res = await axios.patch<ConductorBaseResponse>(
      `/commons/pages/${pageID}?coverPageID=${coverPageID}`,
      data
    );
    return res;
  }

  async bulkUpdatePageTags(
    bookID: string,
    pages: { id: string; tags: string[] }[]
  ) {
    const res = await axios.put<
      {
        failed: number;
        processed: number;
      } & ConductorBaseResponse
    >(`/commons/books/${bookID}/page-tags`, {
      pages,
    });
    return res;
  }

  // Store
  async getStoreProducts({
    limit = 100,
    starting_after,
    category,
    query,
  }: {
    limit?: number;
    starting_after?: string;
    category?: string;
    query?: string;
  } = {}) {
    const res = await axios.get<
      {
        products: StoreProduct[];
        meta: {
          has_more: boolean;
          total_count: number;
          cursor?: string;
        };
      } & ConductorBaseResponse
    >("/store/products", {
      params: {
        limit,
        starting_after,
        category,
        query,
      },
    });
    return res;
  }

  async getStoreProduct(product_id: string) {
    const res = await axios.get<
      { product: StoreProduct } & ConductorBaseResponse
    >(`/store/products/${product_id}`);
    return res;
  }

  async getMostPopularStoreProducts({
    limit = 10,
  }: {
    limit?: number;
  } = {}) {
    const res = await axios.get<
      { products: StoreProduct[] } & ConductorBaseResponse
    >("/store/products/most-popular", {
      params: {
        limit,
      },
    });
    return res;
  }

  async createCheckoutSession({
    items,
    shipping_option_id,
    shipping_address,
    digital_delivery_option,
    digital_delivery_account,
  }: {
    items: StoreCheckoutSessionItem[];
    shipping_option_id: number | "digital_delivery_only";
    shipping_address: StoreCheckoutForm;
    digital_delivery_option?: StoreDigitalDeliveryOption | null;
    digital_delivery_account?: string | null;
  }) {
    const res = await axios.post<
      {
        session_id: string;
        checkout_url: string;
      } & ConductorBaseResponse
    >("/store/checkout/session", {
      items,
      shipping_option_id,
      shipping_address,
      ...(digital_delivery_option && { digital_delivery_option }),
      ...(digital_delivery_account && { digital_delivery_account }),
    });
    return res;
  }

  async getShippingOptions({
    items,
    shipping_address,
  }: {
    items: StoreCheckoutSessionItem[];
    shipping_address: Pick<
      StoreCheckoutForm,
      "address_line_1" | "state" | "postal_code" | "country" | "city"
    >;
  }) {
    const res = await axios.post<
      { options: StoreGetShippingOptionsRes } & ConductorBaseResponse
    >("/store/checkout/shipping-options", {
      items,
      shipping_address,
    });
    return res;
  }

  async adminGetStoreOrders(params: {
    starting_after?: string;
    limit?: number;
    status?: string;
    lulu_status?: string;
    query?: string;
  }) {
    const res = await axios.get<GetStoreOrdersResponse & ConductorBaseResponse>(
      "/store/admin/orders",
      {
        params,
      }
    );
    return res;
  }

  async adminGetStoreOrder(order_id: string) {
    const res = await axios.get<
      { data: StoreOrderWithStripeSession } & ConductorBaseResponse
    >(`/store/admin/orders/${order_id}`);
    return res;
  }

  async adminResubmitPrintJob(order_id: string) {
    const res = await axios.post<
      { data: StoreOrderWithStripeSession } & ConductorBaseResponse
    >(`/store/admin/orders/${order_id}/resubmit`);
    return res;
  }

  // Central Identity
  async getCentralIdentityOrgs({
    activePage,
    limit,
    query,
  }: {
    activePage?: number;
    limit?: number;
    query?: string;
  } = {}) {
    const res = await axios.get<
      {
        orgs: CentralIdentityOrg[];
        totalCount: number;
      } & ConductorBaseResponse
    >("/central-identity/orgs", {
      params: {
        activePage,
        limit,
        query,
      },
    });
    return res;
  }

  async getCentralIdentityOrg({ orgId }: { orgId: string }) {
    const res = await axios.get<
      {
        org: CentralIdentityOrg;
      } & ConductorBaseResponse
    >(`/central-identity/orgs/${orgId}`);
    return res;
  }

  async postCentralIdentityOrg({
    name,
    logo,
    systemId,
  }: {
    name: string;
    logo?: string;
    systemId?: number;
  }) {
    const res = await axios.post<
      {
        org: CentralIdentityOrg;
      } & ConductorBaseResponse
    >("/central-identity/orgs", {
      name,
      logo,
      systemId,
    });
    return res;
  }

  async patchCentralIdentityOrg({
    orgId,
    name,
  }: {
    orgId: number;
    name?: string;
  }) {
    const res = await axios.patch<
      {
        org: CentralIdentityOrg;
      } & ConductorBaseResponse
    >(`/central-identity/orgs/${orgId}`, {
      name,
    });
    return res;
  }

  async getCentralIdentityOrgAdmins(orgId: number | string) {
    const res = await axios.get<
      {
        admins: CentralIdentityOrgAdminResult[];
      } & ConductorBaseResponse
    >(`/central-identity/orgs/${orgId}/admins`);
    return res;
  }

  async getCentralIdentitySystems({
    activePage,
    limit,
  }: {
    activePage?: number;
    limit?: number;
  } = {}) {
    const res = await axios.get<
      {
        systems: CentralIdentitySystem[];
        totalCount: number;
      } & ConductorBaseResponse
    >("/central-identity/systems", {
      params: {
        activePage,
        limit,
      },
    });
    return res;
  }

  async postCentralIdentitySystem({
    name,
    logo,
  }: {
    name: string;
    logo?: string;
  }) {
    const res = await axios.post<
      {
        system: CentralIdentitySystem;
      } & ConductorBaseResponse
    >("/central-identity/systems", {
      name,
      logo,
    });
    return res;
  }

  async getCentralIdentitySystem({ systemId }: { systemId: string }) {
    const res = await axios.get<
      {
        system: CentralIdentitySystem;
      } & ConductorBaseResponse
    >(`/central-identity/systems/${systemId}`);
    return res;
  }

  async putCentralIdentitySystem({
    systemId,
    name,
    logo,
  }: {
    systemId: string;
    name?: string;
    logo?: string;
  }) {
    const res = await axios.put<
      {
        system: CentralIdentitySystem[];
      } & ConductorBaseResponse
    >(`/central-identity/systems/${systemId}`, {
      name,
      logo,
    });
    return res;
  }

  async getCentralIdentityADAPTOrgs({
    activePage,
    limit,
    query,
  }: {
    activePage?: number;
    limit?: number;
    query?: string;
  }) {
    const res = await axios.get<
      {
        orgs: string[];
        totalCount: number;
      } & ConductorBaseResponse
    >("/central-identity/adapt-orgs", {
      params: {
        activePage,
        limit,
        query,
      },
    });
    return res;
  }

  async getCentralIdentityApps() {
    const res = await axios.get<
      {
        applications: CentralIdentityApp[];
      } & ConductorBaseResponse
    >("/central-identity/apps");
    return res;
  }

  async getCentralIdentityPublicApps() {
    return await axios.get<{ applications: CentralIdentityApp[] }>(
      "/central-identity/public/apps"
    );
  }

  async getCentralIdentityLicenses() {
    const res = await axios.get<
      {
        licenses: CentralIdentityLicense[];
      } & ConductorBaseResponse
    >("/central-identity/licenses");
    return res;
  }

  async getCentralIdentityUsers({
    page,
    limit,
    query,
    sort,
    academy_online,
    admin_role,
  }: {
    page?: number;
    limit?: number;
    query?: string;
    sort?: string;
    academy_online?: number[];
    admin_role?: string[];
  }) {
    const res = await axios.get<
      {
        total: number;
        users: CentralIdentityUser[];
      } & ConductorBaseResponse
    >("/central-identity/users", {
      params: {
        ...(page ? { page } : {}),
        ...(limit ? { limit } : {}),
        ...(query ? { query } : {}),
        ...(sort ? { sort } : {}),
        ...(academy_online ? { academy_online } : {}),
        ...(admin_role ? { admin_role } : {}),
      },
    });
    return res;
  }

  async getCentralIdentityServices({
    activePage,
    limit,
    query,
    sort,
  }: {
    activePage?: number;
    limit?: number;
    query?: string;
    sort?: string;
  }) {
    const res = await axios.get<
      {
        services: CentralIdentityService[];
        totalCount: number;
      } & ConductorBaseResponse
    >("/central-identity/services", {
      params: {
        ...(activePage ? { activePage } : {}),
        ...(limit ? { limit } : {}),
        ...(query ? { query } : {}),
        ...(sort ? { sort } : {}),
      },
    });
    return res;
  }

  async updateCentralIdentityService(body: { body: string }, id: number) {
    const res = await axios.put<ConductorBaseResponse>(
      `/central-identity/services/${id}`,
      body
    );

    return res;
  }

  async getCentralIdentityVerificationRequests(queryParams: {
    page?: number;
    limit?: number;
    status?: "open" | "closed";
  }) {
    const res = await axios.get<
      {
        requests: CentralIdentityVerificationRequest[];
        totalCount: number;
      } & ConductorBaseResponse
    >("/central-identity/verification-requests", {
      params: queryParams,
    });
    return res;
  }

  async getCentralIdentityUser(uuid: string) {
    const res = await axios.get<
      {
        user: CentralIdentityUser;
      } & ConductorBaseResponse
    >(`/central-identity/users/${uuid}`);
    return res;
  }

  async getCentralIdentityUserApplications(uuid: string) {
    const res = await axios.get<
      {
        applications: CentralIdentityApp[];
      } & ConductorBaseResponse
    >(`/central-identity/users/${uuid}/applications`);
    return res;
  }

  async updateCentralIdentityUser(
    uuid: string,
    data: Partial<CentralIdentityUser>
  ) {
    const res = await axios.patch<
      {
        user: CentralIdentityUser;
      } & ConductorBaseResponse
    >(`/central-identity/users/${uuid}`, data);
    return res;
  }

  async changeCentralIdentityUserEmail(uuid: string, email: string) {
    const res = await axios.put<
      {
        user: CentralIdentityUser;
      } & ConductorBaseResponse
    >(`/central-identity/users/${uuid}/email`, { email });
    return res;
  }

  async disableCentralIdentityUser(uuid: string, reason: string) {
    const res = await axios.patch<ConductorBaseResponse>(
      `/central-identity/users/${uuid}/disable`,
      { reason }
    );
    return res;
  }

  async deleteCentralIdentityUser(uuid: string) {
    const res = await axios.delete<ConductorBaseResponse>(
      `/central-identity/users/${uuid}`
    );
    return res;
  }

  async reEnableCentralIdentityUser(uuid: string) {
    const res = await axios.patch<ConductorBaseResponse>(
      `/central-identity/users/${uuid}/re-enable`
    );
    return res;
  }

  async updateCentralIdentityUserOrgs(
    uuid: string,
    orgs: Array<string | number>
  ) {
    const res = await axios.post<ConductorBaseResponse>(
      `/central-identity/users/${uuid}/orgs`,
      { orgs }
    );
    return res;
  }

  async updateCentralIdentityUserOrgAdminRole(
    uuid: string,
    orgId: string | number,
    admin_role: string
  ) {
    const res = await axios.patch<ConductorBaseResponse>(
      `/central-identity/users/${uuid}/orgs/${orgId}/admin-role`,
      { admin_role }
    );
    return res;
  }

  async updateCentralIdentityUserAcademyOnlineAccess(
    uuid: string,
    data: EditAcademyOnlineAccessFormValues
  ) {
    const res = await axios.patch<
      {
        user: CentralIdentityUser;
      } & ConductorBaseResponse
    >(`/central-identity/users/${uuid}/academy-online`, data);
    return res;
  }

  async getCentralIdentityUserAppLicenses(uuid: string) {
    const res = await axios.get<
      {
        licenses: CentralIdentityUserLicenseResult[];
      } & ConductorBaseResponse
    >(`/central-identity/users/${uuid}/app-licenses`);
    return res;
  }

  async grantCentralIdentityAppLicense(data: {
    user_id?: string;
    org_id?: string;
    application_license_id: string;
  }) {
    const res = await axios.post<
      {
        entity_id: string;
        application_license_id: string;
      } & ConductorBaseResponse
    >("/central-identity/app-licenses/grant", data);
    return res;
  }

  async revokeCentralIdentityAppLicense(
    // Either user_id or org_id must be present, but not both
    data: { user_id?: string; org_id?: string; application_license_id: string }
  ) {
    const res = await axios.post<
      {
        entity_id: string;
        application_license_id: string;
      } & ConductorBaseResponse
    >("/central-identity/app-licenses/revoke", data);
    return res;
  }

  async bulkGenerateCentralIdentityAppLicenseAccessCodes(
    application_license_id: string,
    quantity: number
  ) {
    const res = await axios.post(
      `/central-identity/app-licenses/${application_license_id}/bulk-generate`,
      {
        quantity,
      }
    );
    return res;
  }

  async getCentralIdentityAvailableAppLicenses() {
    const res = await axios.get<
      {
        licenses: CentralIdentityAppLicense[];
      } & ConductorBaseResponse
    >("/central-identity/app-licenses");
    return res;
  }

  // Client Config
  async getClientConfig() {
    return await axios.get<{ data: ClientConfig } & ConductorBaseResponse>(
      "/config"
    );
  }

  // Commons
  async getCommonsCatalog(params?: {
    activePage?: number;
    limit?: number;
    seed?: number;
  }) {
    return await axios.get<
      {
        books: BookWithAutoMatched[];
        numTotal: number;
        hasMore: boolean;
        seed: number;
      } & ConductorBaseResponse
    >("/commons/catalog", { params });
  }

  async getMasterCatalog(params?: { search?: string; sort?: string }) {
    return await axios.get<
      {
        books: Book[];
      } & ConductorBaseResponse
    >("/commons/mastercatalog", { params });
  }

  async getMasterCatalogV2() {
    return await axios.get<MasterCatalogV2Response & ConductorBaseResponse>(
      "/commons/mastercatalog/v2"
    );
  }

  async syncWithLibraries() {
    return await axios.post<{ msg: string } & ConductorBaseResponse>(
      "/commons/syncwithlibs"
    );
  }

  async enableBookOnCommons(bookID: string) {
    return await axios.put<ConductorBaseResponse>(
      `/commons/catalogs/addresource`,
      {
        bookID,
      }
    );
  }

  async disableBookOnCommons(bookID: string) {
    return await axios.put<ConductorBaseResponse>(
      `/commons/catalogs/removeresource`,
      { bookID }
    );
  };

  async excludeBookFromAutoCatalogMatching(bookID: string) {
    return await axios.put<ConductorBaseResponse>(
      `/commons/catalogs/exclude-auto-match`,
      { bookID }
    );
  };

  // Harvest Requests
  async createHarvestRequest(data: HarvestRequest) {
    const res = await axios.post<ConductorBaseResponse>(
      "/harvestingrequest",
      data
    );
    return res;
  }

  // Search
  async getAutoCompleteSuggestions(query: string, limit?: number) {
    const res = await axios.get<
      { numResults: number; results: string[] } & ConductorBaseResponse
    >("/search/autocomplete", {
      params: {
        query,
        limit,
      },
    });
    return res;
  }

  async getAssetFilterOptions() {
    const res = await axios.get<
      {
        licenses: string[];
        orgs: string[];
        fileTypes: string[];
        people: ProjectFileAuthor[];
        customFilters: CustomFilter[];
      } & ConductorBaseResponse
    >("/search/asset-filters");
    return res;
  }

  async getAuthorFilterOptions() {
    const res = await axios.get<
      {
        primaryInstitutions: string[];
      } & ConductorBaseResponse
    >("/search/author-filters");
    return res;
  }

  async getProjectFilterOptions() {
    const res = await axios.get<
      {
        statuses: string[];
      } & ConductorBaseResponse
    >("/search/project-filters");
    return res;
  }

  async assetsSearch(params: AssetSearchParams) {
    const res = await axios.get<
      ConductorSearchResponse<"assets"> & ConductorBaseResponse
    >("/search/assets", {
      params: {
        ...params,
      },
    });
    return res;
  }

  async authorsSearch(params: AuthorSearchParams) {
    const res = await axios.get<
      ConductorSearchResponse<"authors"> & ConductorBaseResponse
    >("/search/authors", {
      params: {
        ...params,
      },
    });
    return res;
  }

  async booksSearch(params: BookSearchParams) {
    const res = await axios.get<
      ConductorSearchResponse<"books"> & ConductorBaseResponse
    >("/search/books", {
      params: {
        ...params,
      },
    });
    return res;
  }

  async homeworkSearch(params: HomeworkSearchParams) {
    const res = await axios.get<
      ConductorSearchResponse<"homework"> & ConductorBaseResponse
    >("/search/homework", {
      params: {
        ...params,
      },
    });
    return res;
  }

  async miniReposSearch(params: MiniRepoSearchParams) {
    const res = await axios.get<
      ConductorSearchResponse<"minirepos"> & ConductorBaseResponse
    >("/search/minirepos", {
      params: {
        ...params,
      },
    });
    return res;
  }

  async projectsSearch(params: ProjectSearchParams) {
    const res = await axios.get<
      ConductorSearchResponse<"projects"> & ConductorBaseResponse
    >("/search/projects", {
      params: {
        ...params,
      },
    });
    return res;
  }

  async usersSearch(params: UserSearchParams) {
    const res = await axios.get<
      ConductorSearchResponse<"users"> & ConductorBaseResponse
    >("/search/users", {
      params: {
        ...params,
      },
    });
    return res;
  }

  // Libraries
  async getLibraries() {
    const res = await axios.get<
      {
        libraries: Library[];
      } & ConductorBaseResponse
    >("/commons/libraries");
    return res;
  }

  async getLibraryFromSubdomain(subdomain: string, includeHidden?: boolean) {
    const res = await axios.get<
      {
        library: Library;
      } & ConductorBaseResponse
    >(`/commons/libraries/${subdomain}`, {
      params: {
        includeHidden,
      },
    });
    return res;
  }

  // Organization
  async updateOrganization(orgID: string, data: Partial<Organization>) {
    const res = await axios.put<
      { updatedOrg: Organization } & ConductorBaseResponse
    >(`/org/${orgID}`, data);
    return res;
  }

  async updateAutomaticCatalogMatchingSettings(
    orgID: string,
    params: {
      autoCatalogMatchingEnabled: boolean;
    }
  ) {
    const res = await axios.patch<ConductorBaseResponse>(
      `/org/${orgID}/automatic-catalog-matching`,
      params
    );
    return res;
  }

  //Projects
  async getAddableTeamMembers(params: {
    projectID: string;
    searchString: string;
    includeOutsideOrg: boolean;
    page?: number;
    limit?: number;
  }) {
    const queryParams = new URLSearchParams({
      search: params.searchString,
      includeOutsideOrg: params.includeOutsideOrg.toString(),
      page: params.page?.toString() || "1",
      limit: params.limit?.toString() || "20",
    });
    const res = await axios.get<
      { users: AddableProjectTeamMember[] } & ConductorBaseResponse
    >(`/project/${params.projectID}/team/addable?${queryParams}`);

    return res;
  }

  async reSyncProjectTeamBookAccess(projectID: string) {
    const res = await axios.put<ConductorBaseResponse>(
      `/project/${projectID}/team/re-sync`
    );
    return res;
  }

  async getPinnedProjects() {
    const res = await axios.get<
      {
        pinned: NonNullable<User["pinnedProjects"]>;
      } & ConductorBaseResponse
    >("/projects/pinned");
    return res;
  }

  async getUserProjects() {
    const res = await axios.get<
      {
        projects: Project[];
      } & ConductorBaseResponse
    >("/projects/all");
    return res;
  }

  async updateUserPinnedProjects(
    data:
      | {
          action: "add-project" | "move-project";
          folder: string;
          projectID: string;
        }
      | {
          action: "remove-project";
          projectID: string;
        }
      | {
          action: "add-folder" | "remove-folder";
          folder: string;
        }
  ) {
    const res = await axios.patch<ConductorBaseResponse>(
      "/user/projects/pinned",
      data
    );
    return res;
  }

  async getPublicProjects(params?: { page?: number; limit?: number }) {
    const res = await axios.get<
      {
        projects: Project[];
        totalCount: number;
      } & ConductorBaseResponse
    >("/projects/public", {
      params,
    });
    return res;
  }
  async getProject(projectID: string) {
    const res = await axios.get<
      {
        project: Project;
      } & ConductorBaseResponse
    >("/project", {
      params: {
        projectID,
      },
    });
    return res;
  }

  async updateProject(project: Pick<Project, "projectID"> & Partial<Project>) {
    const res = await axios.put<ConductorBaseResponse>("/project", project);
    return res;
  }

  async deleteProject(projectID: string) {
    const res = await axios.delete(`/project/${projectID}`);
    return res;
  }

  async getProjectBatchUpdateJobs(projectID: string) {
    return await axios.get<
      {
        project_id: string;
        batch_update_jobs: ProjectBookBatchUpdateJob[];
      } & ConductorBaseResponse
    >(`/project/${projectID}/batch-update-jobs`);
  }

  async uploadProjectThumbnail(projectID: string, formData: FormData) {
    const res = await axios.put(`/project/${projectID}/thumbnail`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return res;
  }

  async getTags() {
    const res = await axios.get<{ tags: ProjectTag[] } & ConductorBaseResponse>(
      "projects/tags/org"
    );
    return res;
  }

  async getCIDDescriptors(detailed?: boolean) {
    const res = await axios.get<
      {
        descriptors: CIDDescriptor[];
      } & ConductorBaseResponse
    >("/c-ids", {
      params: {
        detailed,
      },
    });
    return res;
  }

  async getProjectFiles(
    projectID: string,
    folderID?: string,
    publicOnly = false
  ) {
    const res = await axios.get<
      {
        files: ProjectFile[];
        path: { fileID: string; name: string }[];
      } & ConductorBaseResponse
    >(`/project/${projectID}/files/content/${folderID ? folderID : ""}`, {
      params: {
        ...(publicOnly ? { publicOnly } : {}),
      },
    });
    return res;
  }
  async getProjectFile(projectID: string, fileID: string) {
    const res = await axios.get<
      {
        file: ProjectFile;
        videoStreamURL?: string;
      } & ConductorBaseResponse
    >(`/project/${projectID}/files/${fileID}`);
    return res;
  }

  async getFileDownloadURL(
    projectID: string,
    fileID: string,
    shouldIncrement?: boolean
  ) {
    const res = await axios.get<
      {
        url: string;
      } & ConductorBaseResponse
    >(`/project/${projectID}/files/${fileID}/download`, {
      params: {
        shouldIncrement,
      },
    });
    return res;
  }

  async bulkDownloadFiles(
    projectID: string,
    fileIDs: string[],
    emailToNotify: string
  ) {
    const arrQuery = fileIDs.map((id) => `fileID=${id}`).join(`&`);
    const res = await axios.get<{ file?: string } & ConductorBaseResponse>(
      `/project/${projectID}/files/bulk`,
      {
        params: {
          fileIDs: arrQuery,
          emailToNotify,
        },
      }
    );
    return res;
  }

  async bulkUpdateProjectFiles(
    projectID: string,
    fileIDs: string[],
    data: {
      tags: AssetTag[];
      tagMode: "replace" | "append";
    }
  ) {
    return await axios.patch<{ files: ProjectFile[] } & ConductorBaseResponse>(
      `/project/${projectID}/files/bulk`,
      {
        fileIDs,
        ...data,
      }
    );
  }

  async getPublicProjectFiles(params?: { page?: number; limit?: number }) {
    const res = await axios.get<
      {
        files: ConductorSearchResponseFile[];
        totalCount: number;
      } & ConductorBaseResponse
    >("/projects/files/public", {
      params,
    });
    return res;
  }

  async requestProjectPublishing(projectID: string) {
    const res = await axios.post<ConductorBaseResponse>("/project/publishing", {
      projectID,
    });
    return res;
  }

  // Knowledge Base
  async getKBOEmbed(url: string) {
    const res = await axios.get<{ oembed: string } & ConductorBaseResponse>(
      "/kb/oembed",
      {
        params: { url },
      }
    );
    return res;
  }

  // Support
  async getSupportQueues({ withCount }: { withCount?: boolean } = {}) {
    const res = await axios.get<
      {
        queues: SupportQueue[];
      } & ConductorBaseResponse
    >("/support-queues", {
      params: {
        ...(withCount ? { with_count: withCount } : {}),
      },
    });
    return res;
  }

  async getSupportQueueMetrics(slug: string) {
    const res = await axios.get<
      {
        metrics: SupportQueueMetrics;
      } & ConductorBaseResponse
    >(`/support-queues/${slug}/metrics`);
    return res;
  }

  async deleteTicket(ticketID: string) {
    const res = await axios.delete<ConductorBaseResponse>(
      `/support/ticket/${ticketID}`
    );
    return res;
  }

  async bulkUpdateTickets({
    tickets,
    assignee,
    priority,
    status,
    queue,
  }: {
    tickets: string[];
    assignee?: string[];
    priority?: string;
    status?: string;
    queue?: string;
  }) {
    return await axios.patch<{ updated_count: number } & ConductorBaseResponse>(
      `/support/ticket/bulk-update`,
      {
        tickets,
        assignee,
        priority,
        status,
        queue,
      }
    );
  }

  async getTicketAttachmentURL(
    ticketID: string,
    attachmentID: string,
    guestAccessKey?: string
  ) {
    const res = await axios.get<
      {
        url: string;
      } & ConductorBaseResponse
    >(`/support/ticket/${ticketID}/attachments/${attachmentID}`, {
      params: {
        ...(guestAccessKey ? { accessKey: guestAccessKey } : {}),
      },
    });
    return res;
  }

  async createProjectFromHarvestingRequest(ticketID: string) {
    return await axios.post<
      {
        project: Project;
      } & ConductorBaseResponse
    >(`/support/ticket/${ticketID}/create-project-from-harvesting-request`);
  }

  // Commons Collections
  async getCollection(collectionIDOrTitle: string) {
    return await axios.get<
      {
        collection: Collection;
      } & ConductorBaseResponse
    >(`/commons/collection/${encodeURIComponent(collectionIDOrTitle)}`);
  }

  async getCollectionResources({
    collIDOrTitle,
    limit,
    page,
    query,
    sort,
  }: {
    collIDOrTitle?: string;
    limit?: number;
    page?: number;
    query?: string | null;
    sort?: string;
  }) {
    return await axios.get<
      {
        resources: CollectionResource[];
        total_items: number;
        cursor?: number;
      } & ConductorBaseResponse
    >(
      `/commons/collection/${encodeURIComponent(
        collIDOrTitle ?? ""
      )}/resources`,
      {
        params: {
          page,
          limit,
          sort,
          query,
        },
      }
    );
  }

  async getCommonsCollections({
    limit,
    page,
    query,
    sort,
    sortDirection,
  }: {
    limit?: number;
    page?: number;
    query?: string | null;
    sort?: string;
    sortDirection?: SortDirection;
  }) {
    return await axios.get<
      {
        collections: Collection[];
        total_items: number;
        cursor?: number;
      } & ConductorBaseResponse
    >(`/commons/collections`, {
      params: {
        limit,
        page,
        query,
        sort,
        sortDirection,
      },
    });
  }

  async getAllCollections({
    limit,
    page,
    query,
    sort,
    sortDirection,
  }: {
    limit?: number;
    page?: number;
    query?: string | null;
    sort?: string;
    sortDirection?: SortDirection;
  }) {
    return await axios.get<
      {
        collections: Collection[];
        total_items: number;
      } & ConductorBaseResponse
    >(`/commons/collections/all`, {
      params: {
        limit,
        page,
        query,
        sort,
        sortDirection,
      },
    });
  }

  async deleteCollection(id: string) {
    return await axios.delete<ConductorBaseResponse>(
      `/commons/collection/${id}`
    );
  }

  async deleteCollectionResource(collID: string, resourceID: string) {
    return await axios.delete<ConductorBaseResponse>(
      `/commons/collection/${collID}/resources/${resourceID}`
    );
  }

  // SUPPORT
  async getSupportTicket(ticketID: string) {
    return await axios.get<
      {
        ticket: SupportTicket;
      } & ConductorBaseResponse
    >(`/support/ticket/${ticketID}`);
  }

  async getUserSupportTickets({
    uuid,
    queue,
    page,
    limit,
    sort,
  }: {
    uuid: string;
    queue?: string;
    page?: number;
    limit?: number;
    sort?: string;
  }) {
    return await axios.get<
      {
        tickets: SupportTicket[];
        total: number;
      } & ConductorBaseResponse
    >(`/support/user/${uuid}/tickets`, {
      params: {
        queue,
        page,
        limit,
        sort,
      },
    });
  }

  async getSupportAssignableUsers() {
    return await axios.get<
      {
        users: Pick<
          User,
          "uuid" | "firstName" | "lastName" | "email" | "avatar"
        >[];
      } & ConductorBaseResponse
    >(`/support/assignable-users`);
  }

  async assignSupportTicket(ticketID: string, assigned: string[]) {
    return await axios.patch<ConductorBaseResponse>(
      `/support/ticket/${ticketID}/assign`,
      {
        assigned,
      }
    );
  }

  async addSupportTicketCC(ticketID: string, email: string) {
    return await axios.post<ConductorBaseResponse>(
      `/support/ticket/${ticketID}/cc`,
      {
        email,
      }
    );
  }

  async removeSupportTicketCC(ticketID: string, email: string) {
    return await axios.delete<ConductorBaseResponse>(
      `/support/ticket/${ticketID}/cc`,
      {
        data: {
          email,
        },
      }
    );
  }

  // USERS (Control Panel)
  async getUsers(params: {
    query?: string;
    page?: number;
    limit?: number;
    sort?: string;
  }) {
    return await axios.get<
      {
        results: User[];
        total_items: number;
      } & ConductorBaseResponse
    >("/users", {
      params,
    });
  }

  async getUserCentralID(uuid: string) {
    const res = await axios.get<
      {
        centralID: string | null;
      } & ConductorBaseResponse
    >(`/user/${uuid}/central-id`);
    return res.data;
  }

  async getUserFromCentralID(centralID: string) {
    const res = await axios.get<
      {
        uuid: string;
      } & ConductorBaseResponse
    >(`/user/from-central-id/${centralID}`);
    return res.data;
  }

  // Project Invitations
  async createProjectInvitation(
    projectID: string,
    email: string,
    role: string
  ) {
    const res = await axios.post<
      {
        responseInvitation: BaseInvitation;
      } & ConductorBaseResponse
    >(`/project-invitations/${projectID}`, {
      email,
      role,
    });
    return res.data;
  }

  async getAllProjectInvitations(
    projectID: string,
    page: number = 1,
    limit: number
  ) {
    const res = await axios.get<
      {
        data: InvitationsResponse;
      } & ConductorBaseResponse
    >(`/project-invitations/project/${projectID}`, {
      params: { page, limit },
    });
    return res.data;
  }

  async getProjectInvitation(inviteID: string, token: string | null) {
    const res = await axios.get<
      {
        invitation: BaseInvitation & { sender: Sender } & {
          project: ProjectSummary;
        };
      } & ConductorBaseResponse
    >(`/project-invitations/${inviteID}`, {
      params: { token },
    });
    return res.data;
  }

  async deleteInvitation(invitationId: string) {
    const res = await axios.delete<
      {
        deleted: boolean;
      } & ConductorBaseResponse
    >(`/project-invitations/${invitationId}`);

    return res.data;
  }

  async updateInvitationRole(inviteID: string, role: string) {
    const res = await axios.put<
      {
        updatedInvitation: BaseInvitation;
      } & ConductorBaseResponse
    >(`/project-invitations/${inviteID}/update`, { role });

    return res.data;
  }

  async acceptProjectInvitation(inviteID: string | null, token: string | null) {
    const res = await axios.post<
      {
        data: string;
      } & ConductorBaseResponse
    >(
      `/project-invitation/${inviteID}/accept`,
      {},
      {
        params: { token },
      }
    );

    return res.data;
  }

  // Library access
  async checkTeamLibraryAccess(applicationId: string | number, ids: string[]) {
    const res = await axios.post<
      {
        accessResults: { id: string; hasAccess: boolean }[];
      } & ConductorBaseResponse
    >(`/central-identity/users/applications/${applicationId}`, {
      ids,
    });
    return res;
  }

  // user manager
  async deleteUserRole(orgID: string, uuid: string) {
    const res = await axios.delete<ConductorBaseResponse>(`/user/role/delete`, {
      data: {
        orgID,
        uuid,
      },
    });
    return res;
  }

  // User Notes
  async getUserNotes(userID: string, page: number = 1, limit: number = 25) {
    const res = await axios.get<
      {
        notes: Note[];
        total: number;
        has_more: boolean;
      } & ConductorBaseResponse
    >(`/central-identity/users/${userID}/notes`, {
      params: {
        page,
        limit,
      },
    });
    return res;
  }

  async createUserNote(userID: string, note: string) {
    const res = await axios.post<
      {
        note: Note;
      } & ConductorBaseResponse
    >(`/central-identity/users/${userID}/notes`, { content: note });
    return res;
  }

  async updateUserNote(userID: string, noteID: string, note: string) {
    const res = await axios.patch<
      {
        note: Note;
      } & ConductorBaseResponse
    >(`/central-identity/users/${userID}/notes/${noteID}`, { content: note });
    return res;
  }

  async deleteUserNote(userID: string, noteID: string) {
    const res = await axios.delete<
      {
        note: Note;
      } & ConductorBaseResponse
    >(`/central-identity/users/${userID}/notes/${noteID}`);
    return res;
  }

  // Project Traffic Analytics
  async getProjectTrafficAnalyticsAggregatedMetricsByPage(
    params: TrafficAnalyticsBaseRequestParams,
    signal?: AbortSignal
  ) {
    const { projectID, ...rest } = params;
    return await axios.get<
      {
        data: TrafficAnalyticsAggregatedMetricsByPageDataPoint[];
      } & ConductorBaseResponse
    >(
      `/project/${projectID}/book/traffic-analytics/aggregated-metrics-by-page`,
      {
        params: rest,
        signal,
      }
    );
  }

  async getProjectTrafficAnalyticsPageViews(
    params: TrafficAnalyticsBaseRequestParams,
    signal?: AbortSignal
  ) {
    const { projectID, ...rest } = params;
    return await axios.get<
      {
        data: TrafficAnalyticsPageViewsDataPoint[];
      } & ConductorBaseResponse
    >(`/project/${projectID}/book/traffic-analytics/page-views`, {
      params: rest,
      signal,
    });
  }

  async getProjectTrafficAnalyticsUniqueVisitors(
    params: TrafficAnalyticsBaseRequestParams,
    signal?: AbortSignal
  ) {
    const { projectID, ...rest } = params;
    return await axios.get<
      {
        data: TrafficAnalyticsUniqueVisitorsDataPoint[];
      } & ConductorBaseResponse
    >(`/project/${projectID}/book/traffic-analytics/unique-visitors`, {
      params: rest,
      signal,
    });
  }

  async getProjectTrafficAnalyticsVisitorCountries(
    params: TrafficAnalyticsBaseRequestParams,
    signal?: AbortSignal
  ) {
    const { projectID, ...rest } = params;
    return await axios.get<
      {
        data: TrafficAnalyticsVisitorCountriesDataPoint[];
      } & ConductorBaseResponse
    >(`/project/${projectID}/book/traffic-analytics/visitor-countries`, {
      params: rest,
      signal,
    });
  }

  async getCheckoutSession(order_id: string) {
    const res = await axios.get<
      {
        data: {
          charge: OrderCharge;
          session: OrderSession;
        };
      } & ConductorBaseResponse
    >(`/store/checkout/session/${order_id}`);
    return res.data;
  }

  /**
   * Create a new agent session for LangGraph
   */
  async createAgentSession() {
    const res = await axios.post<
      {
        sessionId: string;
      } & ConductorBaseResponse
    >("/agent/create-session");

    return res.data;
  }

  async queryLangGraphAgent(query: string, sessionId: string) {
    const res = await axios.post<
      {
        response: string;
        sources: Array<{
          number: number;
          title: string;
          description: string;
          slug?: string;
          url: string;
          relevanceScore?: number;
          source: 'kb' | 'web';
        }>;
        query: string;
        timestamp: string;
      } & ConductorBaseResponse
    >("/agent/query-langgraph", {
      query,
      sessionId,
    });

    return res.data;
  }

}

export default new API();
