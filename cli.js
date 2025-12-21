#!/usr/bin/env node

/**
 * Struktur CLI - Command-line interface for stack validation and output generation
 */

import { Command } from 'commander';
import { createStruktur, generateCanonicalWithValidation, HandlebarsAdapter } from './src/index.js';
import NunjucksAdapter from './src/adapters/nunjucks_adapter.js';
import { buildStack } from './src/build.js';
import { mergeInstances, getMergeStats } from './src/instance_merger.js';
import { loadInstancesFromDir } from './src/instance_loader.js';
import { normalizePathArray, discoverStackDirs, resolveConfigPaths, handleCommandError } from './src/cli_helpers.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveOutputPath } from './src/template_helpers/engine/index.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const packageJson = require('./package.json');

const program = new Command();

// Get the directory where CLI is installed
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

program
  .name('struktur')
  .description('Struktur - Stack validation and output generation')
  .version(packageJson.version);

program
  .command('validate [stack-dirs...]')
  .description('Validate stack instances against schemas. Use stack-dirs for auto-discovery of classes/, instances/, aspects/ subdirectories. Multiple stack directories will be merged.')
  .option('-c, --classes <dirs...>', 'Directories containing class definitions')
  .option('-a, --aspects <dirs...>', 'Directories containing aspect definitions')
  .option('-i, --instances <dirs...>', 'Directories containing instance files')
  .option('-q, --quiet', 'Suppress output except errors')
  .option('--json', 'Output results as JSON')
  .action(async (stackDirs, options) => {
    try {
      const struktur = createStruktur();

      let classDirs, aspectDirs, instanceDirs;

      // Stack directory mode with auto-discovery
      if (stackDirs && stackDirs.length > 0 && !options.classes) {
        const discovered = await discoverStackDirs(stackDirs, { includeTemplates: false });
        classDirs = discovered.classDirs;
        aspectDirs = discovered.aspectDirs;
        instanceDirs = discovered.instanceDirs;
      } else if (options.classes) {
        // Explicit mode with CLI flags
        classDirs = normalizePathArray(options.classes);
        aspectDirs = normalizePathArray(options.aspects);
        instanceDirs = normalizePathArray(options.instances, classDirs);
      } else {
        throw new Error('Either provide a stack directory or use -c/--classes flag');
      }

      // Load from multiple directories

      for (const dir of classDirs) {
        await struktur.classLoader.loadClassesFromDirectory(dir);
      }

      for (const dir of aspectDirs) {
        const aspects = await struktur.aspectLoader.loadAspectsFromDirectory(dir);
        for (const aspect of aspects) {
          struktur.validator.registerAspect(aspect);
        }
      }

      // Load instances from directories
      const allInstances = [];
      const allClasslessRejects = [];
      const instanceLogger = options.quiet ? null : { warn: (msg) => console.warn(msg) };
      for (const dir of instanceDirs) {
        const result = await loadInstancesFromDir(dir, { logger: instanceLogger });
        allInstances.push(...result.instances);
        allClasslessRejects.push(...result.classlessRejects);
      }

      // Warn about classless instances
      if (allClasslessRejects.length > 0 && !options.quiet) {
        console.warn(`⚠ Rejected ${allClasslessRejects.length} classless instances (missing '$class' field):`);
        const examples = allClasslessRejects.slice(0, 5);
        for (const reject of examples) {
          console.warn(`   - '${reject.id}' in ${reject.file}`);
        }
        if (allClasslessRejects.length > 5) {
          console.warn(`   ... and ${allClasslessRejects.length - 5} more`);
        }
      }

      // Merge instances with same ID
      const instances = mergeInstances(allInstances);
      const mergeStats = getMergeStats(allInstances, instances);
      if (mergeStats.mergedCount > 0 && !options.quiet) {
        console.log(`✓ Merged ${mergeStats.reduction} duplicate IDs into ${instances.length} unique instances`);
      }

      // Warn if no instances found
      if (instances.length === 0 && !options.quiet) {
        console.warn('⚠ Warning: No instances found to validate.');
        console.warn('   Tip: Use -i/--instances to specify instance directory');
        console.warn('        or provide a stack directory with instances/ subdirectory');
      }

      // Validate all instances
      const results = struktur.validate(instances);

      // Output results
      if (options.json) {
        console.log(JSON.stringify({
          results,
          summary: getSummary(results)
        }, null, 2));
      } else {
        displayResults(results, options.quiet);
      }

      // Exit with error code if any validation failed
      const hasErrors = results.some(r => !r.valid);
      process.exit(hasErrors ? 1 : 0);
    } catch (error) {
      handleCommandError(error, options);
    }
  });

