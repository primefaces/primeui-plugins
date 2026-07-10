import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { stableStringify } from './contracts.mjs';
import { buildPayloadDocuments } from './payloads.mjs';
import { detectSecretKinds } from './security.mjs';
import { inspectSkillTree } from './skill-tree.mjs';

export const generatedRoots = ['.agents/plugins', '.claude-plugin', 'gemini', 'plugins'];

function comparePaths(left, right) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

async function listPhysicalFiles(rootPath, prefix = '') {
  const entries = await readdir(rootPath, { withFileTypes: true });
  entries.sort((left, right) => comparePaths(left.name, right.name));
  const files = [];

  for (const entry of entries) {
    const relativePath = prefix === '' ? entry.name : path.posix.join(prefix, entry.name);
    const absolutePath = path.join(rootPath, entry.name);
    const stats = await lstat(absolutePath);
    if (stats.isSymbolicLink()) {
      throw new Error(`Symlinks are forbidden in generated payloads: ${relativePath}`);
    }
    if (stats.isDirectory()) {
      files.push(...(await listPhysicalFiles(absolutePath, relativePath)));
      continue;
    }
    if (!stats.isFile()) {
      throw new Error(`Unsupported generated payload entry: ${relativePath}`);
    }
    files.push(relativePath);
  }

  return files;
}

async function readJsonExactly(payloadRoot, relativePath, expected, errors) {
  let content;
  try {
    content = await readFile(path.join(payloadRoot, ...relativePath.split('/')), 'utf8');
  } catch (error) {
    errors.push(`${relativePath}: missing generated JSON (${error.message}).`);
    return;
  }

  try {
    JSON.parse(content);
  } catch (error) {
    errors.push(`${relativePath}: invalid JSON (${error.message}).`);
    return;
  }

  const expectedContent = stableStringify(expected);
  if (content !== expectedContent) {
    errors.push(`${relativePath}: content does not match the locked generator contract.`);
  }
}

function validateSkillPathPolicy(name, records, errors) {
  const paths = new Set(records.map((record) => record.path));
  if (!paths.has('SKILL.md')) {
    errors.push(`${name}: copied skill tree must contain SKILL.md.`);
  }

  for (const record of records) {
    const allowed = record.path === 'SKILL.md' || /^references\/[A-Za-z0-9._-]+\.md$/.test(record.path);
    if (!allowed) {
      errors.push(`${name}: unexpected copied skill file ${record.path}.`);
    }
    if (
      /(?:^|\/)(?:api|components?|docs?|examples?|generated)(?:\/|$)/i.test(record.path) ||
      /^(?:mcp-data|manifest)\.json$/i.test(path.posix.basename(record.path))
    ) {
      errors.push(`${name}: documentation, example, API, or generated data file is forbidden (${record.path}).`);
    }
  }
}

