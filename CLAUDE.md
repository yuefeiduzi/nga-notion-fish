# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Tampermonkey userscript that transforms NGA (ngabbs.com) gaming forum into a Notion-style document interface for stealth browsing.

## Commands

This is a single-file userscript project with no build tools.

- **Development**: Edit `src/nga-notion.user.js` directly, then copy content to Tampermonkey for testing

## Architecture

The userscript (`src/nga-notion.user.js`) is structured as:

1. **Configuration** (`CONFIG`): Stores enabled state and style version in localStorage
2. **Styles** (`NOTION_STYLES`): CSS string injected to transform NGA's appearance
3. **DOM Transformers**: Functions that convert NGA's HTML structure to Notion-style blocks:
   - `transformThreadList()`: Converts forum listing pages
   - `transformPostPage()`: Converts individual thread pages
   - `createThreadBlock()`: Creates individual post blocks
   - `createPagination()`: Transforms pagination
4. **State Management**: localStorage persistence for toggle state
5. **Initialization**: Sets up menu command, keyboard shortcut (`Cmd/Ctrl+Shift+N`), and applies mode on load

Key DOM IDs used:
- `#notion-container`: Main transformed content wrapper
- `#notion-custom-style`: Injected stylesheet
- `#notion-status`: Toast notification

## Tampermonkey Metadata

The script uses:
- `@run-at document-start`: Loads early in page lifecycle
- `@match https://ngabbs.com/*` and `https://*.ngabbs.com/*`: URL patterns
- `GM_addStyle`: Inject CSS
- `GM_registerMenuCommand`: Browser extension menu integration
