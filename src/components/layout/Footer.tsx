import React from 'react';
import { Scribble } from '../decorative/Scribble.tsx';
import { Heart, Compass, Github, Twitter, Linkedin, Mail } from 'lucide-react';

interface FooterProps {
  onNavigate?: (tab: any) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-[#17261F] text-[#FFFDF8] pt-16 pb-12 relative overflow-hidden border-t-2 border-[#1F5A45]">
      {/* Background soft ink doodle */}
      <div className="absolute top-6 right-8 opacity-20 pointer-events-none">
        <Scribble variant="loop" size={120} color="#F3DE9A" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-[#1F5A45]/40">
          {/* Col 1: Wordmark & human mission */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="font-serif text-3xl font-bold tracking-tight text-white">
                Scholar<span className="font-script text-4xl text-[#E8622C]">Pilot</span>
              </span>
            </div>
            <p className="text-sm text-[#A9DCC3] max-w-md leading-relaxed font-sans mb-4">
              AI-powered scholarship discovery for Indian students. We crawl government portals and private trusts so you don’t have to, translating pages of legalese into single plain-English sentences.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1F5A45]/40 border border-[#2F8F6B]/30 text-xs text-[#A9DCC3]">
              <span className="w-2 h-2 rounded-full bg-[#2F8F6B]" />
              <span>Independent Open Student Discovery Engine</span>
            </div>
          </div>

          {/* Col 2: Navigation */}
          <div>
            <h4 className="font-serif text-base font-bold text-white mb-3 tracking-wide">
              Navigation
            </h4>
            <ul className="space-y-2 text-sm text-[#A9DCC3]/80">
              <li>
                <button
                  onClick={() => onNavigate?.('home')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate?.('dashboard')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Matched Scholarships
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate?.('profile')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Student Profile Form
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate?.('autofill')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Auto-Fill Demo
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate?.('tracker')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Application Tracker Board
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Portals Covered */}
          <div>
            <h4 className="font-serif text-base font-bold text-white mb-3 tracking-wide">
              Supported Portals
            </h4>
            <ul className="space-y-2 text-sm text-[#A9DCC3]/80">
              <li>National Scholarship Portal (NSP)</li>
              <li>Har-Chhatravratti (Haryana)</li>
              <li>e-District Delhi Govt</li>
              <li>Reliance Foundation Trust</li>
              <li>AICTE Pragati Portal</li>
              <li>Tata & Aditya Birla Trusts</li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright + Signature Handwritten Sign-Off */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-[#A9DCC3]/60">
            © {new Date().getFullYear()} ScholarPilot. Crafted for students across India.
          </div>

          {/* Handwritten Sign-Off */}
          <div className="font-script text-2xl text-[#F9C6A5] tracking-wide flex items-center gap-1.5 font-bold">
            <span>Stay curious. Stay human.</span>
            <span className="text-[#E8622C]">♡</span>
          </div>

          <div className="flex items-center gap-4 text-[#A9DCC3]/70">
            <span className="hover:text-white cursor-pointer transition-colors" title="Twitter">
              <Twitter className="w-4 h-4" />
            </span>
            <span className="hover:text-white cursor-pointer transition-colors" title="GitHub">
              <Github className="w-4 h-4" />
            </span>
            <span className="hover:text-white cursor-pointer transition-colors" title="LinkedIn">
              <Linkedin className="w-4 h-4" />
            </span>
            <span className="hover:text-white cursor-pointer transition-colors" title="Contact Team">
              <Mail className="w-4 h-4" />
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
