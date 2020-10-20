import Urbit from '../urbit';
import UrbitApp from './base';

interface MessageInterface {
  path: string;
  text?: string;
  url?: string;
  ship?: string;
}

class ChatHook extends UrbitApp {
  static app: string = 'chat-hook';

  message(message: MessageInterface) {
    return this.airlock.poke(this.ship, 'chat-hook', 'json', {
      message: {
        path: message.path,
        envelope: {
          uid: Urbit.uid(),
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