import { promisify } from 'node:util';
import { exec as cpExec } from 'node:child_process';
import * as tl from 'azure-pipelines-task-lib';

import { type CoreLike, type ExecLike, type IOLike, runAction } from './index.js';

const execAsync = promisify(cpExec);

function kebabToCamel(name: string): string {
  return name.replace(/-([a-z])/g, (_, c: string) => (c as string).toUpperCase());
}

const adoCore: CoreLike = {
  error(message: string): void {
    tl.error(message);
  },

  getInput(name: string, options?: { required?: boolean }): string {
    const envName = `INPUT_${name.replace(/-/g, '_').toUpperCase()}`;
    const value = (process.env[envName] ?? '').trim();
    if (options?.required && !value) {
      throw new Error(`Input required and not supplied: ${name}`);
    }
    return value;
  },

  async group<T>(name: string, fn: () => Promise<T>): Promise<T> {
    process.stdout.write(`##[group]${name}\n`);
    try {
      return await fn();
    } finally {
      process.stdout.write('##[endgroup]\n');
    }
  },

  info(message: string): void {
    console.log(message);
  },

  setFailed(message: string): void {
    tl.setResult(tl.TaskResult.Failed, message);
  },

  setOutput(name: string, value: string): void {
    tl.setVariable(kebabToCamel(name), value, false, true);
  },

  setSecret(secret: string): void {
    if (secret) {
      tl.setSecret(secret);
    }
  },

  warning(message: string): void {
    tl.warning(message);
  },
};

const adoExec: ExecLike = {
  async exec(commandLine, args, options) {
    const tool = tl.tool(commandLine);
    for (const arg of (args ?? [])) {
      tool.arg(arg);
    }
    return tool.exec({
      failOnStdErr: options?.failOnStdErr ?? false,
      ignoreReturnCode: options?.ignoreReturnCode ?? true,
    });
  },

  async getExecOutput(commandLine, args, options) {
    const parts = [commandLine, ...(args ?? [])].map((a) =>
      a.includes(' ') ? `"${a}"` : a
    );
    const cmd = parts.join(' ');
    try {
      const { stdout, stderr } = await execAsync(cmd, { env: process.env });
      return { exitCode: 0, stdout, stderr };
    } catch (err: unknown) {
      const e = err as { code?: number; stdout?: string; stderr?: string };
      if (options?.ignoreReturnCode) {
        return {
          exitCode: typeof e.code === 'number' ? e.code : 1,
          stdout: e.stdout ?? '',
          stderr: e.stderr ?? '',
        };
      }
      throw err;
    }
  },
};

const adoIo: IOLike = {
  async which(tool: string, check: boolean = false): Promise<string> {
    return tl.which(tool, check) ?? '';
  },
};

const currentModulePath = typeof __filename === 'string' ? __filename : '';
const entrypoint = process.argv[1];

if (entrypoint && currentModulePath === entrypoint) {
  runAction(adoCore, adoExec, adoIo).catch((error: unknown) => {
    const msg = error instanceof Error ? error.message : String(error);
    tl.setResult(tl.TaskResult.Failed, msg);
  });
}
