//
// LibreTexts Conductor
// AlertHelpers.js
//

const alertResourceTypes = [
  { key: 'project', text: 'Project', value: 'project' },
  { key: 'book', text: 'Book', value: 'book' },
  { key: 'homework', text: 'Homework or Assessment', value: 'homework' }
];

const alertTimingOptions = [
  { key: 'instant', text: 'Instant', description: '(as soon as new resources are detected)', value: 'instant' },
  { key: 'daily', text: 'Daily', description: '(receive an update once-daily if new resources are detected)', value: 'daily' }
];

const alertProjectLocationFilters = [
  { key: 'global', text: 'LibreGrid (all instances)', value: 'global' },
  { key: 'local', text: 'This Campus', value: 'local' }
];

/**
 * Accepts an internal Alert Resource Type value and attempts to return the UI-ready
 * string representation.
 * @param {string} type - The type value to find UI text for.
 * @returns {string} The UI-ready string representation.
 */
const getAlertResourceText = (type) => {
  const foundResourceType = alertResourceTypes.find((item) => item.value === type);
  if (foundResourceType !== undefined) {
    return foundResourceType.text;
  }
  return 'Unknown Resource Type';
};

/**
 * Accepts an internal Alert Timing value and attempts to return the UI-ready
 * string representation.
 * @param {string} timing - The timing value to find UI text for.
 * @returns {string} The UI-ready string representation.
 */
const getAlertTimingText = (timing) => {
  const foundAlertTiming = alertTimingOptions.find((item) => item.value === timing);
  if (foundAlertTiming !== undefined) {
    return foundAlertTiming.text;
  }
  return 'Unknown Alert Timing Option';
};

/**
 * Accepts an internal Alert Timing value and attempts to return the UI-ready
 * string description.
 * @param {string} timing - The timing value to find UI text for.
 * @returns {string} The UI-ready string description.
 */
const getAlertTimingDescription = (timing) => {
  const foundAlertTiming = alertTimingOptions.find((item) => item.value === timing);
  if (foundAlertTiming !== undefined) {
    return foundAlertTiming.description;
  }
  return 'Unknown Alert Timing Option';
};

/**
 * Accepts an internal Alert Project Location Filter and attempts to return the UI-ready
 * string description.
 * @param {string} filter - The filter value to find UI text for.
 * @returns {string} The UI-ready string description.
 */
 const getAlertProjectLocationFilterText = (filter) => {
  const foundAlertLocationFilter = alertProjectLocationFilters.find((item) => item.value === filter);
  if (foundAlertLocationFilter !== undefined) {
    return foundAlertLocationFilter.text;
  }
  return 'Unknown Alert Project Location Filter';
};

export {
  alertResourceTypes,
  alertTimingOptions,
  alertProjectLocationFilters,
  getAlertResourceText,
  getAlertTimingText,
  getAlertTimingDescription,
  getAlertProjectLocationFilterText
}
