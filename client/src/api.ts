import axios from "axios";
import AuthHelper from "./components/util/AuthHelper";
import { AssetTagFramework, AssetTagFrameworkWithKeys, Book, ConductorBaseResponse, Homework, Project, ProjectFile, User } from "./types";
import { ProjectFileWProjectID } from "./types/Project";

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
    const res = await axios.get<{
      frameworks: AssetTagFramework[];
      totalCount: number;
    } & ConductorBaseResponse>("/assettagframeworks", {
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
    const res = await axios.get<{
      err: boolean;
      errMsg?: string;
      framework: AssetTagFrameworkWithKeys
    }>(`/assettagframeworks/${id}`);
    return res;
  }

  async createFramework(framework: AssetTagFramework) {
    const res = await axios.post<{
      err: boolean;
      errMsg?: string;
      framework: AssetTagFramework;
    }>("/assettagframeworks", framework);
    return res;
  }

  async updateFramework(framework: AssetTagFramework) {
    const res = await axios.patch<{
      err: boolean;
      errMsg?: string;
      framework: AssetTagFramework;
    }>(`/assettagframeworks/${framework.uuid}`, framework);
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
  }: {
    searchQuery: string;
    projLocation: string;
    projStatus: string;
    projVisibility: string;
    projSort: string;
    bookSort: string;
    hwSort: string;
    userSort: string;
  }) {
    const res = await axios.get<{
      numResults: number;
      results: {
        projects: Project[];
        books: Book[];
        files: ProjectFileWProjectID[];
        homework: Homework[];
        users: User[];
      };
    } & ConductorBaseResponse>("/search", {
      params: {
        searchQuery,
        projLocation,
        projStatus,
        projVisibility,
        projSort,
        bookSort,
        hwSort,
        userSort,
      }
    });
    return res;
  }
}

export default new API();
