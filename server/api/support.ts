import logger from "../logger.js";
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
import { conductor404Err, conductor409Err, conductor500Err } from "../util/errorutils.js";
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
  SupportTicketStatusOptions,
} from "../models/supporticket.js";
import SupportTicketMessage, {
  SupportTicketMessageInterface,
} from "../models/supporticketmessage.js";
import mailAPI from "../api/mail.js";
import SlackNotificationService from "./services/slack-notification-service.js";
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
import { supportTicketAIService } from "./services/support-ticket-ai-service";
import {
  PRIVACY_QUEUE_SLUG,
  PrivacyTicketError,
  PrivacyTicketFields,
  shouldRedactOnClose,
} from "../util/privacyTickets";

async function _isInternalSupportUser(
  req: {
    user?: { decoded?: { uuid?: string }; roles?: unknown };
  },
  roles: string[] = ["superadmin", "support", "harvester"],
): Promise<boolean> {
  const callerUUID = req.user?.decoded?.uuid;
  if (!callerUUID) return false;

  // Prefer roles already attached to req.user (by getUserAttributes / canAccessSupportTicket)
  // to avoid a redundant DB round-trip. Guest-accessible ticket routes authenticate via
  // optionalVerifyRequest and may not have roles populated, so fall back to a lookup then.
  const caller = Array.isArray(req.user?.roles)
    ? req.user
    : await User.findOne({ uuid: { $eq: callerUUID } });
  if (!caller) return false;

  return authAPI.checkHasRole(caller, "libretexts", roles, true);
}

// Privacy inquiries are support/superadmin only; harvesters count as internal elsewhere but not here
const _isPrivacyStaff = (req: Parameters<typeof _isInternalSupportUser>[0]) =>
  _isInternalSupportUser(req, ["superadmin", "support"]);

/*
 * Keyed on close, not redactedAt: redactedAt is stamped last, so content added mid-redaction
 * would survive. Once redactedAt is set nothing cleans the ticket again.
 */
function _rejectIfRedacted(ticket: { status?: string; privacy?: PrivacyTicketFields }, res: Response): boolean {
  if (ticket.status !== "closed" || !shouldRedactOnClose(ticket.privacy)) return false;
  res.status(400).send({ err: true, errMsg: "This deletion request is closed for redaction and can't take new messages, files, or CCs." });
  return true;
}

