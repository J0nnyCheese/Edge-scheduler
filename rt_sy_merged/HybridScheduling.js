const LinkedlistLib = require('./SinglyLinkedList.js');
const {PQelement, PriorityQueue} = require('./PriorityQueue.js');


/**
 * This function calls the actual scheduling function. This function first generates a list of RT
 * tasks to be scheduled for each resource/worker. It then checks if the current resource uses greedy scheduling or not.
 * Greedy scheduling algo. and normal scheduling algo. are invoked accordingly.
 * @param {Array} S - Task Matching Matrix
 * @param {Array} T - RT/SY tasks and their requirements
 * @param {Integer} scheduling_duration - Over how much time (in ms) should the L1 scheduler schedule tasks in the future.
 * @returns {Array} - Schedules of each worker
 */
module.exports.hybrid_scheduling = function (S, T, scheduling_duration) {
    console.log('RT Scheduler starting ...');

    if (arguments.length < 3) {
        throw ('Error: Not enough parameters being passed to the RT Scheduler! Current number of parameters = ' + 
        arguments.length + '.');
    }

    let rt_schedules = new Array();

    let worker_num = S[0].length - 1;
    let total_task_num = T.length;

    // Call scheduling algorithm on each column (a.k.a. each worker/resource)
    for (let j = 1; j <= worker_num; j ++) {
        let tasks_to_be_scheduled = new Array(); 
        tasks_to_be_scheduled.push('A'+j);

        let task_list = new Array();
        for (let i = 1; i <= total_task_num; i ++) {
            if (S[i][j] != 0) {
                // [task id, requirements, priority]
                let task = [S[i][0], T[i-1][2], S[i][j]];
                task_list.push(task);
            }
        }
        tasks_to_be_scheduled.push(task_list);
        let schedule = normal_scheduling(tasks_to_be_scheduled, scheduling_duration);
        rt_schedules.push(schedule);
    }

    return rt_schedules;
}

/**
 * This function includes the actual implementation of normal scheduling algorithm, i.e. an EDF. 
 * It adds the periodic tasks to the final schedule in decreasing order of their deadline, i.e. shorter deadline first.
 * Even though the result output schedule is an Array, singly linked list is used as the internal data structure to manipulate schedules.
 * @param {Array} worker_tasks - List of RT tasks to be scheduled in a resource/worker
 * @param {Integer} lcm - Hyper period (LCM) of all RT tasks in a resource
 * @returns {Array} [worker ID, RT schedule]
 */
