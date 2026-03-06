import { describe, expect, it, vi } from 'vitest';

import {
  createInternalIntegrationAdapter
} from '../src/lib/postman/internal-integration-adapter.js';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json'
    },
    ...init
  });
}

describe('internal integration adapter', () => {
  it('routes governance assignment through the internal gateway API', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ id: 'group-1', name: 'Core Banking' }]
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const adapter = createInternalIntegrationAdapter({
      backend: 'bifrost',
      accessToken: 'token-123',
      teamId: '11430732',
      fetchImpl
    });

    await adapter.assignWorkspaceToGovernanceGroup(
      'ws-123',
      'core-banking',
      JSON.stringify({ 'core-banking': 'Core Banking' })
    );

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      'https://gateway.postman.com/configure/workspace-groups',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-access-token': 'token-123'
        })
      })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'https://gateway.postman.com/configure/workspace-groups/group-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ workspaces: ['ws-123'] })
      })
    );
  });

  it('routes system-env association through the worker internal endpoint', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        data: {
          associations: 1
        }
      })
    );

    const adapter = createInternalIntegrationAdapter({
      backend: 'bifrost',
      accessToken: 'token-123',
      teamId: '11430732',
      workerBaseUrl: 'https://catalog-admin.example.test',
      fetchImpl
    });

    await adapter.associateSystemEnvironments('ws-123', [
      { envUid: 'env-prod', systemEnvId: 'sys-prod' }
    ]);

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://catalog-admin.example.test/api/internal/system-envs/associate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({
          workspace_id: 'ws-123',
          associations: [{ env_uid: 'env-prod', system_env_id: 'sys-prod' }]
        })
      })
    );
  });

  it('uses the Bifrost proxy for workspace repository linking and rejects unsupported backends', async () => {
    expect(() =>
      createInternalIntegrationAdapter({
        backend: 'custom',
        accessToken: 'token-123',
        teamId: '11430732'
      })
    ).toThrow(/Unsupported integration backend/);

    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        data: {
          ok: true
        }
      })
    );

    const adapter = createInternalIntegrationAdapter({
      backend: 'bifrost',
      accessToken: 'token-123',
      teamId: '11430732',
      fetchImpl
    });

    await adapter.connectWorkspaceToRepository(
      'ws-123',
      'https://github.com/Postman-FDE/example'
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://bifrost-premium-https-v4.gw.postman.com/ws/proxy',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-access-token': 'token-123',
          'x-entity-team-id': '11430732'
        }),
        body: JSON.stringify({
          service: 'workspaces',
          method: 'POST',
          path: '/workspaces/ws-123/filesystem',
          body: {
            path: '/',
            repo: 'https://github.com/Postman-FDE/example',
            versionControl: true
          }
        })
      })
    );
  });
});