function _sanitizeTicketForResponse(
  ticketService: SupportTicketService,
  ticket: SupportTicketInterface,
  isInternal: boolean,
  { allowGuestAccessKey = false, showPrivacy = false } = {},
): SupportTicketInterface {
  ticketService._removeAccessKeysFromResponse(ticket, allowGuestAccessKey);
  if (!isInternal) ticketService._redactStatusFromResponse(ticket);
  if (!showPrivacy) ticket.privacy = undefined;
  return ticket;
}

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

    const isInternal = await _isInternalSupportUser(req);
    const showPrivacy = !!ticket.privacy && (await _isPrivacyStaff(req));

    return res.send({
      err: false,
      ticket: _sanitizeTicketForResponse(ticketService, ticket, isInternal, { showPrivacy }),
    });
  } catch (err: any) {
    if (err.name === "DocumentNotFoundError") {
      return conductor404Err(res);
    }
    logger.error({ err }, "getTicket failed");
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

    const isInternal = await _isInternalSupportUser(req);

    const results = await _getUserTickets({
      uuid: uuid,
      sort: req.query.sort,
      page,
      limit,
      offset,
      queue: req.query.queue,
      isInternal,
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
    logger.error({ err }, "getUserTickets failed");
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
      // Route is gated to support/harvester (checkHasRoleMiddleware), so callers are always internal.
      isInternal: true,
      excludePrivacy: !(await _isPrivacyStaff(req)),
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
    logger.error({ err }, "getRequestorOtherTickets failed");
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
  queue,
  isInternal = false,
  excludePrivacy = false,
}: {
  uuid?: string;
  email?: string;
  sort?: string;
  page?: number;
  limit?: number;
  offset?: number;
  populateAssignedUsers?: boolean;
  queue?: string;
  isInternal?: boolean;
  excludePrivacy?: boolean;
}): Promise<{ tickets: SupportTicketInterface[]; total: number } | undefined> {
  try {
    const ticketService = new SupportTicketService();
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
    if (excludePrivacy) {
      searchObj["privacy"] = { $exists: false };
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
      _sanitizeTicketForResponse(ticketService, t, isInternal);
    });

    const total = await SupportTicket.countDocuments(searchObj);

    return {
      tickets,
      total,
    };
  } catch (err) {
    logger.error({ err }, "_getUserTickets failed");
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

    const { query, assignee, category, priority, status } = req.query;
    const defaultStatuses: SupportTicketStatusEnum[] = ["open", "assigned", "in_progress", "awaiting_requester"];
    const searchStatuses = status && status.length > 0 ? status : defaultStatuses;

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

    const ticketService = new SupportTicketService();
    const { tickets, total } = await ticketService.searchTickets({
      queue_id: foundQueue.id,
      statuses: searchStatuses,
      query,
      assignee,
      priority,
      category,
      sort: req.query.sort,
      page: page,
      limit: limit,
    });

    return res.send({
      err: false,
      tickets,
      total,
    });
  } catch (err) {
    logger.error({ err }, "getOpenInProgressTickets failed");
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
    const { query, assignee, category, priority } = req.query;

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

    const ticketService = new SupportTicketService();
    const { tickets, total } = await ticketService.searchTickets({
      statuses: ["closed"],
      query,
      assignee,
      priority,
      category,
      sort: req.query.sort,
      ...(isHarvester && { queue_id: harvestingQueue.id }), // harvesters can only see closed tickets in harvesting queue
      page,
      limit,
    });

    return res.send({
      err: false,
      tickets,
      total,
    });
  } catch (err) {
    logger.error({ err }, "getClosedTickets failed");
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
    logger.error({ err }, "getAssignableUsers failed");
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
      .sort({ firstName: 1 })
      .lean();

    return users;
  } catch (err) {
    logger.error({ err }, "_getAssignableUsersInternal failed");
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
      ticket: ticketService._removeAccessKeysFromResponse(ticket),
    });
  } catch (err) {
    logger.error({ err }, "assignTicket failed");
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
    const ticketService = new SupportTicketService();

    const isInternal = await _isInternalSupportUser(req);

    const ticket = await SupportTicket.findOne({ uuid: { $eq: uuid } })
      .orFail()
      .populate(["assignedUsers", "user"]);
    if (_rejectIfRedacted(ticket, res)) return;

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
        ticket: _sanitizeTicketForResponse(ticketService, ticket, isInternal),
      });
    }

    // Determine who is adding the CC
    const userUUID = req.user?.decoded.uuid;
    let foundUser;
    if (userUUID) {
      foundUser = await User.findOne({ uuid: { $eq: userUUID } });
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
    await ticketService.saveTicket(ticket);

    // Notify the new CCed user with guest access key
    await mailAPI.sendSupportTicketCCedNotification(
      email,
      ticket.uuid,
      ticket.title,
      accessKey,
    );

    return res.send({
      err: false,
      ticket: _sanitizeTicketForResponse(ticketService, ticket, isInternal),
    });
  } catch (err) {
    logger.error({ err }, "addTicketCC failed");
    return conductor500Err(res);
  }
}

