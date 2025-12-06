const API_URL = "http://localhost:8080/api/v1/orders";

document.addEventListener('DOMContentLoaded', function () {
    loadOrders();
});
let currentOrderId = null;
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
// Load danh sách đơn hàng
function loadOrders() {
    if ($.fn.DataTable.isDataTable('#orderTable')) {
        $('#orderTable').DataTable().ajax.reload();
        return;
    }

    $('#orderTable').DataTable({
        serverSide: true,
        processing: true,
        searching: true,
        autoWidth: false,
        lengthChange: true,
        pageLength: 5,
        lengthMenu: [[5, 10, 25, 50], [5, 10, 25, 50]],
        order: [[0, 'desc']],
        ajax: function (data, callback) {
            const page = Math.floor(data.start / data.length);
            const size = data.length;
            const keyword = data.search.value || '';
            const sortColIndex = data.order[0]?.column;
            const columnMap = ['orderId', 'tourName', 'orderDate', 'totalPrice', 'status'];
            const sortCol = columnMap[sortColIndex] || 'orderId';
            const sortDir = data.order.length > 0 ? data.order[0].dir : 'desc';
            const url = `${API_URL}?page=${page}&size=${size}&sort=${sortCol},${sortDir}&keyword=${encodeURIComponent(keyword)}`;

            authFetch (url)
                .then(res => res.json())
                .then(json => {
                    document.getElementById('totalOrder').textContent = json.totalElements;
                    callback({
                        recordsTotal: json.totalElements,
                        recordsFiltered: json.totalElements,
                        data: json.content
                    });
                })
                .catch(err => {
                    alert("Lỗi tải dữ liệu: " + err.message);
                    callback({ data: [] });
                });
        },
        columns: [
            { data: 'orderId', title: 'Mã đơn hàng', render: id => `#ORD${String(id).padStart(4, '0')}` },
            { data: 'tourName', title: 'Tên chuyến đi', render: d => d || '-' },
            { data: 'orderDate', title: 'Ngày đặt', render: d => new Date(d).toLocaleDateString('vi-VN') },
            { data: 'totalPrice', title: 'Tổng tiền (VND)', render: p => p ? p.toLocaleString('vi-VN') + ' ₫' : '-' },
            {
                data: 'status', title: 'Trạng thái', render: s => {
                    if (s === 0) return '<span class="badge bg-warning text-dark">Đang xử lý</span>';
                    if (s === 1) return '<span class="badge bg-primary">Đang đi</span>';
                    if (s === 2) return '<span class="badge bg-success">Hoàn thành</span>';
                    if (s === 3) return '<span class="badge bg-danger">Đã hủy</span>';
                    return '<span class="badge bg-secondary">Không xác định</span>';
                }
            },
            {
                data: null,
                className: "text-center",
                orderable: false,
                render: function (r) {
                    let buttons = `
            <button class="btn btn-sm btn-primary me-1" onclick="showOrderDetail(${r.orderId})">
                <i class="bi bi-eye"></i> Xem
            </button>`;

                    // Ẩn nút Hủy nếu đơn hàng đã hoàn thành (2) hoặc đã hủy (3)
                    if (r.status !== 2 && r.status !== 3) {
                        buttons += `
                <button class="btn btn-sm btn-danger" onclick="cancelOrder(${r.orderId})">
                    <i class="bi bi-x-circle"></i> Hủy
                </button>`;
                    }

                    return buttons;
                }
            }


        ],
        language: {
            searchPlaceholder: "🔎 Tìm kiếm đơn hàng...",
            search: "",
            lengthMenu: "_MENU_ / dòng",
            info: "Hiển thị _START_–_END_ / _TOTAL_ đơn hàng",
            zeroRecords: "Không tìm thấy dữ liệu",
            loadingRecords: "Đang tải...",
            paginate: { previous: "←", next: "→" }
        }
    });
}

// Xem chi tiết đơn hàng
function showOrderDetail(orderId) {
    authFetch (`${API_URL}/${orderId}`)
        .then(res => res.json())
        .then(data => {
            // Gán thông tin đơn hàng
            document.getElementById('orderId').textContent = `#ORD${String(data.orderId).padStart(4, '0')}`;
            document.getElementById('orderTourName').textContent = data.tourName;
            document.getElementById('orderDate').textContent = new Date(data.orderDate).toLocaleDateString('vi-VN');
            document.getElementById('orderCustomer').textContent = data.customerName;
            document.getElementById('orderTotal').textContent = data.totalPrice.toLocaleString('vi-VN') + " ₫";
            document.getElementById('orderPeople').textContent = data.amountTicket || 1;

            // Render trạng thái (text + màu)
            const statusContainer = document.getElementById('orderStatus');
            statusContainer.innerHTML = renderStatusBadge(data.status);
            // Ẩn/hiện nút hủy trong modal
            const cancelBtn = document.getElementById('cancelOrderBtn');
            if (data.status === 2 || data.status === 3) {
                cancelBtn.style.display = "none";
            } else {
                cancelBtn.style.display = "inline-block";
            }

            // Gán hành vi cho nút hủy → GỌI LẠI HÀM cancelOrder(orderId)
            cancelBtn.onclick = function () {
                cancelOrder(data.orderId, true); // true = đang gọi từ modal
            };
            currentOrderId = data.orderId;
            // Mở modal
            const modal = new bootstrap.Modal(document.getElementById('detailorder'));
            modal.show();
        })
        .catch(err => {
            alert("Lỗi tải chi tiết đơn hàng: " + err.message);
        });
}

