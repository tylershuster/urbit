import Urbit from '../urbit';
import UrbitApp from './base';

class ChatView extends UrbitApp {
  static app: string = 'chat-view';
}

Urbit.extend(ChatView);

export default ChatView;