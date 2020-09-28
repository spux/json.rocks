#!/usr/bin/env node

var port = process.env['PORT'] || 80

const extractor = require('unfluff')
const axios = require('axios')
const fs = require('fs')

var uri = ''

const fastify = require('fastify')({
  logger: true
})

fastify.get('/', async (request, reply) => {
  var uri = request.query.uri

  if (uri) {
    reply.type('application/json').code(200)

    if (!uri.match(/^http/)) {
      uri = 'https://' + uri
    }

    console.log('extracting', uri)
    var html = await axios.get(uri)
    data = extractor(html.data)
    reply.send(JSON.stringify(data, null, 2))
    return

    // return data
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
