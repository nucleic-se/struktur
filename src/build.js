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
    deterministic = false
  } = options;

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
    const result = await loadInstancesFromDir(dir);
    allInstances.push(...result.instances);
    allClasslessRejects.push(...result.classlessRejects);
  }
  
  log.log(`  ✓ Loaded ${allInstances.length} instances`);
  
  // Emit consolidated warning for classless rejects
  if (allClasslessRejects.length > 0) {
    log.warn(`  ⚠ Rejected ${allClasslessRejects.length} classless instances (missing 'class' field):`);
    // Show first 5 examples
    const examples = allClasslessRejects.slice(0, 5);
    for (const reject of examples) {
      log.warn(`     - '${reject.id}' in ${reject.file}`);
    }
    if (allClasslessRejects.length > 5) {
      log.warn(`     ... and ${allClasslessRejects.length - 5} more`);
    }
  }

  // Merge instances with same ID
  const instances = mergeInstances(allInstances);
  const mergeStats = getMergeStats(allInstances, instances);
  if (mergeStats.mergedCount > 0) {
    log.log(`  ✓ Merged ${mergeStats.reduction} duplicate IDs into ${instances.length} unique instances`);
  }

  // Step 2: Generate canonical with validation (includes aspects_by_kind)
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
  log.log(`  ✓ canonical.json (${canonical.objects.length} objects)`);

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

  // Step 7: Render templates if provided (v1-compatible with global.build array)
  let renderedCount = 0;
  if (templateDirs.length > 0) {
    log.log('\n🎨 Rendering templates...');
    const { createTemplateAdapter } = await import('./template_helpers.js');
    const adapter = createTemplateAdapter(engine);
    adapter.setSearchPaths(templateDirs);

    // Register all generic helpers
    const { genericHelpers } = await import('./template_helpers/generic/index.js');
    for (const [name, fn] of Object.entries(genericHelpers)) {
      adapter.registerHelper(name, fn);
    }

    // Load all templates recursively as partials (format-agnostic)
    for (const dir of templateDirs) {
      if (adapter.loadPartials) {
        try {
          await adapter.loadPartials(dir);
        } catch {
          // Directory doesn't exist, skip
        }
      }
    }

    // Find global instance with build array
    const globalInstance = canonical.objects.find(obj => obj.id === 'global');
    const buildArray = globalInstance?.build || [];
    
    if (!globalInstance?.build) {
      log.warn(`  ⚠ Warning: No global.build array found - no templates will be rendered`);
      log.log(`     Add a global.json with "build": [...] array to enable template rendering`);
    }

    if (buildArray.length > 0) {
      log.log(`  Found ${buildArray.length} build tasks`);

      // Collect outputs from render_file helper
      const renderFileOutputs = [];

      // Register engine helpers with build context
      if (adapter.registerEngineHelpers) {
        await adapter.registerEngineHelpers({
          buildDir,
          outputs: renderFileOutputs,
          log: quiet ? undefined : console,
          templateKey: 'index.html',
          adapter
        });
      }

      // Build instances_by_id map for v1 template compatibility
      const instancesById = {};
      canonical.objects.forEach(obj => {
        instancesById[obj.id] = obj;
      });

      // Prepare context with canonical as single source of truth
      // canonical.classes_by_id now contains resolved class objects (not instance IDs)
      // aspects_by_kind is now part of canonical output
      const templateContext = {
        global: globalInstance,
        instances: canonical.objects,
        instances_by_id: instancesById,  // v1 compatibility
        canonical,
        ...canonical
      };

      // Process each build task
      for (const task of buildArray) {
        for (const [templateFile, outputPath] of Object.entries(task)) {
          try {
            // Render template with full canonical context
            const content = await adapter.render(templateFile, templateContext);
            
            // Write main template output to specified path (with security check)
            const resolvedPath = resolveOutputPath(templateFile, outputPath, buildDir, console);
            if (!resolvedPath) {
              log.log(`  ✗ Skipping ${templateFile}: unsafe output path ${outputPath}`);
              continue;
            }
            await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
            await fs.writeFile(resolvedPath, content, 'utf-8');
            renderedCount++;
          } catch (error) {
            log.log(`  ✗ Failed to process ${templateFile}: ${error.message}`);
          }
        }
      }

      // Write all render_file outputs (additional files generated by templates)
      if (renderFileOutputs.length > 0) {
        for (const output of renderFileOutputs) {
          // Security: validate output path is within buildDir
          const relativePath = path.relative(buildDir, output.path);
          const safeOutputPath = resolveOutputPath('render_file', relativePath, buildDir, console);
          if (!safeOutputPath) {
            log.log(`  ✗ Skipping render_file output: unsafe path ${relativePath}`);
            continue;
          }
          await fs.mkdir(path.dirname(safeOutputPath), { recursive: true });
          await fs.writeFile(safeOutputPath, output.content, 'utf-8');
          renderedCount++;
        }
      }
      
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
 * Load instances recursively from a directory
 * @param {string} dirPath - Directory path
 * @returns {Promise<Array>} Array of instances
 */
async function loadInstancesFromDir(dirPath) {
  const instances = [];
  const classlessRejects = [];

  async function loadFromDir(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      // Sort alphabetically for deterministic loading order
      entries.sort((a, b) => a.name.localeCompare(b.name));

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Exclude 'mixins' and 'stacks' directories - they must be explicitly included
          if (entry.name === 'mixins' || entry.name === 'stacks') {
            continue;
          }
          await loadFromDir(fullPath);
        } else if (entry.name.endsWith('.json') && !entry.name.includes('.schema.')) {
          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            const data = JSON.parse(content);

            if (Array.isArray(data)) {
              // Process each item in array
              for (const item of data) {
                if (item && typeof item === 'object' && item.id) {
                  if (item.class) {
                    instances.push({ ...item, _source_file: fullPath });
                  } else {
                    // Reject classless instances
                    classlessRejects.push({ id: item.id, file: path.basename(fullPath) });
                  }
                }
              }
            } else if (data && typeof data === 'object' && data.id) {
              // Single object with id
              if (data.class) {
                instances.push({ ...data, _source_file: fullPath });
              } else {
                // Reject classless instances
                classlessRejects.push({ id: data.id, file: path.basename(fullPath) });
              }
            }
          } catch (error) {
            // Skip invalid JSON
          }
        }
      }
    } catch {
      // Directory doesn't exist or not readable
    }
  }

  await loadFromDir(dirPath);
  return { instances, classlessRejects };
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

