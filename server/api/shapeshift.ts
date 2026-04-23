import { Response } from "express";
import { z } from "zod";
import { ZodReqWithUser } from "../types";
import { CreateJobValidator, GetOpenJobsValidator } from "./validators/shapeshift";
import ShapeshiftService from "./services/shapeshift-service";

export async function createJob(
  req: ZodReqWithUser<z.infer<typeof CreateJobValidator>>,
  res: Response
) {
  const service = new ShapeshiftService();
  const jobId = await service.createJob({
    highPriority: req.body.highPriority,
    url: req.body.url,
  });
  if (!jobId) {
    return res.status(500).json({
      err: true,
      errMsg: 'Error creating job',
    });
  }

  return res.status(200).json({
    err: false,
    msg: 'Created job.',
    jobId,
  });
}

export async function getOpenJobs(
  req: ZodReqWithUser<z.infer<typeof GetOpenJobsValidator>>,
  res: Response
) {
  const service = new ShapeshiftService();
  const jobs = await service.getOpenJobs({
    sort: req.query.sort,
    status: req.query.status,
  });
  return res.status(200).json({
    err: false,
    msg: 'Retrieved open jobs.',
    jobs,
  });
}
