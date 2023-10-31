import { z } from "zod";
import {
  CreateTicketValidator,
  GetTicketValidator,
  GetUserTicketsValidator,
  StaffSendTicketMessageValidator,
  UpdateTicketValidator,
} from "./validators/support";
import { Request, Response } from "express";
import { debugError } from "../debug.js";
import { conductor500Err } from "../util/errorutils.js";
import User from "../models/user.js";
import { v4 } from "uuid";
import SupportTicket from "../models/supporticket.js";
import SupportTicketMessage from "../models/supporticketmessage.js";

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
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getUserTickets(
  req: z.infer<typeof GetUserTicketsValidator>,
  res: Response
) {
  try {
    const { uuid } = req.params;
    const user = await User.findOne({ uuid }).orFail();
    const tickets = await SupportTicket.find({ user: user._id });
    return res.send({
      err: false,
      tickets,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getOpenTickets(req: Request, res: Response) {
  try {
    const tickets = await SupportTicket.find({ status: "open" });
    return res.send({
      err: false,
      tickets,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function createTicket(
  req: z.infer<typeof CreateTicketValidator>,
  res: Response
) {
  try {
    const { title, description, apps, priority, attachments, guest, user } =
      req.body;

    let foundUser;
    if (user) {
      foundUser = await User.findOne({ uuid: user }).orFail();
    }

    const ticket = await SupportTicket.create({
      uuid: v4(),
      title,
      description,
      apps,
      priority,
      attachments,
      user: foundUser ? foundUser._id : undefined,
      guest,
      timeOpened: new Date().toISOString(),
    });

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
    });

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

    return res.send({
      err: false,
      message: ticketMessage,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

export default {
  getTicket,
  getUserTickets,
  getOpenTickets,
  createTicket,
  updateTicket,
  createStaffMessage,
  getTicketMessages,
};
