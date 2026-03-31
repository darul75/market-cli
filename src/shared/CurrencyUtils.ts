import { debugLog } from "./Logger";

export const CURRENCY_SYMBOLS: Record<string, string> = {
	AUD: "$",
	CAD: "$",
	CHF: "Fr",
	CLP: "$",
	EUR: "€",
	GBP: "£",
	GBp: "£",
	JPY: "¥",
	MXN: "$",
	USD: "$",
	THB: "฿",
};

export function getNativeCurrencySymbol(currency: string): string {
	return CURRENCY_SYMBOLS[currency] ?? currency;
}

export function convertPrice(
	exchangeRates: Map<string, number>,
	price: number,
	fromCurrency: string,
	toCurrency: string
) {
	if (fromCurrency === toCurrency) {
		return price;
	}

	let usdPrice: number;
	if (fromCurrency === "USD") {
		usdPrice = price;
	} else {
		const fromRate = exchangeRates.get(fromCurrency);
		if (!fromRate || fromRate <= 0) {
			debugLog(`Invalid exchange rate for ${fromCurrency}: ${fromRate}`);
			throw new Error(`Cannot convert from ${fromCurrency} - invalid exchange rate`);
		}
		usdPrice = price * fromRate;
	}

	if (toCurrency === "USD") {
		return usdPrice;
	} else {
		const toRate = exchangeRates.get(toCurrency);
		if (!toRate || toRate <= 0) {
			debugLog(`Invalid exchange rate for ${toCurrency}: ${toRate}`);
			throw new Error(`Cannot convert to ${toCurrency} - invalid exchange rate`);
		}
		return usdPrice / toRate;
	}
}
