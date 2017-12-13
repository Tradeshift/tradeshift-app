import uuid from 'uuid';
import { log } from './log';
import { app } from './app';
import { postMessage, hubMessageValid, publishMessageValid } from './msg';

export function hub(chrome) {
	const debug = log('ts:app:top');
	/**
	 * WeakMap of frames with apps.
	 * @type {WeakMap<Window, Object<appId: string, token: string>}
	 */
	const appWindows = new WeakMap();

	window.addEventListener('message', function(event) {
		const message = event.data;

		// Only accept valid messages from apps.
		if (!hubMessageValid(message)) {
			return;
		}

		// Message from a frame we don't know yet.
		if (!appWindows.has(event.source)) {
			// The only command should be CONNECT, we fail otherwise.
			if (message.type === 'CONNECT') {
				const appId = chrome.appIdByWindow(event.source);
				const token = uuid();
				debug('CONNECT %o', appId);
				appWindows.set(event.source, { appId, token });
				postMessage(
					{ type: 'CONNACK', viaHub: true, target: appId, token },
					event.source
				);
				return;
			} else {
				console.warn(
					'Unexpected critical error! ts.app sent message without being connected!',
					event
				);
				return;
			}
		}

		if (message.token !== appWindows.get(event.source).token) {
			console.warn(
				'Token seems invalid, discarding message!\n' +
					JSON.stringify(message, null, 2)
			);
			return;
		}

		const appWindow = appWindows.get(event.source);
		message.source = appWindow.appId;
		message.token = appWindow.token;
		message.viaHub = true;

		if (message.source === message.target) {
			console.warn(
				'Source and destination match, discarding message!\n' +
					JSON.stringify(message, null, 2)
			);
			return;
		}

		switch (message.type) {
			case 'PUBLISH':
				if (!publishMessageValid(message)) {
					console.warn(
						'Message incomplete for a PUBLISH command!\n' +
							JSON.stringify(message)
					);
					return;
				}
				/**
				 * @TODO Handle the case when the Chrome blocks certain targets for certain sources
				 */
				const targetWindow = chrome.windowByAppId(message.target, event.source);
				debug(
					'Routing %o from %o to %o - %O',
					'PUBLISH',
					message.source,
					message.target,
					message
				);
				postMessage(message, targetWindow);
				break;
			default:
				debug('* %o', event.data);
				break;
		}
	});

	return {
		top: app
	};
}
