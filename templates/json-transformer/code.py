import csv
import io
import json


def run(data, operation, fields=""):
    """Convert data between formats."""
    if operation == "csv_to_json":
        return {"result": csv_to_json(data)}
    elif operation == "json_to_csv":
        return {"result": json_to_csv(data)}
    elif operation == "flatten":
        return {"result": flatten_json(data)}
    elif operation == "pick_fields":
        return {"result": pick_fields(data, fields)}
    else:
        return {"result": json.dumps({"error": f"Unknown operation: {operation}"})}


def csv_to_json(csv_data):
    reader = csv.DictReader(io.StringIO(csv_data.strip()))
    rows = list(reader)
    return json.dumps(rows, indent=2)


def json_to_csv(json_data):
    data = json.loads(json_data)
    if isinstance(data, dict):
        data = [data]
    if not data:
        return ""

    # Collect all keys across all rows
    all_keys = []
    seen = set()
    for row in data:
        for k in row:
            if k not in seen:
                all_keys.append(k)
                seen.add(k)

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=all_keys)
    writer.writeheader()
    for row in data:
        writer.writerow(row)
    return output.getvalue()


def flatten_json(json_data):
    data = json.loads(json_data)

    def _flatten(obj, prefix=""):
        items = {}
        if isinstance(obj, dict):
            for k, v in obj.items():
                new_key = f"{prefix}.{k}" if prefix else k
                items.update(_flatten(v, new_key))
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                new_key = f"{prefix}[{i}]"
                items.update(_flatten(v, new_key))
        else:
            items[prefix] = obj
        return items

    if isinstance(data, list):
        result = [_flatten(item) for item in data]
    else:
        result = _flatten(data)

    return json.dumps(result, indent=2)


def pick_fields(json_data, fields_str):
    data = json.loads(json_data)
    fields = [f.strip() for f in fields_str.split(",") if f.strip()]
    if not fields:
        return json.dumps({"error": "No fields specified. Provide comma-separated field names."})

    def _pick(obj):
        if isinstance(obj, dict):
            return {k: v for k, v in obj.items() if k in fields}
        return obj

    if isinstance(data, list):
        result = [_pick(item) for item in data]
    else:
        result = _pick(data)

    return json.dumps(result, indent=2)
