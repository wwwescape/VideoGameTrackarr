import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en/translation.json";
import es from "../locales/es/translation.json";
import fr from "../locales/fr/translation.json";
import pt from "../locales/pt/translation.json";
import { readStoredLanguage, DEFAULT_LANGUAGE } from "../utils/language";

i18next.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
    fr: { translation: fr },
    pt: { translation: pt },
  },
  lng: readStoredLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
});

export default i18next;
