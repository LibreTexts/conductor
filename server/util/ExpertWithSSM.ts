import logger from "../logger.js";
import { SSMClient, GetParametersByPathCommand } from "@aws-sdk/client-ssm";
import Expert from "@libretexts/cxone-expert-node";
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
        logger.error({ err: pairResponse.$metadata }, "getLibraryCredentials failed");
        throw new Error("Error retrieving library token pair.");
      }
      if (!pairResponse.Parameters) {
        logger.error("No data returned from token pair retrieval. Lib: " + lib);
        throw new Error("Error retrieving library token pair.");
      }

      const libKey = pairResponse.Parameters.find((p) =>
        p.Name?.includes(`${lib}/key`)
      );
      const libSec = pairResponse.Parameters.find((p) =>
        p.Name?.includes(`${lib}/secret`)
      );
      if (!libKey?.Value || !libSec?.Value) {
        logger.error("Key param not found in token pair retrieval. Lib: " + lib);
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
      logger.error({ err }, "getLibraryCredentials failed");
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
}

export default ExpertWithSSM;
