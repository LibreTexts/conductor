/**
 * Generates the Ed25519 key pair for H5P authoring capability tokens and puts
 * each half where it belongs, without ever printing the private key.
 *
 * Conductor signs capability tokens with the private key; the H5P service
 * verifies them with the public key (H5P_AUTHORING_DESIGN.md, section 1). Use
 * one pair per environment, with the environment in the `kid`, so a token from
 * one environment can never verify in another.
 *
 * Local development: appends both halves to the two .env files.
 *
 *   node scripts/generate-h5p-capability-keys.mjs --kid local-2026-10 --local
 *     [--conductor-env .env] [--h5p-env ../../h5p-service/.env]
 *
 *   Writes H5P_CAPABILITY_PRIVATE_KEY to Conductor's .env and
 *   CAPABILITY_TOKEN_PUBLIC_KEYS to the H5P service's .env. Refuses if either
 *   variable is already set there, rather than leaving two values behind.
 *
 * Deployed environments: stores the private half in Secrets Manager.
 *
 *   node scripts/generate-h5p-capability-keys.mjs --kid staging-2026-10 \
 *     --secret-id <secret name or ARN> [--region us-west-2] [--profile name]
 *
 *   Writes the private JWK as the secret's value (creating the secret if it
 *   does not exist) and prints the public JWK set, which is not secret, for
 *   the H5P service's CAPABILITY_TOKEN_PUBLIC_KEYS. Conductor then gets the
 *   private key through the usual {{resolve:secretsmanager:...}} injection
 *   into H5P_CAPABILITY_PRIVATE_KEY. This script only ever writes the secret;
 *   it never reads one.
 *
 * Rotation: generate a new pair with a new kid. Add its public key to the H5P
 * service's list next to the old one, switch Conductor to the new private key,
 * and remove the old public key once its tokens have expired (15 minutes).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { exportJWK, generateKeyPair } from "jose";

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) fail(`unexpected argument "${a}"`);
    const key = a.slice(2);
    const next = argv[i + 1];
    if (key === "local") args.local = true;
    else if (next === undefined || next.startsWith("--")) fail(`--${key} needs a value`);
    else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const known = new Set(["kid", "local", "conductor-env", "h5p-env", "secret-id", "region", "profile"]);
for (const k of Object.keys(args)) if (!known.has(k)) fail(`unknown option --${k}`);
if (!args.kid || !/^[A-Za-z0-9._-]{1,64}$/.test(args.kid)) {
  fail('--kid is required: 1 to 64 letters, digits, ".", "_" or "-", e.g. local-2026-10');
}
if (Boolean(args.local) === Boolean(args["secret-id"])) fail("choose exactly one of --local or --secret-id");

const { publicKey, privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
const publicJwk = { ...(await exportJWK(publicKey)), kid: args.kid };
const privateJwk = { ...(await exportJWK(privateKey)), kid: args.kid };
const publicSet = JSON.stringify({ keys: [publicJwk] });
const privateValue = JSON.stringify(privateJwk);

if (args.local) {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const serverDir = path.resolve(scriptDir, "..");
  const conductorEnv = path.resolve(serverDir, args["conductor-env"] ?? ".env");
  const h5pEnv = path.resolve(serverDir, args["h5p-env"] ?? "../../h5p-service/.env");

  // Check both files before writing either, so a refusal leaves nothing half done.
  const targets = [
    { file: conductorEnv, name: "H5P_CAPABILITY_PRIVATE_KEY", value: privateValue },
    { file: h5pEnv, name: "CAPABILITY_TOKEN_PUBLIC_KEYS", value: publicSet },
  ];
  for (const t of targets) {
    if (!fs.existsSync(t.file)) fail(`${t.file} does not exist`);
    const defined = fs
      .readFileSync(t.file, "utf8")
      .split(/\r?\n/)
      .some((line) => new RegExp(`^\\s*(export\\s+)?${t.name}\\s*=`).test(line));
    if (defined) fail(`${t.name} is already set in ${t.file}. Remove it first if you mean to replace it.`);
  }
  for (const t of targets) {
    const current = fs.readFileSync(t.file, "utf8");
    const eol = current.includes("\r\n") ? "\r\n" : "\n";
    const separator = current.length === 0 || current.endsWith("\n") ? "" : eol;
    // Single quotes keep the JSON intact for dotenv and Node's --env-file.
    fs.appendFileSync(t.file, `${separator}${t.name}='${t.value}'${eol}`);
    console.log(`wrote ${t.name} to ${t.file}`);
  }
  console.log(`\nkid: ${args.kid}. The private key was written to Conductor's .env only and not shown.`);
  process.exit(0);
}

// --secret-id: hand the private JWK to the AWS CLI through a file only this
// user can read, never through the command line, where it would be visible in
// the process list.
const secretId = args["secret-id"];
const common = [
  ...(args.region ? ["--region", args.region] : []),
  ...(args.profile ? ["--profile", args.profile] : []),
];
const tmpFile = path.join(os.tmpdir(), `h5p-capability-${crypto.randomUUID()}.json`);
fs.writeFileSync(tmpFile, privateValue, { mode: 0o600 });

function aws(cliArgs) {
  // aws is aws.cmd on some Windows installs, which needs a shell to resolve,
  // and a shell splits on spaces, so quote any argument that has one.
  const onWindows = process.platform === "win32";
  const all = [...cliArgs, ...common, "--output", "json"].map((a) =>
    onWindows && /[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a
  );
  return spawnSync("aws", all, { encoding: "utf8", shell: onWindows });
}

let ok = false;
try {
  const fileArg = `file://${tmpFile.replace(/\\/g, "/")}`;
  let r = aws(["secretsmanager", "put-secret-value", "--secret-id", secretId, "--secret-string", fileArg]);
  if (r.status !== 0 && /ResourceNotFoundException/.test(r.stderr)) {
    r = aws([
      "secretsmanager",
      "create-secret",
      "--name",
      secretId,
      "--description",
      `H5P authoring capability token signing key (Ed25519 JWK), kid ${args.kid}`,
      "--secret-string",
      fileArg,
    ]);
  }
  if (r.error) fail(`could not run the AWS CLI: ${r.error.message}`);
  if (r.status !== 0) fail(`the AWS CLI failed:\n${r.stderr.trim()}`);
  ok = true;
} finally {
  // Overwrite before deleting, so the key does not linger in freed blocks.
  try {
    fs.writeFileSync(tmpFile, "0".repeat(privateValue.length));
    fs.unlinkSync(tmpFile);
  } catch {
    console.error(`warning: could not remove ${tmpFile}. Delete it by hand.`);
  }
}

if (ok) {
  console.log(`Stored the private key for kid ${args.kid} in Secrets Manager secret "${secretId}". Not shown.`);
  console.log("\nPublic key set for the H5P service's CAPABILITY_TOKEN_PUBLIC_KEYS (not secret):\n");
  console.log(publicSet);
}
