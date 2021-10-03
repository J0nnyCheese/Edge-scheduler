/** 
 * @file This module actively listens for inbound bid requests. 
 * It makes decisions on whether to use public/private SY slots and also the SY task rewards (per worker).
 * The module also broadcast bid response to workers.
*/

cbor = require('cbor');

class BidResponder {
    // internal fields
    bid_requests;           // A buffer that stores a list of bid requests have not yet been processed.
    //socket;                 // Socket used for MQTT connection
    publisher;              // A MQTT publisher that publishes bid responses and many more things
    //cycleDuration;          
    execution_history;      // A list of K latest SY execution results, where K = max_history_length 
    max_history_length;     // A integer. See above
    disable_SY_execution;   // A boolean/integer. This field = 1 iff the L1 scheduler wants to disable SY execution for some periods
    fund;                   // A float. The points available to a controller to do SY tasks
    reward_history;         // A list of X latest rewards used for SY execution
    execution_history_index;// A integer. This is primarily used to index a position in 'execution_history'
    reward_history_index;   // A integer. This is primarily used to index a position in 'reward_history'

    constructor(publisher, default_fund = 500, default_reward = 10, default_max_history_length = 10, reward_history_length = 10, default_time_to_live = 3) {
        if (arguments.length < 1)
            throw ('Error: Not enough parameters being passed to the Bid Responder constructor! Current number of parameters = ' + 
            arguments.length + '.');

        this.bid_requests = [];
        //this.socket = socket;
        this.publisher = publisher;
        //this.cycleDuration = cycleDuration;
        this.execution_history = [];
        this.max_history_length = default_max_history_length; // Max length of the 'execution_history'
        this.disable_SY_execution = 0;
        this.fund = default_fund;
        this.reward_history = [];
        this.reward_history.length = reward_history_length; 
        this.execution_history_index = 0;
        this.reward_history_index = 0;
        this.time_to_live = default_time_to_live;
        
        for (let i = 0; i < reward_history_length; i ++)
            this.reward_history[i] = default_reward;
    };


    start_bid_listening() {

        if (global.controller_id == undefined)
            throw ('Error: Did not find the current controller id from \'global\'');

        this.publisher.subscribe('bid_request');

        this.publisher.on('message', (topic, request) => {
            if (topic === 'bid_request') {
                request = cbor.decode(request);
                //request = JSON.parse(request);

                // If the request is for the current controller
                if (request[1] == global.controller_id)
                    this.bid_requests.push(request);
            }
        });
    };

