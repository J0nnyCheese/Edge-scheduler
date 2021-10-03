This directory is unmaintained. Plsease move to the jamj folder.


required libraries: cbor, mqtt, mosca(need to degarde jsonschema to version 1.2.6)
npm install cbor
npm install mqtt
npm install mosca
npm install jsonschema@1.2.6

How to run my code?
Run the following 4 files at the same time: 
./testing/broker.js -> MQTT broker
./testing/dummyCloud.js -> A cloud that constantly updates the allocation rule
./testing/dummyWorker.js -> A worker that sends bid request and displays the bid response on the screen
./L1Scheduler.js -> Entry point of my code

Note: you can run multiple instances of dummyWorker.js to simulate a multi-worker environment