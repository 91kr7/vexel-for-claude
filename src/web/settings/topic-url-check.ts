export type TopicUrlCheck = { status: 'empty' } | { status: 'valid' } | { status: 'invalid'; reason: string };

export const NOT_WEB_ADDRESS = 'Enter an http or https address.';
export const NO_TOPIC = 'Add the topic name at the end of the address.';
export const BAD_TOPIC = 'The topic name may use only letters, digits, - and _.';

const TOPIC_NAME = /^[A-Za-z0-9_-]{1,64}$/;

export function checkTopicUrl(value: string): TopicUrlCheck {
  if (value.trim() === '') return { status: 'empty' };
  if (!URL.canParse(value)) return { status: 'invalid', reason: NOT_WEB_ADDRESS };
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.hostname === '') return { status: 'invalid', reason: NOT_WEB_ADDRESS };
  const topic = url.pathname.slice(url.pathname.lastIndexOf('/') + 1);
  if (topic === '') return { status: 'invalid', reason: NO_TOPIC };
  if (!TOPIC_NAME.test(topic)) return { status: 'invalid', reason: BAD_TOPIC };
  return { status: 'valid' };
}
