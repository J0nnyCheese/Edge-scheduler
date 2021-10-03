/**    
 * @file Take a set of RT tasks and schedule them. Task matching (current file) -> Normal/Greedy RT scheduling.
 *       This file was developed using Kristen's previous scheduling implementation
 */

/**
 * 
 * @param {Array} A List of resource types, a.k.a. workers/sensor layer nodes
 * @param {Array} T List of RT tasks and their para & requirements to be scheduled
 * @param {Integer} max_hyper_period Max hyper period (lcm) allowed due to restriction from global RT execution length
 * @example A = [A1, A2, A3, ...]
 *          T = [RT1, RT2, RT3, ...], RT1 = [compulsoryReq, optionalReq, parameters, task ID]
 *          compulsoryReq & optionalReq = list of workers a task requires to be scheduled on
 *          parameters = [Arrival time, Computation time, Period, Deadline]
 * @returns {Array, Array} [S, LCMs] - S: The Task Matching Matrix S which includes a list of feasible RT tasks scheduled on each resource/worker
 *                                     LCMs: LCMs is the hyper period of scheduled tasks on each resource
 */
module.exports.task_matching = function (A,T, max_hyper_period = Number.MAX_SAFE_INTEGER, priority_value_rule = null) {

    if (priority_value_rule == null) {
        var priority_value_rule = new Map();
        priority_value_rule.set('+', 5); // 5 pts for scheduling a compulsory task (*)
        priority_value_rule.set('*', 2); // 2 pts for scheduling an optional task (+)
        priority_value_rule.set(' ', 0); // 0 pt for scheduling no task ( )
    }
    
    console.log('');
    console.log('Task Matching Algorithm starting ...');

    if (arguments.length < 2) {
        throw ('Error: Not enough parameters being passed to the Task Matching Algorithm! Current number of parameters = ' + 
        arguments.length + '.');
    }

    /** Example of S
     * +--------------------
     * |      A1  A2  A3  A4
     * | RT1  +   *   +  
     * | RT2      +   *  
     * | RT3  *           +
     * | UtilizationRate
     * | Priority
     */

    let S = new Array(T.length + 3);

    let slen = S.length;
    let alen = A.length;

    for (let i = slen - 1; i >= 0; i --) {
        S[i] = new Array(A.length + 1);
        if (i < slen - 3)
            S[i+1][0] = "Task_id " + T[i][3]; // label RT_i on each row
    }
    for (let i = 0; i < alen; i ++)
        S[0][i+1] = A[i]; // label A_i on each column
    S[0][0] = undefined;
    S[slen-1][0] = 'PriorityValue';
    S[slen-2][0] = 'UtilizationRate';


    S = matrix_initialization(S,A,T);
    [S, LCMs] = feasibility_check(S,A,T,max_hyper_period);
    S = priority_value_compute(S, priority_value_rule);
    console.log('S = ');
    console.log(S);
    console.log(' '); // newline
    
    return [S, LCMs];
}

/**
 * This function fills the S matrix with the list of RT tasks requirements in T 
 * '+' denotes compulsory requirement; '+' denotes optional requirement; ' ' denotes no requirement
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
                S[i+1][j+1] = '+';
            else if (optReq.includes(A[j]))
                S[i+1][j+1] = '*';
            else 
                S[i+1][j+1] = ' ';
        }
    }
    return S;
}

/**
 * This function generates a list of feasibility/utilization rates on workers/resources
 * LCM and GCD is used to 
 * @param {Array} S - Task Matching Matrix
 * @param {Array} A - List of resources/workers
 * @param {Array} T - List of RT tasks and their requirements
 * @param {Integer} max_hyper_period Max hyper period (lcm) allowed due to restriction from global RT execution length
 * @returns {Array} [S, LCMs] LCMs is the hyper period of scheduled tasks on each resource
 */
function feasibility_check(S,A,T,max_hyper_period = Number.MAX_SAFE_INTEGER) {
    let alen = A.length;
    let util_rate = 0;
    let LCMs = new Array();
    for (let i = 1; i <= alen; i ++) {
        //console.log('**Checking feasibility on ' + S[0][i]);
        
        let lcm = 0;
        let pass_feasibility_test = false;
        [pass_feasibility_test, util_rate, lcm] = feasibility_helper(S,i,T,max_hyper_period);
        while (pass_feasibility_test == false) {
            S = drop_task_helper(S, T, i, max_hyper_period, lcm);
            [pass_feasibility_test, util_rate, lcm] = feasibility_helper(S,i,T,max_hyper_period);
        
        }
        LCMs.push([S[0][i], lcm]);

        let slen = S.length;
        S[slen-2][i] = util_rate;
    }

    return [S, LCMs];
}


/**
 * Helper function to ad the actual LCM (Hyper Period) Calculation
 * @param {Array} S - Task Matching Matrix
 * @param {Integer} i - Current column index on which resource's utilization rate we are calculating
 * @param {Array} T - List of RT tasks and their requirements
 * @param {Integer} max_hyper_period 
 * @returns {Array} [if_pass_test, utilization_rate] - First entry tells you if the feasibility test is passed/failed
 */
