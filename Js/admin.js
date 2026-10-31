/**
 * Js/admin.js - 主管與財務後台邏輯
 */

const ADMIN_SECRET = "admin123";
let allMembers = []; 
let currentOperator = "系統管理員"; // 預設操作者

function verifyAdmin() {
  const inputPwd = document.getElementById("admin-password").value;
  if (inputPwd === ADMIN_SECRET) {
    document.getElementById("auth-overlay").style.display = "none";
    // 如果未來後台有自己獨立的 LINE 登入，可以在這裡抓取姓名取代系統管理員
    loadAllData();
  } else {
    alert("密碼錯誤，請重新輸入！");
    document.getElementById("admin-password").value = "";
  }
}

function loadAllData() {
  loadDailyStats();
  loadProductsForAdmin();
  loadMembersForAdmin(); 
  loadAuditLogs();
}

function switchTab(sectionId, btnElement) {
  document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(sectionId).classList.add('active');
  btnElement.classList.add('active');
  if(sectionId === 'finance-sec') loadDailyStats();
  if(sectionId === 'log-sec') loadAuditLogs();
}

// 載入當日財務報表
async function loadDailyStats() {
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, { method: "POST", body: JSON.stringify({ action: "getDailyStats" }) });
    const result = await response.json();
    if(result.success) {
      document.getElementById("dash-revenue").textContent = "$" + result.data.totalRevenue;
      document.getElementById("dash-orders").textContent = result.data.orderCount;
      
      const salesObj = result.data.itemSales;
      const tbody = document.getElementById("sales-breakdown-list");
      tbody.innerHTML = "";
      
      if(Object.keys(salesObj).length === 0) {
        document.getElementById("dash-top-item").textContent = "-";
        tbody.innerHTML = "<tr><td colspan='2'>今日尚無銷售</td></tr>";
        return;
      }
      
      let topItem = ""; let maxQty = 0;
      for (const [name, qty] of Object.entries(salesObj)) {
        if (qty > maxQty) { maxQty = qty; topItem = name; }
        tbody.innerHTML += `<tr><td>${name}</td><td>${qty}</td></tr>`;
      }
      document.getElementById("dash-top-item").textContent = `${topItem} (${maxQty}杯)`;
    }
  } catch(e) {}
}

// 載入操作日誌
async function loadAuditLogs() {
  const tbody = document.getElementById("admin-log-list");
  tbody.innerHTML = '<tr><td colspan="4">載入中...</td></tr>';
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, { method: "POST", body: JSON.stringify({ action: "getAuditLogs" }) });
    const result = await response.json();
    if(result.success) {
      tbody.innerHTML = "";
      if(result.data.length === 0) { tbody.innerHTML = '<tr><td colspan="4">尚無日誌</td></tr>'; return; }
      result.data.forEach(log => {
        tbody.innerHTML += `<tr><td>${log.time}</td><td><strong>${log.operator}</strong></td><td>${log.action}</td><td>${log.details}</td></tr>`;
      });
    }
  } catch(e) {}
}

