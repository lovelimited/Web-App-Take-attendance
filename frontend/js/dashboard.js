/**
 * ============================================================
 * dashboard.js — Dashboard Page (Optimized)
 * ============================================================
 * - Skeleton Loading สำหรับ UX ที่ดีขึ้น
 * - localStorage Cache (Stale-While-Revalidate)
 * - ใช้ getDashboardData API รวม (1 request แทน 3)
 * ============================================================
 */

const DASHBOARD_CACHE_KEY = 'dashboard_cache';
const DASHBOARD_CACHE_TTL = 5 * 60 * 1000; // 5 นาที

/**
 * renderDashboard — แสดงหน้า Dashboard
 */
async function renderDashboard() {
  const content = document.getElementById('pageContent');

  // === Step 1: แสดง Skeleton ทันที ===
  content.innerHTML = buildDashboardSkeleton();

  // === Step 2: ลองแสดงข้อมูลจาก Cache ก่อน (Stale) ===
  const cached = getDashboardCache();
  if (cached) {
    renderDashboardData(cached, true); // true = จาก cache
  }

  // === Step 3: ดึงข้อมูลใหม่จาก API (Revalidate) ===
  try {
    const result = await callApiSilent('getDashboardData');
    // ⛔ ถ้า user เปลี่ยนหน้าไปแล้ว ไม่ต้องทำอะไร
    if (currentPage !== 'dashboard') return;

    if (result && result.success) {
      const data = result.data;

      // อัปเดต Profile Sidebar ด้วย
      if (data.profile) {
        appProfile = data.profile;
        updateSidebarProfile(data.profile);
      }

      // แปลงข้อมูลเป็นรูปแบบที่ dashboard ใช้
      const teacherInfo = JSON.parse(localStorage.getItem('teacher_data') || '{}');
      const dashData = {
        teacherId: teacherInfo.teacherId || '',
        cards: data.attendance.cards || [],
        weekTotal: data.weekSchedule.all ? data.weekSchedule.all.length : 0,
        date: data.attendance.date,
        dayOfWeek: data.attendance.dayOfWeek,
        currentPeriod: data.attendance.currentPeriod,
        timestamp: Date.now()
      };

      // เก็บลง Cache
      setDashboardCache(dashData);

      // แสดงผลข้อมูลจริง
      renderDashboardData(dashData, false);
    } else if (!cached) {
      // ถ้าไม่มี cache และ API ก็ล้มเหลว → fallback เดิม (2 API แยก)
      await fallbackDashboard();
    }
  } catch (err) {
    console.error('getDashboardData error:', err);
    if (!cached) {
      await fallbackDashboard();
    }
  }
}

/**
 * fallbackDashboard — ใช้ API เดิม (getAttendanceCards + getWeekSchedule) กรณี getDashboardData ไม่พร้อม
 */
async function fallbackDashboard() {
  const [cardsRes, weekRes] = await Promise.all([
    callApiSilent('getAttendanceCards', { date: getTodayStr() }),
    callApiSilent('getWeekSchedule')
  ]);

  // ⛔ ถ้า user เปลี่ยนหน้าไปแล้ว ไม่ต้องทำอะไร
  if (currentPage !== 'dashboard') return;

  const teacherInfo = JSON.parse(localStorage.getItem('teacher_data') || '{}');
  const dashData = {
    teacherId: teacherInfo.teacherId || '',
    cards: (cardsRes && cardsRes.success) ? (cardsRes.data.cards || []) : [],
    weekTotal: (weekRes && weekRes.success && weekRes.data.all) ? weekRes.data.all.length : 0,
    date: getTodayStr(),
    dayOfWeek: getThaiDay(),
    currentPeriod: (cardsRes && cardsRes.success) ? cardsRes.data.currentPeriod : null,
    timestamp: Date.now()
  };

  setDashboardCache(dashData);
  renderDashboardData(dashData, false);
}

/**
 * buildDashboardSkeleton — สร้าง Skeleton Loading HTML
 */
