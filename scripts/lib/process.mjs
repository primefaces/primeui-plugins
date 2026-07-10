import { spawn, spawnSync } from 'node:child_process';

function commandError(command, argumentsList, result) {
  const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
  return new Error(
    `${command} ${argumentsList.join(' ')} failed with exit ${result.code}${
      details === '' ? '' : `:\n${details}`
    }`
  );
}

function descendantProcessIds(rootPid) {
  const result = spawnSync('ps', ['-axo', 'pid=,ppid='], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  });
  if (result.status !== 0 || typeof result.stdout !== 'string') {
    return [];
  }
  const childrenByParent = new Map();
  for (const line of result.stdout.split('\n')) {
    const [pidText, parentPidText] = line.trim().split(/\s+/);
    const pid = Number(pidText);
    const parentPid = Number(parentPidText);
    if (!Number.isInteger(pid) || !Number.isInteger(parentPid)) {
      continue;
    }
    const children = childrenByParent.get(parentPid) ?? [];
    children.push(pid);
    childrenByParent.set(parentPid, children);
  }
  const descendants = [];
  const visit = (parentPid) => {
    for (const childPid of childrenByParent.get(parentPid) ?? []) {
      visit(childPid);
      descendants.push(childPid);
    }
  };
  visit(rootPid);
  return descendants;
}

export function hasProcessTreeInspection() {
  if (process.platform === 'win32') {
    return true;
  }
  const result = spawnSync('ps', ['-axo', 'pid=,ppid='], {
    stdio: 'ignore'
  });
  return result.status === 0;
}

export function terminateProcessTree(child, signal, knownDescendantPids = new Set()) {
  if (child.pid === undefined) {
    return false;
  }
  if (process.platform === 'win32') {
    if (signal === 'SIGKILL') {
      const result = spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore',
        windowsHide: true
      });
      if (result.status === 0) {
        return true;
      }
    }
    return child.kill(signal);
  }
  for (const pid of descendantProcessIds(child.pid)) {
    knownDescendantPids.add(pid);
  }
  let terminated = false;
  try {
    process.kill(-child.pid, signal);
    terminated = true;
  } catch (error) {
    if (error.code !== 'ESRCH') {
      throw error;
    }
  }
  for (const pid of knownDescendantPids) {
    try {
      process.kill(pid, signal);
      terminated = true;
    } catch (error) {
      if (error.code !== 'ESRCH') {
        throw error;
      }
    }
  }
  return terminated;
}

export function runCommand(
  command,
  argumentsList,
  {
    cwd,
    env,
    forcedTerminationWaitMs = 1_000,
    input,
    terminationGraceMs = 5_000,
    timeoutMs = 120_000
  } = {}
) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argumentsList, {
      cwd,
      detached: process.platform !== 'win32',
      env,
      stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe']
    });
    const stdout = [];
    const stderr = [];
    let settled = false;
    let timedOut = false;
    let forceTimer;
    let hardTimer;
    const knownDescendantPids = new Set();
    function timeoutError() {
      const details = [
        Buffer.concat(stdout).toString('utf8').trim(),
        Buffer.concat(stderr).toString('utf8').trim()
      ]
        .filter(Boolean)
        .join('\n');
      return new Error(
        `${command} ${argumentsList.join(' ')} timed out after ${timeoutMs}ms${
          details === '' ? '.' : `:\n${details}`
        }`
      );
    }
    const timer = setTimeout(() => {
      timedOut = true;
      terminateProcessTree(child, 'SIGTERM', knownDescendantPids);
      forceTimer = setTimeout(() => {
        if (!settled) {
          terminateProcessTree(child, 'SIGKILL', knownDescendantPids);
          hardTimer = setTimeout(() => {
            if (settled) {
              return;
            }
            settled = true;
            child.stdin?.destroy();
            child.stdout?.destroy();
            child.stderr?.destroy();
            reject(timeoutError());
          }, forcedTerminationWaitMs);
        }
      }, terminationGraceMs);
    }, timeoutMs);

    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', (error) => {
      clearTimeout(timer);
      clearTimeout(forceTimer);
      clearTimeout(hardTimer);
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    child.on('close', (code, signal) => {
      if (timedOut) {
        terminateProcessTree(child, 'SIGKILL', knownDescendantPids);
      }
      clearTimeout(timer);
      clearTimeout(forceTimer);
      clearTimeout(hardTimer);
      if (settled) {
        return;
      }
      settled = true;
      const result = {
        code: code ?? (signal === null ? 1 : 128),
        stderr: Buffer.concat(stderr).toString('utf8').trim(),
        stdout: Buffer.concat(stdout).toString('utf8').trim()
      };
      if (timedOut) {
        reject(timeoutError());
        return;
      }
      if (result.code !== 0) {
        reject(commandError(command, argumentsList, result));
        return;
      }
      resolve(result);
    });
    if (input !== undefined) {
      child.stdin.on('error', (error) => {
        if (error.code !== 'EPIPE') {
          child.emit('error', error);
        }
      });
      child.stdin.end(input);
    }
  });
}

export function waitForCompletion(promise, timeoutMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    promise.then(() => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}
