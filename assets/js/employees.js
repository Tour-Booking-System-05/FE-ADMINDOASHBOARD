document.addEventListener('DOMContentLoaded', function () {

    // ================== CONFIG ==================
    const API_URL = 'http://localhost:8080/api/v1/employees';
    let currentId = null;

    const modalEl = document.getElementById('employeeModal');
    const modal = new bootstrap.Modal(modalEl);
    const form = document.getElementById('editEmployeeForm');

    const deleteBtn = document.getElementById('deleteEmployeeBtn');
    const resetBtn = document.getElementById('resetPasswordBtn');
    const addBtn = document.getElementById('addEmployeeBtn');

    // inputs
    const employeeIdInput = document.getElementById('employeeIdInput');
    const employeeNameInput = document.getElementById('employeeNameInput');
    const employeeEmailInput = document.getElementById('employeeEmailInput');
    const employeePhoneInput = document.getElementById('employeePhoneInput');
    const employeeDobInput = document.getElementById('employeeDobInput');
    const employeeGenderInput = document.getElementById('employeeGenderInput');
    const employeeRoleInput = document.getElementById('employeeRoleInput');
    const employeeStatusInput = document.getElementById('employeeStatusInput');

    // group của "Mã nhân viên" để ẩn khi tạo
    const employeeIdGroup = employeeIdInput.closest('.mb-3');

    // ================== ALERT ==================
    function showAlert(msg, type = 'success') {
        const icons = {
            success: 'bi-check-circle-fill',
            danger: 'bi-x-circle-fill',
            warning: 'bi-exclamation-triangle-fill',
            info: 'bi-info-circle-fill'
        };

        const div = document.createElement('div');
        div.className = `alert alert-${type} bg-${type} text-light alert-dismissible fade show mb-2`;
        div.innerHTML = `
      <i class="bi ${icons[type] || icons.info} me-2"></i>${msg}
      <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert"></button>
    `;
        document.getElementById('alert-container').appendChild(div);
        setTimeout(() => div.remove(), 3500);
    }

    // ================== AUTH FETCH ==================
    function authFetch(url, options = {}) {
        const token = sessionStorage.getItem("token");
        if (!token) {
            window.location.href = "login.html";
            return Promise.reject(new Error("No token"));
        }

        options.headers = {
            ...options.headers,
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json"
        };

        return fetch(url, options).then(async (res) => {
            if (!res.ok) {
                let msg = "Request failed";
                try {
                    const err = await res.json();
                    msg = err?.error || err?.message || JSON.stringify(err);
                } catch (_) { }
                throw new Error(msg);
            }
            return res;
        });
    }

    // ================== LOGOUT ==================
    const logoutBtn = document.getElementById("logoutBtn");

    if (logoutBtn) {
        logoutBtn.addEventListener("click", function (e) {
            e.preventDefault();

            // ❌ Xóa toàn bộ session login
            sessionStorage.removeItem("token");
            sessionStorage.removeItem("me");
            sessionStorage.removeItem("userEmail");
            sessionStorage.removeItem("userId");

            // (Tuỳ chọn) gọi API logout
            fetch("http://localhost:8080/api/v1/auth/logout", {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            }).catch(() => { });

            // ✅ về trang login
            window.location.href = "login.html";
        });
    }


    // ================== MODE HELPERS ==================
    function setCreateModeUI() {
        currentId = null;

        // ẩn mã NV
        if (employeeIdGroup) employeeIdGroup.classList.add('d-none');
        employeeIdInput.value = '';
        employeeIdInput.disabled = true;

        // create: email nhập được
        employeeEmailInput.disabled = false;

        // create: chức vụ chọn được
        employeeRoleInput.disabled = false;

        // create: status auto ACTIVE + không cho chỉnh
        employeeStatusInput.value = 'Hoạt động';
        employeeStatusInput.disabled = true;

        // create: ẩn reset/delete
        resetBtn.classList.add('d-none');
        deleteBtn.classList.add('d-none');
    }

    function setEditModeUI() {
        // hiện mã NV
        if (employeeIdGroup) employeeIdGroup.classList.remove('d-none');

        // edit: disable id + email + chức vụ
        employeeIdInput.disabled = true;
        employeeEmailInput.disabled = true;
        employeeRoleInput.disabled = true;

        // edit: trạng thái cho phép đổi
        employeeStatusInput.disabled = false;

        // edit: hiện reset/delete
        resetBtn.classList.remove('d-none');
        deleteBtn.classList.remove('d-none');
    }

    // ================== LOAD TABLE ==================
    function loadEmployees() {
        if ($.fn.DataTable.isDataTable('#employeeTable')) {
            $('#employeeTable').DataTable().ajax.reload();
            return;
        }

        $('#employeeTable').DataTable({
            serverSide: true,
            processing: true,
            searching: true,
            autoWidth: false,
            scrollX: true,
            lengthChange: true,
            pageLength: 5,
            lengthMenu: [[5, 10, 25, 50], [5, 10, 25, 50]],
            order: [[0, 'desc']],
            columnDefs: [{ targets: 0, orderable: false, searchable: false }],
            ajax: function (data, callback) {
                const page = Math.floor(data.start / data.length);
                const size = data.length;
                const keyword = data.search.value || '';
                const url = `${API_URL}?page=${page}&size=${size}&keyword=${encodeURIComponent(keyword)}`;

                authFetch(url)
                    .then(res => res.json())
                    .then(json => {
                        callback({
                            recordsTotal: json.totalElements,
                            recordsFiltered: json.totalElements,
                            data: json.content
                        });
                    })
                    .catch(() => callback({ data: [] }));
            },
            columns: [
                { data: 'employeeId' },
                { data: 'fullName' },
                { data: 'email' },
                { data: 'roleName' },
                {
                    data: 'accountStatus',
                    render: s => (s === 'ACTIVE')
                        ? '<span class="badge bg-success">Hoạt động</span>'
                        : '<span class="badge bg-secondary">Khóa</span>'
                }
            ],
            language: {
                searchPlaceholder: "🔎Tìm kiếm nhân viên...",
                search: "",
                lengthMenu: "_MENU_ / dòng",
                info: "Hiển thị _START_–_END_ / _TOTAL_ nhân viên",
                zeroRecords: "Không tìm thấy dữ liệu",
                loadingRecords: "Đang tải...",
                paginate: { previous: "←", next: "→" }
            }
        });

        // click row -> open edit
        $('#employeeTable tbody').on('click', 'tr', function () {
            const rowData = $('#employeeTable').DataTable().row(this).data();
            if (!rowData) return;
            openEditModal(rowData.employeeId);
        });
    }

    // ================== OPEN EDIT MODAL ==================
    async function openEditModal(id) {
        setEditModeUI();

        const res = await authFetch(`${API_URL}/${id}`);
        const e = await res.json();
        currentId = e.employeeId;

        document.getElementById('employeeModalLabel').innerText = `Nhân viên #${e.employeeId}`;

        employeeIdInput.value = e.employeeId ?? '';
        employeeNameInput.value = e.fullName ?? '';
        employeeEmailInput.value = e.email ?? '';
        employeePhoneInput.value = e.phoneNumber ?? '';

        // LocalDate thường là "YYYY-MM-DD" (không có T)
        employeeDobInput.value = e.dateOfBirth ? String(e.dateOfBirth).split('T')[0] : '';

        // Gender enum: NAM / NU / KHAC
        employeeGenderInput.value =
            e.gender === 'NAM' ? 'NAM' :
                e.gender === 'NU' ? 'NU' :
                    'KHAC';

        // Role: set theo roleId để luôn đúng
        employeeRoleInput.value = (e.roleId != null) ? String(e.roleId) : '';

        // Status
        employeeStatusInput.value = (e.accountStatus === 'ACTIVE') ? 'Hoạt động' : 'Khóa';

        modal.show();
    }

    // ================== ADD (CREATE) ==================
    addBtn.onclick = () => {
        form.reset();
        document.getElementById('employeeModalLabel').innerText = 'Thêm nhân viên';
        setCreateModeUI();
        modal.show();
    };

    // ================== SAVE (CREATE/UPDATE) ==================
    form.addEventListener('submit', async (ev) => {
        ev.preventDefault();

        try {
            if (!employeeNameInput.value.trim()) {
                showAlert("Vui lòng nhập Tên nhân viên", "warning");
                return;
            }
            if (!currentId && !employeeEmailInput.value.trim()) {
                showAlert("Vui lòng nhập Email", "warning");
                return;
            }
            if (!employeeRoleInput.value) {
                showAlert("Vui lòng chọn Chức vụ", "warning");
                return;
            }

            const payloadCreate = {
                fullName: employeeNameInput.value.trim(),
                email: employeeEmailInput.value.trim(),
                phoneNumber: employeePhoneInput.value.trim(),
                dateOfBirth: employeeDobInput.value ? employeeDobInput.value : null,
                gender: employeeGenderInput.value,   // NAM/NU/KHAC
                roleId: Number(employeeRoleInput.value),
                status: 'ACTIVE' // auto
            };

            const payloadUpdate = {
                fullName: employeeNameInput.value.trim(),
                phoneNumber: employeePhoneInput.value.trim(),
                dateOfBirth: employeeDobInput.value ? employeeDobInput.value : null,
                gender: employeeGenderInput.value,
                status: (employeeStatusInput.value === 'Hoạt động' ? 'ACTIVE' : 'INACTIVE')
            };

            const method = currentId ? 'PUT' : 'POST';
            const url = currentId ? `${API_URL}/${currentId}` : API_URL;
            const body = currentId ? payloadUpdate : payloadCreate;

            await authFetch(url, { method, body: JSON.stringify(body) });

            modal.hide();
            $('#employeeTable').DataTable().ajax.reload();

            showAlert(currentId ? "Cập nhật nhân viên thành công" : "Tạo nhân viên thành công (đã gửi email mật khẩu)", "success");
        } catch (err) {
            showAlert(err.message, "danger");
        }
    });

    // ================== DELETE ==================
    deleteBtn.addEventListener('click', async () => {
        if (!currentId) return;
        if (!confirm('Xóa nhân viên này?')) return;

        try {
            await authFetch(`${API_URL}/${currentId}`, { method: 'DELETE' });
            modal.hide();
            $('#employeeTable').DataTable().ajax.reload();
            showAlert("Đã xóa (soft delete) nhân viên", "success");
        } catch (err) {
            showAlert(err.message, "danger");
        }
    });

    // ================== RESET PASSWORD ==================
    // PUT /api/v1/employees/{id}/reset-password
    resetBtn.addEventListener('click', async () => {
        if (!currentId) return;
        if (!confirm('Đặt lại mật khẩu cho nhân viên này?')) return;

        try {
            await authFetch(`${API_URL}/${currentId}/reset-password`, { method: 'PUT' });
            showAlert("Đã reset mật khẩu và gửi email cho nhân viên", "success");
        } catch (err) {
            showAlert(err.message, "danger");
        }
    });

    // ================== INIT ==================
    loadEmployees();
});

