/**
 * ============================================================
 * app.js — Main Application Controller
 * ============================================================
 */

let sidebarCollapsed = false;
let currentPage = '';
let appProfile = null;

function isAdmin() {
  try {
    // เช็คจาก appProfile (ข้อมูลสดจาก API) ก่อน, fallback เป็น localStorage
    if (appProfile && appProfile.role) {
      return String(appProfile.role).toLowerCase() === 'admin';
    }
    const data = JSON.parse(localStorage.getItem('teacher_data') || '{}');
    return String(data.role || '').toLowerCase() === 'admin';
  } catch (e) { return false; }
}

function updateSettingsMenuVisibility() {
  const menu = document.getElementById('menuSettings');
  if (menu) {
    menu.style.display = isAdmin() ? '' : 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (checkSession()) {
    showMainApp();
  } else {
    showLoginPage();
  }
  window.addEventListener('hashchange', handleRoute);
  
  const pwInput = document.getElementById('loginPassword');
  if(pwInput) pwInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
});

function showLoginPage() {
  document.getElementById('loginPage').classList.remove('hidden');
  document.getElementById('mainApp').classList.add('hidden');
  initLogin();
}

async function showMainApp() {
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');

  // แสดงเมนูตั้งค่าเฉพาะ admin
  updateSettingsMenuVisibility();
  
  const hash = window.location.hash.replace('#', '').split('/')[0] || 'dashboard';
  
  // โหลด profile แบบ parallel กับหน้าที่จะแสดง (ไม่ต้องรอ)
  // Dashboard จะดึง profile ผ่าน getDashboardData เอง
  if (hash !== 'dashboard') {
    loadProfile(); // ไม่ await — ให้โหลดเบื้องหลัง
  }
  
  navigateTo(hash);
}

async function loadProfile() {
  const result = await callApiSilent('getProfile');
  if (result && result.success) {
    appProfile = result.data;
    document.getElementById('sidebarTeacherName').textContent = appProfile.fullName;
    document.getElementById('sidebarSchoolName').textContent = appProfile.schoolName || 'ระบบเช็คชื่อ';

    if (appProfile.logoUrl) {
      const logo = document.getElementById('sidebarLogo');
      logo.src = appProfile.logoUrl;
      logo.classList.remove('hidden');
      document.getElementById('sidebarLogoPlaceholder').classList.add('hidden');
    }
    if (appProfile.footerCredit) {
      document.getElementById('sidebarFooter').innerHTML = `${escapeHtml(appProfile.footerCredit)}<br>v1.0.0`;
    }
    // อัปเดตสิทธิ์เมนูตั้งค่าหลังได้ role จริงจาก API
    updateSettingsMenuVisibility();
  }
}

async function navigateTo(page, param) {
  if (!checkSession()) {
    showLoginPage();
    return;
  }

  if (currentPage && (typeof hasUnsavedAttendance === 'function' && hasUnsavedAttendance() || typeof hasUnsavedScores === 'function' && hasUnsavedScores())) {
    const result = await showUnsavedWarning();
    if (result.isConfirmed) {
      if (typeof saveCurrentAttendance === 'function' && hasUnsavedAttendance()) await saveCurrentAttendance();
      if (typeof saveCurrentScores === 'function' && hasUnsavedScores()) await saveCurrentScores();
    } else if (result.isDenied) {
      if (typeof clearUnsavedAttendance === 'function') clearUnsavedAttendance();
      if (typeof clearUnsavedScores === 'function') clearUnsavedScores();
    } else {
      return;
    }
  }

  currentPage = page;
  const newHash = param ? `#${page}/${param}` : `#${page}`;
  if (window.location.hash !== newHash) {
    history.pushState(null, '', newHash);
  }

  document.querySelectorAll('.menu-item').forEach(item => {
    const itemPage = item.dataset.page;
    if (itemPage) item.classList.toggle('active', itemPage === page);
  });

  closeMobileSidebar();

  switch (page) {
    case 'dashboard': await renderDashboard(); break;
    case 'schedule': await renderSchedule(); break;
    case 'attendance': await renderAttendance(param); break;
    case 'scoring': await renderScoring(); break;
    case 'reports': await renderReports(); break;
    case 'settings':
      if (!isAdmin()) { showToast('คุณไม่มีสิทธิ์เข้าถึงหน้านี้', 'error'); await renderDashboard(); break; }
      await renderSettings(); break;
    default: await renderDashboard(); break;
  }
}

function handleRoute() {
  const hash = window.location.hash.replace('#', '');
  const [page, ...params] = hash.split('/');
  navigateTo(page || 'dashboard', params[0]);
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const content = document.getElementById('mainContent');
  const toggle = document.getElementById('sidebarToggle');
  const icon = document.getElementById('toggleIcon');

  if (window.innerWidth < 1024) {
    sidebar.classList.toggle('mobile-open');
    document.getElementById('mobileOverlay').classList.toggle('hidden');
    return;
  }

  sidebarCollapsed = !sidebarCollapsed;
  sidebar.classList.toggle('sidebar-expanded', !sidebarCollapsed);
  sidebar.classList.toggle('sidebar-collapsed', sidebarCollapsed);
  content.classList.toggle('content-expanded', !sidebarCollapsed);
  content.classList.toggle('content-collapsed', sidebarCollapsed);
  if (toggle) toggle.style.left = sidebarCollapsed ? 'calc(var(--sidebar-collapsed) + 8px)' : 'calc(var(--sidebar-width) + 8px)';
  
  if (icon) {
    icon.classList.toggle('rotate-180', sidebarCollapsed);
  }
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  if(sidebar) sidebar.classList.remove('mobile-open');
  const overlay = document.getElementById('mobileOverlay');
  if(overlay) overlay.classList.add('hidden');
}

window.addEventListener('resize', () => {
  if (window.innerWidth >= 1024) closeMobileSidebar();
});