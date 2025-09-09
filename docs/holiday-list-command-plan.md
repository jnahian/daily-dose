# Holiday List Command Implementation Plan

## Overview
Add a new holiday viewing command (`/dd-holiday-list`) that allows any team member to view holidays, complementing the existing admin-only holiday management commands.

## Current State Analysis
- Existing holiday commands: `/dd-holiday-set`, `/dd-holiday-update`, `/dd-holiday-delete` (admin-only)
- Holiday data stored in `Holiday` table with fields: id, date, name, country
- Commands follow `/dd-` prefix pattern and use middleware for formatting removal

## Implementation Steps

### 1. Add listHolidays Function
- Create `listHolidays` function in `/src/commands/holiday.js`
- Support optional date range filtering
- Support optional month/year filtering  
- Show holidays in chronological order
- Allow any authenticated user (not admin-only)

### 2. Command Registration
- Register `/dd-holiday-list` command in `/src/commands/index.js`
- Apply `stripFormatting()` middleware like other commands

### 3. Slack Manifest Update
- Add new command to `slack-app-manifest.json`
- Include appropriate description and usage hint

### 4. Command Syntax Options
- `/dd-holiday-list` - Show all upcoming holidays
- `/dd-holiday-list 2024` - Show holidays for specific year
- `/dd-holiday-list 2024-12` - Show holidays for specific month
- `/dd-holiday-list 2024-12-01 2024-12-31` - Show holidays in date range

### 5. Response Format
- Display holidays in readable format with dates and names
- Handle empty results gracefully
- Show count of holidays found
- Format dates consistently with other commands

## Files to Modify
1. `/src/commands/holiday.js` - Add listHolidays function
2. `/src/commands/index.js` - Register new command
3. `/slack-app-manifest.json` - Add command definition
4. `/README.md` - Update command documentation

## Technical Considerations
- Use existing dayjs date handling patterns
- Follow same error handling approach as other commands
- Use same response formatting as other list commands
- Maintain consistency with existing code style