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
import axios from "axios";

const ONE_AUTH_HEADER = `Basic ${Buffer.from(
  `${process.env.CENTRAL_IDENTITY_USER}:${process.env.CENTRAL_IDENTITY_KEY}`
).toString("base64")}`;

const ONE_AUTH_HEADER_OBJ = {
  headers: {
    authorization: ONE_AUTH_HEADER,
  },
};

async function getUsers(
  req: TypedReqQuery<{ activePage?: number, limit?: number, searchQuery?: string }>,
  res: Response<{
    err: boolean;
    users: CentralIdentityUser[];
    totalCount: number;
  }>
) {
  try {
    if (!process.env.CENTRAL_IDENTITY_URL) {
      return conductor500Err(res);
    }

    let page = 1;
    let limit = req.query.limit || 25;
    if (
      req.query.activePage &&
      Number.isInteger(parseInt(req.query.activePage.toString()))
    ) {
      page = req.query.activePage;
    }
    const offset = getPaginationOffset(page, limit);

    const usersRes = await axios.get(
      process.env.CENTRAL_IDENTITY_URL + "/users",
      {
        ...ONE_AUTH_HEADER_OBJ,
        params: {
          offset,
          limit,
          searchQuery: req.query.searchQuery,
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
    if (!process.env.CENTRAL_IDENTITY_URL) {
      return conductor500Err(res);
    }

    if (!req.params.id) {
      return conductor400Err(res);
    }

    const userRes = await axios.get(
      `${process.env.CENTRAL_IDENTITY_URL}/users/${req.params.id}`,
      {
        ...ONE_AUTH_HEADER_OBJ,
      }
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

async function updateUser(req: TypedReqParamsAndBody<{ id?: string }, CentralIdentityUser>, res: Response<{ err: boolean; user: CentralIdentityUser }>){
 try {
    if (!process.env.CENTRAL_IDENTITY_URL) {
      return conductor500Err(res);
    }

    if (!req.params.id) {
      return conductor400Err(res);
    }

    const userRes = await axios.patch(
      `${process.env.CENTRAL_IDENTITY_URL}/users/${req.params.id}`,
      req.body,
      {
        ...ONE_AUTH_HEADER_OBJ,
      }
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
    if (!process.env.CENTRAL_IDENTITY_URL) {
      return conductor500Err(res);
    }

    let page = 1;
    let limit = 25;
    if (
      req.query.activePage &&
      Number.isInteger(parseInt(req.query.activePage.toString()))
    ) {
      page = req.query.activePage;
    }
    let offset = getPaginationOffset(page, limit);

    const orgsRes = await axios.get(
      process.env.CENTRAL_IDENTITY_URL + "/organizations",
      {
        ...ONE_AUTH_HEADER_OBJ,
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
    if (!process.env.CENTRAL_IDENTITY_URL) {
      return conductor500Err(res);
    }

    let page = 1;
    let limit = 25;
    if (
      req.query.activePage &&
      Number.isInteger(parseInt(req.query.activePage.toString()))
    ) {
      page = req.query.activePage;
    }
    let offset = getPaginationOffset(page, limit);

    const orgsRes = await axios.get(
      process.env.CENTRAL_IDENTITY_URL + "/organization-systems",
      {
        ...ONE_AUTH_HEADER_OBJ,
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
    if (!process.env.CENTRAL_IDENTITY_URL) {
      return conductor500Err(res);
    }

    let page = 1;
    let limit = 25;
    if (
      req.query.activePage &&
      Number.isInteger(parseInt(req.query.activePage.toString()))
    ) {
      page = req.query.activePage;
    }
    let offset = getPaginationOffset(page, limit);

    const orgsRes = await axios.get(
      process.env.CENTRAL_IDENTITY_URL + "/services",
      {
        ...ONE_AUTH_HEADER_OBJ,
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
