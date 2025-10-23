import { CentralIdentityLicense } from "../types";
import api from "../api";
import { useQuery } from "@tanstack/react-query";

export const CENTRAL_IDENTITY_LICENSES_QUERY_KEY = "centralIdentityLicenses";

const useCentralIdentityLicenses = () => {
    const { data: licenseOptions, isFetching, refetch, ...restQueryObj } = useQuery<CentralIdentityLicense[]>({
        queryKey: [CENTRAL_IDENTITY_LICENSES_QUERY_KEY],
        queryFn: async () => {
            const res = await api.getCentralIdentityLicenses();
            if (res.data.err) {
                throw new Error(res.data.errMsg);
            }
            if (!res.data.licenses) {
                throw new Error("Failed to load license options");
            }
            const versionsSorted = res.data.licenses.map((l) => {
                return {
                    ...l,
                    versions: l.versions?.sort((a, b) => {
                        if (a === b) return 0;
                        if (!a) return -1;
                        if (!b) return 1;
                        return b.localeCompare(a);
                    }),
                };
            });
            return versionsSorted;
        },
        meta: {
            errorMessage: "Failed to load license options",
        }
    });

    return { licenseOptions: licenseOptions || [], isFetching, refetch, ...restQueryObj };
}

export default useCentralIdentityLicenses;