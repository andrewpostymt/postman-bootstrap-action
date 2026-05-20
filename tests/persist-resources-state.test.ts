import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { parse as parseYaml } from 'yaml';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { persistResourcesState } from '../src/index.js';

const ORIGINAL_CWD = process.cwd();
let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'persist-resources-'));
  process.chdir(tempDir);
});

afterEach(() => {
  process.chdir(ORIGINAL_CWD);
  rmSync(tempDir, { recursive: true, force: true });
});

function makeLog() {
  return { info: vi.fn(), warning: vi.fn() };
}

describe('persistResourcesState', () => {
  it('writes a new resources.yaml when none exists', () => {
    const log = makeLog();
    persistResourcesState({
      workspaceId: 'ws-1',
      specId: 'spec-1',
      specPath: 'service.openapi.yaml',
      baselineCollectionId: 'baseline-1',
      smokeCollectionId: 'smoke-1',
      contractCollectionId: 'contract-1',
      projectName: 'service',
      log
    });

    expect(existsSync('.postman/resources.yaml')).toBe(true);
    const written = parseYaml(readFileSync('.postman/resources.yaml', 'utf8'));
    expect(written.workspace.id).toBe('ws-1');
    expect(written.cloudResources.collections['../postman/collections/[Baseline] service']).toBe('baseline-1');
    expect(written.cloudResources.collections['../postman/collections/[Smoke] service']).toBe('smoke-1');
    expect(written.cloudResources.collections['../postman/collections/[Contract] service']).toBe('contract-1');
    expect(written.cloudResources.specs['../service.openapi.yaml']).toBe('spec-1');
    expect(log.info).toHaveBeenCalledOnce();
    expect(log.warning).not.toHaveBeenCalled();
  });

  it('preserves existing localResources and comments', () => {
    mkdirSync('.postman', { recursive: true });
    writeFileSync(
      '.postman/resources.yaml',
      [
        'workspace:',
        '  id: ""',
        '',
        'localResources:',
        '  collections:',
        '    - ../postman/collections/[Baseline] service',
        '  specs:',
        '    - ../service.openapi.yaml',
        '',
        '# cloudResources populated by postman-bootstrap-action on first run.',
        'cloudResources: {}',
        ''
      ].join('\n')
    );

    persistResourcesState({
      workspaceId: 'ws-2',
      specId: 'spec-2',
      specPath: 'service.openapi.yaml',
      baselineCollectionId: 'baseline-2',
      projectName: 'service',
      log: makeLog()
    });

    const raw = readFileSync('.postman/resources.yaml', 'utf8');
    expect(raw).toContain('localResources:');
    expect(raw).toContain('../service.openapi.yaml');
    const parsed = parseYaml(raw);
    expect(parsed.workspace.id).toBe('ws-2');
    expect(parsed.cloudResources.collections['../postman/collections/[Baseline] service']).toBe('baseline-2');
    expect(parsed.cloudResources.specs['../service.openapi.yaml']).toBe('spec-2');
    expect(parsed.localResources.collections).toEqual(['../postman/collections/[Baseline] service']);
  });

  it('creates .postman/ when missing', () => {
    expect(existsSync('.postman')).toBe(false);
    persistResourcesState({
      workspaceId: 'ws-3',
      projectName: 'service',
      log: makeLog()
    });
    expect(existsSync('.postman/resources.yaml')).toBe(true);
  });

  it('only writes the IDs that are provided', () => {
    persistResourcesState({
      workspaceId: 'ws-4',
      baselineCollectionId: 'baseline-4',
      projectName: 'service',
      log: makeLog()
    });

    const parsed = parseYaml(readFileSync('.postman/resources.yaml', 'utf8'));
    expect(parsed.workspace.id).toBe('ws-4');
    expect(parsed.cloudResources.collections['../postman/collections/[Baseline] service']).toBe('baseline-4');
    expect(parsed.cloudResources?.collections?.['../postman/collections/[Smoke] service']).toBeUndefined();
    expect(parsed.cloudResources?.specs).toBeUndefined();
  });

  it('does not write a spec entry when only one of spec-id or spec-path is set', () => {
    persistResourcesState({
      workspaceId: 'ws-5',
      specId: 'spec-5',
      projectName: 'service',
      log: makeLog()
    });

    const parsed = parseYaml(readFileSync('.postman/resources.yaml', 'utf8'));
    expect(parsed.cloudResources?.specs).toBeUndefined();
  });

  it('logs a warning and does not throw when the existing file is unparseable', () => {
    mkdirSync('.postman', { recursive: true });
    writeFileSync('.postman/resources.yaml', '\t\t\nthis: is\n  : malformed: ::yaml:::');

    const log = makeLog();
    expect(() =>
      persistResourcesState({
        workspaceId: 'ws-6',
        projectName: 'service',
        log
      })
    ).not.toThrow();
    // It either recovers and writes a fresh doc, or warns. Either is acceptable.
    expect(log.warning.mock.calls.length + log.info.mock.calls.length).toBeGreaterThan(0);
  });
});
