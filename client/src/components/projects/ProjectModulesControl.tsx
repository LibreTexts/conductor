import {
  UseFormGetValues,
  UseFormSetValue,
  UseFormWatch,
} from "react-hook-form";

import { Button, Checkbox } from "semantic-ui-react";
import { Project, ProjectModule, ProjectModuleSettings } from "../../types";
import { capitalizeFirstLetter } from "../util/HelperFunctions";

const ModuleRow = ({
  index,
  title,
  enabled,
  onMoveUp,
  onMoveDown,
  onToggle,
}: {
  index: number;
  title: ProjectModule;
  enabled: boolean;
  onMoveUp: (idx: number) => void;
  onMoveDown: (idx: number) => void;
  onToggle: (key: ProjectModule) => void;
}) => {
  const isFirstItem = index === 0;
  const isLastItem = index === 2;
  return (
    <div
      className={`bg-white border h-14 px-4 max-w-5xl ${
        isFirstItem && "rounded-t-md"
      } ${isLastItem && "rounded-b-md"}`}
    >
      <div className="flex flex-row justify-between items-center h-full">
        <p className="font-bold">{capitalizeFirstLetter(title)}</p>
        <div className="flex flex-row items-center">
          <Button.Group size="tiny">
            <Button
              icon="arrow up"
              onClick={() => onMoveUp(index)}
              disabled={isFirstItem}
            />
            <Button
              icon="arrow down"
              onClick={() => onMoveDown(index)}
              disabled={isLastItem}
            />
          </Button.Group>
          <Checkbox
            toggle
            onChange={() => onToggle(title)}
            checked={enabled}
            className="ml-2"
          />
        </div>
      </div>
    </div>
  );
};

interface ProjectModulesControlProps extends React.HTMLProps<HTMLDivElement> {
  getValues: UseFormGetValues<Project>;
  setValue: UseFormSetValue<Project>;
  watch: UseFormWatch<Project>;
}

const ProjectModulesControl: React.FC<ProjectModulesControlProps> = ({
  getValues,
  setValue,
  watch,
  ...rest
}) => {
  function onMoveUp(idx: number) {
    if (idx === 0) return;
    const modules = Object.entries(getValues("projectModules") ?? {});
    const newModules = [...modules];
    const temp = newModules[idx];
    newModules[idx] = newModules[idx - 1];
    newModules[idx - 1] = temp;
    const newModulesObj = newModules.reduce((acc, [key, value], idx) => {
      // @ts-ignore
      acc[key] = value;
      // @ts-ignore
      acc[key].order = idx;
      return acc;
    }, {});
    setValue("projectModules", newModulesObj as ProjectModuleSettings);
  }

  function onMoveDown(idx: number) {
    if (idx === 2) return;
    const modules = Object.entries(getValues("projectModules") ?? {});
    const newModules = [...modules];
    const temp = newModules[idx];
    newModules[idx] = newModules[idx + 1];
    newModules[idx + 1] = temp;
    const newModulesObj = newModules.reduce((acc, [key, value], idx) => {
      // @ts-ignore
      acc[key] = value;
      // @ts-ignore
      acc[key].order = idx;
      return acc;
    }, {});
    setValue("projectModules", newModulesObj as ProjectModuleSettings);
  }

  function onToggle(key: ProjectModule) {
    const modules = getValues("projectModules") ?? {};
    const newModules = { ...modules };
    // @ts-ignore
    newModules[key].enabled = !newModules[key].enabled;
    setValue("projectModules", newModules as ProjectModuleSettings);
  }

  return (
    <div className="bg-slate-100 p-2" {...rest}>
      {Object.entries(watch("projectModules") ?? {})
        .filter(([key, value]) => ["discussion", "files", "tasks"].includes(key))
        .sort((a, b) => a[1].order - b[1].order)
        .map(([key, value], idx) => {
          return (
            <ModuleRow
              index={idx}
              key={key}
              title={key as ProjectModule}
              enabled={value.enabled}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              onToggle={onToggle}
            />
          );
        })}
    </div>
  );
};

export default ProjectModulesControl;
