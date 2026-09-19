export const DEFAULT_CURRENCY = "LKR";

export const CURRENCY_OPTIONS = [
  { code: "LKR", label: "Sri Lankan Rupee (LKR)" },
  { code: "USD", label: "US Dollar (USD)" },
  { code: "EUR", label: "Euro (EUR)" },
  { code: "GBP", label: "British Pound (GBP)" },
  { code: "INR", label: "Indian Rupee (INR)" },
  { code: "AUD", label: "Australian Dollar (AUD)" },
  { code: "CAD", label: "Canadian Dollar (CAD)" },
  { code: "SGD", label: "Singapore Dollar (SGD)" },
  { code: "AED", label: "UAE Dirham (AED)" },
  { code: "SAR", label: "Saudi Riyal (SAR)" },
  { code: "JPY", label: "Japanese Yen (JPY)" },
];

export function normalizeCurrency(currency?: string | null) {
  const value = currency?.trim();
  if (!value) return DEFAULT_CURRENCY;
  if (value === "/=" || value.toLowerCase() === "rs") return DEFAULT_CURRENCY;
  return value.toUpperCase();
}

export function formatCurrency(
  amount: number | string | null | undefined,
  currency?: string | null,
  options: Intl.NumberFormatOptions = {}
) {
  const numericAmount = Number(amount || 0);
  const normalizedCurrency = normalizeCurrency(currency);

  if (/^[A-Z]{3}$/.test(normalizedCurrency)) {
    try {
      return new Intl.NumberFormat("en", {
        style: "currency",
        currency: normalizedCurrency,
        maximumFractionDigits: Number.isInteger(numericAmount) ? 0 : 2,
        ...options,
      }).format(numericAmount);
    } catch {
      // Fall through to symbol formatting for custom or unsupported values.
    }
  }

  const maximumFractionDigits = options.maximumFractionDigits ?? (Number.isInteger(numericAmount) ? 0 : 2);
  return `${new Intl.NumberFormat("en", {
    maximumFractionDigits,
    minimumFractionDigits: options.minimumFractionDigits,
  }).format(numericAmount)} ${currency || DEFAULT_CURRENCY}`;
}

export function discountUnitLabel(currency?: string | null) {
  const normalizedCurrency = normalizeCurrency(currency);
  return /^[A-Z]{3}$/.test(normalizedCurrency) ? normalizedCurrency : currency || DEFAULT_CURRENCY;
}
