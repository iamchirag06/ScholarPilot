import React, { useState } from 'react';
import { User } from '../types/index.ts';
import { login, register } from '../services/api.ts';
import { Button } from '../components/ui/Button.tsx';
import { StickyNote } from '../components/decorative/StickyNote.tsx';
import { Scribble } from '../components/decorative/Scribble.tsx';
import { Mail, Lock, User as UserIcon, Sparkles } from 'lucide-react';

interface AuthPageProps {
  onSuccess: (user: User) => void;
  onCancel?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onSuccess, onCancel }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      let user: User;
      if (isRegister) {
        user = await register(email, password, fullName);
      } else {
        user = await login(email, password);
      }
      onSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="py-12 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-lg mx-auto">
      {/* Paper Card with Pastel Blob Accent */}
      <div className="paper-card p-6 sm:p-10 relative">
        {/* Soft pastel blob behind top */}
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-[#F6B7C1] opacity-50 blur-xl pointer-events-none" />

        <div className="text-center mb-8">
          <span className="font-script text-2xl text-[#E8622C] font-bold block mb-1 transform -rotate-1">
            {isRegister ? 'Start fresh with us ✦' : 'Welcome back ✦'}
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#1A1A1A] tracking-tight">
            {isRegister ? 'Create Scholar Account' : 'Sign in to ScholarPilot'}
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-[#5E5A52]">
            Keep your matched scholarships and application tracker synchronized.
          </p>
        </div>

        {error && (
          <div className="p-3 mb-6 rounded-lg bg-[#FDECEB] border border-[#D64545]/30 text-xs text-[#D64545] font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#5E5A52] mb-1.5">
                Full Name / Username
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-[#5E5A52] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Abhi"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#FBF6EE] border border-[#E9E1D3] text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#1F5A45]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#5E5A52] mb-1.5">
              {isRegister ? 'Email Address' : 'Username or Email'}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#5E5A52] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isRegister ? 'you@example.edu.in' : 'e.g. abhi or riya@example.edu.in'}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#FBF6EE] border border-[#E9E1D3] text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#1F5A45]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#5E5A52] mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#5E5A52] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#FBF6EE] border border-[#E9E1D3] text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#1F5A45]"
              />
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              showArrow
              disabled={isLoading}
              className="w-full bg-[#1A1A1A] text-white shadow-md cursor-pointer"
            >
              {isLoading
                ? 'Please wait...'
                : isRegister
                ? 'Create Account & Continue'
                : 'Sign In & Continue'}
            </Button>
          </div>
        </form>

        <div className="mt-6 pt-4 border-t border-[#E9E1D3] flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="text-xs text-[#5E5A52] hover:text-[#1A1A1A] underline font-semibold cursor-pointer"
          >
            {isRegister
              ? 'Already have an account? Sign In'
              : "Don't have an account yet? Register here"}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-[#5E5A52]/80 hover:text-[#E8622C] cursor-pointer mt-1"
            >
              ← Back to Home
            </button>
          )}
        </div>
      </div>

      {/* Sticky Note Advice */}
      <div className="mt-6 max-w-xs mx-auto">
        <StickyNote color="yellow" rotation={2} tape author="Security Note">
          All data encrypted. No ads, no agents selling leads.
        </StickyNote>
      </div>
    </div>
  );
};
