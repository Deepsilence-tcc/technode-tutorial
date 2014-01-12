var express = require('express')
var MongoStore = require('connect-mongo')(express)
var parseSignedCookie = require('connect').utils.parseSignedCookie
var Cookie = require('cookie')

var config = require('./config')
var api = require('./services/api')
var socketApi = require('./services/socketApi')

var port = process.env.PORT || 3000
var sessionStore = new MongoStore({
  url: config.mongodb
})

var app = express()

app.use(express.bodyParser())
app.use(express.cookieParser())
app.use(express.session({
  secret: 'technode',
  cookie: {
    maxAge: 60 * 1000 * 60
  },
  store: sessionStore
}))
app.use(express.static(__dirname + '/static'))

app.post('/api/login', api.login)
app.get('/api/logout', api.logout)
app.get('/api/validate', api.validate)

app.use(function(req, res) {
  res.sendfile('./static/index.html')
})

var io = require('socket.io').listen(app.listen(port))

io.set('authorization', function(handshakeData, accept) {
  handshakeData.cookie = Cookie.parse(handshakeData.headers.cookie)
  var connectSid = handshakeData.cookie['connect.sid']
  connectSid = parseSignedCookie(connectSid, 'technode')

  if (connectSid) {
    sessionStore.get(connectSid, function(error, session) {
      if (error) {
        accept(error.message, false)
      } else {
        handshakeData.session = session
        if (session._userId) {
          accept(null, true)
        } else {
          accept('No login')
        }
      }
    })
  } else {
    accept('No session')
  }
})

io.sockets.on('connection', function(socket) {

  socketApi.connect(socket)

  socket.on('disconnect', function() {
    socketApi.disconnect(socket)
  })

  socket.on('technode', function(request) {
    socketApi[request.action](request.data, socket, io)
  })
})

console.log("TechNode is on port " + port + '!')