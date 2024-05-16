import { useState, useEffect } from "react";
import {
  Button,
  Comment,
  Feed,
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
    <div className="flex flex-col w-full bg-white rounded-md">
      <div className="flex flex-col border shadow-md rounded-md p-4 max-h-96 overflow-y-auto">
        <p className="text-2xl font-semibold text-center mb-0">Activity Feed</p>
        <div className="flex flex-col mt-2">
          {ticket.feed?.length === 0 && (
            <p className="text-lg text-center text-gray-500 italic">
              No history yet...
            </p>
          )}
          <Feed>
            {ticket.feed?.map((f) => (
              <TicketFeedEntry entry={f} key={crypto.randomUUID()} />
            ))}
          </Feed>
        </div>
      </div>
    </div>
  );
};
export default TicketFeed;
