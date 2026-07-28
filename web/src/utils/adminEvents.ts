// Window events used to keep independent admin-panel components in sync without
// threading state through a shared provider.

// Dispatched after a pending team is approved or rejected, so the sidebar's
// approval badge can refresh its count.
export const PENDING_TEAMS_CHANGED_EVENT = 'dailydose:pending-teams-changed';
