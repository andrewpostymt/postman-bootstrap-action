# postman-bootstrap-action

Phase 1 scaffold for the public beta JavaScript action that bootstraps Postman assets from an OpenAPI spec.

## Beta contract

The public beta keeps the bootstrap core from `api-catalog-demo-infra/.github/actions/postman-bootstrap` and normalizes it into a stable surface with kebab-case inputs and outputs.

`integration-backend` defaults to `bifrost` in this beta contract.

Retained behavior:
- create a Postman workspace for the service
- assign the workspace to a governance group through the current internal path
- invite the requester to the workspace
- add configured workspace admins
- upload the remote spec to Spec Hub
- lint the uploaded spec by UID
- generate and tag baseline, smoke, and contract collections
- persist the bootstrap identifiers needed by downstream sync work
- emit workspace, spec, and collection identifiers as action outputs

Removed behavior:
- snake_case action input and output names
- step-by-step resume mode and precomputed UID resume inputs
- AWS, Docker, and infra workflow responsibilities
- legacy placeholder inputs such as `team-id` and runtime-coupled workflow knobs
- internal workflow-only tuning knobs from the infra repo

## Local usage

```bash
npm install
npm test
```
