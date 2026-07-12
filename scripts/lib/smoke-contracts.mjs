export const expectedMcpTools = [
  'get_component',
  'get_example',
  'get_guide',
  'get_setup',
  'list',
  'search',
  'validate_usage',
  'version'
];

export const libraryNames = ['primevue', 'primeng', 'primereact'];

export function configuredSkillContracts(plugin, lock) {
  const lockedSkills = new Map(lock.skills.map((skill) => [skill.id, skill]));
  return plugin.skills.map((skill) => {
    const locked = lockedSkills.get(skill.id);
    return {
      directory: skill.directory,
      id: skill.id,
      name: skill.name,
      order: skill.order,
      owner: skill.owner,
      treeHash: locked.source.treeHash
    };
  });
}

export async function assertPhysicalSkillInventory(skillsRoot, expectedSkills, label) {
  const entries = await readdir(skillsRoot, { withFileTypes: true });
  const actualDirectories = entries
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    .map((entry) => entry.name);
  const expectedDirectories = expectedSkills.map((skill) => skill.directory);
  if (JSON.stringify(actualDirectories.sort()) !== JSON.stringify([...expectedDirectories].sort())) {
    throw new Error(`${label}: skill inventory differs; expected ${expectedDirectories.join(', ')}, received ${actualDirectories.join(', ')}.`);
  }
  if (entries.length !== expectedSkills.length) {
    throw new Error(`${label}: skill root contains non-skill or symbolic entries.`);
  }

  for (const skill of expectedSkills) {
    const skillRoot = path.join(skillsRoot, skill.directory);
    const inspection = await inspectSkillTree(skillRoot);
    if (inspection.hash !== skill.treeHash) {
      throw new Error(`${label}/${skill.id}: skill hash does not match.`);
    }
    const content = await readFile(path.join(skillRoot, 'SKILL.md'), 'utf8');
    if (!new RegExp(`^name: ${skill.name}$`, 'm').test(content)) {
      throw new Error(`${label}/${skill.id}: skill frontmatter name does not match.`);
    }
  }
  return expectedSkills.map((skill) => skill.directory);
}

export const usageContracts = {
  primeng: {
    validCode: '<p-button label="Save" severity="success" [disabled]="saving" />',
    invalidCode: '<p-button label="Save" [madeUp]="true" />'
  },
  primereact: {
    validCode: [
      "import { Button } from 'primereact/button';",
      '',
      'export function SaveAction() {',
      '  return <Button severity="success">Save</Button>;',
      '}'
    ].join('\n'),
    invalidCode: '<Button severity="success" madeUp>Save</Button>'
  },
  primevue: {
    validCode: '<Button label="Save" severity="success" :disabled="saving" />',
    invalidCode: '<Button label="Save" madeUp />'
  }
};
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { inspectSkillTree } from './skill-tree.mjs';
