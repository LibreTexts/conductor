import { Breadcrumb, Button, Heading, Stack } from "@libretexts/davis-react";
import { DataTable } from "@libretexts/davis-react-table";
import type { ColumnDef } from "@libretexts/davis-react-table";
import { IconKey } from "@tabler/icons-react";
import { CentralIdentityAppLicense } from "../../../../types";
import { getPrettyAcademyOnlineAccessLevel } from "../../../../utils/centralIdentityHelpers";
import useCentralIdentityAppLicenses from "../../../../hooks/useCentralIdentityAppLicenses";
import { useModals } from "../../../../context/ModalContext";
import BulkGenerateAccessCodesModal from "../../../../components/controlpanel/CentralIdentity/BulkGenerateAccessCodesModal";

const columns: ColumnDef<CentralIdentityAppLicense>[] = [
  {
    accessorKey: "uuid",
    header: "ID",
  },
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "stripe_id",
    header: "Stripe ID",
  },
  {
    accessorKey: "perpetual",
    header: "Perpetual",
    cell: ({ getValue }) => (getValue<boolean>() ? "Yes" : "No"),
  },
  {
    accessorKey: "trial",
    header: "Trial",
    cell: ({ getValue }) => (getValue<boolean>() ? "Yes" : "No"),
  },
  {
    accessorKey: "is_academy_license",
    header: "Is Academy License",
    cell: ({ getValue }) => (getValue<boolean>() ? "Yes" : "No"),
  },
  {
    accessorKey: "academy_level",
    header: "Academy Level",
    cell: ({ getValue }) => {
      const academyLevel = getValue<number | null>();
      return academyLevel === null
        ? "N/A"
        : getPrettyAcademyOnlineAccessLevel(academyLevel);
    },
  },
  {
    accessorKey: "duration_days",
    header: "Duration (Days)",
  },
];

const CentralIdentityAppLicenses = () => {
  const { data, isLoading } = useCentralIdentityAppLicenses();
  const { openModal, closeAllModals } = useModals();

  const openBulkGenerateModal = () => {
    openModal(
      <BulkGenerateAccessCodesModal show onClose={closeAllModals} />
    );
  };

  return (
    <div className="!h-full !p-8">
      <Stack direction="vertical" gap="md" className="mb-4">
        <Heading level={2}>LibreOne Admin Console: App Licenses</Heading>
        <div className="flex w-full items-center justify-between gap-4">
          <Breadcrumb>
            <Breadcrumb.Item href="/controlpanel">Control Panel</Breadcrumb.Item>
            <Breadcrumb.Item href="/controlpanel/libreone">
              LibreOne Admin Consoles
            </Breadcrumb.Item>
            <Breadcrumb.Item isCurrent>App Licenses</Breadcrumb.Item>
          </Breadcrumb>
          <Button
            variant="primary"
            icon={<IconKey size={16} aria-hidden="true" />}
            onClick={openBulkGenerateModal}
          >
            Bulk Generate Access Codes
          </Button>
        </div>
        <DataTable<CentralIdentityAppLicense>
          data={data || []}
          columns={columns}
          loading={isLoading}
          density="compact"
        />
      </Stack>
    </div>
  );
};

export default CentralIdentityAppLicenses;