async function removeTicketCC(
  req: ZodReqWithOptionalUser<z.infer<typeof RemoveTicketCCValidator>>,
  res: Response,
) {
  try {
    const { uuid } = req.params;
    const { email } = req.body;
    const ticketService = new SupportTicketService();

    const isInternal = await _isInternalSupportUser(req);

    const ticket = await SupportTicket.findOne({ uuid: { $eq: uuid } }).orFail();

    // If email is not CCed, nothing to do, return the ticket
    if (
      !ticket.ccedEmails ||
      !ticket.ccedEmails.map((c) => c.email).includes(email)
    ) {
      return res.send({
        err: false,
        ticket: _sanitizeTicketForResponse(ticketService, ticket, isInternal),
      });
    }

    ticket.ccedEmails = ticket.ccedEmails.filter((e) => e.email !== email);
    await ticketService.saveTicket(ticket);

    return res.send({
      err: false,
      ticket: _sanitizeTicketForResponse(ticketService, ticket, isInternal),
    });
  } catch (err) {
    logger.error({ err }, "removeTicketCC failed");
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
    const isInternal = await _isInternalSupportUser(req);

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
      metadata,
      privacy,
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
      foundUser = await User.findOne({ uuid: { $eq: userUUID } }).orFail();
    }

    const feedEntry = _createFeedEntry_Created(
      foundUser?.firstName
        ? `${foundUser.firstName} ${foundUser.lastName}`
        : `${guest?.firstName} ${guest?.lastName}`,
    );

    const determineSupportQueue = async () => {
      // Check for category-based queue override
      if (category) {
        const categoryQueue = await supportQueueService.getQueueByCategoryFilter(category);
        if (categoryQueue) return categoryQueue;
      }

      // Fall back to explicit queue_id or default
      if (queue_id) {
        return supportQueueService.getQueueById(queue_id);
      }
      return supportQueueService.getDefaultQueue();
    }

    const supportQueue = await determineSupportQueue();
    if (!supportQueue) {
      return res.status(400).send({
        err: true,
        errMsg: "Invalid support queue",
      });
    }

    queue_id = supportQueue.id; // Always use the resolved queue

    // Staff logging a privacy request on someone's behalf: requester is the guest, not the staff member
    const isPrivacy = supportQueue.slug === PRIVACY_QUEUE_SLUG;
    const isPrivacyStaff = isPrivacy && (await _isPrivacyStaff(req));
    const loggedForRequester = isPrivacyStaff && !!guest;
    let privacyFields: PrivacyTicketFields | undefined;
    if (isPrivacy) {
      if (!privacy) {
        return res.status(400).send({
          err: true,
          errMsg: "Privacy inquiries must include privacy details",
        });
      }
      try {
        privacyFields = await ticketService.buildPrivacyFields({
          input: privacy,
          isInternal: isPrivacyStaff,
          requesterUUID: loggedForRequester ? undefined : foundUser?.uuid,
        });
      } catch (e) {
        if (e instanceof PrivacyTicketError) {
          return res.status(400).send({ err: true, errMsg: e.message });
        }
        throw e;
      }
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
    const ticket = await ticketService.createTicket({
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
      userUUID: foundUser?.uuid && !loggedForRequester ? foundUser.uuid : undefined,
      guest,
      timeOpened: new Date().toISOString(),
      feed: [feedEntry],
      guestAccessKey,
      deviceInfo,
      metadata,
      privacy: privacyFields,
    });

    if (privacyFields?.appealOf) {
      await ticketService.linkPrivacyAppeal(privacyFields.appealOf, ticket.uuid, feedEntry.blame);
    }

    // Auto-assign the ticket to the queue's configured support staff, if enabled.
    // Wrapped defensively: a failure here must never break ticket creation.
    if (supportQueue.auto_assign_enabled && supportQueue.auto_assign_uuids?.length) {
      try {
        await ticketService.autoAssignNewTicket(ticket, supportQueue.auto_assign_uuids);
      } catch (err) {
        logger.error({ err }, "createTicket failed");
      }
    }

    const ticketAuthor = await ticketService._getTicketAuthor(ticket);
    const emailToNotify = await ticketService._getTicketAuthorEmail(ticket, ticketAuthor);
    if (!emailToNotify) return conductor500Err(res);

    const authorString = ticketService._getTicketAuthorString(
      emailToNotify,
      ticketAuthor,
      guest,
    );

    const params = new URLSearchParams();
    params.append("accessKey", guestAccessKey);
    const addParams = !ticket.userUUID; // if guest, append access key to ticket path

    const emailPromises = [];
    const submitterPromise = mailAPI.sendSupportTicketCreateConfirmation(
      supportQueue.ticket_descriptor,
      emailToNotify,
      ticket.uuid,
      addParams ? params.toString() : "",
      privacyFields?.dueDate,
    );
    emailPromises.push(submitterPromise);

    const teamToNotify = await _getSupportTeamEmails();
    // Privacy redaction can't reach Slack or inboxes, so those copies carry no requester content
    const notice = isPrivacy
      ? {
          title: `Privacy inquiry #${ticket.uuidShort}`,
          description: "Open the ticket in Conductor to view the request.",
          author: "Privacy requester",
          capturedURL: undefined,
          metadata: {},
        }
      : {
          title: ticket.title,
          description: ticket.description || "",
          author: authorString,
          capturedURL: ticket.capturedURL ?? undefined,
          metadata: (metadata as Record<string, unknown>) ?? {},
        };

    const teamPromise = mailAPI.sendSupportTicketCreateInternalNotification(
      supportQueue.ticket_descriptor,
      teamToNotify,
      ticket.uuid,
      notice.title,
      notice.description,
      notice.author,
      capitalizeFirstLetter(ticket.category || ""),
      capitalizeFirstLetter(ticket.priority || ""),
      notice.capturedURL,
      notice.metadata,
    );

    if (teamToNotify.length > 0) emailPromises.push(teamPromise);

    await Promise.allSettled(emailPromises);

    void new SlackNotificationService().sendSupportTicketCreated({
      queueDescriptor: supportQueue.ticket_descriptor,
      ticketID: ticket.uuid,
      ticketTitle: notice.title,
      ticketDescription: notice.description,
      authorString: notice.author,
      category: capitalizeFirstLetter(ticket.category || ""),
      priority: capitalizeFirstLetter(ticket.priority || ""),
      capturedURL: notice.capturedURL,
      metadata: notice.metadata,
    }).catch(() => { /* nicety isolation: never break ticket creation */ });

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
      ticket: _sanitizeTicketForResponse(ticketService, ticket, isInternal, { allowGuestAccessKey: true }), // Allow guest access key to be returned here for attachments to be immediately uploaded
    });
  } catch (err) {
    logger.error({ err }, "createTicket failed");
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
    const ticketService = new SupportTicketService();
    const isInternal = await _isInternalSupportUser(req);

    const ticket = await SupportTicket.findOne({ uuid: { $eq: uuid } }).orFail();
    if (_rejectIfRedacted(ticket, res)) return;

    let foundUploaderName = "Unknown";
    if (userUUID) {
      const user = await User.findOne({ uuid: { $eq: userUUID } });
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
        ticket: _sanitizeTicketForResponse(ticketService, ticket, isInternal),
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

    await ticketService.saveTicket(ticket);

    return res.send({
      err: false,
      ticket: _sanitizeTicketForResponse(ticketService, ticket, isInternal),
    });
  } catch (err) {
    logger.error({ err }, "addTicketAttachments failed");
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

    const ticket = await SupportTicket.findOne({ uuid: { $eq: uuid } }).orFail();
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
    logger.error({ err: e }, "getTicketAttachmentURL failed");
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
    const { priority, status, autoCloseSilenced, category, queue, privacy } = req.body;
    const userUUID = req.user?.decoded.uuid;

    const user = await User.findOne({ uuid: { $eq: userUUID } }).orFail();

    const ticket = await SupportTicket.findOne({ uuid: { $eq: uuid } }).orFail();
    const actor = `${user.firstName} ${user.lastName}`;

    const touchesPrivacy = !!privacy || !!ticket.privacy || queue?.toLowerCase() === PRIVACY_QUEUE_SLUG;
    if (touchesPrivacy && !(await _isPrivacyStaff(req))) {
      return res.status(403).send({ err: true, errMsg: conductorErrors.err8 });
    }

    // Per-field auto-save sends one field at a time, so an omitted field means "unchanged",
    // never "set to undefined". Gate every change on the field actually being present.
    const statusChanged = status !== undefined && status !== ticket.status;
    if (statusChanged && ticket.status === "closed" && status === "open") {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err89,
      });
    }
    const priorityChanged = priority !== undefined && priority !== ticket.priority;
    const autoCloseStatusChanged =
      autoCloseSilenced !== undefined && autoCloseSilenced !== ticket.autoCloseSilenced;
    const categoryChanged = category !== undefined && category !== ticket.category;

    // Resolve the queue slug -> id up front so we can compare and label the feed entry.
    let nextQueueId = ticket.queue_id;
    let nextQueueName: string | undefined;
    let movedInPrivacy: PrivacyTicketFields | undefined;
    if (queue !== undefined) {
      const queueService = new SupportQueueService();
      const foundQueue = await queueService.getQueueBySlug(queue);
      if (!foundQueue) {
        return res.status(400).send({
          err: true,
          errMsg: conductorErrors.err11,
        });
      }
      nextQueueId = foundQueue.id;
      nextQueueName = foundQueue.ticket_descriptor || foundQueue.name;
      try {
        movedInPrivacy = ticketService.privacyFieldsForQueueMove(ticket, foundQueue.slug);
      } catch (e) {
        if (e instanceof PrivacyTicketError) {
          return res.status(400).send({ err: true, errMsg: e.message });
        }
        throw e;
      }
    }
    const queueChanged = queue !== undefined && nextQueueId !== ticket.queue_id;

    /*
     * Every edit is staged in memory and written in one update conditional on the status read
     * above: a failed check (400) or a concurrent status change (409) leaves the ticket untouched.
     */
    const readStatus = ticket.status;
    let extended = false;
    try {
      if (privacy) extended = ticketService.applyPrivacyFields(ticket, privacy, actor);
      if (priorityChanged) {
        ticket.priority = priority;
        ticket.feed.push(ticketService._createFeedEntryPriorityChanged(actor, capitalizeFirstLetter(priority || "unknown")));
      }
      if (categoryChanged) {
        ticket.category = category;
        ticket.feed.push(ticketService._createFeedEntry_CategoryChanged(actor, capitalizeFirstLetter(category || "unknown")));
      }
      if (queueChanged) {
        ticket.queue_id = nextQueueId;
        if (movedInPrivacy) ticket.set("privacy", movedInPrivacy);
        ticket.feed.push(ticketService._createFeedEntry_QueueChanged(actor, nextQueueName || "unknown"));
      }
      if (autoCloseStatusChanged) {
        ticket.set({ autoCloseSilenced, autoCloseTriggered: false, autoCloseDate: null });
      }
      // Last, so close rules see the edited privacy fields
      if (statusChanged) ticketService.stageStatusChange(ticket, status, actor);
    } catch (e) {
      if (e instanceof PrivacyTicketError) {
        return res.status(400).send({ err: true, errMsg: e.message });
      }
      throw e;
    }

    // Nothing actually changed -> return the ticket as-is (no feed entry, no write).
    if (!ticket.isModified()) {
      return res.send({
        err: false,
        ticket: ticketService._removeAccessKeysFromResponse(ticket),
      });
    }

    if (!(await ticketService.saveIfUnchanged(ticket, readStatus))) {
      return conductor409Err(res);
    }
    await ticketService.upsertToSearchIndex(uuid);
    if (extended) await ticketService.notifyPrivacyExtension(ticket);
    if (statusChanged && status === "closed" && ticket.privacy) {
      await ticketService.onPrivacyTicketClosed(uuid);
    }
    if (statusChanged) await ticketService.syncClosedTicketVector(uuid);

    // Re-fetch so the response reflects the write and any close side effects
    const updatedTicket = await SupportTicket.findOne({ uuid: { $eq: uuid } }).orFail();

    return res.send({
      err: false,
      ticket: ticketService._removeAccessKeysFromResponse(updatedTicket),
    });
  } catch (err) {
    logger.error({ err }, "updateTicket failed");
    return conductor500Err(res);
  }
}

