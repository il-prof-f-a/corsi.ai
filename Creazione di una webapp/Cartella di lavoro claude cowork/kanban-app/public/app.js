'use strict';

// ═══════════════════════════ CONFIGURAZIONE ══════════════════════════════════
const COLORS = ['#6366f1','#3b82f6','#8b5cf6','#ec4899','#ef4444','#f97316','#f59e0b','#10b981'];

// ═══════════════════════════ STATO ══════════════════════════════════════════
const state = {
  translations: {},
  lang: localStorage.getItem('lang') || (navigator.language.startsWith('it') ? 'it' : 'en'),
  currentProjectId: null,
  currentProject: null,
  collaborators: [],
  filters: { collaborator: '', priority: '', overdue: false },
  timerInterval: null,
  confirmCallback: null,
  collabEditId: null,
  pwaPrompt: null,
};

// ═══════════════════════════ i18n ═════════════════════════════════════════════
async function loadLang(lang) {
  const r = await fetch(`/locales/${lang}.json`);
  state.translations = await r.json();
  state.lang = lang;
  localStorage.setItem('lang', lang);
  applyTranslations();
}

function t(key) {
  return key.split('.').reduce((o, k) => o?.[k], state.translations) ?? key;
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  // Aggiorna placeholder filtri
  const fc = $('filter-collaborator');
  if (fc && fc.options[0]) fc.options[0].text = `👤 ${t('kanban.filter_all')}`;
  const fp = $('filter-priority');
  if (fp && fp.options[0]) fp.options[0].text = `🔥 ${t('kanban.filter_all')}`;
  // Titoli tooltip header
  $('btn-back')?.setAttribute('title', t('header.back'));
  $('btn-collaborators')?.setAttribute('title', t('header.collaborators'));
  $('btn-export')?.setAttribute('title', t('header.export'));
  $('btn-logout')?.setAttribute('title', t('header.logout'));
  $('filter-collaborator')?.setAttribute('title', t('kanban.filter_collaborator'));
  $('filter-priority')?.setAttribute('title', t('kanban.filter_priority'));
  $('filter-overdue')?.closest('label')?.setAttribute('title', t('kanban.filter_overdue'));
}

// ═══════════════════════════ HELPERS DOM ════════════════════════════════════
const $ = id => document.getElementById(id);
function html(strings, ...values) {
  return strings.reduce((r, s, i) => r + s + (values[i] !== undefined ? escHtml(String(values[i])) : ''), '');
}
function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function show(id) { const el = $(id); if (el) el.hidden = false; }
function hide(id) { const el = $(id); if (el) el.hidden = true; }
function showEl(el) { if (el) el.hidden = false; }
function hideEl(el) { if (el) el.hidden = true; }

// ═══════════════════════════ API CLIENT ══════════════════════════════════════
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`/api${path}`, opts);
  if (res.status === 401) { showLoginView(); return null; }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Errore');
  return data;
}

