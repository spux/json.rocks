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
    var showAllLinks = false

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

    // Build breadcrumb segments from URL
    function breadcrumbs(u) {
      try {
        var parsed = new URL(u)
        var segments = parsed.pathname.split('/').filter(Boolean)
        var crumbs = []
        var accumulated = parsed.origin
        for (var i = 0; i < segments.length; i++) {
          accumulated += '/' + segments[i]
          crumbs.push({ label: decodeURIComponent(segments[i]), url: accumulated })
        }
        return crumbs
      } catch(e) { return [] }
    }

    // Detect pagination links — checks text, rel, class, aria-label, parent class
    function findPagination(allLinks, currentUrl) {
      var prev = null, next = null, pages = []
      var currentHost = hostname(currentUrl)

      var nextPatterns = /\b(next|newer|forward)\b/
      var prevPatterns = /\b(prev|previous|older|back)\b/
      var paginationContext = /\b(pagination|pager|pagina|page-nav|page-numbers|nav-links)\b/

      allLinks.forEach(function(l) {
        var href = l['linkHref'] || ''
        var text = (l['linkText'] || '').trim()
        var textLower = text.toLowerCase()
        var rel = (l['linkRel'] || '').toLowerCase()
        var hints = l['linkHints'] || ''
        if (!href || hostname(href) !== currentHost) return

        // Check rel="next" / rel="prev" (strongest signal, can be compound like "nofollow next")
        if (!next && /\bnext\b/.test(rel)) {
          next = { href: href, text: text || 'Next' }
        }
        if (!prev && /\b(prev|previous)\b/.test(rel)) {
          prev = { href: href, text: text || 'Previous' }
        }

        // Check link text
        if (!next && /^(next|next\s*page|newer|→|›|»|>{1,2})$/i.test(textLower)) {
          next = { href: href, text: text || 'Next' }
        }
        if (!prev && /^(prev|previous|prev\s*page|older|←|‹|«|<{1,2})$/i.test(textLower)) {
          prev = { href: href, text: text || 'Previous' }
        }

        // Check class/aria-label hints
        if (!next && nextPatterns.test(hints)) {
          next = { href: href, text: text || 'Next' }
        }
        if (!prev && prevPatterns.test(hints)) {
          prev = { href: href, text: text || 'Previous' }
        }

        // Numbered pages — look for links in pagination context or standalone numbers
        if (/^\d+$/.test(textLower) && textLower !== '0') {
          var inPaginationContext = paginationContext.test(hints) || /page[=\/]\d/.test(href)
          if (inPaginationContext || parseInt(textLower) <= 100) {
            pages.push({ href: href, text: text, num: parseInt(textLower) })
          }
        }
      })

      // Deduplicate and sort pages
      var seen = new Set()
      pages = pages.filter(function(p) {
        if (seen.has(p.num)) return false
        seen.add(p.num)
        return true
      }).sort(function(a, b) { return a.num - b.num }).slice(0, 10)

      return { prev: prev, next: next, pages: pages }
    }

    // Detect nav/section links (menus, categories)
    function findNavLinks(allLinks, currentUrl) {
      var currentHost = hostname(currentUrl)
      var nav = []
      var seenHrefs = new Set()

      allLinks.forEach(function(l) {
        var href = l['linkHref'] || ''
        var text = (l['linkText'] || '').trim()
        if (!href || !text || text.length < 2 || text.length > 40) return
        if (hostname(href) !== currentHost) return
        if (seenHrefs.has(href)) return

        // Short text, same host, not too deep = likely nav
        var path = ''
        try { path = new URL(href).pathname } catch(e) { return }
        var depth = path.split('/').filter(Boolean).length
        if (depth <= 2 && text.length <= 30 && !/\d{4,}/.test(text)) {
          seenHrefs.add(href)
          nav.push({ href: href, text: text })
        }
      })

      return nav.slice(0, 12)
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
      var crumbs = breadcrumbs(url)
      var pagination = findPagination(links, url)
      // Override with <link rel="next/prev"> from head if available
      if (root['relNext'] && !pagination.next) pagination.next = { href: root['relNext'], text: 'Next' }
      if (root['relPrev'] && !pagination.prev) pagination.prev = { href: root['relPrev'], text: 'Previous' }
      var navLinks = findNavLinks(links, url)

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

      // Split links into categories
      var imgLinks = []
      var textLinks = []
      var tagLinks = []
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
          if (!clean) return
          // Detect tag/category links
          if (/\/(tags?|category|categories|topic|topics|label|labels)\//i.test(href) || /\b(tag|category)\b/i.test(l['linkHints'] || '')) {
            tagLinks.push({ href: href, text: clean })
          } else if (clean.length > 2) {
            textLinks.push({ href: href, text: clean })
          }
        }
      })

      // All images combined
      var allImages = images.map(function(i) { return { src: i['imgSrc'], alt: i['imgAlt'] || '' } })
        .concat(imgLinks.map(function(i) { return { src: i.src, alt: i.alt } }))

      // Determine if a link is internal (same host)
      function linkHref(href) {
        return hostname(href) === host
          ? '?uri=' + encodeURIComponent(href)
          : href
      }
      function linkTarget(href) {
        return hostname(href) === host ? '' : '_blank'
      }

      var visibleLinks = showAllLinks ? textLinks : textLinks.slice(0, 20)

      render(container, html`
        <style>
          .a-wrap { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 860px; margin: 0 auto; padding: 32px 20px 60px; color: #2c2c2c; }

          /* Breadcrumb bar */
          .a-crumbs { display: flex; align-items: center; gap: 6px; margin-bottom: 16px; font-size: 13px; flex-wrap: wrap; }
          .a-crumb-favicon { width: 18px; height: 18px; border-radius: 4px; }
          .a-crumbs a { color: #667eea; text-decoration: none; }
          .a-crumbs a:hover { text-decoration: underline; }
          .a-crumb-sep { color: #ccc; }
          .a-visit { margin-left: auto; padding: 6px 16px; background: #fff; color: #667eea; border: 1.5px solid #667eea; border-radius: 20px; font-size: 13px; font-weight: 600; text-decoration: none; white-space: nowrap; transition: all 0.15s; }
          .a-visit:hover { background: #667eea; color: #fff; }

          /* Nav links */
          .a-nav { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 20px; }
          .a-nav-link { padding: 5px 14px; background: #f4f4f8; border-radius: 20px; font-size: 13px; color: #555; text-decoration: none; transition: all 0.15s; }
          .a-nav-link:hover { background: #e8e8f0; color: #333; }

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
          .a-link-ext { width: 6px; height: 6px; border-radius: 50%; background: #ccc; flex-shrink: 0; }

          /* Pagination */
          .a-pagination { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 20px; }
          .a-page-btn { padding: 8px 16px; background: #fff; border: 1px solid #eee; border-radius: 8px; text-decoration: none; color: #667eea; font-size: 14px; font-weight: 500; transition: all 0.15s; }
          .a-page-btn:hover { background: #f0f0ff; border-color: #667eea; }
          .a-page-prev, .a-page-next { background: #667eea; color: #fff; border-color: #667eea; }
          .a-page-prev:hover, .a-page-next:hover { background: #5a67d8; }
          .a-page-num { padding: 8px 12px; background: #fff; border: 1px solid #eee; border-radius: 8px; text-decoration: none; color: #555; font-size: 13px; transition: all 0.15s; }
          .a-page-num:hover { border-color: #667eea; color: #667eea; }

          /* Tags */
          .a-tags { display: flex; gap: 6px; flex-wrap: wrap; }
          .a-tag { display: inline-block; padding: 5px 14px; background: #f0f4ff; border-radius: 20px; font-size: 13px; color: #667eea; text-decoration: none; transition: all 0.15s; }
          .a-tag:hover { background: #e0e8ff; color: #5a67d8; }

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
          <div class="a-crumbs">
            ${favicon ? html`<img class="a-crumb-favicon" src="${favicon}" alt="" onerror="this.style.display='none'" />` : null}
            <a href="${'?uri=' + encodeURIComponent('https://' + host)}">${host}</a>
            ${crumbs.map(function(c) {
              return html`<span class="a-crumb-sep">/</span><a href="${'?uri=' + encodeURIComponent(c.url)}">${c.label}</a>`
            })}
            <a class="a-visit" href="${url}" target="_blank">Visit site \u2197</a>
          </div>

          ${navLinks.length > 0 ? html`
            <div class="a-nav">
              ${navLinks.map(function(n) {
                return html`<a class="a-nav-link" href="${'?uri=' + encodeURIComponent(n.href)}">${n.text}</a>`
              })}
            </div>
          ` : null}

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

          ${tagLinks.length > 0 ? html`
            <div class="a-card">
              <div class="a-card-title">\uD83C\uDFF7 Tags <span class="a-card-count">${tagLinks.length}</span></div>
              <div class="a-tags">
                ${tagLinks.map(function(t) {
                  return html`<a class="a-tag" href="${'?uri=' + encodeURIComponent(t.href)}">${t.text}</a>`
                })}
              </div>
            </div>
          ` : null}

          ${pagination.prev || pagination.next || pagination.pages.length > 0 ? html`
            <div class="a-pagination">
              ${pagination.prev ? html`<a class="a-page-btn a-page-prev" href="${'?uri=' + encodeURIComponent(pagination.prev.href)}">\u2190 ${pagination.prev.text}</a>` : null}
              ${pagination.pages.map(function(p) {
                return html`<a class="a-page-num" href="${'?uri=' + encodeURIComponent(p.href)}">${p.text}</a>`
              })}
              ${pagination.next ? html`<a class="a-page-btn a-page-next" href="${'?uri=' + encodeURIComponent(pagination.next.href)}">${pagination.next.text} \u2192</a>` : null}
            </div>
          ` : null}

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
                ${visibleLinks.map(function(l) {
                  var isInternal = hostname(l.href) === host
                  return html`<a class="a-link" href="${linkHref(l.href)}" target="${linkTarget(l.href)}"><span class="${isInternal ? 'a-link-dot' : 'a-link-ext'}"></span> ${l.text}</a>`
                })}
              </div>
              ${textLinks.length > 20 && !showAllLinks ? html`<button class="a-toggle" onclick="${function() { showAllLinks = true; renderApp() }}">Show all ${textLinks.length} links \u2192</button>` : null}
            </div>
          ` : null}

          ${pagination.prev || pagination.next ? html`
            <div class="a-pagination" style="margin-top: 0;">
              ${pagination.prev ? html`<a class="a-page-btn a-page-prev" href="${'?uri=' + encodeURIComponent(pagination.prev.href)}">\u2190 ${pagination.prev.text}</a>` : null}
              ${pagination.next ? html`<a class="a-page-btn a-page-next" href="${'?uri=' + encodeURIComponent(pagination.next.href)}">${pagination.next.text} \u2192</a>` : null}
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
