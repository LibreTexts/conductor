import {
  UseFormGetValues,
  UseFormSetValue,
  UseFormWatch,
} from "react-hook-form";
import {
  CampusSettingsOpts,
  CommonsModule,
  CommonsModuleSettings,
} from "../../../types";
import { capitalizeFirstLetter } from "../../util/HelperFunctions";
import { Button, Checkbox } from "semantic-ui-react";

const ModuleRow = ({
  index,
  title,
  enabled,
  onMoveUp,
  onMoveDown,
  onToggle,
}: {
  index: number;
  title: CommonsModule;
  enabled: boolean;
  onMoveUp: (idx: number) => void;
  onMoveDown: (idx: number) => void;
  onToggle: (key: CommonsModule) => void;
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

interface CommonsModuleControlProps extends React.HTMLProps<HTMLDivElement> {
  getValues: UseFormGetValues<CampusSettingsOpts>;
  setValue: UseFormSetValue<CampusSettingsOpts>;
  watch: UseFormWatch<CampusSettingsOpts>;
}

const CommonsModuleControl: React.FC<CommonsModuleControlProps> = ({
  getValues,
  setValue,
  watch,
  ...rest
}) => {
  function onMoveUp(idx: number) {
    if (idx === 0) return;
    const modules = Object.entries(getValues("commonsModules") ?? {});
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
    setValue("commonsModules", newModulesObj as CommonsModuleSettings);
  }

  function onMoveDown(idx: number) {
    if (idx === 2) return;
    const modules = Object.entries(getValues("commonsModules") ?? {});
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
    setValue("commonsModules", newModulesObj as CommonsModuleSettings);
  }

  function onToggle(key: CommonsModule) {
    const modules = getValues("commonsModules") ?? {};
    const newModules = { ...modules };
    // @ts-ignore
    newModules[key].enabled = !newModules[key].enabled;
    setValue("commonsModules", newModules as CommonsModuleSettings);
  }

  return (
    <div className="bg-slate-100 p-2" {...rest}>
      {Object.entries(watch("commonsModules") ?? {})
        .filter(
          ([key, value]) => ["books", "assets", "projects"].includes(key)
        )
        .sort((a, b) => a[1].order - b[1].order)
        .map(([key, value], idx) => {
          return (
            <ModuleRow
              index={idx}
              key={key}
              title={key as CommonsModule}
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

export default CommonsModuleControl;
