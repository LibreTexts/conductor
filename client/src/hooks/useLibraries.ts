import { useQuery } from "@tanstack/react-query";
import { Library } from "../types";
import api from "../api";

const useLibraries = ({ enabled = true }) => {
    const { data: libraries, ...restQuery } = useQuery<Library[]>({
        queryKey: ["libraries"],
        queryFn: async () => (await api.getLibraries()).data.libraries,
        enabled: enabled,
    });
    
    return { libraries, ...restQuery };
};

export default useLibraries;