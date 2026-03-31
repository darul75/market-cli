/**
 * Search component specific types and interfaces
 */

export interface SearchComponentState {
	visible: boolean;
	query: string;
	selectedIndex: number;
	isSearching: boolean;
}

export interface SearchRowData {
	symbol: string;
	name: string;
	exchange?: string;
	selected: boolean;
}

export interface SearchTableConfig {
	maxHeight: number;
	showHeader: boolean;
	enableSelection: boolean;
	enableMouseClicks: boolean;
}
