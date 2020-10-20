// import 'eventsource';
import fetch from 'cross-fetch';
import { isBrowser, isNode } from 'browser-or-node';

import { AuthenticationInterface, SubscriptionInterface, CustomEventHandler, PokeInterface, SubscriptionRequestInterface, headers, UrbitInterface } from './index.d';
import UrbitApp from './app/base';
import { uncamelize } from './utils';


// view-source:http://localhost/~landscape/js/channel.js
// https://github.com/liam-fitzgerald/urbit-airlock-ts/blob/master/src/channel.ts

/**
 * A class for interacting with an urbit ship, given its URL and code
 */
class Urbit implements UrbitInterface {
  /**
   * Code is the deterministic password
   */
  code: string;

  /**
   * URL is the location of the instance.
   */
  url: string;

  /**
   * UID will be used for the channel: The current unix time plus a random hex string
   */
  uid: string;

  /**
   * Last Event ID is an auto-updated index of which events have been sent over this channel
   */
  lastEventId: number = 0;

  lastAcknowledgedEventId: number = 0;

  /**
   * SSE Client is null for now; we don't want to start polling until it the channel exists
   */
  sseClient: EventSource | null = null;

  /**
   * Cookie gets set when we log in.
   */
  cookie?: string | null;

  /**
   * A registry of requestId to successFunc/failureFunc
   * 
   * These functions are registered during a +poke and are executed
   * in the TODO onServerEvent()/onServerError() callbacks. Only one of
   * the functions will be called, and the outstanding poke will be
   * removed after calling the success or failure function.
   */

  outstandingPokes: Map<number, PokeInterface>;

  /**
   * A registry of requestId to subscription functions.
   * 
   * These functions are registered during a +subscribe and are
   * executed in the onServerEvent()/onServerError() callbacks. The
   * event function will be called whenever a new piece of data on this
   * subscription is available, which may be 0, 1, or many times. The
   * disconnect function may be called exactly once.
   */

  outstandingSubscriptions: Map<number, SubscriptionInterface>;

  /**
   * Ship can be set, in which case we can do some magic stuff like send chats
   */
  ship?: string | null;

  /**
   * If verbose, logs output eagerly.
   */
  verbose?: boolean;

  /**
   * All registered apps, keyed by name
   */
  static apps: Map<string, typeof UrbitApp> = new Map();

  /** This is basic interpolation to get the channel URL of an instantiated Urbit connection. */
  get channelUrl(): string {
    return `${this.url}/~/channel/${this.uid}`;
  }

  /**
   * Constructs a new Urbit connection.
   *
   * @param url  The URL (with protocol and port) of the ship to be accessed
   * @param code The access code for the ship at that address
   */
  constructor(url: string, code: string) {
    this.uid = `${Math.floor(Date.now() / 1000)}-${Urbit.hexString(6)}`;
    this.code = code;
    this.url = url;
    this.outstandingPokes = new Map();
    this.outstandingSubscriptions = new Map();

    return new Proxy(this, {
      get(target: Urbit, property: string) {
        // First check if this is a regular property
        if (property in target) {
          return (target as any)[property];
        }

        // Then check if it's a registered app
        const app = Urbit.apps.get(uncamelize(property));
        if (app) {
          return new app(target);
        }
        
        // Then check to see if we're trying to register an EventSource watcher
        if (property.startsWith('on')) {
          const on = uncamelize(property.replace('on', '')).toLowerCase();
          return ((action: CustomEventHandler) => {
            target.eventSource().addEventListener('message', (event: MessageEvent) => {
              if (target.verbose) {
                console.log(`Received SSE from ${on}: `, event);
              }
              if (event.data && JSON.parse(event.data)) {
                const data: any = JSON.parse(event.data);
                if (data.json.hasOwnProperty(on)) {
                  action(data.json[on], data.json.response);
                }
              }
            });
          });
        }

        return undefined;
      }
    })
  }

  /**
   * All-in-one hook-me-up.
   * 
   * Given a ship, url, and code, this returns an airlock connection
   * that is ready to go. It `|hi`s itself to create the channel,
   * then opens the channel via EventSource.
   * 
   * @param AuthenticationInterface
   */
  static async authenticate({ ship, url, code, verbose = false }: AuthenticationInterface) {
    const airlock = new Urbit(`http://${url}`, code);
    airlock.verbose = verbose;
    airlock.ship = ship;
    await airlock.connect();
    await airlock.poke(ship, 'hood', 'helm-hi', 'opening airlock');
    await airlock.eventSource();
    return airlock;
  }

