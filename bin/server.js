#!/usr/bin/env node

// IMPORTS
const extractor = require('unfluff')
const axios = require('axios')
const fs = require('fs-extra')
const url = require('url')
const mkdirp = require('mkdirp')
const fastify = require('fastify')({
  logger: true
})

// INIT
var port = process.env['PORT'] || 80

globalThis.defaults = {}

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
        `https://searx.xyz/?q=${uri}&categories=general&language=en-US&format=json`
      )
      var data = html.data

      reply.type('text/html').code(200)
      var armor = `<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.21.0/components/prism-core.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.21.0/components/prism-json.min.js"></script>
      <script type="application/ld+json" id="data">
      ${JSON.stringify(data, null, 2)}
    </script>
    <script type="module" src="https://spux.org/rocks/jr.js"></script>`

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
    var html = await axios.get(uri)

    // extract
    data = extractor(html.data)
    for (var i = 0; i < data.links.length; i++) {
      if (data.links[i].href.match(/^http/)) {
        data.links[i].link = 'http://json.rocks/?uri=' + data.links[i].href
      } else if (data.links[i].href.match(/^\//)) {
        data.links[i].link =
          'http://json.rocks/?uri=' +
          parsed.protocol +
          '//' +
          origin +
          data.links[i].href
      }
    }

    // response
    reply.type('text/html').code(200)
    var armor = `<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.21.0/components/prism-core.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.21.0/components/prism-json.min.js"></script>
    <script type="application/ld+json" id="data">
    ${JSON.stringify(data, null, 2)}
  </script>
  <script type="module" src="https://spux.org/rocks/jr.js"></script>`

    console.log('armor', armor)

    reply.send(armor)

    // cache
    var root = './data'
    var file =
      root + '/' + origin + (parsed.pathname === '/' ? '/index.html' : '/')
    console.log('file', file)
    fs.outputFile(file, JSON.stringify(data, null, 2))
  } else {
    var index = fs.readFileSync('./index.html')
    reply.type('text/html').code(200)
    return index
  }
})

// RUN SERVER
fastify.listen(port, '0.0.0.0', (err, address) => {
  if (err) throw err
  fastify.log.info(`server listening on ${address}`)
})
