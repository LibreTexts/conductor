import { useEffect, useState } from "react";
import ProjectSidePanel from "../../../components/projects/ProjectViewV2/ProjectSidePanel";
import useProject from "../../../hooks/projects/useProject";
import { useParams } from "react-router-dom";
import { capitalizeFirstLetter } from "../../../components/util/HelperFunctions";
import ProjectDiscussionPane from "../../../components/projects/ProjectViewV2/ProjectDiscussionPane";
import FilesManager from "../../../components/FilesManager";
import useProjectTeam from "../../../hooks/projects/useProjectTeam";
import { useTypedSelector } from "../../../state/hooks";
import ProjectHomePane from "../../../components/projects/ProjectViewV2/ProjectHomePane";

const ProjectSettings = () => {
  const user = useTypedSelector((state) => state.user);
  const { id } = useParams<{ id: string }>();
  const { project, loading } = useProject({ id });
  const { isProjectMemberOrGreater } = useProjectTeam({
    id,
    user,
  });

  const [activePane, setActivePane] = useState<string>("home");

  useEffect(() => {
    document.title = "LibreTexts Conductor | Project View";
  }, []);

  const RenderPane = () => {
    switch (activePane) {
      case "home":
        return <ProjectHomePane id={id} />;
      case "discussion":
        return <ProjectDiscussionPane id={id} />;
      case "assets":
        return (
          <FilesManager
            key={"files-manager"}
            projectID={id}
            flat={true}
            showToggle={false}
            toggleFilesManager={() => {}}
            canViewDetails={isProjectMemberOrGreater}
            projectHasDefaultLicense={
              project?.defaultFileLicense &&
              Object.keys(project.defaultFileLicense).length > 0
            }
            projectVisibility={project?.visibility}
          />
        );
      case "settings":
        return <div>Settings</div>;
      default:
        return <div>Home</div>;
    }
  };

  return (
    <div className="mt-[60px] bg-white h-full flex">
      <ProjectSidePanel activePane={activePane} setActivePane={setActivePane} />
      <div className="flex flex-col basis-10/12">
        <div className="mx-8 mt-10">
          <h2 className="text-3xl font-semibold mb-4">
            {project?.title} | {capitalizeFirstLetter(activePane)}
          </h2>
          <RenderPane />
        </div>
      </div>
    </div>
  );
};

export default ProjectSettings
