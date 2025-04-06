import { useEffect, useState } from "react";
import "./App.css";
import * as sdpTransform from "sdp-transform";
import { Video } from "./Video";
export const confURL = "http://127.0.0.1:8080/colibri/v2/conferences";
const demo_request_body = {
  "meeting-id": "beccf2ed-5441-4bfe-96d6-f0f3a6796378",
  name: "jvbbrewery@internal.auth.localhost",
  create: true,
  endpoints: [
    {
      create: true,
      id: "79f02837",
      "stats-id": "raj-w1o",
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
      transport: { "ice-controlling": true },
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
function convertToSDPOffer(serverData) {
  const endpoint = serverData.endpoints[0];
  const transport = endpoint.transport.transport;
  const ufrag = transport.ufrag;
  const pwd = transport.pwd;
  const fingerprint = transport.fingerprints[0];
  const candidates = transport.candidates;

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
    msidSemantic: { semantic: "WMS", token: "*" },
    media: serverData.sources.map((mediaSource) => {
      const isAudio = mediaSource.type === "audio";
      const mid = mediaSource.id.split("-")[1];
      const ssrc = mediaSource.sources[0].ssrc;
      const cname = mediaSource.sources[0].name;
      const codecPayloadType = isAudio ? 111 : 100;
    
      return {
        type: isAudio ? "audio" : "video",
        port: 9,
        protocol: "UDP/TLS/RTP/SAVPF",
        payloads: String(codecPayloadType),
        mid,
        rtcpMux: "rtcp-mux",
        setup: "actpass",
        iceUfrag: ufrag,
        icePwd: pwd,
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
          ? []
          : [
              { payload: 100, type: "goog-remb" },
              { payload: 100, type: "ccm", subtype: "fir" },
              { payload: 100, type: "nack" },
              { payload: 100, type: "nack", subtype: "pli" },
            ],
        ssrcs: [
          { id: ssrc, attribute: "cname", value: cname },
          { id: ssrc, attribute: "msid", value: `${cname} ${cname}-track` },
        ],
      };
    }),
  };

  return sdpTransform.write(sdp);
}

function convertSDPAnswerToCustomJSON(sdpString) {
  const sdp = sdpTransform.parse(sdpString);

  const ufrag = sdp.media[0].iceUfrag;
  const pwd = sdp.media[0].icePwd;
  const fingerprint = sdp.media[0].fingerprint;

  const candidates = [];
  const sources = [];

  sdp.media.forEach((mLine) => {
    const type = mLine.type;
    const mid = mLine.mid;

    // Get candidates
    mLine.candidates?.forEach((cand) => {
      const formatted = {
        generation: "0",
        component: cand.component.toString(),
        protocol: cand.transport.toLowerCase(),
        port: cand.port.toString(),
        ip: cand.ip,
        foundation: cand.foundation,
        id: `generated-${Math.random().toString(36).substr(2, 10)}`, // dummy ID
        priority: cand.priority.toString(),
        type: cand.type,
        network: "0"
      };
      if (cand.raddr) formatted['rel-addr'] = cand.raddr;
      if (cand.rport) formatted['rel-port'] = cand.rport.toString();
      candidates.push(formatted);
    });

    // Get SSRCs
    const ssrcGroups = {};
    mLine.ssrcs?.forEach((ssrcEntry) => {
      if (!ssrcGroups[ssrcEntry.id]) {
        ssrcGroups[ssrcEntry.id] = { ssrc: ssrcEntry.id, name: '' };
      }
      if (ssrcEntry.attribute === 'cname') {
        ssrcGroups[ssrcEntry.id].name = ssrcEntry.value;
      }
    });

    Object.values(ssrcGroups).forEach((ssrcInfo) => {
      sources.push({
        sources: [ssrcInfo],
        id: `client-${mid}`,
        type
      });
    });
  });

  return {
    "meeting-id": "beccf2ed-5441-4bfe-96d6-f0f3a6796378",
    name: "jvbbrewery@internal.auth.localhost",
    endpoints: [
      {
        id: `79f0b735`,
        "stats-id":"rahul-w1o",
        "muc-role":"moderator",
        "create": true,
        "medias":[
                {
                  "type":"audio",
                  "payload-types":[
                    {
                      "name": "red", "id": "112", "channels": "2", "clockrate": "48000",
                      "parameters": { "null": "111/111" }
                    },
                    {
                      "name": "opus", "id": "111", "channels": "2", "clockrate": "48000",
                      "parameters": {"useinbandfec": "1", "minptime": "10" },
                      "rtcp-fbs": [{"type": "transport-cc"}]
                    }
                  ],
                  "rtp-hdrexts":[
                    { "uri":"urn:ietf:params:rtp-hdrext:ssrc-audio-level", "id":1 },
                    { "uri":"http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01", "id":5 }
                  ],
                  "extmap-allow-mixed":true
                },
                {
                  "type": "video",
                  "payload-types":[
                    {
                      "name": "VP8", "id": "100", "clockrate": "90000",
                      "parameters": {"x-google-start-bitrate": "800"},
                      "rtcp-fbs":[
                        { "type": "ccm", "subtype": "fir" },
                        { "type": "nack" },
                        { "type": "nack", "subtype": "pli" },
                        { "type": "transport-cc" }
                      ]
                    }
                  ],
                  "rtp-hdrexts":[
                    { "uri":"http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time", "id":3 },
                    { "uri":"http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01", "id":5 }
                  ],
                  "extmap-allow-mixed":true
                }
              ],
        transport: {
          transport: {
            candidates,
            // xmlns: "urn:xmpp:jingle:transports:ice-udp:1",
            xmlns: "urn:xmpp:jingle:apps:rtp:1",
            ufrag,
            pwd,
            "rtcp-mux": true,
            "web-sockets": [], // Optional if used
            fingerprints: [
              {
                fingerprint: fingerprint.hash,
                setup: fingerprint.setup || "active",
                hash: fingerprint.type
              }
            ]
          }
        },
        "capabilities": [ "source-names" ]
      }
    ],
    sources
  };
}

// let pc = new RTCPeerConnection({
//   iceServers: [{
//       urls: "stun:stun.l.google.com:19302",
//   },],
// });
/**
{
  urls: "stun:meet-jit-si-turnrelay.jitsi.net:443"
}
 */
// const pc = new RTCPeerConnection({
//   iceServers: [
//     {
//       urls: ["stun:meet-jit-si-turnrelay.jitsi.net:443"],
//     }
//   ]
// });

function App() {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [jvbResponseSDPOffer, setJvbResponseSDPOffer] = useState(null);
  const [jvb_sdp, setJvbSDPAnser] = useState(null);
  // async function createConference() {
  //   try {

  //     const res = await fetch(confURL, {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify(demo_request_body),
  //     });
  //     console.log(res);
  //     const data = await res.json();
  //     console.log(data);
  //     if (data) {
  //       setJvbResponse(data);
  //       const jvb_sdp = convertToSDPOffer(data);
  //       console.log(jvb_sdp);
  //       setJvbSDP(jvb_sdp);
  //       await pc.setRemoteDescription(
  //         new RTCSessionDescription({ type: "offer", sdp: jvb_sdp })
  //       );
  //       const answer = await pc.createAnswer();
  //       console.log(answer);
  //       await pc.setLocalDescription(answer);
  //     }
  //   } catch (error) {
  //     console.log(error);
  //   }
  // }

  // useEffect(() => {
  //   window.navigator.mediaDevices
  //     .getUserMedia({
  //       video: true,
  //       audio: true,
  //     })
  //     .then((stream) => {
  //       stream.getTracks().forEach(track => pc.addTrack(track, stream));
  //       setLocalStream(stream);
  //     });
  //   createConference();
  // }, []);
  let pc = new RTCPeerConnection({
    iceServers: [
      {
        urls: "stun:meet-jit-si-turnrelay.jitsi.net:443",
      },
      {
        urls: 'turn:meet-jit-si-turnrelay.jitsi.net:443',
        username: 'jvb',
        credential: 'Yl1iCAbM',
      },
    ],
  });
  useEffect(() => {
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
        stream.getTracks().forEach((track) => {
          console.log("Adding track:", track.kind);
          pc.addTrack(track, stream);
        });
        console.log("All transceivers:", pc.getTransceivers());
        setLocalStream(stream);
        console.log("---- we set the local stream ----");
        pc.ontrack = (event) => {
          const [remote] = event.streams;
          setRemoteStream(remote);
          console.log(stream);
          console.log("---- we get the remote stream ----");
        };
        const res = await fetch(confURL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(demo_request_body),
        });

        const data = await res.json();
        console.log("---- we get the colibri2 json response ----");
        console.log(data);
        const jvbsdp = convertToSDPOffer(data);
        console.log("---- we get the jvb_sdp string----");
        console.log(jvbsdp);
        setJvbResponseSDPOffer(jvbsdp);

        await pc.setRemoteDescription(
          new RTCSessionDescription({ type: "offer", sdp: jvbsdp })
        );

        console.log("---- setRemoteDescription done ----");
        // Create and set local answer
        const answer = await pc.createAnswer();
        console.log(answer);
        
        await pc.setLocalDescription(answer);
        const SDPtoJSONforColibri = convertSDPAnswerToCustomJSON(answer.sdp)
        setJvbSDPAnser(SDPtoJSONforColibri);
        console.log(SDPtoJSONforColibri);
        const res1 = await fetch(`http://127.0.0.1:8080/colibri/v2/conferences`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(SDPtoJSONforColibri),
        });
        console.log(res);
        const data1 = await res1.json();
        console.log(data1);
        console.log("---- setLocalDescription done ----");
        console.log("All transceivers:");

        pc.getTransceivers().forEach((t, index) => {
          console.log(
            `Transceiver[${index}]: mid=${t.mid}, kind=${t.receiver.track.kind}`
          );
        });
      } catch (error) {
        console.log(error);
      }
    }
    start();
  }, []);

  return (
    <>
      <h1>JVB Video Test</h1>
      <div>
        <div
          style={{
            display: "flex",
          }}
        >
          <Video stream={localStream} />
          <Video stream={remoteStream} />
        </div>
        <div></div>
      </div>
    </>
  );
}

export default App;
