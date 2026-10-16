/** Owns late browser acquisition results; cancellation does not cancel getUserMedia. */
export class MediaLease {
  private closed = false;
  private streams = new Set<MediaStream>();
  async acquire(request: Promise<MediaStream>) {
    const stream = await request;
    if (this.closed) {
      for (const track of stream.getTracks()) track.stop();
      throw new DOMException("Canceled", "AbortError");
    }
    this.streams.add(stream);
    return stream;
  }
  close() {
    this.closed = true;
    for (const stream of this.streams) for (const track of stream.getTracks()) track.stop();
    this.streams.clear();
  }
}
