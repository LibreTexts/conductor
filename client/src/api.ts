import axios from "axios";
import {
  AssetTagFramework,
  Book,
  CentralIdentityLicense,
  CentralIdentityOrg,
  ConductorBaseResponse,
  Homework,
  Project,
  ProjectFile,
  User,
} from "./types";
import {
  CIDDescriptor,
  ProjectFileWProjectID,
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
        frameworks: AssetTagFramework[];
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
  async conductorSearch({
    searchQuery,
    projLocation,
    projStatus,
    projVisibility,
    projSort,
    bookSort,
    hwSort,
    userSort,
    activePage,
    limit,
  }: {
    searchQuery?: string;
    projLocation?: string;
    projStatus?: string;
    projVisibility?: string;
    projSort?: string;
    bookSort?: string;
    hwSort?: string;
    userSort?: string;
    activePage?: number;
    limit?: number;
  }) {
    const res = await axios.get<
      {
        numResults: number;
        results: {
          projects: Project[];
          books: Book[];
          files: ProjectFileWProjectID[];
          homework: Homework[];
          users: User[];
        };
      } & ConductorBaseResponse
    >("/search", {
      params: {
        searchQuery,
        projLocation,
        projStatus,
        projVisibility,
        projSort,
        bookSort,
        hwSort,
        userSort,
        activePage,
        limit,
      },
    });
    return res;
  }

  //Projects
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

  async bulkDownloadFiles(projectID: string, fileIDs: string[]) {
    const arrQuery = fileIDs.map((id) => `fileID=${id}`).join(`&`);
    const res = await axios.get<Blob>(`/project/${projectID}/files/bulk`, {
      params: {
        fileIDs: arrQuery,
      },
      responseType: "blob",
    });
    return res;
  }

  async getPublicProjectFiles(params?: { page?: number; limit?: number }) {
    const res = await axios.get<
      {
        files: ProjectFileWProjectID[];
      } & ConductorBaseResponse
    >("/projects/files/public", {
      params,
    });
    return res;
  }
}

export default new API();
