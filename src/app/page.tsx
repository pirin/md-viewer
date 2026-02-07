import Link from 'next/link';
import { getFileTree } from '@/lib/markdown';
import { brandName, brandAccent, tagline } from '@/lib/config';

export default function Home() {
  const tree = getFileTree();

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center">
      <div className="max-w-md">
        <h1 className="text-5xl font-bold text-white tracking-tighter mb-4">
          {brandName}<span className="text-accent">{brandAccent}</span>
        </h1>
        <p className="text-[#888] font-mono text-sm mb-8 leading-relaxed">
          {tagline}
          <br />
          SELECT A REPORT FROM THE SIDEBAR TO BEGIN ANALYSIS
        </p>
        
        <div className="grid grid-cols-1 gap-4 text-left">
          {tree.map(group => (
            <div key={group.slug} className="border border-[#1E1E1E] p-4 bg-[#0A0A0A] rounded">
              <h2 className="text-white font-bold text-xs font-mono mb-2 uppercase tracking-widest text-[#555]">
                {group.name}
              </h2>
              <div className="flex flex-wrap gap-2">
                {group.children?.slice(0, 5).map(child => (
                  <Link 
                    key={child.slug} 
                    href={`/viewer/${child.slug}`}
                    className="text-[10px] bg-[#1A1A1A] px-2 py-1 rounded text-[#AAA] hover:text-accent border border-transparent hover:border-accent transition-all"
                  >
                    {child.name}
                  </Link>
                ))}
                {group.children && group.children.length > 5 ? (
                  <span className="text-[10px] text-[#444] self-center">...</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}