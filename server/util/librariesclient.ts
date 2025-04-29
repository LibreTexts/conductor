import { SSMClient, GetParametersByPathCommand } from "@aws-sdk/client-ssm";
import { debugError } from "../debug.js";
import {
  CXOneFetchParams,
  LibrariesSSMClient as LibrariesSSMClientType,
  LibraryAPIRequestHeaders,
  LibraryTokenPair,
  CXOneGroup,
  CXOneUser,
} from "../types";
import { createHmac } from "crypto";
import CXOne from "./CXOne/index.js";
import { getLibraryNameKeys } from "../api/libraries";

/**
 * Singleton class for interacting with AWS SSM service to retrieve library API tokens.
 */
class LibrariesSSMClient {
  public apiUsername: string = "LibreBot";
  public libTokenPairPath: string = "/libkeys/production";
  public ssm: SSMClient = new SSMClient({
    credentials: {
      accessKeyId: process.env.AWS_SSM_ACCESS_KEY_ID || "unknown",
      secretAccessKey: process.env.AWS_SSM_SECRET_KEY || "unknown",
    },
    region: process.env.AWS_SSM_REGION || "unknown",
  });

  public credentialsCache: Record<
    string,
    { keyPair: LibraryTokenPair; apiUsername: string; refreshAfter: Date }
  > = {};

  private static instance: LibrariesSSMClient;

