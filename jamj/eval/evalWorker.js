var mqtt = require('mqtt');
var cbor = require('cbor');
var client = mqtt.connect('mqtt://localhost:1234');
var topic = 'bid_response';

const worker_id = randomInt(200) + 17;
const controller_id = 5;
var cycle_num = 3;


console.log('Worker id = ' + worker_id);

client.on('connect', () => {
    console.log('Successfully connected to MQTT broker!\n');
    console.log('bid response := [sender, receiver, current cycle number, bid_response, use private slot, allocation rule version, reward, success likelihood, time to live, task arrive pattern]');
    client.subscribe(topic);

    var count = 0;
    var start_time = Date.now();
    setInterval(() => {
        //cycle_num ++;
        count++;

        if (count == 1000) {
            let time_elapsed = (Date.now() -  start_time) / 1000;
            console.log(time_elapsed);
        }

        let bid_request = [worker_id, controller_id, 'bid_request',cycle_num];
        client.publish('bid_request', cbor.encode(bid_request));
    }, 0);
});

client.on('message', (topic, message) => {
    if (topic === 'bid_response') {
        console.log('topic: ' + topic);
        message = cbor.decode(message);
        console.log('response: ')
        console.log(message);
        console.log('\n');
    }
})

function randomInt(max) {
    return Math.floor(Math.random() * max);
}