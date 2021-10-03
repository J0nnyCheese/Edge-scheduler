var mqtt = require('mqtt');
var cbor = require('cbor');
var client = mqtt.connect('mqtt://localhost:1234');
var topic = 'bid_response';

const worker_id = randomInt(200) + 17;
const controller_id = 5;


console.log('Worker id = ' + worker_id);

client.on('connect', () => {
    console.log('Successfully connected to MQTT broker!\n');
    client.subscribe(topic);
    setInterval(() => {
        const bid_request = [worker_id, controller_id, 'bid_request'];
        client.publish('bid_request', cbor.encode(bid_request));
    }, 5000);
});

client.on('message', (topic, message) => {
    if (topic === 'bid_response') {
        message = cbor.decode(message);
        let receiver = message[1];
        if (receiver == worker_id) {
            console.log('Receive one message');
            console.log('topic: ' + topic);
            console.log('response: ');
            console.log(message);
            console.log('\n');
        }
        // else ignore the message
    }
})

function randomInt(max) {
    return Math.floor(Math.random() * max);
}