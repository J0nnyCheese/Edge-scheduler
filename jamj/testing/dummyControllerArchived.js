
const {task_matching} = require('../TaskMatching.js');
const {rt_scheduling} = require('../RTScheduler.js');
const BidResponder = require('../BidResponder.js');
const {create_global_parameters} = require('../GlobalParameters.js');
const AllocationRuleUpdater = require('../AllocationRuleUpdater.js');
const {publish_sy_task}= require('../SYScheduler.js');
const mqtt = require('mqtt');
const MQTTclient = require('../MQTTclient.js');

// An old version of the dummyController, it may not work

let worker_id = '00000000000000000000000000000002';

function L1_Scheduler() {
    const conn = mqtt.connect('mqtt://localhost:1883');

    conn.on('connect', () => {
        console.log('Successfully connected to broker!');
        const client = new MQTTclient(conn, verbose = true, timerLen = 3000, timeoutRetry = 2);
        client.start();

        client.registerFunc('Square', (data) => {
            console.log('RPC: Square(), data = ' + data);
        })

        client.registerFunc('TimeReturn', (data) => {
            console.log('Time Return received');
        })

        client.launchRPCTo(worker_id, 1, 'TimeReturn', 0, 0);

        let responder = new BidResponder(client);
    
        let S, LCMs, rt_schedules;

        responder.registFuncGetBidResponse();

        client.subscribeTo('/' + global.controller_id + '/' + worker_id + '/jamc/exec_results', (data) => {
            console.log('Execution results: ' + JSON.stringify(data));
        })


    
        setInterval(() => {
            console.log('====================== New cycle starts ======================= ');
            console.log('Cycle: ' + global.current_cycle_num);

            client.launchRPCTo(worker_id, 1, "TimeReturn", 0, 0, 0);

            let [A,T,SY] = get_task();

            // allocation_rule_updater.update_allocation_rule();
    
            do_sy_scheuling = responder.bid_probing(global.current_cycle_num, SY);
            if (do_sy_scheuling == true) {
                console.log(SY);
                publish_sy_task(SY,client);
            }

            [S, LCMs] = task_matching(A, T, global.rtDuration);
            rt_schedules = rt_scheduling(S, T, LCMs, []);

            schedule_to_broadcast = reformat_schedule(rt_schedules[0][1]);

            client.publishTo('/' + global.controller_id + '/jamj/rt_schedule', schedule_to_broadcast, encoding = 'cbor');

            T = recalculate_start_time_next_cycle(T);

            global.current_cycle_num ++;

            console.log('RT scheduling done. Controller is idle.\n');

        }, global.cycleDuration);
    });

}

/**
 * This function recalculates the start time of RT tasks on the next cycle.
 * @param {Array} T - RT tasks and their requirements
 * @returns {Array} A new T with updated start time on each RT task
 */
function recalculate_start_time_next_cycle(T) {
    let new_T = [];
    T.forEach((parameters) => {
        let start_time = parameters[2][0];
        let period = parameters[2][2];
        let scheduled_task_counts =  (Math.ceil( (global.cycleDuration - start_time) / period ) - 1);
        let new_start_time = (scheduled_task_counts + 1) * period + start_time - global.cycleDuration;

        parameters[2][0] = new_start_time;
        new_T.push(parameters);
    });

    return new_T;
}

function reformat_schedule(schedule) {
    let res = new Map();
    res.set('effective_cycle_num', global.current_cycle_num + 1); // Effective since the next cycle
    res.set('num_probing_slots', global.num_probing_slots);
    res.set('probing_duration', global.ppDuration);
    res.set('num_sy_slots', global.num_sy_slots);
    res.set('sy_duration_per_slot', global.syDuration / global.num_sy_slots);
    res.set('rt_schedule', schedule);
    res.set('rt_reward', global.rt_reward);

    return res;
} 

// For local testing only. Generate sample RT task.
function get_task() {
    let A = ['Worker1'];
    let T = [
    [['Worker1'],[],[0,300,2000,3000],'rt_tsk1'],
    [['Worker1'],[],[0,500,2400,2000],'rt_tsk2'],
    [['Worker1'],[],[0,100,600,1500],'rt_tsk3'],
    ];
    let SY = [['sy_task1', 99]];
    return [A,T,SY];
} 



create_global_parameters();
L1_Scheduler();