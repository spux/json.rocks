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
      data.links[i].link = 'https://json.rocks/?uri=' + data.links[i].href
    }

    // response
    reply.type('application/json').code(200)
    reply.send(JSON.stringify(data, null, 2))

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
