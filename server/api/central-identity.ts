import conductorErrors from "../conductor-errors.js";
import { debugError } from "../debug.js";
import { Response } from "express";
import { param, body } from "express-validator";
import {
  CentralIdentityOrg,
  CentralIdentityService,
  CentralIdentitySystem,
  CentralIdentityUser,
  TypedReqParams,
  TypedReqParamsAndBody,
  TypedReqQuery,
} from "../types/index.js";
import { getPaginationOffset } from "../util/helpers.js";
import {
  conductor400Err,
  conductor404Err,
  conductor500Err,
  conductorErr,
} from "../util/errorutils.js";
import { useCentralIdentityAxios } from "../util/centralIdentity.js";
import { CentralIdentityApp } from "../types/CentralIdentity.js";

const centralIdentityAxios = useCentralIdentityAxios();

async function getUsers(
  req: TypedReqQuery<{ activePage?: number; limit?: number; query?: string }>,
  res: Response<{
    err: boolean;
    users: CentralIdentityUser[];
    totalCount: number;
  }>
) {
  try {
    let page = 1;
    let limit = req.query.limit || 25;
    if (
      req.query.activePage &&
      Number.isInteger(parseInt(req.query.activePage.toString()))
    ) {
      page = req.query.activePage;
    }
    const offset = getPaginationOffset(page, limit);

    const usersRes = await centralIdentityAxios.get("/users", {
      params: {
        offset,
        limit,
        query: req.query.query ? req.query.query : undefined,
      },
    });

    if (!usersRes.data || !usersRes.data.data || !usersRes.data.meta) {
      return conductor500Err(res);
    }

    return res.send({
      err: false,
      users: usersRes.data.data,
      totalCount: usersRes.data.meta.total,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getUser(
  req: TypedReqParams<{ id?: string }>,
  res: Response<{ err: boolean; user: CentralIdentityUser }>
) {
  try {
    if (!req.params.id) {
      return conductor400Err(res);
    }

    const userRes = await centralIdentityAxios.get(`/users/${req.params.id}`);

    if (!userRes.data || !userRes.data.data) {
      return conductor500Err(res);
    }

    return res.send({
      err: false,
      user: userRes.data.data,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function updateUser(
  req: TypedReqParamsAndBody<{ id?: string }, CentralIdentityUser>,
  res: Response<{ err: boolean; user: CentralIdentityUser }>
) {
  try {
    if (!req.params.id) {
      return conductor400Err(res);
    }

    const userRes = await centralIdentityAxios.patch(
      `/users/${req.params.id}`,
      req.body
    );

    if (!userRes.data) {
      return conductor500Err(res);
    }

    return res.send({
      err: false,
      user: userRes.data,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getUserApplications(
  req: TypedReqParams<{ id: string }>,
  res: Response<{ err: boolean; applications: CentralIdentityApp[] }>
) {
  try {
    const appsRes = await centralIdentityAxios.get(
      `/users/${req.params.id}/applications`
    );

    if (!appsRes.data || !appsRes.data.data) {
      return conductor500Err(res);
    }

    return res.send({
      err: false,
      applications: appsRes.data.data.applications,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getUserOrgs(
  req: TypedReqParams<{ id: string }>,
  res: Response<{ err: boolean; orgs: CentralIdentityOrg[] }>
) {
  try {
    const orgsRes = await centralIdentityAxios.get(
      `/users/${req.params.id}/organizations`
    );

    if (!orgsRes.data || !orgsRes.data.data) {
      return conductor500Err(res);
    }

    return res.send({
      err: false,
      orgs: orgsRes.data.data.organizations,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function addUserApplications(
  req: TypedReqParamsAndBody<
    { id: string },
    { applications: (string | number)[] }
  >,
  res: Response<{ err: boolean; applications: string[] }>
) {
  try {
    const parsedIds: string[] = req.body.applications.map((id) =>
      id.toString()
    );
    const promiseArr = parsedIds.map((id) =>
      centralIdentityAxios.post(`/users/${req.params.id}/applications`, {
        application_id: id,
      })
    );

    const results = await Promise.all(promiseArr);

    const parsedResults = results.map(
      (result) => result?.data?.data?.application_id?.toString() ?? ""
    );

    const addedApps = parsedResults
      .filter((id) => id !== "")
      .map((id) => id.toString() as string);

    return res.send({
      err: false,
      applications: addedApps,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function deleteUserApplication(
  req: TypedReqParams<{ id: string; applicationId: string }>,
  res: Response<{ err: boolean }>
) {
  try {
    const appRes = await centralIdentityAxios.delete(
      `/users/${req.params.id}/applications/${req.params.applicationId?.toString()}`
    );

    if (appRes.data.err || appRes.data.errMsg) {
      return conductor500Err(res);
    }

    return res.send({
      err: false,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function addUserOrgs(
  req: TypedReqParamsAndBody<{ id: string }, { orgs: (string | number)[] }>,
  res: Response<{ err: boolean; orgs: string[] }>
) {
  try {
    const parsedIds: string[] = req.body.orgs.map((id) => id.toString());
    const promiseArr = parsedIds.map((id) =>
      centralIdentityAxios.post(`/users/${req.params.id}/organizations`, {
        organization_id: id,
      })
    );

    const results = await Promise.all(promiseArr);

    const parsedResults = results.map(
      (result) => result?.data?.data?.organization_id?.toString() ?? ""
    );

    const addedOrgs = parsedResults
      .filter((id) => id !== "")
      .map((id) => id.toString() as string);

    return res.send({
      err: false,
      orgs: addedOrgs,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function deleteUserOrg(
  req: TypedReqParams<{ id: string; orgId: string }>,
  res: Response<{ err: boolean }>
) {
  try {
    const orgRes = await centralIdentityAxios.delete(
      `/users/${req.params.id}/organizations/${req.params.orgId?.toString()}`
    );

    if (orgRes.data.err || orgRes.data.errMsg) {
      return conductor500Err(res);
    }

    return res.send({
      err: false,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getApplications(
  req: TypedReqQuery<{ activePage?: number }>,
  res: Response<{
    err: boolean;
    applications: CentralIdentityApp[];
    totalCount: number;
  }>
) {
  try {
    let page = 1;
    let limit = 25;
    if (
      req.query.activePage &&
      Number.isInteger(parseInt(req.query.activePage.toString()))
    ) {
      page = req.query.activePage;
    }
    const offset = getPaginationOffset(page, limit);

    const appsRes = await centralIdentityAxios.get("/applications", {
      params: {
        offset,
        limit,
      },
    });

    if (!appsRes.data || !appsRes.data.data || !appsRes.data.meta) {
      return conductor500Err(res);
    }

    return res.send({
      err: false,
      applications: appsRes.data.data,
      totalCount: appsRes.data.meta.total,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getOrgs(
  req: TypedReqQuery<{ activePage?: number }>,
  res: Response<{
    err: boolean;
    orgs: CentralIdentityOrg[];
    totalCount: number;
  }>
) {
  try {
    let page = 1;
    let limit = 25;
    if (
      req.query.activePage &&
      Number.isInteger(parseInt(req.query.activePage.toString()))
    ) {
      page = req.query.activePage;
    }
    const offset = getPaginationOffset(page, limit);

    const orgsRes = await centralIdentityAxios.get("/organizations", {
      params: {
        offset,
        limit,
      },
    });

    if (!orgsRes.data || !orgsRes.data.data || !orgsRes.data.meta) {
      return conductor500Err(res);
    }

    return res.send({
      err: false,
      orgs: orgsRes.data.data,
      totalCount: orgsRes.data.meta.total,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getSystems(
  req: TypedReqQuery<{ activePage?: number }>,
  res: Response<{
    err: boolean;
    systems: CentralIdentitySystem[];
    totalCount: number;
  }>
) {
  try {
    let page = 1;
    let limit = 25;
    if (
      req.query.activePage &&
      Number.isInteger(parseInt(req.query.activePage.toString()))
    ) {
      page = req.query.activePage;
    }
    const offset = getPaginationOffset(page, limit);

    const orgsRes = await centralIdentityAxios.get("/organization-systems", {
      params: {
        offset,
        limit,
      },
    });

    if (!orgsRes.data || !orgsRes.data.data || !orgsRes.data.meta) {
      return conductor500Err(res);
    }

    return res.send({
      err: false,
      systems: orgsRes.data.data,
      totalCount: orgsRes.data.meta.total,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getServices(
  req: TypedReqQuery<{ activePage?: number }>,
  res: Response<{
    err: boolean;
    services: CentralIdentityService[];
    totalCount: number;
  }>
) {
  try {
    let page = 1;
    let limit = 25;
    if (
      req.query.activePage &&
      Number.isInteger(parseInt(req.query.activePage.toString()))
    ) {
      page = req.query.activePage;
    }
    const offset = getPaginationOffset(page, limit);

    const orgsRes = await centralIdentityAxios.get("/services", {
      params: {
        offset,
        limit,
      },
    });

    if (!orgsRes.data || !orgsRes.data.data || !orgsRes.data.meta) {
      return conductor500Err(res);
    }

    return res.send({
      err: false,
      services: orgsRes.data.data,
      totalCount: orgsRes.data.meta.total,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

/**
 * Middleware(s) to verify that requests contain necessary and/or valid fields.
 */
function validate(method: string) {
  switch (method) {
    case "getUsers": {
      return [
        param("activePage", conductorErrors.err1).optional().isInt(),
        param("limit", conductorErrors.err1).optional().isInt(),
        param("query", conductorErrors.err1).optional().isString(),
      ];
    }
    case "getUser": {
      return [param("id", conductorErrors.err1).exists().isUUID()];
    }
    case "getUserApplications": {
      return [param("id", conductorErrors.err1).exists().isUUID()];
    }
    case "getUserOrgs": {
      return [param("id", conductorErrors.err1).exists().isUUID()];
    }
    case "addUserApplications": {
      return [
        param("id", conductorErrors.err1).exists().isUUID(),
        body("applications", conductorErrors.err1).exists().isArray(),
      ];
    }
    case "deleteUserApplication": {
      return [
        param("id", conductorErrors.err1).exists().isUUID(),
        param("applicationId", conductorErrors.err1).exists().isAlphanumeric(),
      ];
    }
    case "addUserOrgs": {
      return [
        param("id", conductorErrors.err1).exists().isUUID(),
        body("orgs", conductorErrors.err1).exists().isArray(),
      ];
    }
    case "deleteUserOrg": {
      return [
        param("id", conductorErrors.err1).exists().isUUID(),
        param("orgId", conductorErrors.err1).exists().isAlphanumeric(),
      ];
    }
    case "updateUser": {
      return [param("id", conductorErrors.err1).exists().isUUID()];
    }
  }
}

export default {
  getUsers,
  getUser,
  getUserApplications,
  getUserOrgs,
  addUserApplications,
  deleteUserApplication,
  addUserOrgs,
  deleteUserOrg,
  getApplications,
  getOrgs,
  getSystems,
  getServices,
  updateUser,
  validate,
};
