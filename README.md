# 校邊好去處

公開網站部署在 GitHub Pages。`index.html` 與 `place.html` 只讀取 Supabase 的已發布店家；`submit-feedback.html` 將回饋寫入 Supabase。`admin.html`、`candidates.html`、`menus.html`、`feedback.html` 是管理工作區，寫入操作需要 Supabase 管理員權限。前台登入可選，僅店家資訊確認需要登入。

## 資料與權限

- `supabase/schema.sql` 定義初始資料表、RLS、儲存空間與政策。
- `supabase/migrations/` 是後續可重複執行的增量變更。新專案請先執行 `schema.sql`，既有專案依序執行缺少的 migration；不要以匯入 JSON 或瀏覽器 localStorage 代替雲端資料。
- `supabase-config.js` 只包含可公開使用的 Supabase URL 與 anon key。不得放入 service_role key 或 Google API 私鑰。
- 菜單與封面圖片上傳到公開讀取、管理員才能寫入的 `menu-images` 儲存空間。單張圖片上限 10 MB；店家菜單最多 8 張。
- 管理員身分由 `public.admins` 與 RLS 控制。前台使用者的登入不會給予管理權限。

## 本機預覽

用靜態 HTTP 伺服器提供本資料夾，再開啟 `index.html`。不要用 `file:///` 測試 OAuth、定位或雲端請求。正式公開版本以 HTTPS 存取。瀏覽器若阻擋位置權限，使用者可按右上角定位按鈕重試，或改用一般 Safari／Chrome 開啟；網站無法強制取得位置。

`server.js` 是舊 Google Places 本機探索原型，不是正式公開站的資料來源；正式站的待審核店家使用 Supabase `pending_candidates`。

修改網站後可執行 `node --experimental-vm-modules tests/smoke.cjs` 檢查頁面腳本語法、SQL 檔與幾個關鍵資料流程。這不取代已登入管理員與真實雲端資料的端到端測試。
