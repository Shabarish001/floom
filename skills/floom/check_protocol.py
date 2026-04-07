#!/usr/bin/env python3
"""
Floom Protocol Checker — validates a Python project against the floom deployment protocol.

Usage:
    python3 check_protocol.py <project_path> [--entrypoint <file>]

Outputs JSON to stdout:
  status: "ok" — project is ready, entrypoint/deps/run_function included
  status: "error" — issues found, each with a "fix" describing what to do

Exit code 0 if ok, 1 if errors.
"""

import ast
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Set


def _ast_unparse(node):
    # type: (ast.AST) -> str
    if hasattr(ast, "unparse"):
        return ast.unparse(node)
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return _ast_unparse(node.value) + "." + node.attr
    if isinstance(node, ast.Subscript):
        return _ast_unparse(node.value) + "[...]"
    if isinstance(node, ast.Constant):
        return repr(node.value)
    return ast.dump(node)


# ── Analysis helpers ──────────────────────────────────────────────


def find_entrypoint(project_path):
    # type: (Path) -> Optional[str]
    candidates = ["main.py", "app.py", "run.py", "handler.py", "entrypoint.py"]
    for name in candidates:
        if (project_path / name).is_file():
            return name
    for name in candidates:
        src_path = "src/" + name
        if (project_path / src_path).is_file():
            return src_path
    for py_file in sorted(project_path.rglob("*.py")):
        rel = py_file.relative_to(project_path)
        if str(rel).startswith((".", "_runner")):
            continue
        try:
            tree = ast.parse(py_file.read_text())
            for node in ast.iter_child_nodes(tree):
                if isinstance(node, ast.FunctionDef) and node.name == "run":
                    return str(rel)
        except SyntaxError:
            continue
    root_py = [f for f in project_path.iterdir() if f.suffix == ".py" and not f.name.startswith("_")]
    if len(root_py) == 1:
        return root_py[0].name
    return None


def analyze_run_function(tree):
    # type: (ast.Module) -> Dict[str, Any]
    for node in ast.iter_child_nodes(tree):
        if isinstance(node, ast.FunctionDef) and node.name == "run":
            params = []
            for arg in node.args.args:
                param = {"name": arg.arg}  # type: Dict[str, Any]
                if arg.annotation:
                    param["annotation"] = _ast_unparse(arg.annotation)
                params.append(param)
            defaults = node.args.defaults
            num_params = len(node.args.args)
            num_defaults = len(defaults)
            for i, default in enumerate(defaults):
                param_idx = num_params - num_defaults + i
                try:
                    params[param_idx]["default"] = ast.literal_eval(default)
                except (ValueError, TypeError):
                    params[param_idx]["has_default"] = True
            return_keys = set()
            returns_dict = False
            for child in ast.walk(node):
                if isinstance(child, ast.Return) and child.value:
                    if isinstance(child.value, ast.Dict):
                        returns_dict = True
                        for key in child.value.keys:
                            if isinstance(key, ast.Constant) and isinstance(key.value, str):
                                return_keys.add(key.value)
            return_annotation = None
            if node.returns:
                return_annotation = _ast_unparse(node.returns)
            return {
                "found": True,
                "params": params,
                "return_keys": sorted(return_keys),
                "returns_dict": returns_dict,
                "return_annotation": return_annotation,
            }
    return {"found": False, "params": [], "return_keys": [], "returns_dict": False}


def find_secrets(project_path):
    # type: (Path) -> List[str]
    secrets = set()  # type: Set[str]
    patterns = [
        re.compile(r'os\.environ\[[\"\']([A-Z_][A-Z0-9_]*)[\"\']\]'),
        re.compile(r'os\.environ\.get\([\"\']([A-Z_][A-Z0-9_]*)[\"\']'),
        re.compile(r'os\.getenv\([\"\']([A-Z_][A-Z0-9_]*)[\"\']'),
    ]
    non_secrets = {"PATH", "HOME", "USER", "SHELL", "TERM", "LANG", "PWD", "PYTHONPATH"}
    for py_file in project_path.rglob("*.py"):
        if "__pycache__" in str(py_file):
            continue
        try:
            content = py_file.read_text()
        except (OSError, UnicodeDecodeError):
            continue
        for p in patterns:
            secrets.update(p.findall(content))
    return sorted(secrets - non_secrets)


