import { Box, Text } from "@opentui/core";
import type { MarketData } from "../../domain";

export class SummaryPanel {
	private _marketData: MarketData | null = null;

	render() {
		if (!this._marketData) {
			return Box();
		}
		const summary = this._marketData.getSummary();

		return Box(
			{
				width: "100%",
				height: 1,
				paddingLeft: 1,
				paddingRight: 1,
				flexDirection: "row",
				justifyContent: "space-between",
				alignItems: "center",
			},
			Box(
				{
					flexDirection: "row",
					gap: 4,
				},
				Text({
					content: `Stocks: ${summary.totalStocks}`,
					fg: "#FFFFFF",
				}),
				Text({
					content: `↑ ${summary.gainers}`,
					fg: "#00FF00",
				}),
				Text({
					content: `↓ ${summary.losers}`,
					fg: "#FF0000",
				})
			),
			Text({
				content: `Sentiment: ${summary.sentiment}`,
				fg: this.getSentimentColor(summary.sentiment),
			})
		);
	}

	private getSentimentColor(sentiment: string): string {
		switch (sentiment) {
			case "BULLISH":
				return "#00FF00";
			case "BEARISH":
				return "#FF0000";
			default:
				return "#FFA500";
		}
	}

	set marketData(marketData: MarketData) {
		this._marketData = marketData;
	}
}
