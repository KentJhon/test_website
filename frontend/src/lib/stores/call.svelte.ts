import {
	createCallSignal,
	getIncomingCalls,
	getNewCallSignals,
	updateCallSignalStatus,
} from '$lib/api/calls';
import type { PayloadCallSignal } from '$lib/types/payload';

type CallState = 'idle' | 'calling' | 'incoming' | 'active';

let callState = $state<CallState>('idle');
let remoteUser = $state('');
let isMuted = $state(false);
let incomingSignal = $state<PayloadCallSignal | null>(null);

let localUsername = '';
let callId = '';
let peerConnection: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let remoteAudioEl: HTMLAudioElement | null = null;
let incomingPollTimer: ReturnType<typeof setInterval> | null = null;
let signalingPollTimer: ReturnType<typeof setInterval> | null = null;
let lastSignalTimestamp = '';

const RTC_CONFIG: RTCConfiguration = {
	iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export function getCallState() {
	return callState;
}

export function getRemoteUser() {
	return remoteUser;
}

export function getIsMuted() {
	return isMuted;
}

export function getIncomingSignal() {
	return incomingSignal;
}

export function setRemoteAudioElement(el: HTMLAudioElement) {
	remoteAudioEl = el;
}

export function initCallSystem(username: string) {
	localUsername = username;
	incomingPollTimer = setInterval(pollForIncomingCalls, 3000);
}

export function destroyCallSystem() {
	cleanup();
	if (incomingPollTimer) {
		clearInterval(incomingPollTimer);
		incomingPollTimer = null;
	}
}

async function pollForIncomingCalls() {
	if (callState !== 'idle') return;
	try {
		const res = await getIncomingCalls(localUsername);
		if (res.docs.length > 0) {
			const offer = res.docs[0];
			incomingSignal = offer;
			callId = offer.callId;
			remoteUser = offer.from;
			callState = 'incoming';
		}
	} catch {
		// silent fail
	}
}

export async function startCall(targetUser: string) {
	if (callState !== 'idle') return;

	remoteUser = targetUser;
	callId = crypto.randomUUID();
	callState = 'calling';

	try {
		localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
		peerConnection = new RTCPeerConnection(RTC_CONFIG);

		localStream.getTracks().forEach((track) => {
			peerConnection!.addTrack(track, localStream!);
		});

		setupPeerConnectionHandlers();

		const offer = await peerConnection.createOffer();
		await peerConnection.setLocalDescription(offer);

		await createCallSignal({
			callId,
			from: localUsername,
			to: targetUser,
			type: 'offer',
			data: { sdp: offer.sdp, type: offer.type },
			status: 'pending',
		});

		lastSignalTimestamp = new Date().toISOString();
		startSignalingPoll();
	} catch {
		cleanup();
	}
}

export async function acceptCall() {
	if (callState !== 'incoming' || !incomingSignal) return;

	callState = 'active';

	try {
		localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
		peerConnection = new RTCPeerConnection(RTC_CONFIG);

		localStream.getTracks().forEach((track) => {
			peerConnection!.addTrack(track, localStream!);
		});

		setupPeerConnectionHandlers();

		const offerData = incomingSignal.data as { sdp: string; type: RTCSdpType };
		await peerConnection.setRemoteDescription(
			new RTCSessionDescription({ sdp: offerData.sdp, type: offerData.type })
		);

		const answer = await peerConnection.createAnswer();
		await peerConnection.setLocalDescription(answer);

		await createCallSignal({
			callId,
			from: localUsername,
			to: remoteUser,
			type: 'answer',
			data: { sdp: answer.sdp, type: answer.type },
			status: 'active',
		});

		await updateCallSignalStatus(incomingSignal.id, 'active');

		lastSignalTimestamp = new Date().toISOString();
		startSignalingPoll();
	} catch {
		cleanup();
	}
}

export async function declineCall() {
	if (!incomingSignal) return;

	try {
		await updateCallSignalStatus(incomingSignal.id, 'ended');
		await createCallSignal({
			callId,
			from: localUsername,
			to: remoteUser,
			type: 'hangup',
			data: null,
			status: 'ended',
		});
	} catch {
		// silent fail
	}
	cleanup();
}

export async function hangUp() {
	try {
		await createCallSignal({
			callId,
			from: localUsername,
			to: remoteUser,
			type: 'hangup',
			data: null,
			status: 'ended',
		});
	} catch {
		// silent fail
	}
	cleanup();
}

export function toggleMute() {
	if (!localStream) return;
	const audioTrack = localStream.getAudioTracks()[0];
	if (audioTrack) {
		audioTrack.enabled = !audioTrack.enabled;
		isMuted = !audioTrack.enabled;
	}
}

function setupPeerConnectionHandlers() {
	if (!peerConnection) return;

	peerConnection.onicecandidate = async (event) => {
		if (event.candidate) {
			try {
				await createCallSignal({
					callId,
					from: localUsername,
					to: remoteUser,
					type: 'ice-candidate',
					data: {
						candidate: event.candidate.candidate,
						sdpMid: event.candidate.sdpMid,
						sdpMLineIndex: event.candidate.sdpMLineIndex,
					},
				});
			} catch {
				// silent fail
			}
		}
	};

	peerConnection.ontrack = (event) => {
		if (remoteAudioEl && event.streams[0]) {
			remoteAudioEl.srcObject = event.streams[0];
		}
	};

	peerConnection.onconnectionstatechange = () => {
		if (
			peerConnection?.connectionState === 'disconnected' ||
			peerConnection?.connectionState === 'failed'
		) {
			cleanup();
		}
	};
}

function startSignalingPoll() {
	if (signalingPollTimer) clearInterval(signalingPollTimer);
	signalingPollTimer = setInterval(pollForSignals, 1000);
}

async function pollForSignals() {
	if (!callId) return;

	try {
		const res = await getNewCallSignals(callId, lastSignalTimestamp);
		for (const signal of res.docs) {
			if (signal.from === localUsername) continue;

			if (signal.type === 'answer' && peerConnection) {
				const answerData = signal.data as { sdp: string; type: RTCSdpType };
				await peerConnection.setRemoteDescription(
					new RTCSessionDescription({ sdp: answerData.sdp, type: answerData.type })
				);
				callState = 'active';
			} else if (signal.type === 'ice-candidate' && peerConnection) {
				const candidateData = signal.data as {
					candidate: string;
					sdpMid: string | null;
					sdpMLineIndex: number | null;
				};
				await peerConnection.addIceCandidate(
					new RTCIceCandidate({
						candidate: candidateData.candidate,
						sdpMid: candidateData.sdpMid,
						sdpMLineIndex: candidateData.sdpMLineIndex,
					})
				);
			} else if (signal.type === 'hangup') {
				cleanup();
				return;
			}
		}

		if (res.docs.length > 0) {
			lastSignalTimestamp = res.docs[res.docs.length - 1].createdAt;
		}
	} catch {
		// silent fail
	}
}

function cleanup() {
	if (signalingPollTimer) {
		clearInterval(signalingPollTimer);
		signalingPollTimer = null;
	}

	if (peerConnection) {
		peerConnection.close();
		peerConnection = null;
	}

	if (localStream) {
		localStream.getTracks().forEach((track) => track.stop());
		localStream = null;
	}

	if (remoteAudioEl) {
		remoteAudioEl.srcObject = null;
	}

	callState = 'idle';
	remoteUser = '';
	isMuted = false;
	callId = '';
	incomingSignal = null;
	lastSignalTimestamp = '';
}
