/**
 * MultiPassValidator - Validate instances against lineage + aspects + semantics + lint
 *
 * Key principle: Validate against each schema in lineage separately
 * Port of prototypes/multi_pass_validator.js with production hardening
 * Extended with semantic validation and lint passes
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { SemanticValidator } from './semantic_validator.js';
import { LintValidator } from './lint_validator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MultiPassValidator {
  constructor(options = {}) {
    this.ajv = new Ajv({
      allErrors: true,
      strict: true,
      strictRequired: true,
      strictTypes: true,
      validateSchema: true,
      validateFormats: true,
      ...options.ajvOptions
    });
    addFormats(this.ajv, { mode: 'full' });

    // Load and compile base schema for all instances
    const baseSchemaPath = path.join(__dirname, '../schemas/instance_base.schema.json');
    const baseSchemaData = fs.readFileSync(baseSchemaPath, 'utf8');
    const baseSchema = JSON.parse(baseSchemaData);
    this.baseValidator = this.ajv.compile(baseSchema);

    // Cache compiled validators
    /** @type {Map<string, Function>} */
    this.classValidators = new Map();
    /** @type {Map<string, Function>} */
    this.aspectValidators = new Map();

    // Semantic and lint validators
    this.enableSemantic = options.enableSemantic !== false;
    this.enableLint = options.enableLint !== false;
    this.semanticValidator = new SemanticValidator();
    this.lintValidator = new LintValidator(options.lintOptions);
  }

  /**
   * Register class schemas for validation
   * @param {ResolvedClass} resolvedClass - Resolved class with lineage
   */
  registerClass(resolvedClass) {
    const { $lineage: lineage, $schemas: schemas } = resolvedClass;

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
    const { $aspect: aspect, $schema: schema } = aspectDef;

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
    const { $lineage: lineage, $aspects } = resolvedClass;

    // Pass 0: Validate against base instance schema ($id, $class, $render)
    const baseValid = this.baseValidator(instance);
    if (!baseValid && this.baseValidator.errors) {
      for (const err of this.baseValidator.errors) {
        errors.push(this._formatBaseSchemaError(err, instance.$id));
      }
    }

    // Pass 1: Validate against each schema in lineage
    for (const layerName of lineage) {
      const validator = this.classValidators.get(layerName);

      if (!validator) {
        errors.push({
          level: 'error',
          code: 'no_validator',
          layer: layerName,
          message: `No validator registered for class: ${layerName}`,
          instance: instance.$id
        });
        continue;
      }

      const valid = validator(instance);
      if (!valid && validator.errors) {
        for (const err of validator.errors) {
          errors.push(this._formatSchemaError(layerName, err, instance.$id));
        }
      }
    }

    // Pass 2: Validate aspects
    // $aspects is now always an object: {aspectName: {required: boolean}, ...}
    const aspectList = Object.keys($aspects || {});

    for (const aspectName of aspectList) {
      const aspectData = instance.$aspects?.[aspectName];
      const requirement = $aspects[aspectName];
      const isRequired = requirement?.required === true;

      // Check required
      if (isRequired && !aspectData) {
        errors.push({
          level: 'error',
          code: 'missing_required_aspect',
          layer: `aspect:${aspectName}`,
          message: `[aspect:${aspectName}] Required aspect not provided`,
          instance: instance.$id,
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
            instance: instance.$id,
            aspect: aspectName
          });
          continue;
        }

        const valid = validator(aspectData);
        if (!valid && validator.errors) {
          for (const err of validator.errors) {
            errors.push(this._formatAspectError(aspectName, err, instance.$id));
          }
        }
      }
    }

    // Pass 3: Semantic validation (format checks, quality checks)
    if (this.enableSemantic) {
      const semanticWarnings = this.semanticValidator.validateInstance(instance);
      errors.push(...semanticWarnings);
    }

    // Pass 4: Lint pass (data quality, conventions)
    if (this.enableLint) {
      const lintWarnings = this.lintValidator.validateInstance(instance);
      errors.push(...lintWarnings);
    }

    // Separate errors from warnings
    const actualErrors = errors.filter(e => e.level === 'error');
    const warnings = errors.filter(e => e.level === 'warning');

    return {
      valid: actualErrors.length === 0,
      errors: actualErrors,
      warnings,
      allIssues: errors  // Combined for convenience
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
      const resolvedClass = getResolvedClass(instance.$class);
      const result = this.validate(instance, resolvedClass);

      results.push({
        instance: instance.$id,
        class: instance.$class,
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
   * Format base schema validation error
   * @private
   */
  _formatBaseSchemaError(err, instanceId) {
    const path = err.instancePath || '/';
    let msg = `[instance_base] ${path}`;

    if (err.keyword === 'required') {
      msg += ` missing required field: ${err.params.missingProperty}`;
    } else if (err.keyword === 'type') {
      msg += ` must be ${err.params.type}`;
    } else if (err.keyword === 'additionalProperties') {
      msg += ` has unexpected field: ${err.params.additionalProperty}`;
    } else {
      msg += ` ${err.message}`;
    }

    return {
      level: 'error',
      code: 'base_schema_validation',
      layer: 'instance_base',
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
