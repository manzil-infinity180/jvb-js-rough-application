import { useEffect, useRef, useState } from "react";
import "./App.css";
import * as sdpTransform from "sdp-transform";
import { Video } from "./Video";

// Configurable endpoints
export const confURL = "http://127.0.0.1:8080/colibri/v2/conferences";

// Use a more reliable meeting ID generation
const generateMeetingId = () => {
  return `meeting-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
};

const meeting = generateMeetingId();
const stats_id = `participant-${Date.now()}`;

// Create a logger utility for debugging
const logger = {
  log: (message, ...args) => {
    console.log(`[${new Date().toISOString()}] ${message}`, ...args);
  },
  error: (message, ...args) => {
    console.error(`[${new Date().toISOString()}] ERROR: ${message}`, ...args);
  },
  info: (message, ...args) => {
    console.info(`[${new Date().toISOString()}] INFO: ${message}`, ...args);
  }
};

// Modified request body with additional ICE relay options
function return_demo_request_body(creation = true) {
  logger.info("Creating conference with ID:", meeting);
  return {
    "meeting-id": "beccf2ed-5441-4bfe-96d6-f0f3a6796378",
    name: "jvbbrewery@internal.auth.localhost",
    create: creation,
    endpoints: [
      {
        create: true,
        id: meeting,
        "stats-id": stats_id,
        "muc-role": "moderator",
        medias: [
          {
            type: "audio",
            "payload-types": [
              {
                name: "red",
                id: "112",
                channels: "2",
                clockrate: "48000",
                parameters: { null: "111/111" },
              },
              {
                name: "opus",
                id: "111",
                channels: "2",
                clockrate: "48000",
                parameters: { useinbandfec: "1", minptime: "10" },
                "rtcp-fbs": [{ type: "transport-cc" }],
              },
            ],
            "rtp-hdrexts": [
              { uri: "urn:ietf:params:rtp-hdrext:ssrc-audio-level", id: 1 },
              {
                uri: "http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01",
                id: 5,
              },
            ],
            "extmap-allow-mixed": true,
          },
          {
            type: "video",
            "payload-types": [
              {
                name: "VP8",
                id: "100",
                clockrate: "90000",
                parameters: { "x-google-start-bitrate": "800" },
                "rtcp-fbs": [
                  { type: "ccm", subtype: "fir" },
                  { type: "nack" },
                  { type: "nack", subtype: "pli" },
                  { type: "transport-cc" },
                ],
              },
            ],
            "rtp-hdrexts": [
              {
                uri: "http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time",
                id: 3,
              },
              {
                uri: "http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01",
                id: 5,
              },
            ],
            "extmap-allow-mixed": true,
          },
        ],
        transport: { 
          "ice-controlling": true,
          // Add explicit ICE parameters to improve connectivity
          "ice-options": ["trickle"]
        },
        capabilities: ["source-names"],
      },
    ],
    connects: [
      {
        url: "wss://example.com/audio",
        protocol: "mediajson",
        type: "transcriber",
        audio: true,
      },
      {
        url: "wss://example.com/video",
        protocol: "mediajson",
        type: "recorder",
        video: true,
      },
    ],
  };
}

function convertToSDPOffer(serverData) {
  if (!serverData || !serverData.endpoints || !serverData.endpoints[0] || !serverData.sources) {
    logger.error("Invalid server data structure for SDP conversion", serverData);
    throw new Error("Invalid server data for SDP conversion");
  }

  const endpoint = serverData.endpoints[0];
  const transport = endpoint.transport.transport;
  const ufrag = transport.ufrag;
  const pwd = transport.pwd;
  const fingerprint = transport.fingerprints[0];
  const candidates = transport.candidates;

  logger.info("Converting server data to SDP offer");
  logger.info(`Found ${candidates.length} ICE candidates`);

  const sdp = {
    version: 0,
    origin: {
      username: "-",
      sessionId: Date.now(),
      sessionVersion: 1,
      netType: "IN",
      ipVer: 4,
      address: "127.0.0.1",
    },
    name: "-",
    timing: { start: 0, stop: 0 },
    groups: [
      {
        type: "BUNDLE",
        mids: serverData.sources.map((s) => s.id.split("-")[1]).join(" "),
      },
    ],
    // Add ICE options
    iceOptions: "trickle",
    // Add DTLS setup options
    connection: { version: 4, ip: "0.0.0.0" },
    msidSemantic: { semantic: "WMS", token: "*" },
    media: serverData.sources.map((mediaSource) => {
      const isAudio = mediaSource.type === "audio";
      const mid = mediaSource.id.split("-")[1];
      const ssrc = mediaSource.sources[0].ssrc;
      const cname = mediaSource.sources[0].name;
      const codecPayloadType = isAudio ? 111 : 100;

      return {
        type: isAudio ? "audio" : "video",
        port: Number(candidates[0].port),
        protocol: "UDP/TLS/RTP/SAVPF",
        payloads: String(codecPayloadType),
        mid,
        connection: {
          version: 4,
          ip: candidates[0].ip,
        },
        rtcpMux: "rtcp-mux",
        rtcpRsize: "rtcp-rsize",
        setup: "actpass",
        iceUfrag: ufrag,
        icePwd: pwd,
        iceOptions: "trickle",
        candidates: candidates.map((c) => {
          const mapped = {
            foundation: c.foundation,
            component: Number(c.component),
            transport: c.protocol,
            priority: Number(c.priority),
            ip: c.ip,
            port: Number(c.port),
            type: c.type,
          };
          if (c["rel-addr"]) mapped.raddr = c["rel-addr"];
          if (c["rel-port"]) mapped.rport = Number(c["rel-port"]);
          return mapped;
        }),
        fingerprint: {
          type: fingerprint.hash,
          hash: fingerprint.fingerprint,
        },
        rtp: [
          isAudio
            ? { payload: 111, codec: "opus", rate: 48000, encoding: 2 }
            : { payload: 100, codec: "VP8", rate: 90000 },
        ],
        fmtp: isAudio
          ? [
              {
                payload: 111,
                config: "minptime=10;useinbandfec=1",
              },
            ]
          : [],
        rtcpFb: isAudio
          ? [
              { payload: 111, type: "transport-cc" }
            ]
          : [
              { payload: 100, type: "goog-remb" },
              { payload: 100, type: "ccm", subtype: "fir" },
              { payload: 100, type: "nack" },
              { payload: 100, type: "nack", subtype: "pli" },
              { payload: 100, type: "transport-cc" },
            ],
        ssrcs: [
          { id: ssrc, attribute: "cname", value: cname },
          { id: ssrc, attribute: "msid", value: `${cname} ${cname}-track` },
        ],
        // Add direction
        direction: "sendrecv",
      };
    }),
  };

  const sdpString = sdpTransform.write(sdp);
  logger.info("SDP offer created successfully");
  return sdpString;
}

function convertSDPAnswerToCustomJSON(sdpString) {
  logger.info("Converting SDP answer to custom JSON");
  const sdp = sdpTransform.parse(sdpString);

  if (!sdp.media || sdp.media.length === 0) {
    logger.error("No media sections found in SDP answer");
    throw new Error("Invalid SDP answer format");
  }

  const ufrag = sdp.media[0].iceUfrag;
  const pwd = sdp.media[0].icePwd;
  const fingerprint = sdp.media[0].fingerprint;

  const candidates = [];
  const sources = [];

  sdp.media.forEach((mLine, index) => {
    const type = mLine.type;
    const mid = mLine.mid;

    logger.info(`Processing media line ${index}: ${type}, mid=${mid}`);

    // Get candidates
    if (mLine.candidates && mLine.candidates.length > 0) {
      logger.info(`Found ${mLine.candidates.length} ICE candidates for ${type}`);
      mLine.candidates.forEach((cand) => {
        const formatted = {
          generation: "0",
          component: cand.component.toString(),
          protocol: cand.transport.toLowerCase(),
          port: cand.port.toString(),
          ip: cand.ip,
          foundation: cand.foundation,
          id: `cand-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          priority: cand.priority.toString(),
          type: cand.type,
          network: "0",
        };
        if (cand.raddr) formatted["rel-addr"] = cand.raddr;
        if (cand.rport) formatted["rel-port"] = cand.rport.toString();
        candidates.push(formatted);
      });
    } else {
      logger.info(`No ICE candidates found for ${type}`);
    }

    // Get SSRCs
    const ssrcGroups = {};
    if (mLine.ssrcs && mLine.ssrcs.length > 0) {
      logger.info(`Found ${mLine.ssrcs.length} SSRC entries for ${type}`);
      mLine.ssrcs.forEach((ssrcEntry) => {
        if (!ssrcGroups[ssrcEntry.id]) {
          ssrcGroups[ssrcEntry.id] = { ssrc: ssrcEntry.id, name: "" };
        }
        if (ssrcEntry.attribute === "cname") {
          ssrcGroups[ssrcEntry.id].name = ssrcEntry.value;
        }
      });

      Object.values(ssrcGroups).forEach((ssrcInfo) => {
        sources.push({
          sources: [ssrcInfo],
          id: `client-${mid}`,
          type,
        });
      });
    } else {
      logger.info(`No SSRC entries found for ${type}`);
      
      // Add default dummy source if no SSRC found to maintain protocol compatibility
      const dummySsrc = Math.floor(Math.random() * 1000000) + 1000000;
      sources.push({
        sources: [{ ssrc: dummySsrc, name: `dummy-${type}-${dummySsrc}` }],
        id: `client-${mid}`,
        type,
      });
    }
  });

  const result = {
    "meeting-id": "beccf2ed-5441-4bfe-96d6-f0f3a6796378",
    name: "jvbbrewery@internal.auth.localhost",
    endpoints: [
      {
        id: meeting,
        "stats-id": stats_id,
        "muc-role": "moderator",
        medias: [
          {
            type: "audio",
            "payload-types": [
              {
                name: "red",
                id: "112",
                channels: "2",
                clockrate: "48000",
                parameters: { null: "111/111" },
              },
              {
                name: "opus",
                id: "111",
                channels: "2",
                clockrate: "48000",
                parameters: { useinbandfec: "1", minptime: "10" },
                "rtcp-fbs": [{ type: "transport-cc" }],
              },
            ],
            "rtp-hdrexts": [
              { uri: "urn:ietf:params:rtp-hdrext:ssrc-audio-level", id: 1 },
              {
                uri: "http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01",
                id: 5,
              },
            ],
            "extmap-allow-mixed": true,
          },
          {
            type: "video",
            "payload-types": [
              {
                name: "VP8",
                id: "100",
                clockrate: "90000",
                parameters: { "x-google-start-bitrate": "800" },
                "rtcp-fbs": [
                  { type: "ccm", subtype: "fir" },
                  { type: "nack" },
                  { type: "nack", subtype: "pli" },
                  { type: "transport-cc" },
                ],
              },
            ],
            "rtp-hdrexts": [
              {
                uri: "http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time",
                id: 3,
              },
              {
                uri: "http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01",
                id: 5,
              },
            ],
            "extmap-allow-mixed": true,
          },
        ],
        transport: {
          transport: {
            candidates,
            xmlns: "urn:xmpp:jingle:apps:rtp:1",
            ufrag,
            pwd,
            "rtcp-mux": true,
            "ice-options": "trickle", // Add ice-options
            fingerprints: [
              {
                fingerprint: fingerprint.hash,
                setup: fingerprint.setup || "active",
                hash: fingerprint.type,
              },
            ],
          },
        },
        capabilities: ["source-names"],
      },
    ],
    sources,
  };

  logger.info("Successfully converted SDP answer to custom JSON");
  return result;
}

