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
    let guiderMap = new Map(); // Map lưu hướng dẫn viên theo ID
    let selectedFiles = []; // Lưu tất cả file đã chọn (không bị mất khi thêm mới)
    // ====== HÀM ALERT ======
    // ====== HÀM ALERT GIỐNG TRANG TOUR ======
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

    // Xem trước nhiều ảnh
    function previewMultipleImages(files = [], urls = []) {
        // Nếu có ảnh từ server (URL cũ)
        if (urls.length > 0 && selectedFiles.length === 0) {
            selectedFiles = urls.map(u => ({ previewUrl: u, isExisting: true }));
        }

        // Nếu có ảnh mới từ input
        if (files.length > 0) {
            const newFiles = files.map(f => ({ file: f, isExisting: false }));
            selectedFiles.push(...newFiles);
        }

        // Render ảnh
        previewList.innerHTML = '';
        if (selectedFiles.length === 0) {
            previewBox.style.display = 'none';
            return;
        }

        selectedFiles.forEach((item, idx) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'position-relative d-inline-block me-2 mb-2';
            wrapper.style.width = '100px';
            wrapper.style.height = '100px';

            const img = document.createElement('img');
            img.src = item.isExisting ? item.previewUrl : URL.createObjectURL(item.file);
            img.className = 'rounded border';
            img.style = 'width:100%;height:100%;object-fit:cover;';

            const deleteIcon = document.createElement('i');
            deleteIcon.className = 'bi bi-trash3-fill text-danger position-absolute top-0 end-0 m-1 p-1 bg-light rounded-circle shadow';
            deleteIcon.style.cursor = 'pointer';
            deleteIcon.onclick = (e) => {
                e.stopPropagation();
                removeImage(idx);
            };

            wrapper.appendChild(img);
            wrapper.appendChild(deleteIcon);
            previewList.appendChild(wrapper);
        });

        previewBox.style.display = 'block';
    }
    // Xóa ảnh khỏi danh sách
    function removeImage(index) {
        if (confirm('Bạn có muốn xóa ảnh này không?')) {
            selectedFiles.splice(index, 1);
            previewList.innerHTML = '';
            selectedFiles.forEach((file, idx) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'position-relative d-inline-block me-2 mb-2';
                wrapper.style.width = '100px';
                wrapper.style.height = '100px';

                const img = document.createElement('img');
                img.src = file.previewUrl || URL.createObjectURL(file);
                img.className = 'rounded border';
                img.style = 'width:100%;height:100%;object-fit:cover;';

                // Thêm icon thùng rác
                const deleteIcon = document.createElement('i');
                deleteIcon.className = 'bi bi-trash3-fill text-danger position-absolute top-0 end-0 m-1 p-1 bg-light rounded-circle shadow';
                deleteIcon.style.cursor = 'pointer';
                deleteIcon.style.fontSize = '1rem';
                deleteIcon.title = 'Xóa ảnh này';
                deleteIcon.onclick = (e) => {
                    e.stopPropagation(); // Không ảnh hưởng khi click ảnh
                    removeImage(idx);
                };

                wrapper.appendChild(img);
                wrapper.appendChild(deleteIcon);
                previewList.appendChild(wrapper);
            });

            if (selectedFiles.length === 0) {
                previewBox.style.display = 'none';
            }
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
    // ====== KHỞI TẠO CÁC TRƯỜNG NGÀY ======
    function khoiTaoCacTruongNgay() {
        const homNay = new Date();
        homNay.setDate(homNay.getDate() + 1); // Ngày mai
        const ngayMai = homNay.toISOString().split('T')[0];
        truongNgayBatDau.setAttribute('min', ngayMai);
        truongNgayKetThuc.setAttribute('min', ngayMai);
    }

    khoiTaoCacTruongNgay();

    function capNhatMinNgayKetThuc() {
        const ngayBatDauDaChon = truongNgayBatDau.value;
        const homNay = new Date().toISOString().split('T')[0]; // yyyy-MM-dd

        if (ngayBatDauDaChon) {
            // Cảnh báo nếu chọn ngày hôm nay
            if (ngayBatDauDaChon === homNay) {
                showAlert('Ngày bắt đầu không được là hôm nay. Vui lòng chọn từ ngày mai trở đi.', 'warning');
                // Reset lại giá trị về ngày mai
                const ngayMai = new Date();
                ngayMai.setDate(ngayMai.getDate() + 1);
                const formattedNgayMai = ngayMai.toISOString().split('T')[0];
                truongNgayBatDau.value = formattedNgayMai;
                truongNgayKetThuc.setAttribute('min', formattedNgayMai);
                truongNgayKetThuc.value = formattedNgayMai;
                return;
            }

            //  Nếu ngày hợp lệ → cập nhật min cho ngày kết thúc
            truongNgayKetThuc.setAttribute('min', ngayBatDauDaChon);
            if (truongNgayKetThuc.value && truongNgayKetThuc.value < ngayBatDauDaChon) {
                truongNgayKetThuc.value = '';
            }
        } else {
            khoiTaoCacTruongNgay();
        }
    }

    truongNgayBatDau.addEventListener('change', capNhatMinNgayKetThuc);
    function setupTourTitleHandler() {
        const input = document.getElementById("tourTitleInput");
        const counter = document.getElementById("tourTitleCount");
        const MAX = 255;

        if (!input || !counter) return;

        // Cập nhật counter theo giá trị hiện tại (QUAN TRỌNG)
        counter.innerText = `${input.value.length} / ${MAX}`;

        // Gắn lại sự kiện mỗi lần mở modal
        input.oninput = function () {
            let value = input.value;

            value = value.replace(/^\s+/, ""); // Trim đầu

            if (value.length > MAX) {
                value = value.substring(0, MAX);
                showAlert(`Tên chuyến đi tối đa ${MAX} ký tự`, "warning");
            }

            input.value = value;
            counter.innerText = `${value.length} / ${MAX}`;
        };

        input.onblur = function () {
            input.value = input.value.trim();
            counter.innerText = `${input.value.length} / ${MAX}`;
        };
    }

    // ====== RESET MODAL ======
    function resetModal() {
        // Reset counter về 0 khi thêm mới
        document.getElementById("tourTitleInput").value = "";
        document.getElementById("tourTitleCount").innerText = "0 / 255";

        // Gắn lại sự kiện input/blur
        setupTourTitleHandler();

        // Reset biến và dữ liệu
        currentId = null;
        selectedFiles = [];
        form.reset();
        quill.setText('');

        // Xóa ảnh xem trước
        previewList.innerHTML = '';
        previewBox.style.display = 'none';

        // Reset dropdown category & guide về mặc định
        const cateSelect = form.querySelector('select[name="category"]');
        const guideSelect = form.querySelector('select[name="guide"]');
        if (cateSelect) cateSelect.selectedIndex = 0;
        if (guideSelect) guideSelect.selectedIndex = 0;

        // Reset ngày về ngày mai
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const formattedTomorrow = tomorrow.toISOString().split('T')[0];
        truongNgayBatDau.value = formattedTomorrow;
        truongNgayBatDau.setAttribute('min', formattedTomorrow);
        truongNgayKetThuc.setAttribute('min', formattedTomorrow);

        const statusSelect = form.querySelector('[name="status"]');
        statusSelect.innerHTML = `<option value="active" selected>Hoạt động</option>`;
        statusSelect.disabled = true;
        statusSelect.classList.add('opacity-75');
        statusSelect.title = "Mặc định tour mới sẽ ở trạng thái Hoạt động";

        // Hiện lại các nút hành động
        deleteBtn.style.display = 'none';
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.style.display = 'inline-block';

        // Gỡ toàn bộ disable/opacity (phòng trường hợp modal mở sau tour “đang đi”)
        form.querySelectorAll('input, select, textarea, button').forEach(el => {
            el.disabled = false;
            el.classList.remove('opacity-75');
        });
        const quillEditor = document.querySelector('#quillEditor .ql-editor');
        if (quillEditor) {
            quillEditor.contentEditable = true;
            quillEditor.classList.remove('opacity-50');
        }
        document.getElementById('cloneTourBtn').style.display = 'none';

        // Đặt lại tiêu đề & mô tả
        document.getElementById('addTourModalLabel').textContent = 'Thêm tour mới';
        document.querySelector('.modal-body p.text-muted').textContent =
            'Tạo tour du lịch mới với thông tin chi tiết';

        // Dọn tooltip/form title
        form.title = "";
    }



    addBtn.addEventListener('click', async () => {
        resetModal();
        await loadDropdownData(); // load lại danh mục và hướng dẫn viên
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
                opt.value = c.id;
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
            lengthMenu: [[5, 10, 25, 50], [5, 10, 25, 50]],
            order: [[0, 'desc']],
            columnDefs: [{ targets: 0, orderable: false, searchable: false }],
            ajax: function (data, callback) {
                const page = Math.floor(data.start / data.length);
                const size = data.length;
                const keyword = data.search.value || '';
                const sortColIndex = data.order[0]?.column;
                const columnMap = ['itemId', 'titleTour', 'located', 'dateTour', 'price', 'guiderId', 'status'];
                const sortCol = columnMap[sortColIndex] || 'itemId';
                const sortDir = data.order.length > 0 ? data.order[0].dir : 'desc';
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
                        if (s === 0) return '<span class="badge bg-danger">Đã hủy</span>';
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
                paginate: { previous: "←", next: "→" }
            }
        });

        $('#tourTable').on('draw.dt', function () {
            attachCheckboxEvents();
        });

        $('#tourTable tbody').on('click', 'tr', async function (e) {
            if ($(e.target).is('input[type="checkbox"]')) return;
            const data = $('#tourTable').DataTable().row(this).data();
            if (!data) return;

            //  Gọi API lấy chi tiết từ backend

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

        document.getElementById('addTourModalLabel').textContent = `Thông tin chi tiết tour ID: ${item.itemId}`;


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
        setupTourTitleHandler();

        // ====== XỬ LÝ TRẠNG THÁI ======
        const statusSelect = form.querySelector('[name="status"]');
        statusSelect.innerHTML = ''; // Xóa các option cũ

        if (item.status === 2 || item.status === 'ongoing') {
            document.querySelector('.modal-body p.text-muted').innerHTML =
                'Xem thông tin chi tiết của tour du lịch<br>*Tour đang đi không thể chỉnh sửa*';
            // Tour đang đi — chỉ hiển thị 1 option duy nhất
            statusSelect.innerHTML = `<option value="ongoing" selected>Đang đi</option>`;
        } else {
            //  Tour hoạt động hoặc ẩn — chỉ hiển thị 2 lựa chọn
            document.querySelector('.modal-body p.text-muted').innerHTML =
                'Xem thông tin chi tiết của tour du lịch';
            statusSelect.innerHTML = `
            <option value="active" ${item.status === 1 ? 'selected' : ''}>Hoạt động</option>
            <option value="cancel" ${item.status === 0 ? 'selected' : ''}>Hủy</option>
        `;
        }

        // ====== HIỂN THỊ ẢNH ======
        previewMultipleImages([], item.imageUrls || []);

        // ====== CẤU HÌNH FORM ======
        const allFields = form.querySelectorAll('input, select, textarea, button');
        const imageArea = document.getElementById('imagePreviewContainer');
        const uploadBtn = document.getElementById('changeImagesBtn');
        const imageInput = document.getElementById('tourImages');
        const quillEditor = document.querySelector('#quillEditor .ql-editor');

        if (item.status === 2 || item.status === 'ongoing') {
            //  Nếu tour đang đi -> khóa toàn bộ form
            allFields.forEach(el => {
                if (el.type !== 'button') {
                    el.disabled = true;
                    el.classList.add('opacity-75');
                }
            });

            // Disable vùng ảnh
            imageInput.disabled = true;
            uploadBtn.disabled = true;
            uploadBtn.classList.add('disabled', 'opacity-75');
            imageArea.classList.add('pointer-events-none', 'opacity-50');

            // Disable mô tả
            quillEditor.contentEditable = false;
            quillEditor.classList.add('opacity-50');

            // Disable dropdown trạng thái
            statusSelect.disabled = true;
            statusSelect.classList.add('opacity-75');

            // Ẩn nút hành động
            deleteBtn.style.display = 'none';
            form.querySelector('button[type="submit"]').style.display = 'none';

            form.title = "Tour đang đi — không thể chỉnh sửa thông tin.";
        } else {
            //  Nếu tour hoạt động hoặc ẩn -> cho phép chỉnh sửa
            allFields.forEach(el => {
                el.disabled = false;
                el.classList.remove('opacity-75');
            });

            imageInput.disabled = false;
            uploadBtn.disabled = false;
            uploadBtn.classList.remove('disabled', 'opacity-75');
            imageArea.classList.remove('pointer-events-none', 'opacity-50');

            quillEditor.contentEditable = true;
            quillEditor.classList.remove('opacity-50');

            statusSelect.disabled = false;
            statusSelect.classList.remove('opacity-75');

            deleteBtn.style.display = 'block';
            form.querySelector('button[type="submit"]').style.display = 'inline-block';
            form.title = "";
        }
        // ====== HIỂN THỊ NÚT CLONE ======
        const cloneBtn = document.getElementById('cloneTourBtn');
        if (cloneBtn) {
            cloneBtn.style.display = 'inline-block';
            cloneBtn.onclick = async () => {
                if (!confirm("Bạn có chắc muốn sao chép chuyến đi này không?")) return;

                try {
                    const res = await fetch(`${API_URL}/${item.itemId}/clone`, { method: 'POST' });
                    if (!res.ok) throw new Error('Không thể sao chép chuyến đi');
                    const data = await res.json();

                    showAlert(`Đã clone tour thành công: ${data.titleTour}`, 'success');
                    modal.hide();
                    // Mở luôn modal của tour mới clone
                    setTimeout(() => {
                        openEditModal(data);
                    }, 800);

                    $('#tourTable').DataTable().ajax.reload(null, false);
                } catch (err) {
                    showAlert(' Lỗi: ' + err.message, 'danger');
                }
            };
        }

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
            //  Chỉ hiển thị alert 1 lần
            if (selectedFiles.some(f => !f.previewUrl)) {
                showAlert('Đang upload ảnh...', 'info');
            }

            // Upload nhiều ảnh (song song cho nhanh hơn)
            const uploadPromises = selectedFiles.map(async (item) => {
                if (item.isExisting) return item.previewUrl; // Ảnh cũ -> bỏ qua upload

                const fd = new FormData();
                fd.append('file', item.file);
                const res = await fetch(`${API_URL}/upload`, { method: 'POST', body: fd });
                if (!res.ok) throw new Error('Upload ảnh thất bại');
                const data = await res.json();
                return data.url;
            });


            const imageUrls = await Promise.all(uploadPromises); // chờ tất cả upload xong

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
                imageUrls
            };

            const method = currentId ? 'PUT' : 'POST';
            const url = currentId ? `${API_URL}/${currentId}` : API_URL;
            await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            showAlert(currentId ? 'Cập nhật tour thành công' : 'Thêm tour mới thành công');

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
            const res = await fetch(`${API_URL}?page=0&size=1000&sort=itemId,desc`);
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