module.exports.create_global_parameters = function() {

    var controller_id = 5;
    var pp_repeat_period = 5000; // The period of probing phase
    var scheduling_duration = 50; // By how much the L1 Scheduler will schedule ahead of time

    global.controller_id = controller_id;
    global.pp_repeat_period = pp_repeat_period;
    global.scheduling_duration = scheduling_duration;
}