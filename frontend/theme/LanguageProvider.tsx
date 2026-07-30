import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import "dayjs/locale/fr";
import "dayjs/locale/pt";
import i18next from "../i18n";
import { DEFAULT_LANGUAGE, persistLanguage, readStoredLanguage } from "../utils/language";

interface LanguageContextValue {
  language: string;
  setLanguage: (language: string) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
});

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<string>(() => readStoredLanguage());

  useEffect(() => {
    persistLanguage(language);
    i18next.changeLanguage(language);
    dayjs.locale(language);
  }, [language]);

  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
};
