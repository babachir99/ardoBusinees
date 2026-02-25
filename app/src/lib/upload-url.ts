function normalizeUploadPath(path: string) {
  const trimmed = String(path ?? "").trim();
  const withoutPrefix = trimmed.replace(/^\/+uploads\//i, "").replace(/^\/+/, "");
  return withoutPrefix;
}

export function getPublicUploadUrl(path: string): string {
  const normalizedPath = normalizeUploadPath(path);
  const relative = `/uploads/${normalizedPath}`;
  const assetBase = process.env.PUBLIC_ASSET_BASE_URL?.trim();
  if (!assetBase) return relative;
  return new URL(relative, assetBase).toString();
}
