#!/usr/bin/env node

// IMPORTS
const extractor = require('unfluff')
const axios = require('axios')
const fs = require('fs-extra')
const url = require('url')

// const scrapex = require('scrapex')
const cheerio = require('cheerio')
const metascraper = require('metascraper')([
  require('metascraper-author')(),
  require('metascraper-date')(),
  require('metascraper-description')(),
  require('metascraper-image')(),
  require('metascraper-logo')(),
  require('metascraper-clearbit')(),
  require('metascraper-publisher')(),
  require('metascraper-title')(),
  require('metascraper-spotify')(),
  require('metascraper-video')(),
  require('metascraper-youtube')(),
  require('metascraper-amazon')(),
  require('metascraper-url')()
])
var argv = require('minimist')(process.argv.slice(2))
var https = require('https')
var http = require('http')
var path = require('path')
const { links } = require('unfluff/lib/extractor')

// MODEL
globalThis.data = {
  port: 80,
  key: './privkey.pem',
  cert: './fullchain.pem',
  scheme: 'http',
  fullhtml: false,
  searx: 'https://searx.monicz.pl',
  filter: null
}

// INIT
data.port = argv.port || data.port
data.key = argv.key || data.key
data.cert = argv.cert || data.cert
data.scheme = argv.scheme || data.scheme
data.filter = argv.filter || data.filter
var searx = argv.searx || data.searx
var fullhtml = argv.fullhtml || data.fullhtml
var root = './data'

console.log('data', data)

if (data.scheme === 'http') {
  var fastify = require('fastify')({
    logger: true
  })
} else {
  var fastify = require('fastify')({
    https: {
      key: fs.readFileSync(path.join(__dirname, data.key)),
      cert: fs.readFileSync(path.join(__dirname, data.cert))
    }
  })
}

user_agent_desktop =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36'

headers = { 'User-Agent': user_agent_desktop }

// FUNCTIONS
function mapURI(parsed, root, origin) {
  var mapped = root + '/' + origin + parsed.pathname

  if (mapped.slice(-1) === '/') mapped = mapped + 'index.html'
  return mapped
}

