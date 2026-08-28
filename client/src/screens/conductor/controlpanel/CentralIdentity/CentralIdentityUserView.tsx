import { useState, useEffect, useMemo } from "react";
import lazyWithRetry from "../../../../utils/lazyWithRetry";
import { useHistory, useParams } from "react-router-dom";
import {
  Alert,
  Avatar,
  Breadcrumb,
  Button,
  Card,
  Heading,
  IconButton,
  Input,
  Select,
  Stack,
  Text,
} from "@libretexts/davis-react";
import { DataTable } from "@libretexts/davis-react-table";
import type { ColumnDef } from "@libretexts/davis-react-table";
import {
  IconBan,
  IconCheck,
  IconCopy,
  IconDeviceFloppy,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import {
  CentralIdentityUser,
  CentralIdentityApp,
  CentralIdentityOrg,
  CentralIdentityUserLicenseResult,
} from "../../../../types";
import useGlobalError from "../../../../components/error/ErrorHooks";
import { useForm, Controller } from "react-hook-form";
import {
  getPrettyAcademyOnlineAccessLevel,
  getPrettyAuthSource,
  toSelectOptions,
  userTypeOptions,
  verificationStatusOptions,
} from "../../../../utils/centralIdentityHelpers";
import HandleUserDisableModal from "../../../../components/controlpanel/CentralIdentity/HandleUserDisableModal";
import { dirtyValues } from "../../../../utils/misc";
import { useNotifications } from "../../../../context/NotificationContext";
import CopyButton from "../../../../components/util/CopyButton";
import { format, parseISO } from "date-fns";
import { utcToZonedTime } from "date-fns-tz";
import { useDocumentTitle } from "usehooks-ts";
const AddUserAppModal = lazyWithRetry(
  () =>
    import(
      "../../../../components/controlpanel/CentralIdentity/AddUserAppModal"
    )
);
const AddUserOrgModal = lazyWithRetry(
  () =>
    import(
      "../../../../components/controlpanel/CentralIdentity/AddUserOrgModal"
    )
);
const ConfirmRemoveOrgOrAppModal = lazyWithRetry(
  () =>
    import(
      "../../../../components/controlpanel/CentralIdentity/ConfirmRemoveOrgOrAppModal"
    )
);
const InternalNotesSection = lazyWithRetry(
  () => import("../../../../components/Notes/InternalNotesSection")
);
const UserSupportTickets = lazyWithRetry(
  () =>
    import(
      "../../../../components/controlpanel/CentralIdentity/UserSupportTickets"
    )
);

import api from "../../../../api";
import UserConductorData from "../../../../components/controlpanel/CentralIdentity/UserConductorData";
import CampusAdminRolesSection from "../../../../components/controlpanel/CentralIdentity/CampusAdminRolesSection";
import EditUserAcademyOnlineModal from "../../../../components/controlpanel/CentralIdentity/EditUserAcademyOnlineModal";
import { useModals } from "../../../../context/ModalContext";
import ConfirmModal from "../../../../components/ConfirmModal";
import AddUserAppLicenseModal from "../../../../components/controlpanel/CentralIdentity/AddUserAppLicenseModal";
import ChangeUserEmailModal from "../../../../components/controlpanel/CentralIdentity/ChangeUserEmailModal";
import { useTypedSelector } from "../../../../state/hooks";
import ConfirmDeleteUserModal from "../../../../components/controlpanel/CentralIdentity/ConfirmDeleteUserModal";

const DEFAULT_AVATAR_URL = "https://cdn.libretexts.net/DefaultImages/avatar.png";

const shortDate = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "short" }).format(
        new Date(value)
      )
    : "";

/** A read-only label/value pair. Replaces the repeated `<Header sub>` + `<span>` blocks. */
const DetailRow: React.FC<{
  label: string;
  children: React.ReactNode;
  valueClassName?: string;
}> = ({ label, children, valueClassName }) => (
  <div>
    <Text as="dt" size="sm" weight="semibold" color="muted">
      {label}
    </Text>
    <dd className={valueClassName ?? "break-words"}>{children}</dd>
  </div>
);

