'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { brandName, brandAccent, tagline } from '@/lib/config';

export default function LoginPage() {
  const [password, setPassword] = React.useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // In a real app, this would be a server action, 
    // but for "very simple" we can set cookie on client if we don't care about extreme security
    // Actually let's do it properly with a cookie set.
    document.cookie = `session=${password}; path=/; max-age=86400; samesite=lax`;
    router.push('/');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm border border-[#1E1E1E] bg-[#0A0A0A] p-8 rounded-lg">
        <div className="mb-8 text-center">
          <h1 className="text-white font-bold text-2xl tracking-tighter flex items-center justify-center gap-2">
            {brandName}<span className="text-accent">{brandAccent}</span>
          </h1>
          <p className="text-[#888] text-sm mt-2 font-mono">{tagline}</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="ENTER PASSWORD"
              className="w-full bg-black border border-[#333] px-4 py-3 text-white focus:border-accent outline-none font-mono text-center placeholder:text-[#333]"
              required
            />
          </div>
          
          <button
            type="submit"
            className="w-full bg-accent text-black font-bold py-3 hover:bg-[#FF9500] transition-colors"
          >
            ACCESS TERMINAL
          </button>
        </form>
      </div>
    </div>
  );
}
