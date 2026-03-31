import type { Position, Stock } from "../domain";

export type DialogMode =
	| "none"
	| "buy"
	| "sell"
	| "portfolioGraph"
	| "delete"
	| "help"
	| "deleteTransaction"
	| "search";

export type DialogFocusedField =
	| "monthLt"
	| "monthGt"
	| "dayLt"
	| "dayGt"
	| "yearLt"
	| "yearGt"
	| "qty"
	| "price"
	| "cancel"
	| "ok";

export type GraphRange = "1d" | "5d" | "1mo" | "6mo" | "ytd" | "1y" | "5y" | "max";

export const SideEffectType = ["delete_symbol", "exchange_rates", "portfolio_positions"] as const;
export type SideEffectType = (typeof SideEffectType)[number];

export type SideEffect =
	| { type: "delete_symbol"; index: number; stock: Stock }
	| { type: "exchange_rates"; data: Map<string, number> }
	| { type: "portfolio_positions"; data: Position[] }
	| { type: "currency"; data: Currency };

export type Currency = "USD" | "EUR";
