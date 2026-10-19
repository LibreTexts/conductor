import { useMemo, useState } from "react";
import { Combobox } from "@libretexts/davis-react";
import { useQuery } from "@tanstack/react-query";
import api from "../../../api";
import { Organization } from "../../../types";
import useGlobalError from "../../error/ErrorHooks";

type CampusOption = Pick<Organization, "orgID" | "name" | "domain">;

interface CampusComboboxProps {
  campusName?: string;
  campusURL?: string;
  onChange: (campusName: string, campusURL: string) => void;
  label?: string;
  disabled?: boolean;
}

/**
 * Picks a campus from the Organizations list. The campus name and URL are only ever set by
 * picking an Organization, never typed, so the caller shows the URL as read-only.
 */
const CampusCombobox = ({
  campusName,
  campusURL,
  onChange,
  label = "Campus Name",
  disabled,
}: CampusComboboxProps) => {
  const { handleGlobalError } = useGlobalError();
  const [search, setSearch] = useState("");

  const { data: orgs = [], isLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const res = await api.getAllOrganizations();
      if (res.data.err) throw new Error(res.data.errMsg);
      return res.data.orgs;
    },
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    onError: (err) => handleGlobalError(err),
  });

  // A campus saved on an author that isn't (or is no longer) an Organization is kept as a
  // synthetic option so its values still display.
  const selected = useMemo<CampusOption | null>(() => {
    if (!campusName) return null;
    const match = orgs.find((o) => o.name === campusName);
    return (
      match ?? { orgID: `legacy:${campusName}`, name: campusName, domain: campusURL ?? "" }
    );
  }, [orgs, campusName, campusURL]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orgs.filter((o) => !query || o.name.toLowerCase().includes(query));
  }, [orgs, search]);

  return (
    <Combobox<CampusOption>
      value={selected}
      onChange={(org) => {
        onChange(org?.name ?? "", org?.domain ?? "");
        setSearch("");
      }}
      by="orgID"
      nullable
      disabled={disabled || isLoading}
      onClose={() => setSearch("")}
    >
      <Combobox.Label>{label}</Combobox.Label>
      <Combobox.Input<CampusOption>
        placeholder={isLoading ? "Loading campuses…" : "Search campuses…"}
        displayValue={(org) => org?.name ?? ""}
        onChange={(e) => setSearch(e.target.value)}
      />
      <Combobox.Options>
        {filtered.map((org) => (
          <Combobox.Option<CampusOption> key={org.orgID} value={org}>
            {org.name}
          </Combobox.Option>
        ))}
        <Combobox.Empty>No campuses found.</Combobox.Empty>
      </Combobox.Options>
    </Combobox>
  );
};

export default CampusCombobox;
