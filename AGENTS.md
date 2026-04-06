# floom

floom deploys Python scripts as cloud automations with a web UI, REST API, and MCP endpoint.

## How to deploy a script on floom

1. Write a Python script with a `run()` function that takes typed parameters and returns a dict
2. Generate a manifest (JSON) describing inputs, outputs, secrets, and dependencies
3. Upload code + manifest via `POST /api/artifacts`
4. Test in sandbox via `POST /api/test`
5. Deploy via `POST /api/deploy`
6. Get a live URL at `dashboard.floom.dev/a/<id>`

### Minimal example

```python
import os

def run(query: str) -> dict:
    # Your logic here
    return {"result": "output"}
```

## Protocol reference

See [BUILDING.md](BUILDING.md) for the full protocol: manifest format, input/output types, secret handling, and all API endpoints.

## API endpoints

All at `https://dashboard.floom.dev/api/`. Auth via `Authorization: Bearer <API_KEY>`.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/artifacts` | Upload code + manifest |
| POST | `/api/test` | Test in sandbox |
| POST | `/api/deploy` | Deploy as automation |
| GET | `/api/automations` | List automations |
| GET | `/api/automations/:id` | Get automation details |
| POST | `/api/automations/:id/update` | Deploy new version |
| POST | `/api/automations/:id/run` | Trigger a run |
| POST | `/api/automations/:id/rollback` | Rollback to previous version |
| POST | `/api/secrets` | Store org secret |

## Claude Code skill

The full deploy flow (adapt script, generate manifest, upload, test, deploy) is defined in `skills/floom/SKILL.md`. Install:

```bash
git clone https://github.com/floomhq/floom.git ~/.claude/skills/floom-repo && ~/.claude/skills/floom-repo/scripts/setup
```

Then use `/floom` in Claude Code to deploy any Python script.

## Key conventions

- **Entrypoint**: every automation needs a module-level `def run(...) -> dict:` function
- **Secrets**: access via `os.environ["SECRET_NAME"]`, never hardcode
- **Dependencies**: listed in `manifest.json` under `python_dependencies`, pip-installed at runtime
- **Sandbox**: code executes in E2B sandboxes (EU-hosted, SOC 2 Type II)
- **Reserved filenames**: do not create `_runner.py` or `_runner_config.json` (used by the platform)

## Backend

This project uses [Convex](https://convex.dev). When working on Convex code, read `convex/_generated/ai/guidelines.md` first for API patterns and constraints.
