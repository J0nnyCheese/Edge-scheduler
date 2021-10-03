/** 
 * @file This module actively listens for inbound bid requests. 
 * It makes decisions on whether to use public/private SY slots and also the SY task rewards (per worker).
 * The module also broadcast bid response to workers.
*/
// const cbor = require('cbor');

class BidResponder {
    bid_requests;
    socket;
    client;
    cycleDuration;
    execution_history;
    max_history_length;
    disable_SY_execution;
    fund;
    reward_history;

    bid_response_cache;
    valid_cache;
    sy_ahead_scheduling_cycle;



    /**
     * 
     * @param {mqtt Instance} client - A mqtt instance used to send and receive messages between controller and worker
    //  * @param {Integer} cycleDuration - Duration of a cycle. Cycle := probing phase -> RT execution -> SY execution
     * @param {Integer} default_fund - Amount of fund a controller has after the initialization
     * @param {Integer} default_reward - Default amount of reward a controller give per worker 
     * @param {Integer} default_max_history_length - Default amount of previous SY execution results a L1 Scheduler is keeping
     * @param {Integer} reward_history_length - Default amount of previous SY rewards a L1 Scheduler is keeping
     */
    constructor(MQTTclient, default_fund = 500, default_reward = 10, default_max_history_length = 10, reward_history_length = 10, default_sy_ahead_scheduling_cycle = 5) {
        if (arguments.length < 1)
            throw ('Error: Not enough parameters being passed to the Bid Responder constructor! Current number of parameters = ' + 
            arguments.length + '.');

        this.MQTTclient = MQTTclient;
        this.bid_requests = [];
        // this.client = client;
        this.cycleDuration = this.cycleDuration;
        this.execution_history = [];
        this.max_history_length = default_max_history_length; // Max length of the 'execution_history'
        this.disable_SY_execution = 0;
        this.fund = default_fund;
        this.reward_history = [];
        this.reward_history.length = reward_history_length; 

        //this.bid_response_cache = new Array(default_bid_response_cache_length).fill(new Map());
        //this.bid_response_cache = new Array(default_bid_response_cache_length).fill(null);
        this.bid_response_cache = [null, null, null];
        this.sy_ahead_scheduling_cycle = default_sy_ahead_scheduling_cycle;
        this.valid_cache = false;

        this.client_id = this.controller_id;


        for (let i = 0; i < reward_history_length; i ++)
            this.reward_history[i] = default_reward;
    };


    registFuncGetBidResponse() {
        if (global.controller_id == undefined)
            throw ('Error: Did not find the current controller id from \'global\'');
        console.log('Start bid listening...');

        this.MQTTclient.registerFunc('getBidResponse', (request)=>{
            this.bid_requests.push(request.args[0]);
            return '/' + this.client_id + '/jamj/bid_response';
        }, 800)
    };

    /**
     * This function processes the bid requests saved in the Bid Responder. It selects and returns a list of valid bid requests. Valid means that a request is not out-dated.
     * @returns {Boolean, Array} [Has valid bids to process, list of workers to response in the probing phase]
     */
    bid_processing(current_cycle_num) {
        let workers_to_response = [];

        let [cached_response_begin_time, cached_response_end_time, cached_response] = this.bid_response_cache;
        if (cached_response_end_time < current_cycle_num) {
            //console.log('Bid response [begin time, end time] = [' + cached_response_begin_time + ', ' + cached_response_end_time + ']. ' + 'Current cycle num = '  + current_cycle_num + '. Set valid_cache to false');
            this.valid_cache = false;
        }
        else 
            this.valid_cache = true;

        this.bid_requests.forEach(request => {
            console.log('Bid request = ' + JSON.stringify(request));
            if (this.valid_cache == true) {
                if (request.current_cycle >= current_cycle_num & request.current_cycle <= cached_response_end_time) {
                    workers_to_response.push([request.sender, request.current_cycle]); // push [worker_id, cycle_num]
                } else 
                    console.log('Worker id = ' + request.sender + ' requested a SY task allocation that is either outdated or too far ahead of time. L1 Scheduler has to discard it.');
            } else {
                if (request.current_cycle >= current_cycle_num & request.current_cycle <= current_cycle_num + this.sy_ahead_scheduling_cycle) {
                    workers_to_response.push([request.sender, request.current_cycle]); // push [worker_id, cycle_num]
                } else 
                    console.log('Worker id = ' + request.sender + ' requested a SY task allocation that is either outdated or too far ahead of time. L1 Scheduler has to discard it.');
            }
        });
        if (workers_to_response.length == 0) {
            console.log('No valid bid request found.');
            this.bid_requests = []; // clear bid request buffer
            return [false, []];
        }
        else {
            this.bid_requests = []; // clear bid request buffer
            return [true, workers_to_response];
        }
    };