def find_dependencies(project_path):
    # type: (Path) -> List[str]
    deps = []  # type: List[str]
    req_file = project_path / "requirements.txt"
    if req_file.is_file():
        for line in req_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and not line.startswith("-"):
                pkg = re.split(r'[>=<!~\[]', line)[0].strip()
                if pkg:
                    deps.append(pkg)
    pyproject = project_path / "pyproject.toml"
    if pyproject.is_file():
        content = pyproject.read_text()
        dep_match = re.search(r'dependencies\s*=\s*\[(.*?)\]', content, re.DOTALL)
        if dep_match:
            for m in re.finditer(r'["\']([^"\']+)["\']', dep_match.group(1)):
                pkg = re.split(r'[>=<!~\[]', m.group(1))[0].strip()
                if pkg:
                    deps.append(pkg)
    return sorted(set(deps))


VALID_INPUT_TYPES = {"text", "textarea", "url", "file", "number", "integer", "enum", "boolean", "date"}
VALID_OUTPUT_TYPES = {"text", "table", "number", "integer", "html", "pdf", "image"}


def _validate_manifest(manifest, run_info, errors):
    # type: (dict, dict, List[Dict[str, str]]) -> None
    """Validate manifest structure. Appends to errors list, returns nothing."""
    if "inputs" not in manifest or not isinstance(manifest.get("inputs"), list):
        errors.append({"error": "manifest.json missing 'inputs' array",
                        "fix": "Add an 'inputs': [] array to manifest.json."})
        return
    if "outputs" not in manifest or not isinstance(manifest.get("outputs"), list):
        errors.append({"error": "manifest.json missing 'outputs' array",
                        "fix": "Add an 'outputs': [] array to manifest.json."})

    valid_in = ", ".join(sorted(VALID_INPUT_TYPES - {"integer"}))
    for inp in manifest.get("inputs", []):
        name = inp.get("name", "?")
        if inp.get("type") and inp["type"] not in VALID_INPUT_TYPES:
            errors.append({"error": "manifest.json input '%s' has invalid type '%s'" % (name, inp["type"]),
                            "fix": "Change type to one of: %s" % valid_in})
        if inp.get("type") == "enum" and not inp.get("options"):
            errors.append({"error": "manifest.json input '%s' is enum but has no options" % name,
                            "fix": "Add 'options': [\"opt1\", \"opt2\"] to input '%s'." % name})

    valid_out = ", ".join(sorted(VALID_OUTPUT_TYPES - {"integer"}))
    for out in manifest.get("outputs", []):
        name = out.get("name", "?")
        if out.get("type") and out["type"] not in VALID_OUTPUT_TYPES:
            errors.append({"error": "manifest.json output '%s' has invalid type '%s'" % (name, out["type"]),
                            "fix": "Change type to one of: %s" % valid_out})
        if out.get("type") == "table" and not out.get("columns"):
            errors.append({"error": "manifest.json output '%s' is table but has no columns" % name,
                            "fix": "Add 'columns': [\"col1\", \"col2\"] to output '%s'." % name})

    # Required inputs must match run() params
    if run_info.get("found"):
        param_names = {p["name"] for p in run_info.get("params", [])}
        for inp in manifest.get("inputs", []):
            if inp.get("required", True) and inp.get("name") and inp["name"] not in param_names:
                errors.append({
                    "error": "manifest.json input '%s' (required) not in run() params" % inp["name"],
                    "fix": "Add '%s' as a parameter to run(), or set \"required\": false." % inp["name"],
                })

    schedule = manifest.get("schedule")
    if schedule and isinstance(schedule, str) and len(schedule.strip().split()) != 5:
        errors.append({"error": "manifest.json schedule '%s' is not valid cron" % schedule,
                        "fix": "Cron needs 5 fields: minute hour day month weekday."})


# ── Main check ────────────────────────────────────────────────────


