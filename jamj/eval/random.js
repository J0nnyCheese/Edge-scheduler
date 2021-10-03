// Controller side code

const mqtt = require('mqtt');
const cbor = require('cbor');

let bid_request1 = [125, 5, 'bid_request', 4];
let bid_request2 = [157, 5, 'bid_request', 5];
let bid_request3 = [199, 5, 'bid_request', 6];
let bid_request4 = [58, 5, 'bid_request', 4];
let bid_request5 = [49, 5, 'bid_request', 5];

let controller_id = 5;
let schedule_cycles = 5;
let response_cache = new Array(schedule_cycles).fill(new Map());
//response_cache.length = schedule_cycles;

// response_cache.forEach((element, index) => {
//     response_cache[index] = new Map();
// });

// const publisher = mqtt.connect('mqtt://localhost:1234');

// publisher.on('connect', () => {
//     console.log('Successfully connected to broker!');
//     publisher.subscribe('bid_request');
//     } 
// );

// publisher.on('message', (topic, request) => {
//     if (topic === 'bid_request') {
//         request = cbor.decode(request);

//         if (request[1] == controller_id) {

//         }

//     }
// })

console.log(response_cache);