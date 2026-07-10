import { spawnSync } from 'node:child_process';
import { repositoryRoot } from './lib/repository.mjs';

function gitStatus() {
  const result = spawnSync(
    'git',
    ['status', '--porcelain=v1', '-z', '--untracked-files=all'],
    {
      cwd: repositoryRoot,
      encoding: 'buffer'
    }
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }

  return result.stdout;
}

const before = gitStatus();
const check = spawnSync(process.execPath, ['scripts/check.mjs'], {
  cwd: repositoryRoot,
  stdio: 'inherit'
});

if (check.error) {
  throw check.error;
}
if (check.status !== 0) {
  process.exit(check.status ?? 1);
}

const after = gitStatus();
if (!before.equals(after)) {
  console.error('Generation-free clean-diff check failed: repository state changed while validation ran.');
  process.exit(1);
}

console.log('Generation-free clean-diff check passed; exact Git status was preserved.');
