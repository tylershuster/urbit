# Urbit Connector

This project allows you to connect to an [Urbit](https://urbit.org) ship via a JavaScript application.

## Example

Start a new project, run `npm install urbit` and run the below, or run `node.js` from the root of this project.

```js
const Urbit = require('urbit').default;

// Assuming
// a) you are running a fakezod on port 8080
// b) you have created a chat called 'mc' on that fakezod,
const url = 'localhost';
const port = 8080;
const code = 'lidlut-tabwed-pillex-ridrup';

async function mars() {
    const ship = new Urbit(`http://${url}:${port}`, code);
    await ship.connect();
    await ship.subscribe('zod', 'chat-store', '/mailbox/~/~zod/mc');
    const pipe = ship.eventSource();
    await ship.poke('zod', 'chat-hook', 'json', {message: {path: '/~/~zod/mc', envelope: {
        uid: Urbit.uid(),
        number: 1, // Dummy, gets overwritten immediately
        author: '~zod',
        when: new Date().getTime(),
        letter: { text: 'Hello, Mars!' }
    }}});
}

mars();
console.log('Press ctrl-c to quit');
```

## Design

This library is designed to be useful for node applications that communicate with an urbit running either on the local computer or on a remote one.

The majority of its methods are asynchronous and return Promises. This is due to the non-blocking nature of JavaScript. If used in a React app, response handlers should be bound with `this` to `setState` after a message is received.

It uses the Axios library to polyfill the native JavaScript `fetch` which is only available in the browser context. It uses a similar approach to `EventSource`.

## Future Work

Future features include:
- Reworking the axios calls to use a `fetch`-compatible syntax
- Adding handlers for sending chat messages with a simpler syntax
- Better tracking of current subscriptions and acks