import { useState, useEffect } from "react";
import { Link, useParams, useHistory } from "react-router-dom";
import {
  Header,
  Segment,
  Grid,
  Breadcrumb,
  Image,
  Icon,
  Message,
  Dimmer,
  Loader,
} from "semantic-ui-react";
import Input from "../../../../components/NextGenInputs/Input";
import Button from "../../../../components/NextGenComponents/Button";
import {
  CentralIdentityOrg,
  CentralIdentityOrgAdminResult,
} from "../../../../types";
import useGlobalError from "../../../../components/error/ErrorHooks";
import { format, parseISO } from "date-fns";
import { useTypedSelector } from "../../../../state/hooks";
import api from "../../../../api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import SupportCenterTable from "../../../../components/support/SupportCenterTable";
import CopyButton from "../../../../components/util/CopyButton";
import { useNotifications } from "../../../../context/NotificationContext";
const DEFAULT_LOGO_URL = "https://cdn.libretexts.net/DefaultImages/avatar.png";

const CentralIdentityOrganizationView = () => {
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const queryClient = useQueryClient();
  const { handleGlobalError } = useGlobalError();
  const { addNotification } = useNotifications();
  const isSuperAdmin = useTypedSelector((state) => state.user.isSuperAdmin);

  const [editedName, setEditedName] = useState<string>("");
  const [originalName, setOriginalName] = useState<string>("");

  const { data, isLoading } = useQuery<CentralIdentityOrg>({
    queryKey: ["central-identity-org", id],
    queryFn: async () => {
      const res = await api.getCentralIdentityOrg({ orgId: id });
      return res.data.org;
    },
    enabled: !!id && isSuperAdmin,
  });

  const { data: admins, isLoading: isLoadingAdmins } = useQuery<
    CentralIdentityOrgAdminResult[]
  >({
    queryKey: ["central-identity-org-admins", id],
    queryFn: async () => {
      const res = await api.getCentralIdentityOrgAdmins(id);
      return res.data.admins;
    },
    enabled: !!id && isSuperAdmin,
  });

  useEffect(() => {
    if (!data) return;
    setEditedName(data.name || "");
    setOriginalName(data.name || "");
  }, [data]);

  const updateOrgMutation = useMutation({
    mutationFn: async () => {
      if (!data) return;
      const res = await api.patchCentralIdentityOrg({
        orgId: data.id,
        name: editedName,
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg || "Failed to update organization.");
      }
    },
    onError(error, variables, context) {
      handleGlobalError(error);
    },
    onSuccess(data, variables, context) {
      queryClient.invalidateQueries(["central-identity-org", id]);
    },
  });

  if (!isSuperAdmin) {
    return (
      <Message negative>
        <Message.Header>Access Denied</Message.Header>
        <p>Insufficient authorization.</p>
      </Message>
    );
  }

  if (isLoading) {
    return (
      <Segment style={{ minHeight: "200px" }}>
        <Dimmer active inverted>
          <Loader inverted content="Loading..." />
        </Dimmer>
      </Segment>
    );
  }

  if (!data) {
    return (
      <Grid className="controlpanel-container" centered>
        <Grid.Column width={16} textAlign="center">
          <Segment placeholder>
            <Header icon>
              <Icon name="warning sign" />
              Organization Not Found
            </Header>
            <p>
              The requested organization could not be found or you do not have
              permission to view it.
            </p>
          </Segment>
        </Grid.Column>
      </Grid>
    );
  }

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header" as="h2">
            Edit Organization
          </Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={16}>
          <Segment.Group>
            <Segment>
              <Breadcrumb>
                <Breadcrumb.Section as={Link} to="/controlpanel">
                  Control Panel
                </Breadcrumb.Section>
                <Breadcrumb.Divider icon="right chevron" />
                <Breadcrumb.Section as={Link} to="/controlpanel/libreone">
                  LibreOne Admin Console
                </Breadcrumb.Section>
                <Breadcrumb.Divider icon="right chevron" />
                <Breadcrumb.Section as={Link} to="/controlpanel/libreone/orgs">
                  Organizations & Systems
                </Breadcrumb.Section>
                <Breadcrumb.Divider icon="right chevron" />
                <Breadcrumb.Section active>
                  Edit Organization
                </Breadcrumb.Section>
              </Breadcrumb>
            </Segment>
            <Segment loading={isLoading}>
              <Grid columns={2} stackable>
                <Grid.Column width={4}>
                  <Image
                    src={data?.logo || DEFAULT_LOGO_URL}
                    size="medium"
                    bordered
                    style={{ marginBottom: "1em" }}
                  />
                </Grid.Column>
                <Grid.Column width={12}>
                  <div className="flex justify-between items-center border-b border-slate-300 py-1.5">
                    <Header as="h3" className="!m-0">
                      Properties
                    </Header>
                  </div>
                  <Input
                    name="orgName"
                    label="Organization Name"
                    placeholder="Organization Name"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="mt-4"
                  />

                  <div className="flex flex-row gap-6 mt-6">
                    <div className="flex flex-col">
                      <p className="font-semibold">Created At</p>
                      <p>
                        {data?.created_at
                          ? format(
                              parseISO(data.created_at),
                              "MM/dd/yyyy hh:mm aa"
                            )
                          : "N/A"}
                      </p>
                    </div>

                    <div className="flex flex-col">
                      <p className="font-semibold">Updated At</p>
                      <p>
                        {data?.updated_at
                          ? format(
                              parseISO(data.updated_at),
                              "MM/dd/yyyy hh:mm aa"
                            )
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col  bg-white h-fit space-y-1.5 my-8">
                    <div className="flex justify-between items-center mb-3 border-b border-slate-300 py-1.5">
                      <Header as="h3" className="!m-0">
                        Administrators
                      </Header>
                    </div>
                    <SupportCenterTable<
                      CentralIdentityOrgAdminResult & { actions?: string }
                    >
                      className="!shadow-none"
                      loading={isLoadingAdmins}
                      data={admins || []}
                      onRowClick={(record) => window.open(`/controlpanel/libreone/users/${record.user_id}`)}
                      columns={[
                        {
                          accessor: "user.first_name",
                          title: "First Name",
                        },
                        {
                          accessor: "user.last_name",
                          title: "Last Name",
                        },
                        {
                          accessor: "user.email",
                          title: "Email",
                          render(record, index) {
                            return (
                              <div className="flex flex-row">
                                {record.user.email}
                                <CopyButton val={record.user.email}>
                                  {({ copied, copy }) => (
                                    <Icon
                                      name="copy"
                                      className="cursor-pointer !ml-1"
                                      onClick={() => {
                                        copy();
                                        addNotification({
                                          message: "Email copied to clipboard",
                                          type: "success",
                                          duration: 2000,
                                        });
                                      }}
                                      color={copied ? "green" : "blue"}
                                    />
                                  )}
                                </CopyButton>
                              </div>
                            );
                          },
                        },
                        {
                          accessor: "admin_role",
                          title: "Admin Role",
                        },
                      ]}
                    />
                  </div>
                </Grid.Column>
              </Grid>
            </Segment>
            <Segment>
              <div className="flex justify-between items-center">
                <Button
                  onClick={() => history.goBack()}
                  icon="IconArrowLeft"
                  variant="secondary"
                >
                  Back
                </Button>
                <div className="flex flex-row gap-2">
                  <Button
                    onClick={() => setEditedName(originalName)}
                    disabled={editedName === originalName}
                    icon="IconX"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => updateOrgMutation.mutateAsync()}
                    disabled={editedName === originalName}
                    loading={updateOrgMutation.isLoading}
                    icon="IconDeviceFloppy"
                  >
                    Save
                  </Button>
                </div>
              </div>
            </Segment>
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default CentralIdentityOrganizationView;
