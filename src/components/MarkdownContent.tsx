'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';
import MermaidDiagram from './MermaidDiagram';

export default function MarkdownContent({
  content,
  slug,
}: {
  content: string;
  slug: string[];
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code: ({ className, children, ...props }) => {
          const match = /language-(\w+)/.exec(className || '');
          const lang = match?.[1];

          if (lang === 'mermaid') {
            return <MermaidDiagram chart={String(children).trim()} />;
          }

          // For other fenced code blocks, render as-is
          if (lang) {
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          }

          // Inline code
          return <code {...props}>{children}</code>;
        },

        // Prevent wrapping mermaid diagrams in <pre>
        pre: ({ children }) => {
          const child = children as React.ReactElement<{ className?: string }>;
          if (child?.props?.className?.includes('language-mermaid')) {
            return <>{children}</>;
          }
          return <pre>{children}</pre>;
        },

        a: ({ href, children }) => {
          if (href && !href.startsWith('http') && (href.includes('.md') || href.startsWith('#'))) {
            if (href.startsWith('#')) return <a href={href}>{children}</a>;

            const [pathPart, hashPart] = href.split('#');
            const cleanPath = pathPart.replace(/\.md$/, '');
            const hash = hashPart ? `#${hashPart}` : '';

            if (!pathPart.startsWith('/')) {
              const currentDir = slug.slice(0, -1);
              const combinedParts = [...currentDir, ...cleanPath.split('/')];

              const normalizedParts: string[] = [];
              for (const part of combinedParts) {
                if (part === '..') {
                  normalizedParts.pop();
                } else if (part !== '.' && part !== '') {
                  normalizedParts.push(part);
                }
              }

              return <Link href={`/viewer/${normalizedParts.join('/')}${hash}`}>{children}</Link>;
            }

            return <Link href={`/viewer/${cleanPath}${hash}`}>{children}</Link>;
          }
          return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
