'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

let mermaidInitialized = false;

function initMermaid() {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    themeVariables: {
      darkMode: true,
      background: '#0A0A0A',
      primaryColor: '#FF8000',
      primaryTextColor: '#D1D1D1',
      primaryBorderColor: '#333',
      lineColor: '#666',
      secondaryColor: '#1A1A1A',
      tertiaryColor: '#111',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    },
  });
  mermaidInitialized = true;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.15;
const DEFAULT_HEIGHT = 400;
const MIN_HEIGHT = 150;
const CLICK_THRESHOLD = 5;

let counter = 0;

/**
 * Walk up the DOM from `el` looking for an edge-related element.
 * Mermaid v11 produces:
 *   - Edge lines:  <path class="edge-thickness-normal ... flowchart-link"> inside <g class="edgePaths">
 *   - Edge labels: <g class="edgeLabel"> → <g class="label"> → <foreignObject> → <span class="edgeLabel"> → <p>
 * Returns the highest meaningful edge element, or null.
 */
function findEdge(el: Element, boundary: Element | null): Element | null {
  let cur: Element | null = el;
  while (cur && cur !== boundary) {
    const cls = cur.getAttribute('class') || '';
    if (/edgeLabel|edgePath|flowchart-link|edge-hit-area/i.test(cls)) return cur;
    if ((cur.tagName === 'path' || cur.tagName === 'line') && cur.getAttribute('marker-end')) return cur;
    cur = cur.parentElement;
  }
  return null;
}

/**
 * Process the raw SVG string from mermaid.render() to inject interactive styles,
 * hit-area paths, and edge-to-node data attributes. Done at the string/DOM level
 * so modifications survive React re-renders (dangerouslySetInnerHTML wipes DOM mutations).
 */
