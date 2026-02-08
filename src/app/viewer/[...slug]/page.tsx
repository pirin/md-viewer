import React from 'react';
import { getMarkdownContent, formatName } from '@/lib/markdown';
import { notFound } from 'next/navigation';
import MarkdownContent from '@/components/MarkdownContent';

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
        <MarkdownContent content={content.content} slug={slug} />
      </article>
    </div>
  );
}