/** Copy-to-clipboard affordance. Focusable, unlike the `<Icon onClick>` it replaces. */
const CopyValueButton: React.FC<{ value: string; label: string }> = ({
  value,
  label,
}) => {
  const { addNotification } = useNotifications();
  return (
    <CopyButton val={value}>
      {({ copied, copy }) => (
        <IconButton
          icon={copied ? <IconCheck /> : <IconCopy />}
          aria-label={label}
          tooltip={label}
          variant="ghost"
          size="sm"
          onClick={() => {
            copy();
            addNotification({
              message: "Copied to clipboard!",
              type: "success",
              duration: 2000,
            });
          }}
        />
      )}
    </CopyButton>
  );
};

const makeOrganizationColumns = (
  onRemove: (orgId: string) => void
): ColumnDef<CentralIdentityOrg>[] => [
  { accessorKey: "name", header: "Name" },
  {
    id: "system",
    header: "System Name",
    accessorFn: (row) => row.system?.name ?? "",
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <IconButton
        icon={<IconTrash />}
        aria-label={`Remove organization ${row.original.name}`}
        tooltip="Remove organization"
        variant="destructive"
        size="sm"
        onClick={() => onRemove(row.original.id.toString())}
      />
    ),
  },
];

const makeAppLicenseColumns = (
  onRevoke: (licenseId: string) => void
): ColumnDef<CentralIdentityUserLicenseResult>[] => [
  {
    id: "name",
    header: "Name",
    accessorFn: (row) => row.application_license.name,
  },
  {
    accessorKey: "original_purchase_date",
    header: "Original Purchase",
    cell: ({ getValue }) => shortDate(getValue<string>()),
  },
  {
    accessorKey: "last_renewed_at",
    header: "Last Renewed",
    cell: ({ getValue }) => shortDate(getValue<string>()),
  },
  {
    id: "expires",
    header: "Expires At",
    cell: ({ row }) => {
      const app = row.original;
      if (app.application_license.perpetual) return "Perpetual";
      const isExpired = new Date(app.expires_at) < new Date();
      return `${isExpired ? "Expired " : ""}${shortDate(app.expires_at)}`;
    },
  },
  {
    id: "revoked",
    header: "Revoked?",
    cell: ({ row }) =>
      row.original.revoked && row.original.revoked_at
        ? shortDate(row.original.revoked_at)
        : "No",
  },
  { accessorKey: "granted_by", header: "Granted Through" },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <IconButton
        icon={<IconTrash />}
        aria-label={`Revoke license ${row.original.application_license.name}`}
        tooltip="Revoke license"
        variant="destructive"
        size="sm"
        disabled={row.original.revoked}
        onClick={() => onRevoke(row.original.application_license_id.toString())}
      />
    ),
  },
];

const makeUserAppColumns = (
  onRemove: (appId: string) => void
): ColumnDef<CentralIdentityApp>[] => [
  { accessorKey: "name", header: "Name" },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <IconButton
        icon={<IconTrash />}
        aria-label={`Remove application ${row.original.name}`}
        tooltip="Remove application"
        variant="destructive"
        size="sm"
        onClick={() => onRemove(row.original.id.toString())}
      />
    ),
  },
];

