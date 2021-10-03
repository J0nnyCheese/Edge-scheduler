// const GlobalParameters = require('./GlobalParameters.js');
// const greedy_resources = GlobalParameters.greedy_resources;

const LinkedlistLib = require('./SinglyLinkedList.js');


/**
 * This function calls the actual scheduling function. This function first generates a list of RT
 * tasks to be scheduled for each resource/worker. It then checks if the current resource uses greedy scheduling or not.
 * Greedy scheduling algo. and normal scheduling algo. are invoked accordingly.
 * @param {Array} S - Task Matching Matrix
 * @param {Array} T - RT tasks and their requirements
 * @param {Array} LCMs - Hyper period (LCM) of scheduled tasks on 
 * @param {Array} greedy_resources - List of workers that requested to use greedy scheduling. Default is empty [].
 * @returns {Array} RT Schedules of each worker
 */
module.exports.rt_scheduling = function (S, T, LCMs, greedy_resources = []) {
    console.log('RT Scheduler starting ...');

    if (arguments.length < 3) {
        throw ('Error: Not enough parameters being passed to the RT Scheduler! Current number of parameters = ' + 
        arguments.length + '.');
    }

    // console.log(S);
    // console.log('');

    let rt_schedules = new Array();

    let worker_num = S[0].length - 1;
    let total_task_num = S.length-2;

    // Call scheduling algorithm on each column (a.k.a. each worker/resource)
    for (let j = 1; j <= worker_num; j ++) {
        let tasks_to_be_scheduled = new Array();
        tasks_to_be_scheduled.push('A'+j);

        let lcm = LCMs[j-1][1];

        let i = 1;
        let task_list = new Array();
        for (; i < total_task_num; i ++) {
            if (S[i][j] == '*' || S[i][j] == '+') {
                let task = [T[i-1][3], T[i-1][2]];
                task_list.push(task);
            }
        }
        tasks_to_be_scheduled.push(task_list);
        let schedule = new Array();
        if (greedy_resources.includes(S[0][j]))
            schedule = greedy_scheduling(tasks_to_be_scheduled, lcm);
        else 
            schedule = normal_scheduling(tasks_to_be_scheduled, lcm);
        rt_schedules.push(schedule);
    }

    return rt_schedules;
}

function greedy_scheduling(worker_tasks, lcm) {
    console.log('\nInvoking greedy scheduling...');
    console.log('Sadly, greedy scheduling has not been implemented :(');
}


/**
 * This function includes the actual implementation of normal scheduling algorithm, i.e. an EDF. 
 * It adds the periodic tasks to the final schedule in decreasing order of their deadline, i.e. shorter deadline first.
 * Even though the result output schedule is an Array, singly linked list is used as the internal data structure to manipulate schedules.
 * @param {Array} worker_tasks - List of RT tasks to be scheduled in a resource/worker
 * @param {Integer} lcm - Hyper period (LCM) of all RT tasks in a resource
 * @returns {Array} [worker ID, RT schedule]
 */
function normal_scheduling(worker_tasks, lcm) {
    console.log('Worker ' + worker_tasks[0]);
    worker_tasks[1] = sort_deadline(worker_tasks[1]);
    console.log(worker_tasks[1]);

    var final_schedule = new LinkedlistLib.SinglyLinkedList();

    // For each task
    let num_tasks = worker_tasks[1].length;
    for (let i = 0; i < num_tasks; i++) {
        let task_id = worker_tasks[1][i][0];

        // task_max_counter = number of times a RT task will be invoked during a hyper period
        let task_max_count = lcm / worker_tasks[1][i][1][2];

        let current_node = final_schedule.getHead();
        let prev_node = new LinkedlistLib.Task(current_node);
        let period = worker_tasks[1][i][1][2];
        let computation_time = worker_tasks[1][i][1][1];

        for (let count = 0; count < task_max_count; count ++) {
             // start_time = (arrival time of the task in the first time) + (count of the task) * (period of the task)
            let earlist_start_time = worker_tasks[1][i][1][0] + count * period; 
            //let latest_finish_time = earlist_start_time + period;
            let latest_start_time = earlist_start_time + period - computation_time;
            let start_time = earlist_start_time;
            let finish_time = start_time + computation_time;


            if (i == 0) { 
                // Just add every task to the static schedule in the first run
                final_schedule.add(task_id, count, start_time, finish_time);
            } else {
                while (start_time <= latest_start_time) {
                    if (earlist_start_time )


                    let conflict_num = final_schedule.hasConflict(current_node, start_time, finish_time);
                    if (conflict_num == 0) {
                        final_schedule.insertAfter(prev_node, task_id, count, start_time, finish_time);
                        break;
                    }
                    else {
                        start_time = current_node.getFinishTime();
                        finish_time = start_time + computation_time;
                        prev_node = current_node;
                        current_node = current_node.getNextTask();
                    }
                }
                if (start_time > latest_start_time)
                    throw 'Error: Cannot schedule the current task because of insufficient available computation time. This should not happen because the feasibility test is passed.';
            }
        }
    }

    final_schedule.printList();
    
    return [worker_tasks[0], final_schedule.toArray()];
    
}

/**
 * Sort tasks in decreasing order of their deadlines
 * @param {*} tasks List of RT tasks
 * @returns Sorted list of RT tasks
 */
function sort_deadline(tasks) {
    // deadline = start time + relative deadline
    tasks.sort((a,b) => (a[1][3]+a[1][0] >= b[1][3]+b[1][0] ? 1 : -1));
    return tasks;
}
