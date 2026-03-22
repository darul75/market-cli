import { Box, Text, Input, delegate } from '@opentui/core';
import * as fs from 'fs';

/**
 * SearchDialog - A modal dialog component for searching symbols
 * Uses OpenTUI's delegate pattern for proper focus handling
 */

function debugLog(message: string): void {
  try {
    fs.appendFileSync('/tmp/search-dialog-debug.log', `[${new Date().toISOString()}] ${message}\n`);
  } catch (e) {
    // ignore
  }
}
export class SearchDialog {
  private searchInput: any;  // Input component
  private dialogBox: any;     // Dialog content box
  private overlay: any;       // Overlay background
  private renderer: any;      // Reference to renderer
  private escHandlerRegistered: boolean = false;  // Track if handler is registered

  constructor() {
    // 1. Create Input component FIRST (required for delegate pattern)
    this.searchInput = Input({
      id: 'search-input',
      value: '',
      placeholder: 'Search for symbols...',
      placeholderColor: '#666666',
      backgroundColor: '#2a2a2a',
      textColor: '#FFFFFF',
      width: '100%'
    });

    // 2. Create dialog using delegate for auto-focus
    this.dialogBox = delegate(
      { focus: 'search-input' },  // Key: delegate focus to search-input
      Box({
        id: 'search-dialog-content',
        width: 60,
        flexDirection: 'column',
        border: true,
        borderStyle: 'single',
        borderColor: '#00FF00',
        backgroundColor: '#1a1a1a',
        padding: 2,
        zIndex: 1001
      },
        // Header row with title and close button
        Box({
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 1
        },
          Text({ content: '🔎 Search', fg: '#00FF00' }),
          Box({
            width: 3,
            onMouseDown: (event: any) => {
              event.stopPropagation();
              this.close();
            }
          },
            Text({ content: '[X]', fg: '#FF0000' })
          )
        ),
        // Search input (using delegate pattern)
        this.searchInput
      )
    );

    // 3. Create overlay background with dialog as child (for proper centering)
    this.overlay = Box({
      id: 'search-dialog-overlay',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      zIndex: 1000,
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'absolute',
      onMouseDown: (event: any) => {
        // Close if clicking on overlay (not dialog content)
        if (event.source?.id === 'search-dialog-overlay') {
          this.close();
        }
      }
    });

    // Add dialog as child of overlay for proper centering
    this.overlay.add(this.dialogBox);
  }

  /**
   * Open the search dialog
   */
  public open(renderer: any): void {
    this.renderer = renderer;
    
    // Clear input
    this.searchInput.value = '';
    
    debugLog('Opening dialog, adding ESC handler');
    
    // Add global ESC handler BEFORE built-in handlers
    renderer.prependInputHandler((sequence: string) => {
      debugLog(`Key pressed: ${JSON.stringify(sequence)} ESC=${JSON.stringify('\u001b')}`);
      if (sequence === '\u001b' || sequence === '\u001b[27u') {  // ESC key (multiple formats)
        debugLog('ESC pressed, closing dialog');
        this.close();
        return true;  // Consume the event
      }
      return false;  // Let other handlers process
    });
    
    this.escHandlerRegistered = true;
    debugLog('ESC handler registered');
    
    // Add overlay (with dialog as child) to renderer
    renderer.root.add(this.overlay);
  }

  /**
   * Close the search dialog
   */
  public close(): void {
    debugLog('Close method called');
    if (!this.renderer) {
      debugLog('Renderer is null, returning');
      return;
    }
    
    // Remove overlay (which contains dialog) from renderer
    this.renderer.root.remove('search-dialog-overlay');
    debugLog('Dialog closed');
  }
}
