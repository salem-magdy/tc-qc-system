/* ============================================================
   ui.js — App Shell (dashboard.html)
   Routing, session, sidebar, theme, language, toasts, modals
   ============================================================ */
'use strict';

let currentUser    = null;
let currentLang    = 'en';
let currentTheme   = 'dark';
let currentSection = 'dashboard';

const PAGE_TITLES = {
  en: { dashboard:'Dashboard', inspections:'Inspections', 'new-inspection':'New Inspection', detail:'Inspection Detail', 'defects-mgmt':'Defects List', 'stages-mgmt':'Stages', 'lines-mgmt':'Lines', 'users-mgmt':'Users', backup:'Backup & Restore' },
  ar: { dashboard:'لوحة التحكم', inspections:'الفحوصات', 'new-inspection':'فحص جديد', detail:'تفاصيل الفحص', 'defects-mgmt':'قائمة العيوب', 'stages-mgmt':'المراحل', 'lines-mgmt':'الخطوط', 'users-mgmt':'المستخدمون', backup:'النسخ الاحتياطي' },
};

const PERMISSIONS = {
  admin:      ['dashboard','inspections','new-inspection','detail','defects-mgmt','stages-mgmt','lines-mgmt','users-mgmt','backup'],
  supervisor: ['dashboard','inspections','new-inspection','detail','defects-mgmt','stages-mgmt','lines-mgmt'],
  inspector:  ['dashboard','inspections','new-inspection','detail'],
};

