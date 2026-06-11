import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { randomUUID } from "node:crypto";
import BookBotRun, {
  BookBotRunInterface,
  BookBotRunPage,
  BookBotRunState,
  BookBotType,
} from "../../models/bookbotrun";
import { isValidLibretextsURL } from "../validators/book-bots";
import { debugError } from "../../debug";

export interface RunnerCallbackPayload {
  jobId: string;
  state: Exclude<BookBotRunState, "queued">;
  percentage?: number;
  pages?: BookBotRunPage[];
  message?: string;
  messages?: string[];
}

export interface SubmitJobInput {
  botType: BookBotType;
  rootURL: string;
  triggeredBy: string;
  libreUser: string;
}

export interface ListRunsParams {
  botType?: BookBotType;
  page: number;
  limit: number;
}

interface RunnerContext {
  cluster: string;
  securityGroups: string[];
  subnets: string[];
}

const CALLBACK_KEY_SSM_PATH = "/conductor/runner-callback-key";

let cachedRunnerContext: RunnerContext | null = null;
let cachedCallbackKey: { value: string; refreshAfter: Date } | null = null;
const ssm = new SSMClient({ region: process.env.AWS_REGION });

async function resolveRunnerContext(): Promise<RunnerContext> {
  if (cachedRunnerContext) return cachedRunnerContext;

  const subnetsRaw = process.env.RUNNER_SUBNETS;
  if (!subnetsRaw) {
    throw new Error("RUNNER_SUBNETS env var not configured");
  }
  const subnets = subnetsRaw.split(",").map((s) => s.trim()).filter(Boolean);

  const metadataUri = process.env.ECS_CONTAINER_METADATA_URI_V4;
  if (!metadataUri) {
    const cluster = process.env.RUNNER_ECS_CLUSTER;
    const sgRaw = process.env.RUNNER_SECURITY_GROUPS;
    if (!cluster || !sgRaw) {
      throw new Error(
        "Running outside ECS — RUNNER_ECS_CLUSTER and RUNNER_SECURITY_GROUPS must be set",
      );
    }
    cachedRunnerContext = {
      cluster,
      securityGroups: sgRaw.split(",").map((s) => s.trim()).filter(Boolean),
      subnets,
    };
    return cachedRunnerContext;
  }

  const taskRes = await fetch(`${metadataUri}/task`);
  if (!taskRes.ok) {
    throw new Error(`ECS task metadata fetch failed: ${taskRes.status}`);
  }
  const task = (await taskRes.json()) as {
    Cluster: string;
    Containers: { Networks: { SecurityGroups?: string[] }[] }[];
  };
  const securityGroups = task.Containers?.[0]?.Networks?.[0]?.SecurityGroups ?? [];

  cachedRunnerContext = {
    cluster: task.Cluster,
    securityGroups,
    subnets,
  };
  return cachedRunnerContext;
}

export async function getRunnerCallbackKey(): Promise<string> {
  if (cachedCallbackKey && cachedCallbackKey.refreshAfter > new Date()) {
    return cachedCallbackKey.value;
  }
  const res = await ssm.send(
    new GetParameterCommand({
      Name: CALLBACK_KEY_SSM_PATH,
      WithDecryption: true,
    }),
  );
  const value = res.Parameter?.Value;
  if (!value) {
    throw new Error(`SSM parameter ${CALLBACK_KEY_SSM_PATH} not found`);
  }
  cachedCallbackKey = {
    value,
    refreshAfter: new Date(Date.now() + 30 * 60 * 1000),
  };
  return value;
}

export default class BookBotService {
  private ecs: ECSClient = new ECSClient({ region: process.env.AWS_REGION });

  static isValidLibretextsURL(raw: string): boolean {
    return isValidLibretextsURL(raw);
  }

