import { Input, InputRenderableEvents } from '@opentui/core';
import type { SearchService } from '../../application/index.js';
import * as fs from 'fs';

function debugLog(msg: string): void {
  try {
    fs.appendFileSync('/tmp/marker-cli-debug.log', `[${new Date().toISOString()}] SearchPanel: ${msg}\n`);
  } catch {}
}

/**
 * Simple SearchInput component using basic OpenTUI Input
 */
export class SearchInput {
  private inputComponent: any = null;
  private searchService: SearchService;
  private value = "";
  private onQueryChange: (value: string) => void;
  private isRestoring = false;
  private onTyping: () => void; 

  constructor(searchService: SearchService, onQueryChange: (value: string) => void, onTyping: () => void) {
    this.searchService = searchService;
    this.onQueryChange = onQueryChange;
    this.onTyping = onTyping; 
  }

  /**
   * Create a fresh Input instance on every render.
   * Required because clearScreen() unmounts the previous instance — OpenTUI
   * cannot re-add an already-unmounted component to a new tree.
   */
  render(currentValue: string): any {
    this.inputComponent = Input({
      placeholder: 'Type to search stocks...',
      width: '100%',
    });

    this.inputComponent.on(InputRenderableEvents.INPUT, (value: string) => {
      if (this.isRestoring) return;
      this.value = value;
      this.onQueryChange(value);
      this.searchService.search(value);
      this.onTyping();
    });

        // Restore the typed query after a full rerender.
    // Guard with isRestoring so the INPUT event fired by setting .value
    // doesn't re-trigger a search and cause an infinite rerender loop.
    if (currentValue) {
      this.isRestoring = true;
      this.inputComponent.value = currentValue;
      Promise.resolve().then(() => { this.isRestoring = false; });
    }

    if (this.inputComponent) {
      this.inputComponent.focus();
      if (currentValue) {
        this.inputComponent.gotoLineEnd();
      }
    }

    // this.inputComponent.value = currentValue;
      
    // this.inputComponent.focus();

    return this.inputComponent;
  }

  /**
   * Clear input
   */
  clear(): void {
    try {
      if (this.inputComponent) {
        this.inputComponent.value = '';
      }
    } catch {}
  }
}