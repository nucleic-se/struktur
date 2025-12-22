/**
 * Helper for creating template adapters
 * Separated from cli.js for reuse in build.js
 */

import { HandlebarsAdapter } from './adapters/handlebars_adapter.js';
import NunjucksAdapter from './adapters/nunjucks_adapter.js';

/**
 * Create template adapter based on engine name
 * @param {string} engineName - Engine name (handlebars, nunjucks)
 * @param {Object} config - Adapter configuration (e.g., {strict: true})
 * @returns {TemplateAdapter} Template adapter instance
 */
export function createTemplateAdapter(engineName, config = {}) {
  switch (engineName.toLowerCase()) {
  case 'handlebars':
    return new HandlebarsAdapter(config);
  case 'nunjucks':
    return new NunjucksAdapter(config);
  default:
    throw new Error(`Unknown template engine: ${engineName}. Supported: handlebars, nunjucks`);
  }
}
