// Supported currencies for display purposes only — this does NOT do any
// live conversion between currencies. Picking a currency just changes the
// symbol/formatting used for prices; the underlying number is stored as-is.
export const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'US Dollar ($)' },
  { code: 'EUR', symbol: '€', label: 'Euro (€)' },
  { code: 'GBP', symbol: '£', label: 'British Pound (£)' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen (¥)' },
  { code: 'CAD', symbol: 'CA$', label: 'Canadian Dollar (CA$)' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar (A$)' },
  { code: 'NZD', symbol: 'NZ$', label: 'New Zealand Dollar (NZ$)' },
  { code: 'CHF', symbol: 'CHF', label: 'Swiss Franc (CHF)' },
  { code: 'CNY', symbol: '¥', label: 'Chinese Yuan (¥)' },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee (₹)' },
  { code: 'BRL', symbol: 'R$', label: 'Brazilian Real (R$)' },
  { code: 'MXN', symbol: 'MX$', label: 'Mexican Peso (MX$)' },
  { code: 'KRW', symbol: '₩', label: 'South Korean Won (₩)' },
  { code: 'SEK', symbol: 'kr', label: 'Swedish Krona (kr)' },
  { code: 'ZAR', symbol: 'R', label: 'South African Rand (R)' },
];

export function currencySymbol(code) {
  return CURRENCIES.find((c) => c.code === code)?.symbol || '$';
}

export function formatMoney(amount, code) {
  const symbol = currencySymbol(code);
  const num = (parseFloat(amount) || 0).toFixed(2);
  return `${symbol}${num}`;
}