// ═══════════════════════════ TOAST ══════════════════════════════════════════
function toast(msg, type = 'default') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  $('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ═══════════════════════════ VIEWS ══════════════════════════════════════════
function showLoginView() {
  hide('view-app'); show('view-login');
}

function showAppView() {
  hide('view-login'); show('view-app');
  showProjectsView();
}

function showProjectsView() {
  state.currentProjectId = null;
  state.currentProject = null;
  hide('view-kanban'); show('view-projects');
  hide('btn-back'); hide('btn-add-task'); hide('btn-add-column'); hide('kanban-filters');
  show('btn-new-project');
  $('header-title').textContent = t('app_name');
  stopTimerDisplay();
  loadProjects();
}

async function showKanbanView(projectId) {
  state.currentProjectId = projectId;
  hide('view-projects'); show('view-kanban');
  hide('btn-new-project');
  show('btn-back'); show('btn-add-task'); show('btn-add-column'); show('kanban-filters');
  await loadKanban();
}

// ═══════════════════════════ PROGETTI ════════════════════════════════════════
async function loadProjects() {
  const projects = await api('GET', '/projects');
  if (!projects) return;
  const grid = $('projects-grid');
  if (!projects.length) {
    grid.innerHTML = `<div class="project-empty">${t('projects.empty')}</div>`;
    return;
  }
  grid.innerHTML = projects.map(renderProjectCard).join('');
}

function renderProjectCard(p) {
  const total = p.task_count || 0;
  const done  = p.done_count  || 0;
  const pct   = total ? Math.round(done / total * 100) : 0;
  let deadlineHtml = '';
  if (p.deadline) {
    const days = Math.ceil((new Date(p.deadline) - new Date()) / 86400000);
    const cls  = days < 0 ? 'deadline-overdue' : days <= 7 ? 'deadline-soon' : 'deadline-ok';
    const label = days < 0 ? `${-days}d scaduta` : days === 0 ? 'Oggi' : `${days}d`;
    deadlineHtml = `<span class="project-deadline ${cls}">${escHtml(label)}</span>`;
  }
  return `
  <div class="project-card" data-project-id="${p.id}">
    <div class="project-card-accent" style="background:${escHtml(p.color)}"></div>
    <div class="project-card-body">
      <div class="project-card-name">${escHtml(p.name)}</div>
      <div class="project-card-desc">${escHtml(p.description || '')}</div>
    </div>
    <div class="project-card-footer">
      <div class="project-progress">
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="progress-text">${done}/${total} ${t('projects.tasks_done')}</div>
      </div>
      ${deadlineHtml}
      <div class="project-actions">
        <button class="btn-icon" data-action="edit-project" data-id="${p.id}" title="${t('projects.edit')}">✏️</button>
        <button class="btn-icon" data-action="delete-project" data-id="${p.id}" title="${t('projects.delete')}">🗑</button>
      </div>
    </div>
  </div>`;
}

// ═══════════════════════════ KANBAN ══════════════════════════════════════════
async function loadKanban() {
  const project = await api('GET', `/projects/${state.currentProjectId}`);
  if (!project) return;
  state.currentProject = project;
  state.collaborators = project.collaborators;
  $('header-title').textContent = escHtml(project.name);
  updateFilterCollaborators();
  renderKanban(project);
}

function renderKanban(project) {
  const board = $('kanban-board');
  board.innerHTML = project.columns.map(col => renderColumn(col)).join('') +
    `<div class="kanban-add-column">
       <button class="btn-add-col" data-action="add-column" title="${t('column_modal.title_new')}">
         + ${t('kanban.add_column')}
       </button>
     </div>`;
  initSortable();
  startTimerDisplay();
  applyFilters();
}

function renderColumn(col) {
  const tasks = (col.tasks || []).map(renderTaskCard).join('');
  const count = (col.tasks || []).length;
  return `
  <div class="kanban-column" data-column-id="${col.id}" data-project-id="${col.project_id}">
    <div class="kanban-column-header" style="border-top: 3px solid ${escHtml(col.color)}">
      <div class="column-title-wrap">
        <span class="column-dot" style="background:${escHtml(col.color)}"></span>
        <span class="column-title">${escHtml(col.name)}</span>
        <span class="column-count">${count}</span>
      </div>
      <div class="column-actions">
        <button class="column-action-btn" data-action="edit-column" data-id="${col.id}" title="${t('column_modal.edit')}">✏️</button>
        <button class="column-action-btn" data-action="delete-column" data-id="${col.id}" title="${t('column_modal.delete')}">🗑</button>
      </div>
    </div>
    <div class="kanban-tasks" data-column-id="${col.id}">
      ${tasks || `<div class="column-empty">${t('kanban.empty_column')}</div>`}
    </div>
    <button class="column-add-task" data-action="add-task" data-column-id="${col.id}" title="${t('task_modal.title_new')}">
      + ${t('kanban.add_task')}
    </button>
  </div>`;
}

function renderTaskCard(task) {
  const priorityDot = `<span class="task-priority-dot priority-dot-${escHtml(task.priority)}" title="${t('priority.' + task.priority)}"></span>`;
  // Avatars
  let avatarHtml = '<div class="task-avatars">';
  if (task.assigned_by_name) {
    avatarHtml += `<div class="avatar avatar-sm" style="background:${escHtml(task.assigned_by_color||'#64748b')}" title="${t('task_card.assigned_by')}: ${escHtml(task.assigned_by_name)}">${escHtml(initials(task.assigned_by_name))}</div>`;
  }
  if (task.assigned_to_name) {
    avatarHtml += `<div class="avatar" style="background:${escHtml(task.assigned_to_color||'#6366f1')}" title="${t('task_card.assigned_to')}: ${escHtml(task.assigned_to_name)}">${escHtml(initials(task.assigned_to_name))}</div>`;
  }
  avatarHtml += '</div>';

  // Due date badge
  let dueBadge = '';
  if (task.due_date) {
    const days = Math.ceil((new Date(task.due_date) - new Date()) / 86400000);
    const cls  = days < 0 ? 'badge-due-overdue' : days <= 3 ? 'badge-due-soon' : 'badge-due-ok';
    const label = days < 0 ? `${-days}d` : days === 0 ? 'Oggi' : `${days}d`;
    dueBadge = `<span class="task-badge ${cls}" title="${t('task_card.due')}: ${escHtml(task.due_date)}">📅 ${escHtml(label)}</span>`;
  }

  // Hours badge
  let hoursBadge = '';
  if (task.estimated_hours > 0 || task.actual_hours > 0) {
    hoursBadge = `<span class="task-badge badge-hours" title="Stimate / Effettive">⏱ ${+task.actual_hours.toFixed(1)}/${+task.estimated_hours.toFixed(1)}h</span>`;
  }

  // Timer
  const isActive = !!task.timer_started_at;
  const timerCls  = isActive ? 'active' : '';
  const timerIcon = isActive ? '⏸' : '▶';
  const timerTitle= isActive ? t('task_card.timer_stop') : t('task_card.timer_start');
  const timerTime = isActive ? `<span class="timer-display" data-task-id="${task.id}" data-started="${escHtml(task.timer_started_at)}">0:00</span>` : '';

  return `
  <div class="task-card" data-task-id="${task.id}" style="border-left-color:${escHtml(task.color)}">
    <div class="task-card-top">
      ${priorityDot}
      <span class="task-title">${escHtml(task.title)}</span>
    </div>
    ${task.description ? `<div class="task-desc">${escHtml(task.description)}</div>` : ''}
    <div class="task-meta">
      ${dueBadge}${hoursBadge}
      <button class="task-timer-btn ${timerCls}" data-action="${isActive ? 'stop-timer' : 'start-timer'}" data-task-id="${task.id}" title="${timerTitle}">
        ${timerIcon} ${timerTime}
      </button>
      ${avatarHtml}
    </div>
    <div class="task-actions">
      <button class="task-action-btn" data-action="edit-task" data-task-id="${task.id}" title="${t('task_card.edit')}">✏️</button>
      <button class="task-action-btn" data-action="delete-task" data-task-id="${task.id}" title="${t('task_card.delete')}">🗑</button>
    </div>
  </div>`;
}

function initials(name) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// ═══════════════════════════ TIMER DISPLAY ══════════════════════════════════
function startTimerDisplay() {
  stopTimerDisplay();
  state.timerInterval = setInterval(updateTimers, 1000);
  updateTimers();
}

function stopTimerDisplay() {
  if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
}

function updateTimers() {
  document.querySelectorAll('.timer-display').forEach(el => {
    const started = new Date(el.dataset.started);
    const elapsed = Math.floor((Date.now() - started) / 1000);
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    el.textContent = h > 0
      ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      : `${m}:${String(s).padStart(2,'0')}`;
  });
}

// ═══════════════════════════ DRAG & DROP (SortableJS) ════════════════════════
function initSortable() {
  // Riordino colonne (trascina dalla header)
  const board = $('kanban-board');
  if (board._sortable) board._sortable.destroy();
  board._sortable = new Sortable(board, {
    animation: 150, handle: '.kanban-column-header',
    draggable: '.kanban-column', ghostClass: 'sortable-ghost',
    filter: '.kanban-add-column',
    onEnd(evt) {
      const cols = [...board.querySelectorAll('.kanban-column')].map((el, i) => ({
        id: parseInt(el.dataset.columnId), position: i
      }));
      api('POST', '/columns/reorder', { columns: cols }).catch(e => toast(e.message, 'error'));
    }
  });

  // Riordino task tra colonne
  document.querySelectorAll('.kanban-tasks').forEach(el => {
    if (el._sortable) el._sortable.destroy();
    el._sortable = new Sortable(el, {
      group: 'tasks', animation: 150,
      ghostClass: 'sortable-ghost', dragClass: 'sortable-drag',
      onEnd(evt) {
        const fromColId = parseInt(evt.from.dataset.columnId);
        const toColId   = parseInt(evt.to.dataset.columnId);
        const fromTasks = [...evt.from.querySelectorAll('[data-task-id]')].map((c, i) => ({
          id: parseInt(c.dataset.taskId), column_id: fromColId, position: i
        }));
        const toTasks = fromColId === toColId ? [] : [...evt.to.querySelectorAll('[data-task-id]')].map((c, i) => ({
          id: parseInt(c.dataset.taskId), column_id: toColId, position: i
        }));
        const all = [...fromTasks, ...toTasks];
        api('POST', '/tasks/reorder', { tasks: all })
          .then(() => {
            // Aggiorna colonne vuote
            updateColumnEmptyState(evt.from, fromColId);
            if (evt.from !== evt.to) updateColumnEmptyState(evt.to, toColId);
            updateColumnCount(evt.from, evt.to);
          })
          .catch(e => toast(e.message, 'error'));
      }
    });
  });
}

function updateColumnEmptyState(container, colId) {
  const hasTasks = container.querySelectorAll('[data-task-id]').length > 0;
  let empty = container.querySelector('.column-empty');
  if (!hasTasks && !empty) {
    empty = document.createElement('div');
    empty.className = 'column-empty';
    empty.textContent = t('kanban.empty_column');
    container.appendChild(empty);
  } else if (hasTasks && empty) {
    empty.remove();
  }
}

function updateColumnCount(fromEl, toEl) {
  [fromEl, toEl].forEach(tasksEl => {
    if (!tasksEl) return;
    const col = tasksEl.closest('.kanban-column');
    if (!col) return;
    const count = tasksEl.querySelectorAll('[data-task-id]').length;
    const badge = col.querySelector('.column-count');
    if (badge) badge.textContent = count;
  });
}

// ═══════════════════════════ FILTRI ══════════════════════════════════════════
function updateFilterCollaborators() {
  const sel = $('filter-collaborator');
  sel.innerHTML = `<option value="">${'👤 ' + t('kanban.filter_all')}</option>` +
    state.collaborators.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');
}

function applyFilters() {
  const { collaborator, priority, overdue } = state.filters;
  document.querySelectorAll('.task-card').forEach(card => {
    const tid = parseInt(card.dataset.taskId);
    const col = card.closest('.kanban-column');
    if (!col) return;
    const colData = state.currentProject?.columns.find(c => c.id === parseInt(col.dataset.columnId));
    const task = colData?.tasks?.find(t => t.id === tid);
    if (!task) return;

    let visible = true;
    if (collaborator && task.assigned_to !== parseInt(collaborator) && task.assigned_by !== parseInt(collaborator)) visible = false;
    if (priority   && task.priority !== priority) visible = false;
    if (overdue    && task.due_date) {
      const days = Math.ceil((new Date(task.due_date) - new Date()) / 86400000);
      if (days >= 0) visible = false;
    }
    card.classList.toggle('filtered-out', !visible);
  });
}

// ═══════════════════════════ MODAL PROJECT ═══════════════════════════════════
function openProjectModal(project = null) {
  $('modal-project-title').textContent = project ? t('project_modal.title_edit') : t('project_modal.title_new');
  $('project-id').value = project?.id ?? '';
  $('project-name').value = project?.name ?? '';
  $('project-description').value = project?.description ?? '';
  $('project-deadline').value = project?.deadline ?? '';
  const color = project?.color ?? '#6366f1';
  $('project-color').value = color;
  buildColorPicker('project-color-picker', 'project-color', color);
  showModal('modal-project');
  $('project-name').focus();
}

async function saveProject() {
  const id   = $('project-id').value;
  const name = $('project-name').value.trim();
  if (!name) { toast(t('project_modal.name'), 'warn'); return; }
  const body = {
    name,
    description: $('project-description').value,
    color:    $('project-color').value,
    deadline: $('project-deadline').value || null
  };
  try {
    if (id) await api('PUT', `/projects/${id}`, body);
    else    await api('POST', '/projects', body);
    hideModal('modal-project');
    toast(t('toast.saved'), 'success');
    await loadProjects();
  } catch(e) { toast(e.message, 'error'); }
}

// ═══════════════════════════ MODAL COLUMN ════════════════════════════════════
function openColumnModal(col = null, projectId = null) {
  $('modal-column-title').textContent = col ? t('column_modal.title_edit') : t('column_modal.title_new');
  $('column-id').value = col?.id ?? '';
  $('column-project-id').value = col?.project_id ?? projectId ?? '';
  $('column-name').value = col?.name ?? '';
  $('column-is-done').checked = !!(col?.is_done);
  const color = col?.color ?? '#64748b';
  $('column-color').value = color;
  buildColorPicker('column-color-picker', 'column-color', color);
  showModal('modal-column');
  $('column-name').focus();
}

async function saveColumn() {
  const id  = $('column-id').value;
  const pid = $('column-project-id').value;
  const name = $('column-name').value.trim();
  if (!name) { toast(t('column_modal.name'), 'warn'); return; }
  const body = { name, color: $('column-color').value, is_done: $('column-is-done').checked ? 1 : 0 };
  try {
    if (id) await api('PUT', `/columns/${id}`, body);
    else    await api('POST', '/columns', { ...body, project_id: parseInt(pid) });
    hideModal('modal-column');
    toast(t('toast.saved'), 'success');
    await loadKanban();
  } catch(e) { toast(e.message, 'error'); }
}

// ═══════════════════════════ MODAL TASK ══════════════════════════════════════
function buildCollabOptions(selectedId) {
  const none = `<option value="">${t('task_modal.none')}</option>`;
  return none + state.collaborators.map(c =>
    `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${escHtml(c.name)}</option>`
  ).join('');
}

function buildColumnOptions(selectedId) {
  if (!state.currentProject) return '';
  return state.currentProject.columns.map(c =>
    `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${escHtml(c.name)}</option>`
  ).join('');
}

async function openTaskModal(task = null, columnId = null) {
  $('modal-task-title').textContent = task ? t('task_modal.title_edit') : t('task_modal.title_new');
  $('task-id').value = task?.id ?? '';
  $('task-project-id').value = task?.project_id ?? state.currentProjectId ?? '';
  $('task-title').value = task?.title ?? '';
  $('task-description').value = task?.description ?? '';
  $('task-estimated-hours').value = task?.estimated_hours ?? 0;
  $('task-actual-hours').value    = task?.actual_hours ?? 0;
  $('task-due-date').value        = task?.due_date ?? '';
  $('task-assigned-to').innerHTML = buildCollabOptions(task?.assigned_to);
  $('task-assigned-by').innerHTML = buildCollabOptions(task?.assigned_by);
  $('task-column').innerHTML      = buildColumnOptions(task?.column_id ?? parseInt(columnId));

  const color = task?.color ?? '#6366f1';
  $('task-color').value = color;
  buildColorPicker('task-color-picker', 'task-color', color);

  const priority = task?.priority ?? 'medium';
  $('task-priority').value = priority;
  document.querySelectorAll('.priority-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.priority === priority);
  });

  // Timer logs
  const logsWrap = $('task-timer-logs-wrap');
  if (task?.id) {
    logsWrap.hidden = false;
    const logs = await api('GET', `/tasks/${task.id}/timer/logs`);
    $('task-timer-logs').innerHTML = (logs||[]).map(l => {
      const dur = l.duration_minutes ? ` — ${Math.round(l.duration_minutes)}min` : ' (in corso)';
      const st  = l.started_at ? new Date(l.started_at).toLocaleString(state.lang) : '';
      return `<div class="timer-log-item"><span>${st}</span><span>${dur}</span></div>`;
    }).join('') || `<div style="color:var(--text-muted);font-size:.8rem">Nessuna sessione</div>`;
  } else {
    logsWrap.hidden = true;
  }

  showModal('modal-task');
  $('task-title').focus();
}