// MAIN
fastify.get('/', async (request, reply) => {
  var uri = request.query.uri
  var filter = request.query.filter
  var refresh = request.query.refresh

  // process uri
  if (uri) {
    if (uri.match(/^[a-zA-Z ]*$/)) {
      console.log('text search')

      var mapped = mapURI({ pathname: uri }, root, 'q/')
      try {
        if (fs.existsSync(mapped) && !refresh) {
          data = JSON.parse(fs.readFileSync(mapped))
        } else {
          console.log(
            'extracting',
            searx + `/?q=${uri}&categories=general&language=en-US&format=json`
          )
          var html = await axios.get(
            searx + `/?q=${uri}&categories=general&language=en-US&format=json`,
            { headers: headers }
          )
          var data = html.data
        }
        console.log('mapped', mapped)
        fs.outputFile(mapped, JSON.stringify(data, null, 2))
      } catch (err) {
        console.error(err)
      }

      reply.code(200).header('Content-Type', 'text/html; charset=UTF-8')

      if (fullhtml) {
        var armor = `<!DOCTYPE html>
        <html lang="en">
        <head>
        <meta charset="utf-8">

        <title>${data.title}</title>
        <meta property="og:title" content="${data.title}" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="${data.canonicalLink}" />
        <meta property="og:image" content="${data.image}" />
        <meta property="og:description" content="${data.description}" />

        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.21.0/components/prism-core.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.21.0/components/prism-json.min.js"></script>
        <script type="application/ld+json" id="data">
        ${JSON.stringify(data, null, 2)}
      </script>
      <script type="module" src="https://spux.org/rocks/jr.js"></script>
      </head>
      <body></body>
      </html>
      `
      } else {
        var armor = `<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.21.0/components/prism-core.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.21.0/components/prism-json.min.js"></script>
        <script type="application/ld+json" id="data">
        ${JSON.stringify(data, null, 2)}
      </script>
      <script type="module" src="https://spux.org/rocks/jr.js"></script>`
      }

      // console.log('armor', armor)

      reply.send(armor)

      return
    }

    if (!uri.match(/^http/)) {
      uri = 'https://' + uri
    }

    // parse URI
    var parsed = url.parse(uri)
    var origin = parsed.hostname
    console.log('uri', uri)
    console.log('parsed', parsed)
    console.log('refresh', refresh)

    var mapped = mapURI(parsed, root, origin)

    try {
      if (fs.existsSync(mapped) && !refresh) {
        data = JSON.parse(fs.readFileSync(mapped))
      } else {
        // fetch
        console.log('extracting', uri)
        var html = await axios.get(uri, { headers: headers })

        // // extract
        data = extractor(html.data)
        // var data = await scrapex(uri)
        // console.log('DATA', data)

        // console.log('CHEER', JSON.stringify($('a').serializeArray(), null, 2))
        const metadata = await metascraper({ html: html.data, url: uri })
        data = { ...data, ...metadata }
        data['@context'] = 'https://schema.org'

        $ = cheerio.load(html.data)

        var ch = $('video') //jquery get all videos

        $(ch).each(function (i, link) {
          console.log('############### VIDEO', link)
          var l = {
            text: $(link).text() || 'video',
            href: $(link).attr('src')
          }
          // console.log('CHEER', l)
          data.videos.push(l)
        })

        var ch = $('iframe') //jquery get all iframes

        $(ch).each(function (i, link) {
          // console.log('###############', link)
          var l = {
            text: $(link).text() || 'iframe',
            href: $(link).attr('src')
          }
          // console.log('CHEER', l)
          data.links.push(l)
        })

        var ch = $('a') //jquery get all hyperlinks
        $(ch).each(function (i, link) {
          var l = {
            text: $(link).text(),
            href: $(link).attr('href')
          }
          // console.log('CHEER', l)
          data.links.push(l)
        })

        // for (var i = 0; i < data.links.length; i++) {
        //   if (data.links[i].href.match(/^http/)) {
        //     data.links[i].link = 'https://json.rocks/?uri=' + data.links[i].href
        //   } else if (data.links[i].href.match(/^\//)) {
        //     data.links[i].link =
        //       'https://json.rocks/?uri=' +
        //       parsed.protocol +
        //       '//' +
        //       origin +
        //       data.links[i].href
        //   }
        // }

        // cache
        var file = mapURI(parsed, root, origin)
        console.log('file', file)
        var file = fs.outputFile(file, JSON.stringify(data, null, 2))
      }
    } catch (err) {
      console.error(err)
    }

    // response
    reply.code(200).header('Content-Type', 'text/html; charset=UTF-8')

    if (fullhtml) {
      var armor = `<!DOCTYPE html>
      <html lang="en">
      <head>
      <meta charset="utf-8">

      <title>${data.title}</title>
      <meta property="og:title" content="${data.title}" />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="${data.canonicalLink}" />
      <meta property="og:image" content="${data.image}" />
      <meta property="og:description" content="${data.description}" />
      
      <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.21.0/components/prism-core.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.21.0/components/prism-json.min.js"></script>
      <script type="application/ld+json" id="data">
      ${JSON.stringify(data, null, 2)}
    </script>
    <script type="module" src="https://spux.org/rocks/jr.js"></script>
    </head>
    <body></body>
    <html>
    `
    } else {
      console.log('filter', filter)
      if (filter === 'links') {
        data = data.links
      }
      if (filter === 'image') {
        data = data.links
        data = data.filter(obj => obj?.href?.toLowerCase().endsWith('.jpg') || obj?.href?.toLowerCase().endsWith('.png') || obj?.href?.toLowerCase().endsWith('.gif'))
      }
      var armor = `<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.21.0/components/prism-core.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.21.0/components/prism-json.min.js"></script>
      <script type="application/ld+json" id="data">
      ${JSON.stringify(data, null, 2)}
    </script>
    <script type="module" src="https://spux.org/rocks/jr.js"></script>`
    }

    // console.log('armor', armor)

    reply.send(armor)
  } else {
    var index = fs.readFileSync('./index.html')
    reply.code(200).header('Content-Type', 'text/html; charset=UTF-8')

    return index
  }
})

// RUN SERVER HTTP
fastify.listen(data.port, '0.0.0.0', (err, address) => {
  if (err) throw err
  fastify.log.info(`server listening on ${address}`)
})
