const analyticsCourseAccessOptions = [
  { key: 'instructor', text: 'Instructor', value: 'instructor' },
  { key: 'viewer', text: 'Viewer', value: 'viewer' },
];

/**
 * Returns a UI-ready label of an Analytics Course member access setting.
 *
 * @param {string} role - Internal role identifier.
 * @returns {string} The UI-ready label.
 */
function getAnalyticsMemberAccessText(role) {
  const foundRole = analyticsCourseAccessOptions.find((item) => item.value === role);
  return foundRole?.text || 'Unknown';
}

export {
  analyticsCourseAccessOptions,
  getAnalyticsMemberAccessText,
}
