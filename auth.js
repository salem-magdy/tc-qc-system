/* ============================================================
   auth.js — Authentication (Supabase)
   ============================================================ */
'use strict';

const i18n = {
  en: {
    usernameRequired:   'Username is required.',
    usernameMinLength:  'Username must be at least 3 characters.',
    usernameInvalid:    'Only letters, numbers, and underscores allowed.',
    usernameTaken:      'This username is already taken.',
    passwordRequired:   'Password is required.',
    passwordMinLength:  'Password must be at least 6 characters.',
    confirmRequired:    'Please confirm your password.',
    passwordMismatch:   'Passwords do not match.',
    invalidCredentials: 'Incorrect username or password.',
    accountCreated:     'Account created! You can now sign in.',
    networkError:       'Network error. Check your connection.',
  },
  ar: {
    usernameRequired:   'اسم المستخدم مطلوب.',
    usernameMinLength:  'يجب أن يكون اسم المستخدم 3 أحرف على الأقل.',
    usernameInvalid:    'يُسمح فقط بالأحرف والأرقام والشرطة السفلية.',
    usernameTaken:      'اسم المستخدم هذا مأخوذ بالفعل.',
    passwordRequired:   'كلمة المرور مطلوبة.',
    passwordMinLength:  'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.',
    confirmRequired:    'يرجى تأكيد كلمة المرور.',
    passwordMismatch:   'كلمتا المرور غير متطابقتين.',
    invalidCredentials: 'اسم المستخدم أو كلمة المرور غير صحيحة.',
    accountCreated:     'تم إنشاء الحساب! يمكنك تسجيل الدخول الآن.',
    networkError:       'خطأ في الشبكة. تحقق من اتصالك.',
  },
};

let currentLang  = 'en';
let currentTheme = 'dark';

function initAuth() {
  loadPreferences();
  checkExistingSession();
  bindEvents();
}

function loadPreferences() {
  try {
    const s = JSON.parse(localStorage.getItem('tc_qc_settings') || '{}');
    currentLang  = s.lang  || 'en';
    currentTheme = s.theme || 'dark';
  } catch {}
  applyTheme(currentTheme);
  applyLang(currentLang);
}

async function checkExistingSession() {
  try {
    const session = await SB_Auth.getSession();
    if (session) window.location.href = 'dashboard.html';
  } catch {}
}

function bindEvents() {
  document.getElementById('show-register-link').onclick = () => showForm('register');
  document.getElementById('show-login-link').onclick    = () => showForm('login');
  document.getElementById('login-btn').onclick          = handleLogin;
  document.getElementById('register-btn').onclick       = handleRegister;
  document.getElementById('themeToggle').onclick        = toggleTheme;
  document.getElementById('langToggle').onclick         = toggleLang;

  document.querySelectorAll('.form-input').forEach(el =>
    el.addEventListener('input', clearErrors)
  );
  document.querySelectorAll('.toggle-pass-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (input) input.type = input.type === 'password' ? 'text' : 'password';
    });
  });
  document.querySelectorAll('#login-form .form-input').forEach(el =>
    el.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); })
  );
  document.querySelectorAll('#register-form .form-input').forEach(el =>
    el.addEventListener('keydown', e => { if (e.key === 'Enter') handleRegister(); })
  );
}

function showForm(which) {
  document.getElementById('login-form').style.display    = which === 'login'    ? '' : 'none';
  document.getElementById('register-form').style.display = which === 'register' ? '' : 'none';
  clearErrors();
}

async function handleLogin() {
  clearErrors();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const tr = i18n[currentLang];

  if (!username) { showAuthError('login-error', tr.usernameRequired); return; }
  if (!password) { showAuthError('login-error', tr.passwordRequired); return; }

  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.textContent = currentLang === 'ar' ? 'جاري تسجيل الدخول...' : 'Signing in...';

  try {
    await SB_Auth.signIn(username, password);
    window.location.href = 'dashboard.html';
  } catch (err) {
    const msg = err.message?.toLowerCase().includes('invalid')
      ? tr.invalidCredentials
      : tr.networkError;
    showAuthError('login-error', msg);
  } finally {
    btn.disabled = false;
    btn.textContent = currentLang === 'ar' ? 'تسجيل الدخول' : 'Sign In';
  }
}

async function handleRegister() {
  clearErrors();
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-confirm').value;
  const tr = i18n[currentLang];

  if (!username)                          { showAuthError('register-error', tr.usernameRequired);  return; }
  if (username.length < 3)               { showAuthError('register-error', tr.usernameMinLength); return; }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) { showAuthError('register-error', tr.usernameInvalid);  return; }
  if (!password)                          { showAuthError('register-error', tr.passwordRequired);  return; }
  if (password.length < 6)               { showAuthError('register-error', tr.passwordMinLength); return; }
  if (!confirm)                           { showAuthError('register-error', tr.confirmRequired);   return; }
  if (confirm !== password)               { showAuthError('register-error', tr.passwordMismatch);  return; }

  const existing = await SB_Profiles.getByUsername(username);
  if (existing)  { showAuthError('register-error', tr.usernameTaken); return; }

  const btn = document.getElementById('register-btn');
  btn.disabled = true;
  btn.textContent = currentLang === 'ar' ? 'جاري الإنشاء...' : 'Creating...';

  try {
    await SB_Auth.signUp(username, password);
    const successEl = document.getElementById('register-success');
    successEl.textContent = tr.accountCreated;
    successEl.classList.add('show');
    document.getElementById('reg-username').value = '';
    document.getElementById('reg-password').value = '';
    document.getElementById('reg-confirm').value  = '';
    setTimeout(() => {
      showForm('login');
      document.getElementById('login-username').value = username;
    }, 1800);
  } catch (err) {
    showAuthError('register-error', err.message || tr.networkError);
  } finally {
    btn.disabled = false;
    btn.textContent = currentLang === 'ar' ? 'إنشاء الحساب' : 'Create Account';
  }
}

function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(currentTheme);
  saveLocalSettings();
}
function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
}
function toggleLang() {
  currentLang = currentLang === 'en' ? 'ar' : 'en';
  applyLang(currentLang);
  saveLocalSettings();
}
function applyLang(lang) {
  currentLang = lang;
  const isAr = lang === 'ar';
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', isAr ? 'rtl' : 'ltr');
  const label = document.getElementById('langLabel');
  if (label) label.textContent = isAr ? 'AR' : 'EN';
  document.querySelectorAll('[data-en]').forEach(el => {
    const val = isAr ? (el.dataset.ar || el.dataset.en) : el.dataset.en;
    if (!val) return;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return;
    el.textContent = val;
  });
  document.querySelectorAll('[data-placeholder-en]').forEach(el => {
    el.placeholder = isAr
      ? (el.dataset.placeholderAr || el.dataset.placeholderEn)
      : el.dataset.placeholderEn;
  });
}
function saveLocalSettings() {
  localStorage.setItem('tc_qc_settings', JSON.stringify({ theme: currentTheme, lang: currentLang }));
}
function showAuthError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.add('show'); }
}
function clearErrors() {
  document.querySelectorAll('.auth-error,.auth-success').forEach(el => {
    el.textContent = ''; el.classList.remove('show');
  });
}

document.addEventListener('DOMContentLoaded', initAuth);
