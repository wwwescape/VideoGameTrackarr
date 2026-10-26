import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isAuthenticated, updatePreferences } from "../api/auth";
import { currentUserQueryKey, useCurrentUser } from "../hooks/useAuth";
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

// The display currency is saved on the account, so every browser and device shows the same
// one. This browser's copy (localStorage) is only a cache for the first paint and for pages
// without an account (the share pages): once the signed-in user loads, the account's currency
// wins — or, for an account that has none yet, this browser's earlier choice is saved to it.
export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [currency, setLocalCurrency] = useState<string>(() => readStoredCurrency());
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const copiedUp = useRef(false);

  useEffect(() => {
    localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
  }, [currency]);

  const save = useCallback(
    (next: string) => {
      void updatePreferences({ currency: next })
        .then((updated) => queryClient.setQueryData(currentUserQueryKey, updated))
        .catch(() => {
          // Kept in this browser either way; the next change tries the account again.
        });
    },
    [queryClient]
  );

  useEffect(() => {
    if (!user) return;
    if (user.currency && SUPPORTED_CODES.has(user.currency)) {
      setLocalCurrency(user.currency);
    } else if (!user.currency && !copiedUp.current) {
      copiedUp.current = true;
      save(readStoredCurrency());
    }
  }, [user, save]);

  const setCurrency = useCallback(
    (next: string) => {
      setLocalCurrency(next);
      if (isAuthenticated()) save(next);
    },
    [save]
  );

  return <CurrencyContext.Provider value={{ currency, setCurrency }}>{children}</CurrencyContext.Provider>;
};
