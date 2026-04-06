# Building with floom

floom deploys Python scripts as cloud automations. Write a `run()` function, get a live URL with web UI, REST API, and MCP endpoint.

## How it works

1. Write a Python script with a `run()` function
2. Tell your agent "deploy on floom" (works from Claude Code, Cursor, or any MCP-capable agent)
3. floom tests it in a sandbox, then deploys it
4. You get a shareable URL at `dashboard.floom.dev/a/<id>`

## Script format

```python
import os

def run(company_url: str) -> dict:
    # Your logic here
    # Access secrets via os.environ["SECRET_NAME"]
    return {"result": "your output"}
```

Rules:
- Function must be named `run`
- Inputs are function parameters
- Returns a dict
- Secrets (API keys) via `os.environ["SECRET_NAME"]`, injected by the platform
- Dependencies listed in manifest `python_dependencies`, pip-installed at runtime

## Manifest format

```json
{
  "name": "My Automation",
  "description": "What it does in one sentence",
  "inputs": [
    {"name": "company_url", "label": "Company URL", "type": "url", "required": true}
  ],
  "outputs": [
    {"name": "result", "label": "Result", "type": "text"}
  ],
  "secrets_needed": ["GEMINI_API_KEY"],
  "python_dependencies": ["google-genai", "httpx"],
  "manifest_version": "1.0"
}
```

### Input types

| Type | Python type | Use for |
|------|-------------|---------|
| `text` | `str` | Short strings (name, query, ID) |
| `textarea` | `str` | Long text (500+ chars) |
| `url` | `str` | Links, API endpoints |
| `file` | `str` | File uploads (receives R2 URL, download with `requests.get()`) |
| `number` | `float`/`int` | Numbers, percentages |
| `enum` | `str` | Fixed choices (provide `options` array) |
| `boolean` | `bool` | True/false toggles |
| `date` | `str` | ISO 8601 date string |

### Output types

| Type | Use for |
|------|---------|
| `text` | String output |
| `table` | List of dicts (include `columns` array) |
| `number` | Formatted number |
| `html` | Rendered HTML |
| `pdf` | PDF document |
| `image` | Base64-encoded image |

## API

All endpoints at `https://dashboard.floom.dev/api/`. Auth via `Authorization: Bearer <API_KEY>`.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/artifacts` | Upload code + manifest, returns `artifactId` |
| POST | `/api/test` | Test in sandbox, returns `testRunId` |
| POST | `/api/deploy` | Deploy artifact as automation |
| GET | `/api/automations` | List all automations |
| GET | `/api/automations/:id` | Get automation details + code |
| POST | `/api/automations/:id/update` | Deploy new version |
| POST | `/api/automations/:id/run` | Trigger a run |
| POST | `/api/automations/:id/rollback` | Revert to previous version |
| POST | `/api/secrets` | Store org secret |

## Example: Email classifier

```python
import os
import json
import re
from google import genai

def run(email_text: str) -> dict:
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=f"""Classify this email intent.
Return JSON: {{"intent": "interested|counter_offer|rejection|unclear", "confidence": 0.0-1.0, "summary": "one sentence"}}
Email: {email_text}
Return ONLY valid JSON."""
    )
    cleaned = re.sub(r'```json\s*|\s*```', '', response.text).strip()
    return json.loads(cleaned)
```

## Install the Claude Code skill

```bash
git clone https://github.com/floomhq/floom.git ~/.claude/skills/floom-repo && ~/.claude/skills/floom-repo/scripts/setup
```

Then type `/floom` in Claude Code to deploy any Python script.

## Links

- Dashboard: https://dashboard.floom.dev
- Docs: https://docs.floom.dev
- GitHub: https://github.com/floomhq/floom
