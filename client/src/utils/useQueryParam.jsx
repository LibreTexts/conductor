import { useLocation } from 'react-router-dom';

/**
 * Hook to retrieve the value of a single search parameter from the current URL.
 *
 * @param {string} param - Name/key of the search parameter.
 * @param {string} [defaultValue=''] - Default value to return if not found or error encountered.
 * @returns {string} The value of the parameter, or empty string if errored.
 */
const useQueryParam = (param, defaultValue = '') => {

  const location = useLocation();

  try {
    const searchParams = new URLSearchParams(location.search);
    const paramValue = searchParams.get(param);
    if (paramValue) {
      return paramValue;
    }
  } catch (e) {
    console.error(e);
  }
  return defaultValue; // not in query string or error
};

export default useQueryParam;