    /**
     * This function takes an execution feedback and updates the local copy of the execution history, which will be used to calculate average success likelihood.
     * Note that we are only keeping the N most recent execution results, where N = this.max_history_length. 
     * In the 'else' condition, you can see that I used a modulo '%' to allocate the most recent execution result to a correct entry.
     * @param {Array} execution_feedback - Execution feedback from complier of a previous cycle
     */
    update_execution_history(execution_feedback) {
        let is_success = execution_feedback[3];
        let execution_cycle = execution_feedback[0];

        if (execution_feedback.length < this.max_history_length)
            this.execution_history.push(is_success);
        else
            this.execution_history[execution_cycle % this.max_history_length] = is_success;
    }

    /**
     * This function gets the SY execution results from the SY application from the last (few) cycle(s). Fund and future SY reward are updated according to the execution result.
     * The private slot will be activated if execution jitter is intolerable.
     * @param {Float} reward_increase_percentage The percentage of bid reward to be increased after a failure SY execution
     * @param {Float} success_execution_bonus The extra points a controller is rewarded for having a successful SY execution
     * @param {Float} reward_decrease_percentage The percentage of bid reward to be decreased after a successful SY execution
     * @returns {Boolean, Float} - [whether to activate private slot, reward of the next (few) cycle(s)]
     */
    make_SY_decision(reward_increase_percentage = 0.2, success_execution_bonus = 100., reward_decrease_percentage = 0.05) {
        // console.log('\nMaking decision on SY slots & rewards...');
    
        let execution_feedback = this.execution_feedback_generator();
        // console.log('Execution feedback (fake) : [cycle number, reward, participant number, success/fail, reason of failure (if applicable)]')
        // console.log(execution_feedback);

        this.update_execution_history(execution_feedback);
    
        let cycle_num = execution_feedback[0];
        let reward = execution_feedback[1];
        let participant_num = execution_feedback[2];
        let is_success = execution_feedback[3];
        let reason_of_failure = execution_feedback[4];
    
        let use_private_slot = 0; // Final decision on whether to use private slot
        let future_reward = reward;
    
        this.fund -= reward * participant_num;
        if (is_success == 0) {
            if (reason_of_failure === 'jitter') {
                use_private_slot = 1;
            } else if (reason_of_failure === 'low_number_participant') {
                future_reward = reward * (1 + reward_increase_percentage);
            }
        } else { // Successful SY execution on previous cycle
            this.fund += success_execution_bonus;
    
            // Decrease future reward if we are having a success execution
            // Goal: to minimize the number of participants per SY application
            future_reward = reward * (1 - reward_decrease_percentage);
        }
    
        // update reward_history
        this.reward_history[cycle_num % this.reward_history.length] = future_reward;
    
        return [use_private_slot, future_reward];
    };

    /**
     * This functions generates a bid response.
     * @param {Integer} receiver - worker id
     * @param {Integer} cycle_num - which cycle is the current bid response intended for?
     * @param {Boolean} use_private_slot 
     * @param {Float} future_reward 
     * @param {Array} task_arrive_pattern 
     * @param {Array} SY - A list of synchronous to be scheduled onto workers. Ex=[[task_name_1, task_uuid_1], [task_name_2, task_uuid_2], ...]
     */
    generate_bid_response(receiver, cycle_num, use_private_slot, future_reward, task_arrive_pattern, SY) {
        let rsp = new Map();

        let private_slot = -1;
        if (use_private_slot == 1) {
            for (let i = 0 ;i < this.allocation_rule.length; i ++)
                if (this.allocation_rule[i].includes(this.controller_id))
                    private_slot = i;
        }
    
        // Generate bid response
        let time_to_live = 3;
        let success_likelihood = this.calculate_success_likelihood();
        let message_type = 'bid_response';
        //let bid_response = [global.controller_id, receiver, cycle_num, message_type, private_slot, allocation_rule_version, future_reward, success_likelihood, time_to_live, task_arrive_pattern];


        rsp.set('sender', this.controller_id);
        rsp.set('receiver', receiver);
        rsp.set('effective_cycle_num', cycle_num);
        rsp.set('msg_type', message_type);
        rsp.set('use_private_slot', private_slot);
        rsp.set('allocation_rule_version', allocation_rule_version);
        rsp.set('reward', future_reward);
        rsp.set('success_likelihood', success_likelihood);
        rsp.set('task_arrival_pattern', task_arrive_pattern);
        rsp.set('task_description', SY)
    
        return rsp;
    };

