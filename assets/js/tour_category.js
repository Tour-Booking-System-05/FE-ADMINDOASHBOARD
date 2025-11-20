document.addEventListener('DOMContentLoaded', function () {
    // --- 1. CẤU HÌNH VÀ DOM ELEMENTS ---
    const API_URL = 'http://localhost:8080/api/v1/categories';
    // const API_URL = 'https://smithsonian-ste-adjust-kde.trycloudflare.com/api/v1/categories';

    let dataTable = null; // Biến giữ thể hiện của DataTables
    const modalEl = document.getElementById('addTourModal');
    const modal = new bootstrap.Modal(modalEl);
    const form = document.getElementById('addTourForm');
    const modalTitle = document.getElementById('addTourModalLabel');
    const modalDescriptionEl = modalEl.querySelector('p.text-muted');
    const deleteBtn = document.getElementById('deleteTourBtn');
    const categoryTable = document.getElementById('categoryTable'); // Thẻ <table>
    const categoryTableBody = document.querySelector('.datatable tbody');
    const descriptionInput = document.getElementById('description');
    const addButton = document.querySelector('[data-bs-target="#addTourModal"]');

    // Phần tử cho Preview ảnh
    const uploadContainer = document.getElementById('uploadContainer'); // DOM cho vùng input file
    const imageInput = document.getElementById('tourImage');
    const previewImg = document.getElementById('imagePreview');
    const previewContainer = document.getElementById('imagePreviewContainer');
    const changeImageBtn = document.getElementById('changeImageBtn'); // Nút "Thay ảnh"
    const selectAll = document.getElementById('selectAll'); // Checkbox chọn tất cả
    const bulkBar = document.getElementById('bulkActionBar'); // Action bar hàng loạt
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn'); // Nút xóa hàng loạt
    const countEl = document.getElementById('selectedCount'); // Số lượng đã chọn

    const quill = new Quill('#quillEditor', { theme: 'snow' });
    let currentId = null;
    let currentImageUrl = null;
    let selectedIds = new Set(); // Set để lưu ID các hàng đã chọn

    // --- 2. CÁC HÀM HỖ TRỢ CHUNG ---
    // Giới hạn số ký tự nhập
    function setupCategoryTitleHandler() {
        const input = document.getElementById("categoryTitleInput");
        const counter = document.getElementById("categoryTitleCount");
        const MAX = 255;

        if (!input || !counter) return;

        // Hiển thị ngay số ký tự hiện tại
        counter.innerText = `${input.value.length} / ${MAX}`;

        // Xóa event cũ để tránh đăng ký trùng
        input.oninput = null;
        input.onblur = null;

        // Đếm khi nhập
        input.addEventListener("input", function () {
            let value = this.value.replace(/^\s+/, "");
            if (value.length > MAX) value = value.substring(0, MAX);

            this.value = value;
            counter.innerText = `${value.length} / ${MAX}`;
        });

        // Trim cuối khi blur
        input.addEventListener("blur", function () {
            this.value = this.value.trim();
            counter.innerText = `${this.value.length} / ${MAX}`;
        });
    }


    // Alert góc phải
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

    /**
     * Thiết lập chức năng xem trước ảnh.
     */
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
            previewImg.src = '#';
            previewContainer.style.display = 'none';
            uploadContainer.style.display = 'block';
        }
    }

    // Reset modal
    function resetModalToDefault() {
        currentId = null;
        currentImageUrl = null;
        modalTitle.textContent = 'Thêm danh mục tour mới';
        modalDescriptionEl.style.display = 'block';
        deleteBtn.style.display = 'none';
        form.reset();
        quill.setText('');
        imageInput.value = ''; // Reset input file
        setupImagePreview(null); // Reset ảnh preview
    }


    // Cập nhật thanh hành động hàng loạt
    function toggleBulkBar() {
        // countEl.textContent = selectedIds.size; // Đã thêm span#selectedCount vào HTML
        bulkBar.classList.toggle('d-none', selectedIds.size === 0);
    }

    function highlightRow(cb, checked) {
        const tr = cb.closest('tr');
        if (checked) tr.classList.add('table-active');
        else tr.classList.remove('table-active');
    }

    /**
     * Gắn sự kiện checkbox cho các hàng MỚI (chạy sau mỗi lần DataTables vẽ lại)
     */
    function attachCheckboxEvents() {
        // Đảm bảo checkbox "Chọn tất cả" được reset về trạng thái ban đầu
        if (selectAll) selectAll.checked = false;

        const rowCheckboxes = document.querySelectorAll('#categoryTable .row-checkbox');

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
                // Nếu tất cả checkbox đều được chọn => tự check lại "Chọn tất cả"
                const allChecked = [...document.querySelectorAll('#categoryTable .row-checkbox')]
                    .every(cb => cb.checked);
                selectAll.checked = allChecked;
            };

        });
        toggleBulkBar();
    }

    // --- 3. CÁC HÀM API CRUD ---
    function loadCategories() {
        if ($.fn.DataTable.isDataTable('#categoryTable')) {
            $('#categoryTable').DataTable().ajax.reload(attachCheckboxEvents, false);
            return;
        }

        $(document).ready(function () {
            dataTable = $('#categoryTable').DataTable({
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
                    const searchValue = data.search.value ? data.search.value : '';
                    const sortColIndex = data.order.length > 0 ? data.order[0].column : 1;
                    const columnMap = ['id', 'categoryId', 'categoryName', 'description', 'createdAt', 'status'];
                    const sortColName = columnMap[sortColIndex] || 'categoryId';
                    const sortDir = data.order.length > 0 ? data.order[0].dir : 'desc';

                    const url = `${API_URL}?page=${page}&size=${size}&sort=${sortColName},${sortDir}&keyword=${encodeURIComponent(searchValue)}`;

                    fetch(url)
                        .then(res => res.json())
                        .then(json => {
                            // Cập nhật tổng số danh mục trên thẻ card
                            document.getElementById('totalCategories').textContent = json.totalElements;

                            // Gửi dữ liệu về cho DataTables
                            callback({
                                recordsTotal: json.totalElements,
                                recordsFiltered: json.totalElements,
                                data: json.content
                            });
                        })
                        .catch(err => {
                            console.error("Lỗi tải dữ liệu:", err);
                            showAlert('Lỗi tải danh mục: ' + err.message, 'danger');
                            callback({ data: [], recordsTotal: 0, recordsFiltered: 0 });
                        });
                },
                columns: [
                    { // Cột Checkbox
                        data: null,
                        orderable: false,
                        searchable: false,
                        render: (data, type, row) => {
                            // Đã sửa lỗi: Dùng row.id (hoặc categoryId) để gán cho data-id
                            return `<input type="checkbox" class="row-checkbox" data-id="${row.id || row.categoryId}">`;
                        }
                    },
                    { data: 'id', title: 'Mã danh mục' },
                    { // Cột Ảnh
                        data: 'imageUrl',
                        title: 'Ảnh',
                        orderable: false,
                        render: url => url ? `<img src="${url}" width="60" height="40" style="object-fit:cover;border-radius:4px;">` : '-'
                    },
                    { data: 'categoryName', title: 'Tên danh mục' },
                    {
                        data: 'description',
                        title: 'Mô tả',
                        render: data => {
                            if (!data) return '-';
                            const text = new DOMParser().parseFromString(data, 'text/html').body.textContent;
                            return text.length > 50 ? text.substring(0, 50) + '...' : text;
                        }
                    },
                    { // Cột Ngày tạo (Sử dụng data: 'createdAt' nếu API trả về)
                        data: 'createdAt',
                        title: 'Ngày tạo',
                        render: data => data ? data.split('T')[0] : ''
                    },
                    { // Cột Trạng thái
                        data: 'status',
                        title: 'Trạng thái',
                        render: s => s ? '<span class="badge bg-success">Hoạt động</span>' : '<span class="badge bg-danger">Ẩn</span>'
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

            // Gắn sự kiện sau khi DataTables vẽ lại (Draw)
            $('#categoryTable').on('draw.dt', function () {
                attachCheckboxEvents();
            });
        });
    }

    /** ✏️ Setup modal khi edit (Read Single) */
    async function setupModalForEdit(categoryId) {
        try {
            const res = await fetch(`${API_URL}/${categoryId}`);
            if (!res.ok) throw new Error('Category not found');
            const cat = await res.json();

            currentId = categoryId;
            currentImageUrl = cat.imageUrl || null;
            modalTitle.textContent = `Chỉnh sửa danh mục #${categoryId}`;
            modalDescriptionEl.style.display = 'none';
            deleteBtn.style.display = 'block';

            imageInput.removeAttribute('required');

            const categoryName = cat.categoryName || cat.name || '';
            form.querySelector('[name="categoryName"]').value = categoryName;
            quill.root.innerHTML = cat.description || '';
            form.querySelector('[name="status"]').value = (cat.status == 1 || cat.status === true) ? 'active' : 'hidden';
            setupCategoryTitleHandler();
            setupImagePreview(null, currentImageUrl);

            imageInput.value = null;
            modal.show();
        } catch (err) {
            showAlert('Không thể tải chi tiết danh mục: ' + err.message, 'danger');
        }
    }

    /** Thêm/Cập nhật danh mục (Create/Update logic) */
    async function saveCategory(categoryData, id = null) {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_URL}/${id}` : API_URL;

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(categoryData)
        });
        if (!res.ok) throw new Error(`Lỗi khi ${id ? 'cập nhật' : 'tạo mới'} danh mục: ${res.statusText}`);
        return res.json();
    }

    /** Xóa danh mục (Delete) */
    async function deleteCategory(id) {
        const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            const msg = errorData.message || 'Không thể xóa danh mục này';
            throw new Error(msg); // 
        }

        return true; // Thành công
    }
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        setupImagePreview(file);
    });

    // Khi người dùng bấm “Thay ảnh”
    if (changeImageBtn) {
        changeImageBtn.addEventListener('click', () => {
            imageInput.click();
        });
    }

    // Submit form (Thêm mới/Cập nhật)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        descriptionInput.value = quill.root.innerHTML;

        const imageFile = imageInput.files[0];
        let finalImageUrl = currentImageUrl; // Khởi tạo bằng URL ảnh cũ

        try {
            //  Upload ảnh: Chỉ upload nếu có file mới
            if (imageFile) {
                const uploadData = new FormData();
                uploadData.append('file', imageFile);

                showAlert('Đang upload ảnh...', 'info');
                const uploadRes = await fetch(`${API_URL}/upload`, {
                    method: 'POST',
                    body: uploadData
                });


                if (!uploadRes.ok) throw new Error('Upload ảnh thất bại!');
                const uploadResult = await uploadRes.json();
                finalImageUrl = uploadResult.url; // Ghi đè bằng URL mới
            }

            // Gửi dữ liệu danh mục
            const formData = new FormData(form);
            const category = {
                categoryName: formData.get('categoryName'),
                description: formData.get('description'),
                status: formData.get('status') === 'active' ? 1 : 0,
                imageUrl: finalImageUrl
            };

            await saveCategory(category, currentId);

            modal.hide();
            showAlert(
                currentId ? 'Cập nhật danh mục thành công!' : 'Thêm danh mục mới thành công!',
                'success'
            );

            //  RELOAD TRANG THEO YÊU CẦU:
            setTimeout(() => window.location.reload(), 800);

        } catch (err) {
            console.error(err);
            showAlert(err.message, 'danger');
        }
    });


    // Xóa danh mục
    deleteBtn.addEventListener('click', async () => {
        if (!currentId) return;
        if (confirm(`Bạn có chắc muốn xóa danh mục #${currentId}?`)) {
            try {
                await deleteCategory(currentId);
                modal.hide();
                showAlert(' Xóa danh mục thành công!', 'success');
                setTimeout(() => window.location.reload(), 800);
            } catch (err) {
                // Hiển thị 1 alert duy nhất, gọn gàng
                showAlert(err.message, 'danger');
            }
        }
    });


    // Xóa hàng loạt
    if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener('click', async () => {
            if (selectedIds.size === 0) return;
            if (!confirm(`Bạn có chắc muốn xóa ${selectedIds.size} danh mục đã chọn?`)) return;

            try {
                const response = await fetch(`${API_URL}/bulk-delete`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify([...selectedIds])
                });

                // Lấy nội dung trả về (message từ backend)
                const data = await response.json();

                // Hiển thị cảnh báo hoặc thành công
                if (response.ok) {
                    if (data.message && (
                        data.message.includes('không thể') ||
                        data.message.includes('liên kết')
                    )) {
                        showAlert(data.message, 'danger');
                    } else if (data.message && data.message.includes('một số danh mục')) {
                        showAlert(data.message, 'warning');
                    } else {
                        showAlert(data.message || 'Xóa danh mục thành công!', 'success');
                    }
                } else {
                    showAlert(data.message || 'Lỗi khi xóa danh mục!', 'danger');
                }


                // Reset lại danh sách chọn
                selectedIds.clear();
                toggleBulkBar();

                // Reload lại bảng sau khi xử lý xong
                await loadCategories();

            } catch (err) {
                console.error(' Lỗi xóa danh mục:', err);
                showAlert('Không thể kết nối đến máy chủ!', 'danger');
            }
        });
    }



    // Gắn sự kiện UI khác
    addButton.addEventListener('click', () => {
        resetModalToDefault();
        setupCategoryTitleHandler(); // Gắn lại event đếm ký tự
    });

    // Sự kiện click vào hàng của DataTables (phải gắn trên body để hoạt động sau khi draw)
    $('#categoryTable tbody').on('click', 'tr', function (e) {
        // Bỏ qua nếu click vào checkbox
        if ($(e.target).is('input[type="checkbox"]')) return;

        // Lấy data của dòng này
        const data = $('#categoryTable').DataTable().row(this).data();

        // Kiểm tra dữ liệu hợp lệ
        if (!data) return;

        const categoryId = data.categoryId || data.id;

        if (categoryId) {
            setupModalForEdit(categoryId);
        }
    });

    modalEl.addEventListener('hidden.bs.modal', resetModalToDefault);

    //  Tải dữ liệu ban đầu
    loadCategories();
    // ====== ĐẾM TỔNG SỐ DANH MỤC HOẠT ĐỘNG ======
    async function countActiveCategories() {
        try {
            const res = await fetch(`${API_URL}?page=0&size=1000&sort=categoryId,desc`);
            if (!res.ok) throw new Error("Không thể tải danh sách danh mục");
            const data = await res.json();

            // Tổng danh mục
            const total = data.totalElements || data.content.length;
            document.getElementById("totalCategories").textContent = total;

            // Danh mục đang hoạt động (status = 1 hoặc true)
            const activeCategories = data.content.filter(c => c.status === 1 || c.status === true);
            document.getElementById("activeCategories").textContent = activeCategories.length;
        } catch (err) {
            console.error("Lỗi khi đếm danh mục hoạt động:", err);
            document.getElementById("totalCategories").textContent = "0";
            document.getElementById("activeCategories").textContent = "0";
        }
    }

    countActiveCategories();

});