  /**
   * Connects to the Urbit ship. Nothing can be done until this is called.
   * That's why we roll it into this.authenticate
   */
  async connect(): Promise<void> {
    if (this.verbose) {
      console.log(`password=${this.code} `, isBrowser ? "Connecting in browser context at " + `${this.url}/~/login` : "Connecting from node context");
    }
    return fetch(`${this.url}/~/login`, {
      method: 'post',
      body: `password=${this.code}`,
      credentials: 'include',
    }).then(response => {
      if (this.verbose) {
        console.log('Received authentication response', response);
      }
      if (!isBrowser) {
        this.cookie = response.headers.get('set-cookie');
      }
    }).catch(error => {
      console.log(XMLHttpRequest);
      console.log('errored')
      console.log(error);
    });
  }
  

  /**
   * Returns (and initializes, if necessary) the SSE pipe for the appropriate channel.
   */
  eventSource(): EventSource {
    if (!this.sseClient) {
      const sseOptions = {
        headers: {}
      };
      if (isBrowser) {
        sseOptions.withCredentials = true;
      } else if (isNode) {
        sseOptions.headers.Cookie = this.cookie;
      }
      this.sseClient = new EventSource(this.channelUrl, sseOptions);
      this.sseClient?.addEventListener('message', (event: MessageEvent) => {
        if (this.verbose) {
          console.log('Received SSE: ', event);
        }
        this.ack(Number(event.lastEventId));
        if (event.data && JSON.parse(event.data)) {
          const data: any = JSON.parse(event.data);
          if (data.response === 'poke' && this.outstandingPokes.has(data.id)) {
            const funcs = this.outstandingPokes.get(data.id);
            if (data.hasOwnProperty('ok')) {
              funcs.success();
            } else if (data.hasOwnProperty('err')) {
              funcs.fail(data.err);
            } else {
              console.error('Invalid poke response', data);
            }
            this.outstandingPokes.delete(data.id);
          } else if (data.response === 'subscribe' || 
            (data.response === 'poke' && this.outstandingSubscriptions.has(data.id))) {
            const funcs = this.outstandingSubscriptions.get(data.id);
            if (data.hasOwnProperty('err')) {
              funcs.err(data.err);
              this.outstandingSubscriptions.delete(data.id);
            }
          } else if (data.response === 'diff' && this.outstandingSubscriptions.has(data.id)) {
            const funcs = this.outstandingSubscriptions.get(data.id);
            funcs.event(data.json);
          } else if (data.response === 'quit' && this.outstandingSubscriptions.has(data.id)) {
            const funcs = this.outstandingSubscriptions.get(data.id);
            funcs.quit(data);
            this.outstandingSubscriptions.delete(data.id);
          } else {
            console.log('Unrecognized response', data);
          }
          // An incoming message, for example:
          // {
          //   id: 10,
          //   json: {
          //     'chat-update' : { // This is where we hook our "on" handlers like "onChatUpdate"
          //       message: {
          //         envelope: {
          //           author: 'zod',
          //           letter: {
          //             text: 'hi'
          //           },
          //           number: 10,
          //           uid: 'saludhafhsdf',
          //           when: 124459
          //         },
          //         path: '/~zod/mailbox'
          //       }
          //     }
          //   }
          // }
        }
      });
      this.sseClient?.addEventListener('error', function(event: Event) {
        console.error('pipe error', event);
      });
    }
    return this.sseClient;
  }

  /**
   * Autoincrements the next event ID for the appropriate channel.
   */
  getEventId(): number {
    this.lastEventId = Number(this.lastEventId) + 1;
    return this.lastEventId;
  }

  /**
   * Acknowledges an event.
   *
   * @param eventId The event to acknowledge.
   */
  async ack(eventId: number): Promise<void | number> {
    return this.sendMessage('ack', { 'event-id': eventId });
  }

