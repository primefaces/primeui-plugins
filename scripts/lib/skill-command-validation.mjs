import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { inspectSkillTree } from './skill-tree.mjs';

export const staleDoctorCommand = 'primeui ai doctor';

export async function validateSkillDoctorCommands(repositoryRoot, pluginsConfig) {
  const errors = [];

  for (const plugin of pluginsConfig.plugins) {
    const surfaces = plugin.skills.flatMap((skill) => [
      ['canonical', skill.id, path.join(repositoryRoot, ...skill.sourcePath.split('/'))],
      ['generated', skill.id, path.join(repositoryRoot, plugin.outputs.plugin, 'skills', skill.directory)]
    ]);

    for (const [surface, skillId, skillRoot] of surfaces) {
      const inspection = await inspectSkillTree(skillRoot);
      for (const record of inspection.records) {
        const content = await readFile(path.join(skillRoot, ...record.path.split('/')), 'utf8');
        if (content.includes(staleDoctorCommand)) {
          errors.push(
            `${surface}/${plugin.name}/${skillId}/${record.path}: stale PrimeUI doctor command is forbidden.`
          );
        }
      }
    }
  }

  return errors;
}
