"use strict";
/*
File that creates the keys, starts the main_server and client servers etc.
 */

let main_server = require("./main_server");
let client_server = require('./client_server');
let redirect_server = require('./redirect_server');
let tickets = require('../tickets/tickets');

let client = client_server.connect_main_server(8080);
let https_server = client_server.create_server();
let sql_options = {
    host: "localhost",
    user: "root",
    password: "password",
    database: "ticketdb",
};

main_server.connect_client_server("localhost",8080,8081,()=>{
    main_server.init_tickets("lucas' tickets", " Use your imagination as to what they're for", -1,10,sql_options);
    main_server.distribute_tickets();
});



redirect_server.create_server();



