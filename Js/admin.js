/**
 * Js/admin.js - 主管與財務後台邏輯
 */

// 預設主管密碼 (供測試使用)
const ADMIN_SECRET = "admin123";

/**
 * 驗證主管密碼 (成功後解除遮罩)
 */
function verifyAdmin() {
  const inputPwd = document.getElementById("admin-password").value;
  if (inputPwd === ADMIN_SECRET) {
    document.getElementById("auth-overlay").style.display = "none";
    // 登入成功後載入商品資料
    loadProductsForAdmin();
  } else {
    alert("密碼錯誤，請重新輸入！");
    document.getElementById("admin-password").value = "";
  }
}

/**
 * 切換左側導覽列頁籤
 */
function switchTab(sectionId, btnElement) {
  // 隱藏所有區塊
  const sections = document.querySelectorAll('.section');
  sections.forEach(sec => sec.classList.remove('active'));
  
  // 移除所有按鈕的 active 狀態
  const btns = document.querySelectorAll('.nav-btn');
  btns.forEach(btn => btn.classList.remove('active'));
  
  // 顯示選中的區塊並標示按鈕
  document.getElementById(sectionId).classList.add('active');
  btnElement.classList.add('active');
}

/**
 * 載入商品列表 (呼叫後端 API)
 */
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
        // 判斷按鈕樣式
        const btnClass = item["商品狀態"] === "上架" ? "btn-danger" : "btn-success";
        const btnText = item["商品狀態"] === "上架" ? "設為下架" : "設為上架";
        
        tr.innerHTML = `
          <td>${item["商品編號"]}</td>
          <td>${item["商品名稱"]}</td>
          <td>${item["大類別"]}</td>
          <td>$${item["預設價格"]}</td>
          <td><strong>${item["商品狀態"]}</strong></td>
          <td>
            <button class="action-btn ${btnClass}" onclick="alert('預留功能：發送狀態更新至後端 API')">${btnText}</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } else {
      tbody.innerHTML = '<tr><td colspan="6">無商品資料。</td></tr>';
    }
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="6" style="color:red;">載入失敗，請檢查網路或 API 設定。</td></tr>';
    console.error(error);
  }
}

/**
 * 執行財務歸檔
 * @param {string} type - 'daily' 或 'periodic'
 */
function executeArchive(type) {
  // 再次進行雙重確認
  const confirmMsg = type === 'daily' ? "確定要執行【每日結算歸檔】嗎？這將鎖定今日資料。" : "確定要執行【週/月週期歸檔】嗎？";
  if (!confirm(confirmMsg)) return;

  // 預留：這裡將發送 POST 請求至 GAS 觸發 archiveDailyFinances 或 archivePeriodicFinances
  alert(`已傳送 [${type}] 歸檔指令至後台。`);
}

// 監聽 Enter 鍵快速登入
document.getElementById("admin-password").addEventListener("keypress", function(event) {
  if (event.key === "Enter") {
    verifyAdmin();
  }
});
