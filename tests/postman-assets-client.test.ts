import { describe, expect, it, vi } from 'vitest';

import { PostmanAssetsClient } from '../src/lib/postman/postman-assets-client.js';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json'
    },
    ...init
  });
}

describe('PostmanAssetsClient', () => {
  it('uses the public Postman API base URL by default', () => {
    const client = new PostmanAssetsClient({
      apiKey: 'pmak-test'
    });

    expect(client.getBaseUrl()).toBe('https://api.getpostman.com');
  });

  it('creates a workspace and enforces team visibility', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          workspace: {
            id: 'ws-123'
          }
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          workspace: {
            id: 'ws-123',
            visibility: 'private'
          }
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          workspace: {
            id: 'ws-123',
            visibility: 'team'
          }
        })
      );

    const client = new PostmanAssetsClient({
      apiKey: 'pmak-test',
      fetchImpl
    });

    await expect(client.createWorkspace('Core Banking', 'desc')).resolves.toEqual({
      id: 'ws-123'
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      'https://api.getpostman.com/workspaces/ws-123',
      expect.objectContaining({
        method: 'PUT'
      })
    );
  });

  it('normalizes collection tags to valid Postman slugs', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 204
      })
    );
    const client = new PostmanAssetsClient({
      apiKey: 'pmak-test',
      fetchImpl
    });

    await client.tagCollection('col-123', ['Generated Smoke', 'core banking']);

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.getpostman.com/collections/col-123/tags',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          tags: [{ slug: 'generated-smoke' }, { slug: 'core-banking' }]
        })
      })
    );
  });

  it('returns existing spec content when available', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ content: 'openapi: 3.1.0' })
    );
    const client = new PostmanAssetsClient({
      apiKey: 'pmak-test',
      fetchImpl
    });

    await expect(client.getSpecContent('spec-123')).resolves.toBe('openapi: 3.1.0');
  });

  it('returns undefined when fetching existing spec content fails', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('not found', { status: 404 })
    );
    const client = new PostmanAssetsClient({
      apiKey: 'pmak-test',
      fetchImpl
    });

    await expect(client.getSpecContent('spec-123')).resolves.toBeUndefined();
  });

  it('deletes collections successfully', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 204 })
    );
    const client = new PostmanAssetsClient({
      apiKey: 'pmak-test',
      fetchImpl
    });

    await expect(client.deleteCollection('col-123')).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.getpostman.com/collections/col-123',
      expect.objectContaining({
        method: 'DELETE'
      })
    );
  });

  it('treats collection delete 404 as success', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('not found', { status: 404 })
    );
    const client = new PostmanAssetsClient({
      apiKey: 'pmak-test',
      fetchImpl
    });

    await expect(client.deleteCollection('col-missing')).resolves.toBeUndefined();
  });

  it('creates a workspace with targetTeamId in the payload for org-mode', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          workspace: {
            id: 'ws-org-123'
          }
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          workspace: {
            id: 'ws-org-123',
            visibility: 'team'
          }
        })
      );

    const client = new PostmanAssetsClient({
      apiKey: 'pmak-test',
      fetchImpl
    });

    await expect(client.createWorkspace('Org WS', 'desc', 132319)).resolves.toEqual({
      id: 'ws-org-123'
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      'https://api.getpostman.com/workspaces',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          workspace: {
            about: 'desc',
            name: 'Org WS',
            type: 'team',
            teamId: 132319
          }
        })
      })
    );
  });

  it('creates a workspace without teamId when targetTeamId is not provided', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          workspace: { id: 'ws-no-team' }
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          workspace: { id: 'ws-no-team', visibility: 'team' }
        })
      );

    const client = new PostmanAssetsClient({
      apiKey: 'pmak-test',
      fetchImpl
    });

    await expect(client.createWorkspace('Regular WS', 'desc')).resolves.toEqual({
      id: 'ws-no-team'
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      'https://api.getpostman.com/workspaces',
      expect.objectContaining({
        body: JSON.stringify({
          workspace: {
            about: 'desc',
            name: 'Regular WS',
            type: 'team'
          }
        })
      })
    );
  });

  it('throws actionable error for org-mode workspace creation failure', async () => {
    const errorBody = JSON.stringify({
      error: {
        name: 'invalidParamError',
        message: 'Only personal workspaces (internal) can be created outside team'
      }
    });
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(
      async () => new Response(errorBody, { status: 400 })
    );

    const client = new PostmanAssetsClient({
      apiKey: 'pmak-test',
      fetchImpl
    });

    await expect(client.createWorkspace('Org WS', 'desc')).rejects.toThrow(
      'workspace-team-id'
    );
  });

  it('returns parsed sub-teams from getTeams', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        data: [
          { id: 132109, name: 'Field Services', handle: 'fs', organizationId: 13347347 },
          { id: 132118, name: 'Customer Education', handle: 'ce', organizationId: 13347347 },
          { id: 132272, name: 'RonCorp', handle: 'rc', organizationId: 13347347 }
        ]
      })
    );

    const client = new PostmanAssetsClient({
      apiKey: 'pmak-test',
      fetchImpl
    });

    const teams = await client.getTeams();
    expect(teams).toEqual([
      { id: 132109, name: 'Field Services', handle: 'fs', organizationId: 13347347 },
      { id: 132118, name: 'Customer Education', handle: 'ce', organizationId: 13347347 },
      { id: 132272, name: 'RonCorp', handle: 'rc', organizationId: 13347347 }
    ]);
  });

  it('returns empty array from getTeams when no teams exist', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({ data: [] })
    );

    const client = new PostmanAssetsClient({
      apiKey: 'pmak-test',
      fetchImpl
    });

    await expect(client.getTeams()).resolves.toEqual([]);
  });

  it('propagates errors from getTeams without swallowing', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response('Forbidden', { status: 403 })
    );

    const client = new PostmanAssetsClient({
      apiKey: 'pmak-test',
      fetchImpl
    });

    await expect(client.getTeams()).rejects.toThrow();
  });

  it('uploads a 3.0 spec with type OPENAPI:3.0', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ id: 'spec-30' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'spec-30' }));

    const client = new PostmanAssetsClient({ apiKey: 'pmak-test', fetchImpl });
    const specId = await client.uploadSpec('ws-1', 'my-api', 'openapi: 3.0.3', '3.0');

    expect(specId).toBe('spec-30');
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      'https://api.getpostman.com/specs?workspaceId=ws-1',
      expect.objectContaining({
        body: JSON.stringify({
          name: 'my-api',
          type: 'OPENAPI:3.0',
          files: [{ path: 'index.yaml', content: 'openapi: 3.0.3' }]
        })
      })
    );
  });

  it('uploads a 3.1 spec with type OPENAPI:3.1', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ id: 'spec-31' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'spec-31' }));

    const client = new PostmanAssetsClient({ apiKey: 'pmak-test', fetchImpl });
    const specId = await client.uploadSpec('ws-1', 'my-api', 'openapi: 3.1.0', '3.1');

    expect(specId).toBe('spec-31');
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      'https://api.getpostman.com/specs?workspaceId=ws-1',
      expect.objectContaining({
        body: JSON.stringify({
          name: 'my-api',
          type: 'OPENAPI:3.1',
          files: [{ path: 'index.yaml', content: 'openapi: 3.1.0' }]
        })
      })
    );
  });

  it('throws for an unrecognised openapiVersion rather than silently defaulting', async () => {
    const client = new PostmanAssetsClient({ apiKey: 'pmak-test' });
    await expect(
      client.uploadSpec('ws-1', 'my-api', 'openapi: 3.1.0', '3.2' as '3.1')
    ).rejects.toThrow(/unsupported openapiVersion/);
  });

  it('defaults to OPENAPI:3.0 type when no version is supplied', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ id: 'spec-default' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'spec-default' }));

    const client = new PostmanAssetsClient({ apiKey: 'pmak-test', fetchImpl });
    await client.uploadSpec('ws-1', 'my-api', 'openapi: 3.0.3');

    const body = JSON.parse(
      (fetchImpl.mock.calls[0]?.[1] as RequestInit).body as string
    ) as { type: string };
    expect(body.type).toBe('OPENAPI:3.0');
  });

  it('generateCollection sends folderStrategy and requestNameSource, omits nestedFolderHierarchy when strategy is Paths', async () => {
    const collectionUid = 'col-paths-123';
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ collection: { uid: collectionUid } })
    );

    const client = new PostmanAssetsClient({
      apiKey: 'pmak-test',
      fetchImpl
    });

    await client.generateCollection('spec-123', 'payments', '[Baseline]', 'Paths', true, 'Fallback');

    const [, callOptions] = fetchImpl.mock.calls[0];
    const body = JSON.parse((callOptions as RequestInit).body as string);
    expect(body.options.folderStrategy).toBe('Paths');
    expect(body.options.requestNameSource).toBe('Fallback');
    expect(body.options).not.toHaveProperty('nestedFolderHierarchy');
  });

  it('generateCollection includes nestedFolderHierarchy when folderStrategy is Tags', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ collection: { uid: 'col-tags-123' } })
    );

    const client = new PostmanAssetsClient({
      apiKey: 'pmak-test',
      fetchImpl
    });

    await client.generateCollection('spec-123', 'payments', '[Baseline]', 'Tags', true, 'URL');

    const [, callOptions] = fetchImpl.mock.calls[0];
    const body = JSON.parse((callOptions as RequestInit).body as string);
    expect(body.options.folderStrategy).toBe('Tags');
    expect(body.options.nestedFolderHierarchy).toBe(true);
    expect(body.options.requestNameSource).toBe('URL');
  });

  it('generateCollection includes nestedFolderHierarchy: false when Tags and hierarchy disabled', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ collection: { uid: 'col-tags-flat-123' } })
    );

    const client = new PostmanAssetsClient({
      apiKey: 'pmak-test',
      fetchImpl
    });

    await client.generateCollection('spec-123', 'payments', '[Smoke]', 'Tags', false, 'Fallback');

    const [, callOptions] = fetchImpl.mock.calls[0];
    const body = JSON.parse((callOptions as RequestInit).body as string);
    expect(body.options.folderStrategy).toBe('Tags');
    expect(body.options.nestedFolderHierarchy).toBe(false);
  });
});
