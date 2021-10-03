const cbor = require('cbor');

class MQTTclient {

    /**
     * @param {Client class object} client - A MQTT client connecting to a broker. Ex. client = mqtt.connect(URL)
     * @param {Boolean} verbose - Set to true if you want detailed messages displayed as the MQTTclient class handles each message
     * @param {Integer} timerLen - Timerout length before a retry
     * @param {Integer} timeoutRetry - Number of retry for sending each message
     */
    constructor(controller_id, client, verbose = true, timerLen = 4000, timeoutRetry = 3) {
        if (timeoutRetry < 0) 
            throw "Error: timeoutRetry cannot be set to be less than 0";
        if (timerLen <= 0)
            throw 'Error: timerLen cannot be set to be less than or equal to 0'

        this.controller_id = controller_id;
        this.client = client;
        this.topicCallbackMap = new Map();
        this.registeredFuncMap = new Map();
        this.verbose = verbose;
        this.timerMap = new Map();
        this.timerLen = timerLen;
        this.timeoutRetry = timeoutRetry;
    }

    /**
     * MQTTclient will subscribe to '/controller_id/jamc/tsk' after calling this function. It will automatically handles the Call Ack, sends result data, and waits for Res Ack.
     * @param {String} msgEncoding - The type of message encoding one can choose to encode Call Ack and ResData messages. Current available option is 'cbor'
     */
    startListenRPC(msgEncoding = 'cbor') {
        this.subscribeTo('/' + this.controller_id + '/jamc/tsk', (data) => {
            if (this.registeredFuncMap.has(data.func)) {
                let estiDuration = this.registeredFuncMap.get(data.func)[1];
                this.sendCallAck(data.uuid, data.id, estiDuration, data.indx, msgEncoding);

                let res = this.registeredFuncMap.get(data.func)[0](data);
                this.sendResData(data.uuid, data.id, res, data.indx, msgEncoding);
            } else 
                throw "Received a invalid RPC request because the remote function is not registerd in local machine."
        })
    }

    /**
     * Launch a RPC to a spcified callee
     * @param {String or Integer} uuidCallee - unique id of the callee
     * @param {Integer} callID - unique id to identify the launching remote task in local machine
     * @param {String} RPCfunc - Remote function to launch
     * @param {*} args - Arguments of the RPC function
     * @param {Integer} on_rt_thread - Place RPC onto the RT thread of the callee
     * @param {Integer} tskType - 0 for batch, 1 for RT, 2 for SY, 3 for interactive
     * @param {Integer} mqttThreadIndx - MQTT thread index of the local machine. There may be multiple MQTT client running at the same time. 
     * @param {String} encoding - The type of message encoding one can choose to encode Call Ack and ResData messages. Current available option is 'cbor'
     */
    launchRPCTo(uuidCallee, callID, RPCfunc, args, on_rt_thread, tskType = 0, mqttThreadIndx = 0, encoding = 'cbor') {
        if (typeof(RPCfunc) != 'string') {
            throw 'Error: RPC call function is not of type \'string\''; 
        }

        let rpcCall = new Map();
        rpcCall.set('args', args);
        rpcCall.set('func', RPCfunc);
        rpcCall.set('id', callID);
        rpcCall.set('indx', mqttThreadIndx);
        rpcCall.set('type', tskType);
        rpcCall.set('on_rt_thread', on_rt_thread);
        rpcCall.set('uuid', this.controller_id);

        let callAckTimeoutRoutine = () => {
            let numRetryLeft = this.timerMap.get('/' + this.controller_id + '/' + callID);
            if (numRetryLeft <= 0) {
                console.log('Error: Call Ack from \'' + '/' + this.controller_id + '/' + uuidCallee + '/calack' + '\' was not received within waiting period. Abort the waiting...');
                this.timerMap.delete('/' + this.controller_id + '/' + callID);
                this.unsubscribe('/' + this.controller_id + '/' + uuidCallee + '/calack');
            } else if (numRetryLeft == Number.MAX_SAFE_INTEGER) {
                this.timerMap.delete('/' + this.controller_id + '/' + callID);
                this.unsubscribe('/' + this.controller_id + '/' + uuidCallee  + '/calack');
            } else {
                this.timerMap.set('/' + this.controller_id + '/' + callID, numRetryLeft - 1);
                this.publishTo('/' + uuidCallee + '/jamc/tsk', rpcCall, encoding);
                setTimeout(callAckTimeoutRoutine, this.timerLen);
            }
        };

        this.timerMap.set('/' + this.controller_id + '/' + callID, this.timeoutRetry); // Setting the number of timeout retryies to default

        this.subscribeTo('/' + this.controller_id + '/' + uuidCallee + '/calack', (data) => {
            this.timerMap.set('/' + this.controller_id + '/' + callID, Number.MAX_SAFE_INTEGER); // Set receiving ack to max int
            if (this.verbose) {
                console.log('Received RPC call ACK = ' + JSON.stringify(data));
            }
            this.timerMap.set('/' + this.controller_id + '/' + callID + '/resdat', this.timeoutRetry);
            this.subscribeTo('/' + this.controller_id + '/' + uuidCallee + '/resdat', (data) => {
                if (this.verbose) {
                    console.log('Received result data of a previous RPC call');
                }

                this.timerMap.set('/' + this.controller_id + '/' + callID + '/resdat', Number.MAX_SAFE_INTEGER);

                let resack = new Map();
                resack.set('id', callID);
                resack.set('ack', 'ack');

                this.publishTo('/' + this.controller_id + '/' + uuidCallee + '/resack', resack, encoding); 
            })
            setTimeout(()=> {
                let resDataStatus = this.timerMap.get('/' + this.controller_id + '/' + callID + '/resdat');
                if (resDataStatus != Number.MAX_SAFE_INTEGER) {
                    console.log('Error: Did not receive result data from RPC (func = ' + RPCfunc + ', callee = ' + uuidCallee + ') within waiting period. Abort the execution process...');
                }
                this.unsubscribe('/' + this.controller_id + '/' + uuidCallee + '/resdat');
            }, this.timeoutRetry * this.timerLen);
        })

        this.publishTo('/' + uuidCallee + '/jamc/tsk', rpcCall, encoding);

        setTimeout(callAckTimeoutRoutine, this.timerLen);
    }


