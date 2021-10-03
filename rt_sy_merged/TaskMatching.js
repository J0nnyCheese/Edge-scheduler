/**    
 * @file Take a set of RT tasks and schedule them. Task matching (current file) -> Normal RT+SY scheduling.
 *       This file was developed using Kristen's previous scheduling implementation
 */

/** Definition
 *  For each task in T, task := [compulsory workers, optional workers, requirements, task id, compulsory priority, optional priority]
 *  For all compulsory priorities and optional priorities: compulsory priority > optional priority
 *  In this algorithm I defined: unscheduled priority = {0}; optional priority = {1,2}; compulsory priority = {3,4}; SY priority (both compulsory and optional)= {5,6}. A priority value of 7 is not used.
 *  Note that tasks can be **RT or SY**. For SY tasks, their compulsory and optional sets of workers have the same priority = 8.
 *  A := list of workers = [A1, A2, A3, ...]
 */

/**
 * 
 * @param {Array} A List of resource types, a.k.a. workers/sensor layer nodes
 * @param {Array} T List of RT tasks and their para & requirements to be scheduled
 * @param {Integer} max_hyper_period Max hyper period (lcm) allowed due to restriction from global RT execution length
 * @example A = [A1, A2, A3, ...]
 *          T = [RT1, RT2, RT3, ...], RT1 = [compulsoryReq, optionalReq, parameters, [application ID, task ID], priority as compulsory task, priority as optional task]
 *          compulsoryReq & optionalReq = list of workers a task requires to be scheduled on
 *          parameters = [Arrival time, Computation time, Period, Deadline]
 * @returns {Array, Array} [S, LCMs] - S: The Task Matching Matrix S which includes a list of feasible RT tasks scheduled on each resource/worker
 *                                     LCMs: LCMs is the hyper period of scheduled tasks on each resource
 */
module.exports.task_matching = function (A,T) {

    console.log('\n');
    console.log('Task Matching Algorithm starting ...');

    if (arguments.length < 2) {
        throw ('Error: Not enough parameters being passed to the Task Matching Algorithm! Current number of parameters = ' + 
        arguments.length + '.');
    }

    /** Example of S
     * +--------------------
     * |                         A1  A2  A3  A4
     * | Application 1, Task 1   8   0   8   0   -> This task is SY (b/c of the highest priority)
     * | Application 7, Task 2   0   5   1   0   -> This task is RT
     * | Application 3, Task 8   3   7   0   3   -> This task is RT
     * | Priority                11  12  9   3
     */

    let S = new Array(T.length + 2);

    let slen = S.length;
    let alen = A.length;

    // label RT_i on each row
    for (let i = 0; i < slen - 1; i ++) {
        S[i] = new Array(alen + 1);
        if (i != 0)
            S[i][0] = T[i-1][3];
        else {
            // label A_i on first row of each column
            for (let j = 0; j < alen; j ++)
                S[0][j+1] = A[j];
        }
    }

    S[slen - 1] = new Array(alen + 1);
    S[slen-1][0] = 'PriorityValue';

    // label A_i on first row of each column
    for (let i = 0; i < alen; i ++)
        S[0][i+1] = A[i];

    S[0][0] = '';


    S = matrix_initialization(S,A,T);
    S = priority_value_compute(S);

    return S;
}

/**
 * This function fills the S matrix with the list of RT tasks requirements and priorities in T 
 * @param {Array} S A task matching matrix
 * @param {Array} A List of resource types, a.k.a. workers/sensor layer nodes
 * @param {Array} T List of tasks and their para & requirements to be scheduled
 */
function matrix_initialization(S,A,T) {
    let tlen = T.length;
    let alen = A.length;

    for (let i = 0; i < tlen; i ++) {
        let compReq = T[i][0];
        let optReq = T[i][1];
        for (let j = 0; j < alen; j ++) {
            if (compReq.includes(A[j]))
                S[i+1][j+1] = T[i][4];
            else if (optReq.includes(A[j]))
                S[i+1][j+1] = T[i][5];
            else 
                S[i+1][j+1] = 0;
        }
    }
    return S;
}

/**
 * Compute priority value for each worker/resource by summing up the priority of each scheduled task
 * @param {Array} S - Task matching matrix
 * @param {Map<String, Integer>} priority_value_rule - A rule that tells the Scheduler what is the priority value of each task type (ex. compulsory and optional)
 * @returns {Array} S - Task matching matrix **with the Priority Value row filled** 
 */
function priority_value_compute(S) {
    let slen = S.length;
    let tlen = S[0].length;
    for (let j = 1; j < tlen; j ++) {
        let priority_value = 0;
        for (let i = 1; i < slen-1; i ++) {
            priority_value += S[i][j];
        }
        S[slen-1][j] = priority_value;
    }
    return S;
}