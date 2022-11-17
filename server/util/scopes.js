/**
 * @file Provides definitions of and methods to retrieve information about access scopes in
 *  the Conductor authorization system.
 * @author LibreTexts <info@libretexts.org>
 */

import { removeLeadingSlash } from './helpers.js';

/**
 * Descriptions for scope prefixes, indicating the actions that can be performed
 * on a specific resource or type.
 */
const accessLevelDescriptions = {
  'read': 'Read',
  'write': 'Read or modify',
};

/**
 * Descriptions of resource sets, that should contain more specific scopes/resource identifiers.
 */
const scopeSetDescriptions = {
  'user': 'Account and Profile',
  'projects': 'Projects',
  'analytics': 'Analytics',
};

/**
 * Descriptions for specific resources.
 */
const scopeDescriptions = {
  'user:basicinfo': 'Basic information from your profile, such as name and avatar',
  'user:alerts': 'Your Conductor Alerts',
  'projects:recent': 'Your recently updated Projects',
  'analytics:access': 'Whether you are a verified instructor with Analytics access',
  'analytics:courses': 'Basic information about your Analytics courses',
  'analytics:courses:*': 'Detailed information about your Analytics courses',
  'analytics:courses:*:roster': 'Student rosters from your Analytics courses',
  'analytics:learning:init': 'Sessions in the Learning Analytics Dashboard',
};

/**
 * Generates a map of descriptions for a given set of scopes.
 *
 * @param {string[]} scopes - An array of fully-qualified scope indicators.
 * @return {object} A hierarchical map of scopes, scope sets, and their descriptions.
 */
function getScopeDescriptions(scopes) {
  /* scope format is ACCESS:SET:RESOURCE */
  if (!Array.isArray(scopes)) {
    return {};
  }

  const descriptions = {};
  const splitScopes = [];
  const foundSets = new Set();

  /* Break apart the scope information */
  for (let i = 0, n = scopes.length; i < n; i += 1) {
    const currScope = scopes[i];
    if (typeof (currScope) !== 'string') {
      continue;
    }
    const [access, set, ...resourceParts] = currScope.split(':');
    if (!access || !set || !resourceParts) {
      continue;
    }

    const resource = resourceParts.join(':');

    foundSets.add(set);
    splitScopes.push({
      access,
      set,
      resource
    });
  }

  /* Build hierarchy with descriptions */
  foundSets.forEach((set) => {
    descriptions[set] = {
      name: set,
      description: scopeSetDescriptions[set] || 'Unknown',
      resources: splitScopes.map((scope) => {
        if (scope.set === set) {
          return {
            name: scope.resource,
            access: scope.access,
            description: scopeDescriptions[`${set}:${scope.resource}`] || 'Unknown',
            accessDescription: accessLevelDescriptions[scope.access] || 'Unknown',
          }
        }
        return null;
      }).filter((scope) => scope !== null),
    };
  });

  return descriptions;
}

/**
 * Transforms an API endpoint and HTTP method to its corresponding scope identifier.
 *
 * @param {string} endpoint - The API endpoint (path-level) from the HTTP request.
 * @param {string} method - The HTTP method of the request.
 * @returns {string} The corresponding scope identifier, or 'unknown'.
 */
function getEndpointAsScope(endpoint, method) {
  if (!endpoint || !method) {
    return 'unknown';
  }
  
  const paramRegex = /:([a-z]?[A-Z]?)*(\?)?/gi;
  const procEndpoint = removeLeadingSlash(endpoint).replace(paramRegex, '*').replace(/\//g, ':');
  let procMethod = 'unknown';
  if (method === 'GET') {
    procMethod = 'read';
  }
  if (['PUT', 'POST', 'DELETE'].includes(method)) {
    procMethod = 'write';
  }
  return `${procMethod}:${procEndpoint}`;
}

export default {
  getScopeDescriptions,
  getEndpointAsScope,
}
