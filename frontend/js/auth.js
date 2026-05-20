/**
 * ============================================================
 * auth.js — Login & Session
 * ============================================================
 */

let teachers = [];

async function initLogin() {
  const sel = document.getElementById('loginUsername');
  
  // 1. ดึงข้อมูลจาก Cache ใน localStorage มาแสดงทันที (0ms) ป้องกันการกระตุก/รอโหลด
  const cachedSettings = getCachedApi('getSettings');
  if (cachedSettings) {
    applySettingsToLogin(cachedSettings);
  }
  
  const cachedTeachers = getCachedApi('getTeacherList');
  if (cachedTeachers) {
    teachers = cachedTeachers;
    renderTeacherOptions(teachers);
  } else {
    sel.innerHTML = '<option value="">กำลังโหลดรายชื่อครู...</option>';
  }

  // 2. ดึงข้อมูลใหม่จากหลังบ้านแบบคู่ขนาน (Parallel Fetch) และอัปเดต cache/DOM
  Promise.all([
    callApiSilent('getTeacherList'),
    callApiSilent('getSettings')
  ]).then(([teacherRes, settingsRes]) => {
    if (teacherRes && teacherRes.success) {
      teachers = teacherRes.data;
      setCachedApi('getTeacherList', {}, teachers);
      renderTeacherOptions(teachers);
    } else if (!cachedTeachers) {
      sel.innerHTML = '<option value="">ไม่สามารถโหลดรายชื่อได้</option>';
    }
    
    if (settingsRes && settingsRes.success) {
      setCachedApi('getSettings', {}, settingsRes.data);
      applySettingsToLogin(settingsRes.data);
    }
  }).catch(err => {
    console.error('Failed to pre-fetch login data:', err);
  });
}

function renderTeacherOptions(teacherList) {
  const sel = document.getElementById('loginUsername');
  const currentValue = sel.value;
  sel.innerHTML = '<option value="">-- เลือกชื่อผู้ใช้ --</option>';
  teacherList.forEach(t => {
    sel.innerHTML += `<option value="${t.username}">${t.fullName}</option>`;
  });
  if (currentValue) {
    sel.value = currentValue;
  }
}

function applySettingsToLogin(data) {
  if (data.school_name) {
    document.getElementById('loginSchoolName').textContent = data.school_name;
  }
  if (data.logo_url) {
    const logo = document.getElementById('loginLogo');
    logo.src = data.logoUrl || data.logo_url;
    logo.classList.remove('hidden');
    document.getElementById('loginLogoPlaceholder').classList.add('hidden');
  }
  if (data.footer_credit) {
    document.getElementById('loginFooter').textContent = data.footer_credit;
  }
}

async function handleLogin() {
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;

  if (!username || !password) {
    showToast('กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน', 'warning');
    return;
  }

  const result = await callApi('login', { username, password });
  if (result && result.success) {
    // เคลียร์ Cache ข้อมูลของครูคนเก่าก่อนบันทึกคนใหม่
    localStorage.removeItem('dashboard_cache');
    if (typeof clearApiCache === 'function') clearApiCache();

    localStorage.setItem('session_token', result.token);
    localStorage.setItem('teacher_data', JSON.stringify(result.teacher));
    showToast('เข้าสู่ระบบสำเร็จ!', 'success');
    
    // reset form
    document.getElementById('loginPassword').value = '';
    
    setTimeout(() => {
      showMainApp();
    }, 500);
  }
}

async function handleLogout() {
  const ok = await showConfirm('ยืนยันออกจากระบบ', 'คุณต้องการออกจากระบบใช่หรือไม่?');
  if (ok) {
    // ยิง API logout ไปหลังบ้านเงียบๆ (ไม่ต้องรอ)
    callApiSilent('logout');
    
    // เคลียร์ Session และ Cache ทั้งหมดทันที
    localStorage.removeItem('session_token');
    localStorage.removeItem('teacher_data');
    localStorage.removeItem('dashboard_cache');
    clearApiCache(); // เคลียร์ Cache ของ dropdown/ตารางสอนทั้งหมด
    
    appProfile = null; // เคลียร์ Profile ออกจากหน่วยความจำ
    
    showLoginPage();
  }
}

function togglePassword() {
  const inp = document.getElementById('loginPassword');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

function checkSession() {
  return !!localStorage.getItem('session_token');
}