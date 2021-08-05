import { useContext } from 'react';
import { ErrorContext } from './ErrorProvider.js';

function useGlobalError() {
    const { error, setError, clearError } = useContext(ErrorContext);
    return { error, setError, clearError };
};

export default useGlobalError;
