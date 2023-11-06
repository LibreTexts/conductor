import { SSMClient, GetParametersByPathCommand } from "@aws-sdk/client-ssm";
import { debugError } from "../debug.js";
import {
  LibrariesClient,
  LibraryAPIRequestHeaders,
  LibraryTokenPair,
} from "../types/LibrariesClient.js";
import { createHmac } from "crypto";

export async function generateLibrariesClient(): Promise<LibrariesClient | null> {
  try {
    const libTokenPairPath =
      process.env.AWS_SSM_LIB_TOKEN_PAIR_PATH || "/production/libraries";
    const apiUsername = process.env.LIBRARIES_API_USERNAME || "LibreBot";

    const ssm = new SSMClient({
      credentials: {
        accessKeyId: process.env.AWS_SSM_ACCESS_KEY_ID || "unknown",
        secretAccessKey: process.env.AWS_SSM_SECRET_KEY || "unknown",
      },
      region: process.env.AWS_SSM_REGION || "unknown",
    });

    return {
      apiUsername,
      libTokenPairPath,
      ssm,
    };
  } catch (err) {
    debugError(err);
    return null;
  }
}

/**
 * Retrieves the token pair requried to interact with a library's API.
 */
export async function getLibraryTokenPair(
  lib: string,
  client: LibrariesClient
): Promise<LibraryTokenPair | null> {
  try {
    const basePath = client.libTokenPairPath.endsWith("/")
      ? client.libTokenPairPath
      : `${client.libTokenPairPath}/`;
    const pairResponse = await client.ssm.send(
      new GetParametersByPathCommand({
        Path: `${basePath}${lib}`,
        MaxResults: 10,
        Recursive: true,
        WithDecryption: true,
      })
    );
    if (pairResponse.$metadata.httpStatusCode !== 200) {
      console.error({
        msg: "Error retrieving library token pair!",
        lib,
        metadata: pairResponse.$metadata,
      });
      throw new Error("Error retrieving library token pair.");
    }
    if (!pairResponse.Parameters) {
      console.error({
        msg: "No results returned during library token pair retrieval!",
        lib,
      });
      throw new Error("Error retrieving library token pair.");
    }
    const libKey = pairResponse.Parameters.find((p) =>
      p.Name?.includes(`${lib}/key`)
    );
    const libSec = pairResponse.Parameters.find((p) =>
      p.Name?.includes(`${lib}/secret`)
    );
    if (!libKey?.Value || !libSec?.Value) {
      console.error({
        msg: "Requried parameter not found during library token pair retrieval!",
      });
      throw new Error("Error retrieving library token pair.");
    }
    return {
      key: libKey.Value,
      secret: libSec.Value,
    };
  } catch (err) {
    debugError(err);
    return null;
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
    const libsClient = await generateLibrariesClient();
    if (!libsClient) {
      throw new Error("Error generating libraries client.");
    }
    const keyPair = await getLibraryTokenPair(lib, libsClient);
    if (!keyPair) {
      throw new Error("Error generating library token pair.");
    }

    const epoch = Math.floor(Date.now() / 1000);
    const hmac = createHmac("sha256", keyPair.secret);
    hmac.update(`${keyPair.key}${epoch}=${libsClient.apiUsername}`);
    return {
      "X-Deki-Token": `${keyPair.key}_${epoch}_=${
        libsClient.apiUsername
      }_${hmac.digest("hex")}`,
      "X-Requested-With": "XMLHttpRequest",
    };
  } catch (err) {
    debugError(err);
    return null;
  }
}
