---
name: floom
description: |
  Deploy Python scripts to the cloud and share them with your team.
  Use when: "deploy automation", "deploy python script", "floom",
  "schedule a script", "update automation".
---

# Floom

Deploy Python projects as cloud automations — no infra required. Supports single-file scripts and multi-file projects with imports.

## Setup

Your API key is stored in `~/.claude/floom-config.json`.
If it's not there yet, get it from **dashboard.floom.dev/settings**.

```bash
# Check config
cat ~/.claude/floom-config.json 2>/dev/null || echo "NOT_CONFIGURED"
```

If NOT_CONFIGURED:

```
Paste your Floom API key from dashboard.floom.dev/settings:
```

Then write it:

```bash
echo '{"api_key": "PASTE_KEY_HERE", "platform_url": "https://dashboard.floom.dev"}' > ~/.claude/floom-config.json
```

---

## Deploy Flow (`/floom`)

### Step 1: Get the project

Get the user's Python code. Be flexible:

- If the user points to a file, read it
- If the user points to a directory, read all Python files in it
- If the user gives a GitHub URL, clone it locally
- If the user pastes code, use that (single-file mode)
- If unclear, ask: "Which Python script or project do you want to deploy?"

### Step 2: Adapt to platform format

The platform requires an **entrypoint file** with a `run()` function that takes inputs as parameters and returns a dict. The project can have multiple files with imports between them.

**If it's a single file with a `run()` function:** validate it returns a dict and move on.

**If it's a multi-file project without `run()`:** adapt it:

1. Identify the main entry point (usually `main.py`, or the file with the primary logic)
2. Ensure it has `def run(param1, param2, ...) -> dict:` at module level
3. If logic is in `if __name__ == "__main__":`, extract it into `run()`
4. Identify inputs — look for hardcoded values, config variables, CLI args, env vars
5. Identify outputs — look for print statements, return values, file writes
6. Capture outputs as a return dict: `return {"key1": value1, "key2": value2}`

**Multi-file project rules:**

- The entrypoint file must have `def run()` at module level (not inside a class or conditional)
- Imports between project files must use the correct module paths (e.g., `from utils.helpers import fetch_data`)
- Every subdirectory containing `.py` files must have an `__init__.py` (add empty ones if missing)
- Do NOT create files named `_runner.py` or `_runner_config.json` (reserved by platform)
- Secrets stay as `os.environ["SECRET_NAME"]` — the platform injects them at runtime
- No `exec(..., globals())` — subprocess isolation is handled by the platform

**Dependency selection:**

- Anthropic SDK: `anthropic` (always available in E2B)
- Data/CSV/Excel: `pandas`, `openpyxl`
- PDF parsing: `PyMuPDF`
- HTTP requests: `requests`, `httpx` (always available)
- Read `requirements.txt` or `pyproject.toml` if they exist
- Unknown deps: list them in `python_dependencies` — platform pip installs at run time

### Step 3: Generate manifest

Derive the manifest from the adapted code:

```json
{
  "name": "Automation Name",
  "description": "One-sentence description",
  "schedule": "0 9 * * 1",
  "scheduleInputs": { "param1": "default_value" },
  "inputs": [
    {
      "name": "param_name",
      "label": "Human Label",
      "type": "text|textarea|url|file|number|enum|boolean|date",
      "description": "What to put here",
      "required": true,
      "options": ["opt1", "opt2"],
      "accept": ".pdf,.csv,.txt",
      "min": 1,
      "max": 100,
      "default": "default_value"
    }
  ],
  "outputs": [
    {
      "name": "output_key",
      "label": "Human Label",
      "type": "text|table|number",
      "columns": ["col1", "col2"]
    }
  ],
  "secrets_needed": ["ANTHROPIC_API_KEY"],
  "python_dependencies": ["anthropic", "pandas"],
  "manifest_version": "1.0"
}
```

**Input type guide — all values are passed to `run()` as the Python type shown:**

