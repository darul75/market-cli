#!/usr/bin/env bun

import { TerminalRenderer } from "./infrastructure/TerminalRenderer.js";
import { log } from "./shared/Logger.js";

const debugLog = log("main");

async function main() {
	const renderer: TerminalRenderer = new TerminalRenderer();

	try {
		await renderer.initialize();

		renderer.renderLoading();
	} catch (error) {
		debugLog(`❌ Failed to start application: ${error}`);

		if (renderer) {
			renderer.renderError(error instanceof Error ? error.message : "Failed to initialize application");
		}

		process.exit(1);
	}

	const shutdown = () => {
		renderer.destroy();
		process.exit(0);
	};

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
	process.on("SIGQUIT", shutdown);

	process.on("uncaughtException", (error) => {
		debugLog(`💥 Uncaught exception: ${error}`);
		if (renderer) {
			renderer.renderError(`Fatal error: ${error.message}`);
		}
		setTimeout(() => process.exit(1), 1000);
	});

	process.on("unhandledRejection", (reason) => {
		debugLog(`💥 Unhandled promise rejection: ${reason}`);
		if (renderer) {
			renderer.renderError(`Promise rejection: ${String(reason)}`);
		}
	});
}

if (import.meta.main) {
	main().catch((error) => {
		debugLog(`💥 Fatal startup error: ${error}`);
		process.exit(1);
	});
}

export { main };