// Helper: render badge màu cho trạng thái
function renderStatusBadge(status) {
    switch (status) {
        case 0:
            return `<span class="badge bg-warning text-dark">Đang xử lý</span>`;
        case 1:
            return `<span class="badge bg-primary">Đang đi</span>`;
        case 2:
            return `<span class="badge bg-success">Hoàn thành</span>`;
        case 3:
            return `<span class="badge bg-danger">Hủy</span>`;
        default:
            return `<span class="badge bg-secondary">Không xác định</span>`;
    }
}


// Hủy đơn hàng
function cancelOrder(orderId, fromModal = false) {
    if (!confirm("Bạn có chắc muốn hủy đơn hàng này không?")) return;

    authFetch (`${API_URL}/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: 3 })
    })
        .then(res => {
            if (res.ok) {
                alert("Đơn hàng đã được hủy!");
                // Nếu gọi từ modal → đóng modal
                if (fromModal) {
                    const modal = bootstrap.Modal.getInstance(document.getElementById('detailorder'));
                    if (modal) modal.hide();
                }
                // Reload lại bảng
                $('#orderTable').DataTable().ajax.reload();
            } else {
                alert("Không thể hủy đơn hàng!");
            }
        })
        .catch(err => alert("Lỗi: " + err.message));
}
// Tính tổng doanh thu
async function updateTotalPayment() {
    try {
        const res = await authFetch (`${API_URL}?page=0&size=1000&sort=orderId,desc`);
        if (!res.ok) throw new Error("Không thể tải dữ liệu đơn hàng");

        const data = await res.json();

        const totalRevenue = (data.content || [])
            .filter(o => o.status === 2)
            .reduce((sum, o) => sum + (o.totalPrice || 0), 0);

        const formatted = totalRevenue.toLocaleString("vi-VN", {
            style: "currency",
            currency: "VND"
        });

        document.getElementById("totalPayment").innerText = formatted;
    } catch (err) {
        console.error("Lỗi khi tính tổng doanh thu:", err);
        document.getElementById("totalPayment").innerText = "0 VND";
    }
}

updateTotalPayment();
function printInvoice(orderId) {
    authFetch (`${API_URL}/${orderId}`)
        .then(res => res.json())
        .then(data => {
            const invoiceDiv = document.createElement("div");
            invoiceDiv.id = "invoice-print-area";
            invoiceDiv.innerHTML = `
                     <div id="invoice-content">
                                <h2> CÔNG TY DU LỊCH ABC</h2>
                                <p style="text-align:center">
                                    Địa chỉ: "123 Đường ABC, Quận 1, TP.HCM"<br>
                                    Điện thoại:"0123-456-789"
                                    <br>
                                    Website: "www.tourcompany.com" 

                                </p>
                                <h3>HÓA ĐƠN THANH TOÁN</h3>
                                <p><b>Số hóa đơn:</b>#ORD${String(data.orderId).padStart(4, '0')}</p>
                                <p><b>Ngày xuất:</b> ${new Date().toLocaleDateString('vi-VN')}</p>

                                <h4>THÔNG TIN KHÁCH HÀNG</h4>
                                <p>Họ tên khách hàng : ${data.customerName}</p>
                                <p>Mã đơn hàng: BK${data.orderId}</p>
                                <h4>THÔNG TIN TOUR</h4>
                                <table>
                                    <tr>
                                        <td class="title">Tên tour:</td>
                                        <td>${data.tourName}</td>
                                    </tr>
                                    <tr>
                                        <td class="title">Tổng tiền:</td>
                                        <td>${data.totalPrice.toLocaleString('vi-VN')}₫</td>
                                    </tr>
                                    <tr>
                                        <td class="title">Đã thanh toán:</td>
                                        <td>${data.totalPrice.toLocaleString('vi-VN')}₫</td>
                                    </tr>
                                    <tr>
                                        <td class="title">Còn lại:</td>
                                        <td>0₫</td>
                                    </tr>
                                </table>

                                <h4>THÔNG TIN THANH TOÁN</h4>
                                <p>Phương thức: Chuyển khoản</p>
                                <p>Ngày thanh toán: ${new Date(data.orderDate).toLocaleDateString('vi-VN')}</p>
                                <p>Mã giao dịch: TXN${data.orderId}${Math.floor(Math.random() * 10000)}</p>

                                <p style="margin-top:30px;text-align:center">
                                    Cảm ơn quý khách đã sử dụng dịch vụ!<br>
                                    --- Hóa đơn được in tự động ---
                                </p>
                                </div>`;

            //     // 🔥 Ghi vào vùng in tạm thời
            //     const printArea = document.createElement("div");
            //     printArea.innerHTML = html;
            //     printArea.style.display = "none"; // ẩn khỏi UI
            //     document.body.appendChild(printArea);

            //     // In nội dung
            //     const originalContent = document.body.innerHTML;
            //     document.body.innerHTML = html;
            //     window.print();

            //     // Sau khi in xong, khôi phục lại giao diện gốc
            //     document.body.innerHTML = originalContent;
            //     location.reload(); //
            // })
            // Gắn vào body (ẩn bình thường)
            document.body.appendChild(invoiceDiv);
            window.print(); // 👉 Chỉ in phần này (nhờ CSS)
            document.body.removeChild(invoiceDiv); // Dọn dẹp
        })
        .catch(err => alert("Lỗi khi in hóa đơn: " + err.message));
}


