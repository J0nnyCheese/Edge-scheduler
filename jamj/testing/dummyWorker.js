var mqtt = require('mqtt');
var cbor = require('cbor');
var client = mqtt.connect('mqtt://localhost:1883');
var topic = 'bid_response';

var controller_id = "00000000000000000000000000000001";
// var worker_id = client.options.clientId;
var worker_id = "00000000000000000000000000000002";
var cycle_num = 3;
// var sy_task_uuid = 99;
var unique_call_id = 66666;
var thread_indx = 1;

console.log('Worker id = ' + worker_id);

client.on('connect', () => {
    console.log('Successfully connected to MQTT broker!\n');
    // console.log(client.options.clientId);
    
    // client.subscribe('/' + controller_id + '/jamj/bid_response');
    // console.log('Subscribe to ' + '/' + controller_id + '/jamj/bid_response');
    client.subscribe('/' + controller_id + '/jamc/tsk');
    console.log('Subscribe to ' + '/' + controller_id + '/jamc/tsk');
    client.subscribe('/' + worker_id + '/' + controller_id + '/resdata/' + thread_indx);
    console.log('Subscribe to ' + '/' + worker_id + '/' + controller_id + '/resdata/' + thread_indx);
    client.subscribe('/' + controller_id + '/jamj/rt_schedule');
    console.log('Subscribe to ' + '/' + controller_id + '/jamj/rt_schedule');

    //console.log('bid response := [sender, receiver, current cycle number, bid_response, use private slot, allocation rule version, reward, success likelihood, time to live, task arrive pattern]');
    
    setInterval(() => {
        // cycle_num ++;
        console.log('===============================================\ncycle: ' + cycle_num);

        let dummy_exec_result = new Map();
        dummy_exec_result.set('id', 'dummyTaskId');
        dummy_exec_result.set('res', ['dummyExecutionResults']);
        dummy_exec_result.set('idx', 'dummyThreadIndex');
        client.publish('/' + controller_id + '/' + worker_id + '/jamc/exec_results', cbor.encode(dummy_exec_result));
        console.log('Publish a dummy exeuction result to ' + '/' + controller_id + '/' + worker_id + '/jamc/exec_results');


        let bid_request = new Map();
        bid_request.set('sender', worker_id);
        bid_request.set('receiver', controller_id);
        bid_request.set('msg_type', 'bid_request');
        bid_request.set('current_cycle', cycle_num); 

        let tsk = new Map();
        tsk.set('args', [bid_request]);
        tsk.set('func', 'getBidResponse');
        tsk.set('id', unique_call_id);
        tsk.set('indx', thread_indx);
        tsk.set('type', 0);
        tsk.set('uuid', worker_id);
        client.publish('/' + worker_id + '/jamj/tsk', cbor.encode(tsk));
        console.log('Publish a task to ' + '/' + worker_id + '/jamj/tsk');

    }, 6500);
});

client.on('message', (topic, message) => {
    if (topic === '/' + controller_id+ '/jamj/bid_response') {
        message = cbor.decode(message);
        console.log('');
        console.log('topic: ' + topic);
        console.log('response: ' + JSON.stringify(message));
        sy_task_description = message.task_description;
        sy_task_description.forEach(([func, uuid]) => {
            client.subscribe('/' + message.sender + '/' + uuid + '/jamj/sy_task');
            console.log('Subscribe to ' + '/' + message.sender + '/' + uuid + '/jamj/sy_task');
        })
    } 
    if (topic === '/' + controller_id + '/jamc/tsk') {
        message = cbor.decode(message);
        if (message.func === 'updateRTSchedule') {
            console.log('Updated rt shedule =' + JSON.stringify(message));
        } else if (message.func === 'hello') {
            console.log('hello \n hello \n' + JSON.stringify(message));
            setTimeout(()=>{
                let callack = new Map();
                callack.set('id', message.id);
                callack.set('ack', 950);
                callack.set('indx', message.indx);
                console.log('Publish callack to ' + '/' + message.uuid + '/' + worker_id + '/callack/' + message.indx)
                client.publish('/' + message.uuid + '/' + worker_id + '/callack/' + message.indx, cbor.encode(callack));

                setTimeout(() => {
                    let resdata = new Map();
                    resdata.set('id', message.id);
                    resdata.set('res', 'hhhh');
                    resdata.set('indx', message.indx);
                    console.log('Publish res data to /' + message.uuid + '/' + worker_id + '/resdata/' + message.indx) ;
                    client.publish('/' + message.uuid + '/' + worker_id + '/resdata/' + message.indx, cbor.encode(resdata));
                }, 500)
            }, 500)
        }
    } if (topic === '/' + worker_id + '/' + controller_id + '/resdata/' + thread_indx) {
        message = cbor.decode(message);
        console.log('Received RPC result = ' + JSON.stringify(message));
        let resack = new Map();
        resack.set('id', message.id);
        resack.set('ack', 'ack');
        client.publish('/' + worker_id + '/' + controller_id + '/resack/' + thread_indx, cbor.encode(resack));
        console.log('Published resack to ' + '/' + worker_id + '/' + controller_id + '/resack/' + thread_indx);
    } else {
        try {
            message = cbor.decode(message);
            console.log('');
            console.log('topic: ' + topic);
            message = JSON.stringify(message);
            console.log('response: ' + message);
        } catch (error) {

        }
    }
})

function randomInt(max) {
    return Math.floor(Math.random() * max);
}