import React from 'react';
import { Button } from '../ui/Button.tsx';
import { RefreshCw, User, Sparkles } from 'lucide-react';

export type NavTab = 'home' | 'dashboard' | 'profile' | 'autofill' | 'tracker' | 'auth' | 'chat';

interface NavbarProps {
  activeTab: NavTab;
  onNavigate: (tab: NavTab, profileId?: string | number) => void;
  profileId: string | number | null;
  profileName?: string | null;
  isAuthenticated?: boolean;
  onSwitchProfile: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onNavigate,
  profileId,
  profileName,
  isAuthenticated = false,
  onSwitchProfile,
}) => {
  const navItems: Array<{ id: NavTab; label: string }> = [
    { id: 'home', label: 'Home' },
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'chat', label: 'Chatbot' },
    { id: 'profile', label: profileId ? 'Profile' : isAuthenticated ? 'Setup Profile' : 'Get Started' },
    { id: 'autofill', label: 'Auto-Fill' },
    { id: 'tracker', label: 'Tracker' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#FBF6EE]/90 backdrop-blur-md border-b border-[#E9E1D3]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4 sm:gap-8">
        {/* Brand wordmark */}
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2 group text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F5A45]"
        >
          <span className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#1A1A1A] group-hover:text-[#1F5A45] transition-colors whitespace-nowrap shrink-0">
            Scholar<span className="text-[#E8622C] font-script font-bold text-3xl sm:text-4xl -ml-0.5">Pilot</span>
          </span>
          <span className="hidden sm:inline-block font-script text-xs text-[#E8622C] font-semibold transform rotate-3">
            ✦ human ai
          </span>
        </button>

        {/* Navigation links */}
        <nav className="hidden md:flex items-center gap-1.5 p-1 bg-[#FFFDF8] border border-[#E9E1D3] rounded-full shadow-xs">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id, profileId ?? undefined)}
                className={`px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-full transition-all duration-150 whitespace-nowrap cursor-pointer select-none ${
                  isActive
                    ? 'bg-[#F8E4E0] text-[#1A1A1A] shadow-xs font-semibold'
                    : 'text-[#5E5A52] hover:text-[#1A1A1A] hover:bg-[#FBF6EE]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Action / Profile Status */}
        <div className="flex items-center gap-3 shrink-0">
          {profileId ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => onNavigate('profile', profileId)}
                title="Edit Profile"
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FFFDF8] border border-[#E9E1D3] hover:border-[#1F5A45] transition-colors cursor-pointer text-xs font-semibold text-[#1A1A1A]"
              >
                <span className="w-2 h-2 rounded-full bg-[#2F8F6B]" />
                <span className="truncate max-w-[120px]">
                  {profileName || `Profile #${profileId}`}
                </span>
              </button>

              <button
                onClick={onSwitchProfile}
                title="Switch Profile / Sign Out"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[#5E5A52] hover:text-[#E8622C] hover:bg-[#F8E4E0] transition-colors cursor-pointer border border-[#E9E1D3] bg-[#FFFDF8]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Switch Account</span>
              </button>

              <Button
                variant="primary"
                size="sm"
                showArrow
                onClick={() => onNavigate('dashboard', profileId)}
                className="whitespace-nowrap shrink-0"
              >
                Find Schemes
              </Button>
            </div>
          ) : isAuthenticated ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFFDF8] border border-[#E9E1D3] text-xs font-semibold text-[#1A1A1A]">
                <span className="w-2 h-2 rounded-full bg-[#2F8F6B]" />
                <span className="truncate max-w-[120px]">{profileName || 'Scholar'}</span>
              </span>

              <button
                onClick={onSwitchProfile}
                title="Sign Out"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[#5E5A52] hover:text-[#D64545] hover:bg-[#FDECEB] transition-colors cursor-pointer border border-[#E9E1D3] bg-[#FFFDF8]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Sign Out</span>
              </button>

              <Button
                variant="primary"
                size="sm"
                showArrow
                onClick={() => onNavigate('profile')}
                className="whitespace-nowrap shrink-0"
              >
                Setup Profile
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate('auth')}
                className="hidden sm:inline-flex text-[#1A1A1A] hover:bg-[#F8E4E0]"
              >
                Sign In
              </Button>
              <Button
                variant="primary"
                size="sm"
                showArrow
                onClick={() => onNavigate('auth')}
                className="whitespace-nowrap shrink-0"
              >
                Get Started
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Nav Bar strip */}
      <div className="md:hidden flex items-center justify-around border-t border-[#E9E1D3] bg-[#FFFDF8] py-2 px-2">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id, profileId ?? undefined)}
              className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                isActive
                  ? 'bg-[#F8E4E0] text-[#1A1A1A] font-bold'
                  : 'text-[#5E5A52]'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};
