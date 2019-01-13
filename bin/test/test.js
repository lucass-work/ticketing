"use strict";

let sql = require('mysql');

let connection = sql.createConnection({
    host: "localhost",
    user: "root",
    password: "password",
});

connection.connect((err)=>{
    console.log(err ? err : "connected");
});