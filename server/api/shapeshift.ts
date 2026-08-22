import { Response } from "express";
import { z } from "zod";
import { ZodReqWithUser } from "../types";
import { CreateJobValidator, GetJobsValidator, WebhookValidator } from "./validators/shapeshift";
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

export async function getJobs(
  req: ZodReqWithUser<z.infer<typeof GetJobsValidator>>,
  res: Response
) {
  const service = new ShapeshiftService();
  const { jobs, meta } = await service.getOpenJobs(req.query);
  return res.status(200).json({
    err: false,
    msg: 'Retrieved jobs.',
    meta,
    jobs,
  });
}

export async function handleWebhook(
  req: z.infer<typeof WebhookValidator>,
  res: Response
) {
  const service = new ShapeshiftService();
  const result = await service.handleWebhook(req.body);

  if (result === 'accepted') {
    return res.status(202).json({
      err: false,
      msg: 'Webhook accepted. Book is not yet known to Commons; a library sync was queued.',
    });
  }

  if (result === 'invalid_timestamp') {
    return res.status(400).json({
      err: true,
      msg: 'Invalid timestamp for webhook.',
    });
  }

  if (result === 'stale') {
    return res.status(200).json({
      err: false,
      msg: 'Webhook ignored, newer compilation data already recorded.',
    });
  }

  if (result === 'error') {
    return res.status(500).json({
      err: true,
      msg: 'Error processing webhook.',
    });
  }

  return res.status(200).json({
    err: false,
    msg: 'Webhook processed.',
  });
}