function normal_scheduling(worker_tasks, scheduling_duration) {
    console.log('Worker ' + worker_tasks[0]);
    worker_tasks[1] = sort_by_task_priority(worker_tasks[1]); // tasks are sorted by their priorities
    //worker_tasks[1] = group_by_application(worker_tasks[1]);
    //worker_tasks[1] = sort_by_task_priority_within_application(worker_tasks[1]);
    //console.log(worker_tasks[1]);
    console.log(''); //newline

    let final_schedule = new LinkedlistLib.SinglyLinkedList();
    let unscheduled_task_instances = new PriorityQueue();

    let num_tasks = worker_tasks[1].length;
    for (let i = 0; i < num_tasks; i++) {
        let [application_id, task_id] = worker_tasks[1][i][0];
        let [arrival_time, computation_time, period, deadline] = worker_tasks[1][i][1];
        let priority = worker_tasks[1][i][2];

        let task_max_count = period == -1 ? 1 : Math.floor(scheduling_duration / period);

        //console.log('application_id : ' + application_id + ' ,task_id : ' + task_id + ' ,arrival_time : ' + arrival_time + ' ,computation_time : ' + computation_time + ' ,period : ' + period + ' ,deadline : ' + deadline + ' ,priority : ' + priority);

        let current_node = final_schedule.getHead();
        let next_node = null;
        if (current_node != null) {
            if (current_node.getStartTime() != 0) {
                // Append a dummy node to the front (start and end at 0)
                let dummy = new LinkedlistLib.Task('dummy','dummy',0,0,0);
                dummy.setNext(current_node);
                current_node = dummy;
            }
            next_node = current_node.getNextTask();
        }

        for (let count = 0; count < task_max_count; count ++) {
            let earlist_start_time  = period == -1 ? arrival_time : arrival_time + count * period;
            let latest_finish_time = earlist_start_time + deadline;
            let latest_start_time = latest_finish_time - computation_time;
            let start_time = earlist_start_time;
            let finish_time = start_time + computation_time;

            if (i == 0) {
                final_schedule.add(application_id, task_id, count, start_time, finish_time);
            } else {
                while (true){
                    let available_interval = [current_node.getFinishTime(), (next_node == null) ? Number.MAX_SAFE_INTEGER : next_node.getStartTime()];
                    let feasible_duration = overlapping_interval(available_interval, [earlist_start_time, latest_finish_time]);
                    if(feasible_duration[1] - feasible_duration[0] < computation_time) {
                        start_time = current_node.getFinishTime();
                        finish_time = start_time + computation_time;
                        if (start_time > latest_start_time)
                            break;
                        current_node = next_node;
                        next_node = current_node.getNextTask();
                        continue;
                    }
                    start_time = feasible_duration[0];
                    finish_time = start_time + computation_time;
                    final_schedule.insertAfter(current_node, application_id, task_id, count, start_time, finish_time);
                    current_node = current_node.getNextTask();
                    next_node = current_node.getNextTask();
                    break;
                }

                if (start_time > latest_start_time) {
                    let unfeasible_task = [[application_id, task_id], [earlist_start_time, computation_time, deadline], priority];
                    unscheduled_task_instances.enqueue(unfeasible_task, earlist_start_time);
                }
            }
        }
    }

    final_schedule.printList();
    
    return [worker_tasks[0], final_schedule.toArray(), unscheduled_task_instances.toArray()];
    
}

function add_slack_server(rt_schedules) {
    
}

/**
 * @param {Array} tasks - A list of SY/RT tasks and their parameters  
 * @returns - A list of ST/RT tasks grouped by their application id (tasks for the same application belongs to one group)
 */
function group_by_application(tasks) {
    // for each task in tasks: [[application id, task id], [requirements], priority]
    tasks.sort((a,b) => (a[0][0] >= b[0][0] ? 1 : -1));
    return tasks;
}

/**
 * @param {Array} tasks - A list of SY/RT tasks and their parameters  
 * @returns - A list of ST/RT tasks sorted by their priority within the same application
 */
function sort_by_task_priority_within_application(tasks) {
    tasks.sort(([[application_id_1, task_id_1], parameters_1, priority_1],[[application_id_2, task_id_2], parameters_2, priority_2]) => {
        if (application_id_1 == application_id_2 && priority_1 <= priority_2) 
                return 1;
        else return -1;
    });
    return tasks;
}

/**
 * @param {Array} tasks - A list of SY/RT tasks and their parameters  
 * @returns - A list of ST/RT tasks sorted by their priority. Application group is not taken into account.
 */
function sort_by_task_priority(tasks) {
    tasks.sort(([[application_id_1, task_id_1], parameters_1, priority_1],[[application_id_2, task_id_2], parameters_2, priority_2]) => {
        if (priority_1 <= priority_2) 
                return 1;
        else return -1;
    });
    return tasks;
}

function application_usage_time(application_id, tasks) {
    let usage = 0;
    let total_task_num = tasks.length;
    for (let i = 0; i < total_task_num; i ++) {
        if (tasks[i][0][0] == application_id)
            usage += tasks[i][1][2];
    }
    return usage;
}

/**
 * Given two time intervals [start, end], find their overlapping interval and return it. Return [0,0] if no overlap.
 * @param {Array} interval1 
 * @param {Array} interval2 
 */
function overlapping_interval(interval1, interval2) {
    let left_bound = Math.max(interval1[0], interval2[0]);
    let right_bound = Math.min(interval1[1], interval2[1]);
    if (right_bound - left_bound < 0)
        return [0,0];
    else
        return [left_bound, right_bound];
}