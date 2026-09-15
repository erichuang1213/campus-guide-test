// 後台頁共用守門：沒有管理員 session 時不顯示任何管理內容。
const page = document.body;
const showDenied = text => {
  page.innerHTML = `<main style="max-width:620px;margin:12vh auto;padding:32px;font:16px/1.6 system-ui,'Noto Sans TC',sans-serif;color:#1f2933"><h1>此頁面僅限管理員</h1><p>${text}</p><p><a href="index.html" style="color:#176b5b;font-weight:700">← 回到公開網站</a></p></main>`;
  document.documentElement.classList.remove('backend-guard');
};
try {
  await import('./backend.js');
  const backend = window.CampusBackend;
  if (!backend?.enabled || !await backend.session() || !await backend.isAdmin()) showDenied('你沒有進入此管理工具的權限。');
  else document.documentElement.classList.remove('backend-guard');
} catch (_) {
  showDenied('目前無法驗證管理權限，請稍後再試。');
}
