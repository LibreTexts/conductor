import axios from "axios";
import AuthHelper from "./components/util/AuthHelper";
import { AssetTagFramework } from "./types";

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
    query
  }: {
    page?: number;
    limit?: number;
    sort?: string;
    query?: string;
  }) {
    const res = await axios.get<{
      frameworks: AssetTagFramework[];
      err: boolean;
      errMsg?: string;
      totalCount: number;
    }>("/assettagframeworks", {
      params: {
        page,
        limit,
        sort,
        query
      },
    });
    return res;
  }

  async getFramework(id: string) {
    const res = await axios.get<{
      err: boolean;
      errMsg?: string;
      framework: AssetTagFramework;
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
}

export default new API();
