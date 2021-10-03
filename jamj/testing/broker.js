const aedes = require('aedes')()
const server = require('net').createServer(aedes.handle)
const port = 1883
const cbor = require('cbor');

server.listen(port, 'localhost',function () {
  console.log('server started and listening on port ', port)
})

aedes.on('publish', (packet) => {
    if (packet.cmd != undefined) {
        try {
          let msg = packet.payload
          msg = cbor.decode(msg)
          console.log('\n\n=======CBOR MSG============\nPayload \n= ' + JSON.parse(JSON.stringify(msg)));
          console.log('= ' + JSON.stringify(msg));
          console.log('\nMQTT Packet = ' + JSON.stringify(packet));
        } catch (error) {
          let msg = packet.payload;
          console.log('\n\n**********Norml Msg*************\nPacket = ' + JSON.stringify(packet));
          console.log('\nPayload = ' + msg);
        }
     }
})


// aedes.on('publish', (packet) => {
//   if (packet.topic === '/00000000000000000000000000000001/00000000000000000000000000000002/resack') {
//     let msg = packet.payload;
//     console.log(cbor.decode(msg));
//   }
// })