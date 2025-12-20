/**
 * Build orchestration for Struktur v2
 * Simplified from v1's build.js but maintains the same output structure
 */

import fs from 'fs/promises';
import path from 'path';
import { createStruktur, generateCanonicalWithValidation } from './index.js';
import { resolveOutputPath } from './template_helpers/engine/index.js';
import { createLogger } from './utils/logger.js';
import { checkCollision, writeManifest, generateDeterministicBuildDir } from './utils/build_manifest.js';
import { mergeInstances, getMergeStats } from './instance_merger.js';
import { loadInstancesFromDir } from './instance_loader.js';
import { TemplateRenderer } from './template_renderer.js';

/**
 * Build a stack with organized output directory
 * @param {Object} options - Build options
 * @returns {Promise<Object>} Build result
 */
export async function buildStack(options) {
  const {
    classDirs,
    aspectDirs = [],
    instanceDirs,
    templateDirs = [],
    buildDir: requestedBuildDir = './build',
    engine = 'handlebars',
    quiet = false,
    logger,
    deterministic = false,
    failOnCollisions = true,
    renderTasks = []
  } = options;

  // Validate required inputs
  if (!classDirs || !Array.isArray(classDirs) || classDirs.length === 0) {
    throw new Error('Either provide a stack directory or use -c/--classes flag');
  }

  const log = logger || createLogger({ quiet });
  
  // Generate deterministic build dir by default (disable with deterministic=false)
  let buildDir = requestedBuildDir;
  const useDeterministic = deterministic !== false; // true by default
  
  if (useDeterministic) {
    buildDir = generateDeterministicBuildDir(requestedBuildDir, {
      classDirs,
      aspectDirs,
      instanceDirs,
      templateDirs
    });
    log.log(`📍 Build directory: ${buildDir}`);
  } else {
    // Check for build collisions when using exact directory
    await checkCollision(buildDir, {
      classDirs,
      aspectDirs,
      instanceDirs,
      templateDirs
    }, log);
  }

  // Step 1: Load and validate stack
  log.log('📦 Loading stack...');
  const struktur = createStruktur();

  // Load classes from all directories
  for (const dir of classDirs) {
    await struktur.classLoader.loadClassesFromDirectory(dir);
  }
  log.log(`  ✓ Loaded ${struktur.classLoader.classes.size} classes`);

  // Load aspects
  for (const dir of aspectDirs) {
    const aspects = await struktur.aspectLoader.loadAspectsFromDirectory(dir);
    for (const aspect of aspects) {
      struktur.validator.registerAspect(aspect);
    }
  }
  if (aspectDirs.length > 0) {
    log.log(`  ✓ Loaded ${struktur.aspectLoader.aspects.size} aspects`);
  }

  // Load instances from all directories
  const allInstances = [];
  const allClasslessRejects = [];
  for (const dir of instanceDirs || classDirs) {
    const result = await loadInstancesFromDir(dir, { logger: log });
    allInstances.push(...result.instances);
    allClasslessRejects.push(...result.classlessRejects);
  }
  
  log.log(`  ✓ Loaded ${allInstances.length} instances`);
  
  // Enforce class field requirement - throw error for classless instances
  if (allClasslessRejects.length > 0) {
    const errorMessage = [`\nError: Found ${allClasslessRejects.length} instances missing required 'class' field:\n`];
    // Show first 5 examples
    const examples = allClasslessRejects.slice(0, 5);
    for (const reject of examples) {
      errorMessage.push(`  - '${reject.id}' in ${reject.file}`);
    }
    if (allClasslessRejects.length > 5) {
      errorMessage.push(`  ... and ${allClasslessRejects.length - 5} more`);
    }
    errorMessage.push('\nAll instances must have a "class" field that references a valid class definition.');
    throw new Error(errorMessage.join('\n'));
  }

  // Merge instances with same ID
  const instances = mergeInstances(allInstances);
  const mergeStats = getMergeStats(allInstances, instances);
  if (mergeStats.mergedCount > 0) {
    log.log(`  ✓ Merged ${mergeStats.reduction} duplicate IDs into ${instances.length} unique instances`);
  }

  // Step 2: Generate canonical with validation (includes aspects_by_id)
  log.log('\n🔍 Validating stack...');
  const canonical = generateCanonicalWithValidation(instances, struktur, {
    includeMetadata: true,
    includeClassIndex: true,
    includeValidation: true,
    aspectLoader: struktur.aspectLoader,
    logger: log
  });

  const summary = getValidationSummary(canonical.validation);
  if (summary.invalid > 0) {
    log.log(`  ✗ Validation failed: ${summary.invalid} invalid instances`);
    
    // Display detailed error information
    if (canonical.validation && canonical.validation.errors) {
      log.log('');
      displayValidationErrors(canonical.validation, log);
    }
    
    throw new Error('Validation failed');
  }
  log.log(`  ✓ All ${summary.total} class-bearing instances valid`);

  // Step 3: Prepare build directory
  log.log(`\n📁 Preparing build directory: ${buildDir}`);
  await fs.mkdir(buildDir, { recursive: true });

  // Step 4: Write canonical output
  log.log('\n📝 Writing outputs...');
  const canonicalPath = resolveOutputPath('canonical.json', 'canonical.json', buildDir, console);
  if (!canonicalPath) {
    throw new Error('Security: canonical.json path resolution failed');
  }
  await fs.writeFile(canonicalPath, JSON.stringify(canonical, null, 2), 'utf-8');
  log.log(`  ✓ canonical.json (${canonical.instances.length} instances)`);

  // Step 5: Write class definitions
  const classDefsDir = path.join(buildDir, 'meta', 'classes');
  await fs.mkdir(classDefsDir, { recursive: true });
  let classCount = 0;

  // Resolve all classes first
  for (const className of struktur.classLoader.classes.keys()) {
    const resolved = struktur.classResolver.resolve(className);
    const outputPath = resolveOutputPath(className, `meta/classes/${className}.json`, buildDir, console);
    if (!outputPath) {
      log.log(`  ✗ Skipping ${className}: unsafe path`);
      continue;
    }
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(resolved, null, 2), 'utf-8');
    classCount++;
  }
  log.log(`  ✓ meta/classes/ (${classCount} classes)`);

  // Step 6: Write validation report
  const metaDir = path.join(buildDir, 'meta');
  await fs.mkdir(metaDir, { recursive: true });
  const validationPath = resolveOutputPath('validation.json', 'meta/validation.json', buildDir, console);
  if (!validationPath) {
    throw new Error('Security: validation.json path resolution failed');
  }
  await fs.writeFile(validationPath, JSON.stringify(canonical.validation, null, 2), 'utf-8');
  log.log('  ✓ meta/validation.json');

  // Step 6.5: Extract render tasks from instances and merge with config render tasks
  const instanceRenderTasks = canonical.instances
    .filter(inst => inst.render && Array.isArray(inst.render) && inst.render.length > 0)
    .flatMap(inst => inst.render);
  
  // Merge: config tasks first, then instance tasks
  const allRenderTasks = [...renderTasks, ...instanceRenderTasks];
  
  if (instanceRenderTasks.length > 0) {
    log.log(`  ℹ Found ${instanceRenderTasks.length} render tasks from instances`);
  }

  // Step 7: Render templates if provided (v1-compatible with global.build array)
  let renderedCount = 0;
  if (templateDirs.length > 0) {
    log.log('\n🎨 Rendering templates...');
    
    // Detect template collisions
    const { detectTemplateCollisions, formatCollisionReport } = await import('./utils/template_collision.js');
    const collisionReport = await detectTemplateCollisions(templateDirs);
    
    if (collisionReport.collisionCount > 0) {
      const reportLines = formatCollisionReport(collisionReport, { verbose: false });
      reportLines.forEach(line => log.warn(line));
      
      if (failOnCollisions) {
        throw new Error(`Template collision detected. Found ${collisionReport.collisionCount} template(s) in multiple directories. Use unique names, remove duplicates, or use --allow-template-collisions to permit overrides.`);
      }
    }
    
    const { createTemplateAdapter } = await import('./template_helpers.js');
    const adapter = createTemplateAdapter(engine);
    adapter.setSearchPaths(templateDirs);

    // Create renderer and register all helpers
    const renderer = new TemplateRenderer(adapter, { log, quiet });
    renderer.setSearchPaths(templateDirs);  // For template resolution
    await renderer.registerHelpers(canonical);
    await renderer.loadPartials(templateDirs);

    // Use merged render tasks
    if (allRenderTasks.length === 0) {
      log.log(`  ℹ No render tasks found (no "render" array in config or instances)`);
      log.log(`     Templates will not be rendered. This is OK if you only need canonical output.`);
    } else {
      log.log(`  Found ${allRenderTasks.length} render tasks`);
      
      // Render all tasks with pre-flight validation and buffer support
      const result = await renderer.renderAll(allRenderTasks, canonical, buildDir);
      renderedCount = result.renderedCount;

      if (renderedCount > 0) {
        log.log(`  ✓ ${renderedCount} files rendered`);
      }
    }
  }

  // Write build manifest for collision detection
  await writeManifest(buildDir, {
    classDirs,
    aspectDirs,
    instanceDirs,
    templateDirs
  });

  // Summary
  log.log('\n✨ Build complete!');
  log.log(`  📊 ${summary.total} instances validated`);
  log.log(`  📦 ${classCount} class definitions`);
  if (renderedCount > 0) {
    log.log(`  🎨 ${renderedCount} templates rendered`);
  }
  log.log(`  📂 ${buildDir}/`);

  return {
    success: true,
    canonical,
    classCount,
    instanceCount: summary.total,
    renderedCount,
    buildDir
  };
}

