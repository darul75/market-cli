import { Box, Text } from "@opentui/core";
import { type Subscription, combineLatest, debounceTime } from "rxjs";
import { SearchInput } from "./SearchInput.js";
import { SearchResultsTable } from "./SearchResultsTable.js";
import type { SearchResult } from "../../domain/SearchResult.js";
import type { SearchService } from "../../application/SearchService.js";

interface SearchPanelState {
	visible: boolean;
	query: string;
	selectedIndex: number;
	isSearching: boolean;
}

export class SearchPanel {
	private _searchInput: SearchInput;
	private _resultsTable: SearchResultsTable;
	private _searchService: SearchService;
	private subscription: Subscription | null = null;
	// biome-ignore lint/suspicious/noExplicitAny: difficult to type atm
	private panelContainer: any = null;

	private state: SearchPanelState = {
		visible: true,
		query: "",
		selectedIndex: -1,
		isSearching: false,
	};

	constructor(
		searchService: SearchService,
		onAddStock: (symbol: string, name: string) => void,
		private onRequestRerender: () => void
	) {
		this._searchService = searchService;

		this._searchInput = new SearchInput(searchService, (value) => {
			this.state.query = value;
		});

		this._resultsTable = new SearchResultsTable(onAddStock);

		this.setupSubscriptions();
	}

	show() {
		if (this.state.visible) return;

		this.state.visible = true;

		this.setupSubscriptions();

		this._searchService.clearResults();
		this.state.query = "";
		this.state.selectedIndex = -1;
		this.state.isSearching = false;
	}

	hide() {
		if (!this.state.visible) return;

		this.cleanupSubscriptions();

		this._searchInput.clear();
		this.state.query = "";
		this.state.selectedIndex = -1;
		this.state.isSearching = false;
	}

	close() {
		this.hide();
	}

	addStock() {
		this._resultsTable.addStockResult();
	}

	moveSelectionUp() {
		this._resultsTable.navigateUp();
		this.onRequestRerender();
	}

	moveSelectionDown() {
		this._resultsTable.navigateDown();
		this.onRequestRerender();
	}

	private setupSubscriptions() {
		if (this.subscription) {
			this.cleanupSubscriptions();
		}

		this.subscription = combineLatest([this._searchService.searchResults$, this._searchService.isSearching$])
			.pipe(debounceTime(1000))
			.subscribe(([results, isSearching]) => {
				this.handleSearchUpdate(results, isSearching);
			});
	}

	private handleSearchUpdate(results: SearchResult[], isSearching: boolean) {
		try {
			this.state.isSearching = isSearching;
			this.state.selectedIndex = -1;

			this._resultsTable.updateRows(results, isSearching);

			this.onRequestRerender();
		} catch (error) {
			console.log(error);
		}
	}

	private cleanupSubscriptions() {
		if (this.subscription) {
			this.subscription.unsubscribe();
			this.subscription = null;
		}
	}

	render() {
		if (!this.state.visible) return null;

		const inputComponent = this._searchInput.render(this.state.query);

		const tableComponent = this._resultsTable.createTable();

		this.panelContainer = Box(
			{
				id: "search-panel",
				width: 76,
				flexDirection: "column",
				borderStyle: "single",
				borderColor: "#666666",
				backgroundColor: "#000000",
				paddingLeft: 1,
				paddingRight: 1,
			},
			Box(
				{
					id: "search-title",
					width: "100%",
					height: 1,
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "center",
				},
				Text({
					content: "🔍 Search Stocks",
					fg: "#00FF00",
				})
			),
			Box(
				{
					width: "100%",
					height: 3,
					borderStyle: "single",
					borderColor: "#666666",
					backgroundColor: "#000000",
					paddingLeft: 1,
				},
				inputComponent
			),
			tableComponent
		);

		return this.panelContainer;
	}

	destroy() {
		this.cleanupSubscriptions();
		this.state.visible = false;
	}
}
