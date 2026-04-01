import { Box, Text } from "@opentui/core";
import type { AppStatus } from "../../application";
import type { Observable } from "rxjs";
import type { SideEffect } from "../types";

export class FooterPanel {
	private appStatus: AppStatus | null = null;

	constructor(
		private appVersion: string,
		private $sideEffects: Observable<SideEffect>
	) {
		this.initListeners();
	}

	render() {
		if (!this.appStatus) {
			return Box();
		}

		const lastUpdate = this.appStatus.lastUpdate ? `Last: ${this.appStatus.lastUpdate.toLocaleTimeString()}` : "Never";

		return Box(
			{
				width: "100%",
				height: 1,
				flexDirection: "row",
				justifyContent: "space-between",
				alignItems: "center",
				marginLeft: 1,
				paddingRight: 1,
			},
			Text({
				content: lastUpdate,
				fg: "#CCCCCC",
			}),
			Text({
				content: `v${this.appVersion} | Press Ctrl+C to exit`,
				fg: "#CCCCCC",
			})
		);
	}

	private initListeners() {
		this.$sideEffects.subscribe((value) => {
			switch (value.type) {
				case "status":
					this.appStatus = value.data;
					break;
				default:
					break;
			}
		});
	}
}