program
  .command('info')
  .description('Display information about loaded classes and aspects')
  .requiredOption('-c, --classes <dirs...>', 'Directories containing class definitions')
  .option('-a, --aspects <dirs...>', 'Directories containing aspect definitions')
  .action(async (options) => {
    try {
      const struktur = createStruktur();

      // Load from multiple directories
      const classDirs = normalizePathArray(options.classes);
      const aspectDirs = normalizePathArray(options.aspects);

      for (const dir of classDirs) {
        await struktur.classLoader.loadClassesFromDirectory(dir);
      }

      for (const dir of aspectDirs) {
        const aspects = await struktur.aspectLoader.loadAspectsFromDirectory(dir);
        for (const aspect of aspects) {
          struktur.validator.registerAspect(aspect);
        }
      }

      console.log('\n=== Classes ===');
      const classes = struktur.classLoader.getAllClasses();
      for (const cls of classes) {
        const inherits = cls.$parent
          ? Array.isArray(cls.$parent)
            ? cls.$parent.join(', ')
            : cls.$parent
          : 'none';
        console.log(`  ${cls.$class} (inherits: ${inherits})`);
      }
      console.log(`\nTotal: ${classes.length} classes`);

      if (options.aspects) {
        console.log('\n=== Aspects ===');
        const aspects = struktur.aspectLoader.getAllAspects();
        for (const aspect of aspects) {
          console.log(`  ${aspect.$aspect}`);
        }
        console.log(`\nTotal: ${aspects.length} aspects`);
      }
    } catch (error) {
      handleCommandError(error, options);
    }
  });

/**
 * Create template adapter based on engine name
 */
function createTemplateAdapter(engineName) {
  switch (engineName.toLowerCase()) {
  case 'handlebars':
    return new HandlebarsAdapter();
  case 'nunjucks':
    return new NunjucksAdapter();
  default:
    throw new Error(`Unknown template engine: ${engineName}. Supported: handlebars, nunjucks`);
  }
}

/**
 * Get output file extension based on class name
 * 
 * TODO: In future, read extension from class schema metadata:
 *   - class.schema.outputExtension
 *   - class.schema.x-struktur.extension
 * 
 * @param {string} className - Class name (for error context)
 * @param {Object} [classDef] - Resolved class definition (optional)
 * @returns {string} File extension without dot
 */
function getOutputExtension(className, classDef) {
  const schema = classDef?.$schemas?.[classDef.$schemas.length - 1] || classDef?.$schema;
  const extension = schema?.outputExtension || schema?.['x-struktur']?.extension;
  if (typeof extension === 'string' && extension.trim().length > 0) {
    return extension.replace(/^\./, '');
  }

  // Default to .txt for single-file output mode.
  // Multi-file output uses template names with extensions.
  return 'txt';
}

/**
 * Get summary statistics
 */
function getSummary(results) {
  return {
    total: results.length,
    valid: results.filter(r => r.valid).length,
    invalid: results.filter(r => !r.valid).length,
    errorCount: results.reduce((sum, r) => sum + r.errors.length, 0)
  };
}

/**
 * Display validation results
 */
