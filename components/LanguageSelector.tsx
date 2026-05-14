'use client';

import { useLanguage } from '@/lib/i18n/context';
import { t } from '@/lib/i18n/translations';

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setLanguage('ko')}
        className={`px-3 py-2 rounded font-medium transition ${
          language === 'ko'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`}
      >
        {t('lang.korean', language)}
      </button>
      <button
        onClick={() => setLanguage('en')}
        className={`px-3 py-2 rounded font-medium transition ${
          language === 'en'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`}
      >
        {t('lang.english', language)}
      </button>
    </div>
  );
}
