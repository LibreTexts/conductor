import { z } from "zod";
import {
  AddTicketAttachementsValidator,
  AssignTicketValidator,
  CreateTicketValidator,
  GetAssignableUsersValidator,
  GetOpenTicketsValidator,
  GetTicketValidator,
  GetUserTicketsValidator,
  StaffSendTicketMessageValidator,
  UpdateTicketValidator,
} from "./validators/support";
import { NextFunction, Request, Response } from "express";
import { debugError } from "../debug.js";
import { conductor404Err, conductor500Err } from "../util/errorutils.js";
import User from "../models/user.js";
import { v4 } from "uuid";
import SupportTicket, {
  SupportTicketInterface,
} from "../models/supporticket.js";
import SupportTicketMessage from "../models/supporticketmessage.js";
import mailAPI from "../api/mail.js";
import multer from "multer";
import async from "async";
import conductorErrors from "../conductor-errors.js";
import { PutObjectCommand, S3Client, S3ClientConfig } from "@aws-sdk/client-s3";
import { ZodReqWithOptionalUser, ZodReqWithUser } from "../types";
import { getPaginationOffset } from "../util/helpers.js";
import { differenceInMinutes, subDays } from "date-fns";

export const SUPPORT_FILES_S3_CLIENT_CONFIG: S3ClientConfig = {
  credentials: {
    accessKeyId: process.env.AWS_SUPPORTFILES_ACCESS_KEY ?? "",
    secretAccessKey: process.env.AWS_SUPPORTFILES_SECRET_KEY ?? "",
  },
  region: process.env.AWS_SUPPORTFILES_REGION ?? "",
};

async function getTicket(
  req: z.infer<typeof GetTicketValidator>,
  res: Response
) {
  try {
    const { uuid } = req.params;
    const ticket = await SupportTicket.findOne({ uuid }).orFail();
    return res.send({
      err: false,
      ticket,
    });
  } catch (err: any) {
    if (err.name === "DocumentNotFoundError") {
      return conductor404Err(res);
    }
    debugError(err);
    return conductor500Err(res);
  }
}

