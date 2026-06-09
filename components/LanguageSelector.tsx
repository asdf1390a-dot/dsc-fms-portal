'use client';

import { useLanguage } from '@/lib/i18n/context';
import { t } from '@/lib/i18n/translations';

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage();

  const langs: Array<{ code: 'ko' | 'en' | 'ta' | 'hi'; key: string }> = [
    { code: 'ko', key: 'lang.korean' },
    { code: 'en', key: 'lang.english' },
    { code: 'ta', key: 'lang.tamil' },
    { code: 'hi', key: 'lang.hindi' },
  ];
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {langs.map(({ code, key }) => (
        <button
          key={code}
          onClick={() => setLanguage(code)}
          className={`px-3 py-2 rounded font-medium transition ${
            language === code
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          style={{ minHeight: 44 }}
        >
          {t(key, language)}
        </button>
      ))}
    </div>
  );
}
