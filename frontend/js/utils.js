/**
 * ============================================================
 * utils.js — Utilities & Helpers
 * ============================================================
 */

// === API Cache System (localStorage) ===
const API_CACHE_PREFIX = 'api_cache_';
const API_CACHE_TTL = {
  'getClassList': 10 * 60 * 1000,      // 10 นาที — ห้องเรียนไม่ค่อยเปลี่ยน
  'getSubjectList': 10 * 60 * 1000,     // 10 นาที
  'getWeekSchedule': 5 * 60 * 1000,     // 5 นาที
  'getAllClassrooms': 10 * 60 * 1000,    // 10 นาที
  'getSettings': 10 * 60 * 1000,        // 10 นาที
  'default': 3 * 60 * 1000              // 3 นาที
};

/**
 * getCachedApi — ดึงข้อมูลจาก localStorage Cache
 * @param {string} action — ชื่อ API action
 * @param {object} params — พารามิเตอร์ (ใช้เป็น cache key)
 * @returns {object|null}
 */
function getCachedApi(action, params) {
  try {
    const key = API_CACHE_PREFIX + action + '_' + JSON.stringify(params || {});
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    const ttl = API_CACHE_TTL[action] || API_CACHE_TTL['default'];
    if (Date.now() - cached._ts > ttl) {
      localStorage.removeItem(key);
      return null;
    }
    return cached.data;
  } catch (e) { return null; }
}

/**
 * setCachedApi — เก็บข้อมูล API ลง localStorage
 */
function setCachedApi(action, params, data) {
  try {
    const key = API_CACHE_PREFIX + action + '_' + JSON.stringify(params || {});
    localStorage.setItem(key, JSON.stringify({ data, _ts: Date.now() }));
  } catch (e) { /* localStorage เต็ม */ }
}

/**
 * clearApiCache — ลบ cache ของ action ที่ระบุ หรือทั้งหมด
 */
function clearApiCache(action) {
  try {
    if (action) {
      const prefix = API_CACHE_PREFIX + action;
      Object.keys(localStorage).filter(k => k.startsWith(prefix)).forEach(k => localStorage.removeItem(k));
    } else {
      Object.keys(localStorage).filter(k => k.startsWith(API_CACHE_PREFIX)).forEach(k => localStorage.removeItem(k));
    }
  } catch (e) {}
}

/**
 * cachedApiCall — เรียก API แบบ Stale-While-Revalidate
 * แสดงข้อมูลจาก cache ก่อน แล้วดึงข้อมูลใหม่เบื้องหลัง
 * @param {string} action
 * @param {object} params
 * @param {function} onData — callback(data, fromCache)
 */
async function cachedApiCall(action, params, onData) {
  // 1. แสดงจาก cache ก่อน (ถ้ามี)
  const cached = getCachedApi(action, params);
  if (cached && onData) {
    onData(cached, true);
  }
  // 2. ดึงข้อมูลใหม่จาก API
  const result = await callApiSilent(action, params || {});
  if (result && result.success) {
    setCachedApi(action, params, result.data);
    if (onData) onData(result.data, false);
    return result.data;
  }
  return cached || null;
}

/**
 * getMyClassesAndSubjects — ดึงรายชื่อห้องเรียนและวิชาทั้งหมดของครูในรอบเดียว
 * พยายามดึงจาก cache (dashboard_cache หรือ weekSchedule cache)
 * เพื่อใช้แสดงใน Dropdown ต่างๆ ได้ทันทีโดยไม่ต้องรอ API โหลด
 * @returns {Promise<{classes: string[], subjectsByClass: Object}>}
 */
