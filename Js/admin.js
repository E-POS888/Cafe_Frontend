/**
 * Js/admin.js - 主管與財務後台邏輯 (圖片壓縮與動態分類)
 */
const ADMIN_SECRET = "admin123";
let allMembers = []; 
let currentCategories = [];
let pendingImageBase64 = null; // 儲存壓縮後的圖片

function verifyAdmin() {
  if (document.getElementById("admin-password").value === ADMIN_SECRET) {
    document.getElementById("auth-overlay").style.display = "none";
    loadAllData();
  } else { alert("密碼錯誤"); document.getElementById("admin-password").value = ""; }
}

function loadAllData() { loadDailyStats(); loadProductsForAdmin(); loadMembersForAdmin(); loadAuditLogs(); }

function switchTab(sectionId, btnElement) {
  document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(sectionId).classList.add('active');
  btnElement.classList.add('active');
  if(sectionId === 'finance-sec') loadDailyStats();
  if(sectionId === 'log-sec') loadAuditLogs();
}

async function loadDailyStats() {
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, { method: "POST", body: JSON.stringify({ action: "getDailyStats" }) });
    const result = await response.json();
    if(result.success) {
      document.getElementById("finance-date").textContent = result.data.date; // 顯示日期
      document.getElementById("dash-revenue").textContent = "$" + result.data.totalRevenue;
      document.getElementById("dash-orders").textContent = result.data.orderCount;
      const salesObj = result.data.itemSales;
      const tbody = document.getElementById("sales-breakdown-list"); tbody.innerHTML = "";
      if(Object.keys(salesObj).length === 0) {
        document.getElementById("dash-top-item").textContent = "-"; tbody.innerHTML = "<tr><td colspan='2'>今日尚無銷售</td></tr>"; return;
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

async function loadProductsForAdmin() {
  const tbody = document.getElementById("admin-product-list"); tbody.innerHTML = '<tr><td colspan="7">載入中...</td></tr>';
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, { method: "POST", body: JSON.stringify({ action: "getMenu" }) });
    const result = await response.json();
    if (result.success) {
      tbody.innerHTML = "";
      currentCategories = [...new Set(result.data.map(i => i["大類別"]))].filter(Boolean); // 收集不重複的大類別
      
      result.data.forEach(item => {
        const btnClass = item["商品狀態"] === "上架" ? "btn-danger" : "btn-success";
        const btnText = item["商品狀態"] === "上架" ? "設為下架" : "設為上架";
        const imgHtml = item["照片網址(Drive)"] ? `<img src="${item["照片網址(Drive)"]}" style="width:40px; height:40px; border-radius:4px; object-fit:cover;">` : "無";
        tbody.innerHTML += `<tr><td>${imgHtml}</td><td>${item["商品編號"]}</td><td>${item["商品名稱"]}</td><td>${item["大類別"]}</td><td>$${item["預設價格"]}</td><td><strong>${item["商品狀態"]}</strong></td>
          <td><button class="action-btn" style="background:#1976D2; margin-right:5px;" onclick="openProductModal('${item["商品編號"]}','${item["商品名稱"]}','${item["大類別"]}',${item["預設價格"]})">編輯</button><button class="action-btn ${btnClass}" onclick="toggleProduct('${item["商品編號"]}','${item["商品狀態"]}')">${btnText}</button></td></tr>`;
      });
    }
  } catch (e) {}
}

async function toggleProduct(id, status) {
  if (!confirm(`確定要${status === '上架' ? '下架' : '上架'}此商品嗎？`)) return;
  try {
    const res = await fetch(APP_CONFIG.GAS_API_URL, { method: "POST", body: JSON.stringify({ action: "toggleProduct", productId: id, currentStatus: status }) });
    const result = await res.json();
    if (result.success) loadProductsForAdmin();
  } catch (e) {}
}

// 圖片壓縮邏輯 (Canvas)
document.getElementById('edit-prod-img').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = function(event) {
    const img = new Image();
    img.src = event.target.result;
    img.onload = function() {
      // 設定縮圖最大尺寸 600px
      const MAX_WIDTH = 600; const MAX_HEIGHT = 600;
      let width = img.width; let height = img.height;
      if (width > height && width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } 
      else if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
      
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      // 壓縮為 JPEG，品質 0.7 (保證 < 5MB，通常在 100KB 左右)
      pendingImageBase64 = canvas.toDataURL('image/jpeg', 0.7);
      
      document.getElementById('img-preview').src = pendingImageBase64;
      document.getElementById('img-preview-container').style.display = "block";
    }
  }
});

