/**
 * ============================================================
 * settings.js — ตั้งค่า Page
 * ============================================================
 */

async function renderSettings() {
  const content = document.getElementById('pageContent');
  content.innerHTML = `
    <div class="animate-fadeInUp space-y-6">
      <h1 class="text-xl font-bold text-gray-800">ตั้งค่าระบบ</h1>
      <div class="card p-6 max-w-2xl">
        <form id="settingsForm" onsubmit="event.preventDefault(); saveSettings();" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-600 mb-1">ชื่อโรงเรียน / องค์กร</label>
            <input type="text" id="setSchoolName" class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-primary-500 outline-none transition-all text-gray-700" placeholder="เช่น โรงเรียนมัธยมศึกษา">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-600 mb-1">URL โลโก้</label>
            <input type="text" id="setLogoUrl" class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-primary-500 outline-none transition-all text-gray-700" placeholder="https://example.com/logo.png">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-600 mb-1">ข้อความเครดิต (Footer)</label>
            <input type="text" id="setCredit" class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-primary-500 outline-none transition-all text-gray-700" placeholder="© 2024 พัฒนาโดย...">
          </div>
          <div class="pt-4 border-t border-gray-100 flex justify-end">
            <button type="submit" class="px-8 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold rounded-xl hover:from-primary-600 hover:to-primary-700 shadow-lg shadow-primary-200 transition-all duration-300">
              💾 บันทึกการตั้งค่า
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  // ใช้ cachedApiCall — แสดงค่าจาก cache ทันทีแล้วอัปเดตเบื้องหลัง
  await cachedApiCall('getSettings', {}, (data, fromCache) => {
    if (currentPage !== 'settings') return; // ⛔ ป้องกันเขียนทับ
    const schoolInput = document.getElementById('setSchoolName');
    if (!schoolInput) return;
    schoolInput.value = data.school_name || '';
    document.getElementById('setLogoUrl').value = data.logo_url || '';
    document.getElementById('setCredit').value = data.footer_credit || '';
  });
}

async function saveSettings() {
  const school_name = document.getElementById('setSchoolName').value;
  const logo_url = document.getElementById('setLogoUrl').value;
  const footer_credit = document.getElementById('setCredit').value;

  const result = await callApi('saveSettings', { school_name, logo_url, footer_credit });
  if (result && result.success) {
    clearApiCache('getSettings');
    clearApiCache('getDashboardData');
    localStorage.removeItem('dashboard_cache');
    showToast('บันทึกการตั้งค่าสำเร็จ', 'success');
    await loadProfile(); // Refresh UI
  }
}