async function getMyClassesAndSubjects() {
  let allSchedules = [];

  // 1. ดึงจาก dashboard_cache
  try {
    const rawDash = localStorage.getItem('dashboard_cache');
    if (rawDash) {
      const dash = JSON.parse(rawDash);
      // โครงสร้าง dashboard cache: { timestamp: Number, date: String, data: { weekSchedule: { all: [...] } } }
      if (dash && dash.data && dash.data.weekSchedule && dash.data.weekSchedule.all) {
        allSchedules = dash.data.weekSchedule.all;
      } else if (dash && dash.weekSchedule && dash.weekSchedule.all) {
        // เผื่อโครงสร้างสั้น
        allSchedules = dash.weekSchedule.all;
      }
    }
  } catch (e) {}

  // 2. ดึงจาก weekSchedule cache ของ apiCache
  if (allSchedules.length === 0) {
    const cachedWeek = getCachedApi('getWeekSchedule');
    if (cachedWeek && cachedWeek.all) {
      allSchedules = cachedWeek.all;
    }
  }

  // 3. ดึงจาก API getWeekSchedule ตรงๆ
  if (allSchedules.length === 0) {
    const result = await callApiSilent('getWeekSchedule');
    if (result && result.success && result.data && result.data.all) {
      allSchedules = result.data.all;
      setCachedApi('getWeekSchedule', {}, result.data);
    }
  }

  // แยกรายชื่อห้องเรียนและวิชาของแต่ละห้อง
  const classes = [...new Set(allSchedules.map(s => String(s.className || '').trim()))]
    .filter(c => c !== '')
    .sort();

  const subjectsByClass = {};
  classes.forEach(c => {
    subjectsByClass[c] = [...new Set(
      allSchedules.filter(s => String(s.className || '').trim() === c)
                  .map(s => String(s.subjectName || '').trim())
    )].filter(s => s !== '').sort();
  });

  return { classes, subjectsByClass };
}

function escapeHtml(unsafe) {
  if (unsafe == null) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const bgColors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500'
  };
  const bgColor = bgColors[type] || bgColors.info;

  const toast = document.createElement('div');
  toast.className = `flex items-center text-white px-4 py-3 rounded-xl shadow-lg transition-all transform duration-300 translate-x-full ${bgColor}`;
  toast.innerHTML = `<span class="text-sm font-medium">${escapeHtml(message)}</span>`;

  container.appendChild(toast);

  // Animate in
  setTimeout(() => toast.classList.remove('translate-x-full'), 10);

  // Auto remove
  setTimeout(() => {
    toast.classList.add('translate-x-full');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function showLoading(text = 'กำลังโหลด...') {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    document.getElementById('loadingText').textContent = text;
    overlay.classList.remove('hidden');
  }
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.classList.add('hidden');
}

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateThai(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return `${parseInt(parts[2])} ${months[parseInt(parts[1])-1]} ${parseInt(parts[0])+543}`;
}

function getThaiDay(dateStr) {
  const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const d = dateStr ? new Date(dateStr) : new Date();
  return days[d.getDay()];
}

async function showConfirm(title, text, confirmButtonText = 'ตกลง') {
  const result = await Swal.fire({
    title: title,
    text: text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3b82f6',
    cancelButtonColor: '#ef4444',
    confirmButtonText: confirmButtonText,
    cancelButtonText: 'ยกเลิก',
    customClass: { popup: 'rounded-2xl' }
  });
  return result.isConfirmed;
}

async function showUnsavedWarning() {
  return await Swal.fire({
    title: 'มีข้อมูลยังไม่บันทึก',
    text: 'คุณต้องการบันทึกข้อมูลก่อนออกจากหน้านี้หรือไม่?',
    icon: 'warning',
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonText: 'บันทึก',
    denyButtonText: `ไม่บันทึก`,
    cancelButtonText: 'ยกเลิก',
    customClass: { popup: 'rounded-2xl' }
  });
}

function exportToCSV(dataRows, headers, filename) {
  let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
  csvContent += headers.join(",") + "\r\n";
  
  dataRows.forEach(rowArray => {
    let row = rowArray.map(item => `"${String(item).replace(/"/g, '""')}"`).join(",");
    csvContent += row + "\r\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportToExcel(dataRows, headers, filename) {
  if (typeof XLSX === 'undefined') {
    showToast('กรุณารอโหลดไลบรารีสักครู่', 'warning');
    return;
  }
  const wsData = [headers, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

function printElement(elementId) {
  const element = document.getElementById(elementId);
  if (!element) return;
  window.print();
}