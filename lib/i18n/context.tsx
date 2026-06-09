'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Language } from './translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ko');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('language') as Language;
    if (saved && (saved === 'ko' || saved === 'en' || saved === 'ta' || saved === 'hi')) {
      setLanguageState(saved);
    }
    setMounted(true);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * Returns the current language context.
 *
 * Hook order must stay consistent on every render, so we always call useState
 * and useEffect — but they only matter when there's no provider above us
 * (Pages Router prerender, ad-hoc consumers). When a real provider exists,
 * its value is returned and the local fallback state is ignored.
 */
export function useLanguage() {
  const provided = useContext(LanguageContext);
  const [fallbackLang, setFallbackLang] = useState<Language>('ko');

  useEffect(() => {
    if (provided) return;
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('language') as Language | null;
    if (saved && (saved === 'ko' || saved === 'en' || saved === 'ta' || saved === 'hi')) {
      setFallbackLang(saved);
    }
  }, [provided]);

  if (provided) return provided;

  const setLanguage = (lang: Language) => {
    setFallbackLang(lang);
    if (typeof window !== 'undefined') localStorage.setItem('language', lang);
  };
  return { language: fallbackLang, setLanguage };
}