const CentralIdentityUserView = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const history = useHistory();
  useDocumentTitle("LibreTexts Conductor | Manage User");

  const [loading, setLoading] = useState<boolean>(false);
  const [userLoading, setUserLoading] = useState<boolean>(true);
  const [showAddAppModal, setShowAddAppModal] = useState<boolean>(false);
  const [showDisableUserModal, setShowDisableUserModal] =
    useState<boolean>(false);
  const [showAcademyAccessModal, setShowAcademyAccessModal] =
    useState<boolean>(false);
  const [showAddOrgModal, setShowAddOrgModal] = useState<boolean>(false);
  const [showDeleteUserModal, setShowDeleteUserModal] = useState<boolean>(false);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);
  const [userApps, setUserApps] = useState<CentralIdentityApp[]>([]);
  const [userAppLicenses, setUserAppLicenses] = useState<
    CentralIdentityUserLicenseResult[]
  >([]);
  const [showRemoveOrgOrAppModal, setShowRemoveOrgOrAppModal] =
    useState<boolean>(false);
  const [removeOrgOrAppType, setRemoveOrgOrAppType] = useState<"org" | "app">(
    "org"
  );
  const [removeOrgOrAppTargetId, setRemoveOrgOrAppTargetId] =
    useState<string>("");
  const [userInitVal, setUserInitVal] = useState<
    CentralIdentityUser | undefined
  >(undefined);
  const [userLocalID, setUserLocalID] = useState<string>("");

  const { handleGlobalError } = useGlobalError();
  const { addNotification } = useNotifications();
  const { openModal, closeAllModals } = useModals();
  const isSuperAdmin = useTypedSelector((state) => state.user.isSuperAdmin);

  const { control, register, formState, reset, watch, getValues, setValue } =
    useForm<CentralIdentityUser>({
      defaultValues: {
        first_name: "",
        last_name: "",
        disabled: false,
        disabled_reason: "",
        disabled_date: "",
        bio_url: "",
        user_type: "student",
        student_id: "",
        avatar: DEFAULT_AVATAR_URL,
        last_access: "",
        last_password_change: "",
      },
    });
  const { errors } = formState;

  // `watch` (not `getValues`) so conditional sections actually re-render when
  // the underlying field changes.
  const firstName = watch("first_name");
  const lastName = watch("last_name");
  const disabled = watch("disabled");
  const disabledReason = watch("disabled_reason");
  const disabledDate = watch("disabled_date");
  const userType = watch("user_type");
  const avatar = watch("avatar");
  const email = watch("email");
  const userUuid = watch("uuid");
  const externalIdp = watch("external_idp");
  const organizations = watch("organizations");
  const createdAt = watch("created_at");
  const timeZone = watch("time_zone");
  const lastAccess = watch("last_access");
  const lastPasswordChange = watch("last_password_change");
  const academyOnline = watch("academy_online");
  const academyOnlineExpiresRaw = watch("academy_online_expires");

  const userTypeSelectOptions = useMemo(
    () => toSelectOptions(userTypeOptions),
    []
  );
  const verificationStatusSelectOptions = useMemo(
    () => toSelectOptions(verificationStatusOptions),
    []
  );

  const handleDeleteUser = async () => {
    try {
      setDeleteLoading(true);
      const res = await api.deleteCentralIdentityUser(uuid!);

      if (res.data.err) {
        throw new Error("Failed to delete user");
      }

      addNotification({
        type: "success",
        message: "User deleted successfully",
      });

      // Navigate back to users list
      history.push("/controlpanel/libreone/users");
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setDeleteLoading(false);
      setShowDeleteUserModal(false);
    }
  };

  useEffect(() => {
    if (uuid) {
      loadUser();
      loadUserLocalID();
      loadUserApps();
      loadUserAppLicenses();
    }
  }, [uuid]);

  const academyOnlineExpires = useMemo(() => {
    if (!academyOnlineExpiresRaw) return "Never";
    return format(parseISO(academyOnlineExpiresRaw), "MM/dd/yyyy hh:mm aa");
  }, [academyOnlineExpiresRaw]);

  const disabledMessage = useMemo(() => {
    let message = "This user's account has been disabled.";
    if (disabledReason) {
      message += ` Reason: ${disabledReason}.`;
    }
    if (disabledDate) {
      const formatted = format(
        utcToZonedTime(
          parseISO(disabledDate),
          Intl.DateTimeFormat().resolvedOptions().timeZone
        ),
        "MM/dd/yyyy"
      );
      message += ` Disabled on ${formatted}.`;
    }
    return message;
  }, [disabledReason, disabledDate]);

  async function loadUser() {
    try {
      if (!uuid) return;
      setUserLoading(true);

      const res = await api.getCentralIdentityUser(uuid);
      if (res.data.err) {
        handleGlobalError(res.data.errMsg);
        return;
      }
      setUserInitVal(res.data.user);
      reset(res.data.user);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setUserLoading(false);
    }
  }

  async function loadUserLocalID() {
    try {
      if (!uuid) return;

      const res = await api.getUserFromCentralID(uuid);
      if (res.err) {
        handleGlobalError(res.errMsg || "An error occurred");
        return;
      }

      setUserLocalID(res.uuid);
    } catch (err: any) {
      // A 404 simply means the user has no local Conductor record, which is an
      // expected state. This lookup is supplementary and must never break the
      // page, so anything else is surfaced but still swallowed.
      if (err?.response?.status === 404 || err?.status === 404) {
        setUserLocalID("");
        return;
      }
      handleGlobalError(err);
    }
  }

  async function loadUserApps() {
    try {
      if (!uuid) return;

      const res = await api.getCentralIdentityUserApplications(uuid);
      if (res.data.err) {
        handleGlobalError(res.data.errMsg || "An error occurred");
        return;
      }

      setUserApps([...(res.data.applications as CentralIdentityApp[])]);
    } catch (err) {
      handleGlobalError(err);
    }
  }

  async function loadUserAppLicenses() {
    try {
      if (!uuid) return;

      const res = await api.getCentralIdentityUserAppLicenses(uuid);
      if (res.data.err) {
        handleGlobalError(res.data.errMsg || "An error occurred");
        return;
      }

      setUserAppLicenses(res.data.licenses);
    } catch (err) {
      handleGlobalError(err);
    }
  }

  function handleResetAvatar() {
    setValue("avatar", DEFAULT_AVATAR_URL.toString(), { shouldDirty: true });
  }

  function handleAddAppModalClose() {
    setShowAddAppModal(false);
    loadUserApps();
  }

  function handleAddOrgModalClose() {
    setShowAddOrgModal(false);
    loadUser();
  }

  function handleOpenRemoveOrgOrAppModal(type: "org" | "app", id: string) {
    setRemoveOrgOrAppType(type);
    setRemoveOrgOrAppTargetId(id);
    setShowRemoveOrgOrAppModal(true);
  }

  function handleRemoveOrgOrAppModalClose() {
    setShowRemoveOrgOrAppModal(false);
    if (removeOrgOrAppType === "org") {
      loadUser();
      return;
    }
    loadUserApps();
  }

  function handleOpenDisableUserModal() {
    setShowDisableUserModal(true);
  }

  function handleCloseDisableUserModal() {
    setShowDisableUserModal(false);
    loadUser();
  }

  function handleAcademyAccessModalClose(didUpdate = false) {
    setShowAcademyAccessModal(false);
    if (didUpdate) {
      loadUser();
    }
  }

  async function handleSave() {
    try {
      if (!userInitVal) return;
      setLoading(true);

      const data = dirtyValues<CentralIdentityUser>(
        formState.dirtyFields,
        getValues()
      );
      const res = await api.updateCentralIdentityUser(userInitVal.uuid, data);

      if (res.data.err) {
        handleGlobalError(res.data.errMsg);
        return;
      }

      addNotification({
        message: "User updated successfully!",
        type: "success",
      });
      loadUser();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleReEnableUser() {
    try {
      if (!uuid) return;
      setLoading(true);
      const res = await api.reEnableCentralIdentityUser(uuid);

      if (res.data?.err) {
        handleGlobalError(res.data.errMsg || res.data.err);
        return;
      }
      loadUser();
      addNotification({
        message: "User successfully re-enabled.",
        type: "success",
      });
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  function handleInitRevokeAppLicense(application_license_id: string) {
    if (!uuid || !application_license_id) return;
    openModal(
      <ConfirmModal
        text="Are you sure you want to revoke this application license? This does not handle any refunds, it simply removes the license from the user."
        onConfirm={() => {
          handleRevokeAppLicense(application_license_id);
        }}
        onCancel={closeAllModals}
      />
    );
  }

  async function handleRevokeAppLicense(application_license_id: string) {
    try {
      if (!uuid || !application_license_id) return;
      setLoading(true);

      const res = await api.revokeCentralIdentityAppLicense({
        user_id: uuid,
        application_license_id: application_license_id,
      });

      if (res.data.err) {
        handleGlobalError(res.data.errMsg || "An error occurred");
        return;
      }

      addNotification({
        message: "Application license revoked successfully.",
        type: "success",
      });

      closeAllModals();
      loadUserAppLicenses();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddUserAppLicense() {
    if (!uuid || !userAppLicenses) return;
    openModal(
      <AddUserAppLicenseModal
        show={true}
        userId={uuid}
        userCurrentApps={userAppLicenses}
        onClose={closeAllModals}
        onChanged={() => {
          closeAllModals();
          loadUserAppLicenses();
        }}
      />
    );
  }

  const organizationColumns = useMemo(
    () =>
      makeOrganizationColumns((orgId) =>
        handleOpenRemoveOrgOrAppModal("org", orgId)
      ),
    []
  );
  const appLicenseColumns = useMemo(
    () => makeAppLicenseColumns(handleInitRevokeAppLicense),
    [uuid]
  );
  const userAppColumns = useMemo(
    () =>
      makeUserAppColumns((appId) => handleOpenRemoveOrgOrAppModal("app", appId)),
    []
  );

  return (
    <div className="!h-full !p-8">
      <Stack direction="vertical" gap="md">
        <Heading level={2}>Manage User</Heading>
        <Breadcrumb>
          <Breadcrumb.Item href="/controlpanel">Control Panel</Breadcrumb.Item>
          <Breadcrumb.Item href="/controlpanel/libreone">
            LibreOne Admin Consoles
          </Breadcrumb.Item>
          <Breadcrumb.Item href="/controlpanel/libreone/users">
            Users
          </Breadcrumb.Item>
          <Breadcrumb.Item isCurrent>
            {`${firstName ?? ""} ${lastName ?? ""}`.trim() || "User"}
          </Breadcrumb.Item>
        </Breadcrumb>

        {disabled && (
          <Alert
            variant="warning"
            title="Account Disabled"
            message={disabledMessage}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left column */}
          <Stack direction="vertical" gap="lg" className="min-w-0">
            <Card>
              <Card.Body>
                <Stack direction="vertical" gap="md">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <Avatar
                        src={avatar || DEFAULT_AVATAR_URL}
                        alt={`${firstName ?? ""} ${lastName ?? ""}`.trim()}
                        size="xl"
                      />
                      <IconButton
                        icon={<IconBan />}
                        aria-label="Reset to default avatar"
                        tooltip="Reset to default avatar"
                        variant="ghost"
                        size="sm"
                        onClick={handleResetAvatar}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!externalIdp && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<IconPencil />}
                          loading={loading}
                          onClick={() => {
                            openModal(
                              <ChangeUserEmailModal
                                show={true}
                                userId={userUuid}
                                onChanged={() => {
                                  loadUser();
                                  closeAllModals();
                                }}
                                onClose={() => closeAllModals()}
                              />
                            );
                          }}
                        >
                          Change Email
                        </Button>
                      )}
                      {disabled ? (
                        <Button
                          variant="warning"
                          size="sm"
                          icon={<IconRefresh />}
                          loading={loading}
                          onClick={handleReEnableUser}
                        >
                          Re-Enable User
                        </Button>
                      ) : (
                        <Button
                          variant="destructive"
                          size="sm"
                          icon={<IconBan />}
                          loading={loading}
                          onClick={handleOpenDisableUserModal}
                        >
                          Disable User
                        </Button>
                      )}
                      {isSuperAdmin && (
                        <Button
                          variant="destructive"
                          size="sm"
                          icon={<IconTrash />}
                          loading={deleteLoading}
                          onClick={() => setShowDeleteUserModal(true)}
                        >
                          Delete User
                        </Button>
                      )}
                    </div>
                  </div>

                  <dl className="m-0">
                    <DetailRow label="Email">
                      <span className="inline-flex items-center gap-1 break-all">
                        {email}
                        <CopyValueButton
                          value={email ?? ""}
                          label="Copy email address"
                        />
                      </span>
                    </DetailRow>
                  </dl>

                  <Input
                    label="First Name"
                    required
                    disabled={userLoading}
                    error={!!errors.first_name}
                    errorMessage={errors.first_name?.message}
                    {...register("first_name", {
                      required: "First name is required.",
                    })}
                  />
                  <Input
                    label="Last Name"
                    required
                    disabled={userLoading}
                    error={!!errors.last_name}
                    errorMessage={errors.last_name?.message}
                    {...register("last_name", {
                      required: "Last name is required.",
                    })}
                  />
                  <Controller
                    name="user_type"
                    control={control}
                    render={({ field }) => (
                      <Select
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        label="User Type"
                        placeholder="Select a user type"
                        options={userTypeSelectOptions}
                        value={field.value ?? "student"}
                        onChange={(e) =>
                          field.onChange(e.target.value || "student")
                        }
                        disabled={userLoading}
                      />
                    )}
                  />
                  {userType === "student" && (
                    <Input
                      label="Student ID"
                      disabled={userLoading}
                      {...register("student_id")}
                    />
                  )}
                  {userType === "instructor" && (
                    <>
                      <Controller
                        name="verify_status"
                        control={control}
                        render={({ field }) => (
                          <Select
                            name={field.name}
                            ref={field.ref}
                            onBlur={field.onBlur}
                            label="Verification Status"
                            placeholder="Select a verification status"
                            options={verificationStatusSelectOptions}
                            value={field.value ?? "pending"}
                            onChange={(e) =>
                              field.onChange(e.target.value || "pending")
                            }
                            disabled={userLoading}
                          />
                        )}
                      />
                      <Input
                        label="Bio URL"
                        type="url"
                        placeholder="Bio URL..."
                        disabled={userLoading}
                        {...register("bio_url")}
                      />
                    </>
                  )}
                </Stack>
              </Card.Body>
              <Card.Footer className="flex justify-between">
                <Button
                  variant="secondary"
                  icon={<IconX />}
                  onClick={loadUser}
                  loading={userLoading}
                >
                  Cancel
                </Button>
                <Button
                  icon={<IconDeviceFloppy />}
                  onClick={handleSave}
                  loading={loading}
                  disabled={!formState.isDirty}
                >
                  Save
                </Button>
              </Card.Footer>
            </Card>

            <Card>
              <Card.Header>
                <Heading level={3}>Authentication &amp; Security Data</Heading>
              </Card.Header>
              <Card.Body>
                <dl className="flex flex-col gap-4 m-0">
                  <DetailRow label="UUID">
                    <span className="inline-flex items-center gap-1 font-mono break-all">
                      {userUuid}
                      <CopyValueButton
                        value={userUuid ?? ""}
                        label="Copy user UUID"
                      />
                    </span>
                  </DetailRow>
                  <DetailRow label="Authentication Source">
                    {externalIdp
                      ? getPrettyAuthSource(externalIdp)
                      : "LibreOne (Local)"}
                  </DetailRow>
                  <DetailRow label="Time of Account Creation">
                    {createdAt
                      ? format(
                          utcToZonedTime(
                            parseISO(createdAt),
                            timeZone as string
                          ),
                          "MM/dd/yyyy hh:mm aa"
                        )
                      : "Unknown"}
                  </DetailRow>
                  <DetailRow label="Time of Last Access">
                    {lastAccess
                      ? format(parseISO(lastAccess), "MM/dd/yyyy hh:mm aa")
                      : "Unknown"}
                  </DetailRow>
                  <DetailRow label="Time of Last Password Change">
                    {lastPasswordChange
                      ? format(
                          parseISO(lastPasswordChange),
                          "MM/dd/yyyy hh:mm aa"
                        )
                      : "Unknown"}
                  </DetailRow>
                </dl>
              </Card.Body>
            </Card>

            {userLocalID && <UserConductorData uuid={userLocalID} />}
          </Stack>

          {/* Right column */}
          <Stack direction="vertical" gap="lg" className="min-w-0">
            <Card>
              <Card.Header>
                <div className="flex items-center justify-between gap-2">
                  <Heading level={3}>Organizations</Heading>
                  <IconButton
                    icon={<IconPlus />}
                    aria-label="Add organization"
                    tooltip="Add organization"
                    size="sm"
                    onClick={() => setShowAddOrgModal(true)}
                  />
                </div>
              </Card.Header>
              <Card.Body>
                <DataTable<CentralIdentityOrg>
                  data={organizations ?? []}
                  columns={organizationColumns}
                  density="compact"
                  maxHeight="300px"
                  bordered
                  caption="Organizations this user belongs to"
                  emptyState="No organizations found."
                />
              </Card.Body>
            </Card>

            {userLocalID && isSuperAdmin && (
              <CampusAdminRolesSection uuid={userLocalID} />
            )}

            <Card>
              <Card.Header>
                <div className="flex items-center justify-between gap-2">
                  <Heading level={3}>Application Licenses</Heading>
                  <IconButton
                    icon={<IconPlus />}
                    aria-label="Add application license"
                    tooltip="Add application license"
                    size="sm"
                    onClick={handleAddUserAppLicense}
                  />
                </div>
              </Card.Header>
              <Card.Body>
                <DataTable<CentralIdentityUserLicenseResult>
                  data={userAppLicenses}
                  columns={appLicenseColumns}
                  density="compact"
                  maxHeight="300px"
                  bordered
                  caption="Application licenses granted to this user"
                  emptyState="No application licenses found."
                />
              </Card.Body>
            </Card>

            <Card>
              <Card.Header>
                <div className="flex items-center justify-between gap-2">
                  <Heading level={3}>Application Security Access</Heading>
                  <IconButton
                    icon={<IconPlus />}
                    aria-label="Add application security access"
                    tooltip="Add application security access"
                    size="sm"
                    onClick={() => setShowAddAppModal(true)}
                  />
                </div>
              </Card.Header>
              <Card.Body>
                <DataTable<CentralIdentityApp>
                  data={userApps}
                  columns={userAppColumns}
                  density="compact"
                  maxHeight="300px"
                  bordered
                  caption="Applications this user can access"
                  emptyState="No applications found."
                />
              </Card.Body>
            </Card>

            <Card>
              <Card.Header>
                <div className="flex items-center justify-between gap-2">
                  <Heading level={3}>Academy Online</Heading>
                  <IconButton
                    icon={<IconPencil />}
                    aria-label="Edit Academy Online access"
                    tooltip="Edit Academy Online access"
                    size="sm"
                    onClick={() => setShowAcademyAccessModal(true)}
                  />
                </div>
              </Card.Header>
              <Card.Body>
                <dl className="flex flex-col gap-4 m-0">
                  <DetailRow label="Level">
                    {getPrettyAcademyOnlineAccessLevel(academyOnline)}
                  </DetailRow>
                  <DetailRow label="Access Expires">
                    {academyOnlineExpires}
                  </DetailRow>
                </dl>
              </Card.Body>
            </Card>

            {userLocalID && <UserSupportTickets uuid={userLocalID} />}

            <InternalNotesSection userId={uuid} />
          </Stack>
        </div>
      </Stack>

      <AddUserAppModal
        show={showAddAppModal}
        userId={uuid}
        currentApps={userApps.map((app) => app.id.toString())}
        onClose={handleAddAppModalClose}
      />
      <AddUserOrgModal
        show={showAddOrgModal}
        userId={uuid}
        currentOrgs={organizations?.map((org) => org.id.toString()) ?? []}
        onClose={handleAddOrgModalClose}
      />
      <ConfirmRemoveOrgOrAppModal
        show={showRemoveOrgOrAppModal}
        type={removeOrgOrAppType}
        userId={uuid}
        targetId={removeOrgOrAppTargetId}
        onClose={handleRemoveOrgOrAppModalClose}
      />
      <HandleUserDisableModal
        show={showDisableUserModal}
        userId={uuid}
        onClose={handleCloseDisableUserModal}
      />
      <EditUserAcademyOnlineModal
        show={showAcademyAccessModal}
        userId={uuid}
        onClose={() => handleAcademyAccessModalClose(false)}
        onChanged={() => {
          handleAcademyAccessModalClose(true);
        }}
      />
      <ConfirmDeleteUserModal
        open={showDeleteUserModal}
        userName={`${firstName} ${lastName}`}
        userUuid={userUuid}
        onClose={() => setShowDeleteUserModal(false)}
        onConfirmDelete={handleDeleteUser}
        loading={deleteLoading}
      />
    </div>
  );
};

export default CentralIdentityUserView;
