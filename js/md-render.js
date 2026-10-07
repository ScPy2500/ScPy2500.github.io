import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';

// 可选：配置 marked 保留中文 ID（不同版本行为不同，这里做兼容）
marked.setOptions({
  gfm: true,
  breaks: false,
});

async function renderMd() {
  const path = window.location.pathname;
  const mdUrl = path.replace(/\/$/, '/') + 'index.md';
  
  try {
    const res = await fetch(mdUrl);
    if (!res.ok) throw new Error('MD not found');
    const text = await res.text();
    
    const content = document.getElementById('content');
    content.innerHTML = marked.parse(text);

    // 1. 渲染完成后，处理初始 Hash（如直接访问 /doc/.../#CPU）
    handleHash();

    // 2. 拦截所有内部锚点点击（解决 SPA 式动态内容点击无效）
    content.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (!a) return;
      const href = a.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        const targetId = decodeURIComponent(href.slice(1));
        scrollToAnchor(targetId);
        // 更新 URL（不刷新）
        history.pushState(null, '', href);
      }
    });

  } catch (e) {
    document.getElementById('content').innerHTML = '<h1>加载失败</h1>';
  }
}

// 初始加载时的 Hash 处理
function handleHash() {
  if (window.location.hash) {
    const targetId = decodeURIComponent(window.location.hash.slice(1));
    setTimeout(() => scrollToAnchor(targetId), 0);
  }
}

// 核心：智能查找并滚动（兼容大小写、特殊字符）
function scrollToAnchor(targetId) {
  // 尝试原始 ID
  let el = document.getElementById(targetId);
  
  // 尝试 marked 常见转换：小写、空格转 -
  if (!el) {
    const fallbackId = targetId.toLowerCase().replace(/\s+/g, '-');
    el = document.getElementById(fallbackId);
  }
  
  // 尝试标题文本匹配（如 <h2>CPU</h2> 无 id 时）
  if (!el) {
    const headings = document.querySelectorAll('#content h1, #content h2, #content h3');
    headings.forEach(h => {
      if (h.innerText.trim() === targetId || h.innerText.includes(targetId)) {
        el = h;
      }
    });
  }

  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    console.warn('锚点未找到:', targetId);
  }
}

renderMd();
