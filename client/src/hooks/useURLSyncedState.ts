import { useCallback, useEffect, useState } from "react";

/**
 * A custom hook that syncs a state variable with a URL query parameter.
 * @param key The key of the query parameter to sync with.
 * @param defaultValue The default value to use if the query parameter is not present.
 * @returns A tuple containing the current state and a function to update it.
 */
const useURLSyncedState = <T extends string>(
    key: string,
    defaultValue: T,
    validValues?: readonly T[]
): [T, (value: T) => void] => {
    const isValidValue = (value: string | null): value is T => {
        if (!validValues) return true;
        return value !== null && validValues.includes(value as T);
    };

    const [state, setState] = useState<T>(() => {
        const params = new URLSearchParams(window.location.search);
        const urlValue = params.get(key);
        return isValidValue(urlValue) ? urlValue : defaultValue;
    });

    useEffect(() => {
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            const urlValue = (params.get(key) as T) || defaultValue;
            const validValue = isValidValue(urlValue) ? urlValue : defaultValue;
            setState(validValue);
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [key, defaultValue]);

    const setSyncedState = useCallback((newValue: T) => {
        setState(newValue);

        const url = new URL(window.location.toString());
        if (newValue !== defaultValue) {
            url.searchParams.set(key, newValue);
        } else {
            url.searchParams.delete(key);
        }

        window.history.pushState({}, '', url);
    }, [key, defaultValue]);

    return [state, setSyncedState];
};

export default useURLSyncedState;
