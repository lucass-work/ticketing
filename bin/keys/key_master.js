"use strict";
/*
File dynamically generates keys for the ticket servers when created and for the connections between the ticket server
and the main server.
 */

let fs = require('fs');
let { exec } = require('child_process');

/**
 * Create an SSL private key.
 * @param name name of the key file
 * @param length length of the private key in bits.
 */
function create_key(name,length = 2048){
    exec(`openssl genrsa -out ${name}.pem ${length}`,(err,stdout,sterr) => {

        if(err){
            console.log(err.toString());
            return;
        }

        console.log(`Key ${name} length ${length} created`);
    });
}

/**
 * Create an SSL certificate and self sign it.
 * @param name the name of the certificate
 * @param key the name of the private key being used to generate the certificate
 */
function create_certificate(name,key){
    exec(`openssl req -new -sha256 -key ${key}.pem -out ${name}.pem`,(err,stdout,sterr) => {

        if(err){
            console.log(err.toString());
            return;
        }

        exec(`openssl x509 -req -in ${name}.pem -signkey ${key}.pem -out ${name}.pem`)
    });
}


/**
 * Clears all keys.
 */
function clear_keys(){

}

module.exports = {
    create_key : create_key,
    create_certificate : create_certificate,
    clear_keys : clear_keys,
};