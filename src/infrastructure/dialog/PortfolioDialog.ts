import { Box, type MouseEvent, Text } from "@opentui/core";
import type { GraphRange } from "../types";
import type { PortfolioHistorySummary } from "../PortfolioHistoryService";
import { renderWithGradient } from "../AsciiChart";
import { getNativeCurrencySymbol } from "../../shared/CurrencyUtils";

export class PortfolioGraphDialog {
	constructor(
		private _graphRange: GraphRange = "1mo",
		private _graphLoading: boolean = false,
		private graphData: PortfolioHistorySummary | null = null,
		private displayCurrency: string,

		private changeGraphRange: (range: GraphRange) => Promise<void>,
		private closeDialog: () => void
	) {}

	render() {
		const titleColor = "#00BFFF";
		const ranges: { key: "1d" | "5d" | "1mo" | "6mo" | "ytd" | "1y" | "5y" | "max"; label: string }[] = [
			{ key: "1d", label: "1D" },
			{ key: "5d", label: "5D" },
			{ key: "1mo", label: "1M" },
			{ key: "6mo", label: "6M" },
			{ key: "ytd", label: "YTD" },
			{ key: "1y", label: "1Y" },
			{ key: "5y", label: "5Y" },
			{ key: "max", label: "MAX" },
		];

		const rangeButtons = ranges.map((r) => {
			const isSelected = this._graphRange === r.key;
			const bg = isSelected ? "#004466" : "#222244";
			const fg = isSelected ? "#00BFFF" : "#888888";
			return Box(
				{
					width: 4,
					height: 1,
					backgroundColor: bg,
					onMouseDown: (e: MouseEvent) => {
						e.stopPropagation();
						this.changeGraphRange(r.key);
					},
				},
				Text({ content: r.label, width: 4, fg })
			);
		});

		const chartContent = [];

		if (this._graphLoading) {
			chartContent.push(
				Box(
					{ width: "100%", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 10 },
					Text({ content: "Loading chart data...", fg: "#888888" })
				)
			);
		} else if (this.graphData && this.graphData.dataPoints.length > 0) {
			const chartResult = renderWithGradient(this.graphData.dataPoints, 35, 10);
			const changeColor = this.graphData.change >= 0 ? "#00FF00" : "#FF0000";
			const changeSign = this.graphData.change >= 0 ? "+" : "";

			const displaySymbol = getNativeCurrencySymbol(this.displayCurrency);

			chartContent.push(
				...chartResult.lines.map((line) =>
					Box({ width: "100%", flexDirection: "row", justifyContent: "center" }, Text({ content: line, fg: "#00FF00" }))
				),
				Box({ width: "100%", height: 1 }),
				Box(
					{ width: "100%", flexDirection: "row", justifyContent: "space-between" },
					Text({ content: `Min: ${displaySymbol}${this.graphData.minValue.toFixed(0)}`, fg: "#FF6666" }),
					Text({ content: `Max: ${displaySymbol}${this.graphData.maxValue.toFixed(0)}`, fg: "#00FF00" })
				),
				Box({ width: "100%", height: 1 }),
				Box(
					{ width: "100%", flexDirection: "row", justifyContent: "space-between" },
					Text({ content: `Start: ${displaySymbol}${this.graphData.startValue.toFixed(0)}`, fg: "#888888" }),
					Text({ content: `Now: ${displaySymbol}${this.graphData.currentValue.toFixed(0)}`, fg: "#FFFFFF" })
				),
				Box({ width: "100%", height: 1 }),
				Box(
					{ width: "100%", flexDirection: "row", justifyContent: "center" },
					Text({
						content: `${changeSign}${displaySymbol}${this.graphData.change.toFixed(0)} (${changeSign}${this.graphData.changePercent.toFixed(2)}%)`,
						fg: changeColor,
					})
				)
			);
		} else {
			chartContent.push(
				Box(
					{ width: "100%", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 10 },
					Text({ content: "No data available", fg: "#FF6666" }),
					Text({ content: "Make some transactions to see the graph", fg: "#888888" })
				)
			);
		}

		return Box(
			{
				id: "portfolio-graph-dialog",
				width: 55,
				flexDirection: "column",
				borderStyle: "double",
				borderColor: titleColor,
				backgroundColor: "#08081a",
				padding: 1,
				zIndex: 100,
			},
			Text({ content: "📈 Portfolio Evolution", fg: titleColor }),
			Box({ width: "100%", height: 1 }),
			Box({ width: "100%", flexDirection: "row", gap: 1 }, ...rangeButtons),
			Box({ width: "100%", height: 1 }),
			Box(
				{
					width: "100%",
					flexDirection: "column",
					borderStyle: "single",
					borderColor: "#333333",
					paddingLeft: 1,
					paddingRight: 1,
				},
				...chartContent
			),
			Box({ width: "100%", height: 1 }),
			Box(
				{ width: "100%", flexDirection: "row", justifyContent: "center" },
				Box(
					{
						width: 10,
						height: 1,
						onMouseDown: (e: MouseEvent) => {
							e.stopPropagation();
							this.closeDialog();
						},
					},
					Text({ content: "  [Close]  ", width: 10, fg: "#FF4444" })
				)
			)
		);
	}
}
