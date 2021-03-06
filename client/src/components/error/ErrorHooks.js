import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';

function useGlobalError() {
    const dispatch = useDispatch();
    const error = useSelector((state) => state.error);

    /**
     * Set the global error. Accepts
     * an @errObj, and sets the object's
     * message or converts it to a string.
     * The @statusCode argument is optional.
     */
    const setError = useCallback((errObj, statusCode) => {
        if (errObj && errObj.name && errObj.message) {
            dispatch({
                type: 'SET_ERROR',
                payload: {
                    message: errObj.message,
                    status: statusCode
                }
            });
        } else if (typeof(errObj) === 'string') {
            dispatch({
                type: 'SET_ERROR',
                payload: {
                    message: errObj,
                    status: statusCode
                }
            });
        } else {
            dispatch({
                type: 'SET_ERROR',
                payload: {
                    message: errObj.toString(),
                    status: statusCode
                }
            });
        }
    }, [dispatch]);

    /**
     * Clear the global error
     * (resets to initial global
     * error state)
     */
    const clearError = () => {
        dispatch({
            type: 'CLEAR_ERROR'
        });
    };

    /**
     * Process a REST-returned error object and activate
     * the global error modal
     */
    const handleGlobalError = useCallback((err) => {
        console.error(err);
        let message = "";
        if (typeof (err.response) === 'object') {
            if (err.response.data) {
                if (err.response.data.errMsg !== undefined) {
                    message = err.response.data.errMsg;
                } else {
                    message = "Error processing request.";
                }
                if (err.response.data.errors) {
                    if (err.response.data.errors.length > 0) {
                        message = message.replace(/\./g, ': ');
                        err.response.data.errors.forEach((elem, idx) => {
                            if (elem.param) {
                                message += (String(elem.param).charAt(0).toUpperCase() + String(elem.param).slice(1));
                                if ((idx + 1) !== err.response.data.errors.length) {
                                    message += ", ";
                                } else {
                                    message += ".";
                                }
                            }
                        });
                    }
                }
            } else {
                message = "Error processing request.";
            }
        } else if (typeof (err.message) === 'string') {
            message = err.message;
        } else if (typeof(err) === 'string') {
            message = err;
        } else {
            message = err.toString();
        }
        setError(message);
    }, [setError]);

    return { error, setError, clearError, handleGlobalError };
};

export default useGlobalError;
