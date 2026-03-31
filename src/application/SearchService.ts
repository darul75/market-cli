import { Subject, Observable, debounceTime, switchMap, of, startWith, BehaviorSubject, tap } from "rxjs";
import type { SearchResult } from "../domain/SearchResult.js";
import { SymbolSearchClient } from "../infrastructure/SymbolSearchClient.js";
import { log } from "../shared/Logger.js";

const debugLog = log("SearchService");

export class SearchService {
	private readonly searchClient: SymbolSearchClient;
	private readonly querySubject = new Subject<string>();
	private readonly searchingSubject = new BehaviorSubject<boolean>(false);

	constructor() {
		this.searchClient = new SymbolSearchClient();
	}

	public get searchResults$(): Observable<SearchResult[]> {
		return this.querySubject.pipe(
			startWith(""),
			tap(() => this.searchingSubject.next(true)),
			debounceTime(300),
			switchMap((query) => {
				debugLog(`SearchService.performSearch: "${query}"`);
				return this.performSearch(query).pipe(tap(() => this.searchingSubject.next(false)));
			})
		);
	}

	public get isSearching$(): Observable<boolean> {
		return this.searchingSubject.asObservable();
	}

	public search(query: string): void {
		debugLog(`SearchService.search() called with: "${query}"`);
		this.querySubject.next(query);
	}

	public clearResults(): void {
		debugLog("SearchService.clearResults()");
		this.searchingSubject.next(false);
		this.querySubject.next("");
	}

	private performSearch(query: string): Observable<SearchResult[]> {
		if (!query || query.trim().length < 1) {
			debugLog("performSearch: empty query, returning []");
			return of([]);
		}

		return new Observable<SearchResult[]>((subscriber) => {
			debugLog(`performSearch: calling API for "${query}"`);
			this.searchClient.searchSymbols(query).then(
				(results) => {
					debugLog(`performSearch: got ${results.length} results`);
					subscriber.next(results);
					subscriber.complete();
				},
				(error) => {
					debugLog(`performSearch: error - ${error}`);
					subscriber.next([]);
					subscriber.complete();
				}
			);
		});
	}
}