    /**
     * Send RPC Call Ack back to a Caller. This function should be called once a RPC is received.
     * @param {Integer or String} uuidCaller - unique id of the Caller
     * @param {Integer} callID  - unique id of the RPC in the Caller's machine
     * @param {Integer} estCallDuration - estimated amount of time required to finish executed RPC.
     * @param {Integer} indx - MQTT thread index 
     * @param {String} encoding - encoding scheme for the Call Ack message
     */
    sendCallAck(uuidCaller, callID, estCallDuration, indx, encoding = 'cbor') {
        let ack = new Map();
        ack.set('id', callID);
        ack.set('ack', estCallDuration);
        ack.set('indx', indx);
        this.publishTo('/' + uuidCaller + '/' + this.controller_id + '/calack', ack, encoding);
    }


    /**
     * Send result data of a rpevious RPC to a Callee through MQTT broker.
     * @param {Integer or String} uuidCaller - unique id of the Caller
     * @param {Integer} callID - unique id of the RPC in the Caller's machine
     * @param {*} res - Result of the RPC. Can be in any form
     * @param {Integer} indx - MQTT thread index
     * @param {String} encoding - encoding scheme for the Call Ack message
     */
    sendResData(uuidCaller, callID, res, indx, encoding = 'cbor') {
        this.timerMap.set('/' + uuidCaller + '/' + callID, this.timeoutRetry); // Setting the number of timeout retryies to default

        this.subscribeTo('/' + uuidCaller + '/' + this.controller_id + '/resack', (data) => {
            this.timerMap.set('/' + uuidCaller + '/' + callID, Number.MAX_SAFE_INTEGER); // Set receiving ack to max int
            if (this.verbose) {
                console.log('Received ResData ACK = ' + JSON.stringify(data));
            }
        })

        let resMsg = new Map();
        resMsg.set('id', callID);
        resMsg.set('res', res);
        resMsg.set('indx', indx);

        let resAckTimeoutRoutine = () => {
            let numRetryLeft = this.timerMap.get('/' + uuidCaller + '/' + callID);
            if (numRetryLeft <= 0) {
                console.log('Error: Res Ack from \'' + '/' + uuidCaller + '/' + this.controller_id + '/resack' + '\' was not received within waiting period. Abort the waiting...');
                this.timerMap.delete('/' + uuidCaller + '/' + callID);
            } else if (numRetryLeft == Number.MAX_SAFE_INTEGER) {
                this.timerMap.delete('/' + uuidCaller + '/' + callID);
                this.unsubscribe('/' + uuidCaller + '/' + this.controller_id + '/resack');
            } else {
                this.publishTo('/' + uuidCaller + '/' + this.controller_id + '/resdat', resMsg, encoding);
                this.timerMap.set('/' + uuidCaller + '/' + callID, numRetryLeft - 1);
                setTimeout(resAckTimeoutRoutine, this.timerLen);
            }
        };

        this.publishTo('/' + uuidCaller + '/' + this.controller_id + '/resdat', resMsg, encoding);

        setTimeout(resAckTimeoutRoutine, this.timerLen);
    }

