import conductorErrors from "../conductor-errors.js";
import { debugError } from "../debug.js";
import { Request, Response } from "express";
import { param, body } from "express-validator";
import {
  CentralIdentityOrg,
  CentralIdentityService,
  CentralIdentitySystem,
  CentralIdentityUser,
  TypedReqBody,
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
import {
  CentralIdentityLicense,
  CentralIdentityUpdateVerificationRequestBody,
} from "../types/CentralIdentity.js";
import User from "../models/user.js";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import {
  LibraryAccessWebhookValidator,
  NewUserWebhookValidator,
  CheckUserApplicationAccessValidator,
  VerificationStatusUpdateWebhookValidator,
  GetVerificationRequestsSchema,
  CheckUsersApplicationAccessValidator
} from "./validators/central-identity.js";
import Project, { ProjectInterface } from "../models/project.js";
import { getSubdomainFromLibrary } from "../util/librariesclient.js";
import { updateTeamWorkbenchPermissions } from "../util/projectutils.js";
import fse from "fs-extra";
import axios from "axios";
import { SignJWT } from "jose";

async function getUsers(
  req: TypedReqQuery<{
    page?: number;
    limit?: number;
    query?: string;
    sort?: string;
  }>,
  res: Response<{
    err: boolean;
    users: CentralIdentityUser[];
    total: number;
  }>
) {
  try {
    let page = 1;
    let limit = req.query.limit || 10;
    const sortChoice = req.query.sort || "first";
    if (
      req.query.page &&
      Number.isInteger(parseInt(req.query.page.toString()))
    ) {
      page = req.query.page;
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

    const sortData = (data: CentralIdentityUser[], sortChoice: string) => {
      switch (sortChoice) {
        case "first":
          return data.sort((a, b) => a.first_name.localeCompare(b.first_name));
        case "last":
          return data.sort((a, b) => a.last_name.localeCompare(b.last_name));
        case "email":
          return data.sort((a, b) => a.email.localeCompare(b.email));
        case "auth":
          return data.sort(
            (a, b) => a.external_idp?.localeCompare(b.external_idp ?? "") ?? 0
          );
        default:
          return data;
      }
    };

    if (req.query.sort) {
      usersRes.data.data = sortData(usersRes.data.data, sortChoice);
    }

    return res.send({
      err: false,
      users: usersRes.data.data,
      total: usersRes.data.meta.total ?? 0,
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

    const userRes = await useCentralIdentityAxios(false).get(
      `/users/${req.params.id}`
    );

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
    if (!req.params.id) return conductor400Err(res);
    const appsRes = await getUserApplicationsInternal(req.params.id);
    if (!appsRes) return conductor500Err(res);

    return res.send({
      err: false,
      applications: appsRes,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getUserApplicationsInternal(
  userId: string
): Promise<CentralIdentityApp[] | null> {
  try {
    const appsRes = await useCentralIdentityAxios(false).get(
      `/users/${userId}/applications`
    );

    if (!appsRes.data || !appsRes.data.data) {
      return null;
    }

    return appsRes.data.data.applications;
  } catch (err) {
    debugError(err);
    return null;
  }
}

async function checkUserApplicationAccess(
  req: z.infer<typeof CheckUserApplicationAccessValidator>,
  res: Response<{ err: boolean; hasAccess: boolean }>
) {
  try {
    const { id, applicationId } = req.params;

    const user = await User.findOne({ uuid: id });
    if (!user) return conductor404Err(res);

    const hasAccess = await checkUserApplicationAccessInternal(
      user.centralID,
      applicationId
    );

    if (hasAccess === null) return conductor500Err(res);

    return res.send({
      err: false,
      hasAccess,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function checkUsersApplicationAccess(
  req: z.infer<typeof CheckUsersApplicationAccessValidator>,
  res: Response<{ err: boolean; accessResults: { id: string; hasAccess: boolean }[] }>
) {
  try {
    const { ids } = req.body;
    const { applicationId } = req.params;

    const users = await User.find({ uuid: { $in: ids } });

    if (!users.length) return conductor404Err(res);

    const accessResults = await Promise.all(
      users.map(async (user) => {
        if (!user.centralID) {
          return { id: user.uuid, hasAccess: false }; 
        }

        const hasAccess = await checkUserApplicationAccessInternal(
          user.centralID,
          applicationId
        );

        return { id: user.uuid, hasAccess: hasAccess !== null ? hasAccess : false };
      })
    );

    return res.send({
      err: false,
      accessResults,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}


async function checkUserApplicationAccessInternal(
  userId: string,
  appId: number | string
): Promise<boolean | null> {
  try {
    const appsRes = await getUserApplicationsInternal(userId);
    if (!appsRes) return null;

    const hasAccess = appsRes.some(
      (app: CentralIdentityApp) => app.id.toString() === appId.toString() || app.name === appId
    );
    return hasAccess;
  } catch (err) {
    debugError(err);
    return null;
  }
}

async function _getUserOrgsRaw(id: string): Promise<CentralIdentityOrg[]> {
  const orgsRes = await useCentralIdentityAxios(false).get(
    `/users/${id}/organizations`
  );

  if (!orgsRes.data || !orgsRes.data.data) {
    return [];
  }

  return orgsRes.data.data.organizations ?? [];
}

async function getUserOrgs(
  req: TypedReqParams<{ id: string }>,
  res: Response<{ err: boolean; orgs: CentralIdentityOrg[] }>
) {
  try {
    if (!req.params.id) return conductor400Err(res);

    const orgsRes = await _getUserOrgsRaw(req.params.id);
    if (!orgsRes) return conductor500Err(res);

    return res.send({
      err: false,
      orgs: orgsRes,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

/**
 * Get multiple users' organizations in a single request.
 * Internal function, API requests should not call this directly.
*/
async function _getMultipleUsersOrgs(uuids: string[]): Promise<Record<string, { name: string }[]>> {
  try {

    if(!uuids || uuids.length === 0) {
      return {};
    }

    const queryString = uuids.map(uuid => `uuids[]=${encodeURIComponent(uuid)}`).join('&');

    const userRes = await useCentralIdentityAxios(false).get("/users/organizations" + "?" + queryString);

    if (!userRes.data || !userRes.data.data) {
      return {};
    }

    return userRes.data.data;
  } catch (err) {
    debugError(err);
    return {};
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
      useCentralIdentityAxios(false).post(
        `/users/${req.params.id}/applications`,
        {
          application_id: id,
        }
      )
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
      `/users/${req.params.id
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
      useCentralIdentityAxios(false).post(
        `/users/${req.params.id}/organizations`,
        {
          organization_id: id,
        }
      )
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

    const appsRes = await _getApplicationsPriveledgedInternal(page, limit);
    if (!appsRes) return conductor500Err(res);

    return res.send({
      err: false,
      applications: appsRes.applications,
      totalCount: appsRes.totalCount,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function _getApplicationsPriveledgedInternal(
  page: number,
  limit: number
): Promise<{
  applications: CentralIdentityApp[];
  totalCount: number;
} | null> {
  try {
    const offset = getPaginationOffset(page, limit);

    const appsRes = await useCentralIdentityAxios(false).get("/applications", {
      params: {
        offset,
        limit,
      },
    });

    if (!appsRes.data || !appsRes.data.data || !appsRes.data.meta) {
      return null;
    }

    return {
      applications: appsRes.data.data as CentralIdentityApp[],
      totalCount: appsRes.data.meta.total,
    };
  } catch (err) {
    debugError(err);
    return null;
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

    // TODO: This is a temporary fix until the backend is fixed
    const { readJSON } = fse;
    const jsonData = await readJSON("./util/LibreOneApplications.json");
    const appsRes = jsonData.applications;
    const totalCount = jsonData.applications.length;

    // const appsRes = await useCentralIdentityAxios().get("/applications", {
    //   params: {
    //     offset,
    //     limit,
    //   }
    // });

    // if (!appsRes.data || !appsRes.data.data || !appsRes.data.meta) {
    //   console.log(appsRes.data)
    //   return conductor500Err(res);
    // }

    return res.send({
      err: false,
      applications: appsRes,
      totalCount: totalCount,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getApplicationById(
  id: number
): Promise<CentralIdentityApp | null> {
  try {
    const appsRes = await _getApplicationsPriveledgedInternal(1, 1000);
    if (!appsRes) return null;
    const found = appsRes.applications.find(
      (app) => app.id.toString() === id.toString()
    );
    return found ?? null;
  } catch (err) {
    debugError(err);
    return null;
  }
}

async function getLibraryFromSubdomain(
  subdomain: string
): Promise<CentralIdentityApp | null> {
  try {
    const apps = await _getApplicationsPriveledgedInternal(1, 1000);
    if (!apps) return null;
    const found = apps.applications.find((app) =>
      app.main_url.includes(subdomain)
    );
    return found ?? null;
  } catch (err) {
    debugError(err);
    return null;
  }
}

async function getOrgs(
  req: TypedReqQuery<{ activePage?: number; limit?: number; query?: string }>,
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

/**
 * Returns the same list of orgs as ADAPT, for use where live/unclean (ie getOrgs) data is not appropriate.
 */
async function getADAPTOrgs(
  req: TypedReqQuery<{ activePage?: number; limit?: number; query?: string }>,
  res: Response<{
    err: boolean;
    orgs: string[];
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

    const data = await fse.readJSON(
      process.cwd() + "/util/adapt-schools-list.json"
    );
    if (!data) {
      throw new Error("Failed to read ADAPT schools list");
    }

    const orgs = data.map((org: any) => org.name);
    if (!orgs || !Array.isArray(orgs)) {
      throw new Error("Failed to parse ADAPT schools list");
    }

    const search = (query: string) => {
      return orgs.filter(
        (org) => org.toLowerCase().indexOf(query.toLowerCase()) >= 0
      );
    };

    const searched = req.query.query ? search(req.query.query) : orgs; // If no query, return all orgs
    const paginated = searched.slice(offset, offset + limit);

    return res.send({
      err: false,
      orgs: paginated,
      totalCount: orgs.length,
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

    const orgsRes = await useCentralIdentityAxios(false).get(
      "/organization-systems",
      {
        params: {
          offset,
          limit,
        },
      }
    );

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
  req: z.infer<typeof GetVerificationRequestsSchema>,
  res: Response<{
    err: boolean;
    requests: CentralIdentityVerificationRequest[];
    totalCount: number;
  }>
) {
  try {
    const page = parseInt(req.query.page?.toString()) || 1;
    const limit = parseInt(req.query.limit?.toString()) || 10;
    const status = req.query.status || 'open';

    const offset = getPaginationOffset(page, limit);

    const requestsRes = await useCentralIdentityAxios(false).get(
      "/verification-requests",
      {
        params: {
          offset,
          limit,
          status,
        },
      }
    );

    if (!requestsRes.data || !requestsRes.data.data || !requestsRes.data.meta) {
      return conductor500Err(res);
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
      await useCentralIdentityAxios(false).get(
        `/users/${requestRes.data.data.user_id}`
      )
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
) {
  try {
    const licensesRes = await useCentralIdentityAxios().get("/licenses");
    if (!licensesRes.data || !licensesRes.data.data) {
      return conductor500Err(res);
    }

    return res.send({
      err: false,
      licenses: licensesRes?.data?.data ?? [],
    });
  } catch (err) {
    // debugError(err);
    // return conductor500Err(res);
    return res.send({
      err: false,
      licenses: [],
    });
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
      err: false,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}


async function processNewUserWebhookEvent(
  req: z.infer<typeof NewUserWebhookValidator>,
  res: Response
) {
  try {
    const { central_identity_id, first_name, last_name, email, avatar } =
      req.body;

    const existUser = await User.findOne({
      $or: [{ email }, { centralID: central_identity_id }],
    });
    if (existUser) {
      return res.send({
        err: false,
        msg: "User already exists.",
      });
    }

    // User doesn't exist locally, create them now
    const newUser = new User({
      centralID: central_identity_id,
      uuid: uuidv4(),
      firstName: first_name,
      lastName: last_name,
      email: email,
      authType: "sso",
      avatar: avatar || "https://cdn.libretexts.net/DefaultImages/avatar.png",
      roles: [],
      // Don't set user verification for now, if they just registered they won't be verified
    });

    await newUser.save();

    console.log("New user created from webhook: ", newUser.centralID);

    return res.send({
      err: false,
      msg: "User successfully created.",
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function processLibraryAccessWebhookEvent(
  req: z.infer<typeof LibraryAccessWebhookValidator>,
  res: Response
) {
  try {
    const { central_identity_id, library } = req.body;
    const user = await User.findOne({ centralID: central_identity_id });
    if (!user) return conductor404Err(res);

    const projects = await Project.find({
      $or: [
        { leads: user.uuid },
        { liaisons: user.uuid },
        { members: user.uuid },
        { auditors: user.uuid },
      ],
      didCreateWorkbench: true,
      libreCoverID: { $exists: true, $ne: "" },
      libreLibrary: library,
    }).lean();

    const withSubdomain = projects.map((project) => {
      if (!project.libreLibrary) return null;
      const subdomain = getSubdomainFromLibrary(project.libreLibrary);
      return {
        projectID: project.projectID,
        subdomain,
        libreCoverID: project.libreCoverID,
      };
    });

    const promises = withSubdomain.map((project) => {
      if (!project) return null;
      const { projectID, subdomain, libreCoverID } = project;
      if (!projectID || !subdomain || !libreCoverID) return null;
      return updateTeamWorkbenchPermissions(projectID, subdomain, libreCoverID);
    });

    const settled = await Promise.allSettled(promises);

    const failed = settled.filter(
      (result) => result.status === "rejected"
    )?.length;
    const fulfilled = settled.filter(
      (result) => result.status === "fulfilled"
    )?.length;

    return res.send({
      err: false,
      msg: "User permissions successfully updated.",
      meta: {
        failed,
        fulfilled,
      },
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function processVerificationStatusUpdateWebook(
  req: z.infer<typeof VerificationStatusUpdateWebhookValidator>,
  res: Response
) {
  try {
    const { central_identity_id, verify_status } = req.body;
    const user = await User.findOne({ centralID: central_identity_id });
    if (!user) return conductor404Err(res);

    if (verify_status === "verified") {
      await User.updateOne(
        { centralID: central_identity_id },
        { $set: { verifiedInstructor: true } }
      );
    } else {
      await User.updateOne(
        { centralID: central_identity_id },
        { $set: { verifiedInstructor: false } }
      );
    }

    return res.send({
      err: false,
      msg: "User instructor verification status successfully updated.",
      meta: {},
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
        param("page", conductorErrors.err1).optional().isInt(),
        param("limit", conductorErrors.err1).optional().isInt(),
        param("query", conductorErrors.err1).optional().isString(),
        param("sort", conductorErrors.err1).optional().isString(),
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
    case "getOrgs": {
      return [
        param("activePage", conductorErrors.err1).optional().isInt(),
        param("limit", conductorErrors.err1).optional().isInt(),
        param("query", conductorErrors.err1).optional().isString(),
      ];
    }
    case "getADAPTOrgs": {
      return [
        param("activePage", conductorErrors.err1).optional().isInt(),
        param("limit", conductorErrors.err1).optional().isInt(),
        param("query", conductorErrors.err1).optional().isString(),
      ];
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
  checkUserApplicationAccess,
  checkUsersApplicationAccess,
  checkUserApplicationAccessInternal,
  _getUserOrgsRaw,
  getUserOrgs,
  _getMultipleUsersOrgs,
  addUserApplications,
  deleteUserApplication,
  addUserOrgs,
  deleteUserOrg,
  getApplicationsPriveledged,
  getApplicationsPublic,
  getApplicationById,
  getLibraryFromSubdomain,
  getOrgs,
  getADAPTOrgs,
  getSystems,
  getServices,
  getVerificationRequests,
  getVerificationRequest,
  updateVerificationRequest,
  updateUser,
  processNewUserWebhookEvent,
  processLibraryAccessWebhookEvent,
  processVerificationStatusUpdateWebook,
  getLicenses,
  validate,
};
