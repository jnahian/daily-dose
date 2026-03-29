# Members Team CRUD Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add team membership management to the admin Members page — a "Manage Teams" button per member opens a modal to add/remove the member from teams with role selection.

**Architecture:** Two new backend endpoints (`POST /api/admin/team-members`, `DELETE /api/admin/team-members/:id`); update `GET /members` to include `teamMemberId` in the teams array; update `DELETE /members/:id` to use `deletedAt`; extend `Members.tsx` with a new `manageTeams` modal state.

**Tech Stack:** Prisma (PostgreSQL), Express.js, React 19 + TypeScript, Tailwind CSS, Lucide React (Users icon)

---

## Task 1: Update GET /members and DELETE /members to fix soft-delete

**Files:**
- Modify: `src/routes/admin.js`

**Step 1: Update GET /members to include TeamMember id and fix filters**

Find the GET `/members` route (~line 498). There are two changes:

**Change A** — include `teamMemberId` in the teams array (the frontend needs this to delete team memberships):

```javascript
// Change:
teams: m.user.teamMemberships.map(tm => ({ id: tm.team.id, name: tm.team.name })),

// To:
teams: m.user.teamMemberships.map(tm => ({ teamMemberId: tm.id, id: tm.team.id, name: tm.team.name })),
```

**Change B** — fix the teamMemberships filter to also exclude soft-deleted and filter by org:

```javascript
// Change:
where: { team: { organizationId: orgId }, isActive: true },

// To:
where: { team: { organizationId: orgId }, isActive: true, deletedAt: null },
```

**Change C** — fix the top-level members filter to also exclude soft-deleted:

```javascript
// Change:
where: { organizationId: orgId, ...(role ? { role } : {}), isActive: true },

// To:
where: { organizationId: orgId, ...(role ? { role } : {}), isActive: true, deletedAt: null },
```

**Step 2: Update DELETE /members/:id to use deletedAt**

Find the DELETE `/members/:id` route (~line 599). Change:

```javascript
// Change:
await prisma.organizationMember.update({ where: { id: req.params.id }, data: { isActive: false } });

// To:
await prisma.organizationMember.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
```

**Step 3: Commit**

```bash
cd /Users/nahian/Projects/daily-dose-bot
git add src/routes/admin.js
git commit -m "$(cat <<'EOF'
fix(admin): include teamMemberId in GET /members and use deletedAt for member soft-delete

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add POST and DELETE /api/admin/team-members endpoints

**Files:**
- Modify: `src/routes/admin.js`

**Step 1: Add POST /api/admin/team-members**

Insert AFTER the DELETE `/members/:id` route and BEFORE the GET `/holidays` route:

```javascript
// POST /api/admin/team-members — add user to a team
router.post('/team-members', requireAuth, async (req, res) => {
  try {
    const { userId, teamId, role } = req.body;
    if (!userId || !teamId) return res.status(400).json({ error: 'userId and teamId are required.' });
    const validRoles = ['ADMIN', 'MEMBER'];
    if (role && !validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role. Must be ADMIN or MEMBER.' });

    // Verify caller has access to the org this team belongs to
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { organizationId: true, deletedAt: true, name: true }
    });
    if (!team || team.deletedAt) return res.status(404).json({ error: 'Team not found.' });
    const allowed = await verifyOrgAccess(req, res, team.organizationId);
    if (!allowed) return;

    // Check if team membership already exists (including soft-deleted)
    const existing = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } }
    });

    let teamMember;
    if (existing) {
      // Re-activate if soft-deleted or inactive
      teamMember = await prisma.teamMember.update({
        where: { id: existing.id },
        data: { role: role || 'MEMBER', isActive: true, deletedAt: null }
      });
    } else {
      teamMember = await prisma.teamMember.create({
        data: { teamId, userId, role: role || 'MEMBER', isActive: true }
      });
    }

    res.status(201).json({
      teamMemberId: teamMember.id,
      id: teamId,
      name: team.name,
      role: teamMember.role
    });
  } catch (err) {
    console.error('POST /team-members error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/team-members/:id — remove user from a team (soft delete)
router.delete('/team-members/:id', requireAuth, async (req, res) => {
  try {
    const teamMember = await prisma.teamMember.findUnique({
      where: { id: req.params.id },
      select: { id: true, deletedAt: true, team: { select: { organizationId: true } } }
    });
    if (!teamMember || teamMember.deletedAt) return res.status(404).json({ error: 'Not found' });
    const allowed = await verifyOrgAccess(req, res, teamMember.team.organizationId);
    if (!allowed) return;

    await prisma.teamMember.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() }
    });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /team-members/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Step 2: Commit**

```bash
cd /Users/nahian/Projects/daily-dose-bot
git add src/routes/admin.js
git commit -m "$(cat <<'EOF'
feat(admin): add POST and DELETE /api/admin/team-members endpoints

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Update Members.tsx with Manage Teams modal

**Files:**
- Modify: `web/src/pages/admin/Members.tsx`

**Step 1: Read the current file**

Read `web/src/pages/admin/Members.tsx` to understand the current state.

**Step 2: Apply all changes**

Make the following changes to the file:

**Change A — Update the Team interface in the Member interface**

```typescript
// Change:
teams: { id: string; name: string }[];

// To:
teams: { teamMemberId: string; id: string; name: string }[];
```

**Change B — Add manageTeams to ModalState and add Team interface**

```typescript
// Add a Team interface before or after the Member interface:
interface Team {
  id: string;
  name: string;
}

// Change ModalState to add manageTeams:
type ModalState =
  | { type: 'add'; orgId: string }
  | { type: 'role'; member: Member }
  | { type: 'delete'; member: Member }
  | { type: 'manageTeams'; member: Member }
  | null;
```

**Change C — Add state variables for team management**

After the existing state declarations (`const [saving, setSaving] = useState(false);`), add:

```typescript
const [teams, setTeams] = useState<Team[]>([]);
const [addTeamId, setAddTeamId] = useState('');
const [addTeamRole, setAddTeamRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');
const [managingMember, setManagingMember] = useState<Member | null>(null);
```

**Change D — Add openManageTeams handler**

After the `openRoleEdit` function, add:

```typescript
const openManageTeams = async (member: Member) => {
  setError('');
  setAddTeamId('');
  setAddTeamRole('MEMBER');
  setManagingMember(member);
  setModal({ type: 'manageTeams', member });
  if (!effectiveOrgId) return;
  const res = await fetch(`/api/admin/teams?orgId=${effectiveOrgId}`, { credentials: 'include' });
  if (res.ok) setTeams(await res.json());
};
```

**Change E — Add handleAddToTeam and handleRemoveFromTeam handlers**

After `handleDelete`, add:

```typescript
const handleAddToTeam = async () => {
  if (!addTeamId) { setError('Please select a team.'); return; }
  if (!managingMember) return;
  setSaving(true);
  setError('');
  const res = await fetch('/api/admin/team-members', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ userId: managingMember.userId, teamId: addTeamId, role: addTeamRole }),
  });
  setSaving(false);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    setError(data.error || 'Failed to add to team.');
    return;
  }
  const added = await res.json();
  const updatedMember = { ...managingMember, teams: [...managingMember.teams, added] };
  setManagingMember(updatedMember);
  setMembers(prev => prev.map(m => m.id === managingMember.id ? updatedMember : m));
  setAddTeamId('');
  setAddTeamRole('MEMBER');
};

