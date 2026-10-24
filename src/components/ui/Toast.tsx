import React from 'react';
import { Check, AlertCircle, X, Sparkles } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'error';
  title: string;
  message?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm pointer-events-none">
      {toasts.map((t) => {
        const isSuccess = t.type === 'success';
        const isError = t.type === 'error';

        return (
          <div
            key={t.id}
            className={`pointer-events-auto paper-card p-4 shadow-xl border flex items-start gap-3 transition-all duration-200 transform translate-y-0 ${
              isSuccess
                ? 'bg-[#EDF8F3] border-[#2F8F6B]/40'
                : isError
                ? 'bg-[#FDECEB] border-[#D64545]/40'
                : 'bg-[#FFFDF8] border-[#E9E1D3]'
            }`}
            style={{ transform: 'rotate(-0.8deg)' }}
          >
            {/* Small tape detail on top of sticky note toast */}
            <div
              className="absolute -top-2 left-8 w-10 h-3 bg-white/70 border border-black/5 rounded-xs"
              style={{ backdropFilter: 'blur(1px)' }}
            />

            <div className="mt-0.5 shrink-0">
              {isSuccess ? (
                <Check className="w-4 h-4 text-[#2F8F6B]" />
              ) : isError ? (
                <AlertCircle className="w-4 h-4 text-[#D64545]" />
              ) : (
                <Sparkles className="w-4 h-4 text-[#E8622C]" />
              )}
            </div>

            <div className="flex-1">
              <h4 className="font-serif font-bold text-xs text-[#1A1A1A]">
                {t.title}
              </h4>
              {t.message && (
                <p className="text-xs text-[#5E5A52] font-medium mt-0.5">
                  {t.message}
                </p>
              )}
            </div>

            <button
              onClick={() => onDismiss(t.id)}
              className="text-[#5E5A52] hover:text-[#1A1A1A] p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