async function saveTask() {
  const id  = $('task-id').value;
  const pid = $('task-project-id').value;
  const title = $('task-title').value.trim();
  if (!title) { toast(t('task_modal.title_field'), 'warn'); return; }
  const colId = parseInt($('task-column').value);
  const body = {
    title,
    description:     $('task-description').value,
    color:           $('task-color').value,
    priority:        $('task-priority').value,
    assigned_to:     $('task-assigned-to').value  ? parseInt($('task-assigned-to').value)  : null,
    assigned_by:     $('task-assigned-by').value  ? parseInt($('task-assigned-by').value)  : null,
    estimated_hours: parseFloat($('task-estimated-hours').value) || 0,
    actual_hours:    parseFloat($('task-actual-hours').value)    || 0,
    due_date:        $('task-due-date').value || null,
    column_id:       colId,
    project_id:      parseInt(pid)
  };
  try {
    if (id) await api('PUT',  `/tasks/${id}`, body);
    else    await api('POST', '/tasks', body);
    hideModal('modal-task');
    toast(t('toast.saved'), 'success');
    await loadKanban();
  } catch(e) { toast(e.message, 'error'); }
}

// ═══════════════════════════ TIMER AZIONI ════════════════════════════════════
async function startTimer(taskId) {
  try {
    await api('POST', `/tasks/${taskId}/timer/start`);
    toast(t('toast.timer_started'), 'success');
    await loadKanban();
  } catch(e) { toast(e.message, 'error'); }
}

