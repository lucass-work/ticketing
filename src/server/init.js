"use strict";
/*
File that creates the keys, starts the main_server and client servers etc.
 */

let main_server = require("./main_server");
let client_server = require('./client_server');
let redirect_server = require('./redirect_server');
let tickets = require('../tickets/tickets');

client_server.create_client_server(8080);
client_server.create_https_server();
let sql_options = {
    host: "localhost",
    user: "root",
    password: "password",
    database: "ticketdb",
};

main_server.connect_client_server("localhost",8080,8081,()=>{
    main_server.init_tickets("ticket name", " ticket description", -1,10);
    main_server.distribute_tickets();
});



redirect_server.create_server();



