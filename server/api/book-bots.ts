import { NextFunction, Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { TypedReqWithUser, ZodReqWithUser } from "../types";
import User from "../models/user";
import BookBotService, {
  RunnerCallbackPayload,
  getRunnerCallbackKey,
} from "./services/book-bot-service";
import {
  GetBookBotRunValidator,
  ListBookBotRunsValidator,
  RunnerCallbackValidator,
  SubmitEditorPreprocessValidator,
} from "./validators/book-bots";
import { debugError } from "../debug";

function safeBearerEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // Constant-time compare against self to keep timing stable even on length mismatch.
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

export async function verifyRunnerCallback(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  let expectedKey: string;
  try {
    expectedKey = await getRunnerCallbackKey();
  } catch (err) {
    debugError(err);
    return res.status(500).end();
  }
  const header = req.get("authorization") || "";
  const expected = `Bearer ${expectedKey}`;
  if (!safeBearerEqual(header, expected)) {
    return res.status(401).end();
  }
  return next();
}

export async function submitEditorPreprocessJob(
  req: ZodReqWithUser<z.infer<typeof SubmitEditorPreprocessValidator>>,
  res: Response,
) {
  try {
    const service = new BookBotService();
    const user = await User.findOne({ uuid: req.user.decoded.uuid }).lean();
    if (!user) {
      return res.status(404).json({ err: true, errMsg: "User not found." });
    }

    const jobID = await service.submitJob({
      botType: "editor-preprocess",
      rootURL: req.body.url,
      triggeredBy: user.uuid,
      libreUser: user.email,
    });

    return res.status(202).json({
      err: false,
      msg: "Job submitted.",
      jobID,
    });
  } catch (err) {
    debugError(err);
    return res.status(500).json({
      err: true,
      errMsg:
        err instanceof Error
          ? `Failed to submit job: ${err.message}`
          : "Failed to submit job.",
    });
  }
}

export async function getBookBotRun(
  req: ZodReqWithUser<z.infer<typeof GetBookBotRunValidator>>,
  res: Response,
) {
  const service = new BookBotService();
  const run = await service.getRun(req.params.jobID);
  if (!run) {
    return res.status(404).json({ err: true, errMsg: "Run not found." });
  }
  return res.status(200).json({
    err: false,
    msg: "Retrieved run.",
    run,
  });
}

export async function listBookBotRuns(
  req: ZodReqWithUser<z.infer<typeof ListBookBotRunsValidator>>,
  res: Response,
) {
  const service = new BookBotService();
  const { botType, page, limit } = req.query;
  const { runs, total } = await service.listRuns({ botType, page, limit });
  return res.status(200).json({
    err: false,
    msg: "Retrieved runs.",
    runs,
    meta: { page, limit, total },
  });
}

export async function handleRunnerCallback(
  req: Request & z.infer<typeof RunnerCallbackValidator>,
  res: Response,
) {
  try {
    const service = new BookBotService();
    await service.applyCallback(
      req.params.jobID as string,
      req.body as RunnerCallbackPayload,
    );
    return res.status(204).end();
  } catch (err) {
    debugError(err);
    return res.status(500).end();
  }
}
