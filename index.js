'use strict';

const port = process.env.PORT || 8080;

let app = require('./src/express'),
  server = require('http').Server(app),
  io = require('socket.io')(server),
  winston = require('winston'),
  cookieParser = require('cookie-parser'),
  cookie = require('cookie'),
  cluster = require('cluster'),
  session = require('express-session'),
  RedisStore = require('connect-redis')(session),
  redis = require('redis'),
  Msg = require('./src/model/msg');

let client = redis.createClient();

winston.info('v2');

function addRedisAdapter(io) {
  let redisAdapter = require('socket.io-redis');  
  let pub = redis.createClient({
    return_buffers: true
  });
  let sub = redis.createClient({
    return_buffers: true
  });

  io.adapter(redisAdapter({
    pubClient: pub,
    subClient: sub
  }));
}

server.listen(port, () => {
  winston.info(`App run on 0.0.0.0:${port}`);
});

addRedisAdapter(io);
console.log('Redis active');
io.on('connection', (socket) => {
  socket.on('send', (data) => {
    let nickname = data.nickname;
    let text = data.msg;

    //socket.handshake.session.nickname = nickname;
    //socket.nickname = nickname;
    if (nickname == 'luchanso')
      client.set(nickname, socket.id);

    if (!cluster.isMaster)
      winston.info(`${data.nickname} send: ${data.msg} workerID: ${cluster.worker.id}`);

    let msg = new Msg({
      nickname: nickname,
      msg: text
    });

    msg.save()
      .then((msg) => {
        console.log(msg.msg);
        if (msg.msg == 'luchanso')
          client.get('luchanso', function(err, socketId) {
            console.log(socketId);
            if (err) throw err;

            try {
              io.sockets.connected[socketId].emit('newMsg', msg);
            } catch (e) {
              console.log(e);
            }
          }); 
        io.emit('newMsg', msg);        
      })
      .catch((err) => {
        winston.error(err);
      });
  });

  socket.on('getLastMsgs', () => {
    console.log('getLastMsgs');
    Msg.getLastTen()
      .then((result) => {
        socket.emit('getLastMsgs', result);
      });
  });
});