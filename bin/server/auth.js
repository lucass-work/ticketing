"use strict";
let fs = require('fs');
let csprng = require('csprng');
let crypto = require('crypto');
/*
Generates the hash info for our server.
 */

let client_secret,server_secret;
const id_length = 100;

/**
 * load the client and server secrets
 * @param client the path of the client secret
 * @param server the path of the server secret
 */
function load_secrets(client,server){
    client_secret = fs.readFileSync(client);
    server_secret = fs.readFileSync(server);
}

/**
 * Generate an auth code for the given client Id and currently loaded client secret.
 * @param id the client id to generate the auth for.
 * @param server true if this is the server secret false if it is the client secret.
 * @returns {PromiseLike<ArrayBuffer>}
 */
function get_auth(id,server = false){
    let hash = crypto.createHash("sha256");

    server ? hash.update(server_secret + id) : hash.update(client_secret + id);

    return hash.digest("hex");
}

/**
 * Generate an auth code for the given server id and currently loaded server secret.
 * @param id
 */
function get_client_auth(id){

}

/**
 * Generate a random ID without repetition.
 * @param ids a list of currently used ids
 */
/*
yes I know it's not truly random but we can't have repeated ID's.
 */
function gen_id(ids){
    let id = csprng(id_length,16);
    if(ids.includes(id)){
        return gen_id(ids);
    }
    return id;
}

module.exports = {
    load_secrets : load_secrets,
    get_auth : get_auth,
    gen_id : gen_id,
};