/* ── Init ── */
async function initApp() {
  document.body.style.opacity = '0.5';

  try {
    const session = await SB_Auth.getSession();
    if (!session) { window.location.href = 'index.html'; return; }

    // Get full profile — retry once in case trigger is slow
    let profile = await SB_Profiles.getById(session.user.id);
    if (!profile) {
      await new Promise(r => setTimeout(r, 1500));
      profile = await SB_Profiles.getById(session.user.id);
    }

    // If still no profile, create one from session metadata
    if (!profile) {
      const meta = session.user.user_metadata || {};
      const username = meta.username || session.user.email?.split('@')[0] || 'user';
      try {
        await _supabase.from('profiles').insert([{
          id: session.user.id,
          username,
          role: 'inspector'
        }]);
        profile = { id: session.user.id, username, role: 'inspector' };
      } catch {}
    }

    if (!profile) { window.location.href = 'index.html'; return; }

    currentUser = {
      id:       session.user.id,
      username: profile.username,
      role:     profile.role,
    };

    await loadPreferences();
    renderUserBadge();
    applyRoleVisibility();
    bindAppEvents();
    bindPopState();

    SB_Realtime.subscribeToInspections(() => {
      if (currentSection === 'dashboard')   renderDashboard?.();
      if (currentSection === 'inspections') renderInspections?.();
    });

    const hash    = window.location.hash.replace('#', '');
    const allowed = PERMISSIONS[currentUser.role] || PERMISSIONS.inspector;
    if (hash && allowed.includes(hash)) navigate(hash);
    else navigate('dashboard');

  } catch (err) {
    console.error('Init error:', err);
    // Don't redirect on network error — show a retry option
    document.body.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:16px;font-family:sans-serif;color:#f0f4ff;background:#0f1b2d">
        <div style="font-size:36px">⚠️</div>
        <div style="font-size:16px;font-weight:600">Connection error</div>
        <div style="font-size:13px;color:#a8b4cc">Check your internet and try again</div>
        <button onclick="window.location.reload()" style="padding:10px 24px;background:#6c63ff;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-top:8px">
          Retry
        </button>
        <button onclick="window.location.href='index.html'" style="padding:10px 24px;background:transparent;color:#a8b4cc;border:1px solid #4a5568;border-radius:8px;font-size:14px;cursor:pointer">
          Back to Login
        </button>
      </div>`;
  } finally {
    document.body.style.opacity = '1';
    document.body.style.transition = 'opacity 0.3s ease';
  }
}

async function logout() {
  SB_Realtime.unsubscribe();
  await SB_Auth.signOut();
  localStorage.removeItem('tc_qc_settings');
  window.location.href = 'index.html';
}

async function loadPreferences() {
  // Load from localStorage first for instant apply
  try {
    const local = JSON.parse(localStorage.getItem('tc_qc_settings') || '{}');
    currentLang  = local.lang  || 'en';
    currentTheme = local.theme || 'dark';
  } catch {}
  applyTheme(currentTheme);
  applyLang(currentLang);

  // Then sync from Supabase
  try {
    const settings = await SB_Settings.get(currentUser.id);
    currentLang  = settings.lang  || currentLang;
    currentTheme = settings.theme || currentTheme;
    applyTheme(currentTheme);
    applyLang(currentLang);
    localStorage.setItem('tc_qc_settings', JSON.stringify({ lang: currentLang, theme: currentTheme }));
  } catch {}
}

/* ── User badge ── */
function renderUserBadge() {
  const avatar = document.getElementById('user-avatar');
  const name   = document.getElementById('user-name-display');
  const role   = document.getElementById('user-role-display');
  if (avatar) avatar.textContent = currentUser.username.charAt(0).toUpperCase();
  if (name)   name.textContent   = currentUser.username;
  if (role)   role.textContent   = capitalize(currentUser.role);
}

/* ── Role visibility ── */
function applyRoleVisibility() {
  const role = currentUser.role;
  const isMgmt  = role === 'admin' || role === 'supervisor';
  const isAdmin = role === 'admin';

  ['mgmt-section-label','defects-nav','stages-nav','lines-nav'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isMgmt ? '' : 'none';
  });
  ['admin-section-label','users-nav','backup-nav'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isAdmin ? '' : 'none';
  });
}

function canDelete()  { return currentUser?.role === 'admin' || currentUser?.role === 'supervisor'; }
function canManage()  { return currentUser?.role === 'admin' || currentUser?.role === 'supervisor'; }
function isAdmin()    { return currentUser?.role === 'admin'; }

/* ── Navigation ── */
function navigate(section, params = {}) {
  const allowed = PERMISSIONS[currentUser?.role || 'inspector'] || PERMISSIONS.inspector;
  if (!allowed.includes(section)) {
    showToast(currentLang === 'ar' ? 'غير مصرح بالوصول.' : 'Access denied.', 'error');
    return;
  }

  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  // Show target
  const page = document.getElementById('page-' + section);
  if (page) page.classList.add('active');

  // Update nav active
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.classList.toggle('active', item.dataset.page === section);
  });

  currentSection = section;
  closeSidebar();

  // Push browser history state so back button works
  const stateObj = { section, params };
  const url = '#' + section;
  // Only push if it's a different section than current history state
  if (history.state?.section !== section) {
    history.pushState(stateObj, '', url);
  }

  // Run section handler
  onSectionEnter(section, params);
}

function onSectionEnter(section, params) {
  switch(section) {
    case 'dashboard':     if(typeof renderDashboard === 'function')     renderDashboard();         break;
    case 'inspections':   if(typeof renderInspections === 'function')   renderInspections();       break;
    case 'new-inspection':if(typeof openNewInspectionForm === 'function')openNewInspectionForm(params); break;
    case 'detail':        if(typeof renderDetail === 'function')        renderDetail(params.id);   break;
    case 'defects-mgmt':  if(typeof renderDefectsList === 'function')   renderDefectsList();       break;
    case 'stages-mgmt':   if(typeof renderStagesList === 'function')    renderStagesList();        break;
    case 'lines-mgmt':    if(typeof renderLinesList === 'function')     renderLinesList();         break;
    case 'users-mgmt':    if(typeof renderUsers === 'function')         renderUsers();             break;
  }
}

/* ── Browser back/forward button handler ── */
function bindPopState() {
  window.addEventListener('popstate', (e) => {
    // If state has a section, navigate to it without pushing new history
    if (e.state && e.state.section) {
      const { section, params } = e.state;
      const allowed = PERMISSIONS[currentUser?.role || 'inspector'] || PERMISSIONS.inspector;
      if (!allowed.includes(section)) return;

      // Show the section without pushing new state
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      const page = document.getElementById('page-' + section);
      if (page) page.classList.add('active');
      document.querySelectorAll('.nav-item[data-page]').forEach(item => {
        item.classList.toggle('active', item.dataset.page === section);
      });
      currentSection = section;
      closeSidebar();
      onSectionEnter(section, params || {});
    } else {
      // No state means we've gone back before any SPA navigation
      // Stay on dashboard instead of leaving the app
      navigate('dashboard');
    }
  });
}

/* ── Sidebar ── */
function toggleSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const hamburger= document.getElementById('hamburger');
  const overlay  = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('open');
  hamburger.classList.toggle('open');
  if (overlay) overlay.classList.toggle('open', sidebar.classList.contains('open'));
}

function closeSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const hamburger= document.getElementById('hamburger');
  const overlay  = document.getElementById('sidebar-overlay');
  sidebar.classList.remove('open');
  hamburger.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
}

/* ── Theme ── */
function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(currentTheme);
  localStorage.setItem('tc_qc_settings', JSON.stringify({ lang: currentLang, theme: currentTheme }));
  SB_Settings.save(currentUser.id, { theme: currentTheme, lang: currentLang }).catch(() => {});
}
function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  const input = document.getElementById('theme-toggle-input');
  if (input) input.checked = (theme === 'light');
}

/* ── Language ── */
function toggleLang() {
  currentLang = currentLang === 'en' ? 'ar' : 'en';
  applyLang(currentLang);
  localStorage.setItem('tc_qc_settings', JSON.stringify({ lang: currentLang, theme: currentTheme }));
  SB_Settings.save(currentUser.id, { theme: currentTheme, lang: currentLang }).catch(() => {});
  onSectionEnter(currentSection, {});
}
function applyLang(lang) {
  currentLang = lang;
  const isAr = lang === 'ar';
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', isAr ? 'rtl' : 'ltr');

  // Badge
  const badge = document.getElementById('langBadge');
  if (badge) badge.textContent = isAr ? 'AR' : 'EN';

  // Hamburger position handled by CSS [dir="rtl"] rule
  // On desktop: sidebar stays in normal flex order, [dir="rtl"] #app uses row-reverse
  // On mobile: sidebar slides from right in RTL, handled by CSS

  // Static text nodes
  document.querySelectorAll('[data-en]').forEach(el => {
    const val = isAr ? (el.dataset.ar || el.dataset.en) : el.dataset.en;
    if (val === undefined) return;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return; // skip inputs
    el.textContent = val;
  });

  // Placeholders
  document.querySelectorAll('[data-placeholder-en]').forEach(el => {
    el.placeholder = isAr
      ? (el.dataset.placeholderAr || el.dataset.placeholderEn)
      : el.dataset.placeholderEn;
  });
}

/* ── Storage bar ── */
function updateStorageBar() {
  // Show Supabase connected indicator instead of LocalStorage usage
  const fill  = document.getElementById('storage-bar-fill');
  const label = document.getElementById('storage-bar-label');
  if (fill)  { fill.style.width = '100%'; fill.style.background = 'var(--success)'; }
  if (label) label.textContent = '☁️ Supabase Connected';
}

/* ── Bind app events ── */
function bindAppEvents() {
  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', logout);

  // Theme toggle (sidebar checkbox)
  document.getElementById('theme-toggle-input')?.addEventListener('change', toggleTheme);

  // Lang toggle
  document.getElementById('langToggle')?.addEventListener('click', toggleLang);
  document.getElementById('langToggle')?.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' ') toggleLang(); });

  // Modal cancel/close buttons
  document.getElementById('cancel-delete-btn')?.addEventListener('click', () => closeModal('delete-modal'));
  document.getElementById('cancel-defect-btn')?.addEventListener('click', () => closeModal('defect-modal'));
  document.getElementById('cancel-stage-btn')?.addEventListener('click',  () => closeModal('stage-modal'));
  document.getElementById('cancel-line-btn')?.  addEventListener('click', () => closeModal('line-modal'));
  document.getElementById('cancel-role-btn')?.  addEventListener('click', () => closeModal('role-modal'));

  // Close modal on backdrop click
  document.querySelectorAll('.modal-backdrop').forEach(bd => {
    bd.addEventListener('click', e => { if (e.target === bd) closeModal(bd.id); });
  });

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      ['delete-modal','defect-modal','stage-modal','line-modal','role-modal'].forEach(id => closeModal(id));
      closeLightbox();
    }
  });

  // Confirm delete
  document.getElementById('confirm-delete-btn')?.addEventListener('click', () => {
    if (typeof _deleteCallback === 'function') { _deleteCallback(); _deleteCallback = null; }
    closeModal('delete-modal');
  });
}

/* ── Toasts ── */
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]||icons.info}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 350); }, duration);
}

/* ── Modals ── */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.style.display = 'flex'; setTimeout(() => el.querySelector('input,select,textarea')?.focus(), 100); }
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

let _deleteCallback = null;
function confirmDelete(message, callback) {
  const msg = document.getElementById('delete-modal-msg');
  if (msg) msg.textContent = message;
  _deleteCallback = callback;
  openModal('delete-modal');
}

/* ── Lightbox ── */
function openLightbox(src) {
  // Remove existing lightbox if any
  document.querySelector('.lightbox')?.remove();
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = `<button class="lightbox-close">✕</button><img src="${src}" alt="Inspection image" />`;
  document.body.appendChild(lb);
  lb.querySelector('.lightbox-close').onclick = closeLightbox;
  lb.onclick = (e) => { if (e.target === lb) closeLightbox(); };
}
function closeLightbox() {
  document.querySelector('.lightbox')?.remove();
}

/* ── Badge helpers ── */
function resultBadge(result) {
  const labels = {
    en: { pass:'Pass', fail:'Fail', hold:'Hold' },
    ar: { pass:'ناجح', fail:'راسب', hold:'معلق' },
  };
  const l = (labels[currentLang]||labels.en)[result] || result;
  return `<span class="badge badge-${result}">${escapeHtml(l)}</span>`;
}

function severityBadge(severity) {
  const labels = {
    en: { critical:'Critical', major:'Major', minor:'Minor' },
    ar: { critical:'حرج', major:'رئيسي', minor:'ثانوي' },
  };
  const l = (labels[currentLang]||labels.en)[severity] || severity;
  return `<span class="badge badge-${severity}">${escapeHtml(l)}</span>`;
}

function roleBadge(role) {
  const labels = {
    en: { admin:'Admin', supervisor:'Supervisor', inspector:'Inspector' },
    ar: { admin:'مسؤول', supervisor:'مشرف', inspector:'مفتش' },
  };
  const l = (labels[currentLang]||labels.en)[role] || role;
  return `<span class="badge badge-${role}">${escapeHtml(l)}</span>`;
}

/* ── Severity chips summary ── */
function severitySummaryChips(defects) {
  const counts = { critical:0, major:0, minor:0 };
  (defects||[]).forEach(d => { if(counts[d.severity]!==undefined) counts[d.severity]++; });
  let html = '';
  if (counts.critical) html += `<span class="sev-chip sev-chip-critical">🔴 ${counts.critical} Critical</span>`;
  if (counts.major)    html += `<span class="sev-chip sev-chip-major">🟡 ${counts.major} Major</span>`;
  if (counts.minor)    html += `<span class="sev-chip sev-chip-minor">🔵 ${counts.minor} Minor</span>`;
  return html;
}

/* ── Greeting ── */
function getDashGreeting() {
  const h = new Date().getHours();
  if (currentLang === 'ar') {
    if (h < 12) return `صباح الخير، ${currentUser.username}`;
    if (h < 17) return `مساء الخير، ${currentUser.username}`;
    return `مساء النور، ${currentUser.username}`;
  }
  if (h < 12) return `Good morning, ${currentUser.username}`;
  if (h < 17) return `Good afternoon, ${currentUser.username}`;
  return `Good evening, ${currentUser.username}`;
}

/* ── Action buttons ── */
function viewBtn(id) {
  return `<button class="action-btn" onclick="navigate('detail',{id:'${id}'})">${t('View','عرض')}</button>`;
}
function editBtn(id) {
  return `<button class="action-btn" onclick="openEditInspection('${id}')">${t('Edit','تعديل')}</button>`;
}
function deleteBtn(id) {
  if (!canDelete()) return '';
  return `<button class="action-btn danger" onclick="deleteInspectionConfirm('${id}')">${t('Delete','حذف')}</button>`;
}

/* ── Empty row HTML ── */
function emptyRowHTML(colspan, icon, titleEn, titleAr, msgEn, msgAr) {
  return `<tr><td colspan="${colspan}">
    <div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <div class="empty-title">${t(titleEn, titleAr)}</div>
      <div class="empty-text">${t(msgEn, msgAr)}</div>
    </div>
  </td></tr>`;
}

/* ── Utilities ── */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString(currentLang === 'ar' ? 'ar-EG' : 'en-GB', { day:'2-digit', month:'short', year:'numeric' });
  } catch { return dateStr; }
}

function formatDateTime(isoStr) {
  if (!isoStr) return '—';
  try {
    return new Date(isoStr).toLocaleString(currentLang === 'ar' ? 'ar-EG' : 'en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
  } catch { return isoStr; }
}

function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }
function generateId()    { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function todayISO()      { return new Date().toISOString().slice(0, 10); }
function t(enStr, arStr) { return currentLang === 'ar' ? arStr : enStr; }

function debounce(fn, delay) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', initApp);
