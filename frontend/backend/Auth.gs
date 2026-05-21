/**
 * ============================================================
 * Auth.gs — Authentication & Session Management
 * ============================================================
 * - Login: ตรวจสอบ username/password จาก Teachers sheet
 * - Session: เก็บ token ใน CacheService (หมดอายุ 6 ชม.)
 * - Logout: ลบ session
 * ============================================================
 */

// Session timeout: 6 ชั่วโมง (21600 วินาที)
const SESSION_TIMEOUT = 21600;

/**
 * login — ตรวจสอบ username และ password
 * @param {string} username
 * @param {string} password
 * @returns {TextOutput}
 */
function login(username, password) {
  try {
    // Validate input
    const err = validateInput({ 'ชื่อผู้ใช้': username, 'รหัสผ่าน': password });
    if (err) return errorResponse(err);

    // ดึงข้อมูลครูทั้งหมด — เคลียร์ cache ก่อนเพื่อให้ได้ข้อมูลล่าสุดเสมอ
    clearSheetCache('Teachers');
    const teachers = getSheetData('Teachers');
    const teacher = teachers.find(t =>
      String(t.username).trim() === String(username).trim()
    );

    if (!teacher) {
      return errorResponse('ไม่พบชื่อผู้ใช้นี้ในระบบ');
    }

    if (String(teacher.password).trim() !== String(password).trim()) {
      return errorResponse('รหัสผ่านไม่ถูกต้อง');
    }

    if (teacher.status !== 'active') {
      return errorResponse('บัญชีนี้ถูกระงับการใช้งาน');
    }

    // สร้าง session token
    const token = generateId();
    const sessionData = {
      teacherId: String(teacher.teacher_id),
      username: teacher.username,
      fullName: teacher.full_name,
      role: teacher.role,
      loginTime: new Date().toISOString()
    };

    // เก็บ session ใน CacheService
    const cache = CacheService.getScriptCache();
    cache.put('session_' + token, JSON.stringify(sessionData), SESSION_TIMEOUT);

    return jsonResponse({
      success: true,
      message: 'เข้าสู่ระบบสำเร็จ',
      token: token,
      teacher: {
        teacherId: teacher.teacher_id,
        fullName: teacher.full_name,
        role: teacher.role
      }
    });
  } catch (error) {
    Logger.log('Login error: ' + error.message);
    return errorResponse('เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
  }
}

/**
 * validateSession — ตรวจสอบ session token
 * @param {string} token
 * @returns {object|null} — session data หรือ null ถ้าไม่ valid
 */
function validateSession(token) {
  if (!token) return null;

  try {
    const cache = CacheService.getScriptCache();
    const sessionStr = cache.get('session_' + token);
    if (!sessionStr) return null;

    const session = JSON.parse(sessionStr);

    // Renew session (ต่ออายุทุกครั้งที่ใช้งาน)
    cache.put('session_' + token, sessionStr, SESSION_TIMEOUT);

    return session;
  } catch (error) {
    Logger.log('Validate session error: ' + error.message);
    return null;
  }
}

/**
 * logout — ลบ session
 * @param {string} token
 * @returns {TextOutput}
 */
function logout(token) {
  try {
    if (token) {
      const cache = CacheService.getScriptCache();
      cache.remove('session_' + token);
    }
    return jsonResponse({
      success: true,
      message: 'ออกจากระบบสำเร็จ'
    });
  } catch (error) {
    return jsonResponse({ success: true, message: 'ออกจากระบบสำเร็จ' });
  }
}

/**
 * getTeacherList — ดึงรายชื่อครูสำหรับ Dropdown (ไม่ต้อง login)
 * @returns {TextOutput}
 */
function getTeacherList() {
  try {
    const teachers = getSheetData('Teachers');
    const list = teachers
      .filter(t => t.status === 'active')
      .map(t => ({
        username: t.username,
        fullName: t.full_name
      }));

    return jsonResponse({
      success: true,
      data: list
    });
  } catch (error) {
    Logger.log('getTeacherList error: ' + error.message);
    return errorResponse('ไม่สามารถโหลดรายชื่อครูได้');
  }
}

/**
 * getProfile — ดึงข้อมูลโปรไฟล์ครู
 * @param {string} teacherId
 * @returns {TextOutput}
 */
function getProfile(teacherId) {
  try {
    const teachers = getSheetData('Teachers');
    const teacher = teachers.find(t => String(t.teacher_id) === String(teacherId));

    if (!teacher) {
      return errorResponse('ไม่พบข้อมูลครู');
    }

    // ดึง Settings
    const settings = getSheetData('Settings');
    const settingsMap = {};
    settings.forEach(s => {
      settingsMap[s.key] = s.value;
    });

    return jsonResponse({
      success: true,
      data: {
        teacherId: teacher.teacher_id,
        fullName: teacher.full_name,
        role: teacher.role,
        schoolName: settingsMap.school_name || 'โรงเรียน',
        logoUrl: convertDriveUrl(settingsMap.logo_url || ''),
        footerCredit: settingsMap.footer_credit || 'พัฒนาโดยทีมงาน'
      }
    });
  } catch (error) {
    Logger.log('getProfile error: ' + error.message);
    return errorResponse('ไม่สามารถโหลดข้อมูลโปรไฟล์ได้');
  }
}
