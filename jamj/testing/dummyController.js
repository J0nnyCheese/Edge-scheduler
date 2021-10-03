const L1Scheduler = require('../L1Scheduler.js');

var priority_value_rule = new Map();
priority_value_rule.set('+', 5); // 5 pts for scheduling a compulsory task (*)
priority_value_rule.set('*', 2); // 2 pts for scheduling an optional task (+)
priority_value_rule.set(' ', 0); // 0 pt for scheduling no task ( )

l1 = new L1Scheduler("00000000000000000000000000000001", priority_value_rule, ["00000000000000000000000000000002"]);
l1.run("127.0.0.1", 1883);