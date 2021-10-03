var mqtt = require('mqtt');
var cbor = require('cbor');
var client = mqtt.connect('mqtt://localhost:1883');
var topic = 'allocation_rule_update';

let update_period = 2; // allocation rule is updated in every 10 cycles
let counter = 0;
let base_cycle = 4;
let allocation_rule = [[1,4,5],[2,6,7],[3,8,9]];
let allocation_rule_version = 44;

let cycle_duration = 6500;

client.on('connect', () => {
    console.log('Successfully connected to MQTT broker!\n');
    console.log('Allocation rule := [allocation_rule_array, allocation_rule_version, effective_cycle]\n');
    client.subscribe(topic);
    
    setInterval(() => {
        let effective_time = base_cycle + counter * update_period;
        counter ++;
        let update = [allocation_rule, allocation_rule_version, effective_time];
        allocation_rule_version ++;
        update = cbor.encode(update);
        client.publish(topic, update);
        console.log('Publish one allocation rule update: [');
        console.log(allocation_rule);
        console.log(', ' + allocation_rule_version + '\n, ' + effective_time + '\n]');
    }, update_period * cycle_duration);
});


function randomInt(max) {
    return Math.floor(Math.random() * max);
}