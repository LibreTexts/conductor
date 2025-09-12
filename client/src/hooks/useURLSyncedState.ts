import { useCallback, useEffect, useState } from "react";

/**
 * A custom hook that syncs a state variable with a URL query parameter.
 * @param key The key of the query parameter to sync with.
 * @param defaultValue The default value to use if the query parameter is not present.
 * @param validValues Optional array of valid values to restrict the parameter to.
 * @param validator Optional custom validation function.
 * @returns A tuple containing the current state and a function to update it.
 */
const useURLSyncedState = <T extends string>(
    key: string,
    defaultValue: T,
    validValues?: readonly T[],
    validator?: (value: string | null) => value is T
): [T, (value: T) => void] => {
    const isValidValue = (value: string | null): value is T => {
        if (validator) {
            return validator(value);
        }
        if (!validValues) {
            return value !== null;
        }
        return value !== null && validValues.includes(value as T);
    };

    const getInitialValue = (): T => {
        try {
            const params = new URLSearchParams(window.location.search);
            const urlValue = params.get(key);
            return isValidValue(urlValue) ? urlValue : defaultValue;
        } catch (error) {
            console.warn(`Error parsing URL for key ${key}:`, error);
            return defaultValue;
        }
    };

    const [state, setState] = useState<T>(getInitialValue);

    useEffect(() => {
        const handlePopState = () => {
            try {
                const params = new URLSearchParams(window.location.search);
                const urlValue = params.get(key);
                const validValue = isValidValue(urlValue) ? urlValue : defaultValue;
                setState(validValue);
            } catch (error) {
                console.warn(`Error handling popstate for key ${key}:`, error);
                setState(defaultValue);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [key, defaultValue]);

    const setSyncedState = useCallback((newValue: T) => {
        setState(newValue);

        try {
            const url = new URL(window.location.toString());
            if (newValue !== defaultValue) {
                url.searchParams.set(key, newValue);
            } else {
                url.searchParams.delete(key);
            }

            window.history.pushState({}, '', url);
        } catch (error) {
            console.warn(`Error updating URL for key ${key}:`, error);
        }
    }, [key, defaultValue]);

    return [state, setSyncedState];
};

export default useURLSyncedState;