function processMermaidSvg(rawSvg: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawSvg, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return rawSvg;

  // Inject a <style> block for interactive and highlight styles
  const style = doc.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = `
    path.flowchart-link, path[marker-end] { cursor: pointer; pointer-events: stroke; }
    .edge-hit-area { cursor: pointer; pointer-events: stroke; }
    .edgeLabel, span.edgeLabel { cursor: pointer; }
    
    /* Highlight Styles */
    [data-edge-highlighted] {
      filter: drop-shadow(0 0 6px var(--color-accent, #FF8000)) !important;
    }
    path[data-edge-highlighted], line[data-edge-highlighted] {
      stroke: var(--color-accent, #FF8000) !important;
      stroke-width: 3 !important;
    }
    g[data-edge-highlighted] rect {
      stroke: var(--color-accent, #FF8000) !important;
      stroke-width: 2 !important;
    }
    g[data-edge-highlighted] span, g[data-edge-highlighted] p, g[data-edge-highlighted] div {
      color: var(--color-accent, #FF8000) !important;
    }
  `;
  svg.prepend(style);

  // --- Gather node centers from their transform attributes ---
  const nodeEls = svg.querySelectorAll('g[class~="node"]');
  const nodeCenters: Array<{ id: string; x: number; y: number }> = [];
  nodeEls.forEach((n) => {
    if (!n.id) return;
    const t = (n.getAttribute('transform') || '').match(/translate\(\s*([\d.eE+-]+)\s*[,\s]\s*([\d.eE+-]+)/);
    if (t) nodeCenters.push({ id: n.id, x: parseFloat(t[1]), y: parseFloat(t[2]) });
  });

  const closestNode = (px: number, py: number): string => {
    let best = '', bestD = Infinity;
    for (const n of nodeCenters) {
      const d = (n.x - px) ** 2 + (n.y - py) ** 2;
      if (d < bestD) { bestD = d; best = n.id; }
    }
    return best;
  };

  // --- Clone edge paths as hit areas & add edge-to-node data attributes ---
  let edgeIdx = 0;
  svg.querySelectorAll('path.flowchart-link, path[marker-end]').forEach((p) => {
    if (p.closest('defs') || p.closest('marker')) return;
    const idx = edgeIdx++;

    // Parse path start/end for geometric node matching
    const d = p.getAttribute('d') || '';
    const startM = d.match(/^M\s*([\d.eE+-]+)\s*[,\s]\s*([\d.eE+-]+)/);
    const coords = [...d.matchAll(/([\d.eE+-]+)\s*[,\s]\s*([\d.eE+-]+)/g)];
    if (startM && coords.length > 0) {
      const last = coords[coords.length - 1];
      p.setAttribute('data-source-node', closestNode(parseFloat(startM[1]), parseFloat(startM[2])));
      p.setAttribute('data-target-node', closestNode(parseFloat(last[1]), parseFloat(last[2])));
    }
    p.setAttribute('data-edge-index', String(idx));

    // Create wider invisible hit area for easier clicking
    const hit = p.cloneNode(true) as SVGPathElement;
    hit.setAttribute('class', 'edge-hit-area');
    hit.setAttribute('style', 'stroke: transparent; stroke-width: 16; fill: none;');
    p.parentElement?.insertBefore(hit, p.nextSibling);
  });

  // Tag edge labels with their index for cross-referencing
  svg.querySelectorAll('g.edgeLabels > g.edgeLabel').forEach((label, i) => {
    label.setAttribute('data-edge-index', String(i));
  });

  return new XMLSerializer().serializeToString(svg);
}

export default function MermaidDiagram({ chart }: { chart: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const idRef = useRef(`mermaid-${++counter}`);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });

  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const resizing = useRef(false);
  const resizeStartY = useRef(0);
  const resizeStartH = useRef(0);

  const [fullscreen, setFullscreen] = useState(false);
  const [hasHighlights, setHasHighlights] = useState(false);
  const [highlightedIndices, setHighlightedIndices] = useState<Set<string>>(new Set());
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const dragDistance = useRef(0);

  // Track whether pointerDown landed on an edge (skip panning if so)
  const edgeClickTarget = useRef<Element | null>(null);

  useEffect(() => {
    initMermaid();
    let cancelled = false;

    // Optimize for vertical space: replace horizontal layouts (LR/RL) with Top-to-Bottom (TD)
    const optimizedChart = chart.replace(/^\s*(graph|flowchart|stateDiagram-v2|stateDiagram)\s+(LR|RL)/i, '$1 TD');

    mermaid.render(idRef.current, optimizedChart).then(
      ({ svg: renderedSvg }) => {
        if (!cancelled) {
          setSvg(processMermaidSvg(renderedSvg));
          setHasHighlights(false);
          setHighlightedIndices(new Set());
          setHighlightedNodes(new Set());
        }
      },
      (err) => {
        if (!cancelled) setError(String(err));
      }
    );
    return () => { cancelled = true; };
  }, [chart]);

  // Synchronize highlights to the DOM after every render
  useEffect(() => {
    const container = svgContainerRef.current;
    if (!container) return;

    // Clear old highlights first to ensure sync
    container.querySelectorAll('[data-edge-highlighted]').forEach((el) => {
      el.removeAttribute('data-edge-highlighted');
    });

    // Apply edge highlights
    highlightedIndices.forEach((idx) => {
      container.querySelectorAll(`[data-edge-index="${idx}"]`).forEach((el) => {
        el.setAttribute('data-edge-highlighted', '');
      });
    });

    // Apply node highlights
    highlightedNodes.forEach((nodeId) => {
      const nodeEl = container.querySelector(`g#${CSS.escape(nodeId)}`);
      if (nodeEl) nodeEl.setAttribute('data-edge-highlighted', '');
    });
  }, [svg, highlightedIndices, highlightedNodes, pan, zoom]); // Re-run on transform re-renders

  // Lock body scroll when fullscreen
  useEffect(() => {
    if (fullscreen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [fullscreen]);

  // Escape key exits fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z - e.deltaY * 0.002)));
  }, []);

  // ── Panning (only on empty space) ──────────────────────────────────────

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.target as Element;
    const edge = findEdge(target, svgContainerRef.current);

    dragDistance.current = 0;
    dragStart.current = { x: e.clientX, y: e.clientY };

    if (edge) {
      // Click landed on an edge — don't pan, store for highlight on pointerUp
      edgeClickTarget.current = edge;
      dragging.current = false;
      return;
    }

    // Empty space — start panning
    edgeClickTarget.current = null;
    dragging.current = true;
    panStart.current = { ...pan };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pan]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    dragDistance.current = Math.sqrt(dx * dx + dy * dy);
    if (!dragging.current) return;
    setPan({
      x: panStart.current.x + dx,
      y: panStart.current.y + dy,
    });
  }, []);

  const clearHighlights = useCallback(() => {
    setHighlightedIndices(new Set());
    setHighlightedNodes(new Set());
    setHasHighlights(false);
  }, []);

  const handlePointerUp = useCallback(() => {
    const wasClick = dragDistance.current < CLICK_THRESHOLD;

    if (dragging.current) {
      dragging.current = false;
      // Note: We no longer clear highlights on empty space clicks per user request
      return;
    }

    // If we stored an edge target at pointerDown, treat as edge click
    const edge = edgeClickTarget.current;
    edgeClickTarget.current = null;
    // Only highlight if it was a click, not a drag starting from an edge
    if (!edge || !wasClick || !svgContainerRef.current) return;

    const container = svgContainerRef.current;
    const edgeIndex = edge.getAttribute('data-edge-index');
    if (edgeIndex == null) return;

    const realPaths = Array.from(container.querySelectorAll('g.edgePaths > path.flowchart-link'));
    const edgePath = realPaths.find(p => p.getAttribute('data-edge-index') === edgeIndex);

    const src = edge.getAttribute('data-source-node') || edgePath?.getAttribute('data-source-node');
    const tgt = edge.getAttribute('data-target-node') || edgePath?.getAttribute('data-target-node');

    setHighlightedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(edgeIndex)) next.delete(edgeIndex);
      else next.add(edgeIndex);
      
      setHasHighlights(next.size > 0);
      return next;
    });

    if (src || tgt) {
      setHighlightedNodes((prev) => {
        const next = new Set(prev);
        // Note: For simplicity, we toggle node highlighting. 
        // In a more complex graph, we'd check if any other active edges use these nodes.
        if (src) {
          if (next.has(src)) next.delete(src);
          else next.add(src);
        }
        if (tgt) {
          if (next.has(tgt)) next.delete(tgt);
          else next.add(tgt);
        }
        return next;
      });
    }
  }, []); // Synchronization is handled by the useEffect

  // ── Resize ─────────────────────────────────────────────────────────────

  const handleResizePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizing.current = true;
    resizeStartY.current = e.clientY;
    resizeStartH.current = height;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [height]);

  const handleResizePointerMove = useCallback((e: React.PointerEvent) => {
    if (!resizing.current) return;
    const delta = e.clientY - resizeStartY.current;
    setHeight(Math.max(MIN_HEIGHT, resizeStartH.current + delta));
  }, []);

  const handleResizePointerUp = useCallback(() => {
    resizing.current = false;
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const toggleFullscreen = useCallback(() => {
    setFullscreen((f) => !f);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  if (error) {
    return (
      <pre className="text-red-400 bg-[#1A1A1A] p-4 rounded overflow-x-auto text-sm">
        <code>{chart}</code>
      </pre>
    );
  }

  if (!svg) {
    return <div className="text-[#666] py-4">Rendering diagram...</div>;
  }

  const zoomPct = Math.round(zoom * 100);

  const wrapperClass = fullscreen
    ? 'fixed inset-0 z-50 bg-[#0A0A0A] flex flex-col'
    : 'my-8 rounded border border-[#1E1E1E] bg-[#0A0A0A] relative group';

  // mermaid.render() produces sanitized SVG (uses DOMPurify internally)
  return (
    <div className={wrapperClass}>
      {/* Controls */}
      <div className={`absolute top-2 right-2 z-10 flex items-center gap-1 transition-opacity ${
        fullscreen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      }`}>
        {hasHighlights && (
          <button
            onClick={clearHighlights}
            className="h-7 px-2 flex items-center justify-center rounded bg-[#1A1A1A] hover:bg-[#333] text-[#999] hover:text-white text-xs transition-colors border border-[#333] font-medium"
            title="Clear highlights"
          >
            Clear
          </button>
        )}
        <button
          onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
          className="w-7 h-7 flex items-center justify-center rounded bg-[#1A1A1A] hover:bg-[#333] text-[#999] hover:text-white text-sm transition-colors"
          title="Zoom in"
        >
          +
        </button>
        <button
          onClick={resetView}
          className="h-7 px-2 flex items-center justify-center rounded bg-[#1A1A1A] hover:bg-[#333] text-[#999] hover:text-white text-xs font-mono tabular-nums transition-colors"
          title="Reset view"
        >
          {zoomPct}%
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
          className="w-7 h-7 flex items-center justify-center rounded bg-[#1A1A1A] hover:bg-[#333] text-[#999] hover:text-white text-sm transition-colors"
          title="Zoom out"
        >
          &minus;
        </button>
        <div className="w-px h-4 bg-[#333] mx-0.5" />
        <button
          onClick={toggleFullscreen}
          className="w-7 h-7 flex items-center justify-center rounded bg-[#1A1A1A] hover:bg-[#333] text-[#999] hover:text-white text-xs transition-colors"
          title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
        >
          {fullscreen ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polyline points="9,1 9,5 13,5" /><polyline points="5,13 5,9 1,9" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polyline points="9,5 13,5 13,1" /><polyline points="5,9 1,9 1,13" />
            </svg>
          )}
        </button>
      </div>

      {/* Viewport */}
      <div
        ref={viewportRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`overflow-hidden cursor-grab active:cursor-grabbing ${fullscreen ? 'flex-1' : ''}`}
        style={fullscreen ? undefined : { height }}
      >
        <div
          ref={svgContainerRef}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: dragging.current ? 'none' : 'transform 0.15s ease-out',
          }}
          // SVG is pre-sanitized by mermaid.render() via DOMPurify
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>

      {/* Resize handle — inline mode only */}
      {!fullscreen && (
        <div
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onPointerCancel={handleResizePointerUp}
          className="h-2 cursor-ns-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <div className="w-12 h-0.5 rounded-full bg-[#333]" />
        </div>
      )}
    </div>
  );
}
