const cbor = require('cbor');

module.exports.publish_sy_task = function(sy_tasks, client) {
    sy_tasks.forEach(([func, uuid]) => {
        let msg = new Map();
        msg.set('args', []);
        msg.set('func', func);
        msg.set('tsk_uuid', uuid);
        msg.set('idx', 0);
        msg.set('type', 2);
        msg.set('caller_uuid', this.controller_id);

        client.publishTo('/' + this.controller_id + '/' + uuid + '/jamj/sy_task', msg, 'cbor');
    });
    return;
};

