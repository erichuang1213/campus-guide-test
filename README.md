# 校邊好去處：Google Places 本機啟動

1. 將 `.env.example` 複製並改名為 `.env`。
2. 在 `.env` 的 `GOOGLE_MAPS_API_KEY=` 後面貼上新金鑰。這個檔案已在 `.gitignore`，不會被提交。
3. 在此資料夾開啟終端機，執行 `npm start`。
4. 用瀏覽器開啟 `http://localhost:8787/regions.html`，不要再使用 `file:///` 開啟。
5. 建立生活圈後，按「探索並匯入店家」；候選頁按「用 Google Places 搜尋此範圍」，逐筆審核再加入網站。

這是只綁定 `127.0.0.1` 的本機開發伺服器。正式上線時，應把同一支 API 代理放到受管理員登入保護的後端，並對伺服器用金鑰加上 API 與 IP 限制。
