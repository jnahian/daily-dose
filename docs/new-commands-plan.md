# New Commands Implementation Plan

This document outlines the implementation of new commands for the Daily Dose Bot.

## Commands Implemented

### 1. Holiday Management Commands (Admin Only)

#### `/dd-holiday-set`
- **Usage**: `/dd-holiday-set YYYY-MM-DD [YYYY-MM-DD] [name]`
- **Examples**:
  - `/dd-holiday-set 2024-12-25 Christmas Day`
  - `/dd-holiday-set 2024-12-24 2024-12-26 Christmas Holiday`
- **Permission**: Admin (uses existing `userService.canCreateTeam()` check)
- **Features**: 
  - Sets holidays for single date or date range
  - Creates day-wise records for multiple days
  - Uses existing Holiday model in database
  - Upserts records to handle duplicates

#### `/dd-holiday-update`
- **Usage**: `/dd-holiday-update YYYY-MM-DD new name`
- **Example**: `/dd-holiday-update 2024-12-25 Christmas Day Updated`
- **Permission**: Admin
- **Features**: Updates existing holiday name for specific date

#### `/dd-holiday-delete`
- **Usage**: `/dd-holiday-delete YYYY-MM-DD [YYYY-MM-DD]`
- **Examples**:
  - `/dd-holiday-delete 2024-12-25`
  - `/dd-holiday-delete 2024-12-24 2024-12-26`
- **Permission**: Admin
- **Features**: Deletes holidays for single date or date range

### 2. Standup Update Command (User)

#### `/dd-standup-update`
- **Usage**: `/dd-standup-update [TeamName] [YYYY-MM-DD]`
- **Examples**:
  - `/dd-standup-update` - Updates standup for today in first team
  - `/dd-standup-update Engineering` - Updates standup for today in Engineering team
  - `/dd-standup-update 2024-12-20` - Updates standup for specified date in first team
  - `/dd-standup-update Engineering 2024-12-20` - Updates standup for specified date in Engineering team
- **Permission**: Any team member
- **Features**:
  - Opens modal with existing standup data if available
  - Supports updating standup for any past/future date
  - When updating after posting time for today, posts update to thread in channel
  - Uses new modal callback `standup_update_modal` to handle updates

## Technical Implementation Details

### File Structure
- `src/commands/holiday.js` - New holiday management commands
- `src/commands/standup.js` - Extended with update functionality
- `src/commands/index.js` - Updated to register all new commands

### Database Usage
- Uses existing `Holiday` model for holiday commands
- Uses existing `StandupResponse` model for standup updates
- No schema changes required

### Permission System
- Holiday commands use existing admin permission check via `userService.canCreateTeam()`
- Standup update uses existing team membership validation

### Error Handling
- Comprehensive validation for date formats
- Admin permission checks
- Team existence validation
- Proper error messages for all failure cases

### Slack Integration
- Holiday commands use standard command response patterns
- Standup update opens rich text modal with pre-filled data
- Updates after posting time automatically post to thread
- Ephemeral confirmation messages

## Testing Verification

The implementation has been tested for:
- ✅ Syntax validation (server starts without errors)
- ✅ Command registration
- ✅ Modal handlers registration
- ✅ Import dependencies resolved

All new commands follow the established patterns in the codebase and integrate seamlessly with existing functionality.