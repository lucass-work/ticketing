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

function create_server() {

    app = express();

    app.get('/', (req, res) => {

        let server = main_server.request_redirect(req.ip);

        if (!server) {
            refuse_redirect(res);
            return;
        }

        res.redirect(server);


    });//TODO flesh out into a proper webpage.

    app.listen(port);

}

function refuse_redirect(res){
    res.setHeader("Content-Type","text/html");
    res.end(redirect_failure);
}

let redirect_failure;
fs.readFile(path.join(html_path,"/redirect_refused.html"),(err,data) =>{
    redirect_failure = data.toString();
});

module.exports = {
    create_server : create_server,
}