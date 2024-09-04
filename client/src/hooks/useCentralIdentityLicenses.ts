import { useEffect, useState } from "react";
import { CentralIdentityLicense } from "../types";
import api from "../api";
import useGlobalError from "../components/error/ErrorHooks";

const useCentralIdentityLicenses = () => {
    const { handleGlobalError } = useGlobalError();
    const [licenseOptions, setLicenseOptions] = useState<CentralIdentityLicense[]>([]);
    const [isFetching, setIsFetching] = useState<boolean>(false);

    useEffect(() => {
        loadLicenseOptions();
    }, []);

    async function loadLicenseOptions() {
        try {
            setIsFetching(true);
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

            setLicenseOptions(versionsSorted);
        } catch (err) {
            handleGlobalError(err);
            setLicenseOptions([]);
        } finally {
            setIsFetching(false);
        }
    }

    async function refetch() {
        setIsFetching(true);
        await loadLicenseOptions();
        setIsFetching(false);
    }

    return { licenseOptions, isFetching, refetch };
}

export default useCentralIdentityLicenses;