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
  CentralIdentityLicense,
  CentralIdentityOrg,
  CentralIdentityUser,
  CentralIdentityVerificationRequest,
  CollectionResource,
  ConductorBaseResponse,
  ConductorSearchResponse,
  Homework,
  HomeworkSearchParams,
  PeerReview,
  Project,
  ProjectFile,
  ProjectSearchParams,
  User,
  UserSearchParams,
} from "./types";
import { CIDDescriptor, ProjectFileAuthor, ProjectTag } from "./types/Project";
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

  public cloudflareStreamUploadURL: string = `${import.meta.env.MODE === "development"
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

  async generateADAPTAccessCode() {
    const res = await axios.get<{
      access_code: string;
    } & ConductorBaseResponse>("/central-identity/adapt-access-code");
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

  async getCentralIdentityVerificationRequests(queryParams: { page?: number; limit?: number, status?: 'open' | 'closed' }) {
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
    const res = await axios.get<{ users: User[] } & ConductorBaseResponse>(
      `/project/${params.projectID}/team/addable?${queryParams}`
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
    const res = await axios.get("/project", {
      params: {
        projectID,
      },
    });
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
        cursor?: number
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
        cursor?: number
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
    return await axios.delete<ConductorBaseResponse>(`/commons/collection/${id}`);
  }

  async deleteCollectionResource(collID: string, resourceID: string) {
    return await axios.delete<ConductorBaseResponse>(`/commons/collection/${collID}/resources/${resourceID}`);
  }

  // USERS (Control Panel)
  async getUsers(params: {
    query?: string;
    page?: number;
    limit?: number;
    sort?: string;
  }) {
    return await axios.get<{
      results: User[];
      total_items: number;
    } & ConductorBaseResponse>("/users", {
      params
    });
  }
}

export default new API();
