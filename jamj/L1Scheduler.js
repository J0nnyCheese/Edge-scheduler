/**
 * @file This the the entry file for the Controller side. It calls all components of a L1 scheduler.
 */

const {task_matching} = require('./TaskMatching.js');
const {rt_scheduling} = require('./RTScheduler.js');
const BidResponder = require('./BidResponder.js');
const AllocationRuleUpdater = require('./AllocationRuleUpdater.js');
const {publish_sy_task}= require('./SYScheduler.js');
const mqtt = require('mqtt');
const MQTTclient = require('./MQTTclient.js');

// For local testing only
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

class L1Scheduler {
    constructor (controller_id, priority_value_rule = null, worker_ids, allocation_rule = [[1,4,5],[2,6,7],[3,8,9]], allocation_rule_version = 42, current_cycle_num = 3, cycleDuration = 6500, syDuration = 1000, rtDuration = 5000, ppDuration = 500,num_probing_slots = 4, num_sy_slots = 4, rt_reward = 5) {
        if (cycleDuration != rtDuration + syDuration + ppDuration) 
            throw 'Error: The length of RT Dduation(' + rtDuration +'), SY duration(' + syDuration +'), and PP duration(' + this.ppDuration +') do not sum up to cycle duration(' + cycleDuration + ')' 
        
        if (worker_ids == null) {
            this.worker_ids = [];
            console.log('dasda')
        }

        if (priority_value_rule == null) {
            var priority_value_rule = new Map();
            priority_value_rule.set('+', 5); // 5 pts for scheduling a compulsory task (*)
            priority_value_rule.set('*', 2); // 2 pts for scheduling an optional task (+)
            priority_value_rule.set(' ', 0); // 0 pt for scheduling no task ( )
        }

        global.controller_id = controller_id;

        this.worker_ids = worker_ids;
        this.controller_id = controller_id;
        this.priority_value_rule = priority_value_rule;
        this.current_cycle_num = current_cycle_num;
        this.cycleDuration = cycleDuration;
        this.syDuration = syDuration;
        this.rtDuration = rtDuration;
        this.ppDuration = ppDuration;
        this.allocation_rule = allocation_rule;
        this.allocation_rule_version = allocation_rule_version;
        this.num_probing_slots = num_probing_slots;
        this.num_sy_slots = num_sy_slots;
        this.rt_reward = rt_reward;

        this.client = null;
        this.RPCRegister = [];
    }

    reformat_schedule(schedule) {
        let res = new Map();
        res.set('effective_cycle_num', this.current_cycle_num + 1); // Effective since the next cycle
        res.set('num_probing_slots', this.num_probing_slots);
        res.set('probing_duration', this.ppDuration);
        res.set('num_sy_slots', this.num_sy_slots);
        res.set('sy_duration_per_slot', this.syDuration / this.num_sy_slots);
        res.set('rt_schedule', schedule);
        res.set('rt_reward', this.rt_reward);
    
        return res;
    }

        
    /**
     * This function recalculates the start time of RT tasks on the next cycle.
     * @param {Array} T - RT tasks and their requirements
     * @returns {Array} A new T with updated start time on each RT task
     */
    recalculate_start_time_next_cycle(T) {
        let new_T = [];
        T.forEach((parameters) => {
            let start_time = parameters[2][0];
            let period = parameters[2][2];
            let scheduled_task_counts =  (Math.ceil( (this.cycleDuration - start_time) / period ) - 1);
            let new_start_time = (scheduled_task_counts + 1) * period + start_time - this.cycleDuration;

            parameters[2][0] = new_start_time;
            new_T.push(parameters);
        });

        return new_T;
    }

    registerFunc(name, func) {
        this.RPCRegister.push([name, func]);
    }

    run(ip, port) {
        const conn = mqtt.connect('mqtt://' + ip + ':' + port);
    
        console.log("Wait for a broker connection.");
        conn.on('connect', () => {
            console.log('Successfully connected to broker!');
            const client = new MQTTclient(this.controller_id, conn, false, 3000, 2);
            client.start();
            this.client = client;
    
            // client.launchRPCTo(worker_id, 1, 'TimeReturn', 0, 0);
    
            let responder = new BidResponder(client);
            // let allocation_rule_updater = new AllocationRuleUpdater(client);
        
            let S, LCMs, rt_schedules;
    
            responder.registFuncGetBidResponse();
            // allocation_rule_updater.start_allocation_rule_update_listening();
    
            if (this.worker_ids.length != 0) {
                this.worker_ids.forEach((worker_id) => {
                    client.subscribeTo('/' + this.controller_id + '/' + worker_id + '/jamc/exec_results', (data) => {
                        console.log('Execution results: ' + JSON.stringify(data));
                    })
                })
            }
    
            setInterval(() => {
                console.log('====================== New cycle starts ======================= ');
                console.log('Cycle: ' + this.current_cycle_num);

                this.RPCRegister.forEach(([name, func]) => {
                    this.client.registerFunc(name, func);
                })
                this.RPCRegister = [];
    
                let [A,T,SY] = get_task();
    
                // allocation_rule_updater.update_allocation_rule();
        
                let do_sy_scheuling = responder.bid_probing(this.current_cycle_num, SY);
                if (do_sy_scheuling == true) {
                    console.log(SY);
                    publish_sy_task(SY, client);
                }
    
                [S, LCMs] = task_matching(A, T, this.rtDuration);
                rt_schedules = rt_scheduling(S, T, LCMs, []);
    
                let schedule_to_broadcast = this.reformat_schedule(rt_schedules[0][1]);
    
                client.publishTo('/' + this.controller_id + '/jamj/rt_schedule', schedule_to_broadcast);
    
                T = this.recalculate_start_time_next_cycle(T);
    
                this.current_cycle_num ++;
    
                console.log('RT scheduling done. Controller is idle.\n');
    
            }, this.cycleDuration);
        });
    }
}

module.exports = L1Scheduler;