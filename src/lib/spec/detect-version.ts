/**
 * Detect the OpenAPI major.minor version from spec content.
 *
 * Handles both JSON and YAML formats. Returns the major.minor string
 * (e.g. '3.0' or '3.1'). Defaults to '3.0' when the version cannot
 * be determined so the upload step can proceed safely.
 *
 * @param content - Raw spec file content (JSON or YAML string).
 * @returns Major.minor version string, e.g. '3.0' or '3.1'.
 */
export function detectOpenApiVersion(content: string): string {
  // Try JSON first — covers the majority of machine-generated specs.
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const raw = typeof parsed.openapi === 'string' ? parsed.openapi : '';
    if (raw) return toMajorMinor(raw);
  } catch {
    // Not valid JSON — fall through to YAML regex.
  }

  // YAML: handles bare (openapi: 3.1.0) and quoted (openapi: "3.1.0") forms.
  const m = content.match(/^openapi:\s*["']?(3\.\d+(?:\.\d+)?)["']?/m);
  if (m?.[1]) return toMajorMinor(m[1]);

  return '3.0';
}

/**
 * Normalise a raw version string to major.minor only.
 * e.g. '3.1.0' → '3.1', '3.0.3' → '3.0'.
 */
function toMajorMinor(raw: string): string {
  const parts = raw.split('.');
  return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : '3.0';
}