function displayResults(results, quiet) {
  const summary = getSummary(results);

  if (!quiet) {
    console.log('\n=== Validation Results ===\n');

    for (const result of results) {
      const status = result.valid ? '✓' : '✗';
      console.log(`${status} ${result.instance} (${result.class})`);

      if (!result.valid && result.errors.length > 0) {
        for (const error of result.errors) {
          console.log(`    ERROR: ${error.message}`);
        }
      }

      if (result.warnings && result.warnings.length > 0) {
        for (const warning of result.warnings) {
          console.log(`    WARNING: ${warning.message}`);
        }
      }
    }
  }

  // Always show summary (even in quiet mode)
  console.log('\n=== Summary ===');
  console.log(`Total:    ${summary.total}`);
  console.log(`Valid:    ${summary.valid}`);
  console.log(`Invalid:  ${summary.invalid}`);
  console.log(`Errors:   ${summary.errorCount}`);
  
  // Count warnings across all results
  const warningCount = results.reduce((sum, r) => sum + (r.warnings?.length || 0), 0);
  if (warningCount > 0) {
    console.log(`Warnings: ${warningCount}`);
  }
  console.log();
}

program
  .command('generate [stack-dirs...]')
  .description('Generate canonical output from validated instances. Use stack-dirs for auto-discovery of classes/, instances/, aspects/, templates/ subdirectories. Multiple stack directories will be merged.')
  .option('-c, --classes <dirs...>', 'Directories containing class definitions')
  .option('-a, --aspects <dirs...>', 'Directories containing aspect definitions')
  .option('-i, --instances <dirs...>', 'Directories containing instance files')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .option('-t, --templates <dirs...>', 'Template directories to render')
  .option('--engine <name>', 'Template engine (handlebars, nunjucks)', 'handlebars')
  .option('--no-metadata', 'Exclude metadata from output')
  .option('--no-class-index', 'Exclude class index from output')
  .option('--include-validation', 'Include validation results in output')
  .option('--json', 'Output results as JSON (includes canonical + stats)')
  .action(async (stackDirs, options) => {
    try {
      const struktur = createStruktur();

      let classDirs, aspectDirs, instanceDirs, templateDirs;

      // Stack directory mode (templates NOT auto-discovered)
      if (stackDirs && stackDirs.length > 0 && !options.classes) {
        const discovered = await discoverStackDirs(stackDirs, { includeTemplates: false });
        classDirs = discovered.classDirs;
        aspectDirs = discovered.aspectDirs;
        instanceDirs = discovered.instanceDirs;
        templateDirs = normalizePathArray(options.templates);
      } else if (options.classes) {
        // Explicit mode with CLI flags
        classDirs = normalizePathArray(options.classes);
        aspectDirs = normalizePathArray(options.aspects);
        instanceDirs = normalizePathArray(options.instances, classDirs);
        templateDirs = normalizePathArray(options.templates);
      } else {
        throw new Error('Either provide a stack directory or use -c/--classes flag');
      }

      // Load from multiple directories

      for (const dir of classDirs) {
        await struktur.classLoader.loadClassesFromDirectory(dir);
      }

      for (const dir of aspectDirs) {
        const aspects = await struktur.aspectLoader.loadAspectsFromDirectory(dir);
        for (const aspect of aspects) {
          struktur.validator.registerAspect(aspect);
        }
      }

      // Load instances from directories
      const allInstances = [];
      const allClasslessRejects = [];
      const instanceLogger = options.quiet ? null : { warn: (msg) => console.warn(msg) };
      for (const dir of instanceDirs) {
        const result = await loadInstancesFromDir(dir, { logger: instanceLogger });
        allInstances.push(...result.instances);
        allClasslessRejects.push(...result.classlessRejects);
      }

      // Merge instances with same ID
      const instances = mergeInstances(allInstances);

      // Generate canonical output
      const canonical = generateCanonicalWithValidation(instances, struktur, {
        includeMetadata: options.metadata !== false,
        includeClassIndex: options.classIndex !== false,
        includeValidation: options.includeValidation || false
      });

      // Render templates if specified
      if (templateDirs.length > 0) {
        const adapter = createTemplateAdapter(options.engine);
        adapter.setSearchPaths(templateDirs);

        // Load partials from all template directories
        for (const dir of templateDirs) {
          const partialsDir = path.join(dir, 'partials');
          if (adapter.loadPartials) {
            await adapter.loadPartials(partialsDir);
          }
        }

        // Render templates for each object
        const outputDir = options.output || './output';
        await fs.mkdir(outputDir, { recursive: true });

        for (const obj of canonical.$instances) {
          const templateName = `${obj.$class}.hbs`;
          try {
            const rendered = await adapter.render(templateName, obj);
            const classDef = canonical.$classes_by_id?.[obj.$class];
            const relativeOutput = `${obj.$id}.${getOutputExtension(obj.$class, classDef)}`;
            const safeOutput = resolveOutputPath(templateName, relativeOutput, outputDir, console);
            if (!safeOutput) {
              console.warn(`Warning: Skipping render for ${obj.$id} due to unsafe output path '${relativeOutput}'`);
              continue;
            }
            await fs.writeFile(safeOutput, rendered, 'utf-8');
            console.log(`Rendered: ${safeOutput}`);
          } catch (error) {
            console.warn(`Warning: Could not render ${obj.$id}: ${error.message}`);
          }
        }

        console.log(`\nRendered ${canonical.$instances.length} instances to ${outputDir}`);
      } else {
        // Output canonical JSON
        let output;
        if (options.json) {
          // JSON mode: structured output with stats
          output = JSON.stringify({
            success: true,
            canonical,
            stats: {
              instances: canonical.$instances?.length || 0,
              classes: Object.keys(canonical.$classes_by_id || {}).length,
              aspects: Object.keys(canonical.$aspects_by_id || {}).length,
              validationErrors: canonical.$validation?.invalid || 0
            }
          }, null, 2);
        } else {
          output = JSON.stringify(canonical, null, 2);
        }

        // Write to file or stdout
        if (options.output) {
          await fs.writeFile(options.output, output, 'utf-8');
          if (!options.json) {
            console.log(`Generated canonical output: ${options.output}`);
          }
        } else {
          console.log(output);
        }
      }

      process.exit(0);
    } catch (error) {
      handleCommandError(error, options);
    }
  });

