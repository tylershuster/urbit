// This is just for typescript casting
import { AxiosResponse } from 'axios';
// EventSource is native in browser; this is a polyfill
const EventSource = require('eventsource');
// In browser we would use native fetch; axios is a good alternative for node or older browsers
const axios = require('axios').default;

/**
 * A class for interacting with an urbit ship, given its URL and code
 */
class Urbit {
  /**
   * Code is the deterministic password
   */
  code: String;

  /**
   * URL is the location of the instance.
   */
  url: String;

  /**
   * UID will be used for the channel: The current unix time plus a random hex string
   */
  uid: String;

  /**
   * Last Event ID is an auto-updated index of which events have been sent over this channel
   */
  lastEventId: Number = 0;

  /**
   * SSE Client is null for now; we don't want to start polling until it the channel exists
   */
  sseClient: EventSource | null = null;

  /**
   * Cookie gets set when we log in.
   */
  cookie?: String | null;

  /**
   * Ship can be set, in which case we can do some magic stuff like send chats
   */
  ship?: String | null;

  /** This is basic interpolation to get the channel URL of an instantiated Urbit connection. */
  get channelUrl(): String {
    return `${this.url}/~/channel/${this.uid}`;
  }

  /**
   * Constructs a new Urbit connection.
   *
   * @param url  The URL (with protocol and port) of the ship to be accessed
   * @param code The access code for the ship at that address
   */
  constructor(url: String, code: String) {
    this.uid = `${Math.floor(Date.now() / 1000)}-${Urbit.hexString(6)}`;
    this.code = code;
    this.url = url;
  }

  /**
   * Connects to the Urbit ship. Nothing can be done until this is called.
   */
  async connect(): Promise<AxiosResponse> {
    const headers = { connection: 'keep-alive' };
    return axios
      .post(`${this.url}/~/login`, `password=${this.code}`, { headers })
      .then((response: AxiosResponse) => {
        this.cookie = response.headers['set-cookie'][0];
        return response;
      })
      .catch((error: any) => {
        console.error('connection error', error);
      });
  }

  /**
   * Returns (and initializes, if necessary) the SSE pipe for the appropriate channel.
   */
  eventSource() {
    if (!this.sseClient) {
      const headers = { cookie: this.cookie, connection: 'keep-alive' };
      this.sseClient = new EventSource(this.channelUrl, { headers });
      this.sseClient?.addEventListener('message', (event: MessageEvent) => {
        this.ack(Number(event.lastEventId));
      });
      this.sseClient?.addEventListener('error', function(event: Event) {
        console.error('pipe error', event);
      });
    }
    return this.sseClient;
  }

  /**
   * Returns the next event ID for the appropriate channel.
   */
  getEventId(): Number {
    this.lastEventId = Number(this.lastEventId) + 1;
    return this.lastEventId;
  }

  /**
   * Acknowledges an event.
   *
   * @param eventId The event to acknowledge.
   */
  async ack(eventId: Number): Promise<AxiosResponse> {
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
   */
  async sendMessage(action: string, data?: object): Promise<AxiosResponse> {
    const headers = {
      Connection: 'keep-alive',
      Cookie: this.cookie,
      'Content-Type': 'application/json',
    };
    return axios
      .request({
        // PUT data to the appropriate channel
        url: this.channelUrl,
        method: 'put',
        headers,
        data: [
          {
            // Get a new event ID,
            id: this.getEventId(),
            // Include the action,
            action,
            // And all the properties of the data to be passed.
            ...data,
          },
        ],
      })
      .catch((error: any) => {
        console.error('message error', error);
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
    ship: String = this.ship ? this.ship : '',
    app: string,
    mark: string,
    json: Object
  ): Promise<AxiosResponse> {
    return this.sendMessage('poke', { ship, app, mark, json });
  }

  /**
   * Subscribes to a path on an app on a ship.
   *
   * @param ship The ship to subscribe to
   * @param app The app to subsribe to
   * @param path The path to which to subscribe
   */
  async subscribe(
    ship: String = this.ship ? this.ship : '',
    app: string,
    path: string
  ): Promise<AxiosResponse> {
    return this.sendMessage('subscribe', { ship, app, path });
  }

  /**
   * Unsubscribes to a given subscription.
   *
   * @param subscription
   */
  async unsubscribe(subscription: string): Promise<AxiosResponse> {
    return this.sendMessage('unsubscribe', { subscription });
  }

  /**
   * Deletes the connection to a channel.
   */
  async delete() {
    return this.sendMessage('delete');
  }

  /**
   * Utility function to connect to a ship that has its *.arvo.network domain configured.
   *
   * @param name Name of the ship e.g. zod
   * @param code Code to log in
   */
  static onArvoNetwork(name: string, code: string): Urbit {
    const ship = new Urbit(`https://${name}.arvo.network`, code);
    ship.ship = name;
    return ship;
  }

  /**
   * Returns a hex string of given length.
   *
   * Poached from StackOverflow.
   *
   * @param len Length of hex string to return.
   */
  static hexString(len: number) {
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
  static uid() {
    let str = '0v';
    str += Math.ceil(Math.random() * 8) + '.';
    for (let i = 0; i < 5; i++) {
      let _str = Math.ceil(Math.random() * 10000000).toString(32);
      _str = ('00000' + _str).substr(-5, 5);
      str += _str + '.';
    }
    return str.slice(0, -1);
  }
}

export default Urbit;