// 商品管理
async function loadProductsForAdmin() {
  const tbody = document.getElementById("admin-product-list");
  tbody.innerHTML = '<tr><td colspan="6">載入中...</td></tr>';
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, { method: "POST", body: JSON.stringify({ action: "getMenu" }) });
    const result = await response.json();
    if (result.success && result.data.length > 0) {
      tbody.innerHTML = "";
      result.data.forEach(item => {
        const tr = document.createElement("tr");
        const btnClass = item["商品狀態"] === "上架" ? "btn-danger" : "btn-success";
        const btnText = item["商品狀態"] === "上架" ? "設為下架" : "設為上架";
        tr.innerHTML = `
          <td>${item["商品編號"]}</td>
          <td>${item["商品名稱"]}</td>
          <td>${item["大類別"]}</td>
          <td>$${item["預設價格"]}</td>
          <td><strong>${item["商品狀態"]}</strong></td>
          <td>
            <button class="action-btn" style="background:#1976D2; margin-right:5px;" onclick="openProductModal('${item["商品編號"]}', '${item["商品名稱"]}', '${item["大類別"]}', ${item["預設價格"]})">編輯</button>
            <button class="action-btn ${btnClass}" onclick="toggleProduct('${item["商品編號"]}', '${item["商品狀態"]}')">${btnText}</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (error) {}
}

async function toggleProduct(productId, currentStatus) {
  if (!confirm(`確定要將此商品設為「${currentStatus === '上架' ? '下架' : '上架'}」嗎？`)) return;
  try {
    const res = await fetch(APP_CONFIG.GAS_API_URL, { method: "POST", body: JSON.stringify({ action: "toggleProduct", productId: productId, currentStatus: currentStatus }) });
    const result = await res.json();
    if (result.success) loadProductsForAdmin(); 
    else alert("更新失敗");
  } catch (error) { alert("連線錯誤"); }
}

function openProductModal(id = "", name = "", cat = "", price = "") {
  document.getElementById("edit-prod-mode").value = id ? "edit" : "add";
  document.getElementById("product-modal-title").textContent = id ? "編輯商品" : "新增商品";
  document.getElementById("edit-prod-id").value = id;
  document.getElementById("edit-prod-id").disabled = id ? true : false; // 編輯時不允許改編號
  document.getElementById("edit-prod-name").value = name;
  document.getElementById("edit-prod-cat").value = cat;
  document.getElementById("edit-prod-price").value = price;
  document.getElementById("product-modal").classList.add("active");
}

async function saveProduct() {
  const mode = document.getElementById("edit-prod-mode").value;
  const data = {
    id: document.getElementById("edit-prod-id").value.trim(),
    name: document.getElementById("edit-prod-name").value.trim(),
    category: document.getElementById("edit-prod-cat").value.trim(),
    price: document.getElementById("edit-prod-price").value,
    desc: ""
  };
  if(!data.id || !data.name || !data.price) { alert("請填寫完整資訊"); return; }
  
  const action = mode === "edit" ? "updateProduct" : "addProduct";
  try {
    const res = await fetch(APP_CONFIG.GAS_API_URL, { method: "POST", body: JSON.stringify({ action: action, productData: data }) });
    const result = await res.json();
    if (result.success) {
      alert("儲存成功");
      document.getElementById("product-modal").classList.remove("active");
      loadProductsForAdmin();
    } else { alert("儲存失敗：" + result.message); }
  } catch (e) { alert("連線錯誤"); }
}

// 會員管理
async function loadMembersForAdmin() {
  const tbody = document.getElementById("admin-member-list");
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, { method: "POST", body: JSON.stringify({ action: "getAllUsers" }) });
    const result = await response.json();
    if (result.success) {
      allMembers = result.data;
      renderMembers(allMembers);
    }
  } catch (error) {}
}

function renderMembers(dataToRender) {
  const tbody = document.getElementById("admin-member-list"); tbody.innerHTML = "";
  if (dataToRender.length === 0) { tbody.innerHTML = '<tr><td colspan="5">無符合條件的會員</td></tr>'; return; }
  dataToRender.forEach(user => {
    let phoneStr = user["電話號碼(必填)"] ? user["電話號碼(必填)"].toString().replace(/^'/, '') : "";
    let extraInfo = [user["寰宇大樓樓層(選填)"], user["其他備註(選填)"]].filter(Boolean).join(" / ");
    tbody.innerHTML += `<tr><td style="font-weight:bold;">${user["姓名(可變更)"]}</td><td>${phoneStr}</td><td>${extraInfo}</td><td><span style="padding:4px 8px; border-radius:12px; background:${user["系統權限"] === '管理員' ? '#e65100' : '#e0e0e0'}; color:${user["系統權限"] === '管理員' ? '#fff' : '#333'}; font-size:12px;">${user["系統權限"]}</span></td><td style="font-size:13px; color:#666;">${user["註冊時間"]}</td></tr>`;
  });
}

function filterMembers() {
  const keyword = document.getElementById("member-search").value.toLowerCase();
  if (!keyword) { renderMembers(allMembers); return; }
  const filtered = allMembers.filter(user => {
    return (user["姓名(可變更)"]||"").toLowerCase().includes(keyword) || (user["電話號碼(必填)"]||"").toString().includes(keyword);
  });
  renderMembers(filtered);
}

async function executeArchive(type) {
  const msg = type === 'daily' ? "確定要執行【每日結算歸檔】嗎？" : "確定要執行【週期歸檔】嗎？";
  if (!confirm(msg)) return;
  try {
    const res = await fetch(APP_CONFIG.GAS_API_URL, { method: "POST", body: JSON.stringify({ action: "executeArchive", type: type }) });
    const result = await res.json();
    if (result.success) alert("✅ 執行成功");
  } catch (error) { alert("連線錯誤"); }
}

document.getElementById("admin-password").addEventListener("keypress", function(event) { if (event.key === "Enter") verifyAdmin(); });
