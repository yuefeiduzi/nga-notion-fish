# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Tampermonkey userscript that transforms NGA (ngabbs.com) gaming forum into a Notion-style document interface for stealth browsing.

NGA is a large Chinese gaming forum with thousands of game-specific boards including:
- **MOBA**: League of Legends, DOTA2, Valorant
- **Blizzard**: World of Warcraft, Hearthstone, Overwatch
- **Console**: Elden Ring, Zelda, Monster Hunter, Black Myth Wukong
- **Mobile**: Genshin Impact, Arknights, Honkai: Star Rail, Mobile Legends

## Commands

This is a single-file userscript project with no build tools.

- **Development**: Edit `src/nga-notion.user.js` directly, then copy content to Tampermonkey for testing

## Architecture

The userscript (`src/nga-notion.user.js`) is structured as:

1. **Configuration** (`CONFIG`): Stores enabled state and style version in localStorage
2. **Styles** (`NOTION_STYLES`): CSS string injected to transform NGA's appearance
3. **Page Transformers**:
   - `transformHomepage()`: Converts forum homepage (`.catenew` containers)
   - `transformThreadList()`: Converts forum listing pages (`table.forumbox`)
   - `transformPostPage()`: Converts individual thread pages (`[id^="post1strow"]`)
4. **DOM Transformers**:
   - `createThreadItem()`: Creates individual thread blocks for list pages
   - `createPostComment()`: Creates comment blocks for post pages
   - `extractContent()`: Extracts and transforms post content
5. **Pagination**: `createPagination()` and `createListPagination()` for page navigation
6. **Breadcrumbs**: `createDom()` helper and navigation generation
7. **State Management**: localStorage persistence for toggle state
8. **Initialization**: Sets up menu command, keyboard shortcut (`Q`), and applies mode on load

### Key DOM IDs/Selectors Used

**Homepage**:
- `.catenew` - Board container
- `.catenew .catetitle` - Category title
- `a[href*="fid="]` - Board links

**Thread List**:
- `table.forumbox` - Thread list container
- `tr.topicrow` - Thread rows
- `td.c2 a.topic` - Thread titles
- `td.c2 span[class^="t_k_"]` - Thread tags
- `td.c3 a.author` - Authors
- `td.c3 span.postdate` - Post dates

**Post Page**:
- `[id^="post1strow"], [class*="postrow"]` - Post rows
- `[id*="postauthor"]` - Authors
- `[id*="postcontent"]` - Post content
- `[id*="postsubject"]` - Post subjects
- `.recommendvalue` - Like counts
- `.nav a.nav_link` - Breadcrumb navigation

### Page Detection

- Homepage: `pathname === '/'`
- Thread list: `pathname === '/thread.php'` or `table.forumbox` exists
- Post page: `pathname === '/read.php'`

## Tampermonkey Metadata

The script uses:
- `@run-at document-start`: Loads early in page lifecycle
- `@match https://ngabbs.com/*` and `https://*.ngabbs.com/*`: URL patterns
- `GM_addStyle`: Inject CSS
- `GM_registerMenuCommand`: Browser extension menu integration

## Development Notes

- The script is loaded via Tampermonkey with `@run-at document-start`
- Uses `localStorage` to persist mode state across page navigations
- Keyboard shortcut `Q` toggles the mode
- Supports seamless page transitions when enabled (no page refresh needed)
