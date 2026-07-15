import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { repositoryRoot } from '../scripts/lib/repository.mjs';

const expectedSkills = ['primereact-router', 'primereact-component-implementation', 'primereact-setup-installation', 'primereact-theming-customization', 'primereact-accessibility-icons', 'primereact-audit-troubleshooting'];
const routes = { accessibility: 'primereact-accessibility-icons', audit: 'primereact-audit-troubleshooting', component: 'primereact-component-implementation', setup: 'primereact-setup-installation', theming: 'primereact-theming-customization' };
const readJson = async (relativePath) => JSON.parse(await readFile(path.join(repositoryRoot, relativePath), 'utf8'));
const readSkill = async (name) => readFile(path.join(repositoryRoot, 'skills', 'primereact', name, 'SKILL.md'), 'utf8');
const [config, scenarios] = await Promise.all([readJson('config/plugins.json'), readJson('tests/fixtures/primereact-scenarios.json')]);
const primereact = config.plugins.find((plugin) => plugin.name === 'primereact');
const skillContents = new Map(await Promise.all(expectedSkills.map(async (name) => [name, await readSkill(name)])));

test('PrimeReact declares the exact ordered six-skill identity set', () => {
  assert.deepEqual(primereact.skills, expectedSkills.map((name, order) => ({ directory: name, id: name, name, order, owner: 'primereact', sourcePath: `skills/primereact/${name}` })));
});

test('the PrimeReact router selects exactly one smallest focused skill', () => {
  const router = skillContents.get('primereact-router');
  const parsed = Object.fromEntries([...router.matchAll(/^- `([^`]+)`: `([^`]+)`/gmu)].map((match) => [match[1], match[2]]));
  assert.deepEqual(parsed, routes);
  for (const scenario of scenarios) assert.equal(parsed[scenario.route], routes[scenario.route], scenario.id);
  assert.match(router, /Select exactly one smallest focused skill/);
  assert.match(router, /before any MCP call that accepts `mode`/);
});

test('deterministic PrimeReact scenarios enforce mode-scoped routing and budgets', () => {
  for (const scenario of scenarios) {
    const content = skillContents.get(routes[scenario.route]);
    const sequence = scenario.calls.length === 0 ? 'none' : scenario.calls.join(' -> ');
    assert.ok(content.split('\n').includes(`- \`${scenario.workflow}\`: \`${sequence}\`; maximum ${scenario.maxCalls}.`), scenario.id);
    assert.ok(scenario.calls.length <= scenario.maxCalls, scenario.id);
    assert.ok(scenario.forbiddenCalls.includes('version'), scenario.id);
    for (const call of scenario.calls) {
      assert.ok(scenario.allowedCalls.includes(call), `${scenario.id}: allowed ${call}`);
      assert.ok(!scenario.forbiddenCalls.includes(call), `${scenario.id}: forbidden ${call}`);
      assert.equal(scenario.modeSelectedBeforeCalls, true, `${scenario.id}: mode before calls`);
    }
    assert.equal(scenario.calls.filter((call) => call === 'validate_usage').length, scenario.validationCalls, scenario.id);
    if (scenario.validationCalls === 1) assert.equal(scenario.calls.at(-1), 'validate_usage', scenario.id);
    if (scenario.validationCalls > 1) {
      assert.equal(scenario.repeatOnlyAfterIssue, true, scenario.id);
      assert.match(content, /After a reported issue|after it reports an issue/);
    }
    if (scenario.doctor) assert.match(content, /primeui doctor --json --tool <tool> --library primereact/);
    assert.notEqual(scenario.crossModeForbidden, false, scenario.id);
  }
});

test('mode isolation, setup routing, hooks, and ambiguity boundaries are explicit', () => {
  const all = [...skillContents.values()].join('\n');
  const router = skillContents.get('primereact-router');
  const component = skillContents.get('primereact-component-implementation');
  const setup = skillContents.get('primereact-setup-installation');
  assert.match(router, /`styled`, `tailwind`, `primitive`, or `headless`/);
  assert.match(router, /standalone hook request may select the advertised `hooks` mode only/);
  assert.match(router, /ask one short clarification or return structured ambiguity/);
  assert.match(router, /Dynamic imports and wrappers.*not hard errors/s);
  assert.match(component, /Never reconstruct a hook from headless or component APIs/);
  assert.match(setup, /selected `mode` and documented environment/);
  assert.match(setup, /no invented alias, URL, package, provider, or fallback setup/);
  assert.doesNotMatch(all, /primeui ai doctor|--variant <mode>|--library primevue|--library primeng/);
  for (const [name, content] of skillContents) {
    assert.match(content, new RegExp(`^name: ${name}$`, 'mu'));
    if (name !== 'primereact-router') assert.match(content, /Do not call `version` routinely/);
  }
});
