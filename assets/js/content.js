
document.addEventListener('DOMContentLoaded', function () {

    // ====== CẤU HÌNH API ======
    const API_URL = 'http://localhost:8080/api/v1/contents';
    const EMPLOYEE_API = 'http://localhost:8080/api/v1/employees';
    let selectedIds = new Set();
    let currentId = null;
    let currentEmployee = null;
    let currentImageUrl = null;

    // ====== DOM ELEMENTS ======
    const form = document.getElementById('contentForm');
    const modalEl = document.getElementById('contentModal');
    const modal = new bootstrap.Modal(modalEl);
    const deleteBtn = document.getElementById('deleteBtn');
    const addBtn = document.querySelector('[data-bs-target="#contentModal"]');
    const selectAll = document.getElementById('selectAll');
    const bulkBar = document.getElementById('bulkActionBar');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    const imageInput = document.getElementById('contentImage');
    const previewImg = document.getElementById('imagePreview');
    const uploadContainer = document.getElementById('uploadContainer');
    const previewContainer = document.getElementById('imagePreviewContainer');
    const changeImageBtn = document.getElementById('changeImageBtn');
    const detailContentInput = document.getElementById('detailContent');
    // [MỚI] Cấu hình Toolbar đầy đủ cho Quill Editor
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
        theme: 'snow',
        placeholder: 'Soạn thảo nội dung chi tiết tại đây...'
    });
    function authFetch(url, options = {}) {
        const token = sessionStorage.getItem("token");

        // Nếu không có token → đẩy về login
        if (!token) {
            window.location.href = "login.html";
            return Promise.reject("Không có token. Chuyển về trang đăng nhập.");
        }

        // Thêm Authorization Header
        options.headers = {
            ...options.headers,
            "Authorization": "Bearer " + token,
            "Content-Type": options.headers?.["Content-Type"] || "application/json"
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
    // ====== ALERT ======
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

    // ====== PREVIEW ẢNH ======
    function setupImagePreview(file, initialUrl = null) {
        if (file) {
            previewImg.src = URL.createObjectURL(file);
            previewContainer.style.display = 'block';
            uploadContainer.style.display = 'none';
        } else if (initialUrl) {
            previewImg.src = initialUrl;
            previewContainer.style.display = 'block';
            uploadContainer.style.display = 'none';
        } else {
            previewContainer.style.display = 'none';
            uploadContainer.style.display = 'block';
        }
    }

    imageInput.addEventListener('change', e => setupImagePreview(e.target.files[0]));
    changeImageBtn.addEventListener('click', () => imageInput.click());

    // ====== RESET MODAL ======
    function resetModal() {
        currentId = null;
        currentImageUrl = null;
        form.reset();
        setupImagePreview(null);
        quill.setText('');
        deleteBtn.style.display = 'none';
        document.getElementById('contentModalLabel').textContent = 'Thêm nội dung mới';

        //  Mặc định trạng thái = Nháp (1) và disable
        const statusSelect = document.getElementById('contentStatus');
        statusSelect.value = "1"; // Nháp
        statusSelect.disabled = true;

        if (currentEmployee)
            document.getElementById('authorName').value = currentEmployee.fullName;
        // Reset tiêu đề và counter
        document.getElementById("contentTitle").value = "";
        document.getElementById("titleCount").innerText = "0 / 255";

        // Gắn lại handler
        applyContentTitleHandler();

    }


    addBtn.addEventListener('click', resetModal);
    modalEl.addEventListener('hidden.bs.modal', resetModal);

    // ====== LOAD NHÂN VIÊN HIỆN TẠI ======
    async function loadCurrentEmployee() {
        try {
            const res = await authFetch(`${EMPLOYEE_API}/1`);
            if (!res.ok) throw new Error('Không thể tải thông tin nhân viên');
            currentEmployee = await res.json();
            document.getElementById('authorName').value = currentEmployee.fullName;
        } catch (err) {
            console.error('Lỗi lấy nhân viên:', err);
            document.getElementById('authorName').value = 'Không xác định';
        }
    }
    loadCurrentEmployee();

    // ====== LOAD DANH SÁCH NỘI DUNG ======
    function loadContents() {
        if ($.fn.DataTable.isDataTable('#contentTable')) {
            $('#contentTable').DataTable().ajax.reload();
            return;
        }

        $('#contentTable').DataTable({
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
                const sortColIndex = data.order[0]?.column;
                const columnMap = ['checkbox', 'contentId', 'title', 'imageUrl', 'createAt', 'status'];
                const sortCol = columnMap[sortColIndex] || 'contentId';
                const sortDir = data.order[0]?.dir || 'desc';
                const url = `${API_URL}?page=${page}&size=${size}&sort=${sortCol},${sortDir}&keyword=${encodeURIComponent(keyword)}`;

                authFetch(url)
                    .then(res => res.json())
                    .then(json => {
                        callback({
                            recordsTotal: json.totalElements || 0,
                            recordsFiltered: json.totalElements || 0,
                            data: json.content || []
                        });
                    })
                    .catch(err => {
                        showAlert('Lỗi tải dữ liệu: ' + err.message, 'danger');
                        callback({ data: [] });
                    });
            },
            columns: [
                { data: null, render: r => `<input type="checkbox" class="row-checkbox" data-id="${r.contentId}">`, orderable: false },
                { data: 'contentId', title: 'Mã nội dung' },
                { data: 'title', title: 'Tiêu đề' },
                {
                    data: 'imageUrl',
                    title: 'Ảnh',
                    render: url => url
                        ? `<img src="${url}" class="rounded" style="height:50px;width:70px;object-fit:cover;">`
                        : `<img src="assets/img/no-image.png" style="height:50px;width:70px;">`
                },
                { data: 'createAt', title: 'Ngày tạo', render: d => d ? new Date(d).toLocaleDateString('vi-VN') : '-' },
                {

                    data: 'status',
                    title: 'Trạng thái',
                    render: s => {
                        switch (s) {
                            case 0:
                                return '<span class="badge bg-success">Đã xuất bản</span>';
                            case 1:
                                return '<span class="badge bg-warning text-dark">Nháp</span>';
                            case 2:
                                return '<span class="badge bg-secondary">Ẩn</span>';
                            default:
                                return '<span class="badge bg-light text-muted">Không xác định</span>';
                        }
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

        $('#contentTable').on('draw.dt', function () {
            attachCheckboxEvents();
        });
        // Click từng dòng
        $('#contentTable tbody').on('click', 'tr', async function (e) {
            if ($(e.target).is('input[type="checkbox"]')) return;
            const data = $('#contentTable').DataTable().row(this).data();
            if (!data) return;
            const full = await getContentById(data.contentId);
            if (full) openEditModal(full);
        });
    }
    loadContents();

    // ====== CHECKBOX & BULK DELETE ======
    function toggleBulkBar() {
        bulkBar.classList.toggle('d-none', selectedIds.size === 0);
    }
    function highlightRow(cb, checked) {
        const tr = cb.closest('tr');
        if (checked) tr.classList.add('table-active');
        else tr.classList.remove('table-active');
    }
    function attachCheckboxEvents() {
        const rowCheckboxes = document.querySelectorAll('#contentTable .row-checkbox');

        // Highlight lại theo các checkbox hiện đang checked
        rowCheckboxes.forEach(cb => {
            highlightRow(cb, cb.checked);
        });

        // Sự kiện của selectAll
        if (selectAll) {
            selectAll.onchange = e => {
                const checked = e.target.checked;
                selectedIds.clear();

                rowCheckboxes.forEach(cb => {
                    cb.checked = checked;
                    const id = cb.dataset.id;
                    if (checked) selectedIds.add(id);
                    highlightRow(cb, checked);
                });
                toggleBulkBar();
            };
        }

        // Sự kiện cho từng checkbox
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
                if (!checked && selectAll) selectAll.checked = false;
                const allChecked = [...document.querySelectorAll('#contentTable .row-checkbox')]
                    .every(cb => cb.checked);
                selectAll.checked = allChecked;
            };
        });
        toggleBulkBar();

    }


    deleteSelectedBtn?.addEventListener('click', async () => {
        if (selectedIds.size === 0) {
            showAlert('Chưa chọn nội dung nào để xóa!', 'warning');
            return;
        }
        if (!confirm(`Xóa ${selectedIds.size} nội dung đã chọn?`)) return;

        try {
            const res = await authFetch(`${API_URL}/bulk-delete`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([...selectedIds])
            });
            if (!res.ok) throw new Error('Xóa nhiều thất bại');
            showAlert(`Đã xóa ${selectedIds.size} nội dung`, 'danger');
            selectedIds.clear();
            $('#contentTable').DataTable().ajax.reload();
            toggleBulkBar();
        } catch (err) {
            showAlert('Lỗi: ' + err.message, 'danger');
        }
    });

    // ====== API CRUD ======
    async function getContentById(id) {
        const res = await authFetch(`${API_URL}/${id}`);
        if (!res.ok) throw new Error('Không tìm thấy nội dung');
        return res.json();
    }

    async function uploadImage(file) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await authFetch(`${API_URL}/upload`, { method: 'POST', body: fd });
        if (!res.ok) throw new Error('Upload ảnh thất bại');
        return res.json();
    }

    async function saveContent(content, id = null) {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_URL}/${id}` : API_URL;
        const res = await authFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(content)
        });
        if (!res.ok) throw new Error(`Lỗi ${id ? 'cập nhật' : 'tạo mới'}`);
        return res.json();
    }

    async function deleteContent(id) {
        const res = await authFetch(`${API_URL}/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Không thể xóa nội dung');
        return true;
    }

    // ====== MỞ MODAL EDIT ======
    function openEditModal(data) {
        currentId = data.contentId;
        currentImageUrl = data.imageUrl;
        document.getElementById('contentModalLabel').textContent = `Chỉnh sửa nội dung #${data.contentId}`;
        deleteBtn.style.display = 'block';
        form.title.value = data.title;
        form.status.value = data.status;

        //  Cho phép chỉnh lại trạng thái khi sửa
        document.getElementById('contentStatus').disabled = false;

        quill.root.innerHTML = data.content || '';
        setupImagePreview(null, data.imageUrl);
        // Hiển thị lại số ký tự tiêu đề khi edit
        const counter = document.getElementById("titleCount");
        if (counter && data.title) {
            counter.innerText = `${data.title.length} / 255`;
        }

        applyContentTitleHandler();

        modal.show();
    }


    // ====== SUBMIT FORM ======
    form.addEventListener('submit', async e => {
        e.preventDefault();
        detailContentInput.value = quill.root.innerHTML.trim();
        if (quill.getText().trim().length === 0) {
            showAlert('Vui lòng nhập nội dung chi tiết!', 'warning');
            return;
        }
        // Nếu chưa có ảnh mới và cũng không có ảnh cũ (currentImageUrl) => báo lỗi
        if (!currentImageUrl && !imageInput.files[0]) {
            showAlert('Vui lòng chọn ảnh đại diện!', 'warning');
            return;
        }

        let imageUrl = currentImageUrl;
        const file = imageInput.files[0];
        if (file) {
            showAlert('Đang upload ảnh...', 'info');
            const uploadRes = await uploadImage(file);
            imageUrl = uploadRes.url;
        }

        const payload = {
            title: form.title.value,
            content: detailContentInput.value,
            status: parseInt(form.status.value),
            imageUrl: imageUrl,
            employeeId: currentEmployee ? currentEmployee.employeeId : 1
        };
        if (currentId && payload.status === 0) {
            payload.publishedAt = new Date().toISOString(); // gửi dạng ISO cho backend
        }


        await saveContent(payload, currentId);
        showAlert(currentId ? 'Cập nhật thành công' : 'Thêm mới thành công');
        modal.hide();
        $('#contentTable').DataTable().ajax.reload();
    });

    // ====== XÓA ======
    deleteBtn.addEventListener('click', async () => {
        if (!currentId) return;
        if (!confirm('Bạn có chắc muốn xóa nội dung này?')) return;
        await deleteContent(currentId);
        showAlert('Đã xóa nội dung thành công', 'danger');
        modal.hide();
        $('#contentTable').DataTable().ajax.reload();
    });
    // ====== HÀM GIỚI HẠN TIÊU ĐỀ (Tối đa 255 ký tự + tự trim + counter) ======
    function applyContentTitleHandler() {
        const input = document.getElementById("contentTitle");
        const counter = document.getElementById("titleCount");
        const MAX = 255;

        if (!input || !counter) return;

        // Reset counter theo giá trị hiện tại
        counter.innerText = `${input.value.length} / ${MAX}`;

        // Xóa sự kiện cũ (tránh bị add nhiều lần khi mở modal)
        input.oninput = null;
        input.onblur = null;

        // Xử lý khi nhập
        input.oninput = function () {
            let value = input.value;

            value = value.replace(/^\s+/, ""); // Trim đầu

            if (value.length > MAX) {
                value = value.substring(0, MAX);
                showAlert(`Tiêu đề chỉ tối đa ${MAX} ký tự`, "warning");
            }

            input.value = value;
            counter.innerText = `${value.length} / ${MAX}`;
        };

        // Khi blur: trim cuối + update count
        input.onblur = function () {
            input.value = input.value.trim();
            counter.innerText = `${input.value.length} / ${MAX}`;
        };
    }


});