  public async submitJob(input: SubmitJobInput): Promise<string> {
    if (!BookBotService.isValidLibretextsURL(input.rootURL)) {
      throw new Error("rootURL failed *.libretexts.org validation");
    }

    const jobID = randomUUID();
    await BookBotRun.create({
      jobID,
      botType: input.botType,
      triggeredBy: input.triggeredBy,
      rootURL: input.rootURL,
      libreUser: input.libreUser,
      state: "queued",
      pages: [],
      logs: [
        {
          ts: new Date(),
          state: "queued",
          message: `Job queued by ${input.triggeredBy}`,
        },
      ],
    });

    try {
      switch (input.botType) {
        case "editor-preprocess":
          await this.submitEditorPreprocess(jobID, input.rootURL);
          break;
        default:
          throw new Error(`Unsupported botType: ${input.botType}`);
      }
    } catch (err) {
      debugError(err);
      await BookBotRun.updateOne(
        { jobID },
        {
          $set: {
            state: "error",
            errorMessage: err instanceof Error ? err.message : String(err),
            endedAt: new Date(),
          },
          $push: {
            logs: {
              ts: new Date(),
              state: "error",
              message: `Failed to start runner: ${err instanceof Error ? err.message : String(err)}`,
            },
          },
        },
      );
      throw err;
    }

    return jobID;
  }

  private async submitEditorPreprocess(
    jobID: string,
    rootURL: string
  ): Promise<void> {
    const callbackBase = process.env.CONDUCTOR_BASE_URL;
    if (!callbackBase) {
      throw new Error("CONDUCTOR_BASE_URL env var not configured");
    }

    const { cluster, securityGroups, subnets } = await resolveRunnerContext();
    const taskDefinition = 'editor-preprocess-runner';
    const callbackUrl = `${callbackBase.replace(/\/$/, "")}/api/v1/bot-jobs/${jobID}`;

    await this.ecs.send(
      new RunTaskCommand({
        cluster,
        taskDefinition,
        launchType: "FARGATE",
        count: 1,
        networkConfiguration: {
          awsvpcConfiguration: {
            subnets,
            securityGroups,
            assignPublicIp: "DISABLED",
          },
        },
        overrides: {
          containerOverrides: [
            {
              name: "runner",
              environment: [
                { name: "JOB_ID", value: jobID },
                { name: "ROOT_URL", value: rootURL },
                { name: "CALLBACK_URL", value: callbackUrl },
                { name: "PARALLELISM", value: "3" },
              ],
            },
          ],
        },
        tags: [
          { key: "jobType", value: "editorPreprocess" },
          { key: "jobId", value: jobID },
        ],
      }),
    );
  }

  public async applyCallback(
    jobID: string,
    payload: RunnerCallbackPayload,
  ): Promise<void> {
    const existing = await BookBotRun.findOne({ jobID });
    if (!existing) {
      throw new Error(`Unknown jobID: ${jobID}`);
    }

    const now = new Date();
    const isTerminal =
      existing.state === "done" || existing.state === "error";

    const set: Record<string, any> = { updatedAt: now };
    if (!isTerminal) {
      set.state = payload.state;
      if (typeof payload.percentage === "number") {
        set.percentage = payload.percentage;
      }
      if (payload.state === "error" && payload.message) {
        set.errorMessage = payload.message;
      }
      if (!existing.startedAt) {
        set.startedAt = now;
      }
      if (payload.state === "done" || payload.state === "error") {
        set.endedAt = now;
      }
      if (payload.state === "done" && payload.pages) {
        set.pages = payload.pages;
      }
    }

    const update: any = { $set: set, $push: {} };

    if (!isTerminal) {
      update.$push.logs = {
        ts: now,
        state: payload.state,
        message: payload.message,
        percentage: payload.percentage,
      };
      if (payload.state === "processing" && payload.pages?.length) {
        update.$push.pages = { $each: payload.pages };
      }
    }

    if (payload.messages?.length) {
      update.$push.messages = { $each: payload.messages };
    }

    if (Object.keys(update.$push).length === 0) {
      delete update.$push;
    }

    await BookBotRun.updateOne({ jobID }, update);
  }

  public async getRun(jobID: string): Promise<BookBotRunInterface | null> {
    return BookBotRun.findOne({ jobID }).lean<BookBotRunInterface | null>();
  }

  public async listRuns(
    params: ListRunsParams,
  ): Promise<{ runs: BookBotRunInterface[]; total: number }> {
    const filter: Record<string, any> = {};
    if (params.botType) filter.botType = params.botType;

    const [runs, total] = await Promise.all([
      BookBotRun.find(filter)
        .sort({ createdAt: -1 })
        .skip((params.page - 1) * params.limit)
        .limit(params.limit)
        .lean<BookBotRunInterface[]>(),
      BookBotRun.countDocuments(filter),
    ]);

    return { runs, total };
  }
}
