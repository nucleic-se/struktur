#!/usr/bin/env node

/**
 * Struktur CLI - Command-line interface for stack validation and output generation
 */

import { Command } from 'commander';
import { createStruktur, generateCanonicalWithValidation, HandlebarsAdapter } from './src/index.js';
import NunjucksAdapter from './src/adapters/nunjucks_adapter.js';
import { buildStack } from './src/build.js';
import { mergeInstances, getMergeStats } from './src/instance_merger.js';
import { loadInstancesFromDir } from './src/utils/load_instances.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveOutputPath } from './src/template_helpers/engine/index.js';

const program = new Command();

// Get the directory where CLI is installed
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

program
  .name('struktur')
  .description('Struktur - Stack validation and output generation')
  .version('0.2.3-alpha');

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

      // Simplified mode: stack directories
      if (stackDirs && stackDirs.length > 0 && !options.classes) {
        classDirs = [];
        instanceDirs = [];
        aspectDirs = [];

        for (const stackDir of stackDirs) {
          const resolvedStackDir = path.resolve(stackDir);
          const conventionalDirs = {
            classes: path.join(resolvedStackDir, 'classes'),
            instances: path.join(resolvedStackDir, 'instances'),
            aspects: path.join(resolvedStackDir, 'aspects')
          };

          const existingDirs = {};
          for (const [key, dir] of Object.entries(conventionalDirs)) {
            try {
              await fs.access(dir);
              existingDirs[key] = dir;
            } catch {}
          }

          if (!existingDirs.classes) {
            throw new Error(`Stack directory ${stackDir} requires classes/ subdirectory`);
          }

          classDirs.push(existingDirs.classes);
          if (existingDirs.instances) instanceDirs.push(existingDirs.instances);
          if (existingDirs.aspects) aspectDirs.push(existingDirs.aspects);
        }

        if (instanceDirs.length === 0) instanceDirs = [...classDirs];
      } else if (options.classes) {
        // Explicit mode
        classDirs = Array.isArray(options.classes) ? options.classes : [options.classes];
        aspectDirs = options.aspects ? (Array.isArray(options.aspects) ? options.aspects : [options.aspects]) : [];
        instanceDirs = options.instances ? (Array.isArray(options.instances) ? options.instances : [options.instances]) : classDirs;
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
      for (const dir of instanceDirs) {
        const result = await loadInstancesFromDir(dir);
        allInstances.push(...result.instances);
        allClasslessRejects.push(...result.classlessRejects);
      }

      // Warn about classless instances
      if (allClasslessRejects.length > 0 && !options.quiet) {
        console.warn(`⚠ Rejected ${allClasslessRejects.length} classless instances (missing 'class' field):`);
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
      if (options.json) {
        console.log(JSON.stringify({
          success: false,
          error: error.message
        }, null, 2));
      } else {
        console.error(`Error: ${error.message}`);
      }
      process.exit(1);
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
      const classDirs = Array.isArray(options.classes) ? options.classes : [options.classes];
      const aspectDirs = options.aspects ? (Array.isArray(options.aspects) ? options.aspects : [options.aspects]) : [];

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
        const inherits = cls.parent
          ? Array.isArray(cls.parent)
            ? cls.parent.join(', ')
            : cls.parent
          : 'none';
        console.log(`  ${cls.class} (inherits: ${inherits})`);
      }
      console.log(`\nTotal: ${classes.length} classes`);

      if (options.aspects) {
        console.log('\n=== Aspects ===');
        const aspects = struktur.aspectLoader.getAllAspects();
        for (const aspect of aspects) {
          console.log(`  ${aspect.aspect}`);
        }
        console.log(`\nTotal: ${aspects.length} aspects`);
      }
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
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
 */
function getOutputExtension(_className) {
  // Default to .txt, can be customized based on class metadata
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
          console.log(`    ${error.message}`);
        }
      }
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total:   ${summary.total}`);
  console.log(`Valid:   ${summary.valid}`);
  console.log(`Invalid: ${summary.invalid}`);
  console.log(`Errors:  ${summary.errorCount}\n`);
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

      // Simplified mode: stack directories
      if (stackDirs && stackDirs.length > 0 && !options.classes) {
        classDirs = [];
        instanceDirs = [];
        aspectDirs = [];
        templateDirs = [];

        for (const stackDir of stackDirs) {
          const resolvedStackDir = path.resolve(stackDir);
          const conventionalDirs = {
            classes: path.join(resolvedStackDir, 'classes'),
            instances: path.join(resolvedStackDir, 'instances'),
            aspects: path.join(resolvedStackDir, 'aspects'),
            templates: path.join(resolvedStackDir, 'templates')
          };

          const existingDirs = {};
          for (const [key, dir] of Object.entries(conventionalDirs)) {
            try {
              await fs.access(dir);
              existingDirs[key] = dir;
            } catch {}
          }

          if (!existingDirs.classes) {
            throw new Error(`Stack directory ${stackDir} requires classes/ subdirectory`);
          }

          classDirs.push(existingDirs.classes);
          if (existingDirs.instances) instanceDirs.push(existingDirs.instances);
          if (existingDirs.aspects) aspectDirs.push(existingDirs.aspects);
          if (existingDirs.templates) templateDirs.push(existingDirs.templates);
        }

        if (instanceDirs.length === 0) instanceDirs = [...classDirs];
      } else if (options.classes) {
        // Explicit mode
        classDirs = Array.isArray(options.classes) ? options.classes : [options.classes];
        aspectDirs = options.aspects ? (Array.isArray(options.aspects) ? options.aspects : [options.aspects]) : [];
        instanceDirs = options.instances ? (Array.isArray(options.instances) ? options.instances : [options.instances]) : classDirs;
        templateDirs = options.templates ? (Array.isArray(options.templates) ? options.templates : [options.templates]) : [];
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
      for (const dir of instanceDirs) {
        const result = await loadInstancesFromDir(dir);
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

        for (const obj of canonical.instances) {
          const templateName = `${obj.class}.hbs`;
          try {
            const rendered = await adapter.render(templateName, obj);
            const relativeOutput = `${obj.id}.${getOutputExtension(obj.class)}`;
            const safeOutput = resolveOutputPath(templateName, relativeOutput, outputDir, console);
            if (!safeOutput) {
              console.warn(`Warning: Skipping render for ${obj.id} due to unsafe output path '${relativeOutput}'`);
              continue;
            }
            await fs.writeFile(safeOutput, rendered, 'utf-8');
            console.log(`Rendered: ${safeOutput}`);
          } catch (error) {
            console.warn(`Warning: Could not render ${obj.id}: ${error.message}`);
          }
        }

        console.log(`\nRendered ${canonical.instances.length} instances to ${outputDir}`);
      } else {
        // Output canonical JSON
        let output;
        if (options.json) {
          // JSON mode: structured output with stats
          output = JSON.stringify({
            success: true,
            canonical,
            stats: {
              instances: canonical.instances?.length || 0,
              classes: Object.keys(canonical.classes_by_id || {}).length,
              aspects: Object.keys(canonical.aspects_by_id || {}).length,
              validationErrors: canonical.validation?.invalid || 0
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
      if (options.json) {
        console.log(JSON.stringify({
          success: false,
          error: error.message
        }, null, 2));
      } else {
        console.error(`Error: ${error.message}`);
      }
      process.exit(1);
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
  .option('--config <file>', 'Path to struktur.build.json config file')
  .option('--engine <name>', 'Template engine (handlebars, nunjucks)', 'handlebars')
  .option('-q, --quiet', 'Suppress output except errors')
  .option('--json', 'Output results as JSON')
  .option('--no-deterministic', 'Disable deterministic build directories (allows overwrites)')
  .option('--allow-template-collisions', 'Allow templates with same name in multiple directories (last wins)')
  .action(async (stackDirs, options) => {
    try {
      let classDirs, aspectDirs, instanceDirs, templateDirs;
      let configFromFile = {};

      // Try to load config file
      // If a single stack dir is provided and no explicit config, check for config in that directory
      let configPath = options.config;
      if (!configPath && stackDirs && stackDirs.length === 1) {
        const stackConfigPath = path.join(stackDirs[0], 'struktur.build.json');
        try {
          await fs.access(stackConfigPath);
          configPath = stackConfigPath;
        } catch {
          // Fall back to current directory
          configPath = path.join(process.cwd(), 'struktur.build.json');
        }
      } else {
        configPath = configPath || path.join(process.cwd(), 'struktur.build.json');
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
      if (configFromFile.classes) {
        configFromFile.classes = (Array.isArray(configFromFile.classes) ? configFromFile.classes : [configFromFile.classes])
          .map(p => path.resolve(configDir, p));
      }
      if (configFromFile.aspects) {
        configFromFile.aspects = (Array.isArray(configFromFile.aspects) ? configFromFile.aspects : [configFromFile.aspects])
          .map(p => path.resolve(configDir, p));
      }
      if (configFromFile.instances) {
        configFromFile.instances = (Array.isArray(configFromFile.instances) ? configFromFile.instances : [configFromFile.instances])
          .map(p => path.resolve(configDir, p));
      }
      if (configFromFile.templates) {
        configFromFile.templates = (Array.isArray(configFromFile.templates) ? configFromFile.templates : [configFromFile.templates])
          .map(p => path.resolve(configDir, p));
      }
      if (configFromFile.buildDir) {
        configFromFile.buildDir = path.resolve(configDir, configFromFile.buildDir);
      }

      // CLI flags override config file, config file overrides defaults
      if (options.classes || configFromFile.classes || (stackDirs && stackDirs.length > 0)) {
        // Explicit mode or config mode
        classDirs = options.classes 
          ? (Array.isArray(options.classes) ? options.classes : [options.classes])
          : configFromFile.classes || [];
        aspectDirs = options.aspects 
          ? (Array.isArray(options.aspects) ? options.aspects : [options.aspects])
          : configFromFile.aspects || [];
        instanceDirs = options.instances 
          ? (Array.isArray(options.instances) ? options.instances : [options.instances])
          : configFromFile.instances || [];
        templateDirs = options.templates 
          ? (Array.isArray(options.templates) ? options.templates : [options.templates])
          : configFromFile.templates || [];

        // Use build dir from CLI flag, then config, then default
        if (options.buildDir !== './build') {
          // CLI flag was explicitly set
          options.buildDir = options.buildDir;
        } else if (configFromFile.buildDir) {
          options.buildDir = configFromFile.buildDir;
        }

        // If no directories specified at all and no config, try stack-dirs mode
        if (classDirs.length === 0 && stackDirs && stackDirs.length > 0) {
          // Fall through to stack-dirs mode below
        } else if (classDirs.length === 0) {
          throw new Error('Either provide a stack directory, use -c/--classes flag, or create struktur.build.json');
        } else {
          // Default instances to classes if not specified
          if (instanceDirs.length === 0) instanceDirs = [...classDirs];
          
          // Skip the stack-dirs mode
          stackDirs = [];
        }
      }

      // Simplified mode: stack directories with conventional subdirectories
      if (stackDirs && stackDirs.length > 0 && classDirs.length === 0) {
        classDirs = [];
        instanceDirs = [];
        aspectDirs = [];
        templateDirs = [];

        for (const stackDir of stackDirs) {
          const resolvedStackDir = path.resolve(stackDir);
          
          // Auto-discover conventional subdirectories
          const conventionalDirs = {
            classes: path.join(resolvedStackDir, 'classes'),
            instances: path.join(resolvedStackDir, 'instances'),
            aspects: path.join(resolvedStackDir, 'aspects'),
            templates: path.join(resolvedStackDir, 'templates')
          };

          // Check which directories exist
          const existingDirs = {};
          for (const [key, dir] of Object.entries(conventionalDirs)) {
            try {
              await fs.access(dir);
              existingDirs[key] = dir;
            } catch {
              // Directory doesn't exist, skip
            }
          }

          if (!existingDirs.classes) {
            throw new Error(`Stack directory ${stackDir} requires classes/ subdirectory`);
          }

          classDirs.push(existingDirs.classes);
          if (existingDirs.instances) instanceDirs.push(existingDirs.instances);
          if (existingDirs.aspects) aspectDirs.push(existingDirs.aspects);
          if (existingDirs.templates) templateDirs.push(existingDirs.templates);

          if (!options.quiet && !options.json) {
            console.log(`📦 Stack: ${resolvedStackDir}`);
            console.log(`   Classes:   ${existingDirs.classes ? '✓' : '✗'}`);
            console.log(`   Instances: ${existingDirs.instances ? '✓' : '✗'}`);
            console.log(`   Aspects:   ${existingDirs.aspects ? '✓' : '✗'}`);
            console.log(`   Templates: ${existingDirs.templates ? '✓' : '✗'}`);
          }
        }

        if (instanceDirs.length === 0) instanceDirs = [...classDirs];
      }

      const result = await buildStack({
        classDirs,
        aspectDirs,
        instanceDirs,
        templateDirs,
        buildDir: options.buildDir,
        engine: options.engine,
        quiet: options.quiet || options.json,
        deterministic: options.deterministic,
        failOnCollisions: !options.allowTemplateCollisions  // Invert: default strict, opt-out permissive
      });

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
      } else if (!options.quiet) {
        console.log(`\n✨ Open ${result.buildDir}/index.html to view your stack`);
      }

      process.exit(0);
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({
          success: false,
          error: error.message
        }, null, 2));
      } else {
        console.error(`\n❌ Build failed: ${error.message}`);
      }
      process.exit(1);
    }
  });

program
  .command('init [directory]')
  .description('Initialize a new stack from example template')
  .option('--example <name>', 'Example to copy (universal, docked, skribe)')
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
      if (!directory && !options.example) {
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

      const targetDir = path.resolve(directory || 'my-stack');
      const exampleName = options.example || 'universal';
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
