import { useState, useEffect } from "react";
import {
  Button,
  Comment,
  Feed,
  FeedContent,
  FeedDate,
  FeedEvent,
  FeedLabel,
  FeedLike,
  FeedMeta,
  FeedSummary,
  FeedUser,
  Form,
  Header,
  Icon,
  TextArea,
} from "semantic-ui-react";
import {
  SupportTicket,
  SupportTicketFeedEntry,
  SupportTicketMessage,
} from "../../types";
import { format, parseISO } from "date-fns";
import useGlobalError from "../error/ErrorHooks";
import axios from "axios";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface TicketFeedProps {
  ticket: SupportTicket;
}

const TicketFeed: React.FC<TicketFeedProps> = ({ ticket }) => {
  const { handleGlobalError } = useGlobalError();

  const getEntryTimestamp = (entry: SupportTicketFeedEntry) => {
    return format(parseISO(entry.date), "MM/dd/yyyy hh:mm aa");
  }

  const TicketFeedEntry = ({ entry }: { entry: SupportTicketFeedEntry }) => {
    return (
      <div className="flex flex-row items-center">
        <div className="flex flex-row items-center mb-4">
          <Icon name="circle" color="blue" />
        </div>
        <div className="ml-2 mb-2">
          <div>
            <p>{entry.action}</p>
            <p className="text-sm text-slate-500">{entry.blame} - {getEntryTimestamp(entry)}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col w-full bg-white">
      <div className="flex flex-col border shadow-md rounded-md p-4">
        <p className="text-2xl font-semibold text-center">Ticket Feed</p>
        <div className="flex flex-col mt-8">
          {ticket.feed?.length === 0 && (
            <p className="text-lg text-center text-gray-500 italic">
              No history yet...
            </p>
          )}
          <Feed>
            {ticket.feed?.map((f) => (
              <TicketFeedEntry entry={f} />
            ))}
          </Feed>
        </div>
      </div>
    </div>
  );
};
export default TicketFeed;