const handleRemoveFromTeam = async (teamMemberId: string, teamId: string) => {
  if (!managingMember) return;
  setSaving(true);
  setError('');
  const res = await fetch(`/api/admin/team-members/${teamMemberId}`, { method: 'DELETE', credentials: 'include' });
  setSaving(false);
  if (!res.ok) { setError('Failed to remove from team.'); return; }
  const updatedMember = { ...managingMember, teams: managingMember.teams.filter(t => t.teamMemberId !== teamMemberId) };
  setManagingMember(updatedMember);
  setMembers(prev => prev.map(m => m.id === managingMember.id ? updatedMember : m));
};
```

**Change F — Add Users icon to imports**

```typescript
// Change:
import { Plus, Pencil, Trash2 } from 'lucide-react';

// To:
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
```

**Change G — Add Manage Teams button to actions column**

In the actions column render, add a Users button before the Pencil button:

```typescript
<button
  onClick={(e) => { e.stopPropagation(); openManageTeams(m); }}
  className="text-white/40 hover:text-green-400 transition-colors"
  title="Manage teams"
>
  <Users size={14} />
</button>
```

**Change H — Add Manage Teams modal**

After the Remove Confirmation Modal (`</AdminModal>` that closes the delete modal), add:

```tsx
{/* Manage Teams Modal */}
<AdminModal
  isOpen={modal?.type === 'manageTeams'}
  onClose={() => { setModal(null); setManagingMember(null); }}
  title={`Manage Teams — ${managingMember?.name ?? ''}`}
>
  <div className="space-y-4">
    {/* Current teams */}
    <div>
      <p className="text-xs text-white/50 mb-2">Current Teams</p>
      {managingMember?.teams.length === 0 ? (
        <p className="text-sm text-white/30">Not in any teams.</p>
      ) : (
        <div className="space-y-2">
          {managingMember?.teams.map(t => (
            <div key={t.teamMemberId} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
              <span className="text-sm text-white">{t.name}</span>
              <button
                onClick={() => handleRemoveFromTeam(t.teamMemberId, t.id)}
                disabled={saving}
                className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>

    {/* Add to team */}
    <div className="border-t border-white/10 pt-4">
      <p className="text-xs text-white/50 mb-2">Add to Team</p>
      <div className="flex gap-2">
        <select
          className="flex-1 bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00CFFF]/50"
          value={addTeamId}
          onChange={e => setAddTeamId(e.target.value)}
        >
          <option value="">Select team…</option>
          {teams
            .filter(t => !managingMember?.teams.some(mt => mt.id === t.id))
            .map(t => <option key={t.id} value={t.id}>{t.name}</option>)
          }
        </select>
        <select
          className="bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00CFFF]/50"
          value={addTeamRole}
          onChange={e => setAddTeamRole(e.target.value as 'MEMBER' | 'ADMIN')}
        >
          <option value="MEMBER">MEMBER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <button
          onClick={handleAddToTeam}
          disabled={saving || !addTeamId}
          className="px-3 py-2 bg-[#00CFFF] hover:bg-[#00CFFF]/90 text-black text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? '…' : 'Add'}
        </button>
      </div>
    </div>

    {error && <p className="text-red-400 text-xs">{error}</p>}
    <div className="flex justify-end pt-1">
      <button
        onClick={() => { setModal(null); setManagingMember(null); }}
        className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors"
      >
        Done
      </button>
    </div>
  </div>
</AdminModal>
```

**Step 3: Build to verify no TypeScript errors**

```bash
cd /Users/nahian/Projects/daily-dose-bot/web && npm run build 2>&1
```

Fix any TypeScript errors before committing.

**Step 4: Commit**

```bash
cd /Users/nahian/Projects/daily-dose-bot
git add web/src/pages/admin/Members.tsx
git commit -m "$(cat <<'EOF'
feat(admin): add Manage Teams modal to Members page for team membership CRUD

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```
