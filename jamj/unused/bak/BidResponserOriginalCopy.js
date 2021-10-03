/** 
 * @file This module actively listens for inbound bid requests. 
 * It makes decisions on whether to use public/private SY slots and also the SY task rewards (per worker).
 * The module also broadcast bid response to workers.
*/

const {create_global_parameters} = require('./GlobalParameters.js');

function start_bid_listening (listening_duration = 1000) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                var requests = local_request_generator(); // testing only
                resolve(requests);
            } catch (error) {
                reject(error);
            }
        }, listening_duration)
    });
}

function process_request(bid_requests, max_allowed_cycle_ahead = 0) {
    return new Promise((resolve, reject) => {
        let workers_to_response = [];
        console.log('Received bid requests: ');
        console.log(bid_requests);
        bid_requests.forEach(request => {
            console.log(request);
            if (request[3] >= global.current_cycle_num & request[3] <= global.current_cycle_num + max_allowed_cycle_ahead)
                workers_to_response.push([request[0], request[3]]); // push [worker_id, cycle_num]
            else if (request[3] > global.current_cycle_num + max_allowed_cycle_ahead)
                console.log('Worker id = ' + request[0] + ' requested a SY task allocation that is beyond the max allowed ahead of cycles. L1 Scheduler has to discard it.');
        });
        if (workers_to_response === [])
            reject('No valid request found');
        else 
            resolve(workers_to_response);
    }) 
}

function SY_decision(reward_increase_percentage = 0.2, success_execution_bonus = 100, reward_decrease_percentage = 0.05) {
    console.log('\nMaking decision on SY slots & rewards...');

    let execution_feedback = execution_feedback_generator();
    console.log('Execution feedback : [cycle number, reward, participant number, success/fail, reason of failure (if applicable)]')
    console.log(execution_feedback);

    let cycle_num = execution_feedback[0];
    let reward = execution_feedback[1];
    let participant_num = execution_feedback[2];
    let is_success = execution_feedback[3];
    let reason_of_failure = execution_feedback[4];

    let use_private_slot = 0; // Final decision on whether to use private slot
    let future_reward = reward;

    global.fund -= reward * participant_num;
    if (is_success == 0) {
        if (reason_of_failure === 'jitter') {
            use_private_slot = 1;
        } else if (reason_of_failure === 'low_number_participant') {
            future_reward = reward * (1 + reward_increase_percentage);
        }
    } else { // Successful SY execution on previous cycle
        global.fund += success_execution_bonus;

        // Decrease future reward if we are having a success execution
        // Goal: to minimize the number of participants per SY application
        future_reward = reward * (1 - reward_decrease_percentage);
    }

    // MUTEX LOCK???
    // update reward_history
    global.reward_history[cycle_num % reward_history.length] = future_reward;

    return [use_private_slot, future_reward];
}

function broadcast_bid_response(receiver, cycle_num, use_private_slot, future_reward, task_arrive_pattern) {
    let private_slot = -1;
    if (use_private_slot == 1) {
        for (let i = 0 ;i < allocation_rule.length; i ++)
            if (allocation_rule[i].includes(controller_id))
                private_slot = i;
    }

    // Generate bid response
    let time_to_live = 3;
    let success_likelihood = calculate_success_likelihood();
    let message_type = 'bid_response';
    let bid_response = [controller_id, receiver, cycle_num, message_type, use_private_slot, allocation_rule_version, future_reward, success_likelihood, time_to_live, task_arrive_pattern];

    broadcast(bid_response);
}

function make_sy_decision_and_broadcast(workers_to_response) {
    let [use_private_slot, future_reward] = SY_decision();
    let task_arrive_pattern = fetch_arrive_pattern_from_complier();
    workers_to_response.forEach(
        ([worker_id, cycle_num]) => {
            broadcast_bid_response(worker_id, cycle_num, use_private_slot, future_reward, task_arrive_pattern);
        });
}

/**
 *                   main()
 *                /         \
 *      bid listening       SY decision on private slot and reward
 *              |            | 
 *  process bid request      |
 *               \          /
 *                \        /
 *           generate bid responses
 *           and broadcast them
 */
function main() {
    create_global_parameters();
    
    Promise.all([start_bid_listening(1000).then(process_request).catch(e => {console.log(e)})
        , SY_decision()])
        .then(results => {
            let [use_private_slot, future_reward] = results[1];
            let task_arrive_pattern = fetch_arrive_pattern_from_complier();
            let workers_to_response = results[0];

            console.log('\nBroadcasting bid responses to workers...');
            workers_to_response.forEach(
                ([worker_id, cycle_num]) => {
                    broadcast_bid_response(worker_id, cycle_num, use_private_slot, future_reward, task_arrive_pattern);
                });
    });
}
main();


// =========================== Local Testing Function ============================= 
function local_request_generator() {
    var num_req = randomInt(3) + 3; // just a random number...
    var requests = new Array();
    let controller = randomInt(100000); // Current controller ID
    for (let i = 0; i < num_req; i++) {
        let request = new Array();
        let worker = randomInt(100000); // Current worker ID
        let bid_request = 'bid_request';
        let cycle_num = randomInt(2) + 4;
        request.push(worker);
        request.push(controller);
        request.push(bid_request);
        request.push(cycle_num);

        requests.push(request);
    }
    return requests;
}

function execution_feedback_generator() {
    let cycle_num = 3;
    let reward_per_worker = reward_history[cycle_num % reward_history.length];
    let participant_num = randomInt(7) + 3;
    let is_success = randomInt(2);
    let failure_reason = ['jitter', 'low_number_participant'];
    
    let execution_feedback = [cycle_num, reward_per_worker, participant_num, is_success, failure_reason[randomInt(2)]];
    
    return execution_feedback;
}

function calculate_success_likelihood() {
    return 0.5;
}

function fetch_arrive_pattern_from_complier() {
    return 'Placeholder for SY task arrive pattern';
}

function broadcast(msg) {
    console.log('Broadcasting msg: ');
    console.log( msg );
}

function randomInt(max) {
    return Math.floor(Math.random() * max);
}