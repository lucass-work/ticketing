"use strict";
let fs = require('fs');
let csprng = require('csprng');
let crypto = require('crypto');
/*
Generates the hash info for our server.
 */

let secret;
const id_length = 100;

function load_secret(file){
    secret = fs.readFileSync(file);
}

/**
 * Generate an auth code for the given Id and currently loaded secret.
 * @param id the client id to generate the auth for.
 * @returns {PromiseLike<ArrayBuffer>}
 */
function get_auth(id){
    if(!secret){
        console.log("Cannot generate auth as no secret loaded");
        return;
    }
    let hash = crypto.createHash("sha256");

    return hash.update(secret + id).digest("hex");
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
    load_secret : load_secret.apply,
    get_auth : get_auth,
    gen_id : gen_id,
}