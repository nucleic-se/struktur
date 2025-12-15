/**
 * Helper for creating template adapters
 * Separated from cli.js for reuse in build.js
 */

import { HandlebarsAdapter } from './adapters/handlebars_adapter.js';
import NunjucksAdapter from './adapters/nunjucks_adapter.js';

/**
 * Create template adapter based on engine name
 * @param {string} engineName - Engine name (handlebars, nunjucks)
 * @returns {TemplateAdapter} Template adapter instance
 */
export function createTemplateAdapter(engineName) {
  switch (engineName.toLowerCase()) {
  case 'handlebars':
    return new HandlebarsAdapter();
  case 'nunjucks':
    return new NunjucksAdapter();
  default:
    throw new Error(`Unknown template engine: ${engineName}. Supported: handlebars, nunjucks`);
  }
}
