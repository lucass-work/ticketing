"use strict";
/*
Starts the servers
 */

let main_server = require("./main_server");
let client_server = require('./client_server');
let redirect_server = require('./redirect_server');
let path = require('path');
let fs = require('fs');

let key_path = path.join(__dirname,"../keys");

client_server.set_options({//set our client server options
    key : fs.readFileSync(path.join(key_path,"/client_key.pem")),
    cert : fs.readFileSync(path.join(key_path, "/client_cert.pem")),
});

//create the client server
client_server.create_client_server(8080);
client_server.create_https_server();

//establish a connection between the main_server and client_server
main_server.connect_client_server("localhost",8080,8081,()=>{
    main_server.init_tickets("ticket name", " ticket description", -1,10);
    main_server.distribute_tickets();
});

redirect_server.create_server();



