import {
  Button,
  Divider,
  Dropdown,
  Form,
  Icon,
  Message,
  TextArea,
} from "semantic-ui-react";
import useGlobalError from "../error/ErrorHooks";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { CentralIdentityApp, SupportTicket } from "../../types";
import { Controller, get, useForm } from "react-hook-form";
import CtlTextInput from "../ControlledInputs/CtlTextInput";
import { required } from "../../utils/formRules";
import {
  SupportTicketCategoryOptions,
  SupportTicketPriorityOptions,
} from "../../utils/supportHelpers";
import { useTypedSelector } from "../../state/hooks";
import { Link, useLocation } from "react-router-dom";
import FileUploader from "../FileUploader";
import TurnstileWidget from "../util/TurnstileWidget";

interface CreateTicketFlowProps {
  isLoggedIn: boolean;
}

const CreateTicketFlow: React.FC<CreateTicketFlowProps> = ({ isLoggedIn }) => {
  const { handleGlobalError } = useGlobalError();
  const user = useTypedSelector((state) => state.user);
  const location = useLocation();
  const { control, getValues, setValue, watch, trigger } =
    useForm<SupportTicket>({
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
        priority: "low",
        status: "open",
      },
    });

  const [loading, setLoading] = useState(false);
  const [apps, setApps] = useState<CentralIdentityApp[]>([]);
  const [autoCapturedURL, setAutoCapturedURL] = useState<boolean>(false);
  const [success, setSuccess] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const [challengePassed, setChallengePassed] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.has("fromURL")) {
      const captured = new URL(searchParams.get("fromURL") || "");
      setValue("capturedURL", captured.toString());
      setAutoCapturedURL(true);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) return;
    if (!turnstileToken) return;
    verifyTurnstile(turnstileToken);
  }, [isLoggedIn, turnstileToken]);

  async function verifyTurnstile(token: string) {
    try {
      if (!token) throw new Error("Invalid token");
      const res = await axios.get("/auth/turnstile", {
        params: {
          token: token,
        },
      });

      if (!res || !res.data) {
        throw new Error("Invalid response from server");
      }

      if (res.data.success) {
        setChallengePassed(true);
      } else {
        setChallengePassed(false);
      }
    } catch (err) {
      handleGlobalError(err);
    }
  }

  useEffect(() => {
    document.title = "LibreTexts | Create Support Ticket";
    loadApps();

    //Check url for capturedURL query param
    const urlParams = new URLSearchParams(window.location.search);
    const capturedURL = urlParams.get("capturedURL");
    if (capturedURL) {
      setValue("capturedURL", capturedURL);
      setAutoCapturedURL(true);
    }
  }, []);

  const submitDisabled = useMemo(() => {
    if ((!user || !user.uuid) && !challengePassed) {
      return true;
    }

    if (!user || !user.uuid) {
      if (
        !getValues("guest.firstName").trim() ||
        !getValues("guest.lastName").trim() ||
        !getValues("guest.email").trim() ||
        !getValues("guest.organization").trim()
      ) {
        return true;
      }
    }

    if (
      !getValues("title").trim() ||
      !getValues("category") ||
      !getValues("priority") ||
      !getValues("description").trim()
    ) {
      return true;
    }

    return false;
  }, [loading, user, challengePassed, watch()]);

  async function loadApps() {
    try {
      setLoading(true);
      const res = await axios.get("/central-identity/public/apps");
      if (res.data.err) {
        throw new Error(res.data.err);
      }
      if (!res.data.applications || !Array.isArray(res.data.applications)) {
        throw new Error("Invalid response from server");
      }
      setApps(res.data.applications);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    try {
      setLoading(true);
      if (!(await trigger())) return;

      const vals = getValues();
      if (user && user.isAuthenticated) {
        vals.guest = undefined;
      }

      const res = await axios.post("/support/ticket", {
        ...vals,
      });

      if (res.data.err) {
        throw new Error(res.data.err);
      }

      if (!res.data.ticket) {
        throw new Error("Invalid response from server");
      }

      if (!files || files.length === 0) {
        setSuccess(true);
        return;
      }

      await handleAttachmentsUpload(res.data.ticket.uuid, files);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAttachmentsUpload(ticketID: string, files: File[]) {
    setLoading(true);
    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append("files", file);
    });

    try {
      const uploadRes = await axios.post(
        `/support/ticket/${ticketID}/attachments`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      if (uploadRes.data.err) {
        throw new Error(uploadRes.data.errMsg);
      }
      setSuccess(true);
    } catch (e: any) {
      if (e.message === "canceled") return; // Noop if canceled
      setLoading(false);
      handleGlobalError(e);
    }
  }

  async function saveFilesToState(files: FileList) {
    setLoading(true);
    setFiles(Array.from(files));
    setLoading(false);
  }

  const getRemainingChars = (newDescrip: string) => {
    const charsRemain = 1000 - newDescrip.length;
    return charsRemain;
  };

  return (
    <div
      className="flex flex-col border rounded-lg m-4 p-4 w-full lg:w-2/3 shadow-lg bg-white"
      aria-busy={loading}
    >
      {!success && (
        <>
          <Form className="m-2" onSubmit={(e) => e.preventDefault()}>
            {user && user.uuid && (
              <Message color="green" icon size="tiny">
                <Icon name="check" />
                <Message.Content>
                  <Message.Header>Logged In</Message.Header>
                  You're logged in so we can automatically associate your ticket
                  with your account.
                </Message.Content>
              </Message>
            )}
            {(!user || !user.uuid) && (
              <div className="mb-4">
                <p className="font-bold mb-1">Your Contact Info</p>
                <div className="flex flex-col lg:flex-row w-full">
                  <div className="w-full mr-8">
                    <CtlTextInput
                      control={control}
                      name="guest.firstName"
                      label="First Name"
                      placeholder="Enter your first name"
                      rules={required}
                      required
                      fluid
                    />
                  </div>
                  <div className="w-full">
                    <CtlTextInput
                      control={control}
                      name="guest.lastName"
                      label="Last Name"
                      placeholder="Enter your last name"
                      rules={required}
                      required
                      fluid
                    />
                  </div>
                </div>
                <div className="flex flex-col lg:flex-row w-full mt-4">
                  <div className="w-full mr-8">
                    <CtlTextInput
                      control={control}
                      name="guest.email"
                      label="Email"
                      placeholder="Enter your email"
                      rules={required}
                      required
                      fluid
                    />
                  </div>
                  <div className="w-full">
                    <CtlTextInput
                      control={control}
                      name="guest.organization"
                      label="Organization"
                      placeholder="Enter your school or organization"
                      rules={required}
                      required
                      fluid
                    />
                  </div>
                </div>
                <Divider className="" />
              </div>
            )}
            <p className="font-bold !mb-2">Request Info</p>
            <div className="!mt-0">
              <CtlTextInput
                control={control}
                name="title"
                label="Subject"
                placeholder="Enter a subject/brief title for your ticket"
                rules={required}
                required
                maxLength={200}
                className=""
              />
            </div>
            <div className="mt-1">
              <label
                className="form-field-label form-required"
                htmlFor="selectCategory"
              >
                Category
              </label>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <Dropdown
                    id="selectCategory"
                    options={SupportTicketCategoryOptions}
                    {...field}
                    onChange={(e, { value }) => {
                      field.onChange(value);
                    }}
                    fluid
                    selection
                    search
                    placeholder="Select the category of your ticket"
                  />
                )}
              />
            </div>
            {["technical", "feature"].includes(watch("category")) && (
              <div className="mt-2">
                <label
                  className="form-field-label form-required"
                  htmlFor="selectApps"
                >
                  Application/Library (select all that apply)
                </label>
                <Controller
                  name="apps"
                  control={control}
                  render={({ field }) => (
                    <Dropdown
                      id="selectApps"
                      options={apps.map((app) => ({
                        key: app.id,
                        value: app.id,
                        text: app.name,
                      }))}
                      {...field}
                      onChange={(e, { value }) => {
                        field.onChange(value);
                      }}
                      fluid
                      selection
                      multiple
                      search
                      required
                      placeholder="Select the applications and/or libraries related to your ticket"
                    />
                  )}
                />
              </div>
            )}
            <div className="mt-2">
              <label
                className="form-field-label form-required"
                htmlFor="selectPriority"
              >
                Priority
              </label>
              <Controller
                name="priority"
                control={control}
                render={({ field }) => (
                  <Dropdown
                    id="selectPriority"
                    options={SupportTicketPriorityOptions}
                    {...field}
                    onChange={(e, { value }) => {
                      field.onChange(value);
                    }}
                    fluid
                    selection
                    placeholder="Select the priority of your ticket"
                  />
                )}
              />
              <p className="text-xs text-gray-500 italic">
                Note: A higher priority does not guarantee a faster response.
                Support tickets created by users from LibreNet member campuses
                are reviewed first.
              </p>
            </div>
            {!autoCapturedURL && (
              <div className="mt-2">
                <CtlTextInput
                  control={control}
                  name="capturedURL"
                  label="URL (if applicable)"
                  placeholder="Enter the URL of the page this ticket is related to - this may help us resolve your issue faster"
                  type="url"
                />
              </div>
            )}
            <Form.Field className="!mt-2">
              <label
                className="form-field-label form-required"
                htmlFor="description"
              >
                Description
              </label>
              <TextArea
                id="description"
                placeholder="Please describe your issue in detail. Include any relevant information (e.g. error messages, steps to reproduce, etc.)"
                value={watch("description")}
                onInput={(e) => setValue("description", e.currentTarget.value)}
                maxLength={1000}
              />
              <p className="text-xs text-gray-500 italic">
                Chars Remaining: {getRemainingChars(watch("description"))}.
                Note: Please do not include any sensitive information (e.g.
                passwords) in your description.
              </p>
            </Form.Field>
          </Form>
          <label className="form-field-label">
            Attachments (optional) (max 4 files, 100 MB each)
          </label>
          <FileUploader
            multiple={true}
            maxFiles={4}
            onUpload={saveFilesToState}
            showUploads={true}
          />
          {!isLoggedIn && (
            <div className="flex flex-row items-center justify-center mt-8">
              <TurnstileWidget onSuccess={(t) => setTurnstileToken(t)} />
            </div>
          )}
          <div className="flex flex-row justify-end mt-4">
            <Button
              color="blue"
              loading={loading}
              onClick={handleSubmit}
              disabled={submitDisabled}
            >
              <Icon name="send" />
              Submit
            </Button>
          </div>
        </>
      )}
      {success && (
        <div className="flex flex-col w-full">
          <Message color="green" icon>
            <Icon name="check" />
            <Message.Content>
              <Message.Header>Success</Message.Header>
              Your ticket has been submitted. You will receive an email
              confirmation shortly. When we have updates for you, you will
              receive email notifications.
            </Message.Content>
          </Message>

          <div className="flex flex-col lg:flex-row items-center justify-center">
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
  );
};

export default CreateTicketFlow;