function buildDashboardSkeleton() {
  return `
    <div class="animate-fadeInUp space-y-6">
      <div class="flex items-center justify-between">
        <div class="skeleton skeleton-text-lg" style="width:180px"></div>
        <div class="skeleton skeleton-text" style="width:140px"></div>
      </div>

      <!-- Stats Cards Skeleton -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="skeleton skeleton-stat"></div>
        <div class="skeleton skeleton-stat"></div>
        <div class="skeleton skeleton-stat"></div>
        <div class="skeleton skeleton-stat" style="background:linear-gradient(90deg,#dbeafe 25%,#bfdbfe 50%,#dbeafe 75%);background-size:200% 100%;animation:shimmer 1.5s infinite ease-in-out;"></div>
      </div>

      <!-- Schedule Skeleton -->
      <div class="skeleton skeleton-text-lg" style="width:160px;margin-top:2rem;margin-bottom:1rem"></div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
      </div>
    </div>
  `;
}

/**
 * renderDashboardData — แสดงข้อมูล Dashboard จริง
 * @param {object} data — { cards, weekTotal, date, dayOfWeek }
 * @param {boolean} fromCache — แสดงสถานะว่ามาจาก cache หรือไม่
 */
function renderDashboardData(data, fromCache) {
  // ⛔ ถ้า user เปลี่ยนหน้าไปแล้ว ไม่ต้อง render
  if (currentPage !== 'dashboard') return;
  const content = document.getElementById('pageContent');
  if (!content) return;

  const { cards, weekTotal, currentPeriod } = data;
  const todayTotal = cards.length;
  const todayChecked = cards.filter(c => c.isChecked).length;
  const todayUnchecked = todayTotal - todayChecked;
  const percentComplete = todayTotal > 0 ? Math.round((todayChecked / todayTotal) * 100) : 0;

  // คำนวณสถานะของแต่ละคาบสอนวันนี้
  const now = new Date();
  const currentTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

  const timelineHtml = cards.length === 0
    ? `<div class="card p-8 text-center text-gray-400 border-dashed border-2">วันนี้ไม่มีคาบสอนสำหรับคุณพักผ่อนให้เต็มที่ 🎉</div>`
    : `<div class="timeline-container">` + cards.map((s, i) => {
        let status = 'upcoming';
        let statusBadge = '';
        let statusClass = 'timeline-card-upcoming';
        let dotClass = 'timeline-dot-upcoming';
        let actionBtn = '';

        if (s.isChecked) {
          status = 'checked';
          dotClass = 'timeline-dot-checked';
          statusClass = 'timeline-card-checked';
          statusBadge = `<span class="badge badge-green">✓ เช็คชื่อเรียบร้อย</span>`;
        } else if (s.isCurrent) {
          status = 'current';
          dotClass = 'timeline-dot-current';
          statusClass = 'timeline-card-current';
          statusBadge = `<span class="badge badge-blue animate-pulse">⚡ กำลังสอนอยู่</span>`;
          actionBtn = `<button onclick="navigateTo('attendance', '${s.scheduleId}')" class="mt-3 px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-xl shadow-sm transition-all">เช็คชื่อคาบนี้</button>`;
        } else {
          // เช็คว่าเลยเวลาหรือยัง
          const isPast = (currentPeriod && s.period < currentPeriod) || (currentTime > s.endTime);
          if (isPast) {
            status = 'missed';
            dotClass = 'timeline-dot-missed';
            statusClass = 'timeline-card-missed';
            statusBadge = `<span class="badge badge-red">⚠️ ยังไม่ได้เช็คชื่อ (เลยเวลา)</span>`;
            actionBtn = `<button onclick="navigateTo('attendance', '${s.scheduleId}')" class="mt-3 px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-xl shadow-sm transition-all">เช็คชื่อย้อนหลัง</button>`;
          } else {
            status = 'upcoming';
            dotClass = 'timeline-dot-upcoming';
            statusClass = 'timeline-card-upcoming';
            statusBadge = `<span class="badge badge-yellow">🕒 คาบเรียนถัดไป</span>`;
          }
        }

        return `
          <div class="timeline-item animate-fadeInUp" style="animation-delay:${i * 0.05}s">
            <!-- Timeline Node Indicator -->
            <div class="timeline-dot ${dotClass}"></div>
            
            <!-- Content Card -->
            <div class="card timeline-card ${statusClass} p-4 cursor-pointer" onclick="navigateTo('attendance', '${s.scheduleId}')">
              <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div class="flex items-center gap-2">
                  <span class="px-2.5 py-1 text-xs font-bold rounded-lg ${s.isCurrent ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}">คาบที่ ${s.period}</span>
                  ${statusBadge}
                </div>
                <span class="text-xs font-medium text-gray-400">⏰ ${s.startTime} - ${s.endTime} น.</span>
              </div>
              <div class="flex items-end justify-between">
                <div>
                  <h3 class="font-bold text-gray-800 text-base md:text-lg mb-0.5">${escapeHtml(s.subjectName)}</h3>
                  <p class="text-xs md:text-sm text-gray-500 font-medium">ห้องเรียน: ${escapeHtml(s.className)} • จำนวนนักเรียน: ${s.totalStudents} คน</p>
                  ${s.isChecked ? `<p class="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-green-500 inline-block"></span>มา ${s.presentCount} คน</span>
                    <span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-500 inline-block"></span>ขาด ${s.absentCount || 0} คน</span>
                    <span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>ลา ${s.leaveCount || 0} คน</span>
                    <span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span>สาย ${s.lateCount || 0} คน</span>
                  </p>` : ''}
                </div>
                ${actionBtn}
              </div>
            </div>
          </div>
        `;
      }).join('') + `</div>`;

  const cacheIndicator = fromCache ? `<span class="text-[10px] text-blue-200 bg-blue-700/30 px-1.5 py-0.5 rounded ml-2" title="กำลังอัปเดตข้อมูลเงียบๆ...">กำลังอัปเดต...</span>` : '';

  // ตรวจสอบข้อความแจ้งสถานะปัจจุบัน
  let currentPeriodText = 'ขณะนี้อยู่นอกเวลาเรียนการสอน';
  if (currentPeriod) {
    const curCard = cards.find(c => c.period === Number(currentPeriod));
    if (curCard) {
      currentPeriodText = `ขณะนี้กำลังเรียนคาบที่ ${currentPeriod} — วิชา ${escapeHtml(curCard.subjectName)} (ชั้น ${escapeHtml(curCard.className)})`;
    } else {
      currentPeriodText = `ขณะนี้กำลังเรียนคาบที่ ${currentPeriod}`;
    }
  }

  content.innerHTML = `
    <div class="animate-fadeInUp space-y-6">
      
      <!-- Premium Hero Banner -->
      <div class="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-primary-700 rounded-3xl text-white p-6 md:p-8 shadow-xl shadow-blue-500/10">
        <div class="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
        
        <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div class="space-y-2">
            <div class="flex items-center flex-wrap gap-2 text-xs md:text-sm font-semibold text-blue-100 uppercase tracking-wider">
              <span>ยินดีต้อนรับกลับ</span>
              <span>•</span>
              <span>${getThaiDay()} ${formatDateThai(getTodayStr())}</span>
              ${cacheIndicator}
            </div>
            <h1 class="text-2xl md:text-3xl font-extrabold tracking-tight">
              สวัสดี, ${appProfile ? appProfile.fullName.split(' ')[0] : 'คุณครู'} 👋
            </h1>
            <p class="text-sm md:text-base text-blue-100 font-medium">
              ${currentPeriodText}
            </p>
          </div>
          
          <!-- Circular / Compact Progress Widget -->
          <div class="flex items-center gap-4 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 min-w-[200px]">
            <div class="flex-1">
              <div class="text-xs text-blue-100 font-medium mb-1">การเช็คชื่อวันนี้</div>
              <div class="text-lg font-bold">${todayChecked} / ${todayTotal} คาบ</div>
              <!-- Progress bar -->
              <div class="w-full bg-white/20 rounded-full h-1.5 mt-2 overflow-hidden">
                <div class="bg-emerald-400 h-full rounded-full transition-all duration-500" style="width: ${percentComplete}%"></div>
              </div>
            </div>
            <div class="text-2xl md:text-3xl font-black text-emerald-400">${percentComplete}%</div>
          </div>
        </div>
      </div>

      <!-- Quick Statistics Grid -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <!-- Today Classes -->
        <div class="card p-4 flex items-center gap-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
          <div class="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl shrink-0 shadow-inner">
            📅
          </div>
          <div>
            <div class="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-0.5">คาบสอนวันนี้</div>
            <div class="text-2xl font-black text-blue-600">${todayTotal}</div>
          </div>
        </div>
        
        <!-- Checked Classes -->
        <div class="card p-4 flex items-center gap-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
          <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shrink-0 shadow-inner">
            ✓
          </div>
          <div>
            <div class="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-0.5">เช็คชื่อแล้ว</div>
            <div class="text-2xl font-black text-emerald-500">${todayChecked}</div>
          </div>
        </div>
        
        <!-- Pending Classes -->
        <div class="card p-4 flex items-center gap-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
          <div class="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center text-xl shrink-0 shadow-inner">
            ⚠️
          </div>
          <div>
            <div class="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-0.5">ยังไม่เช็คชื่อ</div>
            <div class="text-2xl font-black text-red-500">${todayUnchecked}</div>
          </div>
        </div>
        
        <!-- Weekly Total -->
        <div class="card p-4 flex items-center gap-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
          <div class="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shrink-0 shadow-inner">
            📚
          </div>
          <div>
            <div class="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-0.5">รวมทั้งสัปดาห์</div>
            <div class="text-2xl font-black text-indigo-600">${weekTotal}</div>
          </div>
        </div>
      </div>

      <!-- Schedule Section Header -->
      <div class="flex items-center justify-between mt-8 mb-4 border-b border-gray-100 pb-2">
        <h2 class="text-lg font-bold text-gray-800 flex items-center gap-2">
          <span>🕒 ลำดับคาบเรียนวันนี้</span>
        </h2>
        <span class="text-xs text-gray-400 font-medium">กดที่วิชาเพื่อเช็คชื่อ</span>
      </div>

      <!-- Timeline Schedule -->
      <div class="max-w-3xl">
        ${timelineHtml}
      </div>
      
    </div>
  `;
}

