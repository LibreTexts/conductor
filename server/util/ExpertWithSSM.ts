import { SSMClient, GetParametersByPathCommand } from "@aws-sdk/client-ssm";
import Expert from "@libretexts/cxone-expert-node";
import { createHmac } from "crypto";
import { debugError } from "../debug.js";
import { LibraryTokenPair } from "../types";

type LibraryCredentials = {
  keyPair: LibraryTokenPair;
  apiUsername: string;
  refreshAfter: Date;
};

/**
 * Singleton that owns retrieval of per-library CXOne (MindTouch) API credentials
 * from AWS SSM Parameter Store and vends configured {@link Expert} clients from
 * the `@libretexts/cxone-expert-node` SDK.
 *
 * The SDK's `tld` is a full host and each library lives on its own subdomain
 * (e.g. `chem.libretexts.org`), so an `Expert` is created per library.
 * Credentials (and the derived clients) are cached for 30 minutes to avoid
 * hitting SSM on every request.
 */
class ExpertWithSSM {
  public apiUsername: string = "LibreBot";
  public libTokenPairPath: string = "/libkeys/production";
  public ssm: SSMClient = new SSMClient({ region: process.env.AWS_REGION });

  private credentialsCache: Record<string, LibraryCredentials> = {};
  private expertCache: Record<string, { expert: Expert; refreshAfter: Date }> =
    {};

  private static instance: ExpertWithSSM;

  private constructor() {
    this.apiUsername = process.env.LIBRARIES_API_USERNAME || "LibreBot";
    this.libTokenPairPath = (
      process.env.AWS_SSM_LIB_TOKEN_PAIR_PATH || "/libkeys/production"
    ).replace(/['"]/g, "");
  }

  public static getInstance(): ExpertWithSSM {
    if (!ExpertWithSSM.instance) {
      ExpertWithSSM.instance = new ExpertWithSSM();
    }
    return ExpertWithSSM.instance;
  }

  /**
   * Retrieves (and caches for 30 minutes) the API key/secret pair for a library
   * from SSM Parameter Store.
   *
   * @param lib - Library subdomain (e.g. `chem`).
   * @returns The credentials, or `null` if retrieval failed.
   */
  public async getLibraryCredentials(
    lib: string
  ): Promise<LibraryCredentials | null> {
    try {
      // Check if credentials are cached and still valid
      const cached = this.credentialsCache[lib];
      if (cached && cached.refreshAfter > new Date()) {
        return cached;
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
        console.error("No data returned from token pair retrieval. Lib: " + lib);
        throw new Error("Error retrieving library token pair.");
      }

      const libKey = pairResponse.Parameters.find((p) =>
        p.Name?.includes(`${lib}/key`)
      );
      const libSec = pairResponse.Parameters.find((p) =>
        p.Name?.includes(`${lib}/secret`)
      );
      if (!libKey?.Value || !libSec?.Value) {
        console.error("Key param not found in token pair retrieval. Lib: " + lib);
        throw new Error("Error retrieving library token pair.");
      }

      // Push to cache and return
      const creds: LibraryCredentials = {
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

  /**
   * Returns an {@link Expert} client configured for the given library, using
   * credentials from SSM. Clients are cached alongside their credentials and
   * rebuilt when those credentials expire.
   * @example
   * const expert = await expertWithSSM.forLibrary('chem');
   *
   * @param subdomain - Library subdomain (e.g. `chem`).
   * @throws If credentials could not be retrieved for the library.
   */
  public async forLibrary(subdomain: string): Promise<Expert> {
    const cached = this.expertCache[subdomain];
    if (cached && cached.refreshAfter > new Date()) {
      return cached.expert;
    }

    const creds = await this.getLibraryCredentials(subdomain);
    if (!creds) {
      throw new Error(
        `Unable to retrieve CXOne credentials for library "${subdomain}".`
      );
    }

    const expert = new Expert({
      tld: `${subdomain}.libretexts.org`,
      auth: {
        type: "server",
        params: {
          key: creds.keyPair.key,
          secret: creds.keyPair.secret,
          user: creds.apiUsername,
        },
      },
    });

    this.expertCache[subdomain] = {
      expert,
      refreshAfter: creds.refreshAfter,
    };
    return expert;
  }

  /**
   * Sets one or more properties on a file.
   *
   * TODO(cxone-expert-node): the SDK's Files module does not yet expose a
   * property-write endpoint, so this performs the request directly using the
   * SSM-derived credentials. Remove this method once the SDK supports it.
   *
   * @param subdomain - Library subdomain (e.g. `chem`).
   * @param fileID - Target file ID (or path).
   * @param xmlBody - `<properties>...</properties>` XML payload.
   * @returns True if the request succeeded, false otherwise.
   */
  public async putFileProperties(
    subdomain: string,
    fileID: string | number,
    xmlBody: string
  ): Promise<boolean> {
    try {
      const headers = await this.generateDekiHeaders(subdomain);
      if (!headers) {
        throw new Error(
          `Unable to generate CXOne request headers for library "${subdomain}".`
        );
      }

      const res = await fetch(
        `https://${subdomain}.libretexts.org/@api/deki/files/${fileID}/properties?dream.out.format=json`,
        {
          method: "PUT",
          headers: {
            ...headers,
            "Content-Type": "application/xml",
          },
          body: xmlBody,
        }
      );

      return res.ok;
    } catch (err) {
      debugError(err);
      return false;
    }
  }

  /**
   * Mints the `X-Deki-Token` request headers for a library from its SSM
   * credentials. Only used by {@link putFileProperties}; all other operations
   * delegate token minting to the SDK.
   */
  private async generateDekiHeaders(
    subdomain: string
  ): Promise<Record<string, string> | null> {
    const creds = await this.getLibraryCredentials(subdomain);
    if (!creds) {
      return null;
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
  }
}

export default ExpertWithSSM;
