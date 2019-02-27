# Ticketing #
## Introduction ##

This is a distributed ticketing project, web_clients wishing to purchase a ticket a spread between multiple client_servers each 
with a set amount of tickets. The tickets are given on a first come first serve basis to connecting web_clients. 

## Setup ##

Firstly we need to setup a client_server for the main_server to connect to.

```javascript
let client_server = require('./client_server');

client_server.create_client_server(TLS_PORT);//Create the TLS server for main_server connection
client_server.create_https_server(HTTPS_PORT);//Create the https/wss server for web_clients
```

We can now connect to this with our main_server.

```javascript
let main_server = require("./main_server");

main_server.connect_client_server("localhost",TLS_PORT,HTTPS_PORT,()=>{
    main_server.init_tickets("ticket name", " ticket description", -1,10);
    main_server.distribute_tickets();
});
```

Where we have ```javascript connect_client_server(host,TLS_PORT,HTTPS_PORT, callback)```, the HTTPS_PORT is used to redirect
web_clients when they have been assigned to this server. 
Callback is called once a connection is fully established between the main_server and client_server, in this case it is being used 
to generate tickets and distribute them between the servers.

If we wish to handle redirection we can use the redirect_server module.

```javascript
let redirect_server = require('./redirect_server');

redirect_server.create_server();
```

As noted in _TODO_ this is implemented directly with the main_server module and will change.

### Certificates ###

If using a different location other than src/keys to store Certificates and private Keys you can set them for each server
in the following way. 

__Main_Server__

```javascript
main_server.set_certificate_path(path);
```
Note that this is an absolute path.

__Client_server__

For the client server the options for the server can be set.

```javascript
client_server.set_options({
    key : fs.readFileSync(path.join(key_path,"/client_key.pem")),
    cert : fs.readFileSync(path.join(key_path, "/client_cert.pem")),
});
```

Or we can simply set the key_path and these are updated.

```javascript
client_server.set_certificate_path(path);
```

## TODO ##

* Make all server modules use classes , currently they are handled directly inside modules.
* Fully implement web_client side, mainly used for testing currently.
* Allow for custom commands to be added to client_server main_server communication.
* Secure redirects, currently client_servers can be connected to directly which is an issue.
* Handle web_client and client_server disconnections.
* Allow for full server options to be set.
* Add ability to assign individual certificates for each client_server.
* Add connection tokens to web_clients to prevent multiple connections from the same person.
* Expand SQL implementation.
