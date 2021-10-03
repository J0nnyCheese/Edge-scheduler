// Source: https://www.geeksforgeeks.org/implementation-linkedlist-javascript/
// Node modified to contain scheduling parameters

class Task {
    constructor(application_id, task_id, task_counter, start_time, finish_time) {
        this.application_id = application_id;
        this.task_id = task_id;
        this.task_counter = task_counter;
        this.start_time = start_time;
        this.finish_time = finish_time;
        this.next = null;
    }

    setNext(node) {
        this.next = node;
    }

    getAppicationId() {
        return this.application_id;
    }

    getTaskId() {
        return this.task_id;
    }

    getTaskCounter() {
        return this.task_counter;
    }

    getStartTime() {
        return this.start_time;
    }

    getFinishTime() {
        return this.finish_time;
    }

    getNextTask() {
        return this.next;
    }
}


class SinglyLinkedList {
    constructor() {
        this.head = null;
        this.size = 0;
    }

    add(application_id, task_id, task_counter, start_time, finish_time) {
        var node = new Task(application_id, task_id, task_counter, start_time, finish_time);

        // the current node (start from the head to the tail)
        var current;

        if (this.head == null)
            this.head = node;
        else {
            current = this.head;

            while(current.next) 
                current = current.next;

            current.next = node;
        }
        this.size++;
    }

    insertAt(index, application_id, task_id, task_counter, start_time, finish_time) {
        if (index < 0 || index > this.size)
            throw 'Error: Invalid index number.';
        else {
            var node = new Task(application_id, task_id, task_counter, start_time, finish_time);
            var curr, prev;

            curr = this.head;
            
            if (index == 0) {
                node.next = this.head;
                this.head = node;
            } else {
                curr = this.head;
                var it = 0;

                while (it < index) {
                    it ++;
                    prev = curr;
                    curr = curr.next;
                }

                node.next = curr;
                prev.next = node;
            }
            this.size++;
        }
    }

    insertAfter(task_node, application_id, task_id, task_counter, start_time, finish_time) {
        var new_node = new Task(application_id, task_id, task_counter, start_time, finish_time);
        var tmp = task_node.next;
        task_node.next = new_node;
        new_node.next = tmp;
    }

    removeFrom(index) {
        if (index < 0 || index > this.size)
            throw 'Error: Invalid index number.';
        else {
            var curr, prev;
            var it = 0;
            
            curr = this.head;
            prev = curr;

            if (index == 0) {
                this.head = curr.next;
            } else {
                while(it < index) {
                    it ++;
                    prev = curr;
                    curr = curr.next;
                }
                prev.next = curr.next;
            }
            this.size --;
            return [curr.application_id, curr.task_id, curr.task_counter] ;
        }
    }

    removeTask(application_id, task_id, task_counter) {
        var current = this.head;
        var prev = null;

        while (current != null) {
            if (current.task_id === task_id && current.application_id == application_id && current.task_counter === task_counter) {
                if (prev == null) {
                    this.head = current.next;
                } else {
                    prev.next = current.next;
                }
                this.size --;
                return [current.application_id, current.task_id, current.task_counter];
            }
            prev = current;
            current = current.next;
        }
        return -1;
    }


    indexOf(application_id, task_id, task_counter) {
        var count = 0;
        var current = this.head;

        while (current != null) {
            if (current.task_id === task_id && current.application_id == application_id && current.task_counter === task_counter)
                return count;
            count ++;
            current = current.next;
        }
        return -1; // Task not found
    }

    isEmpty() {
        return this.size == 0;
    }

    size_of_list() {
        return this.size;
    }

    getHead() {
        return this.head;
    }

    printList() {
        var curr = this.head;
        var str = "Real-time Schedule: \nHead (t=0) \n-> ";
        while (curr) {
            str += 'application_id: ' + curr.application_id + ' task_id: ' + curr.task_id + ' task_counter:' + curr.task_counter + ' start_time:' + curr.start_time + ' finish_time:' + curr.finish_time + " \n-> ";
            curr = curr.next;
        }
        console.log(str + 'Tail\n');
    }

    toArray() {
        var arr = new Array();
        var current = this.head;

        while (current != null) {
            let task = [current.application_id, current.task_id, current.task_counter, current.start_time, current.finish_time];
            arr.push(task);
            current = current.next;
        }
        return arr;
    }

    // /**
    //  * 
    //  * @param {*} task_node_a A task node
    //  * @param {*} task_b_start_time 
    //  * @param {*} task_b_end_time 
    //  * @returns 1 - The start time of task b is in conflict with task a. Should postpone task b
    //  *          2 - The finish time of task b is in conflict with task a. Should bring task b forward (ahead of task a)
    //  *          3 - The interval of task a is completely contained in the interval of task b. Should postpone task b or bring task b forward
    //  *          0 - No conflict
    //  */
    // hasConflict(task_node_a, task_b_start_time, task_b_end_time) {
    //     // Corner case: If task_node_a is null, this means that task be is comparing with a empty slot. Return true b/c task b should be able to use the empty slot.
    //     if (task_node_a == null) return 0;

    //     if (task_b_start_time >= task_b_end_time) 
    //         throw "Error: start time is greater than or equal to end time";
    //     if (task_b_start_time >= task_node_a.start_time && task_b_start_time < task_node_a.finish_time)
    //         return 1;
    //     if (task_b_end_time > task_node_a.start_time && task_b_end_time <= task_node_a.finish_time)
    //         return 2;
    //     if (task_b_start_time < task_node_a.start_time && task_b_end_time > task_node_a.finish_time)
    //         return 3;
    //     if (task_b_start_time >= task_node_a.finish_time)
    //         return 4;
    //     return 0;
    // }
}

module.exports = {Task, SinglyLinkedList};


// -----------------Testing code---------------------
// let ll = new SinglyLinkedList();

// ll.add(12311, 0, 300, 500);

// ll.insertAt(0, 117798, 0, 100, 150);

// ll.add(19804, 2, 800, 1200);

// ll.add(12321, 4, 1500, 1900 );

// ll.add(19804, 3, 2000, 2200);

// ll.removeTask(19804, 2);
// ll.printList();

// console.log(ll.toArray());

// console.log(ll.hasConflict(ll.head, 150 , 200));