- `text` — `str`. Short strings (name, query, ID). Example: `run(name: str)` receives `"Alice"`
- `textarea` — `str`. Long text (transcript, document, prompt) — use for 500+ char inputs. Example: `run(transcript: str)` receives `"Full text here..."`
- `url` — `str`. Links (CSV URL, API endpoint). Example: `run(feed_url: str)` receives `"https://example.com/data.csv"`
- `file` — `str`. File upload (.pdf, .csv, .xlsx) — function receives an R2 URL string, not file contents. Use `requests.get()` or `httpx.get()` to download. Example: `run(document: str)` receives `"https://r2.floom.dev/uploads/abc123.pdf"`
- `number` — `float` or `int`. Any number: integers, floats, percentages. Example: `run(limit: int)` receives `10`; `run(threshold: float)` receives `0.75`
- `enum` — `str`. Fixed choices (tone: professional/casual). The value is one of the `options` strings. Example: `run(tone: str)` receives `"professional"`
- `boolean` — `bool`. True/false toggle (dry run, include headers). Example: `run(dry_run: bool)` receives `True` or `False` (Python booleans, not strings)
- `date` — `str` (ISO 8601 format). Date picker value passed as a **string**, not a date object. Example: `run(target_date: str)` receives `"2024-01-15"`. Parse with `datetime.fromisoformat(target_date)` if you need a date object

**Output type guide:**

- `text` — string output
- `table` — list of dicts (include `columns` array)
- `number` — numeric output (displayed as large formatted number)
- `html` — rendered HTML
- `pdf` — PDF document
- `image` — base64-encoded image (matplotlib chart, screenshot)

For schedule: convert natural language to cron directly. "Every Monday at 9am" -> `0 9 * * 1`. If scheduled and has required inputs, set `scheduleInputs` with defaults.

