import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { cache } from 'react';
import { contentBaseDir, contentDirs, filenameStripPrefixes } from './config';

const BASE_DIR = contentBaseDir;
const CONTENT_DIRS = contentDirs;

export interface FileNode {
  name: string;
  slug: string;
  path: string;
  type: 'file' | 'directory';
  updatedAt: number;
  children?: FileNode[];
}

export const getFileTree = cache((): FileNode[] => {
  const tree: FileNode[] = [];

  CONTENT_DIRS.forEach((dir) => {
    const fullPath = path.join(BASE_DIR, dir);
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      tree.push({
        name: formatName(dir),
        slug: dir,
        path: dir,
        type: 'directory',
        updatedAt: stats.mtimeMs,
        children: scanDirectory(fullPath, dir),
      });
    }
  });

  return tree;
});

export function formatName(name: string): string {
  let result = name.replace(/\.md$/, '');
  for (const prefix of filenameStripPrefixes) {
    if (result.startsWith(prefix)) {
      result = result.slice(prefix.length);
      break;
    }
  }
  return result
    .replace(/[_-]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

const LAST_UPDATED_RE = /^\*Last Updated:\s*(.+)\*$/m;

function parseLastUpdated(filePath: string): number | null {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(256);
    fs.readSync(fd, buf, 0, 256, 0);
    fs.closeSync(fd);
    const head = buf.toString('utf8');
    const match = head.match(LAST_UPDATED_RE);
    if (match) {
      const ms = Date.parse(match[1]);
      if (!isNaN(ms)) return ms;
    }
  } catch {
    // fall through
  }
  return null;
}

function scanDirectory(dirPath: string, parentSlug: string): FileNode[] {
  const items = fs.readdirSync(dirPath);
  const nodes: FileNode[] = [];

  items.forEach((item) => {
    const fullPath = path.join(dirPath, item);
    const stats = fs.statSync(fullPath);
    const slug = `${parentSlug}/${item}`;

    if (stats.isDirectory()) {
      nodes.push({
        name: formatName(item),
        slug,
        path: slug,
        type: 'directory',
        updatedAt: stats.mtimeMs,
        children: scanDirectory(fullPath, slug),
      });
    } else if (item.endsWith('.md')) {
      nodes.push({
        name: formatName(item),
        slug: slug.replace(/\.md$/, ''),
        path: slug,
        type: 'file',
        updatedAt: parseLastUpdated(fullPath) ?? stats.mtimeMs,
      });
    }
  });

  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export const getMarkdownContent = cache((slugParts: string[]) => {
  const filePath = path.join(BASE_DIR, ...slugParts) + '.md';
  if (!fs.existsSync(filePath)) return null;

  const fileContent = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(fileContent);

  return {
    metadata: data,
    content,
    title: formatName(slugParts[slugParts.length - 1]),
  };
});