async function stopTimer(taskId) {
  try {
    await api('POST', `/tasks/${taskId}/timer/stop`);
    toast(t('toast.timer_stopped'), 'success');
    await loadKanban();
  } catch(e) { toast(e.message, 'error'); }
}

// ═══════════════════════════ COLLABORATORI ════════════════════════════════════
async function openCollaboratorsModal() {
  state.collabEditId = null;
  hideCollabForm();
  await renderCollaboratorsList();
  showModal('modal-collaborators');
}

async function renderCollaboratorsList() {
  const collabs = await api('GET', '/collaborators');
  if (!collabs) return;
  state.collaborators = collabs;
  $('collab-list').innerHTML = collabs.length === 0
    ? `<div style="color:var(--text-muted);text-align:center;padding:1rem">${t('collaborators.empty')}</div>`
    : collabs.map(c => `
      <div class="collab-item">
        <div class="avatar" style="background:${escHtml(c.avatar_color)}">${escHtml(initials(c.name))}</div>
        <div class="collab-info">
          <div class="collab-name">${escHtml(c.name)}</div>
          ${c.role ? `<div class="collab-role">${escHtml(c.role)}</div>` : ''}
          <div class="collab-stats">${c.tasks_assigned_to} ${t('collaborators.tasks_to')} · ${c.tasks_assigned_by} ${t('collaborators.tasks_by')}</div>
        </div>
        <div class="collab-item-actions">
          <button class="btn btn-sm btn-ghost" data-action="edit-collab" data-id="${c.id}" title="${t('collaborators.edit')}">✏️</button>
          <button class="btn btn-sm btn-ghost" data-action="delete-collab" data-id="${c.id}" title="${t('collaborators.delete')}">🗑</button>
        </div>
      </div>`).join('');
}

