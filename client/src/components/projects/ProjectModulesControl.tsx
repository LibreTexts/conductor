import {
  UseFormGetValues,
  UseFormSetValue,
  UseFormWatch,
} from "react-hook-form";
import { IconButton, Switch, Text } from "@libretexts/davis-react";
import { IconArrowDown, IconArrowUp } from "@tabler/icons-react";
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
  const label =
    title === "files" ? "Assets" : capitalizeFirstLetter(title);

  return (
    <div
      className={`bg-white border border-slate-200 px-4 py-3 w-full ${
        isFirstItem ? "rounded-t-md" : ""
      } ${isLastItem ? "rounded-b-md" : ""}`}
    >
      <div className="flex flex-row justify-between items-center gap-3">
        <Text size="sm" weight="bold" className="text-slate-900">
          {label}
        </Text>
        <div className="flex flex-row items-center gap-2">
          <div className="flex items-center gap-1">
            <IconButton
              icon={<IconArrowUp size={15} />}
              iconClassName="items-center justify-center"
              aria-label={`Move ${label} up`}
              variant="outline"
              size="sm"
              onClick={() => onMoveUp(index)}
              disabled={isFirstItem}
            />
            <IconButton
              icon={<IconArrowDown size={15} />}
              iconClassName="items-center justify-center"
              aria-label={`Move ${label} down`}
              variant="outline"
              size="sm"
              onClick={() => onMoveDown(index)}
              disabled={isLastItem}
            />
          </div>
          <Switch
            name={`module-toggle-${title}`}
            checked={enabled}
            size="sm"
            onChange={() => onToggle(title)}
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
    const newModulesObj = newModules.reduce((acc, [key, value], i) => {
      // @ts-ignore
      acc[key] = value;
      // @ts-ignore
      acc[key].order = i;
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
    const newModulesObj = newModules.reduce((acc, [key, value], i) => {
      // @ts-ignore
      acc[key] = value;
      // @ts-ignore
      acc[key].order = i;
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
    <div className="rounded-md bg-slate-100 p-2 space-y-1" {...rest}>
      {Object.entries(watch("projectModules") ?? {})
        .filter(([key]) => ["discussion", "files", "tasks"].includes(key))
        .sort((a, b) => a[1].order - b[1].order)
        .map(([key, value], idx) => (
          <ModuleRow
            index={idx}
            key={key}
            title={key as ProjectModule}
            enabled={value.enabled}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onToggle={onToggle}
          />
        ))}
    </div>
  );
};

export default ProjectModulesControl;
