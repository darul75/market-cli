export const CURRENCY_SYMBOLS: Record<string, string> = {
    'AUD': '$',
    'CAD': '$',
    'CHF': 'Fr',
    'CLP': '$',
    'EUR': '€',
    'GBP': '£',
    'GBp': '£',
    'JPY': '¥',
    'MXN': '$',
    'USD': '$',
    'THB': '฿'
};

export function getNativeCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}