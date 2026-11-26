import type { NtfyMessage, NtfyTarget, PublishResult } from './ntfy-publisher.js';
import { remoteNotificationMessage } from './remote-notification-text.js';
import type { RemoteSend } from './remote-rule.js';
import type { RemoteSettings } from './remote-settings-store.js';

export interface RemoteNotifierDependencies {
  settings: { read(): Promise<RemoteSettings> };
  publish(target: NtfyTarget, message: NtfyMessage): Promise<PublishResult>;
  now?: () => number;
  log?: (line: string) => void;
}

export async function sendRemoteNotification(send: RemoteSend, dependencies: RemoteNotifierDependencies): Promise<void> {
  const { settings, publish, now = Date.now, log = (line) => console.error(line) } = dependencies;
  let failure: string | undefined;
  try {
    const { enabled, topicUrl, token } = await settings.read();
    if (!enabled || topicUrl === '') return;
    const result = await publish({ topicUrl, token }, remoteNotificationMessage(send.event, now() - send.receivedAt));
    if (result.status === 'failed') failure = result.reason;
  } catch {
    failure = 'unexpected error.';
  }
  if (failure !== undefined) log(`Remote notification not sent: ${failure}`);
}
