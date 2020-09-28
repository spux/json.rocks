#!/usr/bin/env node

var port = process.env['PORT'] || 80

const extractor = require('unfluff')
const axios = require('axios')
const fs = require('fs-extra')
const url = require('url')
const mkdirp = require('mkdirp')

var uri = ''

const fastify = require('fastify')({
  logger: true
})

fastify.get('/', async (request, reply) => {
  var uri = request.query.uri

  if (uri) {
    if (!uri.match(/^http/)) {
      uri = 'https://' + uri
    }

    var parsed = url.parse(uri)
    console.log('uri', uri)
    console.log('parsed', parsed)
    var origin = parsed.hostname
    console.log('making dir', origin)
    mkdirp(origin)

    console.log('path')

    reply.type('application/json').code(200)

    console.log('extracting', uri)
    var html = await axios.get(uri)
    data = extractor(html.data)
    reply.send(JSON.stringify(data, null, 2))

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

fastify.listen(port, '0.0.0.0', (err, address) => {
  if (err) throw err
  fastify.log.info(`server listening on ${address}`)
})
