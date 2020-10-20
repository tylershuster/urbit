import Urbit from '../urbit';

export interface UrbitAppInterface {
  airlock: Urbit;
}

export default class UrbitApp implements UrbitAppInterface {
  static app: string = 'error';
  airlock: Urbit;

  constructor(airlock: Urbit) {
    this.airlock = airlock;
  }

  /**
   * Getter that barfs if no ship has been passed
   */
  get ship(): string {
    if (!this.airlock.ship) {
      throw new Error('No ship specified');
    }
    return this.airlock.ship;
  }

  /**
   * Helper to allow any app to handle subscriptions.
   * 
   * @param path Path on app to subscribe to
   */
  subscribe(path: string) {
    const ship = this.ship;
    const app = (this.constructor as typeof UrbitApp).app;
    return this.airlock.subscribe({ ship, app, path });
  }
  // TODO handle methods that don't exist
}
