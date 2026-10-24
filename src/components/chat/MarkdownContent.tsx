import React from 'react';
import { ExternalLink, Award, Calendar, CheckCircle2, AlertCircle, FileText, Sparkles } from 'lucide-react';

interface MarkdownContentProps {
  content: string;
}

/**
 * Helper to parse inline markdown (bold, links, code, regular text)
 */
function renderInlineFormatted(text: string): React.ReactNode {
  // Pattern to match **bold**, [link](url), and `code`
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    // 1. Markdown link: [text](url)
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
    // 2. Bold text: **text**
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    // 3. Inline code: `code`
    const codeMatch = remaining.match(/`([^`]+)`/);

    const matches = [
      linkMatch ? { type: 'link', index: linkMatch.index!, match: linkMatch } : null,
      boldMatch ? { type: 'bold', index: boldMatch.index!, match: boldMatch } : null,
      codeMatch ? { type: 'code', index: codeMatch.index!, match: codeMatch } : null,
    ]
      .filter(Boolean)
      .sort((a, b) => a!.index - b!.index);

    if (matches.length === 0) {
      parts.push(remaining);
      break;
    }

    const first = matches[0]!;
    // Add text before match
    if (first.index > 0) {
      parts.push(remaining.substring(0, first.index));
    }

    if (first.type === 'link') {
      const linkText = first.match[1];
      const linkUrl = first.match[2];
      parts.push(
        <a
          key={`link-${keyIdx++}`}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-[#1F5A45] hover:text-[#E8622C] underline decoration-[#1F5A45]/40 hover:decoration-[#E8622C] transition-colors break-all"
        >
          <span>{linkText}</span>
          <ExternalLink className="w-3 h-3 inline-block shrink-0" />
        </a>
      );
      remaining = remaining.substring(first.index + first.match[0].length);
    } else if (first.type === 'bold') {
      const boldText = first.match[1];
      parts.push(
        <strong key={`bold-${keyIdx++}`} className="font-bold text-[#1A1A1A]">
          {boldText}
        </strong>
      );
      remaining = remaining.substring(first.index + first.match[0].length);
    } else if (first.type === 'code') {
      const codeText = first.match[1];
      parts.push(
        <code
          key={`code-${keyIdx++}`}
          className="px-1.5 py-0.5 rounded bg-[#F1EFEA] text-xs font-mono text-[#E8622C]"
        >
          {codeText}
        </code>
      );
      remaining = remaining.substring(first.index + first.match[0].length);
    }
  }

  return <>{parts}</>;
}

interface SchemeSection {
  title: string;
  award?: string;
  deadline?: string;
  portalLink?: string;
  portalUrl?: string;
  steps: string[];
  documents?: string[];
  extraLines: string[];
}

export const MarkdownContent: React.FC<MarkdownContentProps> = ({ content }) => {
  // If no content
  if (!content || !content.trim()) return null;

  // Split content by major sections using ###
  const lines = content.split('\n');
  const sections: React.ReactNode[] = [];

  let currentBlockType: 'intro' | 'scheme' | 'tips' | 'general' = 'intro';
  let buffer: string[] = [];
  let blockKey = 0;

  const flushBuffer = () => {
    if (buffer.length === 0) return;

    if (currentBlockType === 'intro') {
      const text = buffer.join('\n').trim();
      if (text) {
        sections.push(
          <div key={`intro-${blockKey++}`} className="space-y-2.5 text-sm sm:text-base text-[#3A3834] leading-relaxed">
            {text.split('\n\n').map((para, i) => (
              <p key={i} className="text-balance">
                {renderInlineFormatted(para)}
              </p>
            ))}
          </div>
        );
      }
    } else if (currentBlockType === 'scheme') {
      const rawText = buffer.join('\n');
      const scheme = parseSchemeBlock(rawText);
      sections.push(renderSchemeCard(scheme, blockKey++));
    } else if (currentBlockType === 'tips') {
      const rawText = buffer.join('\n');
      sections.push(renderTipsCard(rawText, blockKey++));
    } else {
      const text = buffer.join('\n').trim();
      if (text) {
        sections.push(
          <div key={`gen-${blockKey++}`} className="space-y-2 text-sm sm:text-base text-[#3A3834] leading-relaxed">
            {text.split('\n\n').map((para, i) => (
              <p key={i}>{renderInlineFormatted(para)}</p>
            ))}
          </div>
        );
      }
    }

    buffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('### ')) {
      flushBuffer();

      const headerTitle = line.replace(/^###\s+/, '').trim();
      // Check if this is a scholarship section (starts with number e.g. "1. Central Sector...")
      if (/^\d+\.\s+/.test(headerTitle)) {
        currentBlockType = 'scheme';
        buffer.push(line);
      } else if (headerTitle.toLowerCase().includes('tip') || headerTitle.includes('📝')) {
        currentBlockType = 'tips';
        buffer.push(line);
      } else {
        currentBlockType = 'general';
        buffer.push(line);
      }
    } else {
      buffer.push(line);
    }
  }

  flushBuffer();

  return <div className="space-y-6 text-[#1A1A1A]">{sections}</div>;
};

/**
 * Parses a structured scheme section block
 */
function parseSchemeBlock(raw: string): SchemeSection {
  const lines = raw.split('\n');
  const firstLine = lines[0] || '';
  const title = firstLine.replace(/^###\s+/, '').trim();

  let award: string | undefined;
  let deadline: string | undefined;
  let portalLink: string | undefined;
  let portalUrl: string | undefined;
  const steps: string[] = [];
  const documents: string[] = [];
  const extraLines: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue;

    // Check Award
    const awardMatch = l.match(/\*\*Award:\*\*\s*(.+)/i);
    if (awardMatch) {
      award = awardMatch[1].trim();
      continue;
    }

    // Check Deadline
    const deadlineMatch = l.match(/\*\*Deadline:\*\*\s*(.+)/i);
    if (deadlineMatch) {
      deadline = deadlineMatch[1].trim();
      continue;
    }

    // Check Portal Link
    const linkMatch = l.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch && (l.toLowerCase().includes('portal') || l.toLowerCase().includes('visit'))) {
      portalLink = linkMatch[1];
      portalUrl = linkMatch[2];
    }

    // Check numbered step
    const stepMatch = l.match(/^(\d+)\.\s+(.+)/);
    if (stepMatch) {
      steps.push(stepMatch[2].trim());
      continue;
    }

    if (!l.toLowerCase().includes('**how to apply:**')) {
      extraLines.push(l.replace(/^\*\s+/, ''));
    }
  }

  return { title, award, deadline, portalLink, portalUrl, steps, documents, extraLines };
}

/**
 * Renders a high-finish Card for a specific scholarship scheme
 */
function renderSchemeCard(scheme: SchemeSection, key: number) {
  // Extract number from title if present (e.g. "1. Central Sector...")
  const numMatch = scheme.title.match(/^(\d+)\.\s+(.+)/);
  const numBadge = numMatch ? numMatch[1] : null;
  const cleanTitle = numMatch ? numMatch[2] : scheme.title;

  return (
    <div
      key={`scheme-card-${key}`}
      className="p-5 sm:p-6 rounded-2xl bg-[#FFFDF8] border border-[#E9E1D3] shadow-xs hover:border-[#1F5A45]/40 transition-all space-y-4"
    >
      {/* Top Header: Badge + Title + Key Pills */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-[#E9E1D3]/80">
        <div className="flex items-start gap-2.5">
          {numBadge && (
            <span className="w-7 h-7 rounded-full bg-[#1F5A45] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              0{numBadge}
            </span>
          )}
          <div>
            <h3 className="font-serif text-lg sm:text-xl font-bold text-[#1A1A1A] leading-snug">
              {cleanTitle}
            </h3>
          </div>
        </div>

        {/* Badges: Award + Deadline */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {scheme.award && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EDF8F3] text-[#1F5A45] border border-[#2F8F6B]/30 text-xs font-bold whitespace-nowrap">
              <Award className="w-3.5 h-3.5 text-[#2F8F6B]" />
              <span>{scheme.award}</span>
            </span>
          )}

          {scheme.deadline && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEF8EA] text-[#E0A12B] border border-[#E0A12B]/30 text-xs font-semibold whitespace-nowrap">
              <Calendar className="w-3.5 h-3.5 text-[#E0A12B]" />
              <span>{scheme.deadline}</span>
            </span>
          )}
        </div>
      </div>

      {/* Step by Step Application Procedure */}
      {scheme.steps.length > 0 && (
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#5E5A52]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#1F5A45]" />
            <span>Step-by-Step Application Guide</span>
          </div>

          <div className="space-y-2 pl-1">
            {scheme.steps.map((stepText, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-[#3A3834] leading-relaxed">
                <span className="w-5 h-5 rounded-md bg-[#F1EFEA] text-[#5E5A52] font-semibold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <div className="flex-1">
                  {renderInlineFormatted(stepText)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extra lines / bullet notes if any */}
      {scheme.extraLines.length > 0 && (
        <div className="space-y-1 text-xs text-[#5E5A52] pt-1">
          {scheme.extraLines.map((el, i) => (
            <p key={i}>{renderInlineFormatted(el)}</p>
          ))}
        </div>
      )}

      {/* Action Footer: Visit Official Portal */}
      {scheme.portalUrl && (
        <div className="pt-2 flex items-center justify-between border-t border-[#E9E1D3]/50">
          <a
            href={scheme.portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1F5A45] hover:bg-[#153f30] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <span>Visit Official Application Portal</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <span className="hidden sm:inline-block text-[11px] text-[#5E5A52]">
            Direct verified government link
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Renders the Important Tips section with an editorial sticky-card aesthetic
 */
function renderTipsCard(raw: string, key: number) {
  const lines = raw.split('\n');
  const title = lines[0].replace(/^###\s+/, '').trim();
  const tipBullets = lines.slice(1).filter((l) => l.trim().length > 0);

  return (
    <div
      key={`tips-card-${key}`}
      className="p-5 sm:p-6 rounded-2xl bg-[#FFFDF0] border-2 border-[#E9E1D3] border-dashed shadow-xs space-y-3 relative overflow-hidden"
    >
      {/* Decorative corner tape */}
      <div className="absolute -top-3 left-6 w-16 h-6 bg-[#F3DE9A]/80 -rotate-3 pointer-events-none rounded-xs shadow-2xs" />

      <div className="flex items-center gap-2 text-[#E8622C] pt-1">
        <Sparkles className="w-4 h-4 text-[#E8622C]" />
        <h4 className="font-serif text-base sm:text-lg font-bold text-[#1A1A1A]">
          {title}
        </h4>
      </div>

      <div className="space-y-2.5">
        {tipBullets.map((bullet, idx) => {
          const clean = bullet.replace(/^\*\s+/, '').trim();
          return (
            <div key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-[#3A3834] leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E8622C] shrink-0 mt-2" />
              <div>{renderInlineFormatted(clean)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
