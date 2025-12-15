/**
 * Struktur 2.0 - Main entry point
 *
 * Clean slate rewrite with no schema pre-merging
 */

import { ClassLoader } from './class_loader.js';
import { AspectLoader } from './aspect_loader.js';
import { ClassResolver } from './class_resolver.js';
import { MultiPassValidator } from './validator.js';

export { ClassLoader, AspectLoader, ClassResolver, MultiPassValidator };
export { Types } from './types.js';
export { generateCanonical, generateCanonicalWithValidation } from './canonical.js';
export { TemplateAdapter } from './template_adapter.js';
export { HandlebarsAdapter } from './adapters/handlebars_adapter.js';

/**
 * Convenience function to create a fully configured Struktur instance
 */
export function createStruktur() {
  const classLoader = new ClassLoader();
  const aspectLoader = new AspectLoader();
  const classResolver = new ClassResolver(classLoader);
  const validator = new MultiPassValidator();

  return {
    classLoader,
    aspectLoader,
    classResolver,
    validator,

    /**
     * Load and prepare for validation
     */
    async load({ classesDir, aspectsDir }) {
      if (classesDir) {
        await classLoader.loadClassesFromDirectory(classesDir);
      }

      if (aspectsDir) {
        const aspects = await aspectLoader.loadAspectsFromDirectory(aspectsDir);
        // Register aspects with validator
        for (const aspect of aspects) {
          validator.registerAspect(aspect);
        }
      }

      return this;
    },

    /**
     * Validate instances
     */
    validate(instances) {
      // Auto-resolve classes and register with validator
      const resolved = new Map();

      for (const instance of instances) {
        if (!resolved.has(instance.class)) {
          const resolvedClass = classResolver.resolve(instance.class);
          validator.registerClass(resolvedClass);
          resolved.set(instance.class, resolvedClass);
        }
      }

      // Validate batch
      return validator.validateBatch(instances, (className) => {
        return resolved.get(className) || classResolver.resolve(className);
      });
    }
  };
}