Only ask the user questions if something is genuinely ambiguous (e.g., can't tell what the inputs should be). Otherwise, infer everything from the code.

### Step 4: Pre-flight validation

Before uploading, validate locally to catch errors before hitting the server:

```bash
# Check syntax of all .py files
find /tmp/floom-deploy -name "*.py" -exec python3 -c "
import ast, sys
try:
    ast.parse(open(sys.argv[1]).read())
except SyntaxError as e:
    print(f'SYNTAX ERROR in {sys.argv[1]}: {e}')
    sys.exit(1)
" {} \;

# Verify entrypoint has run()
python3 -c "
import ast, sys
tree = ast.parse(open('/tmp/floom-deploy/ENTRYPOINT_FILE').read())
has_run = any(isinstance(n, ast.FunctionDef) and n.name == 'run' for n in ast.iter_child_nodes(tree))
if not has_run:
    print('ERROR: Entrypoint does not have a module-level run() function')
    sys.exit(1)
print('Pre-flight: OK')
"
```

If pre-flight fails, fix the issue and re-validate. Do NOT upload until pre-flight passes.

### Step 5: Handle secrets

Read config:

```bash
API_KEY=$(python3 -c "import json; print(json.load(open('$HOME/.claude/floom-config.json'))['api_key'])")
PLATFORM=$(python3 -c "import json; print(json.load(open('$HOME/.claude/floom-config.json')).get('platform_url','https://dashboard.floom.dev'))")
```

For each secret in `secrets_needed`, ask one at a time:

```
This automation needs ANTHROPIC_API_KEY. Do you have one?
If yes: paste it and I'll store it securely for all your workspace's automations.
If no: I'll skip this — you can add it in Settings before running.
```

Store each secret:

```bash
curl -s -X POST "$PLATFORM/api/secrets" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "SECRET_NAME", "value": "SECRET_VALUE"}'
```

### Step 6: Upload artifact (three-step zip upload)

Package the project as a zip and upload via the three-step API.

```bash
# Write project files to temp dir
mkdir -p /tmp/floom-deploy
# [Write all project files here — entrypoint + supporting files]

cat > /tmp/floom-deploy/main.py << 'PYEOF'
[ENTRYPOINT CODE]
PYEOF

# Write any additional files
cat > /tmp/floom-deploy/utils/helpers.py << 'PYEOF'
[HELPER CODE]
PYEOF

# Ensure __init__.py exists in all subdirectories
find /tmp/floom-deploy -type d -exec sh -c '
  for dir; do
    [ "$dir" = "/tmp/floom-deploy" ] && continue
    [ -f "$dir/__init__.py" ] || touch "$dir/__init__.py"
  done
' _ {} +

# Write manifest
cat > /tmp/floom-deploy/manifest.json << 'JSONEOF'
[GENERATED MANIFEST]
JSONEOF

# Create zip (exclude __pycache__, .git, manifest.json)
cd /tmp/floom-deploy
zip -r /tmp/floom-deploy.zip . -x '__pycache__/*' '.git/*' 'manifest.json' '*.pyc'

# Read config
API_KEY=$(python3 -c "import json; print(json.load(open('$HOME/.claude/floom-config.json'))['api_key'])")
PLATFORM=$(python3 -c "import json; print(json.load(open('$HOME/.claude/floom-config.json')).get('platform_url','https://dashboard.floom.dev'))")

# Step 1: Get upload URL
UPLOAD_RESULT=$(curl -s -X POST "$PLATFORM/api/artifacts/upload-url" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json")

UPLOAD_URL=$(python3 -c "import json,sys; print(json.load(sys.stdin)['uploadUrl'])" <<< "$UPLOAD_RESULT")
R2_KEY=$(python3 -c "import json,sys; print(json.load(sys.stdin)['r2Key'])" <<< "$UPLOAD_RESULT")

# Step 2: Upload zip
curl -s -X PUT "$UPLOAD_URL" \
  -H "Content-Type: application/zip" \
  --data-binary @/tmp/floom-deploy.zip

# Step 3: Create artifact (platform validates zip, computes file hashes)
MANIFEST_JSON=$(cat /tmp/floom-deploy/manifest.json)

python3 -c "
import json
manifest = json.load(open('/tmp/floom-deploy/manifest.json'))
payload = json.dumps({
    'manifest': manifest,
    'entrypoint': 'ENTRYPOINT_FILENAME',
    'r2Key': '$R2_KEY'
})
open('/tmp/floom-deploy/artifact-payload.json', 'w').write(payload)
"

ARTIFACT_RESULT=$(curl -s -X POST "$PLATFORM/api/artifacts" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/floom-deploy/artifact-payload.json)

ARTIFACT_ID=$(python3 -c "import json,sys; print(json.load(sys.stdin)['artifactId'])" <<< "$ARTIFACT_RESULT")
echo "Artifact uploaded: $ARTIFACT_ID"
```

Replace `ENTRYPOINT_FILENAME` with the actual entrypoint file path relative to project root (e.g., `main.py` or `src/main.py`).

### Step 7: Ask user — test or deploy?

```
Your code is uploaded. What would you like to do?

1. Test first — run in sandbox to verify it works before deploying
2. Deploy immediately — skip testing and go live now
```

Wait for user's choice.

### Step 8a: Test path

If the user chose to test first:

Determine test inputs:
- If the manifest has `scheduleInputs`, use those as defaults
- If inputs have `default` values, use those
- Otherwise, ask the user for test input values

```bash
cat > /tmp/floom-deploy/inputs.json << 'JSONEOF'
[TEST INPUTS]
JSONEOF

# Build test payload
python3 -c "
import json
inputs = json.load(open('/tmp/floom-deploy/inputs.json'))
payload = json.dumps({'artifactId': '$ARTIFACT_ID', 'inputs': inputs})
open('/tmp/floom-deploy/test-payload.json', 'w').write(payload)
"

TEST_RESULT=$(curl -s -X POST "$PLATFORM/api/test" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/floom-deploy/test-payload.json)

RESPONSE_FILE="/tmp/floom-deploy/test-response.json"
echo "$TEST_RESULT" > "$RESPONSE_FILE"

TEST_RUN_ID=$(python3 -c "import json,sys; print(json.load(sys.stdin)['testRunId'])" <<< "$TEST_RESULT")
STATUS=$(python3 -c "import json; print(json.load(open('$RESPONSE_FILE')).get('status', 'pending'))")

echo "Test run: $TEST_RUN_ID (status: $STATUS)"
```

If the API returned a terminal status (`success`, `error`, `timeout`), the result is already in the response. If still `pending`/`running`, poll for completion (every 3s, timeout after 2 min):

```bash
if [ "$STATUS" != "success" ] && [ "$STATUS" != "error" ] && [ "$STATUS" != "timeout" ]; then
  TIMEOUT=120
  ELAPSED=0
  while [ $ELAPSED -lt $TIMEOUT ]; do
    sleep 3
    ELAPSED=$((ELAPSED + 3))
    curl -s "$PLATFORM/api/test-runs/$TEST_RUN_ID" \
      -H "Authorization: Bearer $API_KEY" \
      -o "$RESPONSE_FILE"

    STATUS=$(python3 -c "
import json
try:
    d = json.load(open('$RESPONSE_FILE'))
    print(d.get('status', 'unknown'))
except: print('pending')
")
    case "$STATUS" in
      success|error|timeout) break ;;
      pending|running) ;;
      *) echo "Unexpected status: $STATUS"; cat "$RESPONSE_FILE"; break ;;
    esac
  done
  if [ $ELAPSED -ge $TIMEOUT ]; then
    echo "Timed out after ${TIMEOUT}s waiting for test run to complete."
  fi
fi

# Print results (from inline response or poll response)
python3 -c "
import json
d = json.load(open('$RESPONSE_FILE'))
doc = d.get('result', d)
print(f\"Status: {doc.get('status', 'unknown')}\")
if doc.get('outputs'): print(f\"Outputs: {json.dumps(doc['outputs'], indent=2)}\")
if doc.get('error'): print(f\"Error: {doc['error']}\")
if doc.get('logs'): print(f\"Logs:\n{doc['logs']}\")
"
```

**If test fails (autonomous fix loop):**

Fix the code, re-run pre-flight validation, and re-upload as a NEW artifact (go back to Step 6). Loop autonomously up to 5 attempts. Do NOT ask the user between retries. After 5 failures, report the last error and ask:

```
Test failed after 5 attempts. Last error: [error message]

1. Deploy anyway (the code that failed tests)
2. Abort
```

**If test succeeds:** proceed to Step 9 (deploy).

### Step 8b: Deploy immediately path

If the user chose to deploy immediately, skip testing and go directly to Step 9.

### Step 9: Deploy

```bash
DEPLOY_RESULT=$(curl -s -X POST "$PLATFORM/api/deploy" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"artifactId\": \"$ARTIFACT_ID\"}")

echo "$DEPLOY_RESULT"
```

On success (JSON with `id` and `url`):

```
Deployed! Your automation is live:

  [URL from response]

Share this URL with your team — they can run it directly, no terminal needed.
```

On error:

```
Deploy failed: [error message]

Want me to fix the issue and try again?
```

---

## Update Flow (`/floom update [url or name]`)

1. Find the automation to update:

```bash
# Search by name
AUTOMATIONS=$(curl -s "$PLATFORM/api/automations?q=SEARCH_TERM" \
  -H "Authorization: Bearer $API_KEY")
echo "$AUTOMATIONS"
```

Pick the matching automation ID from the list, then fetch its details:

```bash
AUTOMATION=$(curl -s "$PLATFORM/api/automations/[AUTOMATION_ID]" \
  -H "Authorization: Bearer $API_KEY")
echo "$AUTOMATION"
```

This returns the full automation including `fileList`, `entrypoint`, and `manifest`. To get the actual code files, download the zip:

```bash
# Get download URL for current code
CODE_INFO=$(curl -s "$PLATFORM/api/artifacts/[ARTIFACT_ID]/code" \
  -H "Authorization: Bearer $API_KEY")

DOWNLOAD_URL=$(python3 -c "import json,sys; print(json.load(sys.stdin)['downloadUrl'])" <<< "$CODE_INFO")

# Download and extract current code
curl -sL "$DOWNLOAD_URL" -o /tmp/floom-current.zip
mkdir -p /tmp/floom-deploy
cd /tmp/floom-deploy && unzip -o /tmp/floom-current.zip
```

2. Show existing file structure, ask what to change
3. Apply changes to the project files
4. Ask: "What changed? (optional note for version history)"
5. Run pre-flight validation (Step 4)
6. Upload the updated code as a new artifact (same as Deploy Flow Step 6)
7. Ask user: test or deploy immediately? (same as Deploy Flow Step 7)
8. If testing: same as Deploy Flow Step 8a, but include `automationId`:

```bash
python3 -c "
import json
inputs = json.load(open('/tmp/floom-deploy/inputs.json'))
payload = json.dumps({'artifactId': '$ARTIFACT_ID', 'inputs': inputs, 'automationId': '[AUTOMATION_ID]'})
open('/tmp/floom-deploy/test-payload.json', 'w').write(payload)
"
```

9. Deploy update:

```bash
curl -s -X POST "$PLATFORM/api/automations/[AUTOMATION_ID]/update" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"artifactId\": \"$ARTIFACT_ID\", \"changeNote\": \"...\"}"
```

On success: "Updated to v[N]. Same URL, new code."

---

## Rollback Flow

If the user wants to revert to a previous version:

```bash
curl -s -X POST "$PLATFORM/api/automations/[AUTOMATION_ID]/rollback" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"versionId": "[VERSION_ID]"}'
```

---

## Error Messages

| Error                         | What to say                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------ |
| 400 Validation failed         | "The code has an issue: [message]. Let me fix that."                           |
| 400 Entrypoint not found      | "The entrypoint file wasn't found in the zip. Let me check the file paths."    |
| 400 Missing run()             | "The entrypoint doesn't have a run() function. Let me add one."               |
| 400 Path traversal            | "Invalid file path in the project. Let me fix the directory structure."        |
| 413 Zip too large             | "The project is too large (>10MB compressed). Try removing unnecessary files." |
| 404 Artifact not found        | "The uploaded code wasn't found. Let me re-upload and try again."              |
| 403 Forbidden                 | "That artifact belongs to a different workspace."                              |
| 401 Unauthorized              | "Your API key isn't working. Get a new one from dashboard.floom.dev/settings." |
| Rate limit exceeded           | "You've hit the limit of 50 runs/hour. Try again in a bit."                    |
| Missing secret                | "This automation needs [SECRET_NAME] but it's not stored. Want to add it now?" |

---

## API Reference

All endpoints require `Authorization: Bearer <API_KEY>` header. The API key is stored in `~/.claude/floom-config.json`.

```bash
API_KEY=$(python3 -c "import json; print(json.load(open('$HOME/.claude/floom-config.json'))['api_key'])")
PLATFORM=$(python3 -c "import json; print(json.load(open('$HOME/.claude/floom-config.json')).get('platform_url','https://dashboard.floom.dev'))")
```

### POST /api/artifacts/upload-url

Step 1 of artifact upload. Returns a presigned PUT URL for uploading a zip file to R2.

**Response (200):**
```json
{
  "uploadUrl": "https://r2.example.com/presigned-put-url...",
  "r2Key": "artifacts/org123/uuid.zip"
}
```

After receiving this, PUT the zip binary to `uploadUrl`:

```bash
curl -s -X PUT "$UPLOAD_URL" -H "Content-Type: application/zip" --data-binary @project.zip
```

### POST /api/artifacts

Step 3 of artifact upload. Validates the zip, computes file hashes, creates the artifact.

**Body:**
```json
{
  "manifest": { ... },
  "entrypoint": "main.py",
  "r2Key": "artifacts/org123/uuid.zip"
}
```

- `manifest` (required) — manifest object (see Step 3 above)
- `entrypoint` (required) — file path within the zip (e.g., `main.py` or `src/main.py`)
- `r2Key` (required) — R2 key from Step 1

**Response (200):**
```json
{
  "artifactId": "art123"
}
```

### GET /api/artifacts/:id/code

Download the artifact's code as a zip file. Returns a presigned download URL and file list.

**Response (200):**
```json
{
  "downloadUrl": "https://r2.example.com/presigned-get-url...",
  "fileList": [
    { "path": "main.py", "size": 1234, "hash": "abc..." },
    { "path": "utils/helpers.py", "size": 567, "hash": "def..." }
  ]
}
```

### GET /api/automations

List all automations in the workspace.

**Query params:**
- `q` (optional) — case-insensitive search on name and description

**Response (200):**
```json
{
  "automations": [
    {
      "id": "abc123",
      "name": "Daily Report",
      "description": "Generates daily sales summary",
      "status": "active",
      "schedule": "0 9 * * *",
      "scheduleEnabled": true,
      "currentVersion": 3,
      "createdAt": 1712300000000,
      "lastRunStatus": "success",
      "lastRunAt": 1712350000000,
      "url": "https://dashboard.floom.dev/a/abc123"
    }
  ]
}
```

### GET /api/automations/:id

Get full automation detail including file list, entrypoint, and manifest.

**Response (200):**
```json
{
  "id": "abc123",
  "name": "Daily Report",
  "description": "Generates daily sales summary",
  "status": "active",
  "schedule": "0 9 * * *",
  "currentVersion": 3,
  "entrypoint": "main.py",
  "fileList": [
    { "path": "main.py", "size": 1234, "hash": "abc..." },
    { "path": "utils/helpers.py", "size": 567, "hash": "def..." }
  ],
  "fileCount": 2,
  "totalSize": 1801,
  "manifest": { ... }
}
```

### POST /api/test

Run an artifact's code in a sandbox before deploying. Returns a `testRunId`. The API waits up to 10s for results by default.

**Body:**
```json
{
  "artifactId": "art123",
  "inputs": { "x": 5 },
  "automationId": "abc123"
}
```

- `artifactId` (required) — ID from POST /api/artifacts
- `inputs` (required) — dict of input values matching manifest input names
- `automationId` (optional) — link to existing automation (for updates, ensures secrets are available)
- `wait` (optional) — seconds to wait for result (default 10, max 10)

**Response (200):**
```json
{
  "testRunId": "xyz789",
  "status": "success",
  "result": {
    "status": "success",
    "outputs": { "result": 10 },
    "logs": "..."
  }
}
```

If `status` is `pending` or `running`, poll with GET /api/test-runs/:id.

### GET /api/test-runs/:id

Poll test run status until terminal (`success`, `error`, `timeout`).

### POST /api/deploy

Deploy an artifact as a new automation. No test required.

**Body:**
```json
{
  "artifactId": "art123",
  "changeNote": "Initial deploy"
}
```

**Response (200):**
```json
{
  "id": "abc123",
  "url": "https://dashboard.floom.dev/a/abc123"
}
```

### POST /api/automations/:id/update

Deploy a new version of an existing automation from an artifact.

**Body:**
```json
{
  "artifactId": "art123",
  "changeNote": "Added error handling"
}
```

### POST /api/automations/:id/run

Trigger an automation run with given inputs.

**Body:**
```json
{
  "inputs": { "query": "hello" },
  "wait": 10
}
```

If `status` is `pending` or `running`, poll with GET /api/runs/:runId.

### GET /api/runs/:runId

Poll run status until terminal (`success`, `error`, `timeout`).

### POST /api/automations/:id/rollback

Revert to a previous version.

**Body:**
```json
{ "versionId": "ver789" }
```

### POST /api/secrets

Store or update an org secret.

**Body:**
```json
{ "name": "ANTHROPIC_API_KEY", "value": "sk-ant-..." }
```
