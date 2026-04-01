import { Box, Text } from "@opentui/core";
import type { LoadingProgress } from "../shared/ProgressTracker";

export class LoadingScreen {
	constructor(
		private progress: LoadingProgress | undefined,
		private isInitialized: boolean
	) {}

	render() {
		if (!this.isInitialized) return;

		const elements = [];

		elements.push(
			Text({
				content: "🔄 Loading data...",
				fg: "#00FF00",
			})
		);

		if (this.progress) {
			elements.push(
				Box(
					{
						width: "80%",
						flexDirection: "column",
						alignItems: "center",
						marginTop: 2,
						borderStyle: "single",
						borderColor: "#333333",
						padding: 1,
					},
					Text({
						content: `Stocks: ${this.progress.completedStocks}/${this.progress.totalStocks}`,
						fg: "#00BFFF",
					}),
					Text({
						content:
							this.progress.currentBatchStocks.length > 0
								? `Processing: ${this.progress.currentBatchStocks.join(", ")}`
								: "Waiting for next batch...",
						fg: "#CCCCCC",
					}),
					Box(
						{
							flexDirection: "row",
							gap: 3,
							marginTop: 1,
						},
						Text({
							content: `✅ Success: ${this.progress.successCount}`,
							fg: "#00FF00",
						}),
						Text({
							content: `❌ Errors: ${this.progress.errorCount}`,
							fg: "#FF0000",
						})
					),
					Text({
						content: `Elapsed: ${this.progress.elapsedTime}s`,
						fg: "#AAAAAA",
					})
				)
			);

			if (this.progress.recentErrors.length > 0) {
				elements.push(
					Box(
						{
							width: "80%",
							flexDirection: "column",
							marginTop: 1,
							borderStyle: "single",
							borderColor: "#FF0000",
							padding: 1,
						},
						Text({
							content: "Recent Errors:",
							fg: "#FF0000",
						}),
						...this.progress.recentErrors.slice(0, 3).map((error: string) =>
							Text({
								content: error.length > 60 ? `${error.substring(0, 57)}...` : error,
								fg: "#FF6B6B",
							})
						)
					)
				);
			}
		}

		elements.push(
			Box(
				{
					marginTop: 2,
					flexDirection: "column",
					alignItems: "center",
				},
				Text({
					content: "Please wait while we fetch live market data...",
					fg: "#CCCCCC",
				}),
				Text({
					content: "Press Ctrl+C to cancel",
					fg: "#AAAAAA",
				})
			)
		);

		return Box(
			{
				width: "100%",
				height: "100%",
				flexDirection: "column",
				justifyContent: "center",
				alignItems: "center",
				padding: 2,
			},
			...elements
		);
	}
}
