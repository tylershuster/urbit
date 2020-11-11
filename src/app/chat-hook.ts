import Urbit from '../urbit';
import UrbitApp from './base';
import { uid } from '../utils';

interface MessageInterface {
  path: string;
  text?: string;
  url?: string;
  ship?: string;
}

// This class exists an example of how to create an app that extends
// the core Urbit library.
class ChatHook extends UrbitApp {
  get app(): string {
    return 'chat-hook';
  }

  message(message: MessageInterface) {
    return this.airlock.poke(this.app, 'json', {
      message: {
        path: message.path,
        envelope: {
          uid: uid(),
          number: 1, // Dummy, gets overwritten
          author: message.ship || `~${this.ship}`,
          when: new Date().getTime(),
          letter: {
            text: message.text // TODO other types
          }
        }
      }
    })
  }
}

Urbit.extend(ChatHook);

export default ChatHook;