    /**
     * This is a testing-only function that generates fake execution feedback
     * @returns {Array} - execution feedback := [cycle number, reward per worker, number of participants, successful/failed execution, reason of failure]
     */
    execution_feedback_generator() {
        let cycle_num = 3;
        let reward_per_worker = this.reward_history[cycle_num % this.reward_history.length];
        let participant_num = this.randomInt(7) + 3;
        let is_success = this.randomInt(2);
        let failure_reason = ['jitter', 'low_number_participant'];
        
        let execution_feedback = [cycle_num, reward_per_worker, participant_num, is_success, failure_reason[this.randomInt(2)]];
        
        return execution_feedback;
    };

    /**
     * This is a 'main' function that shows you how to use most of the functions implemented above. This can be called by L1 Scheduler.
     * Pre-req: registFunc
     GetBidResponse() is called
     * @param {Integer} current_cycle_num - The current cycle number
     * @param {Array} SY - A list of synchronous to be scheduled onto workers. Ex=[[task_name_1, task_uuid_1], [task_name_2, task_uuid_2], ...]
     * @returns {Boolean} - Return true if there are workers waiting for future SY tasks, and thus the L1 Scheduler should later broadcast SY tasks.
    */
    bid_probing(current_cycle_num, SY) {
        let [has_workers_to_response, workers_to_response] = this.bid_processing(current_cycle_num);
        //if (!has_workers_to_response)
            //console.log('Skip the current cycle');
        if (SY.length == 0) {
            console.log('SY scheduling: skip the current cycle because no valid SY task is waiting.');
            return false;
        }
        else if (has_workers_to_response) {
            let [use_private_slot, future_reward] = this.make_SY_decision();
            // console.log('Workers to schedule task on: [[worker_id, cycle_num],...]');
            // console.log(workers_to_response);

            let task_arrive_pattern = this.fetch_arrive_pattern_from_complier();

            //let [cached_response_begin_time, cached_response_end_time, cached_response] = this.bid_response_cache;
            let bid_response = null;

            workers_to_response.forEach(
                ([worker_id, cycle_num]) => {
                    // If there is a 'cached' valid bid response, then don't need to generate another bid response 
                    if (this.valid_cache == true) {
                        console.log('Found a valid cached bid response.');
                        bid_response = this.bid_response_cache[2];
                        bid_response[1] = worker_id; // Change the bid response receiver
                        this.MQTTclient.publishTo('/' + this.client_id + '/jamj/bid_response', bid_response);
                        // console.log('Publish a bid response to ' + '/' + this.client_id + '/jamj/bid_response');
                    }
                    // Else, need to generate a bid response and 'cache' it for the next K cycles. Here K = this.sy_ahead_scheduling_cycle
                    else {
                        console.log('Didn\'t find a valid cached bid response. Generating a new bid response and cache it.');
                        bid_response = this.generate_bid_response(worker_id, cycle_num, use_private_slot, future_reward, task_arrive_pattern, SY);
                        this.bid_response_cache = [cycle_num, cycle_num + this.sy_ahead_scheduling_cycle, bid_response];
                        this.valid_cache = true;
                        //this.client.publish('bid_response', cbor.encode(bid_response));
                        this.MQTTclient.publishTo('/' + this.client_id + '/jamj/bid_response', bid_response);
                        // console.log('Publish a bid response to ' + '/' + this.client_id + '/jamj/bid_response');
                    }
                    // console.log('bid_response: ');
                    // console.log(bid_response);
                    //this.client.publish('bid_response', bid_response);
                }
            );
            return true;
        }
        else 
            console.log('SY scheduling: skip the current cycle because no valid bid response is received.');
        
        return false;
    };


    /**
     * This functions simply takes an average on the number of successful SY execution over the past.
     * @returns The ratio of successful executions among all execution results, i.e. the success likelihood.
     */
    calculate_success_likelihood() {
        let total_record = this.execution_history.length;
        let total_success = 0;

        this.execution_history.forEach((is_success) => {
            if (is_success == 1) 
                total_success ++;
        });

        if (total_record == 0)
            return -1; // Default is -1, i.e. no previous execution record for prediction 
        else
            return total_success / total_record;
    };

    /**
     * Testing only
     */
    fetch_arrive_pattern_from_complier() {
        return 'Placeholder for SY task arrive pattern';
    };

    randomInt(max) {
        return Math.floor(Math.random() * max);
    };
}  

module.exports = BidResponder;