import { z } from "zod";
import {
  AddTicketAttachementsValidator,
  AssignTicketValidator,
  CreateTicketValidator,
  DeleteTicketValidator,
  GetAssignableUsersValidator,
  GetClosedTicketsValidator,
  GetOpenTicketsValidator,
  GetTicketAttachmentValidator,
  GetTicketValidator,
  GetUserTicketsValidator,
  SendTicketMessageValidator,
  UpdateTicketValidator,
} from "./validators/support";
import { NextFunction, Request, Response } from "express";
import { debugError } from "../debug.js";
import { conductor404Err, conductor500Err } from "../util/errorutils.js";
import User, {
  SanitizedUserSelectProjection,
  UserInterface,
} from "../models/user.js";
import { v4 } from "uuid";
import SupportTicket, {
  SupportTicketAttachmentInterface,
  SupportTicketFeedEntryInterface,
  SupportTicketInterface,
} from "../models/supporticket.js";
import SupportTicketMessage from "../models/supporticketmessage.js";
import mailAPI from "../api/mail.js";
import multer from "multer";
import async from "async";
import conductorErrors from "../conductor-errors.js";
import { PutObjectCommand, S3Client, S3ClientConfig } from "@aws-sdk/client-s3";
import {
  GenericKeyTextValueObj,
  ZodReqWithOptionalUser,
  ZodReqWithUser,
} from "../types";
import {
  assembleUrl,
  capitalizeFirstLetter,
  getPaginationOffset,
} from "../util/helpers.js";
import { addMonths, differenceInMinutes, subDays } from "date-fns";
import { randomBytes } from "crypto";
import { ZodReqWithFiles } from "../types/Express";
import { getSignedUrl } from "@aws-sdk/cloudfront-signer";
import base64 from "base-64";
import Organization from "../models/organization.js";

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
    const ticket = await SupportTicket.findOneAndUpdate(
      { uuid },
      {
        guestAccessKeyExpiration: _getGuestAccessKeyExpiration(), // update the expiration when ticket is accessed
      }
    )
      .populate("user")
      .populate("assignedUsers")
      .orFail();

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

    const getSortObj = () => {
      if (req.query.sort === "priority") {
        return { priority: -1 };
      }
      if (req.query.sort === "status") {
        return { status: -1 };
      }
      return { timeOpened: -1 };
    };

    const sortObj = getSortObj();

    const tickets = await SupportTicket.find({ userUUID: uuid })
      .skip(offset)
      .limit(limit)
      .sort(sortObj as any)
      .populate("user");

    const total = await SupportTicket.countDocuments({ userUUID: uuid });
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

