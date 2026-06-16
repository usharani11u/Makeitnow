// ─── Sample Inputs ────────────────────────────────────────────────
const SAMPLES = {
  1: `Vivek spoke with a potential client about automating their sales follow-ups. Nandini needs to prepare a list of 20 similar companies by Friday. Gagan should test whether meeting notes can be converted into Linear tasks. Suhas will prepare a simple workflow diagram. The client asked for a proposal next week. Vivek needs to decide pricing before the next call.`,
  2: `Usha to review the onboarding deck and share feedback by Wednesday. Manoj should set up a staging environment before Thursday's demo. The product team needs to finalise the feature list for Q3 by end of this month. Bannu will reach out to three beta users for feedback. Renuka and Ashwini should sync on the API integration this week. No decision yet on the pricing page needs further discussion. Everyone should read the competitor analysis doc before Monday.`
};

const KNOWN_NAMES = [
  "Vivek","Nandini","Gagan","Suhas","Priya","Rohan","Ankit","Deepa",
  "Rahul","Sneha","Arjun","Pooja","Karan","Meera","Aakash","Divya",
  "Amit","Neha","Raj","Sara","David","Alice","Bob","Carol","Michael"
];

const DUE_PATTERNS = [
  { re: /by\s+friday/i,                      label: "By Friday" },
  { re: /by\s+thursday/i,                    label: "By Thursday" },
  { re: /by\s+wednesday/i,                   label: "By Wednesday" },
  { re: /by\s+tuesday/i,                     label: "By Tuesday" },
  { re: /by\s+monday/i,                      label: "By Monday" },
  { re: /by\s+end\s+of\s+(this\s+)?month/i, label: "End of month" },
  { re: /by\s+end\s+of\s+(this\s+)?week/i,  label: "End of week" },
  { re: /next\s+week/i,                      label: "Next week" },
  { re: /this\s+week/i,                      label: "This week" },
  { re: /before\s+the\s+next\s+call/i,      label: "Before next call" },
  { re: /before\s+monday/i,                  label: "Before Monday" },
  { re: /before\s+thursday'?s?\s+demo/i,    label: "Before Thursday demo" },
  { re: /tomorrow/i,                         label: "Tomorrow" },
  { re: /today/i,                            label: "Today" },
  { re: /asap/i,                             label: "ASAP" },
  { re: /by\s+Q[1-4]/i,                     label: (m) => m[0] },
];

const HIGH_WORDS   = /urgent|asap|critical|must|immediately|high.priority|block/i;
const MEDIUM_WORDS = /should|needs?\s+to|need\s+to|prepare|review|set\s+up|finalise|finalize|share|reach\s+out|sync/i;
const LOW_WORDS    = /consider|could|might|explore|optional|low.priority|read|everyone\s+should/i;
const ACTION_VERBS = /\b(needs?\s+to|should|will|must|to\s+review|to\s+prepare|to\s+set\s+up|to\s+reach\s+out|to\s+finalis[e|z]e|to\s+sync|to\s+test|to\s+decide|to\s+share|to\s+send|to\s+create|to\s+build|to\s+write|to\s+check|to\s+update)\b/i;

// Global store for current actions
let currentActions = [];
let filterActive = false;
let currentPage = 1;
const PAGE_SIZE = 5;

// ─── Extract ──────────────────────────────────────────────────────
function extractActions() {
  const raw = document.getElementById('notesInput').value.trim();
  clearError();

  if (!raw) { showError("Please paste some meeting notes first."); return; }

  const sentences = raw.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 10);
  if (sentences.length === 0) { showError("Could not find any sentences to parse."); return; }

  const actions = [];

  sentences.forEach(sentence => {
    if (!ACTION_VERBS.test(sentence)) return;

    let owner = "Unassigned";
    for (const name of KNOWN_NAMES) {
      if (new RegExp(`\\b${name}\\b`).test(sentence)) { owner = name; break; }
    }
    if (owner === "Unassigned") {
      const capMatch = sentence.match(/(?<!\.\s)\b([A-Z][a-z]{2,})\b/);
      if (capMatch && !["The","This","It","He","She","They","We","Our","Their"].includes(capMatch[1])) {
        owner = capMatch[1];
      }
    }
    if (/everyone/i.test(sentence)) owner = "Team";

    let task = sentence;
    task = task.replace(new RegExp(`^${owner}\\s+(needs?\\s+to|should|will|must|to)\\s+`, 'i'), '');
    task = task.charAt(0).toUpperCase() + task.slice(1);
    task = task.replace(/\.$/, '').trim();

    let due = "Unknown";
    for (const p of DUE_PATTERNS) {
      const m = sentence.match(p.re);
      if (m) { due = typeof p.label === 'function' ? p.label(m) : p.label; break; }
    }

    let priority = "Medium";
    if (HIGH_WORDS.test(sentence)) priority = "High";
    else if (LOW_WORDS.test(sentence)) priority = "Low";
    else if (MEDIUM_WORDS.test(sentence)) priority = "Medium";
    if (["Today","Tomorrow","ASAP"].includes(due) && priority !== "High") priority = "High";

    const notes = sentence.length > 90 ? sentence.slice(0, 87) + "…" : sentence;
    actions.push({ owner, task, due, priority, notes });
  });

  currentActions = actions;

  document.getElementById('parseStats').innerHTML =
    `Scanned <span>${sentences.length}</span> sentence${sentences.length !== 1 ? 's' : ''} — found <span>${actions.length}</span> action item${actions.length !== 1 ? 's' : ''}`;
  document.getElementById('parseStats').style.display = 'block';

  renderResults(actions);
}