/**
 * Display validation errors with context and guidance
 */
function displayValidationErrors(validation, log) {
  const errorEntries = validation?.errors || [];
  
  for (const entry of errorEntries) {
    log.log(`❌ Instance: ${entry.instance || '(unknown)'}`);
    if (entry.class) {
      log.log(`   Class: ${entry.class}`);
    }
    log.log('');
    
    // Group errors by type for better readability
    const errorsByType = {
      required: [],
      type: [],
      pattern: [],
      additionalProperties: [],
      other: []
    };
    
    for (const error of (entry.errors || [])) {
      const ajv = error.ajvError || {};
      const keyword = ajv.keyword || 'other';
      
      if (errorsByType[keyword]) {
        errorsByType[keyword].push(error);
      } else {
        errorsByType.other.push(error);
      }
    }
    
    // Display missing required fields
    if (errorsByType.required.length > 0) {
      log.log('   Missing required fields:');
      for (const err of errorsByType.required) {
        const field = err.ajvError?.params?.missingProperty || '(unknown)';
        log.log(`     • ${field}`);
        log.log(`       ${err.message}`);
      }
      log.log('');
    }
    
    // Display type errors
    if (errorsByType.type.length > 0) {
      log.log('   Type mismatches:');
      for (const err of errorsByType.type) {
        const expectedType = err.ajvError?.params?.type || 'unknown';
        log.log(`     • Field: ${err.path}`);
        log.log(`       Expected: ${expectedType}`);
        log.log(`       ${err.message}`);
      }
      log.log('');
    }
    
    // Display pattern/format errors
    if (errorsByType.pattern.length > 0) {
      log.log('   Format/pattern errors:');
      for (const err of errorsByType.pattern) {
        log.log(`     • Field: ${err.path}`);
        log.log(`       ${err.message}`);
        if (err.ajvError?.params?.pattern) {
          log.log(`       Expected pattern: ${err.ajvError.params.pattern}`);
        }
      }
      log.log('');
    }
    
    // Display unexpected fields
    if (errorsByType.additionalProperties.length > 0) {
      log.log('   Unexpected fields (not in schema):');
      for (const err of errorsByType.additionalProperties) {
        const field = err.ajvError?.params?.additionalProperty || '(unknown)';
        log.log(`     • ${field}`);
        log.log(`       ${err.message}`);
      }
      log.log('');
    }
    
    // Display other errors
    if (errorsByType.other.length > 0) {
      log.log('   Other validation errors:');
      for (const err of errorsByType.other) {
        log.log(`     • ${err.message}`);
      }
      log.log('');
    }
    
    log.log('   💡 Tip: Check the schema for this class to see all requirements');
    log.log('   📄 Full details: build/build-*/meta/validation.json');
    log.log('');
  }
}

/**
 * Get validation summary statistics
 */
function getValidationSummary(validation) {
  // Handle both old format (results array) and new format (summary object)
  if (validation?.total !== undefined) {
    return {
      total: validation.total || 0,
      valid: validation.valid || 0,
      invalid: validation.invalid || 0,
      errorCount: validation.errors?.length || 0
    };
  }
  
  const results = validation?.results || [];
  return {
    total: results.length,
    valid: results.filter(r => r.valid).length,
    invalid: results.filter(r => !r.valid).length,
    errorCount: results.reduce((sum, r) => sum + (r.errors?.length || 0), 0)
  };
}
