#!/usr/bin/env node

var port = 3000

const extractor = require('unfluff')
const axios = require('axios')

var uri = ''

const fastify = require('fastify')({
  logger: false
})

fastify.get('/', async (request, reply) => {
  reply.type('application/json').code(200)

  var uri = request.query.uri

  if (!uri.match(/^http/)) {
    uri = 'https://' + uri
  }

  console.log('extracting', uri)
  var html = await axios.get(uri)
  data = extractor(html.data)

  return data
})

fastify.listen(port, (err, address) => {
  if (err) throw err
  fastify.log.info(`server listening on ${address}`)
})
