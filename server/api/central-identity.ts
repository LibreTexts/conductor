import conductorErrors from "../conductor-errors.js";
import { debugError } from "../debug.js";
import { Request, Response } from "express";
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
import {
  isCentralIdentityVerificationRequestStatus,
  useCentralIdentityAxios,
} from "../util/centralIdentity.js";
import {
  CentralIdentityApp,
  CentralIdentityVerificationRequest,
  CentralIdentityVerificationRequestStatus,
} from "../types";
import { CentralIdentityLicense, CentralIdentityUpdateVerificationRequestBody } from "../types/CentralIdentity.js";

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

    const usersRes = await useCentralIdentityAxios(false).get("/users", {
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

    const userRes = await useCentralIdentityAxios(false).get(`/users/${req.params.id}`);

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

    const userRes = await useCentralIdentityAxios(false).patch(
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
    const appsRes = await useCentralIdentityAxios(false).get(
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
    const orgsRes = await useCentralIdentityAxios(false).get(
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
    useCentralIdentityAxios(false).post(`/users/${req.params.id}/applications`, {
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
    const appRes = await useCentralIdentityAxios(false).delete(
      `/users/${
        req.params.id
      }/applications/${req.params.applicationId?.toString()}`
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
    useCentralIdentityAxios(false).post(`/users/${req.params.id}/organizations`, {
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
    const orgRes = await useCentralIdentityAxios(false).delete(
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

async function getApplicationsPriveledged(
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

    const appsRes = await useCentralIdentityAxios(false).get("/applications", {
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

async function getApplicationsPublic(
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

    const appsRes = await useCentralIdentityAxios().get("/applications", {
      params: {
        offset,
        limit,
      }
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
  req: TypedReqQuery<{ activePage?: number, limit?: number, query?: string }>,
  res: Response<{
    err: boolean;
    orgs: CentralIdentityOrg[];
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

    const orgsRes = await useCentralIdentityAxios(false).get("/organizations", {
      params: {
        offset,
        limit,
        query: req.query.query ? req.query.query : undefined,
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

    const orgsRes = await useCentralIdentityAxios(false).get("/organization-systems", {
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

    const orgsRes = await useCentralIdentityAxios(false).get("/services", {
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

async function getVerificationRequests(
  req: TypedReqQuery<{
    activePage?: number;
    limit?: number;
    status?: CentralIdentityVerificationRequestStatus;
  }>,
  res: Response<{
    err: boolean;
    requests: CentralIdentityVerificationRequest[];
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

    const requestsRes = await useCentralIdentityAxios(false).get(
      "/verification-requests",
      {
        params: {
          offset,
          limit,
          status: req.query.status ? req.query.status : undefined,
        },
      }
    );

    if (!requestsRes.data || !requestsRes.data.data || !requestsRes.data.meta) {
      return conductor500Err(res);
    }

    // TODO: This is a temporary fix until the backend is updated to return the user object
    for (const rec of requestsRes.data.data) {
      rec.user = (
        await useCentralIdentityAxios(false).get(`/users/${rec.user_id}`)
      ).data.data;
    }

    return res.send({
      err: false,
      requests: requestsRes.data.data,
      totalCount: requestsRes.data.meta.total,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getVerificationRequest(
  req: TypedReqParams<{ id: string }>,
  res: Response<{
    err: boolean;
    request: CentralIdentityVerificationRequest;
  }>
) {
  try {
    const requestRes = await useCentralIdentityAxios(false).get(
      `/verification-requests/${req.params.id}`
    );

    if (!requestRes.data || !requestRes.data.data) {
      return conductor500Err(res);
    }

    // TODO: This is a temporary fix until the backend is updated to return the user object
    requestRes.data.data.user = (
      await useCentralIdentityAxios(false).get(`/users/${requestRes.data.data.user_id}`)
    ).data.data;

    return res.send({
      err: false,
      request: requestRes.data.data,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getLicenses(
  req: Request,
  res: Response<{
    err: boolean;
    licenses: CentralIdentityLicense[]; 
  }>
){
  try {
    const licensesRes = await centralIdentityAxios.get('/licenses');
    if(!licensesRes.data || !licensesRes.data.data){
      return conductor500Err(res);
    }

    return res.send({
      err: false,
      licenses: licensesRes.data.data
    })
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function updateVerificationRequest(
  req: TypedReqParamsAndBody<
    { id: string },
    { request: CentralIdentityUpdateVerificationRequestBody }
  >,
  res: Response<{
    err: boolean;
  }>
) {
  try {
    const patch = await useCentralIdentityAxios(false).patch(
      `/verification-requests/${req.params.id}`,
      req.body.request
    );

    if (!patch.data || patch.data.err || patch.data.errMsg) {
      return conductor500Err(res);
    }

    return res.send({
      err: false
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

function validateVerificationRequestStatus(raw: string): boolean {
  return isCentralIdentityVerificationRequestStatus(raw);
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
    case "getVerificationRequests": {
      return [
        param("activePage", conductorErrors.err1).optional().isInt(),
        param("limit", conductorErrors.err1).optional().isInt(),
        param("status", conductorErrors.err1)
          .optional()
          .isString()
          .custom(validateVerificationRequestStatus),
      ];
    }
    case 'getOrgs': {
      return [
        param("activePage", conductorErrors.err1).optional().isInt(),
        param("limit", conductorErrors.err1).optional().isInt(),
        param("query", conductorErrors.err1).optional().isString(),
      ]
    }
    case "getVerificationRequest": {
      return [param("id", conductorErrors.err1).exists().isString()];
    }
    case "updateVerificationRequest": {
      return [
        param("id", conductorErrors.err1).exists().isString(),
        body("request", conductorErrors.err1).exists().isObject(),
      ];
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
  getApplicationsPriveledged,
  getApplicationsPublic,
  getOrgs,
  getSystems,
  getServices,
  getVerificationRequests,
  getVerificationRequest,
  updateVerificationRequest,
  updateUser,
  getLicenses,
  validate,
};
