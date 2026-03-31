import { Box, Text } from "@opentui/core";
import type { AppStatus } from "../../application";

export class FooterPanel {
	private _appStatus: AppStatus | null = null;

	constructor(private appVersion: string) {}

	render() {
		if (!this._appStatus) {
			return Box();
		}

		const lastUpdate = this._appStatus.lastUpdate
			? `Last: ${this._appStatus.lastUpdate.toLocaleTimeString()}`
			: "Never";

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

	set appStatus(status: AppStatus) {
		this._appStatus = status;
	}
}