async function getOpenInProgressTickets(
  req: z.infer<typeof GetOpenTicketsValidator>,
  res: Response
) {
  try {
    let page = 1;
    let limit = 25;
    if (req.query.page) page = req.query.page;
    if (req.query.limit) limit = parseInt(req.query.limit.toString());
    const offset = getPaginationOffset(page, limit);

    const { assignee, category, priority } = req.query;

    const getSortObj = () => {
      if (req.query.sort === "status") {
        return { status: -1 };
      }
      if (req.query.sort === "category") {
        return { category: 1 };
      }
      return { timeOpened: -1 };
    };

    const sortObj = getSortObj();

    const tickets = await SupportTicket.find({
      status: { $in: ["open", "in_progress"] },
      ...(assignee ? { assignedUUIDs: assignee } : {}),
      ...(category ? { category } : {}),
      ...(priority ? { priority } : {}),
    })
      .sort(sortObj as any)
      .populate("assignedUsers")
      .populate("user")
      .exec();

    const unfiltered = (await SupportTicket.find({
      status: { $in: ["open", "in_progress"] },
    })
      .populate("assignedUsers")
      .populate("user")
      .exec()) as (SupportTicketInterface & {
      assignedUsers?: UserInterface[];
      user?: UserInterface;
    })[];

    // We have to sort the tickets in memory because we can only alphabetically sort by priority in query
    if (req.query.sort === "priority") {
      tickets.sort((a, b) => {
        if (a.priority === "high" && b.priority !== "high") return -1;
        if (a.priority !== "high" && b.priority === "high") return 1;
        if (a.priority === "medium" && b.priority === "low") return -1;
        if (a.priority === "low" && b.priority === "medium") return 1;
        return 0;
      });
    }

    const assigneeOptions = unfiltered?.reduce((acc, ticket) => {
      if (!ticket.assignedUsers) return acc;
      if (ticket.assignedUsers) {
        ticket.assignedUsers.forEach((u) => {
          if (!acc.find((a) => a.key === u.uuid)) {
            acc.push({ key: u.uuid, text: u.firstName, value: u.uuid });
          }
        });
      }
      return acc;
    }, [] as GenericKeyTextValueObj<string>[]);

    const priorityOptions = unfiltered?.reduce((acc, ticket) => {
      if (!ticket.priority) return acc;
      if (!acc.find((p) => p.key === ticket.priority)) {
        acc.push({
          key: ticket.priority,
          text: ticket.priority,
          value: ticket.priority,
        });
      }
      return acc;
    }, [] as GenericKeyTextValueObj<string>[]);

    const categoryOptions = unfiltered?.reduce((acc, ticket) => {
      if (!ticket.category) return acc;
      if (!acc.find((c) => c.key === ticket.category)) {
        acc.push({
          key: ticket.category,
          text: ticket.category,
          value: ticket.category,
        });
      }
      return acc;
    }, [] as GenericKeyTextValueObj<string>[]);

    assigneeOptions?.sort((a, b) => a.text.localeCompare(b.text, "en"));
    priorityOptions?.sort((a, b) => a.text.localeCompare(b.text, "en"));
    categoryOptions?.sort((a, b) => a.text.localeCompare(b.text, "en"));

    const assigneePretty = assigneeOptions?.map((a) => {
      return {
        key: a.key,
        text: capitalizeFirstLetter(a.text),
        value: a.value,
      };
    });
    const priorityPretty = priorityOptions?.map((p) => {
      return {
        key: p.key,
        text: capitalizeFirstLetter(p.text),
        value: p.value,
      };
    });
    const categoryPretty = categoryOptions?.map((c) => {
      return {
        key: c.key,
        text: capitalizeFirstLetter(c.text),
        value: c.value,
      };
    });

    const paginated = tickets.slice(offset, offset + limit);

    return res.send({
      err: false,
      tickets: paginated,
      total: tickets.length || 0,
      filters: {
        assignee: assigneePretty,
        priority: priorityPretty,
        category: categoryPretty,
      },
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getClosedTickets(
  req: z.infer<typeof GetClosedTicketsValidator>,
  res: Response
) {
  try {
    let page = 1;
    let limit = 25;
    if (req.query.page) page = req.query.page;
    if (req.query.limit) limit = parseInt(req.query.limit.toString());
    const offset = getPaginationOffset(page, limit);

    const getSortObj = () => {
      if (req.query.sort === "priority") {
        return { priority: -1 };
      }
      if (req.query.sort === "closed") {
        return { timeClosed: -1 };
      }
      return { timeOpened: -1 };
    };

    const sortObj = getSortObj();

    const tickets = await SupportTicket.find({
      status: "closed",
    })
      .skip(offset)
      .limit(limit)
      .sort(sortObj as any)
      .populate("assignedUsers")
      .populate("user")
      .exec();

    const total = await SupportTicket.countDocuments({
      status: "closed",
    });

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
      status: { $in: ["open", "in_progress"] },
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
    const avgMinsToClose = Math.ceil(
      totalClosedTicketMins / totalClosedTickets
    );

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
  req: ZodReqWithUser<z.infer<typeof AssignTicketValidator>>,
  res: Response
) {
  try {
    const { uuid } = req.params;
    const { assigned } = req.body;
    const assignerId = req.user.decoded.uuid;

    const assigner = await User.findOne({ uuid: assignerId })
      .select("firstName lastName")
      .orFail();

    const assignees = await User.find({ uuid: { $in: assigned } }).orFail();
    const assigneeEmails = assignees.map((a) => a.email);

    const ticket = await SupportTicket.findOne({ uuid }).orFail();

    // Check that ticket is open or in progress
    if (!["open", "in_progress"].includes(ticket.status)) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err89,
      });
    }

    // Create a feed entry for the assignment
    const feedEntry = _createFeedEntry_Assigned(
      `${assigner.firstName} ${assigner.lastName}`,
      assignees.map((a) => `${a.firstName} ${a.lastName}`)
    );

    // Get metadata for notification emails
    let ticketUser;
    if (ticket.userUUID) {
      ticketUser = await User.findOne({ uuid: ticket.userUUID });
    }
    const authorEmail = await _getTicketAuthorEmail(ticket);
    const authorString = _getTicketAuthorString(
      authorEmail ?? "Unknown",
      ticketUser ?? undefined,
      ticket.guest ?? undefined
    );

    // Update the ticket with the new assigned users and set status to in_progress
    await SupportTicket.updateOne(
      { uuid },
      {
        assignedUUIDs: assigned,
        status: "in_progress",
        $push: { feed: feedEntry },
      }
    ).orFail();

    // Notify the assignees
    await mailAPI.sendSupportTicketAssignedNotification(
      assigneeEmails,
      ticket.uuid,
      ticket.title,
      assigner.firstName,
      authorString,
      capitalizeFirstLetter(ticket.category),
      capitalizeFirstLetter(ticket.priority),
      ticket.description
    );

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
  }).array("files", 4);
  return config(req, res, (err) => {
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
    const {
      title,
      description,
      apps,
      category,
      priority,
      attachments,
      guest,
      capturedURL,
    } = req.body;
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

    const feedEntry = _createFeedEntry_Created(
      foundUser?.firstName
        ? `${foundUser.firstName} ${foundUser.lastName}`
        : `${guest?.firstName} ${guest?.lastName}`
    );

    const guestAccessKey = _createGuestAccessKey();

    const ticket = await SupportTicket.create({
      uuid: v4(),
      title,
      description,
      apps,
      category,
      priority,
      capturedURL,
      attachments,
      userUUID: foundUser?.uuid ? foundUser.uuid : undefined,
      guest,
      timeOpened: new Date().toISOString(),
      feed: [feedEntry],
      guestAccessKey,
      guestAccessKeyExpiration: _getGuestAccessKeyExpiration(),
    });

    const emailToNotify = await _getTicketAuthorEmail(ticket);
    if (!emailToNotify) return conductor500Err(res);

    const authorString = _getTicketAuthorString(
      emailToNotify,
      foundUser,
      guest
    );

    const params = new URLSearchParams();
    params.append("accessKey", guestAccessKey);
    const addParams = !foundUser?.uuid ? true : false; // if guest, append access key to ticket path

    const emailPromises = [];
    const submitterPromise = mailAPI.sendSupportTicketCreateConfirmation(
      emailToNotify,
      ticket.uuid,
      addParams ? params.toString() : ""
    );
    emailPromises.push(submitterPromise);

    const teamToNotify = await _getSupportTeamEmails();
    const teamPromise = mailAPI.sendSupportTicketCreateInternalNotification(
      teamToNotify,
      ticket.uuid,
      ticket.title,
      ticket.description,
      authorString,
      capitalizeFirstLetter(ticket.category),
      capitalizeFirstLetter(ticket.priority)
    );

    if (teamToNotify.length > 0) emailPromises.push(teamPromise);

    await Promise.allSettled(emailPromises);

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
  req: ZodReqWithFiles<
    ZodReqWithOptionalUser<z.infer<typeof AddTicketAttachementsValidator>>
  >,
  res: Response
) {
  try {
    const { uuid } = req.params;
    const userUUID = req.user?.decoded.uuid;

    let foundUser;
    if (userUUID) {
      foundUser = await User.findOne({ uuid: userUUID });
    }

    const ticket = await SupportTicket.findOne({ uuid }).orFail();

    // If no files, no-op, just return the ticket
    if (!req.files || req.files.length === 0) {
      return res.send({
        err: false,
        ticket,
      });
    }

    const uploader = foundUser?.uuid
      ? `${foundUser.firstName} ${foundUser.lastName}`
      : `${ticket.guest?.firstName} ${ticket.guest?.lastName}`;

    const uploadedFiles = await _uploadTicketAttachments(
      ticket.uuid,
      req.files,
      uploader
    );
    ticket.attachments = [...(ticket.attachments ?? []), ...uploadedFiles];

    for (const f of uploadedFiles) {
      const feedEntry = _createFeedEntry_AttachmentUploaded(uploader, f.name);
      ticket.feed.push(feedEntry);
    }

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

/**
 * Generates a pre-signed download URL for a ticket attachment
 */
async function getTicketAttachmentURL(
  req: z.infer<typeof GetTicketAttachmentValidator>,
  res: Response
) {
  try {
    const { uuid, attachmentUUID } = req.params;

    if (!process.env.AWS_SUPPORTFILES_DOMAIN) {
      throw new Error("Missing SUPPORT_FILES_DOMAIN ENV variable");
    }
    if (!process.env.AWS_SUPPORTFILES_KEYPAIR_ID) {
      throw new Error("Missing SUPPORT_FILES_KEYPAIR_ID ENV variable");
    }
    if (!process.env.AWS_SUPPORTFILES_CLOUDFRONT_PRIVKEY) {
      throw new Error("Missing SUPPORT_FILES_CLOUDFRONT_PRIVKEY ENV variable");
    }

    const ticket = await SupportTicket.findOne({ uuid }).orFail();
    const f = ticket.attachments?.find((a) => a.uuid === attachmentUUID);
    if (!f) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err2,
      });
    }

    const exprDate = new Date();
    exprDate.setDate(exprDate.getDate() + 3); // 3 day expiration time
    const privKey = base64.decode(
      process.env.AWS_SUPPORTFILES_CLOUDFRONT_PRIVKEY
    );

    const fileURL = assembleUrl([
      "https://",
      process.env.AWS_SUPPORTFILES_DOMAIN,
      ticket.uuid,
      f.uuid,
    ]);

    const signedURL = getSignedUrl({
      url: fileURL,
      keyPairId: process.env.AWS_SUPPORTFILES_KEYPAIR_ID,
      dateLessThan: exprDate.toString(),
      privateKey: privKey,
    });

    return res.send({
      err: false,
      url: signedURL,
    });
  } catch (e) {
    debugError(e);
    return conductor500Err(res);
  }
}

async function updateTicket(
  req: ZodReqWithUser<z.infer<typeof UpdateTicketValidator>>,
  res: Response
) {
  try {
    const { uuid } = req.params;
    const { priority, status } = req.body;
    const userUUID = req.user?.decoded.uuid;

    const user = await User.findOne({ uuid: userUUID }).orFail();

    const ticket = await SupportTicket.findOne({ uuid }).orFail();

    // If status/priority is the same, just return the ticket
    if (ticket.status === status && ticket.priority === priority) {
      return res.send({
        err: false,
        ticket,
      });
    }

    let updatedFeed = ticket.feed;

    if (ticket.status !== status) {
      // Check if status is changing to closed, if so, add a feed entry
      if (
        ["open", "in_progress"].includes(ticket.status) &&
        status === "closed"
      ) {
        const feedEntry = _createFeedEntry_Closed(
          `${user.firstName} ${user.lastName}`
        );
        updatedFeed.push(feedEntry);
      }

      // Check if ticket is being reopened, if so, add a feed entry
      if (ticket.status === "closed" && status === "in_progress") {
        const feedEntry = _createFeedEntry_Reopened(
          `${user.firstName} ${user.lastName}`
        );
        updatedFeed.push(feedEntry);
      }

      // Else, if attempting to reset to open, fail
      if (ticket.status === "closed" && status === "open") {
        return res.status(400).send({
          err: true,
          errMsg: conductorErrors.err89,
        });
      }
    }

    if (ticket.priority !== priority) {
      const feedEntry = _createFeedEntryPriorityChanged(
        `${user.firstName} ${user.lastName}`,
        capitalizeFirstLetter(priority)
      );
      updatedFeed.push(feedEntry);
    }

    await SupportTicket.updateOne(
      { uuid },
      {
        priority,
        status,
        feed: updatedFeed,
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

async function getGeneralMessages(
  req: z.infer<typeof GetTicketValidator>,
  res: Response
) {
  try {
    const { uuid } = req.params;
    const ticket = await SupportTicket.findOne({ uuid }).orFail();
    const ticketMessages = await SupportTicketMessage.find({
      ticket: ticket.uuid,
      type: "general",
    })
      .populate("sender")
      .sort({ createdAt: -1 });

    return res.send({
      err: false,
      messages: ticketMessages,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function createGeneralMessage(
  req: ZodReqWithOptionalUser<z.infer<typeof SendTicketMessageValidator>>,
  res: Response
) {
  try {
    const { uuid } = req.params;
    const { message, attachments } = req.body;
    const userUUID = req.user?.decoded.uuid;

    const ticket = await SupportTicket.findOne({ uuid }).orFail();
    let foundUser;
    if (userUUID) {
      foundUser = await User.findOne({ uuid: userUUID });
    }

    const ticketMessage = await SupportTicketMessage.create({
      uuid: v4(),
      ticket: ticket.uuid,
      message,
      attachments,
      senderUUID: foundUser ? foundUser.uuid : undefined,
      senderEmail: foundUser ? undefined : ticket.guest?.email, // fallback to guest email if no user
      timeSent: new Date().toISOString(),
      type: "general",
    });

    // If user was found and user is not the ticket author, send a notification to the ticket author
    if (foundUser && foundUser.uuid !== ticket.userUUID) {
      const emailToNotify = await _getTicketAuthorEmail(ticket);
      if (!emailToNotify) return conductor500Err(res);
      const params = new URLSearchParams();
      params.append("accessKey", ticket.guestAccessKey);
      const addParams = !foundUser?.uuid ? true : false; // if guest, append access key to ticket path

      const senderName = `${foundUser.firstName} ${foundUser.lastName}`;

      await mailAPI.sendNewTicketMessageNotification(
        [emailToNotify],
        ticket.uuid,
        message,
        senderName,
        addParams ? params.toString() : ""
      );
    }

    // If user was found and user is the ticket author, send a notification to assigned staff
    if ((foundUser && foundUser.uuid === ticket.userUUID) || !foundUser) {
      const teamToNotify = await _getAssignedStaffEmails(ticket.assignedUUIDs);
      if (teamToNotify.length > 0) {
        await mailAPI.sendNewTicketMessageAssignedStaffNotification(
          teamToNotify,
          ticket.uuid,
          message,
          foundUser
            ? `${foundUser.firstName} ${foundUser.lastName}`
            : `${ticket.guest?.firstName} ${ticket.guest?.lastName}`,
          capitalizeFirstLetter(ticket.priority),
          ticket.title
        );
      }
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

async function getInternalMessages(
  req: z.infer<typeof GetTicketValidator>,
  res: Response
) {
  try {
    const { uuid } = req.params;
    const ticket = await SupportTicket.findOne({ uuid }).orFail();
    const ticketMessages = await SupportTicketMessage.find({
      ticket: ticket.uuid,
      type: "internal",
    })
      .populate("sender")
      .sort({ createdAt: -1 });

    return res.send({
      err: false,
      messages: ticketMessages,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function createInternalMessage(
  req: ZodReqWithUser<z.infer<typeof SendTicketMessageValidator>>,
  res: Response
) {
  try {
    const { uuid } = req.params;
    const { message, attachments } = req.body;
    const userUUID = req.user?.decoded.uuid;

    const ticket = await SupportTicket.findOne({ uuid }).orFail();
    const foundUser = await User.findOne({ uuid: userUUID }).orFail();

    const ticketMessage = await SupportTicketMessage.create({
      uuid: v4(),
      ticket: ticket.uuid,
      message,
      attachments,
      senderUUID: foundUser.uuid,
      timeSent: new Date().toISOString(),
      type: "internal",
    });

    const allTeamEmails = await _getAssignedStaffEmails(ticket.assignedUUIDs);
    const teamToNotify = allTeamEmails.filter((e) => e !== foundUser.email); // remove the sender from the list of emails to notify
    if (teamToNotify.length > 0) {
      await mailAPI.sendNewInternalTicketMessageAssignedStaffNotification(
        teamToNotify,
        ticket.uuid,
        message,
        foundUser
          ? `${foundUser.firstName} ${foundUser.lastName}`
          : `${ticket.guest?.firstName} ${ticket.guest?.lastName}`,
        capitalizeFirstLetter(ticket.priority),
        ticket.title
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

async function deleteTicket(
  req: ZodReqWithUser<z.infer<typeof DeleteTicketValidator>>,
  res: Response
) {
  try {
    const { uuid } = req.params;
    await SupportTicket.deleteOne({ uuid });
    return res.send({
      err: false,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function _uploadTicketAttachments(
  ticketID: string,
  files: Express.Multer.File[],
  uploader: string
): Promise<SupportTicketAttachmentInterface[]> {
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
    const savedFiles: SupportTicketAttachmentInterface[] = [];

    files.forEach((file) => {
      const fileExt = file.originalname.split(".").pop();
      if (!fileExt) {
        throw new Error("File extension could not be determined");
      }

      const fileUUID = v4();
      const fileKey = `${ticketID}/${fileUUID}`;
      const contentType = file.mimetype || "application/octet-stream";
      uploadCommands.push(
        new PutObjectCommand({
          Bucket: process.env.AWS_SUPPORTFILES_BUCKET,
          Key: fileKey,
          Body: file.buffer,
          ContentDisposition: `inline; filename="${fileUUID}.${fileExt}"`,
          ContentType: contentType,
        })
      );
      savedFiles.push({
        name: file.originalname,
        uuid: fileUUID,
        uploadedBy: uploader,
        uploadedDate: new Date().toISOString(),
      });
    });

    await async.eachLimit(uploadCommands, 2, async (command) =>
      storageClient.send(command)
    );

    return savedFiles;
  } catch (err) {
    throw err;
  }
}

const _getSupportTeamEmails = async (): Promise<string[]> => {
  try {
    const org = await Organization.findOne({
      orgID: process.env.ORG_ID,
    }).orFail();
    return org.supportTicketNotifiers ?? [];
  } catch (err) {
    throw err;
  }
};

const _getTicketAuthorEmail = async (
  ticket: SupportTicketInterface
): Promise<string | undefined> => {
  const hasUser = !!ticket.userUUID;
  if (hasUser) {
    const foundUser = await User.findOne({ uuid: ticket.userUUID });
    return foundUser?.email;
  }
  if (ticket.guest) {
    return ticket.guest.email;
  }
  return undefined;
};

const _getTicketAuthorString = (
  emailToNotify: string,
  foundUser?: UserInterface,
  guest?: { firstName: string; lastName: string }
) => {
  const ticketAuthor = foundUser
    ? `${foundUser.firstName} ${foundUser.lastName}`
    : guest
    ? `${guest.firstName} ${guest.lastName}`
    : "Unknown";
  const authorString = `${ticketAuthor} (${emailToNotify})`;
  return authorString;
};

const _getAssignedStaffEmails = async (staffUUIDs?: string[]) => {
  try {
    if (!staffUUIDs || staffUUIDs.length === 0) return [];
    const staff = await User.find({ uuid: { $in: staffUUIDs } });
    return staff.map((s) => s.email);
  } catch (err) {
    throw err;
  }
};

const _createGuestAccessKey = (): string => {
  return randomBytes(32).toString("hex");
};

const _getGuestAccessKeyExpiration = (): string => {
  const current = new Date();
  const expiration = addMonths(current, 1);
  return expiration.toISOString();
};

const _createFeedEntry_Assigned = (
  assigner: string,
  assignees: string[]
): SupportTicketFeedEntryInterface => {
  return {
    action: `Ticket was assigned to ${assignees.join(", ")}`,
    blame: assigner,
    date: new Date().toISOString(),
  };
};

const _createFeedEntry_Created = (
  creator: string
): SupportTicketFeedEntryInterface => {
  return {
    action: `Ticket was created`,
    blame: creator,
    date: new Date().toISOString(),
  };
};

const _createFeedEntry_Closed = (
  closer: string
): SupportTicketFeedEntryInterface => {
  return {
    action: `Ticket was closed`,
    blame: closer,
    date: new Date().toISOString(),
  };
};

const _createFeedEntry_Reopened = (
  reopener: string
): SupportTicketFeedEntryInterface => {
  return {
    action: `Ticket was reopened`,
    blame: reopener,
    date: new Date().toISOString(),
  };
};

const _createFeedEntry_AttachmentUploaded = (
  uploader: string,
  fileName: string
): SupportTicketFeedEntryInterface => {
  return {
    action: `Attachment uploaded: ${fileName}`,
    blame: uploader,
    date: new Date().toISOString(),
  };
};

const _createFeedEntryPriorityChanged = (
  changer: string,
  newPriority: string
): SupportTicketFeedEntryInterface => {
  return {
    action: `Priority changed to ${newPriority}`,
    blame: changer,
    date: new Date().toISOString(),
  };
};

export default {
  getTicket,
  getUserTickets,
  getOpenInProgressTickets,
  getClosedTickets,
  getSupportMetrics,
  getAssignableUsers,
  assignTicket,
  createTicket,
  addTicketAttachments,
  getTicketAttachmentURL,
  updateTicket,
  createGeneralMessage,
  getGeneralMessages,
  createInternalMessage,
  getInternalMessages,
  deleteTicket,
  ticketAttachmentUploadHandler,
};
