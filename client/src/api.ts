import axios from "axios";
import {
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
  ConductorBaseResponse,
  ConductorSearchResponse,
  Homework,
  HomeworkSearchParams,
  Project,
  ProjectFile,
  ProjectSearchParams,
  User,
  UserSearchParams,
} from "./types";
import {
  CIDDescriptor,
  ProjectFileWProjectID,
  ProjectFileWProjectIDAndTitle,
  ProjectTag,
} from "./types/Project";

/**
 * @fileoverview
 * We don't create an Axios instance here because not all api calls
 * have been converted to use this class yet, but we still want global config to apply
 */

class API {
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
        author: Author;
      } & ConductorBaseResponse
    >(`/authors/${id}`);
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

  async getCentralIdentityLicenses() {
    const res = await axios.get<
      {
        licenses: CentralIdentityLicense[];
      } & ConductorBaseResponse
    >("/central-identity/licenses");
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

  async booksSearch(params: BookSearchParams) {
    console.log(params);
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

  async getProjectFiles(projectID: string, folderID?: string) {
    const res = await axios.get<
      {
        files: ProjectFile[];
        path: { fileID: string; name: string }[];
      } & ConductorBaseResponse
    >(`/project/${projectID}/files/content/${folderID ? folderID : ""}`);
    return res;
  }

  async getProjectFile(projectID: string, fileID: string) {
    const res = await axios.get<
      {
        file: ProjectFile;
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
        files: ProjectFileWProjectIDAndTitle[];
        totalCount: number;
      } & ConductorBaseResponse
    >("/projects/files/public", {
      params,
    });
    return res;
  }
}

export default new API();
