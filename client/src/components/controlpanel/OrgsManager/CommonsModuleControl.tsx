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
import { Button, Switch } from "@libretexts/davis-react";
import { IconArrowDown, IconArrowUp } from "@tabler/icons-react";
import { DEFAULT_COMMONS_MODULES } from "../../../utils/campusSettingsHelpers";

const ModuleRow = ({
  index,
  total,
  title,
  enabled,
  onMoveUp,
  onMoveDown,
  onToggle,
}: {
  index: number;
  total: number;
  title: CommonsModule;
  enabled: boolean;
  onMoveUp: (idx: number) => void;
  onMoveDown: (idx: number) => void;
  onToggle: (key: CommonsModule) => void;
}) => {
  const isFirst = index === 0;
  const isLast = index === total - 1;

  return (
    <div
      className={`bg-white border-x border-b px-4 h-14 max-w-5xl first:border-t ${
        isFirst ? "rounded-t-md border-t" : ""
      } ${isLast ? "rounded-b-md" : ""}`}
    >
      <div className="flex items-center justify-between h-full">
        <p className="font-bold text-sm">{capitalizeFirstLetter(title)}</p>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <Button
              variant="ghost"
              icon={<IconArrowUp size={15} />}
              onClick={() => onMoveUp(index)}
              disabled={isFirst}
              aria-label={`Move ${title} up`}
              size="sm"
            />
            <Button
              variant="ghost"
              icon={<IconArrowDown size={15} />}
              onClick={() => onMoveDown(index)}
              disabled={isLast}
              aria-label={`Move ${title} down`}
              size="sm"
            />
          </div>
          <Switch
            name={`module-${title}`}
            checked={enabled}
            onChange={() => onToggle(title)}
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
  const defaultModuleKeys = Object.keys(DEFAULT_COMMONS_MODULES);
  const modules = Object.entries(watch("commonsModules") ?? {})
    .filter(([key]) => defaultModuleKeys.includes(key))
    .sort((a, b) => a[1].order - b[1].order);

  function onMoveUp(idx: number) {
    if (idx === 0) return;
    const entries = Object.entries(getValues("commonsModules") ?? {});
    const reordered = [...entries];
    [reordered[idx], reordered[idx - 1]] = [reordered[idx - 1], reordered[idx]];
    const updated = reordered.reduce((acc, [key, value], i) => {
      // @ts-ignore
      acc[key] = { ...value, order: i };
      return acc;
    }, {});
    setValue("commonsModules", updated as CommonsModuleSettings, { shouldDirty: true });
  }

  function onMoveDown(idx: number) {
    if (idx === modules.length - 1) return;
    const entries = Object.entries(getValues("commonsModules") ?? {});
    const reordered = [...entries];
    [reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]];
    const updated = reordered.reduce((acc, [key, value], i) => {
      // @ts-ignore
      acc[key] = { ...value, order: i };
      return acc;
    }, {});
    setValue("commonsModules", updated as CommonsModuleSettings, { shouldDirty: true });
  }

  function onToggle(key: CommonsModule) {
    const current = getValues("commonsModules") ?? {};
    const updated = { ...current };
    // @ts-ignore
    updated[key] = { ...updated[key], enabled: !updated[key].enabled };
    setValue("commonsModules", updated as CommonsModuleSettings, { shouldDirty: true });
  }

  return (
    <div className="bg-slate-100 p-2 rounded-md" {...rest}>
      {modules.map(([key, value], idx) => (
        <ModuleRow
          key={key}
          index={idx}
          total={modules.length}
          title={key as CommonsModule}
          enabled={value.enabled}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
};

export default CommonsModuleControl;
