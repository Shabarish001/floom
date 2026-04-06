export function validateInputs(
  inputs: Record<string, unknown>,
  manifestInputs: Array<{ name: string; type: string; required?: boolean; description?: string }>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const field of manifestInputs) {
    const value = inputs[field.name];

    if (value === undefined || value === null) {
      if (field.required !== false) {
        errors.push(`Missing required field: "${field.name}" (${field.type})`);
      }
      continue;
    }

    switch (field.type) {
      case "string":
        if (typeof value !== "string") {
          errors.push(`Field "${field.name}" must be a string, got ${typeof value}`);
        }
        break;
      case "number":
        if (typeof value !== "number") {
          errors.push(`Field "${field.name}" must be a number, got ${typeof value}`);
        }
        break;
      case "boolean":
        if (typeof value !== "boolean") {
          errors.push(`Field "${field.name}" must be a boolean, got ${typeof value}`);
        }
        break;
      // file and json types pass through without validation
      case "file":
      case "json":
        break;
      default:
        // Unknown type — pass through
        break;
    }
  }

  return { valid: errors.length === 0, errors };
}
