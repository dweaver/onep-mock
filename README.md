Mock One Platform
-----------------

This is an HTTP server for testing applications built against [Exosite's](https://exosite.com) One Platform. It supports a subset of RPC API commands, including:

- [info](https://docs.exosite.com/rpc#info)
- [listing](https://docs.exosite.com/rpc#listing)
- [lookup](https://docs.exosite.com/rpc#lookup)

Compared with testing against the One Platform, onep-mock allows tests to run faster because it uses an in-memory database and runs locally with your app. It also provide richer feedback about app misbehavior and allows for working offline.

```
$ npm install
$ supervisor mock.js
One Platform mock server listening on 3001
```

The server's in-memory database starts out with a root CIK of all 1's and some more debug data underneath it. Once the server is running, you can run some [Exoline](https://github.com/exosite/exoline) commands against it:

```
$ exo --http --host=localhost --port=3001 tree 1111111111111111111111111111111111111111
Mock Master Client  client cik: 1111111111111111111111111111111111111111 (aliases: see parent)
  └─Mock Other Client  client cik: 2222222222222222222222222222222222222222 (aliases: ["mock_other"])
      └─gas  integer dataport rid: 2345678901234567890123456789012345678901 (aliases: ["mock_gas"])
```
