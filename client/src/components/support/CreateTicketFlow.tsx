import { Button, Icon } from "semantic-ui-react";
import { useEffect, useState } from "react";
import { SupportTicket } from "../../types";
import { FormProvider, useForm } from "react-hook-form";
import {
  SupportTicketCategoryOptions,
  SupportTicketPriorityOptions,
} from "../../utils/supportHelpers";
import { Link, useLocation } from "react-router-dom";
import { SupportTicketPriority } from "../../types/support";
import { IconChevronRight } from "@tabler/icons-react";
import useURLSyncedState from "../../hooks/useURLSyncedState";
import RenderTicketRequestForm from "./RenderTicketRequestForm";
import useSupportQueues from "../../hooks/useSupportQueues";
import DynamicIcon, { DynamicIconName } from "../NextGenComponents/DynamicIcon";
import LoadingSpinner from "../LoadingSpinner";
import Alert from "../NextGenComponents/Alert";
import { useSupportCenterContext } from "../../context/SupportCenterContext";

interface CreateTicketFlowProps {
  isLoggedIn: boolean;
}

const CreateTicketFlow: React.FC<CreateTicketFlowProps> = ({ isLoggedIn }) => {
  const location = useLocation();
  const { setSelectedQueue } = useSupportCenterContext();
  const {
    data: queues,
    isLoading: isLoadingQueues,
    isValidQueue,
    getQueueIDBySlug,
  } = useSupportQueues({
    withCount: false,
  });

  const methods = useForm<SupportTicket>({
    defaultValues: {
      title: "",
      description: "",
      guest: {
        firstName: "",
        lastName: "",
        email: "",
        organization: "",
      },
      apps: [],
      attachments: [],
      status: "open",
    },
  });

  const [step, setStep] = useState(1);
  const [autoCapturedURL, setAutoCapturedURL] = useState<boolean>(false);

  useEffect(() => {
    processSearchParams();
  }, [queues]);

  useEffect(() => {
    //Check url for capturedURL query param
    const urlParams = new URLSearchParams(window.location.search);
    const capturedURL = urlParams.get("capturedURL");
    if (capturedURL) {
      methods.setValue("capturedURL", capturedURL);
      setAutoCapturedURL(true);
    }
  }, []);

  function processSearchParams() {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.has("fromURL")) {
      const captured = new URL(searchParams.get("fromURL") || "");
      methods.setValue("capturedURL", captured.toString());
      setAutoCapturedURL(true);
    }

    let categoryParam;
    let priorityParam;

    if (searchParams.has("category")) {
      const found = SupportTicketCategoryOptions.find(
        (opt) => opt.value === searchParams.get("category")
      );
      if (found) {
        categoryParam = found.value;
      }
    }

    if (searchParams.has("priority")) {
      const found = SupportTicketPriorityOptions.find(
        (opt) => opt.value === searchParams.get("priority")
      );
      if (found) {
        priorityParam = found.value;
      }
    }

    if (searchParams.has("queue")) {
      const queueValue = searchParams.get("queue") || "";
      if (queues && queueValue) {
        handleQueueSelect(queueValue, false);
      }
    }

    if (categoryParam) {
      methods.setValue("category", categoryParam);
    }

    if (priorityParam) {
      methods.setValue("priority", priorityParam as SupportTicketPriority);
    }
  }

  function handleQueueSelect(queueName: string, setInUrl?: boolean) {
    if (!isValidQueue(queueName)) {
      return;
    }

    const queueID = getQueueIDBySlug(queueName);
    if (queueID) {
      methods.setValue("queue_id", queueID);
      setSelectedQueue(queueName);
      setStep(2);
      if (setInUrl) {
        const url = new URL(window.location.toString());
        url.searchParams.set("queue", queueName);
        window.history.pushState({}, "", url);
      }
    }
  }

  const QueueSelector = () => {
    return (
      <ul
        role="list"
        className="divide-y divide-gray-200 overflow-hidden bg-white shadow-xs outline-1 outline-gray-900/5 sm:rounded-xl"
        aria-label="Support Queues"
      >
        {isLoadingQueues && <LoadingSpinner iconOnly={true} className="m-4" />}
        {!isLoadingQueues &&
          queues?.map((queue) => (
            <li
              key={queue.slug}
              className="relative flex justify-between gap-x-6 px-4 py-5 hover:bg-gray-50 sm:px-6 cursor-pointer"
              onClick={() => handleQueueSelect(queue.slug, true)}
            >
              <div className="flex min-w-0 gap-x-4 items-center">
                <DynamicIcon
                  icon={queue.icon as DynamicIconName}
                  className="!size-12 flex-none text-primary"
                />
                <div className="min-w-0 flex-auto">
                  <p className="text-xl font-semibold text-gray-900">
                    {queue.ticket_descriptor}
                  </p>
                  <p className="mt-1 flex text-gray-600">{queue.description}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-x-4">
                <IconChevronRight
                  aria-hidden="true"
                  className="size-8 flex-none text-gray-600"
                />
              </div>
            </li>
          ))}
      </ul>
    );
  };

  return (
    <FormProvider {...methods}>
      <div className="flex flex-col border rounded-lg m-4 p-4 w-full md:w-3/4 lg:w-1/2 shadow-lg bg-white">
        {step === 1 && <QueueSelector />}
        {step === 2 && (
          <RenderTicketRequestForm
            autoCapturedURL={autoCapturedURL}
            onSubmitSuccess={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <div className="flex flex-col w-full">
            <Alert
              variant="success"
              large={true}
              message="Your request has been submitted. You will receive an email
                confirmation shortly. When we have updates for you, you will
                receive email notifications."
            />
            <div className="flex flex-col lg:flex-row items-center justify-center mt-4">
              {isLoggedIn ? (
                <Button
                  className="!w-44"
                  color="blue"
                  as={Link}
                  to="/support/dashboard"
                >
                  <Icon name="ticket" />
                  My Tickets
                </Button>
              ) : (
                <Button color="blue" as={Link} to="/support">
                  <Icon name="text telephone" />
                  Back to Support
                </Button>
              )}
              <Button
                color="blue"
                as={Link}
                to="/"
                className="!mt-4 lg:!ml-2 lg:!mt-0"
              >
                <Icon name="book" />
                Back to Commons
              </Button>
            </div>
          </div>
        )}
      </div>
    </FormProvider>
  );
};

export default CreateTicketFlow;
