const cbor = require('cbor');

class AllocationRuleUpdater {
    constructor(mqttClient) {
        if (arguments.length < 1)
            throw ('Error: Not enough parameters being passed to the allocation rule updater! Current number of parameters = ' + 
            arguments.length + '.');

        this.client = mqttClient;
        this.latest_update = null;
        this.latest_update_version = -1;
    }

    /**
     * This function makes the L1 Scheduler actively listening for a topic called 'allocation_rule_update'.
     * If an valid update is found, the update is saved. If multiple updates are found, only the latest update is saved.
     */
    start_allocation_rule_update_listening() {
        console.log('Start allocation rule update listening...');
        this.client.subscribe('allocation_rule_update');
    
        this.client.on('message', (topic, request) => {
            if (topic == 'allocation_rule_update') {
                console.log('Received one allocation rule update message, update = ' );
                request = cbor.decode(request);
                console.log(request);
                let [allocation_rule, allocation_rule_version, effective_time] = request;
                if (allocation_rule_version > this.allocation_rule_version && allocation_rule_version > this.latest_update_version) {
                    console.log('Found a valid allocation rule update, version = ' + allocation_rule_version);
                    this.latest_update = request;
                    this.latest_update_version = allocation_rule_version;
                }
            }
        });
    }

    /**
     * This function checks if an valid update is found. If there is an update, the update is scheduled to be effective at a future moment specified by the 'effective_time' field of the update.
     */
    update_allocation_rule() {
        if (this.latest_update != null && this.latest_update_version != -1) {
            let [allocation_rule, allocation_rule_version, effective_time] = this.latest_update;
            let remaining_time_until_update = (effective_time - this.current_cycle_num) * this.cycleDuration;
    
            setTimeout(()=> {
                this.allocation_rule = allocation_rule;
                this.allocation_rule_version = allocation_rule_version;
                console.log('\nSuccessfully update the allocation rule.\n');
                this.latest_update = null;
                this.latest_update_version = -1;
            }, remaining_time_until_update);
        }
        else {
            console.log('Do not find any available allocation rule updates.');
        }
    }

}

module.exports = AllocationRuleUpdater;