// ─── Priority distribution bar ──────────────────────────────────────
function renderPriorityBar(actions) {
  const bar = document.getElementById('priorityBar');
  if (!actions.length) { bar.style.display = 'none'; return; }

  const high = actions.filter(a => a.priority === 'High').length;
  const med  = actions.filter(a => a.priority === 'Medium').length;
  const low  = actions.filter(a => a.priority === 'Low').length;
  const total = actions.length;

  document.getElementById('segHigh').style.width   = `${(high / total) * 100}%`;
  document.getElementById('segMedium').style.width = `${(med  / total) * 100}%`;
  document.getElementById('segLow').style.width    = `${(low  / total) * 100}%`;

  document.getElementById('legendHighCount').textContent   = high;
  document.getElementById('legendMediumCount').textContent = med;
  document.getElementById('legendLowCount').textContent    = low;

  bar.style.display = 'block';
}

// ─── Render Table ─────────────────────────────────────────────────
function renderResults(actions, filterNoDue = false) {
  const area = document.getElementById('resultsArea');
  const badge = document.getElementById('countBadge');
  const exportArea = document.getElementById('exportArea');
  const filterBtn = document.getElementById('filterNoDueBtn');
  const csvBtn = document.getElementById('csvBtn');

  const displayed = filterNoDue ? actions.filter(a => a.due === 'Unknown') : actions;

  badge.textContent = `${actions.length} item${actions.length !== 1 ? 's' : ''}`;
  if (filterBtn) filterBtn.style.display = actions.length > 0 ? 'inline-flex' : 'none';

  renderPriorityBar(actions);

  if (actions.length === 0) {
    area.innerHTML = `<div class="empty-state"><div class="eyebrow-mini">No matches</div>No action items found. Try notes with names and action verbs like "needs to", "should", "will".</div>`;
    exportArea.style.display = 'none';
    if (csvBtn) csvBtn.style.display = 'none';
    return;
  }

  if (displayed.length === 0) {
    area.querySelector('tbody') && (area.querySelector('tbody').innerHTML =
      `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--muted-soft)">No items with unknown due date.</td></tr>`);
    return;
  }

  // Pagination
  const totalPages = Math.ceil(displayed.length / PAGE_SIZE);
  if (currentPage > totalPages) currentPage = 1;
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = displayed.slice(start, start + PAGE_SIZE);

  const editIcon = `<svg class="icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;

  const rows = pageItems.map((a, pi) => {
    const i = start + pi; // real index in currentActions
    return `
    <tr class="row-${a.priority.toLowerCase()}" data-index="${i}">
      <td class="col-num">${i + 1}</td>
      <td class="col-owner">
        <span class="editable" id="owner-${i}">${escHtml(a.owner)}</span>
      </td>
      <td class="col-task">
        <span class="editable" id="task-${i}">${escHtml(a.task)}</span>
      </td>
      <td class="col-due">
        <span class="editable" id="due-${i}">${escHtml(a.due)}</span>
      </td>
      <td class="col-priority">
        <select class="priority-select priority-${a.priority}" id="priority-${i}" onchange="updatePriority(${i}, this.value)">
          <option ${a.priority==='High'?'selected':''}>High</option>
          <option ${a.priority==='Medium'?'selected':''}>Medium</option>
          <option ${a.priority==='Low'?'selected':''}>Low</option>
        </select>
      </td>
      <td class="col-notes">${escHtml(a.notes)}</td>
      <td class="col-edit">
        <button class="edit-btn" onclick="toggleEdit(${i})">${editIcon}Edit</button>
      </td>
    </tr>
    <tr class="edit-row" id="edit-row-${i}" style="display:none;">
      <td colspan="7">
        <div class="edit-panel">
          <div class="edit-fields">
            <div class="edit-field">
              <label>Owner</label>
              <input type="text" id="edit-owner-${i}" value="${escHtml(a.owner)}" />
            </div>
            <div class="edit-field">
              <label>Task</label>
              <input type="text" id="edit-task-${i}" value="${escHtml(a.task)}" />
            </div>
            <div class="edit-field">
              <label>Due Date</label>
              <input type="text" id="edit-due-${i}" value="${escHtml(a.due)}" />
            </div>
          </div>
          <div class="edit-actions">
            <button class="save-btn" onclick="saveEdit(${i})">Save</button>
            <button class="cancel-btn" onclick="toggleEdit(${i})">Cancel</button>
          </div>
        </div>
      </td>
    </tr>
  `}).join('');

  // Pagination controls
  let paginationHtml = '';
  if (totalPages > 1) {
    paginationHtml = `<div class="pagination">
      <button class="page-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>‹ Prev</button>`;
    for (let p = 1; p <= totalPages; p++) {
      paginationHtml += `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="goToPage(${p})">${p}</button>`;
    }
    paginationHtml += `<button class="page-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next ›</button>
      <span class="page-info">Page ${currentPage} of ${totalPages}</span>
    </div>`;
  }

  area.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Owner</th>
            <th>Task</th>
            <th>Due Date</th>
            <th>Priority</th>
            <th>Notes / Context</th>
            <th>Edit</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${paginationHtml}
  `;

  buildExport(actions);
  exportArea.style.display = 'block';
  if (csvBtn) csvBtn.style.display = 'inline-flex';
}

// ── Pagination navigation ───────────────────────────────────────────
function goToPage(p) {
  const displayed = filterActive ? currentActions.filter(a => a.due === 'Unknown') : currentActions;
  const totalPages = Math.ceil(displayed.length / PAGE_SIZE);
  if (p < 1 || p > totalPages) return;
  currentPage = p;
  renderResults(currentActions, filterActive);
}

// ── Toggle edit row ────────────────────────────────────────────────
function toggleEdit(i) {
  const editRow = document.getElementById(`edit-row-${i}`);
  editRow.style.display = editRow.style.display === 'none' ? 'table-row' : 'none';
}

function saveEdit(i) {
  currentActions[i].owner = document.getElementById(`edit-owner-${i}`).value.trim() || 'Unassigned';
  currentActions[i].task  = document.getElementById(`edit-task-${i}`).value.trim();
  currentActions[i].due   = document.getElementById(`edit-due-${i}`).value.trim() || 'Unknown';
  renderResults(currentActions, filterActive);
}

// ── Priority dropdown change ────────────────────────────────────────
function updatePriority(i, val) {
  currentActions[i].priority = val;
  renderResults(currentActions, filterActive);
}

// ── Filter no-due-date rows ──────────────────────────────────────────
function toggleNoDueFilter() {
  filterActive = !filterActive;
  currentPage = 1;
  const btn = document.getElementById('filterNoDueBtn');
  const txt = document.getElementById('filterBtnText');
  btn.classList.toggle('active', filterActive);
  txt.textContent = filterActive ? 'Show All' : 'No Due Date';
  renderResults(currentActions, filterActive);
}

// ── CSV Export ──────────────────────────────────────────────────────
function downloadCSV() {
  if (!currentActions.length) return;
  const headers = ['#','Owner','Task','Due Date','Priority','Notes'];
  const rows = currentActions.map((a, i) =>
    [i+1, a.owner, `"${a.task.replace(/"/g,'""')}"`, a.due, a.priority, `"${a.notes.replace(/"/g,'""')}"`].join(',')
  );
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'action-items.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ── Plain text export builder ───────────────────────────────────────
function buildExport(actions) {
  let txt = `ACTION ITEMS\n${'─'.repeat(60)}\n`;
  txt += `${'#'.padEnd(4)} ${'Owner'.padEnd(12)} ${'Due'.padEnd(22)} ${'Priority'.padEnd(10)} Task\n`;
  txt += `${'─'.repeat(60)}\n`;
  actions.forEach((a, i) => {
    txt += `${String(i+1).padEnd(4)} ${a.owner.padEnd(12)} ${a.due.padEnd(22)} ${a.priority.padEnd(10)} ${a.task}\n`;
    txt += `     Notes: ${a.notes}\n\n`;
  });
  document.getElementById('exportBox').value = txt;
}

// ─── Helpers ──────────────────────────────────────────────────────
function resetView() {
  filterActive = false;
  currentPage = 1;
  document.getElementById('parseStats').style.display = 'none';
  document.getElementById('priorityBar').style.display = 'none';
  document.getElementById('countBadge').textContent = '0 items';
  document.getElementById('exportArea').style.display = 'none';
  document.getElementById('filterNoDueBtn').style.display = 'none';
  const csvBtn = document.getElementById('csvBtn');
  if (csvBtn) csvBtn.style.display = 'none';
  const filterTxt = document.getElementById('filterBtnText');
  if (filterTxt) filterTxt.textContent = 'No Due Date';
  document.getElementById('filterNoDueBtn').classList.remove('active');
}

function loadSample(n) {
  document.getElementById('notesInput').value = SAMPLES[n];
  clearError();
  resetView();
  currentActions = [];
  document.getElementById('resultsArea').innerHTML = `<div class="empty-state"><div class="eyebrow-mini">Sample loaded</div>Click <strong>Extract Action Items</strong> to parse it</div>`;
}

function clearAll() {
  document.getElementById('notesInput').value = '';
  currentActions = [];
  resetView();
  document.getElementById('resultsArea').innerHTML = `<div class="empty-state"><div class="eyebrow-mini">Waiting on input</div>Paste meeting notes above and click <strong>Extract Action Items</strong></div>`;
  clearError();
}

function showError(msg) { document.getElementById('errorBox').innerHTML = `<div class="error-msg">${msg}</div>`; }
function clearError()   { document.getElementById('errorBox').innerHTML = ''; }

function copyExport() {
  const box = document.getElementById('exportBox');
  box.select();
  document.execCommand('copy');
  const btn = event.target;
  btn.textContent = 'Copied!';
  setTimeout(() => btn.textContent = 'Copy to Clipboard', 2000);
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
