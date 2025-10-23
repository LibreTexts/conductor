import { z } from "zod";
import {
  AddTicketAttachementsValidator,
  AddTicketCCValidator,
  AssignTicketValidator,
  BulkUpdateTicketsValidator,
  CreateTicketValidator,
  DeleteTicketValidator,
  GetClosedTicketsValidator,
  GetOpenTicketsValidator,
  GetRequestorOtherTicketsValidator,
  GetTicketAttachmentValidator,
  GetTicketValidator,
  GetUserTicketsValidator,
  RemoveTicketCCValidator,
  SendTicketMessageValidator,
  TicketUUIDParams,
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
  SupportTicketCategoryOptions,
  SupportTicketFeedEntryInterface,
  SupportTicketInterface,
  SupportTicketPriorityOptions,
  SupportTicketStatusEnum,
} from "../models/supporticket.js";
import SupportTicketMessage, {
  SupportTicketMessageInterface,
} from "../models/supporticketmessage.js";
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
import { addDays, subDays } from "date-fns";
import { randomBytes } from "crypto";
import { ZodReqWithFiles } from "../types/Express";
import { getSignedUrl } from "@aws-sdk/cloudfront-signer";
import base64 from "base-64";
import Organization from "../models/organization.js";
import authAPI from "../api/auth.js";
import SupportQueueService from "./services/support-queue-service";
import SupportTicketService from "./services/support-ticket-service";
import Project, { ProjectInterface } from "../models/project";
import base62 from "base62-random";

export const SUPPORT_FILES_S3_CLIENT_CONFIG: S3ClientConfig = {
  credentials: {
    accessKeyId: process.env.AWS_SUPPORTFILES_ACCESS_KEY ?? "",
    secretAccessKey: process.env.AWS_SUPPORTFILES_SECRET_KEY ?? "",
  },
  region: process.env.AWS_SUPPORTFILES_REGION ?? "",
};

async function getTicket(
  req: ZodReqWithOptionalUser<z.infer<typeof GetTicketValidator>>,
  res: Response,
) {
  try {
    const { uuid } = req.params;

    const ticketService = new SupportTicketService();
    const ticket = await ticketService.getTicket(uuid);

    // If the requester is a harvester, ensure they can only access tickets in the harvesting queue
    if (req.user?.decoded.uuid) {
      const harvesterAccess = await ticketService.checkHarvesterAccessToTicket(uuid, req.user.decoded.uuid);
      if (!harvesterAccess) {
        return res.status(403).send({
          err: true,
          errMsg: conductorErrors.err8,
        });
      }
    }

    if (!ticket) {
      return conductor404Err(res);
    }

    return res.send({
      err: false,
      ticket: _removeAccessKeysFromResponse(ticket),
    });
  } catch (err: any) {
    if (err.name === "DocumentNotFoundError") {
      return conductor404Err(res);
    }
    debugError(err);
    return conductor500Err(res);
  }
}

/**
 * Gets support tickets for a given user ID.
 * NOTE: This function does not check if the user has access to the tickets. That must be handled by middleware (e.g. `middleware.isSelfOrSupport`).
 */
