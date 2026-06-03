import React from "react";
import { Button, Input } from "@libretexts/davis-react";
import { IconPlus, IconX } from "@tabler/icons-react";

type CampusAliasesControlProps = {
  aliases: string[];
  setAliases: React.Dispatch<React.SetStateAction<string[]>>;
};

const CampusAliasesControl: React.FC<CampusAliasesControlProps> = ({
  aliases,
  setAliases,
}) => {
  const handleAliasChange = (index: number, value: string) => {
    const updatedAliases = [...aliases];
    updatedAliases[index] = value;
    setAliases(updatedAliases);
  };

  const deleteAlias = (index: number) => {
    setAliases(aliases.filter((_, i) => i !== index));
  };

  const addAlias = () => {
    setAliases([...aliases, ""]);
  };

  return (
    <div className="w-full border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center bg-gray-50 border-b border-gray-200 px-4 py-2">
        <div className="flex-1 text-sm font-semibold text-gray-700">Alias</div>
        <div className="w-16 text-right text-sm font-semibold text-gray-700">
          Actions
        </div>
      </div>

      <div className="p-4 space-y-2">
        {aliases.map((alias, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              name={`alias-${index}`}
              label=""
              aria-label={`Alias ${index + 1}`}
              value={alias}
              onChange={(e) => handleAliasChange(index, e.target.value)}
              className="flex-1"
            />
            <Button
              variant="destructive"
              icon={<IconX size={16} />}
              onClick={() => deleteAlias(index)}
              aria-label={`Remove alias ${index + 1}`}
            />
          </div>
        ))}
      </div>

      <div className="bg-gray-50 border-t border-gray-200 px-4 py-2">
        <Button
          variant="primary"
          icon={<IconPlus size={16} />}
          onClick={addAlias}
        >
          Add Alias
        </Button>
      </div>
    </div>
  );
};

export default CampusAliasesControl;
