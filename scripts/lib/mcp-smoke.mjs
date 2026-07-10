import { spawn } from 'node:child_process';
import readline from 'node:readline';
import { terminateProcessTree, waitForCompletion } from './process.mjs';
import { expectedMcpTools } from './smoke-contracts.mjs';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

class JsonRpcStdioClient {
  constructor(command, argumentsList, options) {
    this.child = spawn(command, argumentsList, {
      cwd: options.cwd,
      detached: process.platform !== 'win32',
      env: options.env,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    this.nextId = 1;
    this.pending = new Map();
    this.stderr = [];
    this.closed = false;
    this.knownDescendantPids = new Set();
    this.exitPromise = new Promise((resolve) => {
      this.resolveExit = resolve;
    });
    this.child.stderr.on('data', (chunk) => this.stderr.push(chunk));
    this.child.on('error', (error) => this.rejectAll(error));
    this.child.on('close', (code, signal) => {
      this.closed = true;
      this.resolveExit();
      this.rejectAll(
        new Error(
          `MCP process closed before the request completed (code=${code}, signal=${signal}).\n${this.stderrText()}`
        )
      );
    });
    this.lines = readline.createInterface({ input: this.child.stdout });
    this.lines.on('line', (line) => this.handleLine(line));
  }

  stderrText() {
    return Buffer.concat(this.stderr).toString('utf8').trim();
  }

  rejectAll(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  handleLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      this.rejectAll(new Error(`MCP process emitted non-JSON stdout: ${line}`));
      return;
    }
    if (message.id === undefined) {
      return;
    }
    const pending = this.pending.get(message.id);
    if (!pending) {
      return;
    }
    clearTimeout(pending.timer);
    this.pending.delete(message.id);
    if (message.error) {
      pending.reject(new Error(`MCP request failed: ${JSON.stringify(message.error)}`));
    } else {
      pending.resolve(message.result);
    }
  }

  send(message) {
    assert(!this.closed, 'Cannot write to a closed MCP process.');
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  request(method, params = {}, timeoutMs = 120_000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP ${method} request timed out.\n${this.stderrText()}`));
      }, timeoutMs);
      this.pending.set(id, { reject, resolve, timer });
      this.send({ id, jsonrpc: '2.0', method, params });
    });
  }

  notify(method, params = {}) {
    this.send({ jsonrpc: '2.0', method, params });
  }

  async close() {
    this.lines.close();
    if (this.closed) {
      await this.exitPromise;
      return;
    }
    this.child.stdin.end();
    terminateProcessTree(this.child, 'SIGTERM', this.knownDescendantPids);
    const graceful = await waitForCompletion(this.exitPromise, 5_000);
    if (graceful) {
      terminateProcessTree(this.child, 'SIGKILL', this.knownDescendantPids);
      return;
    }
    terminateProcessTree(this.child, 'SIGKILL', this.knownDescendantPids);
    const forced = await waitForCompletion(this.exitPromise, 5_000);
    if (!forced) {
      throw new Error(`MCP process did not exit after forced termination.\n${this.stderrText()}`);
    }
  }
}

function toolResultText(result) {
  return (result.content ?? [])
    .filter((item) => item.type === 'text')
    .map((item) => item.text)
    .join('\n');
}

function assertToolSuccess(result, label) {
  assert(result && result.isError !== true, `${label} returned an MCP tool error: ${toolResultText(result)}`);
}

function assertValidation(result, expectedValid, label) {
  if (expectedValid) {
    assertToolSuccess(result, label);
  }
  const valid = result.structuredContent?.valid;
  assert(valid === expectedValid, `${label} expected valid=${expectedValid}, received ${valid}.`);
  return result.structuredContent;
}

export async function smokeInstalledMcp({
  clientName = 'primeui-plugins-smoke',
  contract,
  env,
  installPath,
  library,
  mcp
}) {
  const server = mcp.mcpServers[library];
  const client = new JsonRpcStdioClient(server.command, server.args, {
    cwd: installPath,
    env
  });

  try {
    await client.request('initialize', {
      capabilities: {},
      clientInfo: { name: clientName, version: '1.0.0' },
      protocolVersion: '2025-06-18'
    });
    client.notify('notifications/initialized');

    const toolList = await client.request('tools/list');
    const toolNames = (toolList.tools ?? []).map((tool) => tool.name).sort();
    assert(
      JSON.stringify(toolNames) === JSON.stringify(expectedMcpTools),
      `${library}: MCP tool surface differs: ${toolNames.join(', ')}.`
    );

    const documentation = await client.request('tools/call', {
      arguments: { component: 'button', includeExamples: true, ...(library === 'primereact' ? { mode: 'styled' } : {}) },
      name: 'get_component'
    });
    assertToolSuccess(documentation, `${library} Button documentation`);
    assert(/button/i.test(toolResultText(documentation)), `${library}: Button documentation was empty.`);

    const valid = await client.request('tools/call', {
      arguments: {
        code: contract.validCode,
        component: 'button',
        ...(library === 'primereact' ? { mode: 'styled' } : {})
      },
      name: 'validate_usage'
    });
    assertValidation(valid, true, `${library} valid Button usage`);

    const invalid = await client.request('tools/call', {
      arguments: {
        code: contract.invalidCode,
        component: 'button',
        ...(library === 'primereact' ? { mode: 'styled' } : {})
      },
      name: 'validate_usage'
    });
    const invalidResult = assertValidation(invalid, false, `${library} invalid Button usage`);
    assert(
      invalidResult.issues?.some((issue) => issue.kind === 'unknown-prop' && issue.name === 'madeUp'),
      `${library}: invalid property was not rejected as unknown-prop.`
    );

    if (library === 'primereact') {
      const tailwindCode = [
        "import { Button as UiButton } from '@/components/ui/button';",
        '',
        'export function SaveAction() {',
        '  return <UiButton variant="default">Save</UiButton>;',
        '}'
      ].join('\n');
      const tailwind = await client.request('tools/call', {
        arguments: { code: tailwindCode, component: 'button', mode: 'tailwind' },
        name: 'validate_usage'
      });
      assertValidation(tailwind, true, 'PrimeReact tailwind Button usage');

      const tailwindDocumentation = await client.request('tools/call', {
        arguments: { component: 'button', includeExamples: true, mode: 'tailwind' },
        name: 'get_component'
      });
      assertToolSuccess(tailwindDocumentation, 'PrimeReact tailwind Button documentation');
      const styledRouting = JSON.stringify(documentation);
      const tailwindRouting = JSON.stringify(tailwindDocumentation);
      assert(
        styledRouting !== tailwindRouting && /styled/i.test(styledRouting) && /tailwind/i.test(tailwindRouting),
        'PrimeReact styled and tailwind documentation did not route to distinct mode-specific results.'
      );
    }

    return { toolNames };
  } finally {
    await client.close();
  }
}
