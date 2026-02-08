import path from 'path';
import packageJson from '../../package.json';

// --- Server-only config ---

export const contentDirs: string[] = (process.env.CONTENT_DIRS || '')
  .split(',')
  .map(d => d.trim())
  .filter(Boolean);

export const contentBaseDir: string =
  process.env.CONTENT_BASE_DIR || path.join(process.cwd(), '..');

export const filenameStripPrefixes: string[] = (process.env.NEXT_PUBLIC_FILENAME_STRIP_PREFIXES || '')
  .split(',')
  .map(p => p.trim())
  .filter(Boolean);

// --- Client-visible config (NEXT_PUBLIC_) ---

export const brandName = process.env.NEXT_PUBLIC_BRAND_NAME || 'MD';
export const brandAccent = process.env.NEXT_PUBLIC_BRAND_ACCENT || 'Viewer';
export const tagline = process.env.NEXT_PUBLIC_TAGLINE || 'MARKDOWN RESEARCH VIEWER';
export const version: string = packageJson.version;
export const siteTitle = process.env.NEXT_PUBLIC_SITE_TITLE || 'MD Viewer';
export const siteDescription = process.env.NEXT_PUBLIC_SITE_DESCRIPTION || 'Markdown Research Viewer';
export const storagePrefix = process.env.NEXT_PUBLIC_STORAGE_PREFIX || 'mdviewer';
