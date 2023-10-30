import { Dropdown, Form, Message } from "semantic-ui-react";
import useGlobalError from "../error/ErrorHooks";
import { useEffect, useState } from "react";
import axios from "axios";
import { CentralIdentityApp, SupportTicket } from "../../types";
import { Controller, useForm } from "react-hook-form";

interface CreateTicketFlowProps {
  isLoggedIn: boolean;
}

const CreateTicketFlow: React.FC<CreateTicketFlowProps> = ({ isLoggedIn }) => {
  const { handleGlobalError } = useGlobalError();
  const { control, getValues, setValue } = useForm<SupportTicket>({
    defaultValues: {
      title: "",
      description: "",
      apps: [],
      attachments: [],
      priority: "low",
      status: "open",
    },
  });

  const [loading, setLoading] = useState(false);
  const [apps, setApps] = useState<CentralIdentityApp[]>([]);

  useEffect(() => {
    document.title = "LibreTexts | Create Support Ticket";
    loadApps();
  }, []);

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

  return (
    <div className="flex flex-col border rounded-lg m-4 w-2/3">
      <Form className="m-4">
        {isLoggedIn && (
          <Message>
            <Message.Header>Logged In</Message.Header>
            <Message.Content>
              You're logged in so we can automatically associate your ticket
              with your account.
            </Message.Content>
          </Message>
        )}
        <div className="mt-2">
          <label
            className="form-field-label form-required"
            htmlFor="selectLicense"
          >
            Name
          </label>
          <Controller
            name="apps"
            control={control}
            render={({ field }) => (
              <Dropdown
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
              />
            )}
          />
        </div>
      </Form>
    </div>
  );
};

export default CreateTicketFlow;