/**
 * updateSidebarProfile — อัปเดต Sidebar จากข้อมูล profile
 */
function updateSidebarProfile(profile) {
  const nameEl = document.getElementById('sidebarTeacherName');
  const schoolEl = document.getElementById('sidebarSchoolName');
  const footerEl = document.getElementById('sidebarFooter');

  if (nameEl) nameEl.textContent = profile.fullName;
  if (schoolEl) schoolEl.textContent = profile.schoolName || 'ระบบเช็คชื่อ';

  if (profile.logoUrl) {
    const logo = document.getElementById('sidebarLogo');
    if (logo) {
      logo.src = profile.logoUrl;
      logo.classList.remove('hidden');
      const placeholder = document.getElementById('sidebarLogoPlaceholder');
      if (placeholder) placeholder.classList.add('hidden');
    }
  }
  if (profile.footerCredit && footerEl) {
    footerEl.innerHTML = `${escapeHtml(profile.footerCredit)}<br>v1.0.0`;
  }
  // อัปเดตสิทธิ์เมนูตั้งค่าหลังได้ role จาก API
  updateSettingsMenuVisibility();
}

// === localStorage Cache Helpers ===

function getDashboardCache() {
  try {
    const raw = localStorage.getItem(DASHBOARD_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    
    // ตรวจสอบว่าเป็นของครูคนที่ล็อกอินอยู่หรือไม่
    const teacherInfo = JSON.parse(localStorage.getItem('teacher_data') || '{}');
    if (data.teacherId !== (teacherInfo.teacherId || '')) {
      localStorage.removeItem(DASHBOARD_CACHE_KEY);
      return null;
    }

    // ตรวจสอบว่า cache ยังไม่หมดอายุ
    if (Date.now() - data.timestamp > DASHBOARD_CACHE_TTL) {
      localStorage.removeItem(DASHBOARD_CACHE_KEY);
      return null;
    }
    // ตรวจสอบว่าเป็นวันเดียวกัน (ถ้าข้ามวันต้อง refresh)
    if (data.date !== getTodayStr()) {
      localStorage.removeItem(DASHBOARD_CACHE_KEY);
      return null;
    }
    return data;
  } catch (e) {
    return null;
  }
}

function setDashboardCache(data) {
  try {
    localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(data));
  } catch (e) {
    // localStorage เต็ม — ไม่ต้องทำอะไร
  }
}