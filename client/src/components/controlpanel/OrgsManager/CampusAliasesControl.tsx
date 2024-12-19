import React from "react";
import { Button, Icon } from "semantic-ui-react";

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
    const updatedAliases = aliases.filter((_, i) => i !== index);
    setAliases(updatedAliases);
  };

  const addAlias = () => {
    setAliases([...aliases, ""]);
  };

  return (
    <div className="w-full">
      <div className="border rounded-lg overflow-hidden">
        {/* Header Row */}
        <div className="flex items-center bg-gray-50 border-b px-4 py-2">
          <div className="flex-1 font-semibold">Alias</div>
          <div className="w-16 text-right font-semibold">Actions</div>
        </div>

        {/* Content Rows */}
        <div className="p-4">
          {aliases.map((alias, index) => (
            <div key={index} className="flex items-center gap-1 mb-2">
              <input
                type="text"
                value={alias}
                onChange={(e) => handleAliasChange(index, e.target.value)}
                className="flex-1 p-2 border rounded min-w-0"
              />
              <div className="w-16 flex justify-end">
                <Button
                  icon
                  color="red"
                  onClick={() => deleteAlias(index)}
                  className="w-8 h-8 shrink-0"
                  style={{
                    minWidth: "32px",
                    padding: 0,
                  }}
                >
                  <Icon name="delete" className="m-0" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Row */}
        <div className="flex items-center bg-gray-50 border-t px-4 py-2">
          <Button color="blue" onClick={addAlias}>
            <Icon name="add" />
            Add Alias
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CampusAliasesControl;
