import conductorErrors from "../conductor-errors.js";
import { debugError } from "../debug.js";
import { Response } from "express";
import { param } from "express-validator";
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

const centralIdentityAxios = useCentralIdentityAxios();

async function getUsers(
  req: TypedReqQuery<{ activePage?: number, limit?: number, query?: string }>,
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

    const usersRes = await centralIdentityAxios.get("/users",
      {
        params: {
          offset,
          limit,
          query: req.query.query,
        },
      }
    );

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

async function updateUser(req: TypedReqParamsAndBody<{ id?: string }, CentralIdentityUser>, res: Response<{ err: boolean; user: CentralIdentityUser }>){
 try {
    if (!req.params.id) {
      return conductor400Err(res);
    }

    const userRes = await centralIdentityAxios.patch(`/users/${req.params.id}`,
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

    const orgsRes = await centralIdentityAxios.get("/organizations",
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

    const orgsRes = await centralIdentityAxios.get("/organization-systems",
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

    const orgsRes = await centralIdentityAxios.get("/services",
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
      ]
    }
    case "getUser": {
      return [param("id", conductorErrors.err1).exists().isUUID()];
    }
    case "updateUser": {
      return [param("id", conductorErrors.err1).exists().isUUID()];
    }
  }
}

export default {
  getUsers,
  getUser,
  getOrgs,
  getSystems,
  getServices,
  updateUser,
  validate,
};