function showCollabForm(collab = null) {
  state.collabEditId = collab?.id ?? null;
  $('collab-id').value    = collab?.id ?? '';
  $('collab-name').value  = collab?.name ?? '';
  $('collab-role').value  = collab?.role ?? '';
  const color = collab?.avatar_color ?? '#6366f1';
  $('collab-color').value = color;
  buildColorPicker('collab-color-picker', 'collab-color', color);
  $('collab-form').hidden = false;
  $('collab-name').focus();
}

function hideCollabForm() {
  $('collab-form').hidden = true;
  $('collab-id').value = '';
  $('collab-name').value = '';
  $('collab-role').value = '';
}

async function saveCollab() {
  const id = $('collab-id').value;
  const name = $('collab-name').value.trim();
  if (!name) { toast(t('collaborators.name'), 'warn'); return; }
  const body = { name, role: $('collab-role').value, avatar_color: $('collab-color').value };
  try {
    if (id) await api('PUT', `/collaborators/${id}`, body);
    else    await api('POST', '/collaborators', body);
    toast(t('toast.saved'), 'success');
    hideCollabForm();
    await renderCollaboratorsList();
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteCollab(id) {
  confirm(t('confirm.title'), async () => {
    try {
      const r = await api('DELETE', `/collaborators/${id}`);
      if (!r) return;
      if (r.canForce) {
        confirm(`${r.error} ${t('collaborators.force_delete')}?`, async () => {
          await api('DELETE', `/collaborators/${id}?force=1`);
          toast(t('toast.deleted'), 'success');
          await renderCollaboratorsList();
        });
        return;
      }
      toast(t('toast.deleted'), 'success');
      await renderCollaboratorsList();
    } catch(e) { toast(e.message, 'error'); }
  });
}

// ═══════════════════════════ COLOR PICKER ════════════════════════════════════
function buildColorPicker(pickerId, targetId, selectedColor) {
  const picker = $(pickerId);
  picker.innerHTML = COLORS.map(c =>
    `<button type="button" class="color-option ${c === selectedColor ? 'active' : ''}"
      style="background:${c}" data-color="${c}" data-target="${targetId}"
      title="${c}"></button>`
  ).join('');
}

// ═══════════════════════════ MODAL UTILITY ════════════════════════════════════
function showModal(id)  { const el = $(id); if (el) el.hidden = false; }
function hideModal(id)  { const el = $(id); if (el) el.hidden = true;  }

function confirm(message, callback) {
  $('confirm-message').textContent = message;
  state.confirmCallback = callback;
  showModal('modal-confirm');
}

// ═══════════════════════════ PWA ══════════════════════════════════════════════
function setupPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    state.pwaPrompt = e;
    show('pwa-banner');
  });
  $('btn-pwa-install')?.addEventListener('click', () => {
    state.pwaPrompt?.prompt();
    hide('pwa-banner');
  });
  $('btn-pwa-dismiss')?.addEventListener('click', () => hide('pwa-banner'));
}

