import conductorErrors from "../conductor-errors.js";
import { debugError } from "../debug.js";
import { Request, Response } from "express";
import { param, body, oneOf } from "express-validator";
import {
  CentralIdentityOrg,
  CentralIdentityService,
  CentralIdentitySystem,
  CentralIdentityUser,
  TypedReqBody,
  TypedReqParams,
  TypedReqParamsAndBody,
  TypedReqParamsAndQuery,
  TypedReqQuery,
  Note,
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
  CentralIdentityAppLicense,
  CentralIdentityLicense,
  CentralIdentityUpdateVerificationRequestBody,
  CentralIdentityUserLicenseResult,
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
import { ZodReqWithUser } from "../types/Express.js";

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

async function updateUserAcademyOnlineAccess(
  req: TypedReqParamsAndBody<{ id: string }, { academy_online: number; academy_online_expires_in_days: number }>,
  res: Response<{ err: boolean; user: CentralIdentityUser }>
) {
  try {
    if (!req.params.id) {
      return conductor400Err(res);
    }

    const userRes = await useCentralIdentityAxios(false).patch(
      `/users/${req.params.id}/academy-online`,
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

    if (!applicationId || !ids || ids.length === 0) {
      return res.send({
        err: false,
        accessResults: [],
      })
    }

    const users = await User.find({ uuid: { $in: ids } });
    if (!users?.length) return conductor404Err(res);

    const accessPromises = users.map((u) => {
      return new Promise<{ id: string; hasAccess: boolean }>((resolve, reject) => {
        if (!u.centralID) {
          resolve({ id: u.uuid, hasAccess: false });
        } else {
          checkUserApplicationAccessInternal(u.centralID, applicationId)
            .then((hasAccess) => {
              resolve({ id: u.uuid, hasAccess: hasAccess ?? false });
            })
            .catch((err) => {
              debugError(err);
              reject(err);
            });
        }
      })
    });

    const accessResults = await Promise.all(accessPromises);

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

async function getUserAppLicenses(
  req: TypedReqParams<{ id: string }>,
  res: Response<{ err: boolean; licenses: CentralIdentityUserLicenseResult[] }>
) {
  try {
    if (!req.params.id) return conductor400Err(res);

    const licensesRes = await useCentralIdentityAxios(false).get(
      `/app-licenses/user/${req.params.id}`,
      {
        params: {
          includeRevoked: true,
          includeExpired: true,
        },
      }
    );

    if (!licensesRes.data || !licensesRes.data.data) {
      return conductor500Err(res);
    }

    return res.send({
      err: false,
      licenses: licensesRes.data.data,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function grantAppLicense(
  req: TypedReqBody<({ user_id: string } | { org_id: string }) & { application_license_id: string }>,
  res: Response<{ err: boolean; entity_id: string; application_license_id: string }>
) {
  try {
    const grantResponse = await useCentralIdentityAxios(false).post(
      '/app-licenses/manual-grant',
      {
        ...('user_id' in req.body ? { user_id: req.body.user_id } : { org_id: req.body.org_id }),
        application_license_id: req.body.application_license_id,
      },
    );

    if (!grantResponse.data || !grantResponse.data.data) {
      return conductor500Err(res);
    }

    return res.send({
      err: false,
      entity_id: grantResponse.data.data.id,
      application_license_id: grantResponse.data.data.application_license_id
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function revokeAppLicense(
  req: TypedReqBody<({ user_id: string } | { org_id: string }) & { application_license_id: string }>,
  res: Response<{ err: boolean; entity_id: string; application_license_id: string }>
) {
  try {
    const revokeResponse = await useCentralIdentityAxios(false).post(
      '/app-licenses/manual-revoke',
      {
        ...('user_id' in req.body ? { user_id: req.body.user_id } : { org_id: req.body.org_id }),
        application_license_id: req.body.application_license_id,
      }
    );

    if (!revokeResponse.data || !revokeResponse.data.data) {
      return conductor500Err(res);
    }

    return res.send({
      err: false,
      entity_id: revokeResponse.data.data.id,
      application_license_id: revokeResponse.data.data.application_license_id
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}


async function getAppLicenses(
  req: Request,
  res: Response<{ err: boolean; licenses: CentralIdentityAppLicense[] }>
) {
  try {
    const available = await useCentralIdentityAxios(false).get("/store/products");

    if (!available.data || !available.data.data) {
      return res.send({ err: false, licenses: [] });
    }

    return res.send({
      err: false,
      licenses: available.data.data
    });
  } catch (err) {
    debugError(err);
    return [];
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

    if (!uuids || uuids.length === 0) {
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

/**
 * Directs LibreOne's API to generate an access code for a product and sends it to the user's email.
 * Note: This function is intended for internal use only and should not be exposed to the API.
 * @param param0 - An object containing the price ID and email address.
 * @returns A boolean indicating whether the access code was successfully generated.
 */
async function _generateAccessCode({ priceId, email }: { priceId: string; email: string }): Promise<boolean> {
  try {
    const res = await useCentralIdentityAxios(false).post('/store/access-code/generate', {
      stripe_price_id: priceId,
      email: email,
    });

    if (!res.data || !res.data.data || !res.data.data.code) {
      return false;
    }

    return true;
  } catch (err) {
    debugError(err);
    return false
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
    let limit = req.query.limit;
    let offset;

    if (req.query.limit !== undefined && Number.isInteger(parseInt(req.query.limit.toString()))) {
      limit = parseInt(req.query.limit.toString());

      const page = req.query.activePage && Number.isInteger(parseInt(req.query.activePage.toString()))
        ? parseInt(req.query.activePage.toString())
        : 1;

      offset = getPaginationOffset(page, limit);
    }

    const orgsRes = await useCentralIdentityAxios(false).get("/organizations", {
      params: {
        offset: offset ? offset : undefined,
        limit: limit ? limit : undefined,
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

async function getOrg(
  req: TypedReqParams<{ orgId: string }>,
  res: Response<{ err: boolean; org: CentralIdentityOrg }>
) {
  try {
    if (!req.params.orgId) {
      return conductor400Err(res);
    }

    const orgRes = await useCentralIdentityAxios(false).get(
      `/organizations/${req.params.orgId}`
    );

    if (!orgRes.data || !orgRes.data.data) {
      return conductor404Err(res);
    }
    return res.send({
      err: false,
      org: orgRes.data.data,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function updateOrg(
  req: TypedReqParamsAndBody<{ orgId: string }, Partial<CentralIdentityOrg>>,
  res: Response<{ err: boolean; org?: CentralIdentityOrg }>
) {
  try {
    if (!req.params.orgId) {
      return conductor400Err(res);
    }

    const updateRes = await useCentralIdentityAxios(false).patch(
      `/organizations/${req.params.orgId}`,
      req.body
    );

    if (!updateRes.data || !updateRes.data.data) {
      return conductor500Err(res);
    }

    return res.send({
      err: false,
      org: updateRes.data.data,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function createOrg(
  req: TypedReqBody<{ name: string; logo?: string; systemId?: number }>,
  res: Response<{ err: boolean; org?: CentralIdentityOrg }>
) {
  try {
    if (!req.body.name) {
      return conductor400Err(res);
    }
    const orgRes = await useCentralIdentityAxios(false).post(
      "/organizations",
      {
        name: req.body.name,
        logo: req.body.logo || null,
        system_id: req.body.systemId
      }
    );

    if (!orgRes.data || !orgRes.data.data) {
      return conductor500Err(res);
    }

    return res.send({
      err: false,
      org: orgRes.data.data,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function deleteOrg(
  req: TypedReqParams<{ orgId: string }>,
  res: Response<{ err: boolean }>
) {
  try {
    if (!req.params.orgId) {
      return conductor400Err(res);
    }

    const orgRes = await useCentralIdentityAxios(false).delete(
      `/organizations/${req.params.orgId}`
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
  req: TypedReqQuery<{ activePage?: number; limit?: number }>,
  res: Response<{
    err: boolean;
    systems: CentralIdentitySystem[];
    totalCount: number;
  }>
) {
  try {
    let limit = req.query.limit;
    let offset;

    if (req.query.limit !== undefined && Number.isInteger(parseInt(req.query.limit.toString()))) {
      limit = parseInt(req.query.limit.toString());

      const page = req.query.activePage && Number.isInteger(parseInt(req.query.activePage.toString()))
        ? parseInt(req.query.activePage.toString())
        : 1;

      offset = getPaginationOffset(page, limit);
    }

    const orgsRes = await useCentralIdentityAxios(false).get(
      "/organization-systems", {
      params: {
        offset: offset ? offset : undefined,
        limit: limit ? limit : undefined,
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

async function getSystem(
  req: TypedReqParams<{ systemId?: string }>,
  res: Response<{ err: boolean; system: CentralIdentitySystem }>
) {
  try {
    if (!req.params.systemId) {
      return conductor400Err(res);
    }

    const systemRes = await useCentralIdentityAxios(false).get(
      `/organization-systems/${req.params.systemId}`
    );

    if (!systemRes.data || !systemRes.data.data) {
      return conductor404Err(res);
    }
    return res.send({
      err: false,
      system: systemRes.data.data,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function updateSystem(
  req: TypedReqParamsAndBody<{ systemId?: string }, Partial<CentralIdentitySystem>>,
  res: Response<{ err: boolean; system?: CentralIdentitySystem }>
) {
  try {
    if (!req.params.systemId) {
      return conductor400Err(res);
    }

    const updateRes = await useCentralIdentityAxios(false).put(
      `/organization-systems/${req.params.systemId}`,
      req.body
    );

    if (!updateRes.data || !updateRes.data.data) {
      return conductor500Err(res);
    }

    return res.send({
      err: false,
      system: updateRes.data.data,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function createSystem(
  req: TypedReqBody<{ name: string, logo: string }>,
  res: Response<{ err: boolean; system?: CentralIdentitySystem }>
) {
  try {
    if (!req.body.name) {
      return conductor400Err(res);
    }

    const systemRes = await useCentralIdentityAxios(false).post(
      "/organization-systems",
      {
        name: req.body.name,
        logo: req.body.logo
      }
    );

    if (!systemRes.data || !systemRes.data.data) {
      return conductor500Err(res);
    }

    return res.send({
      err: false,
      system: systemRes.data.data,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function deleteSystem(
  req: TypedReqParams<{ id: string }>,
  res: Response<{ err: boolean }>
) {
  try {
    if (!req.params.id) {
      return conductor400Err(res);
    }

    const sysRes = await useCentralIdentityAxios(false).delete(
      `/organization-systems/${req.params.id}`
    );

    if (sysRes.data.err || sysRes.data.errMsg) {
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

async function getUserNotes(
  req: TypedReqParamsAndQuery<{ userId: string }, { page?: number; limit?: number }>,
  res: Response<{
    err: boolean;
    notes: Note[];
    total: number;
    has_more: boolean;
  }>
) {
  const page = req.query.page || 1;
  const limit = req.query.limit || 25;
  try {
    const noteRes = await useCentralIdentityAxios(false).get(
      `/users/${req.params.userId}/notes`,
      {
        params: {
          page,
          limit
        }
      }
    );

    if (!noteRes.data || !noteRes.data.data) {
      return conductor500Err(res);
    }

    return res.send({
      err: false,
      notes: noteRes.data.data.notes,
      total: noteRes.data.data.total,
      has_more: noteRes.data.data.has_more,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function createUserNote(
  req: ZodReqWithUser<TypedReqParamsAndBody<{ userId: string }, { content: string }>>,
  res: Response<{
    err: boolean;
    note: Note;
  }>
) {
  try {
    const callingUserId = req.user.decoded.uuid;
    const callingUser = await User.findOne({ uuid: callingUserId });
    if (!callingUser || !callingUser.centralID) {
      return conductor400Err(res);
    }

    const noteRes = await useCentralIdentityAxios(false).post(
      `/users/${req.params.userId}/notes`,
      {
        content: req.body.content
      }, {
      headers: {
        'X-User-ID': callingUser.centralID,
      }
    }
    );

    if (!noteRes.data || !noteRes.data.data) {
      return conductor500Err(res);
    }

    return res.send({
      err: false,
      note: noteRes.data.data,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function updateUserNote(
  req: ZodReqWithUser<TypedReqParamsAndBody<{ userId: string; noteId: string }, { content: string }>>,
  res: Response<{
    err: boolean;
    note: Note;
  }>
) {
  try {
    const callingUserId = req.user.decoded.uuid;
    const callingUser = await User.findOne({ uuid: callingUserId });
    if (!callingUser || !callingUser.centralID) {
      return conductor400Err(res);
    }

    const noteRes = await useCentralIdentityAxios(false).patch(
      `/users/${req.params.userId}/notes/${req.params.noteId}`,
      {
        content: req.body.content
      }, {
      headers: {
        'X-User-ID': callingUser.centralID,
      }
    }
    );

    if (!noteRes.data || !noteRes.data.data) {
      return conductor500Err(res);
    }

    return res.send({
      err: false,
      note: noteRes.data.data,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function deleteUserNote(
  req: ZodReqWithUser<TypedReqParams<{ userId: string; noteId: string }>>,
  res: Response<{
    err: boolean;
    note: Note;
  }>
) {
  try {
    const noteRes = await useCentralIdentityAxios(false).delete(
      `/users/${req.params.userId}/notes/${req.params.noteId}`
    );

    if (!noteRes.data || !noteRes.data.data) {
      return conductor500Err(res);
    }

    return res.send({
      err: false,
      note: noteRes.data.data,
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

    const withSubdomain = projects.map(async (project) => {
      if (!project.libreLibrary) return null;
      const subdomain = await getSubdomainFromLibrary(project.libreLibrary);
      return {
        projectID: project.projectID,
        subdomain,
        libreCoverID: project.libreCoverID,
      };
    });

    const promises = withSubdomain.map(async (projectPromise) => {
      const project = await projectPromise;

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

async function disableUser(
  req: ZodReqWithUser<TypedReqParamsAndBody<{ id: string }, { reason: string }>>,
  res: Response
) {
  try {
    const uuid = req.params.id;
    const { reason } = req.body;

    const userRes = await useCentralIdentityAxios(false).patch(
      `/users/${uuid}/disable`,
      { disabled_reason: reason }
    );

    res.send({
      err: false,
      msg: "User successfully disabled.",
      meta: {},
    })
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function reEnableUser(
  req: ZodReqWithUser<TypedReqParams<{ id: string }>>,
  res: Response
) {
  try {
    const uuid = req.params.id;

    const userRes = await useCentralIdentityAxios(false).patch(
      `/users/${uuid}/re-enable`,
    );

    res.send({
      err: false,
      msg: "User successfully re-enabled.",
      meta: {},
    })
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
    case "getUserAppLicenses": {
      return [param("id", conductorErrors.err1).exists().isUUID()];
    }
    case "grantAppLicense":
    case "revokeAppLicense": {
      return [
        oneOf([
          // Either user_id or org_id must be present
          body("user_id", conductorErrors.err1).exists().isUUID(),
          body("org_id", conductorErrors.err1).exists().isUUID(),
        ]),
        body("application_license_id", conductorErrors.err1).exists().isUUID(),
      ]
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
    case "updateUserAcademyOnlineAccess": {
      return [
        param("id", conductorErrors.err1).exists().isUUID(),
        body("academy_online", conductorErrors.err1).exists().isInt({ min: 0, max: 4 }),
        body("academy_online_expires_in_days", conductorErrors.err1).exists().isInt({ min: 0, max: 730 }),
      ];
    }
    case "getOrgs": {
      return [
        param("activePage", conductorErrors.err1).optional().isInt(),
        param("limit", conductorErrors.err1).optional().isInt(),
        param("query", conductorErrors.err1).optional().isString(),
      ];
    }
    case "getOrg": {
      return [param("orgId", conductorErrors.err1).exists().isInt()];
    }
    case "updateOrg": {
      return [
        param("orgId", conductorErrors.err1).exists().isInt(),
      ];
    }
    case "deleteOrg": {
      return [param("orgId", conductorErrors.err1).exists().isInt()];
    }
    case "createOrg": {
      return [
        body("name", conductorErrors.err1).exists().isString(),
        body("logo", conductorErrors.err1).optional().isString(),
      ];
    }
    case "createSystem": {
      return [
        body("name", conductorErrors.err1).exists().isString(),
        body("logo", conductorErrors.err1).optional().isString(),
      ];
    }
    case "getSystem": {
      return [param("systemId", conductorErrors.err1).exists().isInt()];
    }
    case "updateSystem": {
      return [
        param("systemId", conductorErrors.err1).exists().isInt(),
        body("name", conductorErrors.err1).optional().isString(),
        body("logo", conductorErrors.err1).optional().isString(),
      ];
    }
    case "disableUser": {
      return [
        param("id", conductorErrors.err1).exists().isUUID(),
        body("reason", conductorErrors.err1).optional().isString(),
      ];
    }
    case "reEnableUser": {
      return [
        param("id", conductorErrors.err1).exists().isUUID(),
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
  getUserAppLicenses,
  getUserApplications,
  checkUserApplicationAccess,
  checkUsersApplicationAccess,
  checkUserApplicationAccessInternal,
  _getUserOrgsRaw,
  getUserOrgs,
  _getMultipleUsersOrgs,
  addUserApplications,
  getAppLicenses,
  grantAppLicense,
  revokeAppLicense,
  deleteUserApplication,
  addUserOrgs,
  deleteUserOrg,
  _generateAccessCode,
  getApplicationsPriveledged,
  getApplicationsPublic,
  getApplicationById,
  getLibraryFromSubdomain,
  getOrgs,
  getOrg,
  updateOrg,
  createOrg,
  deleteOrg,
  getADAPTOrgs,
  getSystems,
  deleteSystem,
  getSystem,
  updateSystem,
  createSystem,
  getServices,
  getVerificationRequests,
  getVerificationRequest,
  updateVerificationRequest,
  updateUser,
  updateUserAcademyOnlineAccess,
  processNewUserWebhookEvent,
  processLibraryAccessWebhookEvent,
  processVerificationStatusUpdateWebook,
  getLicenses,
  validate,
  getUserNotes,
  createUserNote,
  updateUserNote,
  deleteUserNote,
  disableUser,
  reEnableUser
};