/**
 * Generate viewer HTML with embedded canonical data
 */
async function generateViewer(buildDir, canonical, classCount, aspectCount) {
  const viewerHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Struktur Viewer</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    h1 { color: #333; }
    .stats {
      display: flex;
      gap: 20px;
      margin: 20px 0;
    }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      flex: 1;
    }
    .stat-card h3 {
      margin: 0 0 10px 0;
      color: #666;
      font-size: 14px;
      font-weight: normal;
      text-transform: uppercase;
    }
    .stat-card .value {
      font-size: 32px;
      font-weight: bold;
      color: #2563eb;
    }
    .instances {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-top: 20px;
    }
    .instance {
      padding: 15px;
      border-bottom: 1px solid #eee;
    }
    .instance:last-child {
      border-bottom: none;
    }
    .instance-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .instance-id {
      font-weight: bold;
      color: #333;
    }
    .instance-class {
      color: #666;
      font-size: 14px;
    }
    .instance-data {
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 12px;
      background: #f8f8f8;
      padding: 10px;
      border-radius: 4px;
      overflow-x: auto;
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <h1>Struktur Viewer</h1>
  
  <div class="stats">
    <div class="stat-card">
      <h3>Instances</h3>
      <div class="value">${canonical.objects.length}</div>
    </div>
    <div class="stat-card">
      <h3>Classes</h3>
      <div class="value">${classCount}</div>
    </div>
    <div class="stat-card">
      <h3>Aspects</h3>
      <div class="value">${aspectCount}</div>
    </div>
  </div>

  <div class="instances">
    <h2>Instances</h2>
    ${canonical.objects.map(obj => `
      <div class="instance">
        <div class="instance-header">
          <span class="instance-id">${obj.id}</span>
          <span class="instance-class">${obj.class}</span>
        </div>
        <div class="instance-data">
          <pre>${JSON.stringify(obj, null, 2)}</pre>
        </div>
      </div>
    `).join('')}
  </div>

  <script>
    // Canonical data for debugging
    window.struktur = ${JSON.stringify(canonical, null, 2)};
    console.log('Struktur canonical data loaded:', window.struktur);
  </script>
</body>
</html>`;

  await fs.writeFile(path.join(buildDir, 'index.html'), viewerHTML, 'utf-8');
}
