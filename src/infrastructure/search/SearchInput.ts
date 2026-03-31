import { Input, InputRenderableEvents } from "@opentui/core";
import type { SearchService } from "../../application/index.js";

export class SearchInput {
	// biome-ignore lint/suspicious/noExplicitAny: difficult to type atm
	private inputComponent: any = null;
	private searchService: SearchService;
	private onQueryChange: (value: string) => void;
	private isRestoring = false;

	constructor(searchService: SearchService, onQueryChange: (value: string) => void) {
		this.searchService = searchService;
		this.onQueryChange = onQueryChange;
	}

	render(currentValue: string) {
		this.inputComponent = Input({
			placeholder: "Type to search stocks...",
			width: "100%",
			id: "search-input",
		});

		this.inputComponent.on(InputRenderableEvents.INPUT, (value: string) => {
			if (this.isRestoring) return;
			this.onQueryChange(value);
			this.searchService.search(value);
		});

		if (currentValue) {
			this.isRestoring = true;
			this.inputComponent.value = currentValue;
			Promise.resolve().then(() => {
				this.isRestoring = false;
			});
		}

		if (this.inputComponent) {
			this.inputComponent.focus();
			if (currentValue) {
				this.inputComponent.gotoLineEnd();
			}
		}

		return this.inputComponent;
	}

	clear(): void {
		try {
			if (this.inputComponent) {
				this.inputComponent.value = "";
			}
		} catch {}
	}
}
