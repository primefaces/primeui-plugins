import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { libraryContracts, libraryOrder } from './contracts.mjs';
import { repositoryRoot } from './repository.mjs';
import { inspectSkillTree } from './skill-tree.mjs';

export const mcpTools = [
  'list',
  'search',
  'get_component',
  'get_guide',
  'get_example',
  'get_setup',
  'validate_usage',
  'version'
];

const baseCoverage = [
  'setup',
  'known-component',
  'source-backed-behavior',
  'discovery',
  'forms',
  'data-table',
  'theming',
  'accessibility-icons',
  'migration',
  'audit',
  'invalid-api-repair',
  'missing-mcp',
  'duplicate-mcp-plugin'
];
const libraryCoverage = {
  primevue: baseCoverage,
  primeng: [...baseCoverage, 'standalone-setup', 'unsupported-ngmodule'],
  primereact: [
    ...baseCoverage,
    'styled',
    'tailwind',
    'primitive',
    'headless',
    'hooks',
    'ambiguous-mode'
  ]
};
const budgetCeilings = {
  'known-component': 2,
  'source-backed-behavior': 3,
  discovery: 4,
  setup: 3
};
const validationOutcomes = new Set(['ambiguous', 'issue-then-pass', 'not-run', 'pass', 'unsupported']);
const reactModes = new Set(['headless', 'hooks', 'primitive', 'styled', 'tailwind']);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, required, optional, location, errors) {
  if (!isObject(value)) {
    errors.push(`${location} must be an object.`);
    return false;
  }
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${location}.${key} is not allowed.`);
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) errors.push(`${location}.${key} is required.`);
  }
  return true;
}

function stringList(value, location, errors, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    errors.push(`${location} must be ${allowEmpty ? 'an' : 'a non-empty'} array.`);
    return [];
  }
  for (const [index, item] of value.entries()) {
    if (typeof item !== 'string' || item.length === 0) errors.push(`${location}[${index}] must be a non-empty string.`);
  }
  if (new Set(value).size !== value.length) errors.push(`${location} must not contain duplicates.`);
  return value;
}

function parseRouterRoutes(content) {
  return Object.fromEntries(
    [...content.matchAll(/^- `([^`]+)`: `([^`]+)`/gmu)].map((match) => [match[1], match[2]])
  );
}

function validateScenario(scenario, library, skills, skillContents, routes, errors) {
  const location = `${library}:${scenario?.id ?? '<unknown>'}`;
  if (!exactKeys(
    scenario,
    [
      'allowedMcpCalls',
      'budgetClass',
      'coverage',
      'expectedSkill',
      'expectedValidation',
      'forbiddenMcpCalls',
      'id',
      'library',
      'maxCallCount',
      'prompt',
      'requiredEvidence',
      'route',
      'trace'
    ],
    ['ambiguityExpectation', 'doctorExpectation', 'environment', 'mode', 'modeExpectation'],
    location,
    errors
  )) return;

  if (!new RegExp(`^${library}-[a-z0-9]+(?:-[a-z0-9]+)*$`).test(scenario.id)) errors.push(`${location}.id must be stable and library-prefixed.`);
  if (scenario.library !== library) errors.push(`${location}.library must equal ${library}.`);
  if (typeof scenario.prompt !== 'string' || scenario.prompt.length < 20 || /expected answer|respond with/i.test(scenario.prompt)) errors.push(`${location}.prompt must be a useful provider-neutral task without expected prose.`);
  const coverage = stringList(scenario.coverage, `${location}.coverage`, errors);
  stringList(scenario.requiredEvidence, `${location}.requiredEvidence`, errors);
  const allowed = stringList(scenario.allowedMcpCalls, `${location}.allowedMcpCalls`, errors, { allowEmpty: true });
  const forbidden = stringList(scenario.forbiddenMcpCalls, `${location}.forbiddenMcpCalls`, errors);
  for (const tool of [...allowed, ...forbidden]) if (!mcpTools.includes(tool)) errors.push(`${location}: unknown MCP call ${tool}.`);
  for (const tool of allowed) if (forbidden.includes(tool)) errors.push(`${location}: ${tool} is both allowed and forbidden.`);
  if (new Set([...allowed, ...forbidden]).size !== mcpTools.length || mcpTools.some((tool) => !allowed.includes(tool) && !forbidden.includes(tool))) errors.push(`${location}: allowed and forbidden calls must partition the exact eight-tool inventory.`);
  if (!forbidden.includes('version')) errors.push(`${location}: routine version must be forbidden.`);
  if (!skills.has(scenario.expectedSkill)) errors.push(`${location}: expectedSkill is unknown or foreign.`);
  if (routes[scenario.route] !== scenario.expectedSkill) errors.push(`${location}: expectedSkill is not the router's smallest route for ${scenario.route}.`);
  const skillContent = skillContents.get(scenario.expectedSkill) ?? '';
  for (const call of scenario.allowedMcpCalls ?? []) {
    if (!skillContent.includes(`\`${call}\``)) errors.push(`${location}: allowed call ${call} is not grounded in the selected focused skill.`);
  }
  if (!skillContent.includes('`version`')) errors.push(`${location}: selected focused skill lacks the routine-version policy.`);

  if (!Number.isSafeInteger(scenario.maxCallCount) || scenario.maxCallCount < 0) errors.push(`${location}.maxCallCount must be a non-negative integer.`);
  if (Object.hasOwn(budgetCeilings, scenario.budgetClass) && scenario.maxCallCount > budgetCeilings[scenario.budgetClass]) errors.push(`${location}: ${scenario.budgetClass} exceeds its ${budgetCeilings[scenario.budgetClass]}-call ceiling.`);
  if (!Array.isArray(scenario.trace)) errors.push(`${location}.trace must be an array.`);
  const trace = Array.isArray(scenario.trace) ? scenario.trace : [];
  if (trace.length > scenario.maxCallCount) errors.push(`${location}: trace exceeds maxCallCount.`);

  for (const [index, call] of trace.entries()) {
    const callLocation = `${location}.trace[${index}]`;
    if (!exactKeys(call, ['name', 'result', 'server'], ['mode'], callLocation, errors)) continue;
    if (call.server !== library) errors.push(`${callLocation}.server must equal the selected library MCP identity ${library}.`);
    if (!allowed.includes(call.name)) errors.push(`${callLocation}.name is not allowed.`);
    if (forbidden.includes(call.name)) errors.push(`${callLocation}.name is forbidden.`);
    if (!mcpTools.includes(call.name)) errors.push(`${callLocation}.name is not one of the eight MCP tools.`);
  }

  if (!exactKeys(scenario.expectedValidation, ['calls', 'outcome', 'repeatOnlyAfterIssue'], [], `${location}.expectedValidation`, errors)) return;
  const validationCalls = trace.filter((call) => call?.name === 'validate_usage');
  if (!validationOutcomes.has(scenario.expectedValidation.outcome)) errors.push(`${location}.expectedValidation.outcome is invalid.`);
  if (scenario.expectedValidation.calls !== validationCalls.length) errors.push(`${location}: validation call count does not match trace.`);
  if (scenario.expectedValidation.outcome === 'pass') {
    if (validationCalls.length !== 1 || trace.at(-1)?.name !== 'validate_usage' || trace.at(-1)?.result !== 'pass') errors.push(`${location}: pass requires one final successful validate_usage call.`);
  } else if (scenario.expectedValidation.outcome === 'issue-then-pass') {
    if (validationCalls.length !== 2 || validationCalls[0]?.result !== 'issue' || validationCalls[1]?.result !== 'pass' || trace.at(-1)?.name !== 'validate_usage' || scenario.expectedValidation.repeatOnlyAfterIssue !== true) errors.push(`${location}: invalid-API repair must validate issue, repair, then validate final code once.`);
  } else if (validationCalls.length !== 0) errors.push(`${location}: ${scenario.expectedValidation.outcome} must not call validate_usage.`);

  if (scenario.doctorExpectation !== undefined) {
    const command = `primeui doctor --json --tool <tool> --library ${library}`;
    if (!exactKeys(scenario.doctorExpectation, ['command', 'required'], [], `${location}.doctorExpectation`, errors) || scenario.doctorExpectation.required !== true || scenario.doctorExpectation.command !== command || trace.length !== 0) errors.push(`${location}: doctor recovery must use exactly ${command} with no MCP calls.`);
    if (!skillContent.includes(command)) errors.push(`${location}: doctor command is not grounded in the selected focused skill.`);
  }
  if (coverage.includes('missing-mcp') || coverage.includes('duplicate-mcp-plugin')) {
    if (scenario.doctorExpectation?.required !== true) errors.push(`${location}: missing/duplicate MCP coverage requires doctorExpectation.`);
  }

  if (library === 'primereact') {
    if (scenario.mode === null) {
      if (trace.length !== 0 || scenario.modeExpectation !== 'no-call-until-resolved' || scenario.ambiguityExpectation !== 'structured-no-hard-error') errors.push(`${location}: ambiguous PrimeReact mode must produce structured ambiguity and no calls.`);
    } else {
      if (!reactModes.has(scenario.mode) || scenario.modeExpectation !== 'selected-before-calls') errors.push(`${location}: PrimeReact mode must be source-backed and selected before calls.`);
      for (const call of trace) if (call.mode !== scenario.mode) errors.push(`${location}: cross-mode call leakage detected.`);
    }
  } else {
    if (Object.hasOwn(scenario, 'mode') || trace.some((call) => Object.hasOwn(call, 'mode'))) errors.push(`${location}: non-React scenarios must not carry mode contracts.`);
  }
}

