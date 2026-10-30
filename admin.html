<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Café Connect - 主管與財務後台</title>
  <style>
    :root { --primary-color: #8D6E63; --secondary-color: #D7CCC8; --bg-color: #FAFAFA; --text-main: #3E2723; --white: #FFFFFF; --danger: #d32f2f; --success: #388e3c; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: var(--bg-color); color: var(--text-main); margin: 0; display: flex; height: 100vh; overflow: hidden; }
    .sidebar { width: 250px; background-color: var(--primary-color); color: var(--white); display: flex; flex-direction: column; }
    .sidebar-header { padding: 20px; font-size: 20px; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.2); text-align: center; }
    .nav-btn { padding: 15px 20px; background: none; border: none; color: var(--white); text-align: left; font-size: 16px; cursor: pointer; transition: 0.3s; }
    .nav-btn:hover, .nav-btn.active { background-color: rgba(255,255,255,0.2); font-weight: bold; }
    .main-content { flex: 1; padding: 30px; overflow-y: auto; }
    .section { display: none; background: var(--white); padding: 25px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .section.active { display: block; }
    h2 { margin-top: 0; border-bottom: 2px solid var(--secondary-color); padding-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 12px; border-bottom: 1px solid #eee; text-align: left; }
    th { background-color: var(--secondary-color); color: var(--text-main); }
    .action-btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; color: var(--white); }
    .btn-primary { background-color: var(--primary-color); }
    .btn-danger { background-color: var(--danger); }
    .btn-success { background-color: var(--success); }
    #auth-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; display: flex; justify-content: center; align-items: center; }
    .auth-box { background: var(--white); padding: 30px; border-radius: 12px; text-align: center; }
    .auth-box input { padding: 10px; margin: 15px 0; width: 80%; border: 1px solid #ccc; border-radius: 6px; }
    #error-msg { color: red; font-weight: bold; margin-top: 10px; }
    .search-bar { width: 100%; padding: 12px; border: 1px solid #ccc; border-radius: 8px; margin-bottom: 20px; font-size: 16px; box-sizing: border-box; }
  </style>
</head>
<body>

  <div id="auth-overlay">
    <div class="auth-box">
      <h3>🔒 系統受保護</h3>
      <p>請輸入主管密碼以存取後台</p>
      <input type="password" id="admin-password" placeholder="請輸入密碼">
      <br>
      <button class="action-btn btn-primary" onclick="verifyAdmin()">登入</button>
      <div id="error-msg"></div>
    </div>
  </div>

  <div class="sidebar">
    <div class="sidebar-header">Café Connect<br><span style="font-size:14px; font-weight:normal;">主管控制台</span></div>
    <button class="nav-btn active" onclick="switchTab('finance-sec', this)">💰 財務與歸檔</button>
    <button class="nav-btn" onclick="switchTab('product-sec', this)">📦 商品管理</button>
    <button class="nav-btn" onclick="switchTab('member-sec', this)">👥 會員管理</button>
    <button class="nav-btn" onclick="switchTab('log-sec', this)">📝 操作日誌</button>
  </div>

  <div class="main-content">
    
    <div id="finance-sec" class="section active">
      <h2>財務報表與結算歸檔</h2>
      <p>執行歸檔後，資料將寫入獨立報表並鎖定，無法隨意竄改。</p>
      <div style="display: flex; gap: 15px; margin-top: 20px;">
        <div style="flex: 1; padding: 20px; border: 1px solid #eee; border-radius: 8px; text-align: center;">
          <h3>每日結算</h3>
          <p style="color: #666;">將今日所有「已完成」訂單加總歸檔</p>
          <button class="action-btn btn-success" onclick="executeArchive('daily')">執行日歸檔</button>
        </div>
        <div style="flex: 1; padding: 20px; border: 1px solid #eee; border-radius: 8px; text-align: center;">
          <h3>週/月 彙整</h3>
          <p style="color: #666;">將日結算資料彙整為週期報表</p>
          <button class="action-btn btn-primary" onclick="executeArchive('periodic')">執行週期歸檔</button>
        </div>
      </div>
    </div>

    <div id="product-sec" class="section">
      <h2>商品上下架管理</h2>
      <table>
        <thead>
          <tr><th>編號</th><th>名稱</th><th>分類</th><th>價格</th><th>狀態</th><th>操作</th></tr>
        </thead>
        <tbody id="admin-product-list">
          <tr><td colspan="6">載入中...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- 新增：會員管理區塊 -->
    <div id="member-sec" class="section">
      <h2>會員資料管理</h2>
      <input type="text" id="member-search" class="search-bar" placeholder="🔍 搜尋姓名、手機號碼或樓層備註..." onkeyup="filterMembers()">
      <table>
        <thead>
          <tr><th>姓名</th><th>手機號碼</th><th>樓層/備註</th><th>權限等級</th><th>註冊時間</th></tr>
        </thead>
        <tbody id="admin-member-list">
          <tr><td colspan="5">載入中...</td></tr>
        </tbody>
      </table>
    </div>

    <div id="log-sec" class="section">
      <h2>非預期操作日誌 (Audit Log)</h2>
      <table>
        <thead>
          <tr><th>時間</th><th>操作者 UID</th><th>操作類型</th><th>詳細內容</th></tr>
        </thead>
        <tbody id="admin-log-list">
          <tr><td colspan="4">尚無異常日誌。</td></tr>
        </tbody>
      </table>
    </div>

  </div>

  <script src="Js/config.js" onerror="document.getElementById('error-msg').innerHTML='❌ 找不到 Js/config.js'"></script>
  <script src="Js/admin.js" onerror="document.getElementById('error-msg').innerHTML='❌ 找不到 Js/admin.js'"></script>
</body>
</html>
