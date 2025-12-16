/**
 * MultiPassValidator - Validate instances against lineage + aspects
 *
 * Key principle: Validate against each schema in lineage separately
 * Port of prototypes/multi_pass_validator.js with production hardening
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';

export class MultiPassValidator {
  constructor(options = {}) {
    this.ajv = new Ajv({
      allErrors: true,
      strict: true,
      strictRequired: false, // Allow required in oneOf branches without defining all properties
      strictTypes: false, // Allow union types like ["string", "null"]
      validateSchema: true,
      validateFormats: true,
      ...options.ajvOptions
    });
    addFormats(this.ajv, { mode: 'full' });

    // Cache compiled validators
    /** @type {Map<string, Function>} */
    this.classValidators = new Map();
    /** @type {Map<string, Function>} */
    this.aspectValidators = new Map();
  }

  /**
   * Register class schemas for validation
   * @param {ResolvedClass} resolvedClass - Resolved class with lineage
   */
  registerClass(resolvedClass) {
    const { lineage, schemas } = resolvedClass;

    // Compile and cache validator for each schema in lineage
    for (let i = 0; i < lineage.length; i++) {
      const layerName = lineage[i];
      const schema = schemas[i];

      if (!this.classValidators.has(layerName)) {
        const validator = this.ajv.compile(schema);
        this.classValidators.set(layerName, validator);
      }
    }
  }

  /**
   * Register aspect schema for validation
   * @param {AspectDefinition} aspectDef - Aspect definition
   */
  registerAspect(aspectDef) {
    const { aspect, schema } = aspectDef;

    if (!this.aspectValidators.has(aspect)) {
      const validator = this.ajv.compile(schema);
      this.aspectValidators.set(aspect, validator);
    }
  }

  /**
   * Validate instance against resolved class
   * @param {Object} instance - Instance to validate
   * @param {ResolvedClass} resolvedClass - Resolved class with lineage
   * @returns {ValidationResult}
   */
  validate(instance, resolvedClass) {
    const errors = [];
    const { lineage, aspects } = resolvedClass;

    // Pass 1: Validate against each schema in lineage
    for (const layerName of lineage) {
      const validator = this.classValidators.get(layerName);

      if (!validator) {
        errors.push({
          level: 'error',
          code: 'no_validator',
          layer: layerName,
          message: `No validator registered for class: ${layerName}`,
          instance: instance.id
        });
        continue;
      }

      const valid = validator(instance);
      if (!valid && validator.errors) {
        for (const err of validator.errors) {
          errors.push(this._formatSchemaError(layerName, err, instance.id));
        }
      }
    }

    // Pass 2: Validate aspects
    // aspects is now always an object: {aspectName: {required: boolean}, ...}
    const aspectList = Object.keys(aspects || {});

    for (const aspectName of aspectList) {
      const aspectData = instance.aspects?.[aspectName];
      const requirement = aspects[aspectName];
      const isRequired = requirement?.required === true;

      // Check required
      if (isRequired && !aspectData) {
        errors.push({
          level: 'error',
          code: 'missing_required_aspect',
          layer: `aspect:${aspectName}`,
          message: `[aspect:${aspectName}] Required aspect not provided`,
          instance: instance.id,
          aspect: aspectName
        });
        continue;
      }

      // Validate aspect data if present
      if (aspectData) {
        const validator = this.aspectValidators.get(aspectName);

        if (!validator) {
          errors.push({
            level: 'error',
            code: 'no_validator',
            layer: `aspect:${aspectName}`,
            message: `No validator registered for aspect: ${aspectName}`,
            instance: instance.id,
            aspect: aspectName
          });
          continue;
        }

        const valid = validator(aspectData);
        if (!valid && validator.errors) {
          for (const err of validator.errors) {
            errors.push(this._formatAspectError(aspectName, err, instance.id));
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Batch validate multiple instances
   * @param {Array<Object>} instances - Array of instances
   * @param {Function} getResolvedClass - Function(className) => ResolvedClass
   * @returns {Array<ValidationResult & {instance: string, class: string}>}
   */
  validateBatch(instances, getResolvedClass) {
    const results = [];

    for (const instance of instances) {
      const resolvedClass = getResolvedClass(instance.class);
      const result = this.validate(instance, resolvedClass);

      results.push({
        instance: instance.id,
        class: instance.class,
        ...result
      });
    }

    return results;
  }

  /**
   * Format schema validation error
   * @private
   */
  _formatSchemaError(layerName, err, instanceId) {
    const path = err.instancePath || '/';
    let msg = `[${layerName}] ${path}`;

    if (err.keyword === 'required') {
      msg += ` missing required field: ${err.params.missingProperty}`;
    } else if (err.keyword === 'type') {
      msg += ` must be ${err.params.type}`;
    } else if (err.keyword === 'minimum') {
      msg += ` must be >= ${err.params.limit}`;
    } else if (err.keyword === 'maximum') {
      msg += ` must be <= ${err.params.limit}`;
    } else if (err.keyword === 'minLength') {
      msg += ` too short (min: ${err.params.limit})`;
    } else if (err.keyword === 'pattern') {
      msg += ' invalid format';
    } else if (err.keyword === 'additionalProperties') {
      msg += ` has unexpected field: ${err.params.additionalProperty}`;
    } else {
      msg += ` ${err.message}`;
    }

    return {
      level: 'error',
      code: 'schema_validation',
      layer: layerName,
      message: msg,
      path,
      instance: instanceId,
      ajvError: err
    };
  }

  /**
   * Format aspect validation error
   * @private
   */
  _formatAspectError(aspectName, err, instanceId) {
    const path = err.instancePath || '/';
    let msg = `[aspect:${aspectName}] ${path}`;

    if (err.keyword === 'required') {
      msg += ` missing required field: ${err.params.missingProperty}`;
    } else if (err.keyword === 'type') {
      msg += ` must be ${err.params.type}`;
    } else if (err.keyword === 'pattern') {
      msg += ' invalid format';
    } else {
      msg += ` ${err.message}`;
    }

    return {
      level: 'error',
      code: 'aspect_validation',
      layer: `aspect:${aspectName}`,
      message: msg,
      path,
      instance: instanceId,
      aspect: aspectName,
      ajvError: err
    };
  }

  /**
   * Clear all cached validators
   */
  clear() {
    this.classValidators.clear();
    this.aspectValidators.clear();
  }
}
