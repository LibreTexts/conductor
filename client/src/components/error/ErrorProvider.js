import React, { useState, useCallback } from 'react';

export const ErrorContext = React.createContext({
    error: null,
    setError: () => {},
    clearError: () => {}
});

export default function ErrorProvider({ children }) {
    const [error, setErrorValue] = useState(null);

    const setError = (errObj, statusCode) => {
        if (errObj && errObj.name && errObj.message) {
            setErrorValue({
                message: errObj.message,
                status: statusCode
            });
        } else if (typeof(errObj) === 'string') {
            setErrorValue({
                message: errObj,
                status: statusCode
            });
        } else {
            setErrorValue({
                message: errObj.toString(),
                status: statusCode
            });
        }
    };
    const clearError = () => setErrorValue(null);

    const context = {
        error,
        setError: useCallback((errObj, statusCode) => setError(errObj, statusCode), []),
        clearError: useCallback(() => clearError(), [])
    };

    return (
        <ErrorContext.Provider value={context}>
            {children}
        </ErrorContext.Provider>
    );
};
