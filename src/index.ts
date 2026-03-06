import { betaActionContract } from './contracts.js';

export interface ResolvedInputs {
  projectName: string;
  domain?: string;
  domainCode?: string;
  requesterEmail?: string;
  workspaceAdminUserIds?: string;
  specUrl: string;
  environmentsJson: string;
  systemEnvMapJson: string;
  governanceMappingJson: string;
  postmanApiKey: string;
  postmanAccessToken?: string;
  githubToken?: string;
  ghFallbackToken?: string;
  githubAuthMode: string;
  integrationBackend: string;
}

export interface PlannedOutputs {
  'workspace-id': string;
  'workspace-url': string;
  'workspace-name': string;
  'spec-id': string;
  'baseline-collection-id': string;
  'smoke-collection-id': string;
  'contract-collection-id': string;
  'collections-json': string;
  'lint-summary-json': string;
}

export function getInput(name: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  const envName = `INPUT_${name.replace(/-/g, '_').toUpperCase()}`;
  const value = env[envName];
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  return value.trim();
}

export function resolveInputs(env: NodeJS.ProcessEnv = process.env): ResolvedInputs {
  const projectName = getInput('project-name', env) ?? '';
  const specUrl = getInput('spec-url', env) ?? '';
  const postmanApiKey = getInput('postman-api-key', env) ?? '';
  const integrationBackend =
    getInput('integration-backend', env) ??
    betaActionContract.inputs['integration-backend'].default ??
    'bifrost';

  const allowedBackends =
    betaActionContract.inputs['integration-backend'].allowedValues ?? [];
  if (allowedBackends.length > 0 && !allowedBackends.includes(integrationBackend)) {
    throw new Error(
      `Unsupported integration-backend "${integrationBackend}". Supported values: ${allowedBackends.join(', ')}`
    );
  }

  return {
    projectName,
    domain: getInput('domain', env),
    domainCode: getInput('domain-code', env),
    requesterEmail: getInput('requester-email', env),
    workspaceAdminUserIds: getInput('workspace-admin-user-ids', env),
    specUrl,
    environmentsJson:
      getInput('environments-json', env) ??
      betaActionContract.inputs['environments-json'].default ??
      '["prod"]',
    systemEnvMapJson:
      getInput('system-env-map-json', env) ??
      betaActionContract.inputs['system-env-map-json'].default ??
      '{}',
    governanceMappingJson:
      getInput('governance-mapping-json', env) ??
      betaActionContract.inputs['governance-mapping-json'].default ??
      '{}',
    postmanApiKey,
    postmanAccessToken: getInput('postman-access-token', env),
    githubToken: getInput('github-token', env),
    ghFallbackToken: getInput('gh-fallback-token', env),
    githubAuthMode:
      getInput('github-auth-mode', env) ??
      betaActionContract.inputs['github-auth-mode'].default ??
      'github_token_first',
    integrationBackend
  };
}

export function createPlannedOutputs(inputs: ResolvedInputs): PlannedOutputs {
  const workspaceName = inputs.domainCode
    ? `[${inputs.domainCode}] ${inputs.projectName}`
    : inputs.projectName;

  return {
    'workspace-id': '',
    'workspace-url': '',
    'workspace-name': workspaceName,
    'spec-id': '',
    'baseline-collection-id': '',
    'smoke-collection-id': '',
    'contract-collection-id': '',
    'collections-json': JSON.stringify({
      baseline: '',
      smoke: '',
      contract: '',
      environments: inputs.environmentsJson
    }),
    'lint-summary-json': JSON.stringify({
      errors: 0,
      warnings: 0
    })
  };
}

export async function run(env: NodeJS.ProcessEnv = process.env): Promise<PlannedOutputs> {
  const inputs = resolveInputs(env);
  return createPlannedOutputs(inputs);
}