    /**
     * Subscribe to a MQTT topic and execute a callback function when a message is received on that topic.
     * @param {String} topic - MQTT topic to subscribe
     * @param {Function} OnReceivingMsg - Callback function when a message is received. The message can be the first input to the callback, but you have to know the format of the message in order to use it.
     */
    subscribeTo(topic, OnReceivingMsg) {
        if (this.client != null) {
            this.client.subscribe(topic);
            console.log('Subscribe to topic ' + topic);
            this.topicCallbackMap.set(topic, OnReceivingMsg);
        } else {
            throw 'Trying to subscribe to a topic but connection to a MQTT broker has not yet been established.';
        }
    }

    /**
     * Unsubscribe a MQTT topic
     * @param {String} topic - MQTT topic name
     */
    unsubscribe(topic) {
        this.client.unsubscribe(topic);
        if (this.verbose) {
            console.log('Unsubscribe topic: ' + topic);
        }
    }

    /**
     * Publish a message to a MQTT topic. The message can be encoded as well.
     * @param {String} topic - MQTT topic name 
     * @param {*} message - Message to publish
     * @param {String} encoding - Encoding format of a message. Default is 'cbor'. Other option(s): 'plaintext'.
     */
    publishTo(topic, message, encoding = 'cbor') {
        if (this.client == null)
            throw 'Trying to publish a message to a topic but connection to a MQTT broker has not yet been established.';
        if (encoding === 'cbor') {
            this.client.publish(topic, cbor.encode(message));
            if (this.verbose == true) {
                console.log('Published a message to ' + topic);
            }
        } 
        else if (encoding === 'plaintext') {
            this.client.publish(topic, message);
            if (this.verbose == true) {
                console.log('Published a message to ' + topic);
            }
        }
        else {
            throw 'Message encoding format (' + encoding + ') is not supported.'
        }
    }

    /**
     * Register a RPC function at the local machine
     * @param {String} name - Name of the RPC function
     * @param {Function} func - Actual function of the RPC
     * @param {Number} estiDuration - Estimated execution time of the RPC in ms
     */
    registerFunc(name, func, estiDuration) {
        this.registeredFuncMap.set(name, [func, estiDuration]);
        if (this.verbose) {
            console.log('Register a RPC function \'' + name + '\'');
        }
    }

    /**
     * Start listening MQTT messages including RPC
     * @param {String} msgEncoding - Message decoding scheme
     */
    start(msgEncoding = 'cbor') {
        if (this.client != null) {
            this.startListenRPC(msgEncoding);

            this.client.on('message', (MQTTtopic, message) => {
                let callBackFunc = this.topicCallbackMap.get(MQTTtopic);
                if (callBackFunc != undefined) {
                        let data;
                        let plainTxt = message;
                        try { 
                            data = cbor.decode(message);
                            plainTxt = JSON.stringify(data);
                        }
                        catch (error) {
                            try {
                                data = cbor.decode(message.payload);
                                plainTxt = JSON.stringify(data);
                            } catch (error) {
                                console.log('Error: CBOR cannot decode the current message');
                                data = message;
                            }
                        }
                        if (this.verbose) {
                            console.log('Received one message on topic: ' + MQTTtopic);
                            console.log('Message: ' + plainTxt + '\n');
                        }
                        callBackFunc(data);
                } else {
                    throw 'Error: Receive a message on a subscribed topic. However, the corresponding callback function is missing, or the callback function was not registered.';
                }
                // this.topicCallbackMap.forEach((callBackFunc, topic) => {
                //     if (MQTTtopic === topic) {
                //         let data;
                //         let plainTxt = message;
                //         try { 
                //             data = cbor.decode(message);
                //             plainTxt = JSON.stringify(data);
                //         }
                //         catch (error) {
                //             console.log('Error: CBOR cannot decode the current message');
                //             data = message;
                //         }
                //         if (this.verbose) {
                //             console.log('Received one message on topic: ' + MQTTtopic);
                //             console.log('Message: ' + plainTxt + '\n');
                //         }
                //         callBackFunc(data);
                //         return;
                //     }
                // })
            } )
        } else {
            throw 'Trying to subscribe to a topic but connection to a MQTT broker has not yet been established.';
        }
    }

    /**
     * Print the status of the MQTT client (list of listening topics, registered RPC functions, ...) 
     */
    status() {
        console.log('MQTTclient topic status: ');
        let res = '\n';
        res += 'Topics: \n'
        this.topicCallbackMap.forEach((value, topic) => {
            res += '\'' + topic + '\'  ';
        })
        res += '\n Registered local functions for remote call: \n';
        this.registeredFuncMap.forEach((value,func) => {
            res += func + '()  ';
        })
        res += '\n List of timers and their retry count: \n';
        this.timerMap.forEach((retry, timer) => {
            res += timer + ': ' + retry + ',  ';
        })
        res += '\n'
        console.log(res);
    }

}

module.exports = MQTTclient;