// ═══════════════════════════ EVENT LISTENERS ══════════════════════════════════
function setupEvents() {

  // ── Login ──
  $('form-login')?.addEventListener('submit', async e => {
    e.preventDefault();
    const pw = $('login-password').value;
    const btn = $('btn-login');
    btn.disabled = true;
    try {
      const r = await api('POST', '/auth/login', { password: pw });
      if (r?.success) showAppView();
    } catch {
      $('login-error').textContent = t('login.wrong_password');
      $('login-error').hidden = false;
      $('login-password').classList.add('input-error');
      $('login-password').animate([{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'none'}], {duration:300});
    } finally { btn.disabled = false; }
  });

  $('form-setup')?.addEventListener('submit', async e => {
    e.preventDefault();
    const pw  = $('setup-password').value;
    const cpw = $('setup-confirm').value;
    const err = $('setup-error');
    if (pw.length < 6) { err.textContent = t('login.password_too_short'); err.hidden = false; return; }
    if (pw !== cpw)    { err.textContent = t('login.passwords_mismatch');  err.hidden = false; return; }
    err.hidden = true;
    try {
      const r = await api('POST', '/auth/login', { password: pw });
      if (r?.success) showAppView();
    } catch(ex) { err.textContent = ex.message; err.hidden = false; }
  });

  $('btn-toggle-pw')?.addEventListener('click', () => {
    const inp = $('login-password');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  $('btn-back-login')?.addEventListener('click', () => {
    hide('form-setup'); show('form-login');
    $('login-heading').textContent = t('login.title');
  });

  // ── Lang selectors ──
  ['lang-login','lang-app'].forEach(id => {
    $(id)?.addEventListener('change', e => {
      loadLang(e.target.value);
      document.querySelectorAll('.lang-select').forEach(s => s.value = e.target.value);
    });
  });

  // ── Header ──
  $('btn-back')?.addEventListener('click', showProjectsView);
  $('btn-logout')?.addEventListener('click', async () => {
    await api('POST', '/auth/logout');
    showLoginView();
  });
  $('btn-collaborators')?.addEventListener('click', openCollaboratorsModal);
  $('btn-export')?.addEventListener('click', () => showModal('modal-export'));
  $('btn-new-project')?.addEventListener('click', () => openProjectModal());
  $('btn-add-task')?.addEventListener('click', () => {
    const firstCol = state.currentProject?.columns[0];
    if (firstCol) openTaskModal(null, firstCol.id);
  });
  $('btn-add-column')?.addEventListener('click', () => openColumnModal(null, state.currentProjectId));

  // ── Filtri ──
  $('filter-collaborator')?.addEventListener('change', e => {
    state.filters.collaborator = e.target.value; applyFilters();
  });
  $('filter-priority')?.addEventListener('change', e => {
    state.filters.priority = e.target.value; applyFilters();
  });
  $('filter-overdue')?.addEventListener('change', e => {
    state.filters.overdue = e.target.checked; applyFilters();
  });

  // ── Modal: tasto chiudi ──
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-close-modal]');
    if (btn) { hideModal(btn.dataset.closeModal); return; }

    // Backdrop click
    if (e.target.classList.contains('modal-overlay')) {
      e.target.hidden = true;
      return;
    }
  });

  // ── Esc chiude modal ──
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay:not([hidden])').forEach(m => m.hidden = true);
    }
  });

  // ── Color picker ──
  document.addEventListener('click', e => {
    const btn = e.target.closest('.color-option');
    if (!btn) return;
    const targetId = btn.dataset.target;
    const color = btn.dataset.color;
    $(targetId).value = color;
    btn.closest('.color-picker').querySelectorAll('.color-option').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });

  // ── Priority selector ──
  document.addEventListener('click', e => {
    const btn = e.target.closest('.priority-btn');
    if (!btn) return;
    const priority = btn.dataset.priority;
    $('task-priority').value = priority;
    document.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });

  // ── Save buttons ──
  $('btn-save-project')?.addEventListener('click', saveProject);
  $('btn-save-column' )?.addEventListener('click', saveColumn);
  $('btn-save-task'   )?.addEventListener('click', saveTask);

  // ── Confirm modal ──
  $('btn-confirm-yes')?.addEventListener('click', () => {
    hideModal('modal-confirm');
    if (state.confirmCallback) { state.confirmCallback(); state.confirmCallback = null; }
  });
  $('btn-confirm-no')?.addEventListener('click', () => {
    hideModal('modal-confirm'); state.confirmCallback = null;
  });

  // ── Collaboratori ──
  $('btn-new-collab')?.addEventListener('click', () => showCollabForm());
  $('btn-save-collab')?.addEventListener('click', saveCollab);
  $('btn-cancel-collab')?.addEventListener('click', hideCollabForm);

  // ── Delegazione eventi progetti ──
  $('projects-grid')?.addEventListener('click', async e => {
    const card = e.target.closest('.project-card');
    const action = e.target.closest('[data-action]')?.dataset.action;
    const id = e.target.closest('[data-id]')?.dataset.id;

    if (action === 'edit-project') { e.stopPropagation(); const p = await api('GET', `/projects/${id}`); openProjectModal(p); return; }
    if (action === 'delete-project') {
      e.stopPropagation();
      confirm(t('confirm.title'), async () => {
        try { await api('DELETE', `/projects/${id}`); toast(t('toast.deleted'), 'success'); loadProjects(); }
        catch(ex) { toast(ex.message, 'error'); }
      });
      return;
    }
    if (card && !action) showKanbanView(parseInt(card.dataset.projectId));
  });

  // ── Delegazione eventi kanban ──
  $('kanban-board')?.addEventListener('click', async e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    const colId  = e.target.closest('[data-column-id]')?.dataset.columnId;
    const taskEl = e.target.closest('[data-task-id]');
    const taskId = taskEl?.dataset.taskId || e.target.closest('[data-task-id]')?.dataset.taskId;

    if (action === 'add-column') { openColumnModal(null, state.currentProjectId); return; }
    if (action === 'add-task')   { openTaskModal(null, colId); return; }

    if (action === 'edit-column') {
      const col = state.currentProject?.columns.find(c => c.id === parseInt(e.target.closest('[data-id]').dataset.id));
      if (col) openColumnModal(col); return;
    }
    if (action === 'delete-column') {
      const cid = e.target.closest('[data-id]').dataset.id;
      confirm(t('confirm.title'), async () => {
        try { await api('DELETE', `/columns/${cid}`); toast(t('toast.deleted'), 'success'); loadKanban(); }
        catch(ex) { toast(ex.message, 'error'); }
      });
      return;
    }

    if (action === 'edit-task') {
      const task = await api('GET', `/tasks/${taskId}`);
      if (task) openTaskModal(task); return;
    }
    if (action === 'delete-task') {
      confirm(t('confirm.title'), async () => {
        try { await api('DELETE', `/tasks/${taskId}`); toast(t('toast.deleted'), 'success'); loadKanban(); }
        catch(ex) { toast(ex.message, 'error'); }
      });
      return;
    }
    if (action === 'start-timer') { startTimer(taskId); return; }
    if (action === 'stop-timer')  { stopTimer(taskId);  return; }
  });

  // ── Delegazione collaboratori modal ──
  $('collab-list')?.addEventListener('click', async e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    const id     = e.target.closest('[data-id]')?.dataset.id;
    if (action === 'edit-collab') {
      const c = state.collaborators.find(x => x.id === parseInt(id));
      if (c) showCollabForm(c); return;
    }
    if (action === 'delete-collab') { deleteCollab(parseInt(id)); return; }
  });
}

// ═══════════════════════════ INIT ═════════════════════════════════════════════
async function init() {
  // Imposta lingua nei selettori
  document.querySelectorAll('.lang-select').forEach(s => s.value = state.lang);

  await loadLang(state.lang);
  setupEvents();
  setupPWA();

  // Controlla stato auth
  try {
    const status = await api('GET', '/auth/status');
    if (!status) return;
    if (status.authenticated) {
      showAppView();
    } else if (status.firstRun) {
      // Mostra wizard primo avvio
      hide('form-login'); show('form-setup');
      $('login-heading').textContent = t('login.setup_title');
      $('setup-hint').textContent    = t('login.first_run_hint');
    }
    // else: già in login view
  } catch { /* mostra login */ }
}

document.addEventListener('DOMContentLoaded', init);
