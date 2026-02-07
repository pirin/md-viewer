import React from 'react';
import { getMarkdownContent, formatName } from '@/lib/markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function ViewerPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const content = getMarkdownContent(slug);

  if (!content) {
    notFound();
  }

  return (
    <div className="max-w-6xl mx-auto px-8 py-16">
      <header className="mb-4 border-b border-[#1E1E1E] pb-10">
        <div className="flex items-center gap-2 text-[#666] text-xs font-mono mb-4">
          {slug.map((part, i) => (
            <React.Fragment key={i}>
              <span>{formatName(part).toUpperCase()}</span>
              {i < slug.length - 1 && <span className="text-[#333]">/</span>}
            </React.Fragment>
          ))}
        </div>
      </header>
      
      <article className="prose prose-invert prose-orange">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            // Handle links to other markdown files
            a: ({ href, children }) => {
              if (href && !href.startsWith('http') && (href.includes('.md') || href.startsWith('#'))) {
                // Handle internal page anchors
                if (href.startsWith('#')) return <a href={href}>{children}</a>;

                const [pathPart, hashPart] = href.split('#');
                const cleanPath = pathPart.replace(/\.md$/, '');
                const hash = hashPart ? `#${hashPart}` : '';
                
                // If it's a relative path, resolve it against the current slug
                if (!pathPart.startsWith('/')) {
                  const currentDir = slug.slice(0, -1);
                  const combinedParts = [...currentDir, ...cleanPath.split('/')];
                  
                  // Simple normalization for ../ and ./
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
          {content.content}
        </ReactMarkdown>
      </article>
    </div>
  );
}