  private constructor() {
    this.apiUsername = process.env.LIBRARIES_API_USERNAME || "LibreBot";
    this.libTokenPairPath = (
      process.env.AWS_SSM_LIB_TOKEN_PAIR_PATH || "/libkeys/production"
    ).replace(/['"]/g, "");
  }

  public static getInstance() {
    if (!LibrariesSSMClient.instance) {
      LibrariesSSMClient.instance = new LibrariesSSMClient();
    }

    return LibrariesSSMClient.instance;
  }

  public async getLibraryCredentials(lib: string) {
    try {
      // Check if credentials are cached and still valid
      if (this.credentialsCache[lib]) {
        const cached = this.credentialsCache[lib];
        if (cached.refreshAfter > new Date()) {
          return cached;
        }
      }

      // If not, retrieve from SSM
      const basePath = this.libTokenPairPath.endsWith("/")
        ? this.libTokenPairPath
        : `${this.libTokenPairPath}/`;

      const pairResponse = await this.ssm.send(
        new GetParametersByPathCommand({
          Path: `${basePath}${lib}`,
          MaxResults: 10,
          Recursive: true,
          WithDecryption: true,
        })
      );

      if (pairResponse.$metadata.httpStatusCode !== 200) {
        console.error(pairResponse.$metadata);
        throw new Error("Error retrieving library token pair.");
      }
      if (!pairResponse.Parameters) {
        console.error(
          "No data returned from token pair retrieval. Lib: " + lib
        );
        throw new Error("Error retrieving library token pair.");
      }

      const libKey = pairResponse.Parameters.find((p) =>
        p.Name?.includes(`${lib}/key`)
      );
      const libSec = pairResponse.Parameters.find((p) =>
        p.Name?.includes(`${lib}/secret`)
      );
      if (!libKey?.Value || !libSec?.Value) {
        console.error(
          "Key param not found in token pair retrieval. Lib: " + lib
        );
        throw new Error("Error retrieving library token pair.");
      }

      // Push to cache and return
      const creds = {
        keyPair: {
          key: libKey.Value,
          secret: libSec.Value,
        },
        apiUsername: this.apiUsername,
        refreshAfter: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      };

      this.credentialsCache[lib] = creds;
      return creds;
    } catch (err) {
      debugError(err);
      return null;
    }
  }
}

/**
 * Generates the set of request headers required for interacting with a library's API,
 * including the API token.
 */
export async function generateAPIRequestHeaders(
  lib: string
): Promise<LibraryAPIRequestHeaders | null> {
  try {
    const libClient = LibrariesSSMClient.getInstance();
    if (!libClient) {
      throw new Error(
        "Error generating library token pair. LibrariesSSMClient is null."
      );
    }

    const creds = await libClient.getLibraryCredentials(lib);
    if (!creds || !creds.keyPair || !creds.apiUsername) {
      console.log("Failed attempt to generate library token pair.");
      throw new Error("Error generating library token pair.");
    }

    const epoch = Math.floor(Date.now() / 1000);
    const hmac = createHmac("sha256", creds.keyPair.secret);
    hmac.update(`${creds.keyPair.key}${epoch}=${creds.apiUsername}`);
    return {
      "X-Deki-Token": `${creds.keyPair.key}_${epoch}_=${
        creds.apiUsername
      }_${hmac.digest("hex")}`,
      "X-Requested-With": "XMLHttpRequest",
    };
  } catch (err) {
    debugError(err);
    return null;
  }
}

/**
 * fetch wrapper function that automatically uses Mindtouch browser or server API tokens
 * @param {string|number} path - the path or pageID of the target page. Can also instead take a full arbitrary API url.
 * @param {string} api - the /pages {@link https://success.mindtouch.com/Integrations/API/API_Calls/pages|sub-endpoint} that you are calling
 * @param {string} subdomain - subdomain that the target page belongs to
 * @param {string} username - the user that is performing this request
 * @param {Object} [options={}] - optional options that will be passed to fetch()
 * @param {Object} [query={}] - optional query parameters that will be appended to the request url
 * @param {boolean} [silentFail=false] - if true, will not throw an error if the fetch fails
 */
export async function CXOneFetch(params: CXOneFetchParams): Promise<Response> {
  try {
    const { scope, subdomain, options, query, silentFail } = params;

    const generatedHeaders = await generateAPIRequestHeaders(subdomain);
    if (!generatedHeaders) {
      throw new Error("Error generating API request headers.");
    }
    const finalOptions = _optionsMerge(generatedHeaders, options);

    let request;
    if (scope === "groups") {
      request = fetch(
        `https://${subdomain}.libretexts.org/@api/deki/groups?dream.out.format=json${_parseQuery(
          query
        )}`,
        finalOptions
      );
    } else if (scope === "users") {
      const { path, api } = params;
      if (path) {
        const isNumber = !isNaN(Number(path));
        const queryIsFirst = api?.includes("?") ? false : true;
        const url = `https://${subdomain}.libretexts.org/@api/deki/users/${
          isNumber ? "" : "="
        }${encodeURIComponent(encodeURIComponent(path))}/${
          api ? api : ""
        }${_parseQuery(query, queryIsFirst)}`;
        request = fetch(url, finalOptions);
      } else {
        request = fetch(
          `https://${subdomain}.libretexts.org/@api/deki/users?dream.out.format=json${_parseQuery(
            query
          )}`,
          finalOptions
        );
      }
    } else if (scope === "files") {
      const { path, api } = params;
      const isNumber = !isNaN(Number(path));
      const queryIsFirst = api.includes("?") ? false : true;
      const url = `https://${subdomain}.libretexts.org/@api/deki/files/${
        isNumber ? "" : "="
      }${encodeURIComponent(encodeURIComponent(path))}/${api}${_parseQuery(
        query,
        queryIsFirst
      )}`;
      request = fetch(url, finalOptions);
    } else {
      const { path, api } = params;
      const isNumber = !isNaN(Number(path));
      const queryIsFirst = api.includes("?") ? false : true;
      const url = `https://${subdomain}.libretexts.org/@api/deki/pages/${
        isNumber ? "" : "="
      }${encodeURIComponent(encodeURIComponent(path))}/${api}${_parseQuery(
        query,
        queryIsFirst
      )}`;
      request = fetch(url, finalOptions);
    }

    const result = await request;
    if (!result.ok && !silentFail) {
      debugError(result.url);
      throw new Error(
        `Error fetching ${
          params.scope === "files"
            ? "files"
            : params.scope === "groups"
            ? "groups"
            : params.scope === "users"
            ? "users"
            : "page"
        } from ${subdomain}. ${result.statusText}`
      );
    }
    return result;
  } catch (err: any) {
    throw new Error(`Request failed: ${err.message}`);
  }
}

/**
 * Add a property to a library page.
 *
 * @param {string} subdomain - Library identifier.
 * @param {string|number} path - Target page path or ID.
 * @param {keyof typeof LibrariesClientPageProperties} property - Name of the property to add/set.
 * @param {string | boolean | number} value - Value of the new property.
 * @returns {Promise<boolean>} True if successfully set, false if error encountered.
 */
export async function addPageProperty(
  subdomain: string,
  path: string | number,
  property: keyof typeof CXOne.PageProps,
  value: string | boolean | number
): Promise<boolean> {
  try {
    const addRes = await CXOneFetch({
      scope: "page",
      path,
      api: CXOne.API.Page.POST_Properties,
      subdomain: subdomain,
      options: {
        method: "POST",
        body: value,
        headers: { Slug: CXOne.PageProps[property] },
      },
    });

    if (!addRes || !addRes.ok) {
      throw new Error(`Error adding property ${property} to ${path}.`);
    }

    return true;
  } catch (e) {
    debugError(e);
    return false;
  }
}

export async function getPage(
  path: string | number,
  subdomain: string
): Promise<any> {
  try {
    const res = await CXOneFetch({
      scope: "page",
      path,
      api: CXOne.API.Page.GET_Page_Info,
      subdomain,
    });
    const raw = await res.json();
    return raw;
  } catch (err) {
    debugError(err);
    return null;
  }
}

export async function getPageID(
  path: string,
  subdomain: string
): Promise<string | null> {
  try {
    const res = await getPage(path, subdomain);
    if (!res) {
      throw new Error(`Error retrieving page ID for ${path}.`);
    }
    const id = res["@id"]?.toString();
    if (!id) {
      throw new Error(`Error retrieving page ID for ${path}.`);
    }
    return id;
  } catch (err) {
    debugError(err);
    return null;
  }
}

/**
 * Returns the user groups of a library.
 *
 * @param subdomain - The subdomain of the library
 * @returns {Promise<CXOneGroup[]>} - The user groups of the library
 */
export async function getGroups(subdomain: string): Promise<CXOneGroup[]> {
  try {
    const res = await CXOneFetch({
      scope: "groups",
      subdomain,
    });

    const raw = await res.json();

    const finalGroups: CXOneGroup[] = [];
    if (raw["@count"] !== "0" && raw.group) {
      const groupsArr = raw.group.length ? raw.group : [raw.group];
      const mapped = groupsArr.map((prop: any) => {
        return {
          name: prop["groupname"]?.toString(),
          id: prop["@id"]?.toString(),
          role: prop["permissions.group"].role["#text"]?.toString(),
        };
      });
      finalGroups.push(...mapped);
    }

    return finalGroups;
  } catch (err) {
    debugError(err);
    return [];
  }
}

export async function getLibreBotUserId(
  subdomain: string
): Promise<string | null> {
  try {
    const res = await CXOneFetch({
      scope: "users",
      subdomain,
      path: process.env.CXONE_API_USERNAME || "LibreBot",
      query: {
        "dream.out.format": "json",
      },
    });
    const raw = await res.json();
    return raw["@id"]?.toString() || null;
  } catch (err) {
    debugError(err);
    return null;
  }
}

/**
 * Returns the Developer group for a library.
 *
 * @param subdomain - The subdomain of the library
 * @returns {Promise<CXOneGroup>} - The Developer group of the library
 */
export async function getDeveloperGroup(
  subdomain: string
): Promise<CXOneGroup | undefined> {
  try {
    const groups = await getGroups(subdomain);
    return groups.find((g) => g.name === "Developer");
  } catch (err) {
    debugError(err);
    return undefined;
  }
}

/**
 * Returns all users of a library.
 *
 * @param subdomain - The subdomain of the library
 * @returns {Promise<CXOneUser[]>} - The users of the library
 */
export async function getLibUsers(subdomain: string): Promise<CXOneUser[]> {
  try {
    const res = await CXOneFetch({
      scope: "users",
      subdomain,
      query: {
        verbose: "false",
        seatfilter: "seated",
        limit: "all",
      },
    });

    const raw = await res.json();

    const finalUsers: CXOneUser[] = [];
    if (raw["@count"] !== "0" && raw.user) {
      const usersArr = raw.user.length ? raw.user : [raw.user];
      const mapped = usersArr.map((prop: any) => {
        return {
          username: prop["username"]?.toString(),
          email: prop["email"]?.toString(),
          id: prop["@id"]?.toString(),
        };
      });
      finalUsers.push(...mapped);
    }

    return finalUsers;
  } catch (err) {
    debugError(err);
    return [];
  }
}

/**
 * Returns a user of a library.
 *
 * @param email - The email of the user to retrieve
 * @param subdomain - The subdomain of the library
 * @returns {Promise<CXOneUser | undefined>} - The user of the library, or undefined if not found
 */
export async function getLibUser(
  email: string,
  subdomain: string
): Promise<CXOneUser | undefined> {
  try {
    const users = await getLibUsers(subdomain);
    return users.find((u) => u.email === email);
  } catch (err) {
    debugError(err);
    return undefined;
  }
}

function _optionsMerge(
  headers: Record<string, any>,
  options?: Record<string, any>
) {
  if (!options) {
    return { headers };
  }
  if (options.headers) {
    options.headers = Object.assign(headers, options.headers);
  } else {
    options.headers = headers;
  }
  return options;
}

/**
 *
 * @param {object} query - Object containing query parameters
 * @param {boolean} first - Whether or not this is the first query parameter (defaults to false)
 * @returns {string} - An encoded query string (e.g. '&key=value&key2=value2' or '?key=value&key2=value2' if first is true)
 */
function _parseQuery(query?: Record<string, any>, first = false) {
  if (!query) return "";

  const searchParams = new URLSearchParams();
  for (const key in query) {
    searchParams.append(key, query[key]);
  }
  return `${first ? "?" : "&"}${searchParams.toString()}`;
}

/**
 * Returns a tuple containing the CXOne path and URL of a book.
 * @param subdomain - The subdomain of the library
 * @param title - The title of the book
 * @returns {[string, string]} - The CXOne [path,URL] of the book
 */
export const generateBookPathAndURL = (
  subdomain: string,
  title: string
): [string, string] => {
  const path = `Workbench/${encodeURIComponent(title)}`;
  const url = `https://${subdomain}.libretexts.org/${path}`;
  return [path, url];
};

export const generateChapterOnePath = (bookPath: string): string => {
  return `${bookPath}/01:_First_Chapter`;
};

export const getSubdomainFromLibrary = (library: string): string | null => {
  let subdomain: string | null = null;
  getLibraryNameKeys(true).then((libs) => {
    if (Array.isArray(libs)) {
      const found = libs.find((lib) => lib === library);
      if (found) {
        subdomain = found;
      }
    }
  }).catch((err) => {
    debugError(err);
  })
  return null;
};