    /**
     * 
     * @returns {Boolean, Array} [Has valid bids to process, list of workers to response in the probing phase]
     */
    bid_processing() {
        let workers_to_response = [];
        console.log('Received bid requests: ');
        console.log(this.bid_requests);
        this.bid_requests.forEach(request => {
            workers_to_response.push(request[0]); // push worker_id
        });
        if (workers_to_response.length == 0) {
            console.log('No valid request found (requests may be outdated)');
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
        let is_success = execution_feedback[2];

        if (execution_feedback.length < this.max_history_length)
            this.execution_history.push(is_success);
        else
            this.execution_history[this.execution_history_index % this.max_history_length] = is_success;

        if (this.execution_history_index == Number.MAX_SAFE_INTEGER) //Avoid overflow?
            this.execution_history_index = this.execution_history_index % this.max_history_length + 1;
        else
            this.execution_history_index ++;
    }


    /**
     * This function fetches the latest SY execution feedback from complier, and then it makes decision on SY rewards for the future.
     * I used multiplicative increase additive decrease (MIAD) to update the reward value.
     * @param {Float} reward_increase_percentage - The percentage of bid reward to be increased after a failure SY execution
     * @param {Float} success_execution_bonus The - extra points a controller is rewarded for having a successful SY execution
     * @param {Integer} reward_decrease - How much the future reward will decrease for haivng a successful SY execution
     * @returns {Boolean, Float} - [whether to activate private slot, reward of the next (few) cycle(s)]
     */
    make_SY_decision(reward_increase_percentage = 0.2, success_execution_bonus = 100., reward_decrease = 5) {
        console.log('\nMaking decision on SY slots & rewards...');
    
        let execution_feedback = this.execution_feedback_generator();
        console.log('Execution feedback : [reward, participant number, success/fail, reason of failure (if applicable)]')
        console.log(execution_feedback);

        this.update_execution_history(execution_feedback);
    
        let reward = execution_feedback[0];
        let participant_num = execution_feedback[1];
        let is_success = execution_feedback[2];
        let reason_of_failure = execution_feedback[3];
    
        let future_reward = reward;
    
        this.fund -= reward * participant_num;
        if (is_success == 0) {
            if (reason_of_failure === 'jitter') {
                console.log('Not sure what to do here.... SY tasks fails because of jitter.');
                console.log('Ignored the failure for now...');
            } else if (reason_of_failure === 'low_number_participant') {
                future_reward = reward * (1 + reward_increase_percentage);
            }
        } else { // Successful SY execution on previous cycle
            this.fund += success_execution_bonus;
    
            // Decrease future reward if we are having a success execution
            // Goal: to minimize the number of participants per SY application
            future_reward = reward - reward_decrease;
        }
    
        // update reward_history
        this.reward_history[this.reward_history_index % this.reward_history.length] = future_reward;
        if(this.reward_history_index == Number.MAX_SAFE_INTEGER) // Avoid overflow
            this.reward_history_index = this.reward_history_index % this.reward_history.length + 1;
        else 
            this.reward_history_index ++;
    
        return future_reward;
    };


    /**
     * 
     * @param {String} topic 
     * @param {Integer} receiver - worker id
     * @param {Integer} cycle_num - which cycle is the current bid response intended for?
     * @param {Boolean} use_private_slot 
     * @param {Float} future_reward 
     * @param {Array} task_arrive_pattern 
     */
    publish_bid_response(topic, receiver, future_reward, task_arrive_pattern) {

        // Generate bid response
        let success_likelihood = this.calculate_success_likelihood();
        let message_type = 'bid_response';
        let bid_response = [global.controller_id, receiver, message_type, future_reward, success_likelihood, this.time_to_live, task_arrive_pattern];
        //bid_response = JSON.stringify(bid_response);
        bid_response = cbor.encode(bid_response);
    
        this.publisher.publish(topic, bid_response);
    };


    /**
     * This is a testing-only function that generates fake execution feedback
     * @returns {Array} - execution feedback := [cycle number, reward per worker, number of participants, successful/failed execution, reason of failure]
     */
    execution_feedback_generator() {
        //let cycle_num = 3;
        let reward_per_worker = this.reward_history[this.reward_history_index % this.reward_history.length];
        let participant_num = this.randomInt(7) + 3;
        let is_success = this.randomInt(2);
        let failure_reason = ['jitter', 'low_number_participant'];
        
        let execution_feedback = [reward_per_worker, participant_num, is_success, failure_reason[this.randomInt(2)]];
        
        return execution_feedback;
    };

    /**
     * This is a 'main' function that shows you how to use most of the functions implemented above. This can be called by L1 Scheduler.
     * Pre-req: start_bid_listening() should be called before bid_probing()
     */
    bid_probing() {
        let [has_worker_to_do, workers_to_response] = this.bid_processing();
        if (!has_worker_to_do)
            console.log('Skip the current cycle');
        else {
            let future_reward = this.make_SY_decision();
            console.log('Workers to response: [worker_id, cycle_num]');
            console.log(workers_to_response);

            let task_arrive_pattern = this.fetch_arrive_pattern_from_complier();

            workers_to_response.forEach(
                (worker_id) => {
                    this.publish_bid_response('bid_response', worker_id, future_reward, task_arrive_pattern);
                });
        }
    };


    /**
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

    fetch_arrive_pattern_from_complier() {
        return 'Placeholder for SY task arrive pattern';
    };
    
    randomInt(max) {
        return Math.floor(Math.random() * max);
    };
}  

module.exports = BidResponder;