Mock One Platform
-----------------

[![NPM](https://nodei.co/npm/onep-mock.png)](https://nodei.co/npm/mock-onep/) 

This is a HTTP server for testing applications built against [Exosite's](https://exosite.com) One Platform. At the moment it supports just a subset of RPC API commands:

- [info](https://docs.exosite.com/rpc#info) ("description", "basic", "key", "aliases", "subscribers", "shares", "tags")
- [listing](https://docs.exosite.com/rpc#listing) ("owned")
- [lookup](https://docs.exosite.com/rpc#lookup) ("alias"/"aliased") 
- [create client](https://docs.exosite.com/rpc#create-client) (limits are stored but not enforced)
- [create dataport](https://docs.exosite.com/rpc#create-dataport) (limits are stored but not enforced)
- [create datarule](https://docs.exosite.com/rpc#create-datarule) (limits are stored but not enforced. Also datarules are stored but don't do anything, i.e. scripts and events don't work)
- [drop](https://docs.exosite.com/rpc#drop)
- [map](https://docs.exosite.com/rpc#map) (just "alias")
- [unmap](https://docs.exosite.com/rpc#unmap)
- [read](https://docs.exosite.com/rpc#read) ("selection": "all")
- [write](https://docs.exosite.com/rpc#write)
- [record](https://docs.exosite.com/rpc#record)
- [flush](https://docs.exosite.com/rpc#flush)
- [update](https://docs.exosite.com/rpc#update)

Compared with testing against One Platform, onep-mock allows tests to run faster because it uses an in-memory database and can run locally with your app. It also provides more feedback about app misbehavior and allows for working offline.

```
$ git clone git@github.com:dweaver/onep-mock.git 
$ cd onep-mock
$ npm install
$ supervisor mock.js
One Platform mock server listening on 3001
```

The server's in-memory database starts out with a root CIK of all 1s, with some more debug data underneath it. Once the server is running, you can run some [Exoline](https://github.com/exosite/exoline) commands against it:

```
$ alias exock='exo --http --host=127.0.0.1 --port=3001 ' 
$ exock twee 1111111111111111111111111111111111111111
Mock Master Client    cl cik: 1111111111111111111111111111111111111111
  └─Mock Other Client    cl cik: 2222222222222222222222222222222222222222
      └─gas  dp.i mock_gas: 34 (Yesterday)
danw@MacBook-Pro:~/prj/exosite/onep-mock [master]
$ exock write 2222222222222222222222222222222222222222 mock_gas --value=35
danw@MacBook-Pro:~/prj/exosite/onep-mock [master]
$ exock read 2222222222222222222222222222222222222222 mock_gas
2014-12-30 09:45:29-06:00,35
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
...
```

You can get a coverage report:

```
$ istanbul cover _mocha -- -R spec
...
```