async function getUserTickets(
  req: ZodReqWithUser<z.infer<typeof GetUserTicketsValidator>>,
  res: Response
) {
  try {
    const { uuid } = req.user?.decoded;
    if (!uuid) {
      return res.send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    let page = 1;
    let limit = 25;
    if (req.query.page) page = req.query.page;
    const offset = getPaginationOffset(page, limit);

    const user = await User.findOne({ uuid }).orFail();
    const tickets = await SupportTicket.find({ user: user._id })
      .skip(offset)
      .limit(limit)
      .populate("user");

    const total = await SupportTicket.countDocuments({ user: user._id });
    return res.send({
      err: false,
      tickets,
      total,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getOpenTickets(
  req: z.infer<typeof GetOpenTicketsValidator>,
  res: Response
) {
  try {
    let page = 1;
    let limit = 25;
    if (req.query.page) page = req.query.page;
    if (req.query.limit) limit = req.query.limit;
    const offset = getPaginationOffset(page, limit);

    const tickets = await SupportTicket.find({ status: "open" })
      .skip(offset)
      .limit(limit)
      .populate("user");

    const total = await SupportTicket.countDocuments({ status: "open" });

    return res.send({
      err: false,
      tickets,
      total,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getSupportMetrics(req: Request, res: Response) {
  try {
    const totalOpenTickets = await SupportTicket.countDocuments({
      status: "open",
    });

    // Get average time between ticket open date and ticket close date
    const closedTickets = await SupportTicket.find({ status: "closed" });
    const totalClosedTickets = closedTickets.length;
    let totalClosedTicketMins = 0;
    closedTickets
      .filter((t) => t.timeOpened && t.timeClosed)
      .forEach((ticket) => {
        const timeOpened = new Date(ticket.timeOpened);
        const timeClosed = new Date(ticket.timeClosed as string);

        totalClosedTicketMins += differenceInMinutes(timeClosed, timeOpened);
      });
    const avgMinsToClose = totalClosedTicketMins / totalClosedTickets;

    const sevenDaysAgo = subDays(new Date(), 7);

    const lastSevenTicketCount = await SupportTicket.countDocuments({
      timeOpened: { $gte: sevenDaysAgo.toISOString() },
    });

    return res.send({
      err: false,
      metrics: {
        totalOpenTickets,
        avgMinsToClose,
        lastSevenTicketCount,
      },
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getAssignableUsers(
  req: z.infer<typeof GetAssignableUsersValidator>,
  res: Response
) {
  try {
    const ticketID = req.params.uuid;

    const ticket = await SupportTicket.findOne({ uuid: ticketID }).orFail();
    const existingAssignees = ticket.assignedUUIDs ?? [];

    const users = await User.find({
      $and: [
        {
          roles: {
            $elemMatch: {
              org: "libretexts",
              role: { $in: ["superadmin", "support"] },
            },
          },
        },
        { uuid: { $nin: existingAssignees } },
      ],
    })
      .select("uuid firstName lastName email")
      .sort({ firstName: 1 });

    return res.send({
      err: false,
      users,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function assignTicket(
  req: z.infer<typeof AssignTicketValidator>,
  res: Response
) {
  try {
    const { uuid } = req.params;
    const { assigned } = req.body;

    const ticket = await SupportTicket.findOneAndUpdate(
      { uuid },
      { assignedUUIDs: assigned }
    ).orFail();

    // TODO: Send email to new assignees

    return res.send({
      err: false,
      ticket,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function ticketAttachmentUploadHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const config = multer({
    storage: multer.memoryStorage(),
    limits: {
      files: 4,
      fileSize: 100000000,
    },
    fileFilter: (_req, file, cb) => {
      if (file.originalname.includes("/")) {
        return cb(new Error("filenameslash"));
      }
      return cb(null, true);
    },
  }).array("attachments", 4);
  return config(req, res, (err) => {
    console.log(err);
    if (err) {
      let errMsg = conductorErrors.err53;
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        errMsg = conductorErrors.err60;
      }
      if (err.message === "filenameslash") {
        errMsg = conductorErrors.err61;
      }
      return res.status(400).send({
        err: true,
        errMsg,
      });
    }
    return next();
  });
}

async function createTicket(
  req: ZodReqWithOptionalUser<z.infer<typeof CreateTicketValidator>>,
  res: Response
) {
  try {
    const { title, description, apps, category, priority, attachments, guest } =
      req.body;
    const userUUID = req.user?.decoded.uuid;

    // If no guest or user, fail
    if (!guest && !userUUID)
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err1,
      });

    let foundUser;
    if (userUUID) {
      foundUser = await User.findOne({ uuid: userUUID }).orFail();
    }

    const ticket = await SupportTicket.create({
      uuid: v4(),
      title,
      description,
      apps,
      category,
      priority,
      attachments,
      user: foundUser ? foundUser.uuid : undefined,
      guest,
      timeOpened: new Date().toISOString(),
    });

    const emailToNotify = await _getTicketAuthorEmail(ticket);
    if (!emailToNotify) return conductor500Err(res);

    const ticketAuthor = foundUser
      ? `${foundUser.firstName} ${foundUser.lastName}`
      : guest
      ? `${guest.firstName} ${guest.lastName}`
      : "Unknown";
    const authorString = `${ticketAuthor} (${emailToNotify})`;

    const submitterPromise = mailAPI.sendSupportTicketCreateConfirmation(
      emailToNotify,
      ticket.uuid
    );
    const teamPromise = mailAPI.sendSupportTicketCreateInternalNotification(
      _getSupportTeamEmails(),
      ticket.uuid,
      ticket.title,
      ticket.description,
      authorString,
      ticket.category,
      ticket.priority
    );

    await Promise.all([submitterPromise, teamPromise]);

    return res.send({
      err: false,
      ticket,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function addTicketAttachments(
  req: z.infer<typeof AddTicketAttachementsValidator> & {
    files?: Express.Multer.File[];
  },
  res: Response
) {
  try {
    const { uuid } = req.params;

    const ticket = await SupportTicket.findOne({ uuid }).orFail();

    // If no files, no-op, just return the ticket
    if (!req.files || req.files.length === 0) {
      return res.send({
        err: false,
        ticket,
      });
    }

    const uploadedFiles = await _uploadTicketAttachments(
      ticket.uuid,
      req.files
    );
    ticket.attachments = [...(ticket.attachments ?? []), ...uploadedFiles];
    await ticket.save();

    return res.send({
      err: false,
      ticket,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function updateTicket(
  req: z.infer<typeof UpdateTicketValidator>,
  res: Response
) {
  try {
    const { uuid } = req.params;
    const { priority, status } = req.body;

    const ticket = await SupportTicket.findOneAndUpdate(
      { uuid },
      {
        priority,
        status,
        timeClosed: status === "closed" ? new Date().toISOString() : undefined, // if status is closed, set timeClosed to now
      }
    ).orFail();

    return res.send({
      err: false,
      ticket,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getTicketMessages(
  req: z.infer<typeof GetTicketValidator>,
  res: Response
) {
  try {
    const { uuid } = req.params;
    const ticket = await SupportTicket.findOne({ uuid }).orFail();
    const ticketMessages = await SupportTicketMessage.find({
      ticket: ticket.uuid,
    }).sort({ createdAt: -1 });

    return res.send({
      err: false,
      messages: ticketMessages,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function createStaffMessage(
  req: z.infer<typeof StaffSendTicketMessageValidator>,
  res: Response
) {
  try {
    const { uuid } = req.params;
    const { message, attachments } = req.body;

    const ticket = await SupportTicket.findOne({ uuid }).orFail();

    const ticketMessage = await SupportTicketMessage.create({
      uuid: v4(),
      ticket: ticket.uuid,
      message,
      attachments,
      sender: "Staff User",
      timeSent: new Date().toISOString(),
    });

    // Fail silently if no email to notify - we still want to save the message
    const emailToNotify = await _getTicketAuthorEmail(ticket);
    if (emailToNotify) {
      await mailAPI.sendNewTicketMessageNotification(
        [emailToNotify],
        ticket.uuid,
        ticket.title,
        "requester"
      );
    }

    return res.send({
      err: false,
      message: ticketMessage,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function _uploadTicketAttachments(
  ticketID: string,
  files: Express.Multer.File[]
): Promise<string[]> {
  try {
    if (
      !SUPPORT_FILES_S3_CLIENT_CONFIG ||
      !process.env.AWS_SUPPORTFILES_BUCKET ||
      !process.env.AWS_SUPPORTFILES_DOMAIN
    ) {
      throw new Error("Missing file storage config");
    }

    const storageClient = new S3Client(SUPPORT_FILES_S3_CLIENT_CONFIG);
    const uploadCommands: PutObjectCommand[] = [];
    const savedFiles: string[] = [];

    files.forEach((file) => {
      const fileUUID = v4();
      const fileKey = `${ticketID}/${fileUUID}`;
      const contentType = file.mimetype || "application/octet-stream";
      uploadCommands.push(
        new PutObjectCommand({
          Bucket: process.env.AWS_SUPPORTFILES_BUCKET,
          Key: fileKey,
          Body: file.buffer,
          ContentDisposition: `attachment; filename="${fileUUID}"`,
          ContentType: contentType,
        })
      );
      savedFiles.push(fileUUID);
    });

    await async.eachLimit(uploadCommands, 2, async (command) =>
      storageClient.send(command)
    );

    return savedFiles;
  } catch (err) {
    throw err;
  }
}

const _getSupportTeamEmails = () => {
  return process.env.SUPPORT_TEAM_EMAILS?.split(";") || [];
};

const _getTicketAuthorEmail = async (
  ticket: SupportTicketInterface
): Promise<string | undefined> => {
  const hasUser = !!ticket.userUUID;
  if (hasUser) {
    const foundUser = await User.findOne({ _id: ticket.userUUID });
    return foundUser?.email;
  }
  if (ticket.guest) {
    return ticket.guest.email;
  }
  return undefined;
};

export default {
  getTicket,
  getUserTickets,
  getOpenTickets,
  getSupportMetrics,
  getAssignableUsers,
  assignTicket,
  createTicket,
  addTicketAttachments,
  updateTicket,
  createStaffMessage,
  getTicketMessages,
  ticketAttachmentUploadHandler,
};
