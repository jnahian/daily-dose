/**
 * Pure resolver for a team member's display status.
 * @param {Object} member
 * @param {('ADMIN'|'MEMBER')} member.role
 * @param {boolean} member.teamActive  TeamMember.isActive
 * @param {boolean} member.orgActive   OrganizationMember.isActive
 * @param {boolean} member.onLeave     leave overlaps today
 * @param {boolean} member.workingToday today is a work day (and not a holiday)
 * @param {boolean} member.responded   submitted a standup today
 * @returns {{active: boolean, inactiveScope: ('team'|'org'|null), standup: ('leave'|'submitted'|'pending'|null)}}
 */
function deriveMemberStatus({
  role,
  teamActive,
  orgActive,
  onLeave,
  workingToday,
  responded,
}) {
  const active = teamActive && orgActive;
  if (!active) {
    return {
      active: false,
      inactiveScope: !teamActive ? "team" : "org",
      standup: null,
    };
  }

  let standup;
  if (onLeave) {
    standup = "leave";
  } else if (role === "ADMIN" || !workingToday) {
    standup = null;
  } else {
    standup = responded ? "submitted" : "pending";
  }

  return { active: true, inactiveScope: null, standup };
}

module.exports = { deriveMemberStatus };
