/*************************************************
 * AUTH + PERMISSION CONTROL
 *************************************************/

const API_ME = "http://localhost:8080/api/v1/auth/me";

/**
 * Fetch có gắn token
 */
async function authFetch(url, options = {}) {
    const token = sessionStorage.getItem("token");
    if (!token) {
        window.location.href = "login.html";
        return;
    }

    options.headers = {
        ...options.headers,
        Authorization: "Bearer " + token,
        "Content-Type": "application/json"
    };

    return fetch(url, options);
}

/**
 * Load thông tin user + permission
 */
async function loadMe() {
    const res = await authFetch(API_ME);
    if (!res || !res.ok) throw new Error("Unauthorized");

    const me = await res.json();
    sessionStorage.setItem("me", JSON.stringify(me));
    return me;
}

/**
 * Kiểm tra permission
 */
function getMeObj() {
    const raw = sessionStorage.getItem("me");
    if (!raw) return {};
    try { return JSON.parse(raw); } catch { return {}; }
}

function getPermissionIds() {
    const me = getMeObj();
    // hỗ trợ cả 2 kiểu: me.permissionIds hoặc me.data.permissionIds
    return (me.permissionIds || me.data?.permissionIds || []).map(Number);
}

function hasPermission(permissionId) {
    return getPermissionIds().includes(Number(permissionId));
}

/**
 * Map permissionId (PHẢI TRÙNG DB)
 */
const PERM = {
    DASHBOARD: 1,
    TOUR_MANAGE: 2,
    ORDER_MANAGE: 3,
    CUSTOMER_MANAGE: 4,
    REPORT_VIEW: 5,
    EMPLOYEE_MANAGE: 6,
    PROMOTION_MANAGE: 7,
    CONTENT_MANAGE: 8,
    SETTING_MANAGE: 9,
    TRIP_VIEW_ASSIGNED: 10,
    CUSTOMER_VIEW_ASSIGNED: 11
};

/**
 * Ẩn phần tử nếu không có quyền
 */
function hideIfNoPerm(selector, permId) {
    const el = document.querySelector(selector);
    if (el && !hasPermission(permId)) {
        el.style.display = "none";
    }
}

/**
 * Áp quyền lên UI
 */
function applyPermissionUI() {
    hideIfNoPerm('a[href="index.html"]', PERM.DASHBOARD);
    hideIfNoPerm('a[href="tour-managerment.html"]', PERM.TOUR_MANAGE);
    hideIfNoPerm('a[href="order.html"]', PERM.ORDER_MANAGE);
    hideIfNoPerm('a[href="users.html"]', PERM.CUSTOMER_MANAGE);
    hideIfNoPerm('a[href="charts.html"]', PERM.REPORT_VIEW);
    hideIfNoPerm('a[href="employees.html"]', PERM.EMPLOYEE_MANAGE);
    hideIfNoPerm('a[href="promotion.html"]', PERM.PROMOTION_MANAGE);
    hideIfNoPerm('a[href="content.html"]', PERM.CONTENT_MANAGE);
    hideIfNoPerm('a[href="settings.html"]', PERM.SETTING_MANAGE);
}

/**
 * INIT
 */
document.addEventListener("DOMContentLoaded", async () => {
    try {
        if (!sessionStorage.getItem("me")) {
            await loadMe(); // 🔥 gọi /me SAU login
        }
        applyPermissionUI();
    } catch (e) {
        console.warn("Auth failed", e);
        sessionStorage.clear();
        window.location.href = "login.html";
    }
});