function feasibility_helper(S,i,T,max_hyper_period = Number.MAX_SAFE_INTEGER) {
    let util_rate = 0.;
    let lcm = 0;
    let periods = new Array();
    let computationTime = new Array();

    let tlen = T.length;
    for (let j = 0; j < tlen; j ++) {
        if (S[j+1][i] == '+' || S[j+1][i] == '*') {
            //console.log(S[0][i] + ' has a scheduled task ' + S[j+1][0] + ' with period = ' + T[j][2][2] + ' and computation time = ' + T[j][2][1] + '.');
            periods.push(T[j][2][2]);
            computationTime.push(T[j][2][1]);
        }
    }

    //console.log('Computation time of all tasks: ');
    //console.log(computationTime);
    //console.log('');

    lcm = findlcm(periods, periods.length);

    let clen = computationTime.length;
    for (let k = 0; k < clen; k ++)
        util_rate += (computationTime[k] / periods[k]);

    //console.log('lcm = ' + lcm + '; utilization rate = ' + util_rate);

    if (lcm > max_hyper_period) {
        console.log('Warning: Hyper period is larger than the restriction.');
        return [false, util_rate, lcm];
        //util_rate = 1.1;
    }

    if (util_rate > 1) {
        console.log('Warning: Utilization rate of the current resource > 100%.')
        console.log(''); // newline
        return [false, util_rate, lcm];
    }

    console.log(''); // newline
    return [true, util_rate, lcm];
}

/**
 * Compute priority value for each worker/resource according to the priority_value_rule
 * @param {Array} S - Task matching matrix
 * @param {Map<String, Integer>} priority_value_rule - A rule that tells the Scheduler what is the priority value of each task type (ex. compulsory and optional)
 * @returns {Array} S - Task matching matrix **with the Priority Value row filled** 
 */
function priority_value_compute(S, priority_value_rule) {
    let slen = S.length;
    let tlen = S[0].length;
    for (let j = 1; j < tlen; j ++) {
        let priority_value = 0;
        for (let i = 1; i < slen-2; i ++) {
            if (S[i][j] == ' ')
                continue;
            else 
                priority_value += priority_value_rule.get(S[i][j]);
        }
        S[slen-1][j] = priority_value;
    }
    return S;
}


/**
 * Drop one task on a specified column
 * @param {Array} S - Task matching matrix
 * @param {Array} T - List of RT tasks and their parameters
 * @param {Integer} i - Column index of S on where to drop RT tasks
 * @param {Integer} max_hyper_period - Not been used for now
 * @param {Integer} lcm - LCM/Hyper Period of the all scheduled tasks on a worker
 * @returns {Array} S - The S matrix **with one RT task being dropped**
 */
function drop_task_helper(S, T, column, max_hyper_period, lcm) {
    console.log('Removing some RT tasks...');
    let slen = S.length;

    // index of the target task (compulsory or optional) to drop 
    let comp_target_column = 0; 
    let comp_target_row = 0;
    let comp_max_ddl = 0;
    let opt_target_column = 0;
    let opt_target_row = 0;
    let opt_max_ddl = 0;

    let k = max_hyper_period <= lcm ? 3 : 1;
    // When k = 3, we are dropping tasks with bigger deadline
    // When k = 1, we are dropping tasks with bigger computation time

    for (let row = 1; row < slen - 2; row ++) {
        if (S[row][column] == '+') {
            if (comp_max_ddl <= T[row-1][2][k]) {
                comp_max_ddl = T[row-1][2][k];
                comp_target_row = row;
                comp_target_column = column;
            }
        }
        else if (S[row][column] == '*') {
            if (opt_max_ddl <= T[row-1][2][k]) {
                opt_max_ddl = T[row-1][2][k];
                opt_target_row = row;
                opt_target_column = column;
            }
        }
    }

    if (opt_max_ddl > 0 ) {
        S[opt_target_row][opt_target_column] = ' ';
        //console.log('Drop one optional task on row = ' + opt_target_row + ', column = ' + opt_target_column);
    }
    else if (comp_max_ddl > 0) {
        S[comp_target_row][comp_target_column] = ' ';
        //console.log('Drop one compulsory task on row = ' + comp_target_row + ', column = ' + comp_target_column);
    } else {
        console.log('Error: Did not find any task to drop');
    }

    return S;
}

/**
 * Utility function to find GCD of 'a' and 'b'
 * @param {Integer} a 
 * @param {Integer} b 
 * @returns {Integer} The GCD of a and b
 */
function gcd(a, b)
{
    if (b == 0)
        return a;
    return gcd(b, a % b);
}
 
/**
 * @param {Array} arr Int array
 * @param {Integer} n Length of the 'arr'
 * @returns {Integer} LCM of array elements
 */
function findlcm(arr, n)
{
    // Initialize result
    let ans = arr[0];
 
    // ans contains LCM of arr[0], ..arr[i]
    // after i'th iteration,
    for (let i = 1; i < n; i++)
        ans = (((arr[i] * ans)) /
                (gcd(arr[i], ans)));
 
    return ans;
}
