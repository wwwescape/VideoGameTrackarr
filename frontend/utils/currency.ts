export interface CurrencyOption {
  code: string;
  name: string;
}

// A curated set of common currencies — not exhaustive (ISO 4217 has ~180), but covers the
// large majority of users. Intl.NumberFormat handles the actual symbol/formatting for each
// code, so supporting another currency later is just adding an entry here.
export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "INR", name: "Indian Rupee" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "KRW", name: "South Korean Won" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "NOK", name: "Norwegian Krone" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "ZAR", name: "South African Rand" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "HKD", name: "Hong Kong Dollar" },
];

export const DEFAULT_CURRENCY = "USD";

// Display-only relabeling — purchasePrice is stored as a plain float with no currency code
// attached (see backend/app/models/hardware.py), so changing this setting changes how a
// number is *shown*, not what it is. No conversion happens.
export function formatCurrency(value: number, currency: string, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, ...options }).format(value);
}

export function getCurrencySymbol(currency: string): string {
  return (
    new Intl.NumberFormat(undefined, { style: "currency", currency, currencyDisplay: "symbol" })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currency
  );
}
