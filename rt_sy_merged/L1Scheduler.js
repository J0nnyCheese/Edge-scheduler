/**
 * @file This the the entry file for the Controller side. It calls all components of a L1 scheduler.
 */
const mqtt =require('mqtt');
const {task_matching} = require('./TaskMatching.js');
const {hybrid_scheduling} = require('./HybridScheduling.js');
var BidResponder = require('./BidResponder.js');
var {create_global_parameters} = require('./GlobalParameters.js');

function L1_Scheduler() {
    create_global_parameters();

    const publisher = mqtt.connect('mqtt://localhost:1234');
    const responder = new BidResponder(publisher);

    publisher.on('connect', () => {
        console.log('Successfully connected to broker!');
        responder.start_bid_listening();
    
        setInterval(() => {
            console.log('====================== New scheduling cycle starts =================== ');
            responder.bid_probing();

            console.log('Bid processing finished.');

            let [A,T] = get_tasks_from_complier();
            let S = task_matching(A,T);
            console.log(S);

            let rt_schedules = hybrid_scheduling(S,T, global.scheduling_duration)
            rt_schedules.forEach(([worker, static_schedule, unscheduled_tasks]) => {
                console.log(worker);
                console.log('unscheduled tasks: ');
                unscheduled_tasks.forEach(([[application_id, task_id], [earlist_start_time, computation_time, deadline], priority]) => {
                    console.log('application_id: ' + application_id + ', task_id: ' + task_id + ', earlist_start_time: ' + earlist_start_time + ', computation_time: ' + computation_time + ', deadline: ' + deadline + ', priority = ' + priority );
                })
                console.log(''); // newline
                //console.log(unscheduled_tasks);
            });

            console.log('\nScheduling done. System is idle.\n');
        }, global.pp_repeat_period);
    });
}

function get_tasks_from_complier() {
    let A = ['A1', 'A2', 'A3'];

    // Note: period = -1 means that the task is executed one time only
    // I used an arbitrary priority rule:
    // Lowest priority <-- 0 (unscheduled) <-- 1,2 (optional task priority) <-- 3,4 (compulsory task priority) <-- 5,6 (synchronous task priority) <-- 7 (reserved) <-- Highest priority 
    let T = [
    // RT task
    // compulsory worker = A1, optional worker = A2, [arrival time, computation time, period, deadline] = [1,4,10,10], [application id, task id] = [2,1], priority as a compulsory task = 3, priority as a optional task = 1
    [['A1'],['A2'],[1,4,10,10],[2, 1], 3, 1],

    // RT task
    // compulsory worker = A3, optional worker = [A1,A2], [arrival time, computation time, period, deadline] = [2,2,8,2], [application id, task id] = [1,7], priority as a compulsory task = 4, priority as a optional task = 2
    [['A3'],['A1', 'A2'],[2,2,8,2],[1, 7], 4, 2],

    // SY task
    // compulsory worker = [A1,A3], optional worker = void, [arrival time, computation time, period, deadline] = [2,2,-1,6], [application id, task id] = [2,2], priority as a compulsory task = 6, priority as a optional task = 6
    [['A1', 'A3'],[],[2,2,-1,6],[2, 2], 6, 5],
    ];
    return [A,T];
} 

L1_Scheduler();