def check_protocol(project_path, entrypoint=None):
    # type: (str, Optional[str]) -> Dict[str, Any]
    path = Path(project_path).resolve()
    errors = []  # type: List[Dict[str, str]]

    if not path.is_dir():
        return {"status": "error", "errors": [
            {"error": "Project path does not exist: %s" % path,
             "fix": "Check the path and try again."}
        ]}

    # Find Python files
    py_files = [f for f in path.rglob("*.py")
                if "__pycache__" not in str(f) and not str(f.relative_to(path)).startswith(".")]
    if not py_files:
        return {"status": "error", "errors": [
            {"error": "No Python files found in %s" % path,
             "fix": "Point to a directory that contains .py files."}
        ]}

    # Check syntax
    for py_file in py_files:
        rel = str(py_file.relative_to(path))
        try:
            ast.parse(py_file.read_text())
        except SyntaxError as e:
            errors.append({
                "error": "Syntax error in %s: %s" % (rel, e),
                "fix": "Fix the syntax error in %s before deploying." % rel,
            })

    # Find entrypoint
    ep = entrypoint or find_entrypoint(path)
    if not ep:
        errors.append({
            "error": "No entrypoint found — no file with a run() function",
            "fix": "Create a main.py with a module-level run() function that takes inputs as params and returns a dict.",
        })
        return {"status": "error", "errors": errors}

    ep_path = path / ep
    if not ep_path.is_file():
        errors.append({
            "error": "Entrypoint file not found: %s" % ep,
            "fix": "Check the --entrypoint path. The file must exist in the project directory.",
        })
        return {"status": "error", "errors": errors}

    # Analyze run()
    try:
        tree = ast.parse(ep_path.read_text())
    except SyntaxError as e:
        errors.append({"error": "Cannot parse entrypoint %s: %s" % (ep, e), "fix": "Fix the syntax error."})
        return {"status": "error", "errors": errors}

    run_info = analyze_run_function(tree)

    if not run_info["found"]:
        errors.append({
            "error": "No module-level run() function in %s" % ep,
            "fix": "Add 'def run(...) -> dict:' at the top level of %s. "
                   "If your logic is in if __name__ == '__main__', extract it into run()." % ep,
        })
    elif not run_info["returns_dict"] and not run_info["return_annotation"]:
        errors.append({
            "error": "run() in %s doesn't appear to return a dict" % ep,
            "fix": "Make run() return a dict, e.g. return {\"result\": value}. "
                   "Or add a -> dict annotation: def run(...) -> dict:",
        })

    # Check reserved files
    for r in ["_runner.py", "_runner_config.json"]:
        if (path / r).exists():
            errors.append({
                "error": "Reserved filename: %s" % r,
                "fix": "Rename %s — this name is reserved by the platform runtime." % r,
            })

    # Check exec(globals())
    for py_file in py_files:
        try:
            content = py_file.read_text()
        except (OSError, UnicodeDecodeError):
            continue
        if "exec(" in content and "globals()" in content:
            rel = str(py_file.relative_to(path))
            errors.append({
                "error": "exec(..., globals()) found in %s" % rel,
                "fix": "Remove exec(globals()) from %s. The platform handles subprocess isolation." % rel,
            })

    # Check missing __init__.py
    for dirpath in sorted(path.rglob("*")):
        if not dirpath.is_dir() or dirpath == path:
            continue
        rel = str(dirpath.relative_to(path))
        if rel.startswith(".") or "__pycache__" in rel:
            continue
        if list(dirpath.glob("*.py")) and not (dirpath / "__init__.py").exists():
            errors.append({
                "error": "Missing __init__.py in %s/" % rel,
                "fix": "Create an empty __init__.py in %s/ so Python can import from it." % rel,
            })

    # Gather metadata
    dependencies = find_dependencies(path)
    secrets = find_secrets(path)

    # Check existing manifest
    existing_manifest = None  # type: Optional[dict]
    manifest_path = path / "manifest.json"
    if manifest_path.is_file():
        try:
            existing_manifest = json.loads(manifest_path.read_text())
        except json.JSONDecodeError as e:
            errors.append({
                "error": "manifest.json is not valid JSON: %s" % e,
                "fix": "Fix the JSON syntax in manifest.json.",
            })
        except OSError as e:
            errors.append({
                "error": "Cannot read manifest.json: %s" % e,
                "fix": "Check file permissions on manifest.json.",
            })

    # Validate manifest structure if present
    if existing_manifest is not None:
        _validate_manifest(existing_manifest, run_info, errors)

    if errors:
        return {"status": "error", "errors": errors}

    # Success — return everything needed for deployment
    result = {
        "status": "ok",
        "entrypoint": ep,
        "dependencies": dependencies,
        "secrets": secrets,
        "run_function": {
            "params": run_info["params"],
            "return_keys": run_info["return_keys"],
        },
    }  # type: Dict[str, Any]

    if existing_manifest is not None:
        result["existing_manifest"] = existing_manifest

    return result


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Check floom protocol compliance")
    parser.add_argument("project_path", help="Path to Python project")
    parser.add_argument("--entrypoint", help="Entrypoint file (auto-detected if omitted)")
    args = parser.parse_args()

    result = check_protocol(args.project_path, args.entrypoint)
    print(json.dumps(result, indent=2, default=str))
    sys.exit(0 if result["status"] == "ok" else 1)


if __name__ == "__main__":
    main()
