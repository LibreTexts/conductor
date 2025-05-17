import { useMemo } from "react";
import {
  Button,
  Card,
  Icon,
  Label,
  MenuItem,
  Popup,
  Segment,
  Tab,
} from "semantic-ui-react";
import ProjectCard from "../../projects/ProjectCard";
import { useModals } from "../../../context/ModalContext";
import PinProjectsModal from "./PinProjectsModal";
import { useMediaQuery } from "react-responsive";
import { usePinnedProjects } from "./hooks";

interface PinnedProjectsInterface {}

const PinnedProjects: React.FC<PinnedProjectsInterface> = () => {
  const { openModal, closeAllModals } = useModals();
  const isTailwindLg = useMediaQuery({ minWidth: 1024 });
  const { data, isLoading } = usePinnedProjects();

  const onShowPinnedModal = () => {
    if (!data) return;
    openModal(
      <PinProjectsModal show={true} onClose={() => closeAllModals()} />
    );
  };

  const NoPinnedMessage = () => {
    return (
      <div className="flex justify-center items-center h-full">
        <p className="text-gray-500">No pinned projects here</p>
      </div>
    );
  };

  const panes = useMemo(() => {
    if (!data) return [];

    const classList = "xl:!ml-24 2xl:!ml-4 3xl:!ml-0 !max-h-[500px] overflow-y-auto xl:!mr-1"
    const allItemsLength = data
      ?.map((i) => i.projects?.length)
      .reduce((acc, curr) => acc + (curr || 0), 0);

      // use localeCompare to sort the folders
    const alphaSorted = data?.sort((a, b) => {
      if (typeof a.folder === "string" && typeof b.folder === "string") {
        return a.folder.localeCompare(b.folder);
      }
      return 0;
    });

    const items = alphaSorted?.map((i) => ({
      menuItem: (
        <MenuItem key={i.folder}>
          {i.folder} <Label>{i.projects?.length}</Label>
        </MenuItem>
      ),
      render: () => {
        if (!i.projects || i.projects.length === 0) {
          return <NoPinnedMessage />;
        }
        return (
          <Card.Group itemsPerRow={2} className={classList}>
            {i.projects?.map((item) =>
              typeof item === "string" ? null : (
                <ProjectCard project={item} key={item.projectID} />
              )
            )}
          </Card.Group>
        );
      },
    }));

    items.push({
      menuItem: (
        <MenuItem key="all">
          All <Label>{allItemsLength}</Label>
        </MenuItem>
      ),
      render: () => {
        if (!data || allItemsLength === 0) {
          return <NoPinnedMessage />;
        }
        return (
          <Card.Group itemsPerRow={2} className={classList}>
            {data?.map((i) => {
              if (typeof i.projects === "string") return null;
              return i.projects?.map((item) =>
                typeof item === "string" ? null : (
                  <ProjectCard project={item} key={item.projectID} />
                )
              );
            })}
          </Card.Group>
        );
      },
    });

    return items;
  }, [data]);

  return (
    <Segment padded={Object.entries(data || {}).length > 0} loading={isLoading} className="!pb-10">
      <div className="header-custom mb-5">
        <h3>
          <Icon name="pin" />
          Pinned Projects
        </h3>
        <div className="right-flex">
          <Popup
            content={<span>Edit Pinned Projects</span>}
            trigger={
              <Button
                color="blue"
                onClick={onShowPinnedModal}
                icon
                circular
                size="tiny"
              >
                <Icon name="pencil" />
              </Button>
            }
            position="top center"
          />
        </div>
      </div>
      <Tab
        panes={panes}
        menu={{ vertical: isTailwindLg, tabular: !isTailwindLg }}
      ></Tab>
    </Segment>
  );
};

export default PinnedProjects;
