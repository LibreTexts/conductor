import { Link } from "react-router-dom";
import { Breadcrumb, Segment } from "semantic-ui-react";
import Tooltip from "../../../../components/util/Tooltip";
import { IconInfoCircle } from "@tabler/icons-react";
import Button from "../../../../components/NextGenComponents/Button";
import ConsultInsightButton from "../../../../components/NextGenComponents/ConsultInsightButton";
import { useTypedSelector } from "../../../../state/hooks";
import { useModals } from "../../../../context/ModalContext";
import EnableDisableAutoCatalogMatching from "../../../../components/controlpanel/BooksManager/EnableDisableAutoCatalogMatching";
import Alert from "../../../../components/NextGenComponents/Alert";
import CommonsSyncModal from "../../../../components/controlpanel/BooksManager/CommonsSyncModal";

interface BooksManagerHeaderProps {
  isMasterCatalogView: boolean;
}

const BooksManagerHeader: React.FC<BooksManagerHeaderProps> = ({
  isMasterCatalogView,
}) => {
  const org = useTypedSelector((state) => state.org);
  const user = useTypedSelector((state) => state.user);
  const { openModal, closeAllModals } = useModals();

  function openSyncModal() {
    openModal(<CommonsSyncModal open={true} onClose={closeAllModals} />);
  }

  const BooksManagerBreadcrumb = () => {
    if (isMasterCatalogView) {
      return (
        <>
          <Breadcrumb.Section as={Link} to="/controlpanel/booksmanager">
            Books Manager
          </Breadcrumb.Section>
          <Breadcrumb.Divider icon="right chevron" />
          <Breadcrumb.Section active>Master Catalog View</Breadcrumb.Section>
        </>
      );
    } else {
      return <Breadcrumb.Section active>Books Manager</Breadcrumb.Section>;
    }
  };

  return (
    <>
      <Segment className="flex justify-between items-center">
        <Breadcrumb>
          <Breadcrumb.Section as={Link} to="/controlpanel">
            Control Panel
          </Breadcrumb.Section>
          <Breadcrumb.Divider icon="right chevron" />
          <BooksManagerBreadcrumb />
        </Breadcrumb>
        <div className="flex items-center gap-x-4">
          <div className="flex items-center">
            <p>
              <strong>Sync Schedule:</strong> Daily at 6:30 AM PST
            </p>
            <Tooltip
              text="Published books on the LibreTexts libraries are synced to the Commons master catalog every day at 6:30 AM PST. Books still in the 'Workbench' are not considered published and will not appear in the master catalog until they are published."
              position="bottom"
              className="!z-50"
            >
              <IconInfoCircle size={16} className="inline-block ml-1" />
            </Tooltip>
          </div>
          <Button
            icon={org.autoCatalogMatchingDisabled ? "IconLink" : "IconUnlink"}
            onClick={() => {
              openModal(
                <EnableDisableAutoCatalogMatching
                  open={true}
                  mode={org.autoCatalogMatchingDisabled ? "enable" : "disable"}
                  onClose={() => closeAllModals()}
                />
              );
            }}
          >
            {org.autoCatalogMatchingDisabled ? "Enable" : "Disable"} Automatic
            Catalog Matching
          </Button>
          <ConsultInsightButton href="https://commons.libretexts.org/insight/using-the-books-manager-and-understanding-catalog-matching" />
        </div>
      </Segment>
      {org.orgID === "libretexts" && (
        <Segment>
          <div className="flex items-center justify-between w-full gap-4">
            <Alert
              variant="info"
              message="The LibreTexts org displays all books in the master catalog. Changes made here will not have any effect."
              className=""
            />
            <Button
              color="blue"
              onClick={openSyncModal}
              icon="IconRefresh"
              disabled={!user.isSuperAdmin}
            >
              Sync Commons with Libraries
            </Button>
          </div>
        </Segment>
      )}
    </>
  );
};

export default BooksManagerHeader;
