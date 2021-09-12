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
    const setError = (errObj, statusCode) => {
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
    };

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
    const handleGlobalError = (err) => {
        console.log(err);
        var message = "";
        if (err.response) {
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
        } else if (err.name && err.message) {
            message = err.message;
        } else if (typeof(err) === 'string') {
            message = err;
        } else {
            message = err.toString();
        }
        setError(message);
    };

    return { error, setError, clearError, handleGlobalError };
};

export default useGlobalError;
