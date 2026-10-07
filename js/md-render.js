// 引入 marked.js (CDN)
import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';

async function renderMd() {
  // 获取当前 HTML 的相对目录，拼接 index.md
  const path = window.location.pathname;
  const mdUrl = path.replace(/\/$/, '/') + 'index.md';
  
  try {
    const res = await fetch(mdUrl);
    if (!res.ok) throw new Error('MD not found');
    const text = await res.text();
    
    // 渲染到指定容器
    document.getElementById('content').innerHTML = marked.parse(text);
  } catch (e) {
    document.getElementById('content').innerHTML = '<h1>加载失败</h1>';
  }
}
renderMd();