export async function validateEvaluationRepository(root = repositoryRoot, overrides = {}) {
  const errors = [];
  const readJson = async (relativePath) => JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
  const config = overrides.config ?? await readJson('config/plugins.json');
  const lock = overrides.lock ?? await readJson('config/sources.lock.json');
  const libraries = overrides.libraries ?? Object.fromEntries(await Promise.all(
    libraryOrder.map(async (library) => [library, await readJson(`evaluations/${library}.json`)])
  ));
  const allIds = new Set();

  for (const library of libraryOrder) {
    const fixture = libraries[library];
    const plugin = config.plugins.find((entry) => entry.name === library);
    const locked = lock.sources.find((entry) => entry.name === library);
    const provenance = overrides.provenance?.[library] ?? await readJson(`plugins/${library}/provenance.json`);
    const mcpManifest = overrides.mcpManifests?.[library] ?? await readJson(`plugins/${library}/.mcp.json`);
    const requiredTop = ['$schema', 'library', 'mcp', 'scenarios', 'schemaVersion'];
    if (!exactKeys(fixture, requiredTop, [], `${library} fixture`, errors)) continue;
    if (fixture.$schema !== './schema.json' || fixture.schemaVersion !== 1 || fixture.library !== library) errors.push(`${library}: invalid schema reference, schemaVersion, or library identity.`);
    if (!exactKeys(fixture.mcp, ['package', 'server', 'tools'], [], `${library}.mcp`, errors)) continue;
    if (fixture.mcp.package !== libraryContracts[library].mcpPackage || fixture.mcp.server !== libraryContracts[library].serverName || JSON.stringify(fixture.mcp.tools) !== JSON.stringify(mcpTools)) errors.push(`${library}: fixture MCP identity/tool inventory is stale.`);
    if (!Array.isArray(fixture.scenarios) || fixture.scenarios.length < 10) errors.push(`${library}: at least 10 scenarios are required.`);

    const skillIds = plugin.skills.map((skill) => skill.id);
    if (skillIds.length !== 7 || new Set(skillIds).size !== 7) errors.push(`${library}: exact seven-skill inventory required.`);
    const skills = new Set(skillIds);
    const routerContent = await readFile(path.join(root, plugin.skills[0].sourcePath, 'SKILL.md'), 'utf8');
    const skillContents = new Map(await Promise.all(plugin.skills.map(async (skill) => [
      skill.id,
      await readFile(path.join(root, skill.sourcePath, 'SKILL.md'), 'utf8')
    ])));
    const routes = parseRouterRoutes(routerContent);
    const covered = new Set();
    for (const scenario of fixture.scenarios ?? []) {
      if (allIds.has(scenario.id)) errors.push(`${scenario.id}: duplicate scenario id.`);
      allIds.add(scenario.id);
      for (const tag of scenario.coverage ?? []) covered.add(tag);
      validateScenario(scenario, library, skills, skillContents, routes, errors);
    }
    for (const tag of libraryCoverage[library]) if (!covered.has(tag)) errors.push(`${library}: missing release-critical coverage ${tag}.`);

    if (JSON.stringify(provenance.skills.map(({ id }) => id)) !== JSON.stringify(skillIds) || provenance.name !== library || provenance.schemaVersion !== 2) errors.push(`${library}: generated provenance skill inventory is stale or foreign.`);
    if (provenance.mcp.package !== locked.mcp.package || provenance.mcp.version !== locked.mcp.version) errors.push(`${library}: generated provenance MCP pin is stale.`);
    const servers = Object.entries(mcpManifest.mcpServers ?? {});
    if (servers.length !== 1 || servers[0][0] !== library || servers[0][1].command !== 'npx' || JSON.stringify(servers[0][1].args) !== JSON.stringify(['-y', `${locked.mcp.package}@${locked.mcp.version}`])) errors.push(`${library}: generated payload must expose one exact selected-library MCP server.`);

    for (const [index, skill] of plugin.skills.entries()) {
      const lockedSkill = locked.skills[index];
      const generatedSkill = provenance.skills[index];
      const canonical = await inspectSkillTree(path.join(root, skill.sourcePath));
      const generated = await inspectSkillTree(path.join(root, 'plugins', library, 'skills', skill.directory));
      if (canonical.hash !== lockedSkill.source.treeHash || generated.hash !== canonical.hash || generatedSkill.source.treeHash !== canonical.hash || generatedSkill.source.path !== skill.sourcePath || generatedSkill.owner !== library) errors.push(`${library}:${skill.id}: canonical/generated hash or provenance integrity failure.`);
    }
  }

  return errors;
}