  /**
   * This is a wrapper method that can be used to send any action with data.
   *
   * Every message sent has some common parameters, like method, headers, and data
   * structure, so this method exists to prevent duplication.
   *
   * @param action The action to send
   * @param data The data to send with the action
   * 
   * @returns void | number If successful, returns the number of the message that was sent
   */
  async sendMessage(action: string, data?: object): Promise<void | number> {
    const headers: headers = {
      'Content-Type': 'application/json',
    };
    if (!isBrowser) {
      headers.Cookie = this.cookie;
    }
    const id = this.getEventId();
    if (this.verbose) {
      console.log(`Sending message ${id}:`, action, data, headers);
    }
    return fetch(this.channelUrl, {
      method: 'put',
      headers,
      credentials: 'include',
      body: JSON.stringify([{
        id,
        action,
        ...data,
      }])
    }).catch((error: any) => {
      console.error('message error', error);
    })
    .then(response => {
      if (this.verbose) {
        console.log(`Received from message ${id}: `, response);
      }
      return id;
    });
  }

  /**
   * Pokes a ship with data.
   *
   * @param ship The ship to poke
   * @param app The app to poke
   * @param mark The mark of the data being sent
   * @param json The data to send
   */
  async poke(
    ship: string = this.ship ? this.ship : '',
    app: string,
    mark: string,
    json: Object,
    successFunc = () => {},
    failureFunc = () => {}
  ): Promise<void | number> {
    const pokeId = await this.sendMessage('poke', { ship, app, mark, json });

    if (!pokeId) return;

    this.outstandingPokes.set(pokeId, {
      success: successFunc,
      fail: failureFunc
    });

    return pokeId;
  }

  /**
   * Subscribes to a path on an app on a ship.
   *
   * @param ship The ship to subscribe to
   * @param app The app to subsribe to
   * @param path The path to which to subscribe
   */
  async subscribe({
    ship = this.ship ? this.ship : '',
    app,
    path,
    err = () => {},
    event = () => {},
    quit = () => {}
  }: SubscriptionRequestInterface): Promise<void | number> {
    const subscriptionId = await this.sendMessage('subscribe', { ship, app, path });

    if (!subscriptionId) return;

    this.outstandingSubscriptions.set(subscriptionId, {
      err, event, quit
    });

    return subscriptionId;
  }

  /**
   * Unsubscribes to a given subscription.
   *
   * @param subscription
   */
  async unsubscribe(subscription: string): Promise<void | number> {
    return this.sendMessage('unsubscribe', { subscription });
  }

  /**
   * Deletes the connection to a channel.
   */
  async delete(): Promise<void | number> {
    return this.sendMessage('delete');
  }

  async scry(app: string, path: string): Promise<void | any> {
    return fetch(`/~/scry/${app}${path}.json`)
      .then(response => response.json());
  }

  async spider<T>(inputMark: string, outputMark: string, threadName: string, body: any): Promise<T> {
    const res = await fetch(`/spider/${inputMark}/${threadName}/${outputMark}.json`, {
      method: 'POST',
      body: JSON.stringify(body)
    });

    return res.json();
  }

  app(appName: string): UrbitApp {
    const appClass = Urbit.apps.get(appName);
    if (!appClass) {
      throw new Error(`App ${appName} not found`);
    }
    return new appClass(this);
  }

  /**
   * Utility function to connect to a ship that has its *.arvo.network domain configured.
   *
   * @param name Name of the ship e.g. zod
   * @param code Code to log in
   */
  static async onArvoNetwork(ship: string, code: string): Promise<Urbit> {
    const url = `https://${name}.arvo.network`;
    return await Urbit.authenticate({ ship, url, code });
  }

  /**
   * Returns a hex string of given length.
   *
   * Poached from StackOverflow.
   *
   * @param len Length of hex string to return.
   */
  static hexString(len: number): string {
    const maxlen = 8;
    const min = Math.pow(16, Math.min(len, maxlen) - 1);
    const max = Math.pow(16, Math.min(len, maxlen)) - 1;
    const n = Math.floor(Math.random() * (max - min + 1)) + min;
    let r = n.toString(16);
    while (r.length < len) {
      r = r + Urbit.hexString(len - maxlen);
    }
    return r;
  }

  /**
   * Generates a random UID.
   *
   * Copied from https://github.com/urbit/urbit/blob/137e4428f617c13f28ed31e520eff98d251ed3e9/pkg/interface/src/lib/util.js#L3
   */
  static uid(): string {
    let str = '0v';
    str += Math.ceil(Math.random() * 8) + '.';
    for (let i = 0; i < 5; i++) {
      let _str = Math.ceil(Math.random() * 10000000).toString(32);
      _str = ('00000' + _str).substr(-5, 5);
      str += _str + '.';
    }
    return str.slice(0, -1);
  }

  static extend(appClass: typeof UrbitApp): void {
    Urbit.apps.set(appClass.app, appClass);
  }
}



export {Urbit as default};
