document.addEventListener("DOMContentLoaded", function () {

    const API_URL = "http://localhost:8080/api/v1/users";

    let currentUser = null;
    let currentId = null;
    let selectedIds = new Set();

    const modalEl = document.getElementById("userDetailModal");
    const modal = new bootstrap.Modal(modalEl);
    const form = document.getElementById("editUserForm");
    const deleteBtn = document.getElementById("deleteUserBtn");
    const resetPassBtn = document.getElementById("reset_password");
    const modalTitle = document.getElementById("userDetailModalLabel");
    const selectAll = document.getElementById("selectAll");

    const bulkActionBar = document.getElementById("bulkActionBar");
    const deleteSelectedBtn = document.getElementById("deleteSelectedBtn");

    // ==========================================
    // ALERT GÓC PHẢI
    // ==========================================
    function showAlert(message, type = 'success') {
        const container = document.getElementById('alert-container');
        const icons = { success: 'bi-check-circle-fill', info: 'bi-info-circle-fill', warning: 'bi-exclamation-triangle-fill', danger: 'bi-x-circle-fill' };
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} bg-${type} text-light alert-dismissible fade show mb-2`;
        alert.innerHTML = `<i class="bi ${icons[type]} me-2"></i>${message}
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert"></button>`;
        container.appendChild(alert);
        setTimeout(() => alert.remove(), 3000);
    }

    // Cập nhật thanh hành động hàng loạt
    function toggleBulkBar() {
        // countEl.textContent = selectedIds.size; // Đã thêm span#selectedCount vào HTML
        bulkActionBar.classList.toggle('d-none', selectedIds.size === 0);
    }


    function highlightRow(cb, checked) {
        const tr = cb.closest('tr');
        if (checked) tr.classList.add('table-active');
        else tr.classList.remove('table-active');
    }

    // ==========================================
    // LOAD USERS DATATABLE
    // ==========================================
    function loadUsers() {

        if ($.fn.DataTable.isDataTable(".datatable")) {
            $(".datatable").DataTable().ajax.reload(attachCheckboxEvents, false);
            return;
        }

        $(".datatable").DataTable({
            serverSide: true,
            processing: true,
            searching: true,
            autoWidth: false,
            scrollX: true,
            lengthChange: true,
            pageLength: 5,
            lengthMenu: [[5, 10, 25, 50], [5, 10, 25, 50]],
            order: [[1, 'desc']],
            columnDefs: [
                { targets: 0, orderable: false, searchable: false }],
            ajax: function (data, callback) {
                const page = Math.floor(data.start / data.length);
                const size = data.length;
                const search = data.search.value;
                const sortIndex = data.order[0].column;
                const sortDir = data.order[0].dir;

                const columnMap = ["id", "userId", "fullname", "email", "userRank", "status"];
                const sortColumn = columnMap[sortIndex] || "userId";

                const url = `${API_URL}?page=${page}&size=${size}&sort=${sortColumn},${sortDir}&keyword=${search}`;

                fetch(url)
                    .then(r => r.json())
                    .then(json => {
                        callback({
                            recordsTotal: json.totalElements,
                            recordsFiltered: json.totalElements,
                            data: json.content
                        });
                    });
            },
            columnDefs: [
                { targets: 0, orderable: false }
            ],
            columns: [
                {
                    data: null,
                    render: row => `<input type="checkbox" class="user-row-checkbox" data-id="${row.userId}">`
                },
                { data: "userId" },
                { data: "fullname" },
                {
                    data: row => `${row.email}<br>${row.phoneNumber}`
                },
                {
                    data: "userRank",
                    render: r => `<span class="vip-badge vip-${r.toLowerCase()}">${r}</span>`
                },
                {
                    data: "status",
                    render: s => s === "ACTIVE"
                        ? `<span class="badge bg-success">Hoạt động</span>`
                        : `<span class="badge bg-danger">Khóa</span>`
                }
            ],
            language: {
                searchPlaceholder: "🔎 Tìm kiếm...",
                search: "",
                lengthMenu: "_MENU_ / dòng",
                info: "Hiển thị _START_–_END_ trong tổng _TOTAL_ danh mục",
                infoEmpty: "Không có dữ liệu",
                infoFiltered: "(lọc từ _MAX_ bản ghi)",
                zeroRecords: "Không tìm thấy kết quả phù hợp",
                loadingRecords: "Đang tải dữ liệu...",
                emptyTable: "Không có dữ liệu",
                paginate: {
                    previous: "←",
                    next: "→"
                }
            }
        });

        $(".datatable").on("draw.dt", attachCheckboxEvents);
    }

    // ==========================================
    // CHECKBOX CHỌN NHIỀU
    // ==========================================
    function attachCheckboxEvents() {
        if (selectAll) selectAll.checked = false;
        const rowCheckboxes = document.querySelectorAll(".user-row-checkbox");
        // --- A. Chọn tất cả ---
        if (selectAll) {
            selectAll.onchange = e => {
                const checked = e.target.checked;
                selectedIds.clear(); // Xóa tất cả trước khi thêm mới
                rowCheckboxes.forEach(cb => {
                    cb.checked = checked;
                    const id = cb.dataset.id;
                    if (checked) selectedIds.add(id);
                    highlightRow(cb, checked);
                });
                toggleBulkBar();
            };
        }

        // --- B. Chọn từng dòng ---
        rowCheckboxes.forEach(cb => {
            const id = cb.dataset.id;
            cb.checked = selectedIds.has(id);
            highlightRow(cb, selectedIds.has(id));
            cb.onchange = e => {
                const checked = e.target.checked;
                if (checked) selectedIds.add(id);
                else selectedIds.delete(id);

                highlightRow(cb, checked);
                toggleBulkBar();

                // Nếu bỏ chọn 1 dòng => bỏ check "Chọn tất cả"
                if (!checked && selectAll) {
                    selectAll.checked = false;
                }
                // Nếu tất cả dòng được chọn => check "Chọn tất cả"
                else if (checked && selectAll) {
                    const allChecked = Array.from(rowCheckboxes).every(cb => cb.checked);
                    selectAll.checked = allChecked;
                }
            }
        });
    }


    // ==========================================
    // HIỆN MODAL USER
    // ==========================================
    async function showModalForEdit(id) {
        const res = await fetch(`${API_URL}/${id}`);
        const user = await res.json();

        currentUser = user;
        currentId = id;

        modalTitle.textContent = `Thông tin khách hàng #${id}`;
        document.getElementById("userIdInput").value = user.userId;
        document.getElementById("userNameInput").value = user.fullname;
        document.getElementById("userEmailInput").value = user.email;
        document.getElementById("userPhoneInput").value = user.phoneNumber;
        document.getElementById("userVipInput").value = user.userRank;
        document.getElementById("userStatusInput").value =
            user.status === "ACTIVE" ? "Hoạt động" : "Khóa";

        modal.show();
    }

    $(".datatable tbody").on("click", "tr", function (e) {
        if ($(e.target).is("input[type=checkbox]")) return;

        const table = $(".datatable").DataTable();
        const row = table.row(this).data();
        if (row) showModalForEdit(row.userId);
    });

    // ==========================================
    // UPDATE USER (send full DTO)
    // ==========================================
    form.addEventListener("submit", async function (e) {
        e.preventDefault();

        const newStatus =
            document.getElementById("userStatusInput").value === "Hoạt động"
                ? "ACTIVE"
                : "INACTIVE";

        const body = {
            userId: currentUser.userId,
            username: currentUser.username,
            fullname: currentUser.fullname,
            dateOfBirth: currentUser.dateOfBirth,
            phoneNumber: currentUser.phoneNumber,
            email: currentUser.email,
            userRank: currentUser.userRank,
            status: newStatus,
            accountId: currentUser.accountId
        };

        const res = await fetch(`${API_URL}/${currentId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        modal.hide(); // 🔥 đóng modal
        if (res.ok) {
            showAlert("Cập nhật khách hàng thành công!", "success ");
            loadUsers();
        } else {
            showAlert("Cập nhật thất bại!", "danger");
        }
    });

    // ==========================================
    // RESET PASSWORD
    // ==========================================
    resetPassBtn.addEventListener("click", async function () {
        const res = await fetch(`${API_URL}/${currentId}/reset-password`, { method: "PUT" });

        modal.hide(); // 🔥 đóng modal
        const text = await res.text();
        showAlert("Đặt lại mật khẩu thành công", "success ");

    });

    // ==========================================
    // DELETE USER
    // ==========================================
    deleteBtn.addEventListener("click", async function () {
        if (!confirm("Bạn chắc chắn muốn xóa khách hàng này?")) return;

        const res = await fetch(`${API_URL}/${currentId}`, { method: "DELETE" });

        modal.hide(); // 🔥 đóng modal
        if (res.ok) {
            showAlert("Xóa thành công!", "success");
            loadUsers();
        }
    });

    // ==========================================
    // DELETE MULTIPLE USERS
    // ==========================================
    deleteSelectedBtn.addEventListener('click', async () => {
        if (selectedIds.size === 0) return;

        if (!confirm(`Bạn có chắc muốn xóa ${selectedIds.size} người dùng đã chọn?`)) return;

        try {
            const response = await fetch(`${API_URL}/bulk-delete`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([...selectedIds])
            });

            const data = await response.json().catch(() => ({ message: "Không đọc được phản hồi từ server!" }));

            if (response.ok) {
                showAlert(data.message || 'Xóa thành công!', 'success');

                // Reset danh sách chọn
                selectedIds.clear();
                toggleBulkBar();

                await loadUsers();

            } else {
                showAlert(data.message || 'Xóa thất bại!', 'danger');
            }

        } catch (err) {
            console.error('Lỗi xóa người dùng:', err);
            showAlert('Không thể kết nối đến máy chủ!', 'danger');
        }
    });

    // ==========================================
    // RUN
    // ==========================================
    loadUsers();

});