program
  .command('build [stack-dirs...]')
  .description('Build a complete stack with organized output. Use stack-dirs for auto-discovery of classes/, instances/, aspects/, templates/ subdirectories. Multiple stack directories will be merged.')
  .option('-c, --classes <dirs...>', 'Directories containing class definitions')
  .option('-a, --aspects <dirs...>', 'Directories containing aspect definitions')
  .option('-i, --instances <dirs...>', 'Directories containing instance files')
  .option('-t, --templates <dirs...>', 'Template directories to render')
  .option('-b, --build-dir <dir>', 'Build output directory', './build')
  .option('--config <file>', 'Path to config file (defaults to first *.build.json found)')
  .option('--save-config <file>', 'Save successful build settings to config file')
  .option('--engine <name>', 'Template engine (handlebars, nunjucks)', 'handlebars')
  .option('-q, --quiet', 'Suppress output except errors')
  .option('--json', 'Output results as JSON')
  .option('--no-deterministic', 'Use simple build directory (allows overwrites, not recommended for production)')
  .option('--exact', 'Use exact build directory path without hash suffix (overrides deterministic)')
  .option('--allow-template-collisions', 'Allow templates with same name in multiple directories (last wins)')
  .action(async (stackDirs, options) => {
    try {
      let classDirs, aspectDirs, instanceDirs, templateDirs;
      let configFromFile = {};

      // Try to load config file
      let configPath = options.config;
      
      if (!configPath) {
        // Auto-detect: look for any *.build.json file
        const searchDirs = [];
        
        // If single stack dir provided, check there first
        if (stackDirs && stackDirs.length === 1) {
          searchDirs.push(stackDirs[0]);
        }
        
        // Then check current directory
        searchDirs.push(process.cwd());
        
        for (const dir of searchDirs) {
          try {
            const files = await fs.readdir(dir);
            const buildConfigs = files.filter(f => f.endsWith('.build.json'));
            
            if (buildConfigs.length > 0) {
              // Prefer struktur.build.json if it exists, otherwise use first found
              const defaultConfig = buildConfigs.includes('struktur.build.json') 
                ? 'struktur.build.json' 
                : buildConfigs[0];
              configPath = path.join(dir, defaultConfig);
              break;
            }
          } catch {
            // Directory doesn't exist or not readable, continue
          }
        }
        
        // Fallback to default name
        if (!configPath) {
          configPath = path.join(process.cwd(), 'struktur.build.json');
        }
      }
      
      try {
        const configContent = await fs.readFile(configPath, 'utf-8');
        configFromFile = JSON.parse(configContent);
        if (!options.quiet && !options.json) {
          console.log(`📋 Loaded config from ${path.relative(process.cwd(), configPath)}`);
        }
      } catch (error) {
        // Config file doesn't exist or is invalid - that's okay
        if (options.config) {
          // User explicitly specified a config file that doesn't exist
          throw new Error(`Config file not found: ${options.config}`);
        }
      }

      // Resolve paths from config relative to config file directory
      const configDir = path.dirname(configPath);
      resolveConfigPaths(configFromFile, configDir, ['classes', 'aspects', 'instances', 'templates']);
      if (configFromFile.build_dir) {
        configFromFile.build_dir = path.resolve(configDir, configFromFile.build_dir);
      }

      const hasConfigKey = (key) => Object.prototype.hasOwnProperty.call(configFromFile, key);
      const hasClassDirs = options.classes !== undefined || hasConfigKey('classes');
      const hasAspectDirs = options.aspects !== undefined || hasConfigKey('aspects');
      const hasInstanceDirs = options.instances !== undefined || hasConfigKey('instances');
      const hasTemplateDirs = options.templates !== undefined || hasConfigKey('templates');

      // CLI flags override config file, config file overrides defaults
      if (hasClassDirs || hasAspectDirs || hasInstanceDirs || hasTemplateDirs || (stackDirs && stackDirs.length > 0)) {
        // Explicit mode or config mode
        if (hasClassDirs) {
          classDirs = normalizePathArray(options.classes || configFromFile.classes);
        }
        if (hasAspectDirs) {
          aspectDirs = normalizePathArray(options.aspects || configFromFile.aspects);
        }
        if (hasInstanceDirs) {
          instanceDirs = normalizePathArray(options.instances || configFromFile.instances);
        }
        if (hasTemplateDirs) {
          templateDirs = normalizePathArray(options.templates || configFromFile.templates);
        }

        // Build dir: CLI > config > default
        if (options.buildDir !== './build') {
          options.buildDir = options.buildDir;
        } else if (configFromFile.build_dir) {
          options.buildDir = configFromFile.build_dir;
        }
        
        // Engine: CLI > config > default
        if (options.engine === 'handlebars' && configFromFile.template_engine) {
          options.engine = configFromFile.template_engine;
        }
        
        // Boolean flags: CLI > config > defaults
        if (options.exact === undefined && configFromFile.exact !== undefined) {
          options.exact = configFromFile.exact;
        }
        if (options.allowTemplateCollisions === undefined && configFromFile.allow_template_collisions !== undefined) {
          options.allowTemplateCollisions = configFromFile.allow_template_collisions;
        }
        if (options.warnExtraFields === undefined && configFromFile.warn_extra_fields !== undefined) {
          options.warnExtraFields = configFromFile.warn_extra_fields;
        }
        if (options.warningsAsErrors === undefined && configFromFile.warnings_as_errors !== undefined) {
          options.warningsAsErrors = configFromFile.warnings_as_errors;
        }
        if (options.quiet === undefined && configFromFile.quiet !== undefined) {
          options.quiet = configFromFile.quiet;
        }

        // If no class dirs specified and stack dirs provided, fall through to stack-dirs mode
        if (!classDirs && stackDirs && stackDirs.length > 0) {
          // Fall through to stack-dirs mode below
        } else {
          // Skip the stack-dirs mode
          stackDirs = [];
        }
      }

      // Simplified mode: stack directories with conventional subdirectories
      if (stackDirs && stackDirs.length > 0 && !classDirs) {
        const discovered = await discoverStackDirs(stackDirs, { includeTemplates: true });
        classDirs = discovered.classDirs;
        aspectDirs = discovered.aspectDirs;
        instanceDirs = discovered.instanceDirs;
        templateDirs = discovered.templateDirs;
      }

      const result = await buildStack({
        classDirs,
        aspectDirs,
        instanceDirs,
        templateDirs,
        buildDir: options.buildDir,
        engine: options.engine,
        quiet: options.quiet || options.json,
        deterministic: options.exact ? false : options.deterministic,  // --exact overrides deterministic
        failOnCollisions: !options.allowTemplateCollisions,  // Invert: default strict, opt-out permissive
        renderTasks: configFromFile.render  // Config render array
      });

      // Save config if requested
      if (options.saveConfig) {
        const saveConfigPath = path.resolve(options.saveConfig);
        const saveConfigDir = path.dirname(saveConfigPath);
        
        // Build config object with only non-default values
        const config = {};
        
        // Add directories as relative paths
        if (classDirs && classDirs.length > 0) {
          config.classes = classDirs.map(d => path.relative(saveConfigDir, d));
        }
        if (aspectDirs && aspectDirs.length > 0) {
          config.aspects = aspectDirs.map(d => path.relative(saveConfigDir, d));
        }
        if (instanceDirs && instanceDirs.length > 0) {
          config.instances = instanceDirs.map(d => path.relative(saveConfigDir, d));
        }
        if (templateDirs && templateDirs.length > 0) {
          config.templates = templateDirs.map(d => path.relative(saveConfigDir, d));
        }
        
        // Add build_dir if not default
        if (options.buildDir !== './build') {
          config.build_dir = path.relative(saveConfigDir, options.buildDir);
        }
        
        // Add template_engine if not default
        if (options.engine !== 'handlebars') {
          config.template_engine = options.engine;
        }
        
        // Add boolean flags if not default
        if (options.exact) {
          config.exact = true;
        }
        if (options.allowTemplateCollisions) {
          config.allow_template_collisions = true;
        }
        if (options.warnExtraFields !== undefined) {
          config.warn_extra_fields = options.warnExtraFields;
        }
        if (options.warningsAsErrors !== undefined) {
          config.warnings_as_errors = options.warningsAsErrors;
        }
        if (options.quiet) {
          config.quiet = true;
        }
        
        // Add render tasks if present
        if (configFromFile.render) {
          config.$render = configFromFile.render;
        }
        
        // Write config file
        await fs.writeFile(saveConfigPath, JSON.stringify(config, null, 2), 'utf-8');
        
        if (!options.quiet && !options.json) {
          console.log(`💾 Saved config to ${path.relative(process.cwd(), saveConfigPath)}`);
        }
      }

      if (options.json) {
        console.log(JSON.stringify({
          success: true,
          buildDir: result.buildDir,
          stats: {
            instances: result.instanceCount,
            classes: result.classCount,
            templatesRendered: result.renderedCount,
            validationErrors: 0
          },
          canonical: result.canonical
        }, null, 2));
      }

      process.exit(0);
    } catch (error) {
      if (!options.json) {
        console.error(`\n❌ Build failed: ${error.message}`);
        process.exit(1);
      } else {
        handleCommandError(error, options);
      }
    }
  });

