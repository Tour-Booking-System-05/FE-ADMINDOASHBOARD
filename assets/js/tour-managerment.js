document.addEventListener('DOMContentLoaded', function () {

    // ====== CẤU HÌNH API ======
    const API_URL = 'http://localhost:8080/api/v1/tours';
    let selectedIds = new Set();
    let currentId = null;

    // ====== DOM ELEMENTS ======
    const form = document.getElementById('addTourForm');
    const modalEl = document.getElementById('addTourModal');
    const modal = new bootstrap.Modal(modalEl);
    const deleteBtn = document.getElementById('deleteTourBtn');
    const addBtn = document.querySelector('[data-bs-target="#addTourModal"]');
    const alertContainer = document.getElementById('alert-container');
    const imageInput = document.getElementById('tourImages');
    const previewBox = document.getElementById('imagePreviewContainer');
    const previewList = document.getElementById('imagePreviewList');
    const uploadBox = document.getElementById('uploadContainer');
    const changeImagesBtn = document.getElementById('changeImagesBtn');
    const truongNgayBatDau = form.querySelector('input[name="startDate"]');
    const truongNgayKetThuc = form.querySelector('input[name="endDate"]');
    const quill = new Quill('#quillEditor', { theme: 'snow' });
    const selectAll = document.getElementById('selectAll');
    const bulkBar = document.getElementById('bulkActionBar');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    let guiderMap = new Map(); // 🔥 Map lưu hướng dẫn viên theo ID

    // ====== HÀM ALERT ======
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
        alertContainer.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }
    let selectedFiles = []; // Lưu tất cả file đã chọn (không bị mất khi thêm mới)

    // Xem trước nhiều ảnh
    function previewMultipleImages(files = [], urls = []) {
        selectedFiles = [];

        // Nếu có ảnh mới được chọn
        if (files.length > 0) {
            selectedFiles.push(...files);
        }

        // Nếu có ảnh cũ từ server
        if (urls.length > 0) {
            selectedFiles.push(...urls.map(u => ({ previewUrl: u })));
        }

        // Hiển thị
        previewList.innerHTML = '';
        if (selectedFiles.length === 0) {
            previewBox.style.display = 'none';
            return;
        }

        selectedFiles.forEach((file, idx) => {
            const img = document.createElement('img');
            img.src = file.previewUrl || URL.createObjectURL(file);
            img.className = 'rounded border';
            img.style = 'width:100px;height:100px;object-fit:cover;cursor:pointer;';
            img.title = "Nhấn để xóa ảnh này";
            img.onclick = () => removeImage(idx);
            previewList.appendChild(img);
        });

        previewBox.style.display = 'block';
    }

    // Xóa 1 ảnh khỏi preview
    function removeImage(index) {
        if (confirm('Bạn có muốn xóa ảnh này không?')) {
            selectedFiles.splice(index, 1);
            previewMultipleImages([]); // vẽ lại
        }
    }

    // Khi chọn lại ảnh
    changeImagesBtn.addEventListener('click', () => imageInput.click());

    imageInput.addEventListener('change', e => {
        previewMultipleImages(Array.from(e.target.files));

        // Cho phép chọn lại file trùng tên
        e.target.value = '';
        changeImagesBtn.addEventListener('click', () => imageInput.click());
        imageInput.addEventListener('change', e => previewMultipleImages(e.target.files));
    });
    function khoiTaoCacTruongNgay() {
        const homNay = new Date();
        homNay.setDate(homNay.getDate() + 1); // ✅ Ngày mai
        const ngayMai = homNay.toISOString().split('T')[0];

        truongNgayBatDau.setAttribute('min', ngayMai);
        truongNgayKetThuc.setAttribute('min', ngayMai);
    }
    khoiTaoCacTruongNgay();

    function capNhatMinNgayKetThuc() {
        const ngayBatDauDaChon = truongNgayBatDau.value;
        if (ngayBatDauDaChon) {
            truongNgayKetThuc.setAttribute('min', ngayBatDauDaChon);
            if (truongNgayKetThuc.value && truongNgayKetThuc.value < ngayBatDauDaChon) {
                truongNgayKetThuc.value = '';
            }
        } else {
            khoiTaoCacTruongNgay();
        }
    }
    truongNgayBatDau.addEventListener('change', capNhatMinNgayKetThuc);
    function limitText(input, maxLength) {
        if (input.value.length > maxLength) {
            input.value = input.value.slice(0, maxLength);
            showAlert(`Tên chuyến đi chỉ được tối đa ${maxLength} ký tự`, 'warning');
        }
    }
    // ====== RESET MODAL ======
    function resetModal() {
        currentId = null;
        form.reset();
        quill.setText('');
        deleteBtn.style.display = 'none';
        previewMultipleImages([]);
        khoiTaoCacTruongNgay();
        // 🔹 Đặt lại tiêu đề
        document.getElementById('addTourModalLabel').textContent = 'Thêm tour mới';
        document.querySelector('.modal-body p.text-muted').textContent = 'Tạo tour du lịch mới với thông tin chi tiết';
    }

    addBtn.addEventListener('click', async () => {
        resetModal();
        await loadDropdownData(); // 🔥 load lại danh mục và hướng dẫn viên
    });
    modalEl.addEventListener('hidden.bs.modal', resetModal);

    // ====== BULK CHECKBOX ======
    function toggleBulkBar() {
        bulkBar.classList.toggle('d-none', selectedIds.size === 0);
    }

    function highlightRow(cb, checked) {
        const tr = cb.closest('tr');
        if (checked) tr.classList.add('table-active');
        else tr.classList.remove('table-active');
    }

    function attachCheckboxEvents() {
        if (selectAll) selectAll.checked = false;
        const rowCheckboxes = document.querySelectorAll('#tourTable .row-checkbox');

        // Chọn tất cả
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

        // Chọn từng dòng
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
                const allChecked = [...document.querySelectorAll('#tourTable .row-checkbox')]
                    .every(cb => cb.checked);
                selectAll.checked = allChecked;
            };
        });
        toggleBulkBar();
    }

    // ====== XÓA NHIỀU TOUR ======
    deleteSelectedBtn.addEventListener('click', async () => {
        if (selectedIds.size === 0) {
            showAlert('Chưa chọn tour nào để xóa!', 'warning');
            return;
        }
        if (!confirm(`Bạn có chắc muốn xóa ${selectedIds.size} tour này không?`)) return;
        try {
            const res = await fetch(`${API_URL}/bulk-delete`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([...selectedIds])
            });
            if (!res.ok) throw new Error('Xóa nhiều thất bại');
            showAlert(` Đã xóa ${selectedIds.size} tour thành công`, 'danger');
            selectedIds.clear();
            toggleBulkBar();
            $('#tourTable').DataTable().ajax.reload();
        } catch (err) {
            showAlert('Lỗi: ' + err.message, 'danger');
        }
    });
    // ====== LOAD DANH MỤC & HƯỚNG DẪN VIÊN ======
    async function loadDropdownData() {
        try {
            const cateSelect = form.querySelector('select[name="category"]');
            const guideSelect = form.querySelector('select[name="guide"]');

            const cateRes = await fetch('http://localhost:8080/api/v1/categories/all');
            if (!cateRes.ok) throw new Error('Không thể tải danh mục');
            const categories = await cateRes.json();

            const guideRes = await fetch('http://localhost:8080/api/v1/employees/guider');
            if (!guideRes.ok) throw new Error('Không thể tải hướng dẫn viên');
            const guiders = await guideRes.json();

            cateSelect.innerHTML = '<option value="">-- Chọn danh mục tour --</option>';
            guideSelect.innerHTML = '<option value="">-- Chọn hướng dẫn viên --</option>';

            categories.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id; // ✅ Vì backend trả về "id"
                opt.textContent = c.categoryName;
                cateSelect.appendChild(opt);
            });
            guiderMap.clear();
            guiders.forEach(g => {
                guiderMap.set(g.employeeId, `${g.fullName} (${g.gender === 'NAM' ? 'Nam' : 'Nữ'})`);
                const opt = document.createElement('option');
                opt.value = g.employeeId;
                opt.textContent = `${g.fullName} (${g.gender === 'NAM' ? 'Nam' : 'Nữ'})`;
                guideSelect.appendChild(opt);
            });

            console.log('Đã load danh mục & hướng dẫn viên');
        } catch (err) {
            console.error('Lỗi load dropdown:', err);
            showAlert('Không thể tải danh mục hoặc hướng dẫn viên', 'danger');
        }
    }

    // ====== LOAD DATA TABLE ======
    function loadTours() {
        if ($.fn.DataTable.isDataTable('#tourTable')) {
            $('#tourTable').DataTable().ajax.reload();
            return;
        }

        $('#tourTable').DataTable({
            serverSide: true,
            processing: true,
            searching: true,
            autoWidth: false,
            scrollX: true,
            lengthChange: true,
            pageLength: 5,
            lengthMenu: [[5, 10, 25, 50, -1], [5, 10, 25, 50, "Tất cả"]],
            order: [[0, 'asc']],
            columnDefs: [{ targets: 0, orderable: false, searchable: false }],
            ajax: function (data, callback) {
                const page = Math.floor(data.start / data.length);
                const size = data.length;
                const keyword = data.search.value || '';
                const sortColIndex = data.order[0]?.column;
                const columnMap = ['itemId', 'titleTour', 'located', 'dateTour', 'price', 'guiderId', 'status'];
                const sortCol = columnMap[sortColIndex] || 'itemId';
                const sortDir = data.order.length > 0 ? data.order[0].dir : 'asc';
                const url = `${API_URL}?page=${page}&size=${size}&sort=${sortCol},${sortDir}&keyword=${encodeURIComponent(keyword)}`;

                fetch(url)
                    .then(res => res.json())
                    .then(json => {
                        document.getElementById('totalTours').textContent = json.totalElements;
                        callback({
                            recordsTotal: json.totalElements,
                            recordsFiltered: json.totalElements,
                            data: json.content
                        });
                    })
                    .catch(err => {
                        showAlert('Lỗi tải dữ liệu: ' + err.message, 'danger');
                        callback({ data: [] });
                    });
            },
            columns: [
                { data: null, render: r => `<input type="checkbox" class="row-checkbox" data-id="${r.itemId}">`, orderable: false },
                { data: 'itemId', title: 'Mã tour' },
                { data: 'titleTour', title: 'Tên chuyến đi', render: d => d || '-' },
                { data: 'located', title: 'Điểm đến', render: d => d || '-' },
                { data: null, title: 'Thời gian', render: r => `${r.dateTour || '?'} → ${r.dateEndTour || '?'}` },
                { data: 'price', title: 'Giá (VND)', render: p => p ? p.toLocaleString('vi-VN') : '-' },
                {
                    data: 'guiderId',
                    title: 'Hướng dẫn viên',
                    render: id => guiderMap.get(id) || '-'
                },
                {
                    data: 'status', title: 'Trạng thái', render: s => {
                        if (s === 1) return '<span class="badge bg-success">Hoạt động</span>';
                        if (s === 2) return '<span class="badge bg-primary">Đang đi</span>';
                        if (s === 0) return '<span class="badge bg-danger">Ẩn</span>';
                        return '-';
                    }
                }
            ],
            language: {
                searchPlaceholder: "🔎 Tìm kiếm tour...",
                search: "",
                lengthMenu: "_MENU_ / dòng",
                info: "Hiển thị _START_–_END_ / _TOTAL_ tour",
                zeroRecords: "Không tìm thấy dữ liệu",
                loadingRecords: "Đang tải...",
                paginate: { previous: "← Trước", next: "Tiếp →" }
            }
        });

        $('#tourTable').on('draw.dt', function () {
            attachCheckboxEvents();
        });

        $('#tourTable tbody').on('click', 'tr', async function (e) {
            if ($(e.target).is('input[type="checkbox"]')) return;
            const data = $('#tourTable').DataTable().row(this).data();
            if (!data) return;

            // 🔥 Gọi API lấy chi tiết từ backend

            const fullData = await getTourById(data.itemId);
            if (fullData) openEditModal(fullData);
        });

    }
    // ====== HÀM GỌI API GET TOUR BY ID ======
    async function getTourById(id) {
        try {
            const res = await fetch(`${API_URL}/${id}`);
            if (!res.ok) throw new Error(`Không tìm thấy tour ID ${id}`);
            return await res.json();
        } catch (err) {
            showAlert(err.message, 'danger');
            console.error(err);
            return null;
        }
    }

    // ====== MỞ MODAL SỬA ======
    function openEditModal(item) {
        currentId = item.itemId;

        // 🔹 Cập nhật tiêu đề modal
        document.getElementById('addTourModalLabel').textContent = `Thông tin chi tiết tour id: ${item.itemId}`;
        document.querySelector('.modal-body p.text-muted').textContent = 'Chỉnh sửa thông tin chi tiết của tour du lịch';

        // Điền dữ liệu vào form
        form.querySelector('[name="category"]').value = item.categoryId || '';
        form.querySelector('[name="categoryName"]').value = item.titleTour || '';
        form.querySelector('[name="destination"]').value = item.located || '';
        form.querySelector('[name="vehicle"]').value = item.vehicle || '';
        form.querySelector('[name="price"]').value = item.price || '';
        form.querySelector('[name="comparePrice"]').value = item.comparatingPrice || '';
        form.querySelector('[name="tickets"]').value = item.total || '';
        form.querySelector('[name="startDate"]').value = item.dateTour || '';
        form.querySelector('[name="endDate"]').value = item.dateEndTour || '';
        form.querySelector('[name="guide"]').value = item.guiderId || '';
        quill.root.innerHTML = item.description || '';

        // 🔹 Trạng thái
        const statusSelect = form.querySelector('[name="status"]');
        if (item.status === 1) statusSelect.value = 'active';
        else if (item.status === 2) statusSelect.value = 'ongoing';
        else if (item.status === 0) statusSelect.value = 'cancel';
        else statusSelect.value = '';

        // 🔹 Hiển thị ảnh
        previewMultipleImages([], item.imageUrls || []);

        deleteBtn.style.display = 'block';
        modal.show();
    }


    // ====== SUBMIT FORM ======
    form.addEventListener('submit', async e => {
        e.preventDefault();
        // ====== VALIDATE FORM ======
        const price = Number(form.price.value);
        const comparePrice = Number(form.comparePrice.value);
        const tickets = Number(form.tickets.value);

        if (isNaN(price) || price <= 0) {
            showAlert('Giá tour phải lớn hơn 0', 'warning');
            return;
        }

        if (!isNaN(comparePrice) && comparePrice > 0 && comparePrice <= price) {
            showAlert('Giá so sánh phải lớn hơn giá tour', 'warning');
            return;
        }

        if (isNaN(tickets) || tickets < 1) {
            showAlert('Số vé phải ít nhất là 1', 'warning');
            return;
        }

        const desc = quill.root.innerHTML;
        const files = Array.from(imageInput.files);
        let imageUrls = [];
        if (selectedFiles.length === 0) {
            showAlert('Vui lòng chọn ít nhất 1 ảnh cho chuyến đi', 'warning');
            return;
        }

        try {
            // 🧩 Upload nhiều ảnh
            for (const file of selectedFiles) {
                // Trường hợp file là object chứa previewUrl (ảnh cũ) thì bỏ qua upload
                if (file.previewUrl) {
                    imageUrls.push(file.previewUrl);
                    continue;
                }

                const fd = new FormData();
                fd.append('file', file);
                showAlert('Đang upload ảnh...', 'info');
                const res = await fetch(`${API_URL}/upload`, { method: 'POST', body: fd });
                if (!res.ok) throw new Error('Upload ảnh thất bại');
                const data = await res.json();
                imageUrls.push(data.url);
            }

            const payload = {
                categoryId: Number(form.category.value),
                guiderId: Number(form.guide.value),
                titleTour: form.categoryName.value.trim(),
                description: desc.trim(),
                dateTour: form.startDate.value,
                dateEndTour: form.endDate.value,
                located: form.destination.value.trim(),
                vehicle: form.vehicle.value.trim(),
                comparatingPrice: Number(form.comparePrice.value) || 0,
                discount: Number(form.discount?.value || 0),
                price: Number(form.price.value),
                total: Number(form.tickets.value),
                status:
                    form.status.value === 'active'
                        ? 1
                        : form.status.value === 'ongoing'
                            ? 2
                            : 0,

                imageUrls: imageUrls
            };

            const method = currentId ? 'PUT' : 'POST';
            const url = currentId ? `${API_URL}/${currentId}` : API_URL;
            await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            // Hiển thị alert khi thêm hoặc cập nhật
            showAlert(currentId ? 'Cập nhật tour thành công' : 'Thêm tour mới thành công');

            // Ẩn modal sau 1 giây để alert kịp hiện
            setTimeout(() => {
                modal.hide();
                $('#tourTable').DataTable().ajax.reload();
            }, 1000);

        } catch (err) {
            showAlert('Lỗi: ' + err.message, 'danger');
        }
    });

    // ====== XÓA TOUR ======
    deleteBtn.addEventListener('click', async () => {
        if (!currentId) return;
        if (!confirm('Bạn có chắc muốn xóa tour này?')) return;
        await fetch(`${API_URL}/${currentId}`, { method: 'DELETE' });
        showAlert('Xóa tour thành công', 'danger');
        modal.hide();
        $('#tourTable').DataTable().ajax.reload();
        setTimeout(() => window.location.reload(), 800);

    });

    // ====== KHỞI TẠO ======
    khoiTaoCacTruongNgay();
    loadDropdownData().then(() => loadTours());
    // ====== ĐẾM TỔNG SỐ TOUR ĐANG HOẠT ĐỘNG ======
    async function countActiveTours() {
        try {
            const res = await fetch(`${API_URL}?page=0&size=1000&sort=itemId,asc`);
            if (!res.ok) throw new Error("Không thể tải danh sách tour");
            const data = await res.json();

            // Lọc các tour có status = 1 (Hoạt động)
            const activeTours = data.content.filter(t => t.status === 1);
            document.getElementById("activeTours").textContent = activeTours.length;
        } catch (err) {
            console.error("Lỗi khi đếm tour hoạt động:", err);
            document.getElementById("activeTours").textContent = "0";
        }
    }

    // Gọi hàm khi load trang
    countActiveTours();

});