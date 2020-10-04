#!/usr/bin/env node

// IMPORTS
const extractor = require('unfluff')
const axios = require('axios')
const fs = require('fs-extra')
const url = require('url')

// const scrapex = require('scrapex')
// const cheerio = require('cheerio')
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

// MODEL
globalThis.data = {
  port: 80,
  key: './privkey.pem',
  cert: './fullchain.pem',
  scheme: 'http',
  fullhtml: false
}

// INIT
data.port = argv.port || data.port
data.key = argv.key || data.key
data.cert = argv.cert || data.cert
data.scheme = argv.scheme || data.scheme
var fullhtml = argv.fullhtml || data.fullhtml

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

// MAIN
fastify.get('/', async (request, reply) => {
  var uri = request.query.uri

  // process uri
  if (uri) {
    if (uri.match(/^[a-zA-Z ]*$/)) {
      console.log('text search')

      console.log(
        'extracting',
        `https://searx.xyz/?q=${uri}&categories=general&language=en-US&format=json`
      )
      var html = await axios.get(
        `https://searx.xyz/?q=${uri}&categories=general&language=en-US&format=json`,
        { headers: headers }
      )
      var data = html.data

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

      console.log('armor', armor)

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

    // fetch
    console.log('extracting', uri)
    var html = await axios.get(uri, { headers: headers })

    // // extract
    data = extractor(html.data)
    // var data = await scrapex(uri)
    // console.log('DATA', data)
    // $ = cheerio.load(html.data)
    // console.log('CHEER', JSON.stringify($('a').attr('href'), null, 2))
    const metadata = await metascraper({ html: html.data, url: uri })
    console.log('###############', metadata)
    data = { ...data, ...metadata }
    data['@context'] = 'https://schema.org'

    for (var i = 0; i < data.links.length; i++) {
      if (data.links[i].href.match(/^http/)) {
        data.links[i].link = 'https://json.rocks/?uri=' + data.links[i].href
      } else if (data.links[i].href.match(/^\//)) {
        data.links[i].link =
          'https://json.rocks/?uri=' +
          parsed.protocol +
          '//' +
          origin +
          data.links[i].href
      }
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
      var armor = `<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.21.0/components/prism-core.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.21.0/components/prism-json.min.js"></script>
      <script type="application/ld+json" id="data">
      ${JSON.stringify(data, null, 2)}
    </script>
    <script type="module" src="https://spux.org/rocks/jr.js"></script>`
    }

    // console.log('armor', armor)

    reply.send(armor)

    // cache
    var root = './data'
    var file =
      root + '/' + origin + (parsed.pathname === '/' ? '/index.html' : '/')
    console.log('file', file)
    fs.outputFile(file, JSON.stringify(data, null, 2))
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
