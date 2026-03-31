import fs from "node:fs";

export function debugLog(msg: string, from: string = "") {
	try {
		fs.appendFileSync(
			"/tmp/market-cli-debug.log",
			`[${new Date().toISOString()}] ${from ? from : "TerminalRenderer:"}  ${msg}\n`
		);
	} catch {}
}

export function log(componentName: string) {
	return (msg: string) => {
		debugLog(msg, componentName);
	};
}
