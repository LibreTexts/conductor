import { Link } from "react-router-dom";
import { Header, Segment, Grid, Breadcrumb } from "semantic-ui-react";
import { CentralIdentityAppLicense } from "../../../../types";
import { getPrettyAcademyOnlineAccessLevel } from "../../../../utils/centralIdentityHelpers";
import SupportCenterTable from "../../../../components/support/SupportCenterTable";
import Button from "../../../../components/NextGenComponents/Button";
import useCentralIdentityAppLicenses from "../../../../hooks/useCentralIdentityAppLicenses";
import { useModals } from "../../../../context/ModalContext";
import BulkGenerateAccessCodesModal from "../../../../components/controlpanel/CentralIdentity/BulkGenerateAccessCodesModal";

const CentralIdentityAppLicenses = () => {
  const { data, isLoading } = useCentralIdentityAppLicenses();
  const { openModal, closeAllModals } = useModals();

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header" as="h2">
            LibreOne Admin Console: App Licenses
          </Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={16}>
          <Segment.Group>
            <Segment>
              <div className="flex flex-row justify-between !w-full items-center">
                <Breadcrumb>
                  <Breadcrumb.Section as={Link} to="/controlpanel">
                    Control Panel
                  </Breadcrumb.Section>
                  <Breadcrumb.Divider icon="right chevron" />
                  <Breadcrumb.Section as={Link} to="/controlpanel/libreone">
                    LibreOne Admin Consoles
                  </Breadcrumb.Section>
                  <Breadcrumb.Divider icon="right chevron" />
                  <Breadcrumb.Section active>App Licenses</Breadcrumb.Section>
                </Breadcrumb>
                <Button
                  icon="IconKey"
                  onClick={() => {
                    openModal(
                      <BulkGenerateAccessCodesModal
                        show={true}
                        onClose={closeAllModals}
                      />
                    );
                  }}
                >
                  Bulk Generate Access Codes
                </Button>
              </div>
            </Segment>
            <Segment>
              <SupportCenterTable<CentralIdentityAppLicense>
                data={data}
                loading={isLoading}
                columns={[
                  {
                    accessor: "uuid",
                    title: "ID",
                  },
                  {
                    accessor: "name",
                  },
                  {
                    accessor: "stripe_id",
                    title: "Stripe ID",
                  },
                  {
                    accessor: "perpetual",
                  },
                  {
                    accessor: "trial",
                  },
                  {
                    accessor: "is_academy_license",
                    title: "Is Academy License",
                  },
                  {
                    accessor: "academy_level",
                    title: "Academy Level",
                    render(record, index) {
                      return (
                        <span>
                          {getPrettyAcademyOnlineAccessLevel(
                            record.academy_level
                          )}
                        </span>
                      );
                    },
                  },
                  {
                    accessor: "duration_days",
                    title: "Duration (Days)",
                  },
                ]}
              />
            </Segment>
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default CentralIdentityAppLicenses;
