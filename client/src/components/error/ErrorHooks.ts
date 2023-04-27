import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTypedSelector } from "../../state/hooks";
import { AxiosError } from "axios";
import {
  hasErrorData,
  hasErrorDataErrors,
  hasErrorDataMsg,
  hasErrorStatusCode,
  hasMessage,
  hasResponse,
} from "../../utils/typeHelpers";

type ConductorErrorInterface = {
  response: unknown;
  message: string;
};

function useGlobalError() {
  const dispatch = useDispatch();
  const error = useTypedSelector((state) => state.error);

  /**
   * Set the global error. Accepts
   * an @errObj, and sets the object's
   * message or converts it to a string.
   * The @statusCode argument is optional.
   */
  const setError = useCallback(
    (
      errObj: { name: string; message: string } | string,
      statusCode?: number,
      relevantLinkTitle?: string,
      relevantLinkHREF?: string
    ) => {
      if (typeof errObj === "object" && errObj.name && errObj.message) {
        dispatch({
          type: "SET_ERROR",
          payload: {
            message: errObj.message,
            status: statusCode,
            relevantLinkTitle,
            relevantLinkHREF,
          },
        });
      } else if (typeof errObj === "string") {
        dispatch({
          type: "SET_ERROR",
          payload: {
            message: errObj,
            status: statusCode,
            relevantLinkTitle,
            relevantLinkHREF,
          },
        });
      } else {
        dispatch({
          type: "SET_ERROR",
          payload: {
            message: errObj.toString(),
            status: statusCode,
            relevantLinkTitle,
            relevantLinkHREF,
          },
        });
      }
    },
    [dispatch]
  );

  /**
   * Clear the global error
   * (resets to initial global
   * error state)
   */
  const clearError = () => {
    dispatch({
      type: "CLEAR_ERROR",
    });
  };

  /**
   * Process a REST-returned error object and activate
   * the global error modal
   */
  const handleGlobalError = useCallback(
    (err: unknown, relevantLinkTitle?: string, relevantLinkHREF?: string) => {
      let message = "Error processing request";
      console.error(err);

      if (typeof err === "string") {
        message = err;
      }

      if (
        typeof err === "object" &&
        err !== null &&
        hasMessage(err) &&
        err.message
      ) {
        message = err.message;
      }

      if (
        typeof err === "object" &&
        err !== null &&
        hasResponse(err) &&
        typeof err.response === "object" &&
        err.response !== null
      )
        if (
          typeof err === "object" &&
          err.response &&
          typeof err.response === "object" &&
          err.response !== null &&
          hasErrorData(err.response)
        ) {
          if (
            err.response.data !== null &&
            hasErrorDataMsg(err.response.data) &&
            err.response.data.errMsg !== undefined
          ) {
            message = err.response.data.errMsg;
          }
        }

      if (
        typeof err === "object" &&
        err !== null &&
        hasResponse(err) &&
        err.response &&
        typeof err.response === "object" &&
        hasErrorData(err.response) &&
        typeof err.response.data === "object" &&
        err.response.data !== null &&
        hasErrorDataErrors(err.response.data)
      ) {
        if (err.response.data.errors.length > 0) {
          message = message.replace(/\./g, ": ");
          err.response.data.errors.forEach(
            (elem: Record<string, any>, idx: number) => {
              if (elem.param) {
                message +=
                  String(elem.param).charAt(0).toUpperCase() +
                  String(elem.param).slice(1);
                if (
                  hasErrorData(err.response) &&
                  hasErrorDataErrors(err.response.data) &&
                  idx + 1 !== err.response.data.errors.length
                ) {
                  message += ", ";
                } else {
                  message += ".";
                }
              }
            }
          );
        }
      }

      let statusCode;
      if (
        typeof err === "object" &&
        err !== null &&
        hasResponse(err) &&
        err.response &&
        typeof err.response === "object" &&
        hasErrorStatusCode(err.response) &&
        err.response.statusCode !== undefined
      ) {
        statusCode = err.response.statusCode;
      } else {
        statusCode = undefined;
      }

      setError(message, statusCode, relevantLinkTitle, relevantLinkHREF);
    },
    [setError]
  );

  return { error, setError, clearError, handleGlobalError };
}

export default useGlobalError;
