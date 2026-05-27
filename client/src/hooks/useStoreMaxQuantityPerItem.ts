import { useMemo } from "react";
import { useTypedSelector } from "../state/hooks";
import { DEFAULT_MAX_QUANTITY, STAFF_MAX_QUANTITY } from "../utils/storeHelpers";

const useStoreMaxQuantityPerItem = () => {
    const user = useTypedSelector((state) => state.user);

    const maxQuantityPerItem = useMemo(() => {
        if (!user) {
            return DEFAULT_MAX_QUANTITY;
        }
        if (user.isSupport || user.isSuperAdmin) {
            return STAFF_MAX_QUANTITY;
        }
        return DEFAULT_MAX_QUANTITY;
    }, [user]);

    return maxQuantityPerItem;
}

export default useStoreMaxQuantityPerItem;