async function answerTicketWithAI(
  req: ZodReqWithUser<z.infer<typeof TicketUUIDParams>>,
  res: Response,
) {
  try {
    const { uuid } = req.params;
    const ticketService = new SupportTicketService();
    const hasAccess = await ticketService.checkHarvesterAccessToTicket(
      uuid,
      req.user.decoded.uuid,
    );
    if (!hasAccess) {
      return res.status(403).send({ err: true, errMsg: conductorErrors.err8 });
    }

    const result = await supportTicketAIService.answerTicket(uuid);
    return res.send({ err: false, ...result });
  } catch (err: any) {
    if (err?.message?.includes("only be generated")) {
      return res.status(400).send({ err: true, errMsg: err.message });
    }
    logger.error({ err }, "answerTicketWithAI failed");
    return conductor500Err(res);
  }
}

async function syncClosedTicketVectors(_req: Request, res: Response) {
  try {
    const result = await new SupportTicketService().syncAllClosedTicketVectors();
    return res.send({ err: false, ...result });
  } catch (err) {
    logger.error({ err }, "syncClosedTicketVectors failed");
    return res.status(500).send({
      err: true,
      errMsg: `Failed to sync closed-ticket vectors: ${
        err instanceof Error ? err.message : "Unknown error"
      }`,
    });
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
      canEditPrivacy: await _isPrivacyStaff(req),
    });

    return res.send({
      err: false,
      updated_count: tickets.length,
    });
  } catch (err) {
    if (err instanceof PrivacyTicketError) {
      return res.status(400).send({ err: true, errMsg: err.message });
    }
    logger.error({ err }, "bulkUpdateTickets failed");
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
    logger.error({ err }, "getGeneralMessages failed");
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

    const ticket = await ticketService.resetAutoClose(uuid); // reset auto-close trigger
    if (_rejectIfRedacted(ticket, res)) return;

    let foundSenderName = "Unknown";
    let foundSenderUUID: string | undefined;
    let foundSenderEmail: string | undefined;
    let submitterIsGuest = false;
    let senderIsStaff = false;

    // Check if sender is a logged in user
    if (userUUID) {
      const foundUser = await User.findOne({ uuid: { $eq: userUUID } });
      if (foundUser) {
        foundSenderName = `${foundUser.firstName} ${foundUser.lastName}`;
        foundSenderUUID = foundUser.uuid;
        foundSenderEmail = foundUser.email;
        senderIsStaff = await _isInternalSupportUser(req);
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
      senderIsStaff,
      timeSent: new Date().toISOString(),
      type: "general",
    });

    // Notify all users who have previously commented on the ticket, are assigned to the ticket, or the ticket author
    const previousCommenters = await SupportTicketMessage.find({
      ticket: { $eq: ticket.uuid },
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
    if (senderIsStaff && ticket.status !== "closed") {
      await ticketService.changeTicketStatus({ uuid: ticket.uuid, status: "awaiting_requester", expectedStatus: ticket.status });
    } else if (ticket.status === "awaiting_requester" && ticket.assignedUUIDs && ticket.assignedUUIDs.length > 0) {
      await ticketService.changeTicketStatus({ uuid: ticket.uuid, status: "in_progress", expectedStatus: ticket.status });
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
    logger.error({ err }, "createGeneralMessage failed");
    logger.error({ err }, "createGeneralMessage failed");
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
    logger.error({ err }, "getInternalMessages failed");
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

    const ticketService = new SupportTicketService();
    const ticket = await ticketService.resetAutoClose(uuid);
    if (_rejectIfRedacted(ticket, res)) return;
    const foundUser = await User.findOne({ uuid: { $eq: userUUID } }).orFail();

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
      ticket: { $eq: ticket.uuid },
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
    logger.error({ err }, "createInternalMessage failed");
    return conductor500Err(res);
  }
}

async function deleteTicket(
  req: ZodReqWithUser<z.infer<typeof DeleteTicketValidator>>,
  res: Response,
) {
  try {
    const { uuid } = req.params;
    const ticketService = new SupportTicketService();
    await ticketService.deleteTicket(uuid);
    return res.send({
      err: false,
    });
  } catch (err) {
    logger.error({ err }, "deleteTicket failed");
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

    const categoryOptions = [...SupportTicketCategoryOptions];
    const statusOptions = [...SupportTicketStatusOptions].filter((s) => s.key !== "closed")

    assigneeOptions?.sort((a, b) => a.text.localeCompare(b.text, "en"));
    priorityOptions?.sort((a, b) => a.text.localeCompare(b.text, "en"));
    categoryOptions?.sort((a, b) => a.text.localeCompare(b.text, "en"));
    statusOptions?.sort((a, b) => a.text.localeCompare(b.text, "en"));

    return res.send({
      err: false,
      filters: {
        ...(assigneeOptions ? { assignee: assigneeOptions } : {}),
        category: categoryOptions,
        priority: priorityOptions,
        status: statusOptions,
      }
    })
  } catch (err) {
    logger.error({ err }, "getTicketFilters failed");
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

    const prepLicenseObject = () => {
      if (typeof ticket.metadata?.license?.name === "string") {
        return {
          name: ticket.metadata?.license?.name,
          version: ticket.metadata?.license?.version || "",
          sourceURL: ticket.capturedURL || "",
          modifiedFromSource:
            ticket.metadata?.license?.modifiedFromSource || false,
        };
      }

      // Fix for legacy conversions where license data was nested under the "license.name" key
      if (typeof ticket.metadata?.license?.name === "object") {
        const licenseObject = ticket.metadata.license.name;
        return {
          name: licenseObject.name || "",
          version: licenseObject.version || "",
          sourceURL: ticket.capturedURL || "",
          modifiedFromSource: licenseObject.modifiedFromSource || false,
        };
      }

      // Default to empty license object
      return {
        name: "",
        version: "",
        sourceURL: ticket.capturedURL || "",
        modifiedFromSource: false,
      };

    }

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
      license: prepLicenseObject(),
      harvestReqID: ticket.uuid,
    };

    const newProject = await Project.create(projectData);

    // Attach the project ID to the ticket metadata
    ticket.metadata = {
      ...ticket.metadata,
      projectID: newProject.projectID,
    };
    await ticketService.saveTicket(ticket);

    return res.send({
      err: false,
      project: newProject,
    });
  } catch (err) {
    logger.error({ err }, "createAndAttachProjectFromHarvestingRequest failed");
    return conductor500Err(res);
  }
}

async function findTicketsToInitAutoClose(req: Request, res: Response) {
  try {
    const ticketService = new SupportTicketService();

    const tickets = await SupportTicket.find({
      status: "awaiting_requester",
      autoCloseSilenced: { $ne: true },
      privacy: { $exists: false }, // never auto-close privacy requests
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

    await ticketService.initAutoClose(
      toSet.map((t) => t.uuid),
      addDays(new Date(), 3).toISOString(), // 3 days from now
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
    logger.error({ err }, "findTicketsToInitAutoClose failed");
    return conductor500Err(res);
  }
}

async function autoCloseTickets(req: Request, res: Response) {
  try {
    const ticketService = new SupportTicketService();
    const tickets = await SupportTicket.find({
      autoCloseTriggered: true,
      autoCloseDate: { $lte: new Date().toISOString() },
      autoCloseSilenced: { $ne: true }, // ignore silenced tickets
      privacy: { $exists: false }, // never auto-close privacy requests
    });

    const feedEntry = _createFeedEntry_AutoClosed();

    for (const ticket of tickets) {
      await ticketService.autoCloseTicket(ticket, feedEntry);
    }

    return res.send({
      err: false,
    });
  } catch (err) {
    logger.error({ err }, "autoCloseTickets failed");
    return conductor500Err(res);
  }
}

async function sendPrivacyDeadlineReminders(req: Request, res: Response) {
  // respond first and run in the background
  res.send({ err: false, msg: "Privacy deadline reminders started." });
  new SupportTicketService()
    .sendPrivacyDeadlineReminders()
    .then((sent) => logger.info({ sent }, "sendPrivacyDeadlineReminders finished"))
    .catch((err) => logger.error({ err }, "sendPrivacyDeadlineReminders failed"));
}

async function purgeExpiredPrivacyTickets(req: Request, res: Response) {
  // respond first and run in the background
  res.send({ err: false, msg: "Privacy retention purge started." });
  new SupportTicketService()
    .purgeExpiredPrivacyTickets()
    .then((purged) => logger.info({ purged }, "purgeExpiredPrivacyTickets finished"))
    .catch((err) => logger.error({ err }, "purgeExpiredPrivacyTickets failed"));
}

async function syncWithSearchIndex(req: Request, res: Response) {
  try {
    // Return response immediately and do the sync in the background since this can be a long-running process
    res.send({
      err: false,
      msg: "Support ticket search index sync initiated. This process will run in the background.",
    });

    const ticketService = new SupportTicketService();
    ticketService.syncWithSearchIndex().catch((err) => {
      logger.error({ err }, "Background ticket sync error");
    });

  } catch (err) {
    logger.error({ err }, "syncWithSearchIndex failed");
    if (!res.headersSent) {
      // Don't send an error response if the initial response has already been sent.
      return conductor500Err(res);
    }
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
      !process.env.AWS_SUPPORTFILES_BUCKET ||
      !process.env.AWS_SUPPORTFILES_DOMAIN
    ) {
      throw new Error("Missing file storage config");
    }

    const storageClient = new S3Client({ region: process.env.AWS_SUPPORTFILES_REGION || process.env.AWS_REGION });
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
    logger.error({ err }, "_uploadTicketAttachments failed");
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
  sendPrivacyDeadlineReminders,
  purgeExpiredPrivacyTickets,
  syncWithSearchIndex,
  ticketAttachmentUploadHandler,
  addTicketCC,
  removeTicketCC,
  answerTicketWithAI,
  syncClosedTicketVectors,
};