function markdownLinkTargets(content) {
  const targets = [];
  const pattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of content.matchAll(pattern)) {
    let target = match[1].trim();
    if (target.startsWith('<') && target.endsWith('>')) {
      target = target.slice(1, -1);
    } else {
      target = target.split(/\s+["']/u, 1)[0];
    }
    targets.push(target);
  }
  return targets;
}

async function validateSkillContent(name, skillRoot, records, errors) {
  const paths = new Set(records.map((record) => record.path));
  const foreignLibraries = {
    primeng: ['primevue', 'primereact'],
    primereact: ['primevue', 'primeng'],
    primevue: ['primeng', 'primereact']
  }[name];

  for (const record of records) {
    const absolutePath = path.join(skillRoot, ...record.path.split('/'));
    const content = await readFile(absolutePath, 'utf8');

    for (const foreignLibrary of foreignLibraries) {
      const scopedPackage = `@${foreignLibrary}/`;
      const runtimeImport = new RegExp(
        `(?:^|[^@A-Za-z0-9_-])${foreignLibrary}/[A-Za-z0-9_.-]`,
        'u'
      );
      if (content.includes(scopedPackage) || runtimeImport.test(content)) {
        errors.push(`${name}/${record.path}: foreign library package guidance is forbidden (${foreignLibrary}).`);
      }
    }

    if (record.path === 'SKILL.md') {
      const frontmatterMatch = /^---\n([\s\S]*?)\n---\n/u.exec(content);
      if (!frontmatterMatch || !new RegExp(`^name: ${name}$`, 'm').test(frontmatterMatch[1])) {
        errors.push(`${name}/SKILL.md: frontmatter name must equal ${name}.`);
      }
    }

    if (!record.path.endsWith('.md')) {
      continue;
    }
    for (const rawTarget of markdownLinkTargets(content)) {
      if (rawTarget === '' || rawTarget.startsWith('#')) {
        continue;
      }
      if (/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(rawTarget)) {
        if (rawTarget.startsWith('file:')) {
          errors.push(`${name}/${record.path}: file links are forbidden.`);
        }
        continue;
      }
      if (rawTarget.startsWith('/')) {
        errors.push(`${name}/${record.path}: absolute Markdown link is forbidden (${rawTarget}).`);
        continue;
      }

      let decodedTarget;
      try {
        decodedTarget = decodeURIComponent(rawTarget.split(/[?#]/u, 1)[0]);
      } catch {
        errors.push(`${name}/${record.path}: malformed relative link (${rawTarget}).`);
        continue;
      }
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(record.path), decodedTarget));
      if (resolved === '..' || resolved.startsWith('../') || !paths.has(resolved)) {
        errors.push(`${name}/${record.path}: broken or escaping relative link (${rawTarget}).`);
      }
    }
  }
}

async function compareSkillCopies(name, leftRoot, rightRoot, records, errors) {
  for (const record of records) {
    const relativeSegments = record.path.split('/');
    const [left, right] = await Promise.all([
      readFile(path.join(leftRoot, ...relativeSegments)),
      readFile(path.join(rightRoot, ...relativeSegments))
    ]);
    if (!left.equals(right)) {
      errors.push(`${name}/${record.path}: plugin and Gemini skill copies differ.`);
    }
  }
}

function publicBoundaryErrors(relativePath, content) {
  const errors = [];
  const checks = [
    [/\b[A-Z]{3,12}-[0-9]{1,6}\b/u, 'internal-looking work item identifier'],
    [
      /\b(?:implementation|release) (?:session|status|tracker)\b/iu,
      'internal process terminology'
    ],
    [/(?:^|[\s"'`])\/(?:Users|home|private|var\/folders)\//u, 'local absolute path'],
    [/[A-Za-z]:\\(?:Users|Documents)\\/u, 'local Windows path']
  ];

  for (const [pattern, label] of checks) {
    if (pattern.test(content)) {
      errors.push(`${relativePath}: contains ${label}.`);
    }
  }
  for (const label of detectSecretKinds(content)) {
    errors.push(`${relativePath}: possible ${label}.`);
  }
  return errors;
}

export async function validateGeneratedPayload(payloadRoot, pluginsConfig, lockConfig) {
  const errors = [];
  const locks = new Map(lockConfig.sources.map((lock) => [lock.name, lock]));
  const documents = buildPayloadDocuments(pluginsConfig, lockConfig);
  const expectedFiles = new Set(documents.keys());

  for (const [relativePath, expected] of documents) {
    await readJsonExactly(payloadRoot, relativePath, expected, errors);
  }

  for (const plugin of pluginsConfig.plugins) {
    const lock = locks.get(plugin.name);
    const pluginSkillRoot = path.join(payloadRoot, plugin.outputs.plugin, 'skills', plugin.name);
    const geminiSkillRoot = path.join(payloadRoot, plugin.outputs.gemini, 'skills', plugin.name);
    let pluginInspection;
    let geminiInspection;
    try {
      [pluginInspection, geminiInspection] = await Promise.all([
        inspectSkillTree(pluginSkillRoot),
        inspectSkillTree(geminiSkillRoot)
      ]);
    } catch (error) {
      errors.push(`${plugin.name}: unable to inspect copied skill trees (${error.message}).`);
      continue;
    }

    if (pluginInspection.hash !== lock.source.skillHash) {
      errors.push(
        `${plugin.name}: plugin skill hash ${pluginInspection.hash} does not match ${lock.source.skillHash}.`
      );
    }
    if (geminiInspection.hash !== lock.source.skillHash) {
      errors.push(
        `${plugin.name}: Gemini skill hash ${geminiInspection.hash} does not match ${lock.source.skillHash}.`
      );
    }

    const pluginPaths = pluginInspection.records.map((record) => record.path);
    const geminiPaths = geminiInspection.records.map((record) => record.path);
    if (
      pluginPaths.length !== geminiPaths.length ||
      pluginPaths.some((recordPath, index) => recordPath !== geminiPaths[index])
    ) {
      errors.push(`${plugin.name}: plugin and Gemini skill file inventories differ.`);
    } else {
      await compareSkillCopies(
        plugin.name,
        pluginSkillRoot,
        geminiSkillRoot,
        pluginInspection.records,
        errors
      );
    }

    validateSkillPathPolicy(plugin.name, pluginInspection.records, errors);
    await validateSkillContent(plugin.name, pluginSkillRoot, pluginInspection.records, errors);

    for (const record of pluginInspection.records) {
      expectedFiles.add(`${plugin.outputs.plugin}/skills/${plugin.name}/${record.path}`);
      expectedFiles.add(`${plugin.outputs.gemini}/skills/${plugin.name}/${record.path}`);
    }
  }

  const actualFiles = [];
  for (const generatedRoot of generatedRoots) {
    try {
      const rootFiles = await listPhysicalFiles(path.join(payloadRoot, ...generatedRoot.split('/')));
      actualFiles.push(...rootFiles.map((file) => `${generatedRoot}/${file}`));
    } catch (error) {
      errors.push(`${generatedRoot}: invalid or missing generated root (${error.message}).`);
    }
  }
  actualFiles.sort(comparePaths);

  for (const relativePath of actualFiles) {
    if (!expectedFiles.has(relativePath)) {
      errors.push(`${relativePath}: unexpected generated payload file.`);
    }
    const content = await readFile(path.join(payloadRoot, ...relativePath.split('/')), 'utf8');
    errors.push(...publicBoundaryErrors(relativePath, content));
  }
  for (const relativePath of [...expectedFiles].sort(comparePaths)) {
    if (!actualFiles.includes(relativePath)) {
      errors.push(`${relativePath}: expected generated payload file is missing.`);
    }
  }

  return errors;
}
