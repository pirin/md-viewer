'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileNode } from '@/lib/markdown';
import { FileText, Folder, ChevronRight, ChevronDown, Star } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useFavorites, FilterMode } from '@/hooks/useFavorites';
import { brandName, brandAccent, version } from '@/lib/config';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function filterTreeByFavorites(nodes: FileNode[], favorites: Set<string>): FileNode[] {
  return nodes
    .map(node => {
      if (node.type === 'file') {
        return favorites.has(node.slug) ? node : null;
      }
      // Directory: recursively filter children
      const filteredChildren = filterTreeByFavorites(node.children || [], favorites);
      if (filteredChildren.length === 0) {
        return null; // Prune empty directories
      }
      return { ...node, children: filteredChildren };
    })
    .filter((node): node is FileNode => node !== null);
}

interface SidebarProps {
  tree: FileNode[];
  recentDays?: number;
}

export default function Sidebar({ tree, recentDays = 7 }: SidebarProps) {
  const [now] = React.useState(() => Date.now());
  const { favorites, filterMode, setFilterMode, toggleFavorite, isFavorite, favoritesCount } = useFavorites();

  const displayTree = React.useMemo(() => {
    if (filterMode === 'all') return tree;
    return filterTreeByFavorites(tree, favorites);
  }, [tree, filterMode, favorites]);

  return (
    <aside className="w-64 bg-[#0A0A0A] border-r border-[#1E1E1E] h-screen overflow-y-auto flex flex-col">
      <div className="p-4 flex-1 overflow-y-auto">
        <div className="mb-8 px-2">
          <h1 className="text-white font-bold text-xl tracking-tighter flex items-center gap-2">
            {brandName}<span className="text-accent">{brandAccent}</span>
            <span className="text-[10px] bg-[#1E1E1E] px-1 rounded text-[#888] font-mono">v{version}</span>
          </h1>
        </div>
        <nav className="space-y-1">
          {displayTree.length === 0 && filterMode === 'favorites' ? (
            <p className="text-[#666] text-sm px-2 py-4">
              No favorites yet. Star reports to add them here.
            </p>
          ) : (
            displayTree.map((node) => (
              <SidebarNode
                key={node.path}
                node={node}
                depth={0}
                recentDays={recentDays}
                now={now}
                isFavorite={isFavorite}
                toggleFavorite={toggleFavorite}
              />
            ))
          )}
        </nav>
      </div>
      <SidebarFooter
        filterMode={filterMode}
        setFilterMode={setFilterMode}
        favoritesCount={favoritesCount}
      />
    </aside>
  );
}

interface SidebarNodeProps {
  node: FileNode;
  depth: number;
  recentDays: number;
  now: number;
  isFavorite: (slug: string) => boolean;
  toggleFavorite: (slug: string) => void;
}

const SidebarNode = React.memo(function SidebarNode({
  node,
  depth,
  recentDays,
  now,
  isFavorite,
  toggleFavorite,
}: SidebarNodeProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = React.useState(true);
  const [isHovered, setIsHovered] = React.useState(false);
  const isActive = pathname === `/viewer/${node.slug}`;
  const favorited = node.type === 'file' && isFavorite(node.slug);

  const isRecent = React.useMemo(() => {
    if (node.type !== 'file') return false;
    const threshold = recentDays * 24 * 60 * 60 * 1000;
    return (now - node.updatedAt) < threshold;
  }, [node.updatedAt, node.type, recentDays, now]);

  if (node.type === 'directory') {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-semibold text-[#888] hover:text-white transition-colors"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Folder size={14} className="text-[#555]" />
          {node.name}
        </button>
        {isOpen && node.children && (
          <div className="mt-1">
            {node.children.map((child) => (
              <SidebarNode
                key={child.path}
                node={child}
                depth={depth + 1}
                recentDays={recentDays}
                now={now}
                isFavorite={isFavorite}
                toggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link
        href={`/viewer/${node.slug}`}
        className={cn(
          "flex-1 flex items-center gap-2 px-2 py-1.5 text-sm transition-colors rounded",
          isActive
            ? "bg-[#1E1E1E] text-white border-l-2 border-accent"
            : "text-[#AAA] hover:text-white hover:bg-[#111]"
        )}
        style={{ paddingLeft: `${depth * 12 + 24}px` }}
      >
        <FileText size={14} className={isActive ? "text-accent" : "text-[#555]"} />
        <span className="flex-1 truncate">{node.name}</span>
        {(isHovered || favorited) && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFavorite(node.slug);
            }}
            className="p-0.5 hover:scale-110 transition-transform"
            title={favorited ? "Remove from favorites" : "Add to favorites"}
          >
            <Star
              size={12}
              className={favorited ? "fill-[#997700] text-[#997700]" : "text-[#444] hover:text-[#666]"}
            />
          </button>
        )}
        {isRecent && (
          <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" title="Recently updated" />
        )}
      </Link>
    </div>
  );
});

interface SidebarFooterProps {
  filterMode: FilterMode;
  setFilterMode: (mode: FilterMode) => void;
  favoritesCount: number;
}

function SidebarFooter({ filterMode, setFilterMode, favoritesCount }: SidebarFooterProps) {
  return (
    <div className="border-t border-[#1E1E1E] p-3 flex gap-2">
      <button
        onClick={() => setFilterMode('all')}
        className={cn(
          "flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors",
          filterMode === 'all'
            ? "bg-accent text-black"
            : "bg-[#1E1E1E] text-[#888] hover:text-white"
        )}
      >
        All
      </button>
      <button
        onClick={() => setFilterMode('favorites')}
        className={cn(
          "flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors",
          filterMode === 'favorites'
            ? "bg-accent text-black"
            : "bg-[#1E1E1E] text-[#888] hover:text-white"
        )}
      >
        Favorites{favoritesCount > 0 ? ` (${favoritesCount})` : ''}
      </button>
    </div>
  );
}
