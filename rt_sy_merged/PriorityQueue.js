// Source: https://www.geeksforgeeks.org/implementation-priority-queue-javascript/
class PQelement {
    constructor(element, priority) {
        this.element = element;
        this.priority = priority;
    }
}

class PriorityQueue {
    constructor() {
        this.items = [];
    }

    enqueue(element, priority) {
        var element = new PQelement(element, priority);
        var insert = false;

        for (var i = 0; i < this.items.length; i++) {
            if(this.items[i].priority >= element.priority) {
                this.items.splice(i, 0, element);
                insert = true;
                break; 
            }
        }

        if(!insert) {
            this.items.push(element);
        }
    }

    dequeue() {
        if(this.items.length == 0)
            throw 'Error: Trying to dequeue an empty queue.';
        else
            return this.items.shift();
    }

    front() {
        if(this.items.length == 0)
            throw 'Error: Trying to peek the front of an empty queue.';
        else
            return this.items[0];
    }

    rear() {
        if(this.items.length == 0)
            throw 'Error: Trying to look at the rear of an empty queue.';
        else
            return this.items[this.items.length - 1];
    }

    isEmpty() {
        return this.items.length == 0;
    }

    toString() {
        let str = '\nFront -> \n';
        for (let i = 0; i < this.items.length; i ++) {
            str += this.items[i].element + ' -> \n';
        }
        str += 'Rear \n';
        return str;
    }

    toArray() {
        let arr = [];
        for (let i = 0; i < this.items.length; i ++) {
            arr.push(this.items[i].element);
        }
        return arr;
    }
}

module.exports = {PQelement, PriorityQueue}


// Testing


// var priorityQueue = new PriorityQueue();
 

// console.log(priorityQueue.isEmpty());
 
// priorityQueue.enqueue("Sumit", 2);
// priorityQueue.enqueue("Gourav", 1);
// priorityQueue.enqueue("Piyush", 1);
// priorityQueue.enqueue("Sunny", 2);
// priorityQueue.enqueue("Sheru", 3);
 
// console.log(priorityQueue.toString());
 
// console.log(priorityQueue.front().element);
 
// console.log(priorityQueue.rear().element);
 
// console.log(priorityQueue.dequeue().element);
 
// priorityQueue.enqueue("Sunil", 2);
 
// console.log(priorityQueue.toString());