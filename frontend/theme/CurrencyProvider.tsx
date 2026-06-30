import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from "../utils/currency";

interface CurrencyContextValue {
  currency: string;
  setCurrency: (currency: string) => void;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: DEFAULT_CURRENCY,
  setCurrency: () => {},
});

export const useCurrency = () => useContext(CurrencyContext);

const CURRENCY_STORAGE_KEY = "vgt.currency";
const SUPPORTED_CODES = new Set(SUPPORTED_CURRENCIES.map((option) => option.code));

function readStoredCurrency(): string {
  const stored = localStorage.getItem(CURRENCY_STORAGE_KEY);
  return stored && SUPPORTED_CODES.has(stored) ? stored : DEFAULT_CURRENCY;
}

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [currency, setCurrency] = useState<string>(() => readStoredCurrency());

  useEffect(() => {
    localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
  }, [currency]);

  return <CurrencyContext.Provider value={{ currency, setCurrency }}>{children}</CurrencyContext.Provider>;
};
