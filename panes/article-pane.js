import { createStore } from '/losos/store.js'
import { html, render, onUnmount } from '/losos/html.js'

export default {
  label: 'Preview',
  icon: '\uD83D\uDD17',

  canHandle(subject, store) {
    var node = store.get(subject.value)
    var type = store.type(node)
    return type && type.includes('WebPage')
  },

  render(subject, lionStore, container, rawData) {
    var data = rawData || window.__jrData
    if (!data) return

    var store = createStore(data)
    var root = store.get('#this')

    var links = store.propAll(root, 'link')
    var images = store.propAll(root, 'img')
    var videos = store.propAll(root, 'video')
    var showFullText = false

    function isImageUrl(u) {
      return u && /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?.*)?$/i.test(u)
    }

    function showImageModal(src, alt) {
      var overlay = document.createElement('div')
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;z-index:10000;cursor:pointer;padding:20px;'
      function close() { overlay.remove(); document.removeEventListener('keydown', esc) }
      function esc(e) { if (e.key === 'Escape') close() }
      overlay.onclick = close
      document.addEventListener('keydown', esc)
      var img = document.createElement('img')
      img.src = src; img.alt = alt || ''
      img.style.cssText = 'max-width:95%;max-height:95%;border-radius:8px;object-fit:contain;'
      overlay.appendChild(img)
      document.body.appendChild(overlay)
    }

    function hostname(u) {
      try { return new URL(u).hostname } catch(e) { return '' }
    }

    function faviconUrl(u) {
      var h = hostname(u)
      return h ? 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(h) + '&sz=32' : ''
    }

    function renderApp() {
      var title = root['title'] || 'Untitled'
      var desc = root['description'] || ''
      var image = root['image'] || ''
      var logo = root['logo'] || ''
      var author = root['author'] || ''
      var publisher = root['publisher'] || ''
      var date = root['date'] || ''
      var url = root['url'] || ''
      var text = root['text'] || ''
      var lang = root['lang'] || ''
      var host = hostname(url)
      var favicon = logo || faviconUrl(url)

      // Direct image URL
      if (isImageUrl(url) || (isImageUrl(image) && !desc && !text)) {
        var imgUrl = isImageUrl(url) ? url : image
        render(container, html`
          <div style="max-width: 900px; margin: 0 auto; padding: 40px 24px; text-align: center;">
            <img src="${imgUrl}" alt="${title}" style="max-width: 100%; border-radius: 12px; box-shadow: 0 8px 40px rgba(0,0,0,0.12);" />
            ${title !== 'Untitled' ? html`<h2 style="margin-top: 20px; font-weight: 400; color: #1a1a2e; font-size: 20px;">${title}</h2>` : null}
            <div style="margin-top: 8px;"><a href="${imgUrl}" target="_blank" style="font-size: 13px; color: #667eea;">${imgUrl}</a></div>
          </div>
        `)
        return
      }

      // Split links into image links and text links
      var imgLinks = []
      var textLinks = []
      links.forEach(function(l) {
        if (!l['linkHref']) return
        var href = l['linkHref']
        if (href.startsWith('/')) try { href = new URL(href, url).href } catch(e) {}
        var lt = l['linkText'] || ''
        var imgMatch = lt.match(/src="([^"]+)"/)
        if (imgMatch || isImageUrl(href)) {
          var imgSrc = imgMatch ? imgMatch[1] : href
          if (imgSrc.startsWith('/')) try { imgSrc = new URL(imgSrc, url).href } catch(e) {}
          imgLinks.push({ src: imgSrc, href: href, alt: lt.replace(/<[^>]*>/g, '').trim() || href })
        } else {
          var clean = lt.replace(/<[^>]*>/g, '').trim()
          if (clean.length > 2) textLinks.push({ href: href, text: clean })
        }
      })

      // All images combined
      var allImages = images.map(function(i) { return { src: i['imgSrc'], alt: i['imgAlt'] || '' } })
        .concat(imgLinks.map(function(i) { return { src: i.src, alt: i.alt } }))

      render(container, html`
        <style>
          .a-wrap { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 860px; margin: 0 auto; padding: 32px 20px 60px; color: #2c2c2c; }

          /* Site bar */
          .a-site { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
          .a-favicon { width: 20px; height: 20px; border-radius: 4px; }
          .a-host { font-size: 13px; color: #888; }
          .a-host a { color: #888; text-decoration: none; }
          .a-host a:hover { color: #667eea; }

          /* Hero card */
          .a-hero { background: #fff; border-radius: 16px; box-shadow: 0 2px 16px rgba(0,0,0,0.06); overflow: hidden; margin-bottom: 24px; }
          .a-hero-img { width: 100%; max-height: 400px; object-fit: cover; display: block; }
          .a-hero-body { padding: 28px 32px; }
          .a-title { font-size: 28px; font-weight: 700; line-height: 1.3; color: #1a1a2e; margin: 0 0 12px; }
          .a-desc { font-size: 16px; line-height: 1.7; color: #555; margin: 0; }

          /* Meta pills */
          .a-meta { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; padding: 0 32px 20px; border-bottom: 1px solid #f0f0f0; }
          .a-pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 12px; background: #f4f4f8; border-radius: 20px; font-size: 13px; color: #555; }
          .a-pill-icon { font-size: 14px; }

          /* Text section */
          .a-card { background: #fff; border-radius: 14px; box-shadow: 0 2px 12px rgba(0,0,0,0.04); padding: 24px 28px; margin-bottom: 20px; }
          .a-card-title { font-size: 15px; font-weight: 600; color: #1a1a2e; margin: 0 0 12px; display: flex; align-items: center; gap: 8px; }
          .a-card-count { font-size: 12px; color: #bbb; font-weight: 400; }
          .a-text { font-size: 15px; line-height: 1.8; color: #444; white-space: pre-wrap; }
          .a-toggle { background: none; border: none; color: #667eea; font: 500 14px/1 inherit; cursor: pointer; padding: 8px 0 0; }
          .a-toggle:hover { text-decoration: underline; }

          /* Images grid */
          .a-images { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
          .a-img-card { border-radius: 10px; overflow: hidden; background: #f8f8f8; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; }
          .a-img-card:hover { transform: translateY(-3px); box-shadow: 0 6px 20px rgba(0,0,0,0.08); }
          .a-img-card img { width: 100%; height: 110px; object-fit: cover; display: block; }
          .a-img-cap { padding: 6px 8px; font-size: 11px; color: #999; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

          /* Links */
          .a-links { display: flex; flex-direction: column; gap: 4px; }
          .a-link { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #fafafa; border-radius: 8px; text-decoration: none; color: #2c2c2c; transition: all 0.15s; font-size: 14px; }
          .a-link:hover { background: #f0f0ff; transform: translateX(3px); }
          .a-link-dot { width: 6px; height: 6px; border-radius: 50%; background: #667eea; flex-shrink: 0; }

          /* Videos */
          .a-video { border-radius: 12px; overflow: hidden; background: #000; aspect-ratio: 16/9; margin-bottom: 10px; }
          .a-video iframe { width: 100%; height: 100%; border: none; }

          /* Search */
          .a-search { margin-top: 40px; padding-top: 24px; border-top: 1px solid #eee; }
          .a-search-form { display: flex; gap: 0; max-width: 480px; }
          .a-search-in { flex: 1; padding: 12px 18px; border: 2px solid #eee; border-radius: 24px 0 0 24px; font: 400 15px/1 inherit; outline: none; transition: border-color 0.2s; }
          .a-search-in:focus { border-color: #667eea; }
          .a-search-in::placeholder { color: #bbb; }
          .a-search-go { background: #667eea; color: #fff; border: none; border-radius: 0 24px 24px 0; padding: 12px 24px; font: 600 15px/1 inherit; cursor: pointer; transition: background 0.15s; }
          .a-search-go:hover { background: #5a67d8; }
        </style>

        <div class="a-wrap">
          <div class="a-site">
            ${favicon ? html`<img class="a-favicon" src="${favicon}" alt="" />` : null}
            <span class="a-host"><a href="${'?uri=' + encodeURIComponent('https://' + host)}">${host}</a></span>
          </div>

          <div class="a-hero">
            ${image ? html`<img class="a-hero-img" src="${image}" alt="${title}" onerror="this.style.display='none'" />` : null}
            <div class="a-hero-body">
              <h1 class="a-title">${title}</h1>
              ${desc ? html`<p class="a-desc">${desc}</p>` : null}
            </div>
            ${author || publisher || date || lang ? html`
              <div class="a-meta">
                ${author ? html`<span class="a-pill"><span class="a-pill-icon">\uD83D\uDC64</span> ${author}</span>` : null}
                ${publisher ? html`<span class="a-pill"><span class="a-pill-icon">\uD83C\uDFE2</span> ${publisher}</span>` : null}
                ${date ? html`<span class="a-pill"><span class="a-pill-icon">\uD83D\uDCC5</span> ${new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>` : null}
                ${lang ? html`<span class="a-pill"><span class="a-pill-icon">\uD83C\uDF10</span> ${lang}</span>` : null}
              </div>
            ` : null}
          </div>

          ${text ? html`
            <div class="a-card">
              <div class="a-card-title">\uD83D\uDCDD Article Text</div>
              <div class="a-text">${showFullText ? text : text.slice(0, 600)}</div>
              ${text.length > 600 ? html`<button class="a-toggle" onclick="${function() { showFullText = !showFullText; renderApp() }}">${showFullText ? 'Show less' : 'Read more \u2192'}</button>` : null}
            </div>
          ` : null}

          ${videos.length > 0 ? html`
            <div class="a-card">
              <div class="a-card-title">\uD83C\uDFAC Videos <span class="a-card-count">${videos.length}</span></div>
              ${videos.map(function(v) {
                var vUrl = v['videoUrl'] || v['url'] || v['href'] || ''
                if (!vUrl) return null
                if (vUrl.includes('youtube.com') || vUrl.includes('youtu.be')) {
                  var embedUrl = vUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')
                  return html`<div class="a-video"><iframe src="${embedUrl}" allowfullscreen></iframe></div>`
                }
                if (vUrl.includes('vimeo.com')) {
                  var vimeoId = vUrl.match(/vimeo\.com\/(\d+)/)
                  if (vimeoId) return html`<div class="a-video"><iframe src="${'https://player.vimeo.com/video/' + vimeoId[1]}" allowfullscreen></iframe></div>`
                }
                return html`<a class="a-link" href="${vUrl}" target="_blank"><span class="a-link-dot"></span> ${v['text'] || vUrl}</a>`
              })}
            </div>
          ` : null}

          ${allImages.length > 0 ? html`
            <div class="a-card">
              <div class="a-card-title">\uD83D\uDDBC Images <span class="a-card-count">${allImages.length}</span></div>
              <div class="a-images">
                ${allImages.slice(0, 30).map(function(img) {
                  return html`
                    <div class="a-img-card" onclick="${function() { showImageModal(img.src, img.alt) }}">
                      <img src="${img.src}" alt="${img.alt}" loading="lazy" onerror="this.parentElement.style.display='none'" />
                      ${img.alt ? html`<div class="a-img-cap">${img.alt}</div>` : null}
                    </div>
                  `
                })}
              </div>
            </div>
          ` : null}

          ${textLinks.length > 0 ? html`
            <div class="a-card">
              <div class="a-card-title">\uD83D\uDD17 Links <span class="a-card-count">${textLinks.length}</span></div>
              <div class="a-links">
                ${textLinks.slice(0, 20).map(function(l) {
                  return html`<a class="a-link" href="${'?uri=' + encodeURIComponent(l.href)}"><span class="a-link-dot"></span> ${l.text}</a>`
                })}
              </div>
            </div>
          ` : null}

          <div class="a-search">
            <form class="a-search-form" action="">
              <input class="a-search-in" type="text" name="uri" placeholder="Try another URL..." />
              <button class="a-search-go" type="submit">Go</button>
            </form>
          </div>
        </div>
      `)
    }

    renderApp()
    onUnmount(container, function() {})
  }
}
