const Urbit = require('./dist').default;

// Assuming
// a) you are running a fakezod on port 8080
// b) you have created a chat called 'mc' on that fakezod,
const url = 'localhost';
const port = 8080;
const code = 'lidlut-tabwed-pillex-ridrup';

async function mars() {
    const ship = new Urbit(`http://${url}:${port}`, code);
    console.log(ship.channelUrl);
    await ship.connect();
    await ship.subscribe('zod', 'chat-store', '/mailbox/~/~zod/mc');
    const pipe = ship.eventSource();
    await ship.poke('zod', 'chat-hook', 'json', {message: {path: '/~/~zod/mc', envelope: {
        uid: Urbit.uid(),
        number: 1, // Dummy, gets overwritten immediately
        author: '~zod',
        when: new Date().getTime(),
        letter: { text: 'This is it' }
    }}});
}

mars();
console.log('Press ctrl-c to quit');