async function getUserTickets(
  req: ZodReqWithUser<z.infer<typeof GetUserTicketsValidator>>,
  res: Response,
) {
  try {
    const { uuid } = req.params;

    let page = 1;
    let limit = 25;
    if (req.query.page) page = req.query.page;
    if (req.query.limit) limit = parseInt(req.query.limit.toString());
    const offset = getPaginationOffset(page, limit);

    const results = await _getUserTickets({
      uuid: uuid,
      sort: req.query.sort,
      page,
      limit,
      offset,
      queue: req.query.queue,
    });

    if (!results) {
      return conductor500Err(res);
    }

    return res.send({
      err: false,
      tickets: results.tickets,
      total: results.total,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getRequestorOtherTickets(
  req: ZodReqWithUser<z.infer<typeof GetRequestorOtherTicketsValidator>>,
  res: Response,
) {
  try {
    const { uuid, email, currentTicketUUID } = req.query;

    let page = 1;
    let limit = 25;
    if (req.query.page) page = parseInt(req.query.page.toString() || "1");
    if (req.query.limit) limit = parseInt(req.query.limit.toString() || "25");
    const offset = getPaginationOffset(page, limit);

    const results = await _getUserTickets({
      uuid: uuid,
      email: email,
      sort: req.query.sort,
      page,
      limit,
      offset,
      populateAssignedUsers: true,
    });

    if (!results) {
      return conductor500Err(res);
    }

    // Filter out the current ticket from the results if provided
    if (currentTicketUUID) {
      results.tickets = results.tickets.filter(
        (t) => t.uuid !== currentTicketUUID,
      );
    }

    return res.send({
      err: false,
      tickets: results.tickets,
      total: results.total,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function _getUserTickets({
  uuid,
  email,
  sort = "opened",
  page = 1,
  limit = 25,
  offset = 0,
  populateAssignedUsers = false,
  queue
}: {
  uuid?: string;
  email?: string;
  sort?: string;
  page?: number;
  limit?: number;
  offset?: number;
  populateAssignedUsers?: boolean;
  queue?: string;
}): Promise<{ tickets: SupportTicketInterface[]; total: number } | undefined> {
  try {
    let queueId: string | undefined = undefined;

    if (!uuid && !email) return undefined;

    const getSortObj = () => {
      if (sort === "priority") {
        return { priority: -1 };
      }
      if (sort === "status") {
        return { status: -1 };
      }
      return { timeOpened: -1 };
    };

    if (queue) {
      const queueService = new SupportQueueService();
      const foundQueue = await queueService.getQueueBySlug(queue);
      if (!foundQueue) {
        throw new Error("Invalid queue");
      }
      queueId = foundQueue.id;
    }

    const sortObj = getSortObj();
    const searchObj: Record<string, any> = uuid ? { userUUID: { $eq: uuid } } : { "guest.email": { $eq: email } };
    if (queueId) {
      searchObj["queue_id"] = { $eq: queueId };
    }

    const query = SupportTicket.find(searchObj)
      .skip(offset)
      .limit(limit)
      .sort(sortObj as any)
      .populate("user")
      .populate("queue");

    if (populateAssignedUsers) {
      query.populate("assignedUsers")
    }

    const tickets = await query.exec();

    tickets.forEach((t) => {
      return _removeAccessKeysFromResponse(t);
    });

    const total = await SupportTicket.countDocuments(searchObj);

    return {
      tickets,
      total,
    };
  } catch (err) {
    debugError(err);
    return undefined;
  }
}

async function getOpenInProgressTickets(
  req: ZodReqWithUser<z.infer<typeof GetOpenTicketsValidator>>,
  res: Response,
) {
  try {
    let page = 1;
    let limit = 25;
    if (req.query.page) page = req.query.page;
    if (req.query.limit) limit = parseInt(req.query.limit.toString());
    const offset = getPaginationOffset(page, limit);

    const { query, assignee, category, priority } = req.query;

    const getSortObj = () => {
      if (req.query.sort === "status") {
        return { status: -1 };
      }
      if (req.query.sort === "category") {
        return { category: 1 };
      }
      return { timeOpened: -1 };
    };

    const tickets = [];
    const validStatuses: SupportTicketStatusEnum[] = ["open", "assigned", "in_progress", "awaiting_requester"];
    const sortObj = getSortObj();

    const isHarvester = authAPI.checkHasRole(
      req.user,
      "libretexts",
      "harvester",
      true,
      true
    );

    if (isHarvester && req.query.queue !== "harvesting") {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const queueService = new SupportQueueService();
    const foundQueue = await queueService.getQueueBySlug(req.query.queue);

    if (!foundQueue) {
      return res.status(400).send({
        err: true,
        errMsg: "Invalid queue",
      });
    }

    const lookupUserDataStages = (localField: "assignedUUIDs" | "userUUID") => {
      return [
        {
          $lookup: {
            from: "users",
            localField: localField,
            foreignField: "uuid",
            as: localField === "assignedUUIDs" ? "assignedUsers" : "user",
            pipeline: [
              {
                $project: {
                  ...SanitizedUserSelectProjection,
                },
              },
            ],
          },
        },
        ...(localField === "userUUID"
          ? [
            {
              $set: {
                user: {
                  $arrayElemAt: ["$user", 0],
                },
              },
            },
          ]
          : []),
      ];
    };

    if (!query) {
      const foundTickets = await SupportTicket.aggregate([
        {
          $match: {
            queue_id: foundQueue.id,
            status: { $in: validStatuses },
            ...(assignee ? { assignedUUIDs: assignee } : {}),
            ...(category ? { category } : {}),
            ...(priority ? { priority } : {}),
          },
        },
        ...lookupUserDataStages("assignedUUIDs"),
        ...lookupUserDataStages("userUUID"),
        { $sort: sortObj } as any,
      ]);
      tickets.push(...foundTickets);
    } else if (z.string().uuid().safeParse(query).success) {
      const foundTicket = await SupportTicket.aggregate([
        {
          $match: {
            uuid: query,
            queue_id: foundQueue.id,
            status: { $in: validStatuses },
            ...(assignee ? { assignedUUIDs: assignee } : {}),
            ...(category ? { category } : {}),
            ...(priority ? { priority } : {}),
          },
        },
        ...lookupUserDataStages("assignedUUIDs"),
        ...lookupUserDataStages("userUUID"),
      ]);

      tickets.push(...foundTicket);
    } else {
      const fromTicketQuery = await SupportTicket.aggregate([
        {
          $search: {
            compound: {
              should: [
                {
                  text: {
                    query,
                    path: [
                      "title",
                      "description",
                      "guest.email",
                      "guest.firstName",
                      "guest.lastName",
                    ],
                    fuzzy: {
                      maxEdits: 2,
                    },
                  }
                }, {
                  autocomplete: {
                    query,
                    path: "uuid"
                  }
                },
                {
                  text: {
                    query,
                    path: "uuidShort"
                  }
                }
              ],
              minimumShouldMatch: 1,
            }
          },
        },
        {
          $addFields: {
            score: { $meta: "searchScore" },
          },
        },
        {
          $match: {
            queue_id: foundQueue.id,
            status: { $in: validStatuses },
          }
        },
        ...lookupUserDataStages("assignedUUIDs"),
        ...lookupUserDataStages("userUUID"),
        { $sort: sortObj } as any,
      ]);

      const fromUserQuery = User.aggregate([
        {
          $search: {
            text: {
              query,
              path: ["firstName", "lastName", "email"],
              fuzzy: {
                maxEdits: 1,
              },
            },
          },
        },
        {
          $addFields: {
            score: { $meta: "searchScore" },
          },
        },
        {
          $lookup: {
            from: "supporttickets",
            localField: "uuid",
            foreignField: "userUUID",
            as: "tickets",
          },
        },
        {
          $unwind: "$tickets",
        },
        {
          $replaceRoot: { newRoot: "$tickets" },
        },
        {
          $match: {
            queue_id: foundQueue.id,
            status: { $in: validStatuses },
          }
        },
        ...lookupUserDataStages("assignedUUIDs"),
        ...lookupUserDataStages("userUUID"),
      ]);

      const queryResults = await Promise.all([
        fromTicketQuery,
        fromUserQuery,
      ]);

      const allResults = [...queryResults[0], ...queryResults[1]];

      const filteredAllResults = allResults.filter((t) => {
        if (assignee && !t.assignedUUIDs?.includes(assignee)) return false;
        if (category && t.category !== category) return false;
        if (priority && t.priority !== priority) return false;
        return true;
      });

      tickets.push(...filteredAllResults);
    }

    const uniqueTickets = tickets.filter((t, index, self) => {
      // Return only unique results
      return (
        index ===
        self.findIndex((t2) => {
          return t.uuid === t2.uuid;
        })
      );
    });

    // We have to sort the tickets in memory because we can only alphabetically sort by priority in query
    if (req.query.sort === "priority") {
      uniqueTickets.sort((a, b) => {
        if (a.priority === "high" && b.priority !== "high") return -1;
        if (a.priority !== "high" && b.priority === "high") return 1;
        if (a.priority === "medium" && b.priority === "low") return -1;
        if (a.priority === "low" && b.priority === "medium") return 1;
        return 0;
      });
    }

    const paginated = uniqueTickets.slice(offset, offset + limit);
    paginated.forEach((t) => {
      return _removeAccessKeysFromResponse(t);
    });

    return res.send({
      err: false,
      tickets: paginated,
      total: uniqueTickets.length || 0,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getClosedTickets(
  req: ZodReqWithUser<z.infer<typeof GetClosedTicketsValidator>>,
  res: Response,
) {
  try {
    let page = 1;
    let limit = 25;
    if (req.query.page) page = req.query.page;
    if (req.query.limit) limit = parseInt(req.query.limit.toString());
    const offset = getPaginationOffset(page, limit);

    const isHarvester = authAPI.checkHasRole(
      req.user,
      "libretexts",
      "harvester",
      true,
      true
    );

    const queueService = new SupportQueueService();
    const harvestingQueue = await queueService.getQueueBySlug("harvesting");
    if (!harvestingQueue) {
      return res.status(500).send({
        err: true,
        errMsg: "Support queue configuration error",
      });
    }

    const getSortObj = () => {
      if (req.query.sort === "priority") {
        return { priority: -1 };
      }
      if (req.query.sort === "closed") {
        return { timeClosed: -1 };
      }
      return { timeOpened: -1 }; // default to opened
    };

    const sortObj = getSortObj();

    const tickets = await SupportTicket.find({
      status: "closed",
      ...(isHarvester && { queue_id: harvestingQueue.id }) // harvesters can only see closed tickets in harvesting queue
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

    tickets.forEach((t) => {
      return _removeAccessKeysFromResponse(t);
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

async function getAssignableUsers(req: Request, res: Response) {
  try {
    const users = await _getAssignableUsersInternal();
    if (!users) {
      return conductor500Err(res);
    }

    return res.send({
      err: false,
      users,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function _getAssignableUsersInternal(): Promise<Pick<UserInterface, "uuid" | "firstName" | "lastName" | "email" | "avatar">[] | undefined> {
  try {
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
      ],
    })
      .select("uuid firstName lastName email avatar")
      .sort({ firstName: 1 });

    return users;
  } catch (err) {
    debugError(err);
    return undefined;
  }
}

async function assignTicket(
  req: ZodReqWithUser<z.infer<typeof AssignTicketValidator>>,
  res: Response,
) {
  try {
    const { uuid } = req.params;
    const { assigned } = req.body;
    const assigner = req.user.decoded.uuid;

    const ticketService = new SupportTicketService();
    const ticket = await ticketService.assignTicket({
      uuid,
      assigned,
      assigner,
    });

    return res.send({
      err: false,
      ticket: _removeAccessKeysFromResponse(ticket),
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function addTicketCC(
  req: ZodReqWithOptionalUser<z.infer<typeof AddTicketCCValidator>>,
  res: Response,
) {
  try {
    const { uuid } = req.params;
    const { email } = req.body;

    const ticket = await SupportTicket.findOne({ uuid })
      .orFail()
      .populate(["assignedUsers", "user"]);

    if (!ticket.ccedEmails) ticket.ccedEmails = [];

    const allEmails = [
      // @ts-ignore
      ...(ticket.assignedUsers ?? []).map((u) => u.email),
      // @ts-ignore
      ticket.user?.email,
      ticket.guest?.email,
      ...ticket.ccedEmails,
    ].filter((e) => e);

    // If email is already CCed or otherwise involved, nothing to do, return the ticket
    if (
      allEmails.includes(email) ||
      ticket.ccedEmails.map((c) => c.email).includes(email)
    ) {
      return res.send({
        err: false,
        ticket: _removeAccessKeysFromResponse(ticket),
      });
    }

    // Determine who is adding the CC
    const userUUID = req.user?.decoded.uuid;
    let foundUser;
    if (userUUID) {
      foundUser = await User.findOne({ uuid: userUUID });
    }

    const adder = foundUser?.uuid
      ? `${foundUser.firstName} ${foundUser.lastName}`
      : `${ticket.guest?.firstName} ${ticket.guest?.lastName}`;

    const feedEntry = _createFeedEntry_CCAdded(adder, email);

    // Add the feed entry and cc'd email to the ticket
    ticket.feed.push(feedEntry);
    const accessKey = _createGuestAccessKey();
    ticket.ccedEmails.push({
      email,
      accessKey,
    });
    await ticket.save();

    // Notify the new CCed user with guest access key
    await mailAPI.sendSupportTicketCCedNotification(
      email,
      ticket.uuid,
      ticket.title,
      accessKey,
    );

    return res.send({
      err: false,
      ticket: _removeAccessKeysFromResponse(ticket),
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function removeTicketCC(
  req: z.infer<typeof RemoveTicketCCValidator>,
  res: Response,
) {
  try {
    const { uuid } = req.params;
    const { email } = req.body;

    const ticket = await SupportTicket.findOne({ uuid }).orFail();

    // If email is not CCed, nothing to do, return the ticket
    if (
      !ticket.ccedEmails ||
      !ticket.ccedEmails.map((c) => c.email).includes(email)
    ) {
      return res.send({
        err: false,
        ticket: _removeAccessKeysFromResponse(ticket),
      });
    }

    ticket.ccedEmails = ticket.ccedEmails.filter((e) => e.email !== email);
    await ticket.save();

    return res.send({
      err: false,
      ticket: _removeAccessKeysFromResponse(ticket),
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function ticketAttachmentUploadHandler(
  req: Request,
  res: Response,
  next: NextFunction,
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
  res: Response,
) {
  try {
    const supportQueueService = new SupportQueueService();
    const ticketService = new SupportTicketService();

    const {
      title,
      description,
      apps,
      category,
      priority,
      attachments,
      guest,
      capturedURL,
      deviceInfo,
      metadata
    } = req.body;
    let { queue_id } = req.body;
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
        : `${guest?.firstName} ${guest?.lastName}`,
    );

    const determineSupportQueue = () => {
      if (queue_id) {
        return supportQueueService.getQueueById(queue_id);
      }
      else {
        return supportQueueService.getDefaultQueue();
      }
    }

    const supportQueue = await determineSupportQueue();
    if (!supportQueue) {
      return res.status(400).send({
        err: true,
        errMsg: "Invalid support queue",
      });
    }

    if (!queue_id) {
      queue_id = supportQueue.id; // Default queue was returned so set the queue_id
    }

    // Check if this is a publishing request and ensure publishing has not already been requested for the project
    const projectID = metadata?.projectID;
    if (supportQueue.slug === "publishing") {
      if (!projectID) {
        return res.status(400).send({
          err: true,
          errMsg: "Publishing requests must include a projectID in metadata",
        });
      }

      const project = await Project.findOne({ projectID: { $eq: projectID } });
      if (!project) {
        return res.status(400).send({
          err: true,
          errMsg: "Matching project not found for publishing request",
        });
      }

      if (project.didRequestPublish) {
        return res.status(400).send({
          err: true,
          errMsg: "A publishing request has already been submitted for this project",
        });
      }
    }

    const guestAccessKey = _createGuestAccessKey();

    const uuid = v4();
    const ticket = await SupportTicket.create({
      uuid,
      uuidShort: uuid.slice(-7),
      queue_id,
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
      deviceInfo,
      metadata
    });

    const ticketAuthor = await ticketService._getTicketAuthor(ticket);
    const emailToNotify = await ticketService._getTicketAuthorEmail(ticket, ticketAuthor);
    if (!emailToNotify) return conductor500Err(res);

    const authorString = ticketService._getTicketAuthorString(
      emailToNotify,
      foundUser,
      guest,
    );

    const params = new URLSearchParams();
    params.append("accessKey", guestAccessKey);
    const addParams = !foundUser?.uuid ? true : false; // if guest, append access key to ticket path

    const emailPromises = [];
    const submitterPromise = mailAPI.sendSupportTicketCreateConfirmation(
      supportQueue.ticket_descriptor,
      emailToNotify,
      ticket.uuid,
      addParams ? params.toString() : "",
    );
    emailPromises.push(submitterPromise);

    const teamToNotify = await _getSupportTeamEmails();
    const teamPromise = mailAPI.sendSupportTicketCreateInternalNotification(
      supportQueue.ticket_descriptor,
      teamToNotify,
      ticket.uuid,
      ticket.title,
      ticket.description || "",
      authorString,
      capitalizeFirstLetter(ticket.category || ""),
      capitalizeFirstLetter(ticket.priority || ""),
      ticket.capturedURL ?? undefined,
      metadata as object ?? {},
    );

    if (teamToNotify.length > 0) emailPromises.push(teamPromise);

    await Promise.allSettled(emailPromises);

    if (supportQueue.slug === "publishing") {
      await Project.updateOne({
        projectID: { $eq: projectID }
      }, {
        $set: {
          didRequestPublish: true
        }
      });
    }

    return res.send({
      err: false,
      ticket: _removeAccessKeysFromResponse(ticket, true), // Allow guest access key to be returned here for attachments to be immediately uploaded
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
  res: Response,
) {
  try {
    const { uuid } = req.params;
    const { accessKey } = req.query;
    const userUUID = req.user?.decoded.uuid;

    const ticket = await SupportTicket.findOne({ uuid }).orFail();

    let foundUploaderName = "Unknown";
    if (userUUID) {
      const user = await User.findOne({ uuid: userUUID });
      if (user) {
        foundUploaderName = `${user.firstName} ${user.lastName}`;
      }
    }
    if (!foundUploaderName) {
      if (accessKey === ticket.guestAccessKey) {
        foundUploaderName = `${ticket.guest?.firstName} ${ticket.guest?.lastName}`;
      }
    }
    if (!userUUID && accessKey !== ticket.guestAccessKey) {
      const foundCC = ticket.ccedEmails?.find((c) => c.accessKey === accessKey);
      if (foundCC) {
        foundUploaderName = foundCC.email;
      }
    }

    // If no files, no-op, just return the ticket
    if (!req.files || req.files.length === 0) {
      return res.send({
        err: false,
        ticket: _removeAccessKeysFromResponse(ticket),
      });
    }

    const uploadedFiles = await _uploadTicketAttachments(
      ticket.uuid,
      req.files,
      foundUploaderName,
    );
    ticket.attachments = [...(ticket.attachments ?? []), ...uploadedFiles];

    for (const f of uploadedFiles) {
      const feedEntry = _createFeedEntry_AttachmentUploaded(
        foundUploaderName,
        f.name,
      );
      ticket.feed.push(feedEntry);
    }

    await ticket.save();

    return res.send({
      err: false,
      ticket: _removeAccessKeysFromResponse(ticket),
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
  res: Response,
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
      process.env.AWS_SUPPORTFILES_CLOUDFRONT_PRIVKEY,
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
  res: Response,
) {
  try {
    const ticketService = new SupportTicketService();
    const { uuid } = req.params;
    const { priority, status, autoCloseSilenced } = req.body;
    const userUUID = req.user?.decoded.uuid;

    const user = await User.findOne({ uuid: userUUID }).orFail();

    const ticket = await SupportTicket.findOne({ uuid }).orFail();

    // If status/priority/autoClose is the same, just return the ticket
    if (
      ticket.status === status &&
      ticket.priority === priority &&
      autoCloseSilenced === ticket.autoCloseSilenced
    ) {
      return res.send({
        err: false,
        ticket: _removeAccessKeysFromResponse(ticket),
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
          `${user.firstName} ${user.lastName}`,
        );
        updatedFeed.push(feedEntry);
      }

      // Check if ticket is being reopened, if so, add a feed entry
      if (ticket.status === "closed" && status === "in_progress") {
        const feedEntry = _createFeedEntry_Reopened(
          `${user.firstName} ${user.lastName}`,
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
      const feedEntry = ticketService._createFeedEntryPriorityChanged(
        `${user.firstName} ${user.lastName}`,
        capitalizeFirstLetter(priority || "unknown"),
      );
      updatedFeed.push(feedEntry);
    }

    const autoCloseStatusChanged =
      autoCloseSilenced !== ticket.autoCloseSilenced;

    await SupportTicket.updateOne(
      { uuid },
      {
        priority,
        status,
        feed: updatedFeed,
        timeClosed: status === "closed" ? new Date().toISOString() : undefined, // if status is closed, set timeClosed to now
        autoCloseSilenced: autoCloseSilenced,
        ...(autoCloseStatusChanged && {
          autoCloseTriggered: false,
          autoCloseDate: null,
        }),
      },
    ).orFail();

    return res.send({
      err: false,
      ticket: _removeAccessKeysFromResponse(ticket),
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function bulkUpdateTickets(
  req: ZodReqWithUser<z.infer<typeof BulkUpdateTicketsValidator>>,
  res: Response,
) {
  try {
    const { tickets, queue, priority, status, assignee } = req.body;
    const callingUserId = req.user.decoded.uuid;

    const ticketService = new SupportTicketService();
    await ticketService.bulkUpdateTickets({
      tickets,
      queue,
      priority,
      status,
      assignee,
      callingUserId,
    });

    return res.send({
      err: false,
      updated_count: tickets.length,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getGeneralMessages(
  req: ZodReqWithOptionalUser<z.infer<typeof GetTicketValidator>>,
  res: Response,
) {
  try {
    const { uuid } = req.params;

    const ticketService = new SupportTicketService();
    const ticket = await ticketService.getTicket(uuid);
    if (!ticket) {
      return conductor404Err(res);
    }

    if (req.user?.decoded.uuid) {
      const harvesterAccess = await ticketService.checkHarvesterAccessToTicket(uuid, req.user.decoded.uuid);
      if (!harvesterAccess) {
        return res.status(403).send({
          err: true,
          errMsg: conductorErrors.err8,
        });
      }
    }

    const messages = await ticketService.getTicketMessages(uuid, "general");

    return res.send({
      err: false,
      messages,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function createGeneralMessage(
  req: ZodReqWithOptionalUser<z.infer<typeof SendTicketMessageValidator>>,
  res: Response,
) {
  try {
    const { uuid } = req.params;
    const { message, attachments } = req.body;
    const { accessKey } = req.query;
    const userUUID = req.user?.decoded.uuid;
    const ticketService = new SupportTicketService();

    const ticket = await SupportTicket.findOneAndUpdate(
      { uuid },
      {
        autoCloseTriggered: false,
        autoCloseDate: null,
      },
    ).populate("queue").orFail(); // reset auto-close trigger

    let foundSenderName = "Unknown";
    let foundSenderUUID: string | undefined;
    let foundSenderEmail: string | undefined;
    let submitterIsGuest = false;
    let senderIsStaff = false;

    // Check if sender is a logged in user
    if (userUUID) {
      const foundUser = await User.findOne({ uuid: userUUID });
      if (foundUser) {
        foundSenderName = `${foundUser.firstName} ${foundUser.lastName}`;
        foundSenderUUID = foundUser.uuid;
        foundSenderEmail = foundUser.email;
        senderIsStaff = authAPI.checkHasRole(
          foundUser,
          "libretexts",
          "support",
        );
      }
    }

    // Check if sender is the ticket guest
    if (accessKey === ticket.guestAccessKey) {
      foundSenderName = `${ticket.guest?.firstName} ${ticket.guest?.lastName}`;
      foundSenderEmail = ticket.guest?.email;
      submitterIsGuest = true;
    }

    // Check if sender is a CCed user
    if (!userUUID && accessKey !== ticket.guestAccessKey) {
      const foundCC = ticket.ccedEmails?.find((c) => c.accessKey === accessKey);
      if (foundCC) {
        foundSenderName = foundCC.email;
        foundSenderEmail = foundCC.email;
      }
    }

    const senderEmail = (returnLoggedIn: boolean) => {
      if (foundSenderUUID) {
        if (returnLoggedIn) return foundSenderEmail;
        return undefined;
      }
      return foundSenderEmail;
    };

    const ticketMessage = await SupportTicketMessage.create({
      uuid: v4(),
      ticket: ticket.uuid,
      message,
      attachments,
      senderUUID: foundSenderUUID,
      senderEmail: senderEmail(false), // only return email if not logged in
      timeSent: new Date().toISOString(),
      type: "general",
    });

    // Notify all users who have previously commented on the ticket, are assigned to the ticket, or the ticket author
    const previousCommenters = await SupportTicketMessage.find({
      ticket: ticket.uuid,
    }).distinct("senderUUID");

    const allUUIDs = [
      ...new Set([
        ...(ticket.assignedUUIDs ?? []),
        ...previousCommenters,
        ticket.userUUID,
      ]),
    ].filter((u) => !!u) as string[]; // filter out undefined/null UUIDs

    const emailsToNotify = await _getEmails(allUUIDs);

    // Filter null or undefined emails and remove the sender from the list of emails to notify
    const filteredEmails = emailsToNotify.filter(
      (e) => e && e !== senderEmail(true),
    );
    if (!filteredEmails) return conductor500Err(res);

    // If sender is staff, change ticket status to awaiting_requester
    // otherwise, if ticket is currently "awaiting_requester" and has assigned users, change to "in_progress"
    if (senderIsStaff) {
      await ticketService.changeTicketStatus(ticket.uuid, "awaiting_requester");
    } else if (ticket.status === "awaiting_requester" && ticket.assignedUUIDs && ticket.assignedUUIDs.length > 0) {
      await ticketService.changeTicketStatus(ticket.uuid, "in_progress");
    }

    const emailPromises = [];

    // If there is a ticket guest and the sender is not the guest, send a notification to the guest
    if (!submitterIsGuest && ticket.guest?.email) {
      const params = new URLSearchParams();
      params.append("accessKey", ticket.guestAccessKey);
      emailPromises.push(
        mailAPI.sendNewTicketMessageNotification(
          ticket.queue?.ticket_descriptor || "Unknown Request Type",
          [ticket.guest?.email],
          ticket.uuid,
          ticket.title,
          message,
          foundSenderName,
          params.toString(),
        ),
      );
    }

    // If there are CCed emails, send a notification to each with their access key
    if (ticket.ccedEmails && ticket.ccedEmails.length > 0) {
      for (const ccedUser of ticket.ccedEmails) {
        if (ccedUser.email === senderEmail(true)) continue; // if sender is CCed, don't send them an email

        const accessKey = ccedUser.accessKey;
        const params = new URLSearchParams();
        params.append("accessKey", accessKey);
        emailPromises.push(
          mailAPI.sendNewTicketMessageNotification(
            ticket.queue?.ticket_descriptor || "Unknown Request Type",
            [ccedUser.email],
            ticket.uuid,
            ticket.title,
            message,
            foundSenderName,
            params.toString(),
          ),
        );
      }
    }

    // If no other emails to notify, return (ie ticket author commented on their own ticket before ticket was assigned to staff)
    if (filteredEmails.length === 0) {
      return res.send({
        err: false,
        message: ticketMessage,
      });
    }

    emailPromises.push(
      mailAPI.sendNewTicketMessageNotification(
        ticket.queue?.ticket_descriptor || "Unknown Request Type",
        filteredEmails,
        ticket.uuid,
        ticket.title,
        message,
        foundSenderName,
        "",
      ),
    );

    await Promise.allSettled(emailPromises);

    return res.send({
      err: false,
      message: ticketMessage,
    });
  } catch (err) {
    console.error(err);
    debugError(err);
    return conductor500Err(res);
  }
}

async function getInternalMessages(
  req: ZodReqWithUser<z.infer<typeof GetTicketValidator>>,
  res: Response,
) {
  try {
    const { uuid } = req.params;

    if (!req.user.decoded.uuid) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const ticketService = new SupportTicketService();
    const ticket = await ticketService.getTicket(uuid);
    if (!ticket) {
      return conductor404Err(res);
    }

    const harvesterAccess = await ticketService.checkHarvesterAccessToTicket(uuid, req.user.decoded.uuid);
    if (!harvesterAccess) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const messages = await ticketService.getTicketMessages(uuid, "internal");

    return res.send({
      err: false,
      messages,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function createInternalMessage(
  req: ZodReqWithUser<z.infer<typeof SendTicketMessageValidator>>,
  res: Response,
) {
  try {
    const { uuid } = req.params;
    const { message, attachments } = req.body;
    const userUUID = req.user?.decoded.uuid;

    const ticket = await SupportTicket.findOneAndUpdate(
      { uuid },
      {
        autoCloseTriggered: false,
        autoCloseDate: null,
      },
    ).populate("queue").orFail();
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

    const previousCommenters = await SupportTicketMessage.find({
      ticket: ticket.uuid,
    }).distinct("senderUUID");

    const allUUIDs = [
      ...new Set([
        ...(ticket.assignedUUIDs ?? []),
        ...previousCommenters,
        ticket.userUUID,
      ]),
    ].filter((u) => !!u) as string[]; // filter out undefined/null UUIDs

    const emailsToNotify = await _getEmails(allUUIDs, true); // only notify staff
    const teamToNotify = emailsToNotify.filter((e) => e !== foundUser.email); // remove the sender from the list of emails to notify
    if (teamToNotify.length > 0) {
      await mailAPI.sendNewInternalTicketMessageAssignedStaffNotification(
        ticket.queue?.ticket_descriptor || "Unknown Request Type",
        teamToNotify,
        ticket.uuid,
        message,
        foundUser
          ? `${foundUser.firstName} ${foundUser.lastName}`
          : "Unknown Commenter",
        capitalizeFirstLetter(ticket.priority || ""),
        ticket.title,
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
  res: Response,
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

async function getTicketFilters(req: ZodReqWithOptionalUser<{}>, res: Response) {
  try {

    // Only support staff/admins can see assignee options
    let assigneeOptions: GenericKeyTextValueObj<string>[] | undefined = undefined;
    if (req.user) {
      const hasSupportRole = authAPI.checkHasRole(req.user, "libretexts", ["superadmin", "support"]);
      if (hasSupportRole) {
        const assignableUsers = await _getAssignableUsersInternal();
        assigneeOptions = assignableUsers?.map((u) => {
          return {
            key: u.uuid,
            text: capitalizeFirstLetter(`${u.firstName} ${u.lastName}`),
            value: u.uuid,
          };
        }) ?? [];

      }
    }

    const priorityOptions: GenericKeyTextValueObj<string>[] = SupportTicketPriorityOptions.map((p) => {
      return {
        key: p,
        text: capitalizeFirstLetter(p),
        value: p,
      };
    });

    const categoryOptions: GenericKeyTextValueObj<string>[] = SupportTicketCategoryOptions.map((c) => {
      return {
        key: c.value,
        text: c.text,
        value: c.value,
      };
    });

    assigneeOptions?.sort((a, b) => a.text.localeCompare(b.text, "en"));
    priorityOptions?.sort((a, b) => a.text.localeCompare(b.text, "en"));
    categoryOptions?.sort((a, b) => a.text.localeCompare(b.text, "en"));

    return res.send({
      err: false,
      filters: {
        ...(assigneeOptions ? { assignee: assigneeOptions } : {}),
        category: categoryOptions,
        priority: priorityOptions,
      }
    })
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function createAndAttachProjectFromHarvestingRequest(
  req: ZodReqWithUser<z.infer<typeof TicketUUIDParams>>,
  res: Response) {
  try {
    const { uuid } = req.params;
    const userUUID = req.user.decoded.uuid;

    const ticketService = new SupportTicketService();
    const ticket = await ticketService.getTicket(uuid);
    if (!ticket) {
      return conductor404Err(res);
    }

    if (ticket.queue?.slug !== "harvesting") {
      return res.status(400).send({
        err: true,
        errMsg: "This endpoint can only be used with Harvesting Requests.",
      });
    }

    if (ticket.metadata?.projectID) {
      return res.status(400).send({
        err: true,
        errMsg: "A project is already attached to this Harvesting Request.",
      });
    }

    const leadsSet = new Set<string>([userUUID, ...ticket.assignedUUIDs || []]);

    const projectData: Partial<ProjectInterface> = {
      orgID: process.env.ORG_ID || "libretexts",
      projectID: base62(10),
      title: ticket.title,
      status: "available",
      visibility: "public",
      currentProgress: 0,
      peerProgress: 0,
      a11yProgress: 0,
      classification: "harvesting",
      notes: `Project created from Harvesting Request #${ticket.uuidShort}`,
      leads: Array.from(leadsSet),
      liaisons: [],
      auditors: [],
      license: {
        name: ticket.metadata?.license?.name || "",
        version: ticket.metadata?.license?.version || "",
        sourceURL: ticket.capturedURL || "",
        modifiedFromSource: ticket.metadata?.license?.modifiedFromSource || false,
      },
      harvestReqID: ticket.uuid,
    };

    const newProject = await Project.create(projectData);

    // Attach the project ID to the ticket metadata
    ticket.metadata = {
      ...ticket.metadata,
      projectID: newProject.projectID,
    };
    await ticket.save();

    return res.send({
      err: false,
      project: newProject,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function findTicketsToInitAutoClose(req: Request, res: Response) {
  try {
    const ticketService = new SupportTicketService();

    const tickets = await SupportTicket.find({
      status: "awaiting_requester",
      autoCloseSilenced: { $ne: true },
    }).populate("messages");

    const toSet: SupportTicketInterface[] = [];

    // Check if the ticket has had any messages in the last 14 days
    for (const ticket of tickets) {
      const messages = await ticketService.getTicketMessages(ticket.uuid, "general");
      if (!messages || messages.length === 0) {
        continue;
      }

      const lastMessage = messages.sort(
        (a, b) =>
          new Date(b.timeSent).getTime() - new Date(a.timeSent).getTime(),
      )[0];

      const lastMessageDate = new Date(
        (lastMessage as SupportTicketMessageInterface).timeSent,
      );

      const implementationDate = new Date("2025-10-21");
      const fourteenDaysAgo = subDays(new Date(), 14);
      if (
        lastMessageDate.getTime() < fourteenDaysAgo.getTime() &&
        lastMessageDate.getTime() > implementationDate.getTime()
      ) {
        toSet.push(ticket);
      }
    }

    if (toSet.length === 0) {
      return res.send({
        err: false,
      });
    }

    await SupportTicket.updateMany(
      {
        uuid: {
          $in: toSet.map((t) => t.uuid),
        },
      },
      {
        autoCloseTriggered: true,
        autoCloseDate: addDays(new Date(), 3).toISOString(), // 3 days from now
      },
    );

    for (const ticket of toSet) {
      await _sendAutoCloseWarning(
        ticket as SupportTicketInterface & {
          messages: SupportTicketMessageInterface[];
        },
      );
    }

    return res.send({ err: false });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function autoCloseTickets(req: Request, res: Response) {
  try {
    const tickets = await SupportTicket.find({
      autoCloseTriggered: true,
      autoCloseDate: { $lte: new Date().toISOString() },
      autoCloseSilenced: { $ne: true }, // ignore silenced tickets
    });

    const feedEntry = _createFeedEntry_AutoClosed();

    for (const ticket of tickets) {
      await SupportTicket.updateOne(
        { uuid: ticket.uuid },
        {
          status: "closed",
          autoCloseTriggered: false,
          autoCloseDate: null,
          timeClosed: new Date().toISOString(),
          feed: [...ticket.feed, feedEntry],
        },
      );
    }

    return res.send({
      err: false,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function _sendAutoCloseWarning(
  ticket: SupportTicketInterface & {
    messages: SupportTicketMessageInterface[];
  },
) {
  try {
    const allCommenters = ticket.messages.map((m) => m.senderUUID);
    const userIds = [
      ...(ticket.userUUID ? [ticket.userUUID] : []),
      ...(ticket.assignedUUIDs ?? []),
      ...allCommenters,
    ].filter((u) => u);

    const uniqueUserIds = [...new Set(userIds)] as string[];

    const emails = await _getEmails(uniqueUserIds, false);
    if (ticket.guest?.email) emails.push(ticket.guest.email);

    if (emails.length === 0) return;

    const params = new URLSearchParams();
    params.append("accessKey", ticket.guestAccessKey);

    await mailAPI.sendSupportTicketAutoCloseWarning(
      emails,
      ticket.uuid,
      ticket.title,
      ticket.guest?.email ? params.toString() : "",
    );
  } catch (err) {
    throw err;
  }
}

async function _uploadTicketAttachments(
  ticketID: string,
  files: Express.Multer.File[],
  uploader: string,
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
          ContentDisposition: `${fileExt === "mkv" ? "attachment" : "inline"};filename="${fileUUID}.${fileExt}"`, // MKV files do not render properly in Chrome, so force download
          ContentType: contentType,
        }),
      );
      savedFiles.push({
        name: file.originalname,
        uuid: fileUUID,
        uploadedBy: uploader,
        uploadedDate: new Date().toISOString(),
      });
    });

    await async.eachLimit(uploadCommands, 2, async (command) =>
      storageClient.send(command),
    );

    return savedFiles;
  } catch (err) {
    debugError(err);
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

const _getEmails = async (
  uuids: string[],
  staffOnly = false,
): Promise<string[]> => {
  try {
    if (!uuids || uuids.length === 0) return [];
    const users = await User.find({
      uuid: { $in: uuids },
    });

    if (staffOnly) {
      return users
        .filter((u) => authAPI.checkHasRole(u, "libretexts", "support", true))
        .map((u) => u.email);
    }

    return users.map((u) => u.email);
  } catch (err) {
    throw err;
  }
};

const _createGuestAccessKey = (): string => {
  return randomBytes(32).toString("hex");
};


const _createFeedEntry_Created = (
  creator: string,
): SupportTicketFeedEntryInterface => {
  return {
    action: `Ticket was created`,
    blame: creator,
    date: new Date().toISOString(),
  };
};

const _createFeedEntry_Closed = (
  closer: string,
): SupportTicketFeedEntryInterface => {
  return {
    action: `Ticket was closed`,
    blame: closer,
    date: new Date().toISOString(),
  };
};

const _createFeedEntry_Reopened = (
  reopener: string,
): SupportTicketFeedEntryInterface => {
  return {
    action: `Ticket was reopened`,
    blame: reopener,
    date: new Date().toISOString(),
  };
};

const _createFeedEntry_AttachmentUploaded = (
  uploader: string,
  fileName: string,
): SupportTicketFeedEntryInterface => {
  return {
    action: `Attachment uploaded: ${fileName}`,
    blame: uploader,
    date: new Date().toISOString(),
  };
};

const _createFeedEntry_CCAdded = (
  adder: string,
  email: string,
): SupportTicketFeedEntryInterface => {
  return {
    action: `CC'd user added: ${email}`,
    blame: adder,
    date: new Date().toISOString(),
  };
};

const _createFeedEntry_AutoClosed = (): SupportTicketFeedEntryInterface => {
  return {
    action: "Ticket was automatically closed",
    blame: "Conductor System",
    date: new Date().toISOString(),
  };
};

const _removeAccessKeysFromResponse = (
  ticket: SupportTicketInterface,
  allowGuestAccessKey = false,
) => {
  if (!allowGuestAccessKey) ticket.guestAccessKey = "REDACTED";
  if (ticket.ccedEmails && Array.isArray(ticket.ccedEmails)) {
    ticket.ccedEmails.forEach((c) => {
      c.accessKey = "REDACTED";
    });
  }
  return ticket;
};

export default {
  getTicket,
  getUserTickets,
  getRequestorOtherTickets,
  getOpenInProgressTickets,
  getClosedTickets,
  getAssignableUsers,
  assignTicket,
  createTicket,
  addTicketAttachments,
  getTicketAttachmentURL,
  updateTicket,
  bulkUpdateTickets,
  createGeneralMessage,
  getGeneralMessages,
  createInternalMessage,
  getInternalMessages,
  deleteTicket,
  getTicketFilters,
  createAndAttachProjectFromHarvestingRequest,
  findTicketsToInitAutoClose,
  autoCloseTickets,
  ticketAttachmentUploadHandler,
  addTicketCC,
  removeTicketCC,
};