program
  .command('init [directory]')
  .description('Initialize a new stack from example template')
  .option('--example <name>', 'Example to copy (default: universal, or docked, skribe)')
  .option('--force', 'Overwrite existing directory')
  .action(async (directory, options) => {
    try {
      // Find examples directory - try multiple locations for npm install compatibility
      let examplesDir = path.resolve(__dirname, 'examples');
      
      // If examples not found at primary location, try node_modules path
      try {
        await fs.access(examplesDir);
      } catch {
        // When installed globally, examples might be in a different location
        // Try relative to node's module path
        const modulePath = path.dirname(fileURLToPath(import.meta.url));
        examplesDir = path.resolve(modulePath, 'examples');
        
        try {
          await fs.access(examplesDir);
        } catch {
          console.error('Error: Could not locate examples directory.');
          console.error('This may indicate an incomplete installation.');
          process.exit(1);
        }
      }
      
      // List examples if no directory provided
      if (!directory) {
        console.log('Available examples:\n');
        
        const examples = await fs.readdir(examplesDir, { withFileTypes: true });
        const exampleDescriptions = {
          universal: 'Foundation stack with entity-aspect-domain patterns',
          docked: 'Docker container management with docker-compose generation',
          skribe: 'Static site generator with structured content'
        };
        
        for (const entry of examples) {
          if (entry.isDirectory()) {
            const readmePath = path.join(examplesDir, entry.name, 'README.md');
            let description = exampleDescriptions[entry.name] || '';
            
            // Try to get description from README
            try {
              const readme = await fs.readFile(readmePath, 'utf-8');
              const firstLine = readme.split('\n').find(line => line.trim() && !line.startsWith('#'));
              if (firstLine) {
                description = firstLine.trim();
              }
            } catch {
              // No README or error reading it, use default
            }
            
            console.log(`  ${entry.name.padEnd(12)} ${description}`);
          }
        }
        
        console.log('\nUsage:');
        console.log('  struktur init <directory> --example <name>');
        console.log('  struktur init my-stack --example docked');
        process.exit(0);
      }

      // Default to 'universal' example if no --example specified
      const exampleName = options.example || 'universal';
      const targetDir = path.resolve(directory || exampleName);
      const sourceDir = path.join(examplesDir, exampleName);

      // Check if example exists
      try {
        await fs.access(sourceDir);
      } catch {
        console.error(`Error: Example '${exampleName}' not found.`);
        console.error('Available examples: universal, docked, skribe');
        console.error('Run "struktur init" to see all available examples.');
        process.exit(1);
      }

      // Check if target exists
      try {
        await fs.access(targetDir);
        if (!options.force) {
          console.error(`Error: Directory ${targetDir} already exists. Use --force to overwrite.`);
          process.exit(1);
        }
        // Remove existing directory contents (but keep directory itself to avoid CWD issues)
        const entries = await fs.readdir(targetDir);
        for (const entry of entries) {
          await fs.rm(path.join(targetDir, entry), { recursive: true, force: true });
        }
      } catch {
        // Directory doesn't exist, that's fine - create it below
      }

      // Copy example to target
      await copyDirectory(sourceDir, targetDir);

      console.log(`✓ Initialized ${exampleName} stack in: ${targetDir}`);
      console.log('');
      console.log('Next steps:');
      console.log(`  cd ${path.basename(targetDir)}`);

      if (exampleName === 'docked') {
        console.log('  struktur validate -c classes/ -a aspects/ -i instances/');
        console.log('  struktur generate -c classes/ -a aspects/ -i instances/ -t templates/ -o output/');
      } else {
        console.log('  struktur validate -c classes/ -i instances/');
        console.log('  struktur generate -c classes/ -i instances/ -t templates/ -o output/');
      }

      process.exit(0);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Recursively copy directory contents
 */
async function copyDirectory(src, dest) {
  // Ensure destination directory exists
  await fs.mkdir(dest, { recursive: true });
  
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

program.parse();
