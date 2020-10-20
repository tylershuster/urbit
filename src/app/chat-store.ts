import Urbit from '../urbit';
import UrbitApp from './base';

class ChatStore extends UrbitApp {
  static app: string = 'chat-store';
}

Urbit.extend(ChatStore);

export default ChatStore;