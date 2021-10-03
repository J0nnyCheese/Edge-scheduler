// const mqtt = require('mqtt');
// const publisher = mqtt.connect('mqtt://localhost:1234');
// const cbor = require('cbor');
// const BidResponder = require('../BidResponder.js');
// const {create_global_parameters} = require('../GlobalParameters.js');
// const controller_id = 5;

// publisher.subscribe('bid_request');

// publisher.on('connect', () => {
//     console.log('Successfully connected to broker!');
//     } 
// );

// let count = 0;
// let start_time = 0;

// publisher.on('message', (topic, request) => {
//     if (topic === 'bid_request') {
//         if (count == 0) start_time = Date.now();
//         request = cbor.decode(request);

//         // If the request is for the current controller
//         if (request[1] == controller_id) {
//             if (count == 1000) {
//                 let time_elapsed = Date.now() - start_time;
//                 console.log(time_elapsed/1000); 
//             }
//             count ++;
//         }
//     }
// });


//==============================================

// const {task_matching} = require('./TaskMatching.js');
// const {rt_scheduling} = require('./RTScheduling.js');
const BidResponder = require('../BidResponder.js');
const {create_global_parameters} = require('../GlobalParameters.js');
const AllocationRuleUpdater = require('../AllocationRuleUpdater.js');
const mqtt = require('mqtt');



function L1_Scheduler() {
    const publisher = mqtt.connect('mqtt://localhost:1234');
    let responder = new BidResponder(publisher, global.cycleDuration);
    //let allocation_rule_updater = new AllocationRuleUpdater(publisher);

    // let [A,T] = get_A_T_from_complier();
    // let S, LCMs, rt_schedules;

    publisher.on('connect', () => {
        console.log('Successfully connected to broker!');
        responder.start_bid_listening();
        //allocation_rule_updater.start_allocation_rule_update_listening();

        // ====eval=====
        let count = 0;
        let start_time = Date.now();
        // =============

    
        setInterval(() => {
            // console.log('====================== New cycle starts ======================= ');
            // console.log('Cycle: ' + global.current_cycle_num);

            //allocation_rule_updater.update_allocation_rule();
    
            responder.bid_probing(global.current_cycle_num);

            // [S, LCMs] = task_matching(A, T, global.rtDuration);
            // rt_schedules = rt_scheduling(S, T, LCMs, []);

            // T = recalculate_start_time_next_cycle(T);

            // global.current_cycle_num ++;

            // console.log('RT scheduling done. Controller is idle.');

        }, global.cycleDuration);
    });

}

// /**
//  * This function recalculates the start time of RT tasks on the next cycle.
//  * @param {Array} T - RT tasks and their requirements
//  * @returns {Array} A new T with updated start time on each RT task
//  */
// function recalculate_start_time_next_cycle(T) {
//     let new_T = [];
//     T.forEach((parameters) => {
//         let start_time = parameters[2][0];
//         let period = parameters[2][2];
//         let scheduled_task_counts =  (Math.ceil( (global.cycleDuration - start_time) / period ) - 1);
//         let new_start_time = (scheduled_task_counts + 1) * period + start_time - global.cycleDuration;

//         parameters[2][0] = new_start_time;
//         new_T.push(parameters);
//     });

//     return new_T;
// }

// // For local testing only
// function get_A_T_from_complier() {
//     let A = ['A1'];
//     let T = [
//     [['A1'],[],[100,400,1000,1000],'1'],
//     [['A1'],[],[200,200,800,200],'2'],
//     [['A1'],[],[0,50,600,1100],'3'],
//     ]
//     return [A,T];
// } 

create_global_parameters();
L1_Scheduler();