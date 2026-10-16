import { LIMITS } from "../../../shared/policy";
import { MediaLease } from "./media-lease";
export class Peer {
  readonly pc: RTCPeerConnection;
  readonly lease = new MediaLease();
  local: MediaStream | null = null;
  private remote = new MediaStream();
  private makingOffer = false;
  private ignoreOffer = false;
  private closed = false;
  private camera: MediaStreamTrack | null = null;
  private videoSender: RTCRtpSender | null = null;
  private screen: MediaStream | null = null;
  private screenPending = false;
  private candidates: RTCIceCandidateInit[] = [];
  private queue = Promise.resolve();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectionFailed = false;
  private prepared: Promise<void> | null = null;
  constructor(
    private config: {
      iceServers: RTCIceServer[];
      polite: boolean;
      signal: (body: string) => Promise<unknown>;
      changed: () => void;
      remote: (stream: MediaStream) => void;
      connected: () => void;
      disconnected: () => void;
      failed: (error: unknown) => void;
    },
  ) {
    this.pc = new RTCPeerConnection({ iceServers: config.iceServers });
    this.pc.onicecandidate = (e) => {
      if (e.candidate && !this.closed)
        void config
          .signal(JSON.stringify({ candidate: e.candidate.toJSON() }))
          .catch(config.failed);
    };
    this.pc.onnegotiationneeded = () => {
      this.queue = this.queue
        .then(async () => {
          if (this.closed) return;
          let sent: Promise<unknown> | undefined;
          try {
            this.makingOffer = true;
            await this.pc.setLocalDescription();
            if (!this.closed)
              sent = config.signal(JSON.stringify({ description: this.pc.localDescription }));
          } finally {
            this.makingOffer = false;
          }
          // Transport acknowledgement must not hold the SDP collision lock.
          await sent;
        })
        .catch(config.failed);
    };
    this.pc.ontrack = (e) => {
      if (!this.remote.getTracks().some((t) => t.id === e.track.id)) this.remote.addTrack(e.track);
      config.remote(this.remote);
      e.track.onunmute = () => config.changed();
      e.track.onended = () => config.changed();
    };
    this.pc.onconnectionstatechange = () => {
      if (this.closed || this.connectionFailed) return;
      if (this.pc.connectionState === "connected") {
        this.clearReconnect();
        config.connected();
      }
      if (this.pc.connectionState === "disconnected" && !this.reconnectTimer) {
        config.disconnected();
        this.reconnectTimer = setTimeout(() => this.failConnection(), LIMITS.reconnectMs);
        // Only the offerer initiates an ICE restart; perfect negotiation handles collisions.
        if (!config.polite) this.pc.restartIce();
      }
      if (this.pc.connectionState === "failed") this.failConnection();
    };
  }
  private clearReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }
  private failConnection() {
    if (this.closed || this.connectionFailed) return;
    this.connectionFailed = true;
    this.clearReconnect();
    this.config.failed(new Error("CALL_CONNECTION_FAILED"));
  }
  startConnecting() {
    if (!this.closed && !this.reconnectTimer && this.pc.connectionState !== "connected")
      this.reconnectTimer = setTimeout(() => this.failConnection(), LIMITS.connectMs);
  }
  prepare(video: boolean) {
    this.prepared ??= this.acquireMedia(video);
    return this.prepared;
  }
  private async acquireMedia(video: boolean) {
    this.local = await this.lease.acquire(
      navigator.mediaDevices.getUserMedia({ audio: true, video }),
    );
    if (this.closed) return;
    for (const track of this.local.getTracks()) {
      const sender = this.pc.addTrack(track, this.local);
      if (track.kind === "video") {
        this.camera = track;
        this.videoSender = sender;
      }
    }
    this.config.changed();
  }
  async receive(body: string) {
    const data: { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit } =
      JSON.parse(body);
    // Do not answer without our tracks while microphone permission is pending.
    await this.prepared;
    if (this.closed) return;
    if (data.description) {
      this.startConnecting();
      const collision =
        data.description.type === "offer" &&
        (this.makingOffer || this.pc.signalingState !== "stable");
      this.ignoreOffer = !this.config.polite && collision;
      if (this.ignoreOffer) return;
      await this.pc.setRemoteDescription(data.description);
      for (const candidate of this.candidates) await this.pc.addIceCandidate(candidate);
      this.candidates = [];
      if (data.description.type === "offer") {
        await this.pc.setLocalDescription();
        if (!this.closed)
          await this.config.signal(JSON.stringify({ description: this.pc.localDescription }));
      }
    } else if (data.candidate && !this.ignoreOffer) {
      if (this.pc.remoteDescription) await this.pc.addIceCandidate(data.candidate);
      else this.candidates.push(data.candidate);
    }
  }
  toggleMicrophone() {
    for (const t of this.local?.getAudioTracks() ?? []) t.enabled = !t.enabled;
    this.config.changed();
  }
  toggleCamera() {
    if (this.camera) this.camera.enabled = !this.camera.enabled;
    this.config.changed();
  }
  async toggleScreen() {
    if (this.screenPending || this.closed) return;
    this.screenPending = true;
    try {
      if (this.screen) {
        await this.stopScreen();
        return;
      }
      const stream = await this.lease.acquire(
        navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }),
      );
      if (this.closed) return;
      this.screen = stream;
      const track = stream.getVideoTracks()[0];
      if (this.videoSender) await this.videoSender.replaceTrack(track);
      else this.videoSender = this.pc.addTrack(track, stream);
      track.onended = () => {
        void this.stopScreen().catch(this.config.failed);
      };
      this.config.changed();
    } finally {
      this.screenPending = false;
    }
  }
  private async stopScreen() {
    const screen = this.screen;
    this.screen = null;
    for (const t of screen?.getTracks() ?? []) {
      t.onended = null;
      t.stop();
    }
    if (!this.closed && this.videoSender) await this.videoSender.replaceTrack(this.camera);
    this.config.changed();
  }
  get sharing() {
    return !!this.screen;
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.clearReconnect();
    this.pc.onconnectionstatechange = null;
    this.pc.onnegotiationneeded = null;
    this.pc.onicecandidate = null;
    this.pc.ontrack = null;
    this.lease.close();
    this.pc.close();
    for (const t of this.remote.getTracks()) t.stop();
  }
}
