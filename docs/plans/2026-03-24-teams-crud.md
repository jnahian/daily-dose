# Teams CRUD Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add full CRUD (create, read, update, delete) for Teams in the admin panel, plus add `deleted_at` soft-delete columns to all business entity tables.

**Architecture:** Add `deletedAt` to schema for all tables (keeps `isActive` for enabled/disabled); add `POST /api/admin/teams` with Slack channel name → ID resolution, `DELETE /api/admin/teams/:id` soft-delete, enhanced `PUT`; rewrite `Teams.tsx` with discriminated union modal state matching Organizations pattern.

**Tech Stack:** Prisma (PostgreSQL/Supabase), Express.js, React 19 + TypeScript, Tailwind CSS, Lucide React, `@slack/web-api` WebClient

---

## Task 1: Add `deleted_at` to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add `deletedAt` field to all business entity models**

In `prisma/schema.prisma`, add `deletedAt DateTime? @map("deleted_at")` to these models (after `updatedAt` or `createdAt`):

```prisma
model Organization {
  // ... existing fields ...
  isActive           Boolean              @default(true) @map("is_active")
  createdAt          DateTime             @default(now()) @map("created_at")
  updatedAt          DateTime             @updatedAt @map("updated_at")
  deletedAt          DateTime?            @map("deleted_at")   // ADD THIS
  // ... relations ...
}

model Team {
  // ... existing fields ...
  isActive         Boolean           @default(true) @map("is_active")
  createdAt        DateTime          @default(now()) @map("created_at")
  updatedAt        DateTime          @updatedAt @map("updated_at")
  deletedAt        DateTime?         @map("deleted_at")   // ADD THIS
  // ... relations ...
}

model User {
  // ... existing fields ...
  createdAt        DateTime             @default(now()) @map("created_at")
  deletedAt        DateTime?            @map("deleted_at")   // ADD THIS
  // ... relations ...
}

model OrganizationMember {
  // ... existing fields ...
  isActive       Boolean      @default(true) @map("is_active")
  joinedAt       DateTime     @default(now()) @map("joined_at")
  deletedAt      DateTime?    @map("deleted_at")   // ADD THIS
  // ... relations ...
}

model TeamMember {
  // ... existing fields ...
  isActive             Boolean  @default(true) @map("is_active")
  joinedAt             DateTime @default(now()) @map("joined_at")
  deletedAt            DateTime? @map("deleted_at")   // ADD THIS
  // ... relations ...
}

model Leave {
  // ... existing fields ...
  createdAt DateTime @default(now()) @map("created_at")
  deletedAt DateTime? @map("deleted_at")   // ADD THIS
  // ... relations ...
}

model StandupResponse {
  // ... existing fields ...
  submittedAt    DateTime @default(now()) @map("submitted_at")
  deletedAt      DateTime? @map("deleted_at")   // ADD THIS
  // ... relations ...
}

model StandupPost {
  // ... existing fields ...
  postedAt       DateTime @default(now()) @map("posted_at")
  deletedAt      DateTime? @map("deleted_at")   // ADD THIS
  // ... relations ...
}

model Holiday {
  // ... existing fields ...
  updated_at      DateTime
  deletedAt       DateTime? @map("deleted_at")   // ADD THIS
  // ... relations ...
}
```

**Step 2: Push schema to database**

```bash
npx prisma db push
```

Expected: Schema changes applied, client regenerated.

**Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: Client generated successfully.

**Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add deleted_at soft-delete column to all business entity tables"
```

---

## Task 2: Add `POST /api/admin/teams` — Create team with channel resolution

**Files:**
- Modify: `src/routes/admin.js`

**Step 1: Add Slack WebClient import at top of file (if not already present)**

Check the top of `src/routes/admin.js` for existing Slack client imports. Add if missing:

```javascript
const { WebClient } = require('@slack/web-api');
const slackClient = new WebClient(process.env.BOT_TOKEN);
```

**Step 2: Add a helper function to resolve channel name → ID**

Add this function before the routes (after the helper functions like `verifyOrgAccess`):

```javascript
async function resolveChannelId(channelName) {
  // Strip leading # if present
  const name = channelName.replace(/^#/, '').toLowerCase();
  let cursor;
  do {
    const result = await slackClient.conversations.list({
      limit: 200,
      types: 'public_channel,private_channel',
      ...(cursor ? { cursor } : {})
    });
    const match = result.channels.find(c => c.name === name);
    if (match) return match.id;
    cursor = result.response_metadata?.next_cursor;
  } while (cursor);
  return null;
}
```

**Step 3: Add POST `/api/admin/teams` route (insert after the existing PUT /teams/:id route)**

```javascript
// POST /api/admin/teams
router.post('/teams', requireAuth, async (req, res) => {
  try {
    const { orgId, name, channelName, standupTime, postingTime, timezone } = req.body;
    if (!orgId || !name || !channelName || !standupTime || !postingTime || !timezone) {
      return res.status(400).json({ error: 'orgId, name, channelName, standupTime, postingTime, and timezone are required.' });
    }
    const allowed = await verifyOrgAccess(req, res, orgId);
    if (!allowed) return;

    const slackChannelId = await resolveChannelId(channelName);
    if (!slackChannelId) {
      return res.status(400).json({ error: `Channel "${channelName}" not found in Slack workspace.` });
    }

    const team = await prisma.team.create({
      data: {
        organizationId: orgId,
        name: name.trim(),
        slackChannelId,
        standupTime,
        postingTime,
        timezone,
      },
      include: { _count: { select: { members: true } } }
    });

    res.status(201).json({
      id: team.id,
      name: team.name,
      slackChannelId: team.slackChannelId,
      standupTime: team.standupTime,
      postingTime: team.postingTime,
      timezone: team.timezone,
      isActive: team.isActive,
      memberCount: team._count.members
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A team with this channel already exists.' });
    }
    console.error('POST /teams error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Step 4: Commit**

```bash
git add src/routes/admin.js
git commit -m "feat(admin): add POST /api/admin/teams with Slack channel name resolution"
```

---

## Task 3: Add `DELETE /api/admin/teams/:id` — Soft delete

**Files:**
- Modify: `src/routes/admin.js`

**Step 1: Add DELETE route (insert after POST /teams)**

```javascript
// DELETE /api/admin/teams/:id
router.delete('/teams/:id', requireAuth, async (req, res) => {
  try {
    const team = await prisma.team.findUnique({
      where: { id: req.params.id },
      select: { organizationId: true, deletedAt: true }
    });
    if (!team || team.deletedAt) return res.status(404).json({ error: 'Not found' });
    const allowed = await verifyOrgAccess(req, res, team.organizationId);
    if (!allowed) return;

    await prisma.team.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() }
    });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /teams/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Step 2: Update GET /teams to filter out soft-deleted teams**

Find the existing `GET /teams` route (around line 342). Update the `where` clause:

```javascript
// Change:
where: { organizationId: orgId },
// To:
where: { organizationId: orgId, deletedAt: null },
```

**Step 3: Commit**

```bash
git add src/routes/admin.js
git commit -m "feat(admin): add DELETE /api/admin/teams/:id soft delete using deleted_at"
```

---

## Task 4: Enhance `PUT /api/admin/teams/:id` — Add name field

**Files:**
- Modify: `src/routes/admin.js`

**Step 1: Update the PUT route to accept `name`**

Find the existing PUT `/teams/:id` route (around line 370). Replace the destructuring and data object:

```javascript
// Change:
const { standupTime, postingTime, timezone, isActive } = req.body;
const updated = await prisma.team.update({
  where: { id: req.params.id },
  data: { standupTime, postingTime, timezone, isActive }
});

// To:
const { name, standupTime, postingTime, timezone, isActive } = req.body;
const updated = await prisma.team.update({
  where: { id: req.params.id },
  data: {
    ...(name !== undefined && { name: name.trim() }),
    ...(standupTime !== undefined && { standupTime }),
    ...(postingTime !== undefined && { postingTime }),
    ...(timezone !== undefined && { timezone }),
    ...(isActive !== undefined && { isActive }),
  },
  include: { _count: { select: { members: true } } }
});
res.json({
  id: updated.id,
  name: updated.name,
  slackChannelId: updated.slackChannelId,
  standupTime: updated.standupTime,
  postingTime: updated.postingTime,
  timezone: updated.timezone,
  isActive: updated.isActive,
  memberCount: updated._count.members
});
```

Also add a check for `deletedAt` in the PUT route's team lookup (before verifyOrgAccess):

```javascript
// Change:
const team = await prisma.team.findUnique({ where: { id: req.params.id }, select: { organizationId: true } });
if (!team) return res.status(404).json({ error: 'Not found' });

// To:
const team = await prisma.team.findUnique({ where: { id: req.params.id }, select: { organizationId: true, deletedAt: true } });
if (!team || team.deletedAt) return res.status(404).json({ error: 'Not found' });
```

**Step 2: Commit**

```bash
git add src/routes/admin.js
git commit -m "feat(admin): enhance PUT /api/admin/teams to support name field updates"
```

---

## Task 5: Rewrite `Teams.tsx` with full CRUD

**Files:**
- Modify: `web/src/pages/admin/Teams.tsx`

**Step 1: Replace the entire file with the full CRUD implementation**

```typescript
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { DataTable } from '../../components/admin/DataTable';
import { StatusBadge } from '../../components/admin/StatusBadge';
import { AdminModal } from '../../components/admin/AdminModal';
import { useAdminAuth } from '../../hooks/useAdminAuth';

interface Team {
  id: string;
  name: string;
  slackChannelId: string;
  standupTime: string;
  postingTime: string;
  timezone: string;
  isActive: boolean;
  memberCount: number;
}

type ModalState =
  | { type: 'create' }
  | { type: 'edit'; team: Team }
  | { type: 'delete'; team: Team }
  | null;

const emptyForm = {
  name: '',
  channelName: '',
  standupTime: '09:00',
  postingTime: '10:00',
  timezone: 'America/New_York',
  isActive: true,
};

export default function AdminTeams() {
  const { activeOrgId } = useAdminAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeOrgId) return;
    fetch(`/api/admin/teams?orgId=${activeOrgId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(setTeams);
  }, [activeOrgId]);

  const openCreate = () => {
    setForm(emptyForm);
    setError('');
    setModal({ type: 'create' });
  };

  const openEdit = (team: Team) => {
    setForm({
      name: team.name,
      channelName: team.slackChannelId,
      standupTime: team.standupTime,
      postingTime: team.postingTime,
      timezone: team.timezone,
      isActive: team.isActive,
    });
    setError('');
    setModal({ type: 'edit', team });
  };

  const openDelete = (team: Team) => {
    setError('');
    setModal({ type: 'delete', team });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    if (modal?.type === 'create' && !form.channelName.trim()) { setError('Channel name is required.'); return; }
    if (!form.standupTime || !form.postingTime || !form.timezone) { setError('Standup time, posting time, and timezone are required.'); return; }

    setSaving(true);
    setError('');

    const isEdit = modal?.type === 'edit';
    const url = isEdit ? `/api/admin/teams/${(modal as { type: 'edit'; team: Team }).team.id}` : '/api/admin/teams';
    const body = isEdit
      ? { name: form.name, standupTime: form.standupTime, postingTime: form.postingTime, timezone: form.timezone, isActive: form.isActive }
      : { orgId: activeOrgId, name: form.name, channelName: form.channelName, standupTime: form.standupTime, postingTime: form.postingTime, timezone: form.timezone };

    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Failed to save.');
      return;
    }

    const saved: Team = await res.json();
    if (isEdit) {
      setTeams(prev => prev.map(t => t.id === saved.id ? { ...t, ...saved } : t));
    } else {
      setTeams(prev => [saved, ...prev]);
    }
    setModal(null);
  };

  const handleDelete = async () => {
    if (modal?.type !== 'delete') return;
    setSaving(true);
    const res = await fetch(`/api/admin/teams/${modal.team.id}`, { method: 'DELETE', credentials: 'include' });
    setSaving(false);
    if (!res.ok) { setError('Failed to delete.'); return; }
    setTeams(prev => prev.filter(t => t.id !== modal.team.id));
    setModal(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-white">Teams</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-3 py-2 bg-[#00CFFF] hover:bg-[#00CFFF]/90 text-black text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus size={15} />
          New Team
        </button>
      </div>

      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'slackChannelId', label: 'Channel ID' },
          { key: 'standupTime', label: 'Standup' },
          { key: 'postingTime', label: 'Posting' },
          { key: 'timezone', label: 'Timezone' },
          { key: 'memberCount', label: 'Members' },
          {
            key: 'isActive', label: 'Status',
            render: (t) => <StatusBadge variant={t.isActive ? 'active' : 'inactive'} label={t.isActive ? 'Active' : 'Inactive'} />
          },
          {
            key: 'actions', label: '',
            render: (t) => (
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); openEdit(t); }}
                  className="text-white/40 hover:text-[#00CFFF] transition-colors"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); openDelete(t); }}
                  className="text-white/40 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          }
        ]}
        rows={teams}
        emptyMessage="No teams found."
      />

      {/* Create / Edit Modal */}
      <AdminModal
        isOpen={modal?.type === 'create' || modal?.type === 'edit'}
        onClose={() => setModal(null)}
        title={modal?.type === 'edit' ? `Edit — ${(modal as { type: 'edit'; team: Team }).team.name}` : 'New Team'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-1">Name <span className="text-red-400">*</span></label>
            <input
              className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00CFFF]/50"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Engineering"
            />
          </div>
          {modal?.type === 'create' && (
            <div>
              <label className="block text-xs text-white/50 mb-1">Channel Name <span className="text-red-400">*</span></label>
              <input
                className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00CFFF]/50"
                value={form.channelName}
                onChange={e => setForm(f => ({ ...f, channelName: e.target.value }))}
                placeholder="#engineering"
              />
              <p className="text-xs text-white/30 mt-1">Channel name will be resolved to a Slack channel ID.</p>
            </div>
          )}
          <div>
            <label className="block text-xs text-white/50 mb-1">Standup Time <span className="text-red-400">*</span></label>
            <input
              className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00CFFF]/50"
              value={form.standupTime}
              onChange={e => setForm(f => ({ ...f, standupTime: e.target.value }))}
              placeholder="09:00"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Posting Time <span className="text-red-400">*</span></label>
            <input
              className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00CFFF]/50"
              value={form.postingTime}
              onChange={e => setForm(f => ({ ...f, postingTime: e.target.value }))}
              placeholder="10:00"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Timezone <span className="text-red-400">*</span></label>
            <input
              className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00CFFF]/50"
              value={form.timezone}
              onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
              placeholder="America/New_York"
            />
          </div>
          {modal?.type === 'edit' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                className="w-4 h-4 accent-[#00CFFF]"
              />
              <span className="text-sm text-white/70">Active</span>
            </label>
          )}
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-[#00CFFF] hover:bg-[#00CFFF]/90 text-black text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : modal?.type === 'edit' ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </div>
      </AdminModal>

      {/* Delete Confirmation Modal */}
      <AdminModal
        isOpen={modal?.type === 'delete'}
        onClose={() => setModal(null)}
        title="Delete Team"
      >
        <div className="space-y-4">
          <p className="text-sm text-white/70">
            Are you sure you want to delete <span className="text-white font-medium">{modal?.type === 'delete' ? modal.team.name : ''}</span>? The team will be soft-deleted and hidden from the admin panel.
          </p>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Cancel</button>
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
```

**Step 2: Build and verify no TypeScript errors**

```bash
cd web && npm run build
```

Expected: Build succeeds with no TypeScript errors.

**Step 3: Commit**

```bash
git add web/src/pages/admin/Teams.tsx
git commit -m "feat(admin): rewrite Teams page with full CRUD - create, edit, delete with modals"
```

---

## Task 6: Build frontend and final verification

**Step 1: Build the frontend**

```bash
cd web && npm run build
```

Expected: Build completes successfully.

**Step 2: Start the server and verify manually**

```bash
npm run dev
```

Manually verify:
- Teams page loads and shows existing teams
- "New Team" button opens create modal
- Entering a valid channel name creates a team (resolves to channel ID)
- Entering an invalid channel name shows error: `Channel "x" not found in Slack workspace.`
- Edit button opens modal with pre-populated data, including name field
- Saving edit updates the team in the list
- Delete button opens confirmation, confirming removes team from list
- Deleted teams do not reappear on page refresh

**Step 3: Final commit**

```bash
cd web && npm run build
git add web/dist
git commit -m "chore: rebuild frontend for teams CRUD feature"
```
