export function assetUrl(path: string | undefined | null): string {
  if (!path) return '';
  if (/^(https?:|data:|blob:|\/\/)/i.test(path)) return path;
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
  const cleanPath = path.replace(/^\/+/, '');
  return `${base}/${cleanPath}`;
}