function openProductModal(id = "", name = "", cat = "", price = "") {
  document.getElementById("edit-prod-mode").value = id ? "edit" : "add";
  document.getElementById("product-modal-title").textContent = id ? "編輯商品" : "新增商品";
  document.getElementById("edit-prod-id").value = id;
  document.getElementById("edit-prod-id").disabled = id ? true : false;
  document.getElementById("edit-prod-name").value = name;
  document.getElementById("edit-prod-price").value = price;
  
  // 重置圖片
  document.getElementById('edit-prod-img').value = "";
  pendingImageBase64 = null;
  document.getElementById('img-preview-container').style.display = "none";
  
  // 建立大類別下拉選單
  const selectCat = document.getElementById("edit-prod-cat");
  selectCat.innerHTML = "";
  currentCategories.forEach(c => { selectCat.innerHTML += `<option value="${c}">${c}</option>`; });
  if (cat && currentCategories.includes(cat)) selectCat.value = cat;
  
  document.getElementById("product-modal").classList.add("active");
}

function promptNewCategory() {
  const newCat = prompt("請輸入新的大類別名稱：");
  if (newCat && newCat.trim() !== "") {
    if (!currentCategories.includes(newCat.trim())) {
      currentCategories.push(newCat.trim());
      const selectCat = document.getElementById("edit-prod-cat");
      selectCat.innerHTML += `<option value="${newCat.trim()}">${newCat.trim()}</option>`;
    }
    document.getElementById("edit-prod-cat").value = newCat.trim();
  }
}

async function saveProduct() {
  const mode = document.getElementById("edit-prod-mode").value;
  const data = {
    id: document.getElementById("edit-prod-id").value.trim(),
    name: document.getElementById("edit-prod-name").value.trim(),
    category: document.getElementById("edit-prod-cat").value,
    price: document.getElementById("edit-prod-price").value,
    imageBase64: pendingImageBase64 // 夾帶壓縮後的圖片
  };
  if(!data.id || !data.name || !data.price) { alert("請填寫完整資訊"); return; }
  
  document.getElementById('save-prod-btn').textContent = "上傳中...";
  document.getElementById('save-prod-btn').disabled = true;
  
  try {
    const res = await fetch(APP_CONFIG.GAS_API_URL, { method: "POST", body: JSON.stringify({ action: mode === "edit" ? "updateProduct" : "addProduct", productData: data }) });
    const result = await res.json();
    if (result.success) {
      alert("儲存成功");
      document.getElementById("product-modal").classList.remove("active");
      loadProductsForAdmin();
    } else { alert("儲存失敗"); }
  } catch (e) { alert("連線錯誤"); }
  
  document.getElementById('save-prod-btn').textContent = "儲存上傳";
  document.getElementById('save-prod-btn').disabled = false;
}

// 報表與日誌
async function loadMembersForAdmin() {
  try {
    const res = await fetch(APP_CONFIG.GAS_API_URL, { method: "POST", body: JSON.stringify({ action: "getAllUsers" }) });
    const result = await res.json();
    if (result.success) { allMembers = result.data; renderMembers(allMembers); }
  } catch (e) {}
}
function renderMembers(dataToRender) {
  const tbody = document.getElementById("admin-member-list"); tbody.innerHTML = "";
  if (dataToRender.length === 0) { tbody.innerHTML = '<tr><td colspan="5">無資料</td></tr>'; return; }
  dataToRender.forEach(u => {
    let p = u["電話號碼(必填)"] ? u["電話號碼(必填)"].toString().replace(/^'/, '') : "";
    let e = [u["寰宇大樓樓層(選填)"], u["其他備註(選填)"]].filter(Boolean).join(" / ");
    tbody.innerHTML += `<tr><td style="font-weight:bold;">${u["姓名(可變更)"]}</td><td>${p}</td><td>${e}</td><td><span style="padding:4px 8px; border-radius:12px; background:${u["系統權限"] === '管理員' ? '#e65100' : '#e0e0e0'}; color:${u["系統權限"] === '管理員' ? '#fff' : '#333'}; font-size:12px;">${u["系統權限"]}</span></td><td style="font-size:13px; color:#666;">${u["註冊時間"]}</td></tr>`;
  });
}
function filterMembers() {
  const k = document.getElementById("member-search").value.toLowerCase();
  renderMembers(!k ? allMembers : allMembers.filter(u => (u["姓名(可變更)"]||"").toLowerCase().includes(k) || (u["電話號碼(必填)"]||"").toString().includes(k)));
}
async function loadAuditLogs() {
  const tbody = document.getElementById("admin-log-list");
  try {
    const res = await fetch(APP_CONFIG.GAS_API_URL, { method: "POST", body: JSON.stringify({ action: "getAuditLogs" }) });
    const result = await res.json();
    if(result.success) {
      tbody.innerHTML = result.data.length === 0 ? '<tr><td colspan="4">尚無日誌</td></tr>' : result.data.map(l => `<tr><td>${l.time}</td><td><strong>${l.operator}</strong></td><td>${l.action}</td><td>${l.details}</td></tr>`).join('');
    }
  } catch(e) {}
}
document.getElementById("admin-password").addEventListener("keypress", function(e) { if (e.key === "Enter") verifyAdmin(); });
