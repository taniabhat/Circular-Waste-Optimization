/* =========================================================
   UWRMS — Authentication Module · auth.js
   ========================================================= */

'use strict';

// ── API Configuration ──
// Change this to your Render URL after deployment
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : 'https://uwrms-backend.onrender.com'; // Update this after Render deployment

// ── Check if already logged in ──
(function checkAuth() {
  const token = localStorage.getItem('uwrms_token');
  if (token && window.location.pathname.includes('login.html')) {
    window.location.href = 'index.html';
  }
})();

// ── Particle Background ──
(function createParticles() {
  const container = document.getElementById('particles');
  if (!container) return;

  const colors = ['var(--green3)', 'var(--teal)', 'var(--blue)', 'var(--amber)'];
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 4 + 2;
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.left = Math.random() * 100 + '%';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.animationDuration = (Math.random() * 15 + 10) + 's';
    p.style.animationDelay = (Math.random() * 10) + 's';
    container.appendChild(p);
  }
})();

// ── Tab Switching ──
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.getElementById(target === 'signin' ? 'signin-form' : 'signup-form').classList.add('active');

    hideMessage();
  });
});

// ── Password Strength Meter ──
const signupPassword = document.getElementById('signup-password');
if (signupPassword) {
  signupPassword.addEventListener('input', () => {
    const val = signupPassword.value;
    let score = 0;
    if (val.length >= 6) score++;
    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val) && /[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    const classes = ['', 'weak', 'medium', 'medium', 'strong'];

    for (let i = 1; i <= 4; i++) {
      const bar = document.getElementById('str-' + i);
      bar.className = 'strength-bar';
      if (i <= score) bar.classList.add('active', classes[score]);
    }

    const textEl = document.getElementById('strength-text');
    textEl.textContent = val.length > 0 ? labels[score] || '' : '';
    const colorMap = { Weak: 'var(--red)', Fair: 'var(--amber)', Good: 'var(--amber)', Strong: 'var(--green3)' };
    textEl.style.color = colorMap[labels[score]] || 'var(--text3)';
  });
}

// ── Password Visibility Toggle ──
document.querySelectorAll('.toggle-password').forEach(btn => {
  btn.addEventListener('click', function() {
    const targetId = this.getAttribute('data-target');
    const input = document.getElementById(targetId);
    if (input.type === 'password') {
      input.type = 'text';
      this.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>';
      this.style.color = 'var(--green3)';
    } else {
      input.type = 'password';
      this.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
      this.style.color = 'var(--text3)';
    }
  });
});

// ── Message Helpers ──
function showMessage(text, type) {
  const el = document.getElementById('form-message');
  el.textContent = text;
  el.className = 'form-message show ' + type;
}

function hideMessage() {
  const el = document.getElementById('form-message');
  el.className = 'form-message';
}

// ── Sign In Handler ──
document.getElementById('signin-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideMessage();

  const email = document.getElementById('signin-email').value.trim();
  const password = document.getElementById('signin-password').value;
  const btn = document.getElementById('signin-btn');

  if (!email || !password) {
    showMessage('Please fill in all fields', 'error');
    return;
  }

  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const res = await fetch(API_URL + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Login failed');
    }

    // Store token and user data
    localStorage.setItem('uwrms_token', data.token);
    localStorage.setItem('uwrms_user', JSON.stringify(data.user));

    showMessage('Login successful! Redirecting...', 'success');

    setTimeout(() => {
      window.location.href = 'index.html';
    }, 800);
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
});

// ── Sign Up Handler ──
document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideMessage();

  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const btn = document.getElementById('signup-btn');

  if (!name || !email || !password) {
    showMessage('Please fill in all fields', 'error');
    return;
  }

  if (password.length < 6) {
    showMessage('Password must be at least 6 characters', 'error');
    return;
  }

  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const res = await fetch(API_URL + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Registration failed');
    }

    // Store token and user data
    localStorage.setItem('uwrms_token', data.token);
    localStorage.setItem('uwrms_user', JSON.stringify(data.user));

    showMessage('Account created! Redirecting to dashboard...', 'success');

    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1000);
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
});

// ── Server Health Check ──
(async function checkServer() {
  const dot = document.getElementById('server-dot');
  const text = document.getElementById('server-status-text');
  try {
    const res = await fetch(API_URL + '/', { method: 'GET' });
    if (res.ok) {
      dot.classList.remove('offline');
      text.textContent = 'Server connected';
    } else {
      dot.classList.add('offline');
      text.textContent = 'Server unreachable';
    }
  } catch {
    dot.classList.add('offline');
    text.textContent = 'Server offline — start backend';
  }
})();
