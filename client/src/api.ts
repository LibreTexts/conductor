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
  CentralIdentityUser,
  CentralIdentityVerificationRequest,
  CollectionResource,
  ConductorBaseResponse,
  ConductorSearchResponse,
  HarvestRequest,
  Homework,
  HomeworkSearchParams,
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
} from "./types";
import {
  AddableProjectTeamMember,
  CIDDescriptor,
  ProjectFileAuthor,
  ProjectTag,
} from "./types/Project";
import { Collection } from "./types/Collection";
import {
  AuthorSearchParams,
  ConductorSearchResponseFile,
  CustomFilter,
} from "./types/Search";
import { CloudflareCaptionData, SortDirection } from "./types/Misc";

/**
 * @fileoverview
 * We don't create an Axios instance here because not all api calls
 * have been converted to use this class yet, but we still want global config to apply
 */

class API {
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
      `/commons/pages/${pageID}?coverPageID=${coverPageID}?nonce=${nonce}`,
    );
    return res;
  }

  async getPageAISummary(pageID: string, coverPageID: string) {
    const res = await axios.get<
      {
        summary: string;
      } & ConductorBaseResponse
    >(`/commons/pages/${pageID}/ai-summary?coverPageID=${coverPageID}`);
    return res;
  }

  async getPageAITags(pageID: string, coverPageID: string) {
    const res = await axios.get<
      {
        tags: string[];
      } & ConductorBaseResponse
    >(`/commons/pages/${pageID}/ai-tags?coverPageID=${coverPageID}`);
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
    >(`/commons/pages/${pageID}/ai-alt-text?coverPageID=${coverPageID}`, {
      overwrite,
    });
    return res;
  }

  /**
   * Generates and applies AI-generated summaries, tags, or both, to all pages in a book
   * @param {string} bookID - the cover page of the book to apply the summaries to
   */
  async batchGenerateAIMetadata(
    bookID: string,
    summaries: { generate: boolean; overwrite: boolean },
    tags: { generate: boolean; overwrite: boolean },
    alttext: { generate: boolean; overwrite: boolean }
  ) {
    const res = await axios.post<ConductorBaseResponse>(
      `/commons/book/${bookID}/ai-metadata-batch`,
      {
        ...(summaries.generate ? { summaries } : {}),
        ...(tags.generate ? { tags } : {}),
        ...(alttext.generate ? { alttext } : {}),
      }
    );
    return res;
  }

  /**
   * Applies user-supplied summaries and tags to the respective pages in a book
   * @param {string} bookID - the cover page of the book to apply the metadata to
   * @param {Array<{ id: string; summary: string; tags: string[] }>} pages - the pages & data to update
   */
  async batchUpdateBookMetadata(
    bookID: string,
    pages: { id: string; summary: string; tags: string[] }[]
  ) {
    const res = await axios.post<{ msg: string } & ConductorBaseResponse>(
      `/commons/book/${bookID}/update-metadata-batch`,
      {
        pages,
      }
    );
    return res;
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
    >(`/commons/book/${bookID}/page-tags`, {
      pages,
    });
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
  }) {
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
  }: {
    page?: number;
    limit?: number;
    query?: string;
    sort?: string;
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
      },
    });
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

  // Commons
  async getCommonsCatalog(paramsObj?: { activePage?: number; limit?: number }) {
    const res = await axios.get<
      {
        books: Book[];
        numFound: number;
        numTotal: number;
      } & ConductorBaseResponse
    >("/commons/catalog", {
      params: paramsObj,
    });
    return res;
  }

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
  async deleteTicket(ticketID: string) {
    const res = await axios.delete<ConductorBaseResponse>(
      `/support/ticket/${ticketID}`
    );
    return res;
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
    >(
      `/central-identity/users/applications/${applicationId}`, {
        ids
      }
    );
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
}

export default new API();
