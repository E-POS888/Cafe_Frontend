/**
 * Js/admin.js - 主管與財務後台邏輯
 */

const ADMIN_SECRET = "admin123";
let allMembers = []; // 儲存所有會員資料以供搜尋過濾

function verifyAdmin() {
  const inputPwd = document.getElementById("admin-password").value;
  if (inputPwd === ADMIN_SECRET) {
    document.getElementById("auth-overlay").style.display = "none";
    loadProductsForAdmin();
    loadMembersForAdmin(); // 登入後同時載入會員資料
  } else {
    alert("密碼錯誤，請重新輸入！");
    document.getElementById("admin-password").value = "";
  }
}

function switchTab(sectionId, btnElement) {
  document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(sectionId).classList.add('active');
  btnElement.classList.add('active');
}

// 載入商品列表
async function loadProductsForAdmin() {
  const tbody = document.getElementById("admin-product-list");
  tbody.innerHTML = '<tr><td colspan="6">正在連線資料庫...</td></tr>';
  
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "getMenu" })
    });
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
            <button class="action-btn ${btnClass}" onclick="toggleProduct('${item["商品編號"]}', '${item["商品狀態"]}')">${btnText}</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } else {
      tbody.innerHTML = '<tr><td colspan="6">無商品資料。</td></tr>';
    }
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="6" style="color:red;">載入失敗，請檢查網路設定。</td></tr>';
  }
}

async function toggleProduct(productId, currentStatus) {
  if (!confirm(`確定要將此商品設為「${currentStatus === '上架' ? '下架' : '上架'}」嗎？`)) return;
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "toggleProduct", productId: productId, currentStatus: currentStatus })
    });
    const result = await response.json();
    if (result.success) {
      loadProductsForAdmin(); 
    } else {
      alert("更新失敗：" + result.message);
    }
  } catch (error) {
    alert("系統連線錯誤");
  }
}

// 新增：載入會員列表
async function loadMembersForAdmin() {
  const tbody = document.getElementById("admin-member-list");
  tbody.innerHTML = '<tr><td colspan="5">正在連線資料庫...</td></tr>';
  
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "getAllUsers" })
    });
    const result = await response.json();
    
    if (result.success) {
      allMembers = result.data;
      renderMembers(allMembers); // 渲染畫面
    } else {
      tbody.innerHTML = '<tr><td colspan="5">無法取得會員資料</td></tr>';
    }
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:red;">載入失敗</td></tr>';
  }
}

// 渲染會員表格
function renderMembers(dataToRender) {
  const tbody = document.getElementById("admin-member-list");
  tbody.innerHTML = "";
  
  if (dataToRender.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">無符合條件的會員</td></tr>';
    return;
  }
  
  dataToRender.forEach(user => {
    // 處理手機號碼開頭的單引號
    let phoneStr = user["電話號碼(必填)"] ? user["電話號碼(必填)"].toString().replace(/^'/, '') : "";
    let extraInfo = [user["寰宇大樓樓層(選填)"], user["其他備註(選填)"]].filter(Boolean).join(" / ");
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight:bold;">${user["姓名(可變更)"]}</td>
      <td>${phoneStr}</td>
      <td>${extraInfo}</td>
      <td><span style="padding:4px 8px; border-radius:12px; background:${user["系統權限"] === '管理員' ? '#e65100' : '#e0e0e0'}; color:${user["系統權限"] === '管理員' ? '#fff' : '#333'}; font-size:12px;">${user["系統權限"]}</span></td>
      <td style="font-size:13px; color:#666;">${user["註冊時間"]}</td>
    `;
    tbody.appendChild(tr);
  });
}

// 搜尋過濾功能
function filterMembers() {
  const keyword = document.getElementById("member-search").value.toLowerCase();
  if (!keyword) {
    renderMembers(allMembers);
    return;
  }
  
  const filtered = allMembers.filter(user => {
    const name = (user["姓名(可變更)"] || "").toLowerCase();
    const phone = (user["電話號碼(必填)"] || "").toString().toLowerCase();
    const note = (user["寰宇大樓樓層(選填)"] || "") + " " + (user["其他備註(選填)"] || "");
    return name.includes(keyword) || phone.includes(keyword) || note.toLowerCase().includes(keyword);
  });
  
  renderMembers(filtered);
}

async function executeArchive(type) {
  const confirmMsg = type === 'daily' ? "確定要執行【每日結算歸檔】嗎？這將鎖定今日資料。" : "確定要執行【週期歸檔】嗎？";
  if (!confirm(confirmMsg)) return;

  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "executeArchive", type: type })
    });
    const result = await response.json();
    if (result.success) alert("✅ " + result.message);
    else alert("❌ 執行失敗：" + result.error);
  } catch (error) {
    alert("系統連線錯誤");
  }
}

document.getElementById("admin-password").addEventListener("keypress", function(event) {
  if (event.key === "Enter") verifyAdmin();
});
