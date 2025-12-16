document.addEventListener("DOMContentLoaded", function () {

    const API_URL = "http://localhost:8080/api/v1/promotions";
    const CATE_URL = "http://localhost:8080/api/v1/categories/all";

    // Modal + Form
    const deleteSelectedBtn = document.getElementById("deleteSelectedBtn");

    const modalEl = document.getElementById('promotionModal');
    const modal = new bootstrap.Modal(modalEl);
    const form = document.getElementById('promotionForm');
    const modalTitle = document.getElementById('promotionModalLabel');
    const modalDescription = modalEl.querySelector('p.text-muted');
    const deleteBtn = document.getElementById('deleteBtn');
    // Cấu hình Toolbar đầy đủ cho Quill Editor
    const toolbarOptions = [
        [{ 'font': [] }],
        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        ['blockquote', 'code-block'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        [{ 'script': 'sub' }, { 'script': 'super' }],
        [{ 'indent': '-1' }, { 'indent': '+1' }],
        [{ 'direction': 'rtl' }],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'align': [] }],
        ['link', 'image', 'video'],
        ['clean']
    ];

    const quill = new Quill('#quillEditor', {
        modules: {
            toolbar: toolbarOptions
        },
        theme: 'snow'
    });
    function toggleBulkBar() {
        bulkBar.classList.toggle('d-none', selectedIds.size === 0);
    }
    function authFetch(url, options = {}) {
        const token = sessionStorage.getItem("token");

        // Nếu không có token → đẩy về login
        if (!token) {
            window.location.href = "login.html";
            return Promise.reject("Không có token. Chuyển về trang đăng nhập.");
        }

        const isFormData = options.body instanceof FormData;

        // Thêm Authorization Header
        options.headers = {
            ...options.headers,
            "Authorization": "Bearer " + token,
            ...(isFormData ? {} : { "Content-Type": "application/json" })
        };


        return fetch(url, options)
            .then(response => {

                // Nếu bị chặn 403 → token hết hạn hoặc sai → logout & về login
                if (response.status === 403 || response.status === 401) {
                    sessionStorage.clear(); // xoá token cũ
                    alert("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
                    window.location.href = "login.html";
                    return Promise.reject("403 Forbidden - Redirect to login");
                }

                return response;
            })
            .catch(err => {
                console.error("authFetch Error:", err);
                throw err;
            });
    }


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


    function highlightRow(cb, checked) {
        const tr = cb.closest('tr');
        if (checked) tr.classList.add('table-active');
        else tr.classList.remove('table-active');
    }
    function attachCheckboxEvents() {
        const rowCheckboxes = document.querySelectorAll('#promotionTable .row-checkbox');

        rowCheckboxes.forEach(cb => {
            highlightRow(cb, cb.checked);

            cb.addEventListener("change", () => {
                const id = cb.dataset.id;

                if (cb.checked) selectedIds.add(id);
                else selectedIds.delete(id);

                highlightRow(cb, cb.checked);
                toggleBulkBar();

                // cập nhật selectAll
                const allChecked = [...document.querySelectorAll('#promotionTable .row-checkbox')]
                    .every(x => x.checked);
                selectAll.checked = allChecked;
            });
        });

        // selectAll checkbox
        selectAll.addEventListener("change", () => {
            const checked = selectAll.checked;
            selectedIds.clear();

            rowCheckboxes.forEach(cb => {
                cb.checked = checked;
                const id = cb.dataset.id;
                if (checked) selectedIds.add(id);
                highlightRow(cb, checked);
            });

            toggleBulkBar();
        });

        toggleBulkBar();
    }

    let categoryMap = new Map();

    // ==========================
    // LOAD CATEGORY
    // ==========================
    async function loadCategories() {
        const select = document.getElementById("promoType");
        select.innerHTML = '<option value="">-- Chọn loại --</option>';

        try {
            const res = await authFetch(CATE_URL);
            if (!res.ok) throw new Error('Không thể tải danh mục');

            const categories = await res.json();

            categories.forEach(c => {
                const opt = document.createElement("option");
                opt.value = c.id;           // ⭐ GIÁ TRỊ PHẢI ĐÚNG
                opt.textContent = c.categoryName;   // ⭐ TÊN PHẢI ĐÚNG
                select.appendChild(opt);
            });

        } catch (err) {
            console.error(err);
        }
    }

    // ==========================
    // RESET MODAL (ADD)
    // ==========================
    async function resetModal() {
        modalTitle.textContent = "Thêm khuyến mãi mới";
        form.reset();
        quill.setText('');
        setupPromoInputs();
        setupDateValidation();

        deleteBtn.style.display = "none";
        modalDescription.style.display = "block";

        // Load dropdown trước
        await loadCategories();
    }

    document.querySelector('[data-bs-target="#promotionModal"]').addEventListener('click', resetModal);
    modalEl.addEventListener("hidden.bs.modal", resetModal);

    // ==========================
    // DATATABLE
    // ==========================
    const selectedIds = new Set();
    const selectAll = document.getElementById("selectAll");
    const bulkBar = document.getElementById("bulkActionBar");


    const table = $("#promotionTable").DataTable({
        serverSide: true,
        processing: true,
        searching: true,
        autoWidth: false,
        scrollX: true,
        lengthChange: true,
        pageLength: 5,
        lengthMenu: [[5, 10, 25, 50], [5, 10, 25, 50]],
        order: [[1, 'desc']],
        columnDefs: [{ targets: 0, orderable: false, searchable: false }],

        ajax: function (data, callback) {
            const page = Math.floor(data.start / data.length);
            const size = data.length;
            const keyword = data.search.value || '';
            const orderCol = data.order[0].column;
            const orderDir = data.order[0].dir;

            const colMap = ["", "promotionId", "title", "percentDecrease", "startDate", "endDate", "status"];
            const sortCol = colMap[orderCol] || "promotionId";

            authFetch(`${API_URL}?page=${page}&size=${size}&sort=${sortCol},${orderDir}&keyword=${keyword}`)
                .then(res => res.json())
                .then(json => {
                    callback({
                        recordsTotal: json.totalElements,
                        recordsFiltered: json.totalElements,
                        data: json.content
                    });
                });
        },

        columns: [
            {
                data: null,
                render: r => `<input type="checkbox" class="row-checkbox" data-id="${r.promotionId}">`
            },
            { data: "promotionId" },
            { data: "title" },
            { data: "percentDecrease", render: d => d + "%" },
            { data: "startDate" },
            { data: "endDate" },
            {
                data: null,
                render: r => {
                    const now = new Date();
                    const end = r.endDate ? new Date(r.endDate) : null;

                    if (end === null) {
                        return `<span class="badge bg-success">Còn hạn</span>`;
                    }

                    // Nếu có endDate → kiểm tra còn hạn hay hết hạn
                    return end >= now
                        ? `<span class="badge bg-success">Còn hạn</span>`
                        : `<span class="badge bg-danger">Hết hạn</span>`;
                }
            }
        ],
        language: {
            searchPlaceholder: "🔎 Tìm kiếm nội dung...",
            search: "",
            lengthMenu: "_MENU_ / dòng",
            info: "Hiển thị _START_–_END_ / _TOTAL_ nội dung",
            zeroRecords: "Không tìm thấy dữ liệu",
            loadingRecords: "Đang tải...",
            paginate: { previous: "←", next: "→" }
        }
    });
    $('#promotionTable').on('draw.dt', function () {
        attachCheckboxEvents();
    });
    // ====== ALERT ======


    // ==========================
    // CLICK ROW → OPEN MODAL EDIT
    // ==========================
    $("#promotionTable tbody").on("click", "tr", async function (e) {
        if ($(e.target).is("input")) return;

        const promo = table.row(this).data();
        if (!promo) return;

        modalTitle.textContent = `Chi tiết khuyến mãi ${promo.promotionId}`;
        deleteBtn.style.display = "block";
        modalDescription.style.display = "none";

        // 1 Load category trước khi fill dữ liệu
        await loadCategories();

        // 2 Fill form
        document.getElementById("promoName").value = promo.title;
        document.getElementById("promoValue").value = promo.percentDecrease;
        document.getElementById("promoStartDate").value = promo.startDate;
        document.getElementById("promoEndDate").value = promo.endDate;
        document.getElementById("promoType").value = promo.categoryId ?? "";
        document.getElementById("promoCode").value = promo.code || "";

        quill.root.innerHTML = promo.description || "";
        setupPromoInputs();
        setupDateValidation();
        modal.show();
    });
    function showAlert(msg, type = 'success') {
        const icons = {
            success: 'bi-check-circle-fill',
            danger: 'bi-x-circle-fill',
            warning: 'bi-exclamation-triangle-fill',
            info: 'bi-info-circle-fill'
        };
        const div = document.createElement('div');
        div.className = `alert alert-${type} bg-${type} text-light alert-dismissible fade show mb-2`;
        div.innerHTML = `<i class="bi ${icons[type]} me-2"></i>${msg}
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert"></button>`;
        document.getElementById('alert-container').appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }
    // ==========================
    // SAVE (POST / PUT)
    // ==========================
    form.addEventListener("submit", async function (e) {
        e.preventDefault();

        const idText = modalTitle.textContent.replace("Chi tiết khuyến mãi ", "").trim();
        const isEdit = !isNaN(idText);
        const typeValue = document.getElementById("promoType").value;

        const data = {
            title: document.getElementById("promoName").value,
            code: document.getElementById("promoCode").value,
            categoryId: typeValue ? Number(typeValue) : null,
            percentDecrease: document.getElementById("promoValue").value,
            startDate: document.getElementById("promoStartDate").value,
            endDate: document.getElementById("promoEndDate").value,
            description: quill.root.innerHTML
        };

        const res = await authFetch(isEdit ? `${API_URL}/${idText}` : API_URL, {
            method: isEdit ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            showAlert(`Lưu khuyến mãi thành công!`, "success");
            modal.hide();

            selectedIds.clear();
            selectAll.checked = false;
            bulkBar.classList.add("d-none");
            table.ajax.reload();   // reload bảng

        } else {
            const err = await res.json();
            showAlert(err.error || "Không thể lưu mã khuyến mãi!", "danger");
        }
    });

    // ==========================
    // DELETE ONE
    // ==========================
    deleteBtn.addEventListener("click", async function () {
        const id = modalTitle.textContent.replace("Chi tiết khuyến mãi ", "").trim();

        if (!confirm("Bạn chắc chắn muốn xoá?")) return;

        const res = await authFetch(`${API_URL}/${id}`, { method: "DELETE" });

        if (res.ok) {
            showAlert("Xóa khuyến mãi thành công!", "success");
            modal.hide();

            selectedIds.clear();
            selectAll.checked = false;
            bulkBar.classList.add("d-none");

            table.ajax.reload();   // reload bảng
        } else {
            showAlert("Không thể xóa khuyến mãi!", "danger");
        }

    });
    // ========================
    // DELETE MULTIPLE (ĐÚNG)
    // ========================
    deleteSelectedBtn.addEventListener("click", async function () {
        if (selectedIds.size === 0) {
            showAlert("Bạn chưa chọn khuyến mãi nào!", "warning");
            return;
        }

        if (!confirm(`Bạn có chắc muốn xóa ${selectedIds.size} khuyến mãi?`)) {

            return;
        }

        try {
            const res = await authFetch(`${API_URL}/bulk-delete`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify([...selectedIds])  // Set → Array
            });

            if (!res.ok) {
                const err = await res.json();
                showAlert(err.error || "Không thể xóa khuyến mãi đã chọn!", "danger");
                return;
            }

            showAlert("Xóa khuyến mãi thành công!", "success");

            // Reset giao diện
            selectedIds.clear();
            selectAll.checked = false;
            bulkBar.classList.add("d-none");

            table.ajax.reload();   // reload bảng

        } catch (ex) {
            console.error(ex);
            showAlert("Có lỗi xảy ra khi xóa!", "danger");
        }
    });

    function setupPromoInputs() {
        const nameInput = document.getElementById("promoName");
        const nameCount = document.getElementById("titleCount");

        const codeInput = document.getElementById("promoCode");
        const codeCount = document.getElementById("codeCount");

        const MAX = 255;

        // ===============================
        // XỬ LÝ INPUT TÊN CHƯƠNG TRÌNH
        // ===============================
        function bindInput(input, counter, fieldName) {

            counter.innerText = `${input.value.length} / ${MAX}`;

            input.oninput = function () {
                let text = input.value;

                text = text.replace(/^\s+/, "");

                if (text.length > MAX) {
                    text = text.substring(0, MAX);
                    showAlert(`${fieldName} tối đa ${MAX} ký tự`, "warning");
                }

                input.value = text;
                counter.innerText = `${text.length} / ${MAX}`;
            };

            input.onblur = function () {
                input.value = input.value.trim();
                counter.innerText = `${input.value.length} / ${MAX}`;
            };
        }

        bindInput(nameInput, nameCount, "Tên chương trình");


        // ===============================
        // XỬ LÝ INPUT MÃ KHUYẾN MÃI
        // ===============================

        const controlKeys = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"];

        // 1️⃣ CHẶN NHẬP KÝ TỰ ĐẶC BIỆT
        codeInput.onkeydown = function (e) {
            if (controlKeys.includes(e.key)) return;

            const allow = /^[A-Za-z0-9]$/;

            if (!allow.test(e.key)) {
                e.preventDefault();
                // showAlert("Mã khuyến mãi chỉ được nhập chữ và số!", "warning");
            }
        };

        // 2️⃣ CHẶN PASTE KÝ TỰ ĐẶC BIỆT
        codeInput.onpaste = function (e) {
            const pasted = (e.clipboardData || window.clipboardData).getData("text");

            if (/[^A-Za-z0-9]/.test(pasted)) {
                e.preventDefault();
                showAlert("Không thể dán ký tự đặc biệt vào mã khuyến mãi!", "danger");
            }
        };

        // 3️⃣ TỰ ĐỘNG VIẾT IN HOA + GIỚI HẠN 255
        codeInput.oninput = function () {
            let text = codeInput.value.toUpperCase();

            if (text.length > MAX) {
                text = text.substring(0, MAX);
                showAlert("Mã khuyến mãi tối đa 255 ký tự!", "warning");
            }

            codeInput.value = text;
            codeCount.innerText = `${text.length} / ${MAX}`;
        };

        // 4️⃣ TRIM KHI RỜI Ô INPUT
        codeInput.onblur = function () {
            codeInput.value = codeInput.value.trim().toUpperCase();
            codeCount.innerText = `${codeInput.value.length} / ${MAX}`;
        };
    }

    function setupDateValidation() {
        const startInput = document.getElementById("promoStartDate");
        const endInput = document.getElementById("promoEndDate");

        // --- 1. Không cho chọn ngày quá khứ: startDate >= ngày mai ---
        const today = new Date();
        today.setDate(today.getDate() + 1);  // ngày mai

        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const dd = String(today.getDate()).padStart(2, "0");

        const minStart = `${yyyy}-${mm}-${dd}`;
        startInput.min = minStart;

        startInput.addEventListener("change", function () {
            const startValue = startInput.value;

            if (!startValue) return;

            endInput.min = startValue;

            // Nếu end < start thì reset
            if (endInput.value && endInput.value < startValue) {
                endInput.value = "";
                showAlert("Ngày kết thúc phải lớn hơn ngày bắt đầu!", "warning");
            }
        });

        // --- 2. Ngày kết thúc phải > ngày bắt đầu ---
        endInput.addEventListener("change", function () {
            const startValue = startInput.value;
            const endValue = endInput.value;

            if (startValue && endValue < startValue) {
                endInput.value = "";
                showAlert("Ngày kết thúc phải sau ngày bắt đầu!", "warning");
            }
        });
    }

});
