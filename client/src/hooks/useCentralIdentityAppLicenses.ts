import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import useGlobalError from "../components/error/ErrorHooks";
import { CentralIdentityAppLicense } from "../types";
import api from "../api";

type UseCentralIdentityAppLicensesProps = UseQueryOptions<CentralIdentityAppLicense[]>;

const useCentralIdentityAppLicenses = (props: UseCentralIdentityAppLicensesProps = {}) => {
    const { handleGlobalError } = useGlobalError();
    const queryData = useQuery<CentralIdentityAppLicense[]>({
        queryKey: ["central-identity-app-licenses"],
        queryFn: async () => {
            const res = await api.getCentralIdentityAvailableAppLicenses();
            if (res.data.err) {
                handleGlobalError(res.data.errMsg);
                return [];
            }
            return res.data.licenses;
        },
        keepPreviousData: true,
        refetchOnWindowFocus: false,
        ...props
    });

    return queryData;
}

export default useCentralIdentityAppLicenses;