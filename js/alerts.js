/**
 * alerts.js — Alert configuration form and mock submission
 */

function initAlerts() {
  // Channel toggle buttons
  document.querySelectorAll('.channel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
    });
  });

  // Open modal
  document.getElementById('btn-open-alerts')?.addEventListener('click', openAlertModal);
  document.getElementById('btn-new-alert')?.addEventListener('click', openAlertModal);
  document.querySelector('.modal-close')?.addEventListener('click', closeAlertModal);
  document.getElementById('alert-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('alert-overlay')) closeAlertModal();
  });

  // Cancel button
  document.getElementById('btn-alert-cancel')?.addEventListener('click', closeAlertModal);

  // Save button
  document.getElementById('btn-alert-save')?.addEventListener('click', saveAlert);
}

function openAlertModal() {
  const overlay = document.getElementById('alert-overlay');
  if (overlay) overlay.classList.add('open');
}

function closeAlertModal() {
  const overlay = document.getElementById('alert-overlay');
  if (overlay) overlay.classList.remove('open');
}

function saveAlert() {
  // Gather form values
  const name = document.getElementById('alert-name')?.value.trim();
  if (!name) {
    showToast('Validation Error', 'Please enter an alert name.', 'danger');
    return;
  }

  const channels = [...document.querySelectorAll('.channel-btn.active')].map(b => b.textContent.trim());
  if (channels.length === 0) {
    showToast('Validation Error', 'Select at least one notification channel.', 'danger');
    return;
  }

  const sizeThresh = document.getElementById('rule-size')?.value || '500';
  const bufferDist = document.getElementById('rule-buffer')?.value || '10';
  const parkOnly   = document.getElementById('rule-park-only')?.checked;

  // Build summary
  const rules = [];
  if (sizeThresh) rules.push(`Fire size > ${sizeThresh} ha`);
  if (bufferDist) rules.push(`Within ${bufferDist} km of infrastructure`);
  if (parkOnly)   rules.push('Fire within protected area');

  closeAlertModal();

  // Add to alerts list
  addAlertRow(name, channels, rules);

  showToast(
    '🔔 Alert Created',
    `"${name}" will notify via ${channels.join(', ')} when: ${rules.join('; ')}`,
    'success'
  );

  // Reset form
  document.getElementById('alert-name').value = '';
  document.querySelectorAll('.channel-btn').forEach(b => b.classList.remove('active'));
}

let alertCount = 0;

function addAlertRow(name, channels, rules) {
  alertCount++;
  const tbody = document.getElementById('alerts-list');
  if (!tbody) return;

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><b>${name}</b></td>
    <td>${channels.map(c => `<span style="font-size:10px;padding:2px 6px;border-radius:6px;background:rgba(59,130,246,0.15);color:#60a5fa;margin-right:4px;">${c}</span>`).join('')}</td>
    <td style="font-size:10px;color:#94a3b8;">${rules.slice(0,2).join('<br>')}</td>
    <td>
      <span style="font-size:10px;padding:2px 8px;border-radius:8px;background:rgba(34,197,94,0.15);color:#22c55e;">Active</span>
    </td>
    <td>
      <button onclick="this.closest('tr').remove(); showToast('Alert Removed', '${name} deleted', 'info');" 
        style="background:none;border:none;color:#475569;cursor:pointer;font-size:14px;">🗑</button>
    </td>
  `;
  tbody.insertBefore(tr, tbody.firstChild);
}

window.AlertsModule = { initAlerts };
