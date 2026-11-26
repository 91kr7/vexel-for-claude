// Tests of plan-remote_notifications, batch notifications-section: checkTopicUrl spec (REQ-6, REQ-9).
import { describe, expect, it } from 'vitest';
import { checkTopicUrl } from './topic-url-check';

const NOT_WEB_ADDRESS = 'Enter an http or https address.';
const NO_TOPIC = 'Add the topic name at the end of the address.';
const BAD_TOPIC = 'The topic name may use only letters, digits, - and _.';

describe('checkTopicUrl', () => {
  it.each(['', ' ', '   \t '])('gives empty for %j', (value) => {
    expect(checkTopicUrl(value)).toEqual({ status: 'empty' });
  });

  // plan-remote_notifications/REQ-6: ntfy.sh or another ntfy server, a sub-path allowed
  it.each([
    'https://ntfy.sh/my-topic',
    'https://ntfy.example.com/ntfy/my_topic',
    'http://192.168.1.10:8080/alerts',
    'https://ntfy.sh/A1-b_2',
    `https://ntfy.sh/${'a'.repeat(64)}`,
    'https://ntfy.sh/x',
    'https://ntfy.sh/my-topic?title=hi',
    'https://ntfy.sh/my-topic#part',
  ])('accepts %s', (value) => {
    expect(checkTopicUrl(value)).toEqual({ status: 'valid' });
  });

  // plan-remote_notifications/REQ-9: not an http or https address
  it.each(['ftp://ntfy.sh/my-topic', 'ntfy.sh/my-topic', 'not an address', 'file:///tmp/my-topic', 'mailto:me@ntfy.sh'])(
    'rejects %s with the reason "Enter an http or https address."',
    (value) => {
      expect(checkTopicUrl(value)).toEqual({ status: 'invalid', reason: NOT_WEB_ADDRESS });
    },
  );

  // plan-remote_notifications/REQ-9: no topic
  it.each(['https://ntfy.sh', 'https://ntfy.sh/', 'https://ntfy.sh/my-topic/', 'https://ntfy.sh/?topic=my-topic', 'https://ntfy.sh/#my-topic'])(
    'rejects %s with the reason "Add the topic name at the end of the address."',
    (value) => {
      expect(checkTopicUrl(value)).toEqual({ status: 'invalid', reason: NO_TOPIC });
    },
  );

  // plan-remote_notifications/REQ-9: bad topic characters or length
  it.each(['https://ntfy.sh/my topic', 'https://ntfy.sh/my.topic', 'https://ntfy.sh/my%20topic', 'https://ntfy.sh/tòpic', `https://ntfy.sh/${'a'.repeat(65)}`])(
    'rejects %s with the reason "The topic name may use only letters, digits, - and _."',
    (value) => {
      expect(checkTopicUrl(value)).toEqual({ status: 'invalid', reason: BAD_TOPIC });
    },
  );
});
