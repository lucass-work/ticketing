"use strict";
/*
A simple redirect server that sends incoming requests from a browser to one of the client_servers
 */

let express = require('express');
let main_server = require('./main_server');
let fs = require('fs');
let path = require('path');

let html_path = path.join(__dirname,"../client");
let app;

const port = 8000;

/**
 * Create the redirect server.
 */
function create_server() {
    let on_request = (req,res) =>{
        //Request and redirect to the assigned client_server.
        let server = main_server.request_redirect(req.ip);

        if (!server) {
            refuse_redirect(res);
            return;
        }

        res.redirect(server);
    };

    //Create the express app and and handle connection to "/"
    app = express();
    app.get('/', on_request);
    app.listen(port);
}

//Load the redirect refused webpage.
let redirect_failure;
fs.readFile(path.join(html_path,"/redirect_refused.html"),(err,data) =>{
    redirect_failure = data.toString();
});

//Send the web_client the redirection refused wepage.
function refuse_redirect(res){
    res.setHeader("Content-Type","text/html");
    res.end(redirect_failure);
}


module.exports = {
    create_server : create_server,
};