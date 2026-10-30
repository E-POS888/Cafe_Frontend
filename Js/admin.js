/**
 * Js/admin.js - 主管與財務後台邏輯 (串接後端完整版)
 */

const ADMIN_SECRET = "admin123";

function verifyAdmin() {
  const inputPwd = document.getElementById("admin-password").value;
  if (inputPwd === ADMIN_SECRET) {
    document.getElementById("auth-overlay").style.display = "none";
    loadProductsForAdmin();
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

// 發送切換商品狀態請求
async function toggleProduct(productId, currentStatus) {
  if (!confirm(`確定要將此商品設為「${currentStatus === '上架' ? '下架' : '上架'}」嗎？`)) return;
  
  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({ 
        action: "toggleProduct", 
        productId: productId, 
        currentStatus: currentStatus 
      })
    });
    const result = await response.json();
    if (result.success) {
      alert("狀態更新成功！");
      loadProductsForAdmin(); // 重新載入列表刷新畫面
    } else {
      alert("更新失敗：" + result.message);
    }
  } catch (error) {
    alert("系統連線錯誤");
  }
}

// 發送財務歸檔請求
async function executeArchive(type) {
  const confirmMsg = type === 'daily' ? "確定要執行【每日結算歸檔】嗎？這將鎖定今日資料。" : "確定要執行【週期歸檔】嗎？";
  if (!confirm(confirmMsg)) return;

  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "executeArchive", type: type })
    });
    const result = await response.json();
    if (result.success) {
      alert("✅ " + result.message);
    } else {
      alert("❌ 執行失敗：" + result.error);
    }
  } catch (error) {
    alert("系統連線錯誤");
  }
}

document.getElementById("admin-password").addEventListener("keypress", function(event) {
  if (event.key === "Enter") verifyAdmin();
});
