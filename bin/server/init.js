"use strict";
/*
File that creates the keys, starts the main_server and client servers etc.
 */


let main_server = require("./main_server");
let client_server = require('./client_server');
let redirect_server = require('./redirect_server');
let tickets = require('../tickets/tickets');

let client = client_server.create_server(8080);
let https_server = client_server.create_https_server();

main_server.connect_client("localhost",8080,8081,()=>{
    main_server.init_tickets("lucas' tickets", " Use your imagination as to what they're for", -1,10);
    main_server.distribute_tickets();
});



redirect_server.create_server();



