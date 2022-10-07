import { useState } from 'react';

/**
 * @typedef {object} useFormResult
 * @property {object.<string, any>} values - The key-value pairs of the input names and values.
 * @property {object.<string, boolean>} errors - The key-value pairs of the input names and their
 *  error state (boolean).
 * @property {function} handleChange - Handler for value changes to a form input.
 * @property {function} handleSubmit - Handler for form submits or final actions.
 */

/**
 * Hook to store and validate form data.
 *
 * @param {object.<string, any>} [initialState] - Object to initialize form state with.
 * @param {function} [validator] - Function to validate the form as a whole.
 * @param {function} [callback] - Function to call when form is submitted.
 * @returns {useFormResult} The form state and handlers.
 */
const useForm = (initialState = {}, validator, callback) => {

  // Data
  const [values, setValues] = useState(initialState);

  // Errors
  const [errors, setErrors] = useState({});

  /**
   * Handles changes to a form input by performing validation and saving results to state.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} e - Change event from the DOM.
   * @param {function} [validate] - Custom validation function for this input.
   *  Must return a boolean; truthy for valid, falsy otherwise.
   */
  const handleChange = (e, validate) => {
    if (typeof (e.preventDefault) == 'function') { // protect custom-formed events
      e.preventDefault();
    }
    const { name, value } = e.target;
    if (typeof (validate) === 'function') {
      if (validate(value)) {
        // remove a currently set error
        const currentErrors = { ...errors };
        delete currentErrors[name];
        setErrors(currentErrors);
      } else {
        setErrors({
          ...errors,
          [name]: true,
        });
      }
    }
    setValues({
      ...values,
      [name]: value,
    });
  };

  /**
   * Handles form submits or final actions by checking for errors and activating the provided
   * callback on success.
   *
   * @param {React.FormEvent<HTMLFormElement>} e - Event that activated the handler.
   */
  const handleSubmit = (e) => {
    if (e) {
      e.preventDefault();
    }

    let newErrors = {};
    if (typeof (validator) === 'function') {
      newErrors = validator(values);
    }
    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0 && Object.keys(values).length > 0) {
      if (typeof (callback) === 'function') {
        callback(values);
      }
    }
  };

  return {
    values,
    errors,
    handleChange,
    handleSubmit,
  };
};

export default useForm;
