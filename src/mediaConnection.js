'use strict';

const Connection = require('./connection');
const Negotiator = require('./negotiator');
const util = require('./util');

const Enum = require('enum');

const MCEvents = new Enum([
  'stream'
]);

/**
 * Class that manages data connections to other peers.
 * @extends Connection
 */
class MediaConnection extends Connection {
  /**
   * Create a data connection to another peer.
   * @param {string} remoteId - The peerId of the peer you are connecting to.
   * @param {object} [options] - Optional arguments for the connection.
   * @param {string} [options.connectionId] - An ID to uniquely identify the connection. Defaults to random string if not specified.
   * @param {string} [options.label] - Label to easily identify the connection on either peer.
   * @param {object} [options.pcConfig] - A RTCConfiguration dictionary for the RTCPeerConnection.
   * @param {object} [options.stream] - The MediaStream to send to the remote peer. Set only when on the caller side.
   * @param {string} [options.queuedMessages] - An array of messages that were already received before the connection was created.
   * @param {string} [options.payload] - An offer message that triggered creating this object.
   */
  constructor(remoteId, options) {
    super(remoteId, options);

    this._idPrefix = 'mc_';
    this.type = 'media';

    /**
     * The local MediaStream.
     * @type {MediaStream}
     */
    this.localStream = this._options.stream;

    // Messages stored by peer because MC was not ready yet
    this._queuedMessages = this._options.queuedMessages || [];
    this._pcAvailable = false;

    if (this.localStream) {
      this._negotiator.startConnection(
        {
          type:       'media',
          stream:     this.localStream,
          originator: true
        },
        this._options.pcConfig
      );
      this._pcAvailable = true;
      this._handleQueuedMessages();
    }

    this._negotiator.on(Negotiator.EVENTS.addStream.key, remoteStream => {
      util.log('Receiving stream', remoteStream);

      this.remoteStream = remoteStream;
      // Is 'stream' an appropriate emit message? PeerJS contemplated using 'open' instead
      this.emit(MediaConnection.EVENTS.stream.key, remoteStream);
    });
  }

  /**
   * Create and send an answer message.
   * @param {MediaStream} stream - The stream to send to the peer.
   */
  answer(stream) {
    if (this.localStream) {
      util.warn('localStream already exists on this MediaConnection. Are you answering a call twice?');
      return;
    }

    this._options.payload.stream = stream;

    this.localStream = stream;
    this._negotiator.startConnection(
      {
        type:       'media',
        stream:     this.localStream,
        originator: false,
        offer:      this._options.payload.offer
      },
      this._options.pcConfig
    );
    this._pcAvailable = true;

    this._handleQueuedMessages();

    this.open = true;
  }

  /**
   * Events the MediaConnection class can emit.
   * @type {Enum}
   */
  static get EVENTS() {
    return MCEvents;
  }

  /**
   * MediaStream received from peer.
   *
   * @event MediaConnection#stream
   * @type {MediaStream}
   */
}

module.exports = MediaConnection;
