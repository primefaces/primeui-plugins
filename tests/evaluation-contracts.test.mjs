import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { validateEvaluationRepository } from '../scripts/lib/evaluation-contracts.mjs';
import { repositoryRoot } from '../scripts/lib/repository.mjs';

const readJson = async (relativePath) => JSON.parse(await readFile(path.join(repositoryRoot, relativePath), 'utf8'));
const baseLibraries = Object.fromEntries(await Promise.all(
  ['primevue', 'primeng', 'primereact'].map(async (library) => [library, await readJson(`evaluations/${library}.json`)])
));
const baseProvenance = Object.fromEntries(await Promise.all(
  ['primevue', 'primeng', 'primereact'].map(async (library) => [library, await readJson(`plugins/${library}/provenance.json`)])
));
const clone = (value) => structuredClone(value);

test('public prompt libraries pass the deterministic no-model evaluator', async () => {
  assert.deepEqual(await validateEvaluationRepository(), []);
});

const failures = [
  ['malformed fixture schema', /prompt is required/, (libraries) => { delete libraries.primevue.scenarios[0].prompt; }],
  ['unknown foreign skill', /expectedSkill is unknown or foreign/, (libraries) => { libraries.primevue.scenarios[0].expectedSkill = 'primeng-setup-installation'; }],
  ['missing release-critical coverage', /missing release-critical coverage forms/, (libraries) => { libraries.primevue.scenarios = libraries.primevue.scenarios.filter((scenario) => !scenario.coverage.includes('forms')); }],
  ['routine version allowance', /routine version must be forbidden/, (libraries) => { libraries.primevue.scenarios[0].forbiddenMcpCalls = libraries.primevue.scenarios[0].forbiddenMcpCalls.filter((call) => call !== 'version'); }],
  ['over-budget trace', /exceeds its 2-call ceiling|trace exceeds maxCallCount/, (libraries) => { libraries.primevue.scenarios[1].maxCallCount = 3; libraries.primevue.scenarios[1].trace.push({name: 'get_component', result: 'source-backed', server: 'primevue'}); }],
  ['wrong final validation behavior', /pass requires one final successful validate_usage call/, (libraries) => { libraries.primevue.scenarios[1].trace.reverse(); }],
  ['wrong doctor command', /doctor recovery must use exactly/, (libraries) => { libraries.primeng.scenarios.find((scenario) => scenario.coverage.includes('missing-mcp')).doctorExpectation.command = 'primeui ai doctor'; }],
  ['cross-library leakage', /selected library MCP identity/, (libraries) => { libraries.primeng.scenarios[2].trace[0].server = 'primevue'; }],
  ['PrimeReact cross-mode leakage', /cross-mode call leakage/, (libraries) => { libraries.primereact.scenarios[0].trace[0].mode = 'tailwind'; }],
  ['wrong MCP tool inventory', /fixture MCP identity\/tool inventory is stale/, (libraries) => { libraries.primevue.mcp.tools = libraries.primevue.mcp.tools.slice(0, 7); }]
];

for (const [name, pattern, mutate] of failures) {
  test(`evaluator rejects ${name}`, async () => {
    const libraries = clone(baseLibraries);
    mutate(libraries);
    assert.match((await validateEvaluationRepository(repositoryRoot, { libraries })).join('\n'), pattern);
  });
}

test('evaluator rejects stale generated provenance hashes', async () => {
  const provenance = clone(baseProvenance);
  provenance.primereact.skills[0].source.treeHash = `sha256:${'0'.repeat(64)}`;
  assert.match((await validateEvaluationRepository(repositoryRoot, { provenance })).join('\n'), /hash or provenance integrity failure/);
});

test('evaluator rejects a wrong selected-library MCP server', async () => {
  const mcpManifests = {
    primevue: await readJson('plugins/primevue/.mcp.json'),
    primeng: await readJson('plugins/primeng/.mcp.json'),
    primereact: await readJson('plugins/primereact/.mcp.json')
  };
  mcpManifests.primevue.mcpServers = { primeng: mcpManifests.primevue.mcpServers.primevue };
  assert.match((await validateEvaluationRepository(repositoryRoot, { mcpManifests })).join('\n'), /one exact selected-library MCP server/);
});
