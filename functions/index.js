// ============================================================
// Cloudflare Pages Function — HTML + MD 混合渲染器
// 有 html 就直接发，没有就找 md 渲染
// ============================================================

// ---------- Frontmatter 解析 ----------
function parseFrontmatter(text) {
  const fm = {};
  let body = text;
  const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (match) {
    const lines = match[1].split('\n');
    for (const line of lines) {
      const [key, ...rest] = line.split(':');
      if (key && rest.length) fm[key.trim()] = rest.join(':').trim();
    }
    body = text.slice(match[0].length);
  }
  return { frontmatter: fm, body };
}

// ---------- Markdown 渲染（精简版，够用） ----------
function md2html(md) {
  const lines = md.split('\n');
  let html = '';
  let inCode = false, codeLang = '', codeBuf = '';
  let inList = false;

  const flushList = () => { if (inList) { html += '</ul>\n'; inList = false; } };

  const inline = (text) => text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  for (let line of lines) {

    if (line.startsWith('```')) {
      if (!inCode) { flushList(); inCode = true; codeLang = line.slice(3).trim(); codeBuf = ''; }
      else { inCode = false; html += `<pre><code>${codeBuf.replace(/</g,'&lt;')}</code></pre>\n`; }
      continue;
    }
    if (inCode) { codeBuf += line + '\n'; continue; }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushList();
      const level = h[1].length;
      html += `<h${level}>${inline(h[2])}</h${level}>\n`;
      continue;
    }

    if (line.startsWith('> ')) { flushList(); html += `<blockquote>${inline(line.slice(2))}</blockquote>\n`; continue; }

    const li = line.match(/^[-*]\s+(.*)$/);
    if (li) { if (!inList) { html += '<ul>\n'; inList = true; } html += `<li>${inline(li[1])}</li>\n`; continue; }
    else { flushList(); }

    if (line.trim() === '') { flushList(); html += '\n'; continue; }

    flushList();
    html += `<p>${inline(line)}</p>\n`;
  }
  flushList();
  return html;
}

// ---------- HTML 模板（md 渲染时包一层） ----------
function wrapHtml(title, body) {
  return `<!doctype html>
<html lang="zh">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    body{max-width:720px;margin:40px auto;font-family:system-ui;line-height:1.7;color:#1a1a1a}
    h1,h2,h3{line-height:1.3;margin-top:1.5em}
    a{color:#2563eb}
    pre{background:#0d1117;color:#e6edf3;padding:16px;border-radius:8px;overflow:auto}
    code{background:#f6f8fa;padding:.15em .4em;border-radius:4px;font-size:.9em}
    blockquote{border-left:4px solid #2563eb;padding:.5em 1em;background:#f9fafb;margin:1em 0}
  </style>
</head>
<body>${body}</body>
</html>`;
}

// ---------- 主逻辑 ----------
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  let pathname = url.pathname;

  // 如果请求已经有文件扩展名（.css/.js/.png/.html 等），直接走静态
  if (pathname.match(/\.\w{1,6}$/)) {
    return env.ASSETS.fetch(request);
  }

  // 去掉尾部斜杠
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }

  // ① 先找 .html
  const htmlPath = pathname + '.html';
  const htmlRes = await env.ASSETS.fetch(new Request(new URL(htmlPath, url.origin)));
  if (htmlRes.ok) {
    return env.ASSETS.fetch(new Request(new URL(htmlPath, url.origin)));
  }

  // ② .html 没有，再找 .md
  const mdPath = pathname + '.md';
  const mdRes = await env.ASSETS.fetch(new Request(new URL(mdPath, url.origin)));

  if (mdRes.ok) {
    const raw = await mdRes.text();
    const { frontmatter, body } = parseFrontmatter(raw);
    const rendered = md2html(body);
    const title = frontmatter.title || pathname.split('/').pop() || 'Home';
    return new Response(wrapHtml(title, rendered), {
      headers: { 'content-type': 'text/html; charset=utf-8' }
    });
  }

  // ③ 尝试目录下的 index.html
  const idxHtmlRes = await env.ASSETS.fetch(new Request(new URL(pathname + '/index.html', url.origin)));
  if (idxHtmlRes.ok) return idxHtmlRes;

  // ④ 尝试目录下的 index.md
  const idxMdRes = await env.ASSETS.fetch(new Request(new URL(pathname + '/index.md', url.origin)));
  if (idxMdRes.ok) {
    const raw = await idxMdRes.text();
    const { frontmatter, body } = parseFrontmatter(raw);
    const rendered = md2html(body);
    const title = frontmatter.title || 'Home';
    return new Response(wrapHtml(title, rendered), {
      headers: { 'content-type': 'text/html; charset=utf-8' }
    });
  }

  // ⑤ 都没有 → 404
  return new Response(wrapHtml('404', `<h1>404</h1><p>页面不存在。</p><p><a href="/">返回首页</a></p>`), {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  });
}
