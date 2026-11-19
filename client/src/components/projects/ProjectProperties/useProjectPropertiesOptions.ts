import { useQuery } from "@tanstack/react-query";
import api from "../../../api";
import useGlobalError from "../../error/ErrorHooks";
import { useTypedSelector } from "../../../state/hooks";
import { isAssetTagKeyObject } from "../../../utils/typeHelpers";
import { CentralIdentityLicense } from "../../../types";
import type { ComboOption } from "./MultiComboboxField";

const toOptions = (values: string[]): ComboOption[] => values.map((v) => ({ value: v, label: v }));

/** Newest version first, with the unversioned entry ahead of the rest. */
const sortVersions = (versions?: string[]) =>
  versions?.slice().sort((a, b) => {
    if (a === b) return 0;
    if (!a) return -1;
    if (!b) return 1;
    return b.localeCompare(a);
  });

/**
 * Option lists for the properties form. Each list loads on its own, so one
 * failing source leaves the rest of the form usable.
 */
const useProjectPropertiesOptions = (orgSearch: string) => {
  const { handleGlobalError } = useGlobalError();
  const org = useTypedSelector((state) => state.org);
  const customOrgs = org.customOrgList?.length ? org.customOrgList : null;

  const tags = useQuery({
    queryKey: ["project-tags"],
    queryFn: async () => {
      const res = await api.getTags();
      if (res.data.err) throw new Error(res.data.errMsg);
      const titles = (res.data.tags ?? []).flatMap((t) => (t.title ? [t.title] : []));
      return toOptions(titles.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
    },
    staleTime: 5 * 60 * 1000,
    onError: handleGlobalError,
  });

  const cids = useQuery({
    queryKey: ["cid-descriptors"],
    queryFn: async (): Promise<ComboOption[]> => {
      const res = await api.getCIDDescriptors();
      if (res.data.err) throw new Error(res.data.errMsg);
      return (res.data.descriptors ?? []).map((d) => ({
        value: d.descriptor,
        label: `${d.descriptor}: ${d.title}`,
        description: d.description,
      }));
    },
    staleTime: 30 * 60 * 1000,
    onError: handleGlobalError,
  });

  const licenses = useQuery({
    queryKey: ["central-identity-licenses"],
    queryFn: async (): Promise<CentralIdentityLicense[]> => {
      const res = await api.getCentralIdentityLicenses();
      if (res.data.err) throw new Error(res.data.errMsg);
      if (!res.data.licenses) throw new Error("Failed to load license options");
      return res.data.licenses.map((l) => ({ ...l, versions: sortVersions(l.versions) }));
    },
    staleTime: 30 * 60 * 1000,
    onError: handleGlobalError,
  });

  // The campus framework's "Subject" and "Pedagogy" templates feed Content Area and pedagogy tags.
  const framework = useQuery({
    queryKey: ["campus-default-framework", org.orgID],
    queryFn: async () => {
      const res = await api.getCampusDefaultFramework(org.orgID);
      if (res.data.err) throw new Error(res.data.errMsg);
      const templates = res.data.framework?.templates ?? [];
      const optionsFor = (title: string) =>
        toOptions(
          templates.find((t) => isAssetTagKeyObject(t.key) && t.key.title.toLowerCase() === title)
            ?.options ?? []
        );
      return { contentAreas: optionsFor("subject"), pedagogy: optionsFor("pedagogy") };
    },
    enabled: !!org.orgID,
    staleTime: 5 * 60 * 1000,
    onError: handleGlobalError,
  });

  const orgs = useQuery({
    queryKey: ["adapt-orgs", orgSearch],
    queryFn: async () => {
      const res = await api.getCentralIdentityADAPTOrgs({ query: orgSearch || undefined });
      if (res.data.err) throw new Error(res.data.errMsg);
      if (!Array.isArray(res.data.orgs)) throw new Error("Invalid response from server.");
      return toOptions(res.data.orgs);
    },
    enabled: !customOrgs,
    keepPreviousData: true,
    staleTime: 60 * 1000,
    onError: handleGlobalError,
  });

  return {
    tagOptions: org.FEAT_PedagogyProjectTags ? framework.data?.pedagogy ?? [] : tags.data ?? [],
    tagsLoading: org.FEAT_PedagogyProjectTags ? framework.isLoading : tags.isLoading,
    allowTagCreation: !org.FEAT_PedagogyProjectTags,
    cidOptions: cids.data ?? [],
    cidsLoading: cids.isLoading,
    licenseOptions: licenses.data ?? [],
    contentAreaOptions: framework.data?.contentAreas ?? [],
    orgOptions: customOrgs ? toOptions(customOrgs) : orgs.data ?? [],
    orgsLoading: !customOrgs && orgs.isFetching,
    /** Custom org lists filter locally; the ADAPT list searches on the server. */
    searchesOrgsOnServer: !customOrgs,
  };
};

export default useProjectPropertiesOptions;