function App() {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [jvbResponseSDPOffer, setJvbResponseSDPOffer] = useState(null);
  const [jvbSdpAnswer, setJvbSdpAnswer] = useState(null);
  const [startMeeting, setStartMeeting] = useState(false);
  const [creationOpt, setCreationOpt] = useState(true);
  const [value, setValue] = useState("yes");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [connectionState, setConnectionState] = useState("New");
  const [iceGatheringState, setIceGatheringState] = useState("New");
  const [iceCandidates, setIceCandidates] = useState([]);
  
  // Use a ref to persist the RTCPeerConnection between renders
  const pcRef = useRef(null);

  // Create a function to log ICE candidates
  const logIceCandidate = (candidate) => {
    if (candidate) {
      setIceCandidates(prev => [...prev, {
        type: candidate.type,
        protocol: candidate.protocol,
        address: candidate.address || candidate.ip,
        port: candidate.port,
        time: new Date().toISOString()
      }]);
    }
  };

  // Initialize RTCPeerConnection with proper configuration
  const createPeerConnection = () => {
    // Close any existing connection
    if (pcRef.current) {
      pcRef.current.close();
    }

    logger.info("Creating new RTCPeerConnection");
    
    const pc = new RTCPeerConnection({
      iceServers: [
        {
          urls: [
            "stun:stun.l.google.com:19302",
            "stun:stun1.l.google.com:19302",
            "stun:stun2.l.google.com:19302"
          ],
        },
        // Uncomment and use your own TURN servers for production
        // {
        //   urls: [
        //     "turn:your-turn-server.com:443?transport=tcp",
        //     "turn:your-turn-server.com:443?transport=udp"
        //   ],
        //   username: "username",
        //   credential: "password",
        // },
      ],
      iceCandidatePoolSize: 10,
      iceTransportPolicy: "all", // Try "all" instead of "relay" for better connectivity
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
      // Add these to improve connectivity through firewalls
      sdpSemantics: "unified-plan"
    });

    // Set up event listeners for debugging and state tracking
    pc.onicecandidate = (event) => {
      logger.info("ICE candidate:", event.candidate);
      logIceCandidate(event.candidate);
    };

    pc.oniceconnectionstatechange = () => {
      logger.info("ICE connection state:", pc.iceConnectionState);
      setConnectionState(pc.iceConnectionState);
      
      // Restart ICE if it fails
      if (pc.iceConnectionState === 'failed') {
        logger.info("ICE connection failed, attempting to restart ICE");
        pc.restartIce();
      }
    };

    pc.onicegatheringstatechange = () => {
      logger.info("ICE gathering state:", pc.iceGatheringState);
      setIceGatheringState(pc.iceGatheringState);
    };

    pc.onconnectionstatechange = () => {
      logger.info("Connection state:", pc.connectionState);
    };

    pc.onsignalingstatechange = () => {
      logger.info("Signaling state:", pc.signalingState);
    };

    pc.onicecandidateerror = (event) => {
      logger.error("ICE candidate error:", event);
    };

    pc.ontrack = (event) => {
      logger.info("Received remote track:", event.track.kind);
      const [remote] = event.streams;
      setRemoteStream(remote);
    };

    // Add a timeout to check for connection failures
    setTimeout(() => {
      if (pc.iceConnectionState !== 'connected' && pc.iceConnectionState !== 'completed') {
        logger.info("Connection timeout - ICE state:", pc.iceConnectionState);
      }
    }, 10000);

    pcRef.current = pc;
    return pc;
  };

  // Start the meeting process
  useEffect(() => {
    let mediaStream = null;

    async function setupMeeting() {
      setLoading(true);
      setError(null);
      setIceCandidates([]);
      
      try {
        // Create a new peer connection
        const pc = createPeerConnection();
        
        // Get media stream
        logger.info("Requesting user media");
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        
        logger.info("User media obtained, adding tracks to peer connection");
        
        // Add tracks to peer connection
        mediaStream.getTracks().forEach((track) => {
          logger.info(`Adding ${track.kind} track to peer connection`);
          pc.addTrack(track, mediaStream);
        });
        
        setLocalStream(mediaStream);
        
        // Create conference with Jitsi Videobridge
        logger.info("Sending initial request to Jitsi Videobridge");
        const res = await fetch(confURL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(return_demo_request_body(creationOpt)),
        });

        if (!res.ok) {
          throw new Error(`Failed to create conference: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        logger.info("Received response from Jitsi Videobridge");
        
        // Convert to SDP offer and set as remote description
        const jvbsdp = convertToSDPOffer(data);
        logger.info("Converted JVB response to SDP offer");
        setJvbResponseSDPOffer(jvbsdp);

        logger.info("Setting remote description (JVB SDP offer)");
        await pc.setRemoteDescription(
          new RTCSessionDescription({ type: "offer", sdp: jvbsdp })
        );
        
        // Create answer
        logger.info("Creating answer");
        const answer = await pc.createAnswer();
        logger.info("Created answer, setting local description");

        await pc.setLocalDescription(answer);
        
        // Convert answer to Colibri format and send back to JVB
        const sdpToJsonForColibri = convertSDPAnswerToCustomJSON(answer.sdp);
        setJvbSdpAnswer(sdpToJsonForColibri);
        
        logger.info("Sending SDP answer to Jitsi Videobridge");
        const res1 = await fetch(confURL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sdpToJsonForColibri),
        });

        if (!res1.ok) {
          throw new Error(`Failed to send SDP answer: ${res1.status} ${res1.statusText}`);
        }

        const data1 = await res1.json();
        logger.info("Received final response from Jitsi Videobridge");
        
        // Log transceivers for debugging
        logger.info("Current transceivers:");
        pc.getTransceivers().forEach((t, index) => {
          logger.info(
            `Transceiver[${index}]: mid=${t.mid}, kind=${t.receiver.track?.kind}, direction=${t.direction}`
          );
        });
        
        setLoading(false);
      } catch (error) {
        logger.error("Meeting setup error:", error);
        setError(error.message || "Failed to setup meeting");
        setLoading(false);
        
        // Clean up on error
        if (mediaStream) {
          mediaStream.getTracks().forEach(track => track.stop());
        }
      }
    }

    if (startMeeting) {
      setupMeeting();
    }

    // Cleanup function
    return () => {
      if (startMeeting && mediaStream) {
        logger.info("Cleaning up media tracks");
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [startMeeting, creationOpt]);

  // Handle the start meeting button click
  function handleSubmit() {
    setCreationOpt(value.toLowerCase() === "yes");
    setStartMeeting(true);
  }

  // Handle ending the meeting
  function handleEndMeeting() {
    if (pcRef.current) {
      logger.info("Closing peer connection");
      pcRef.current.close();
      pcRef.current = null;
    }
    
    if (localStream) {
      logger.info("Stopping local stream tracks");
      localStream.getTracks().forEach(track => track.stop());
    }
    
    setStartMeeting(false);
    setLocalStream(null);
    setRemoteStream(null);
    setError(null);
    setIceCandidates([]);
  }

  if (!startMeeting) {
    return (
      <>
        <h1>JVB Video Test</h1>
        <div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              maxWidth: "400px",
              margin: "0 auto",
            }}
          >
            <p>Create new conference? (yes/no)</p>
            <div style={{ display: "flex", gap: "10px" }}>
              <input
                type="text"
                onChange={(e) => setValue(e.target.value)}
                value={value}
                style={{ flex: 1, padding: "8px" }}
              />
              <button 
                onClick={handleSubmit} 
                style={{ 
                  padding: "8px 16px", 
                  backgroundColor: "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                Start Meeting
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <h1>JVB Video Test</h1>
      {loading && <div style={{ textAlign: "center", margin: "10px 0" }}>Setting up connection...</div>}
      {error && <div style={{ color: "red", textAlign: "center", margin: "10px 0" }}>Error: {error}</div>}
      
      <div style={{ textAlign: "center", margin: "10px 0" }}>
        <p>Connection State: <strong>{connectionState}</strong></p>
        <p>ICE Gathering State: <strong>{iceGatheringState}</strong></p>
      </div>
      
      <div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "20px",
            justifyContent: "center",
          }}
        >
          <div>
            <h3>Local Stream</h3>
            <Video stream={localStream} />
          </div>
          <div>
            <h3>Remote Stream</h3>
            <Video stream={remoteStream} />
          </div>
        </div>
        
        <div style={{ textAlign: "center", margin: "20px 0" }}>
          <button 
            onClick={handleEndMeeting}
            style={{ 
              padding: "8px 16px", 
              backgroundColor: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              marginRight: "10px"
            }}
          >
            End Meeting
          </button>
          
          <button 
            onClick={() => {
              if (pcRef.current) {
                logger.info("Manually restarting ICE");
                pcRef.current.restartIce();
              }
            }}
            style={{ 
              padding: "8px 16px", 
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            Restart ICE
          </button>
        </div>
        
        {iceCandidates.length > 0 && (
          <div style={{ margin: "20px auto", maxWidth: "800px" }}>
            <h3>ICE Candidates ({iceCandidates.length})</h3>
            <div style={{ maxHeight: "200px", overflow: "auto", border: "1px solid #ddd", padding: "10px" }}>
              <ul style={{ listStyle: "none", padding: 0 }}>
                {iceCandidates.map((candidate, idx) => (
                  <li key={idx} style={{ marginBottom: "5px", fontSize: "0.9em" }}>
                    {candidate.time}: {candidate.type} ({candidate.protocol}) - {candidate.address}:{candidate.port}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default App;