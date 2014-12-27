Mock One Platform
-----------------

This is an HTTP server for testing applications built against [Exosite's](https://exosite.com) One Platform. It supports a subset of RPC API commands:

- [info](https://docs.exosite.com/rpc#info) ("description", "basic", "key", "aliases", "subscribers", "shares", "tags")
- [listing](https://docs.exosite.com/rpc#listing) ("owned")
- [lookup](https://docs.exosite.com/rpc#lookup) ("alias"/"aliased") 
- [create](https://docs.exosite.com/rpc#create-client) (limits are not stored but not enforced)
- [drop](https://docs.exosite.com/rpc#drop)

Compared with testing against One Platform, onep-mock allows tests to run faster because it uses an in-memory database and can run locally with your app. It also provides more feedback about app misbehavior and allows for working offline.

```
$ npm install
$ supervisor mock.js
One Platform mock server listening on 3001
```

The server's in-memory database starts out with a root CIK of all 1s, with some more debug data underneath it. Once the server is running, you can run some [Exoline](https://github.com/exosite/exoline) commands against it:

```
$ exo --http --host=127.0.0.1 --port=3001 tree 1111111111111111111111111111111111111111
Mock Master Client  client cik: 1111111111111111111111111111111111111111 (aliases: see parent)
  └─Mock Other Client  client cik: 2222222222222222222222222222222222222222 (aliases: ["mock_other"])
      └─gas  integer dataport rid: 2345678901234567890123456789012345678901 (aliases: ["mock_gas"])
```

The server will complain loudly if you try to do something it doesn't support yet, as when trying to call the `usage` command. 

```
$ exo --curl --http --host=127.0.0.1 --port=3001 usage 1111111111111111111111111111111111111111 --start=1/1/2012
DEBUG:pyonep.onep:curl http://127.0.0.1:3001/onep:v1/rpc/process -X POST -m 60 -H 'Content-Type: application/json; charset=utf-8' -H 'User-Agent: Exoline 0.9.5' -d '{"calls": [{"id": 91, "procedure": "usage", "arguments": [{"alias": ""}, "client", 1325397600, null]}, {"id": 92, "procedure": "usage", "arguments": [{"alias": ""}, "dataport", 1325397600, null]}, {"id": 93, "procedure": "usage", "arguments": [{"alias": ""}, "datarule", 1325397600, null]}, {"id": 94, "procedure": "usage", "arguments": [{"alias": ""}, "dispatch", 1325397600, null]}, {"id": 95, "procedure": "usage", "arguments": [{"alias": ""}, "email", 1325397600, null]}, {"id": 96, "procedure": "usage", "arguments": [{"alias": ""}, "http", 1325397600, null]}, {"id": 97, "procedure": "usage", "arguments": [{"alias": ""}, "sms", 1325397600, null]}, {"id": 98, "procedure": "usage", "arguments": [{"alias": ""}, "xmpp", 1325397600, null]}], "auth": {"cik": "1111111111111111111111111111111111111111"}}'
DEBUG:pyonep.onep:HTTP/1.1 500 Internal Server Error
Headers: [('content-length', '45'), ('x-content-type-options', 'nosniff'), ('x-powered-by', 'Express'), ('connection', 'keep-alive'), ('date', 'Sat, 27 Dec 2014 19:12:37 GMT'), ('content-type', 'text/html; charset=utf-8')]
DEBUG:pyonep.onep:Body: Mock server does not support procedure usage

One Platform exception: Exception while parsing JSON response: Mock server does not support procedure usage

No JSON object could be decoded
```

...or when trying to use a different Exosite API.

```
$ exo --http --host=127.0.0.1 --port=3001 model list
One Platform provisioning exception: 404 Not Found (Cannot GET /provision/manage/model/)
```

## Tests

To run the tests, first make sure the development dependencies are installed.

```
$ npm install 
```

Then run the tests:

```
$ mocha


  info
    root
      ✓ should have infinite client limit


  1 passing (8ms)
```


