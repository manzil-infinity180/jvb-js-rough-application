
export const demo_request_body = {
  "meeting-id": "beccf2ed-5441-4bfe-96d6-f0f3a6796378",
  name: "torture819371@conference.beta.meet.jit.si",
  create: true,
  endpoints: [
    {
      create: true,
      id: "79f0273e",
      "stats-id": "Garett-w1o",
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
            {
              name: "VP9",
              id: "101",
              clockrate: "90000",
              parameters: { "x-google-start-bitrate": "800" },
              "rtcp-fbs": [
                { type: "ccm", subtype: "fir" },
                { type: "nack" },
                { type: "nack", subtype: "pli" },
                { type: "transport-cc" },
              ],
            },
            {
              name: "rtx",
              id: "96",
              clockrate: "90000",
              parameters: { apt: "100" },
              "rtcp-fbs": [
                { type: "ccm", subtype: "fir" },
                { type: "nack" },
                { type: "nack", subtype: "pli" },
              ],
            },
            {
              name: "rtx",
              id: "97",
              clockrate: "90000",
              parameters: { apt: "101" },
              "rtcp-fbs": [
                { type: "ccm", subtype: "fir" },
                { type: "nack" },
                { type: "nack", subtype: "pli" },
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
export const confURL = "http://127.0.0.1:8080/colibri/v2/conferences";
export async function createConference() {
  try {
    const res = await fetch(confURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(demo_request_body),
    });
    console.log(res);
    const data = await res.json();
    console.log(data);
    const jvb_sdp = convertToSDPOffer(data)
    console.log(jvb_sdp);
    return data;
  } catch (error) {
    console.log(error);
  }
}



// meet-jit-si-turnrelay.jitsi.net:443
let pc = new RTCPeerConnection({
  iceServers: [{
      urls: "stun:stun.l.google.com:19302",
  },],
});
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

export async function helloJVB() {
  // Add local media
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  stream.getTracks().forEach(track => pc.addTrack(track, stream));

  // Show local video
  document.getElementById('localVideo').srcObject = stream;
  // await expireConference();
  const json_response = createConference();
  console.log(json_response);
//   const jvbSdp = convertToSDPOffer(json_response);
//   console.log(jvbSdp);
  // get the sdp here

  // Set remote description (JVB offer converted to SDP)
  await pc.setRemoteDescription(
    new RTCSessionDescription({ type: "offer", sdp: jvbSdp })
  );

  // Create and set local description
  const answer = await pc.createAnswer();
  console.log(answer);
  await pc.setLocalDescription(answer);

  // convert the answer sdp to json for our jvb

  // // Send answer (converted to Colibri JSON) to JVB
  // await patchToColibri(confId, endpointId, sdpToColibri(answer.sdp));

  // // Receive remote media
  // pc.ontrack = ({ streams: [remoteStream] }) => {
  //   document.getElementById('remoteVideo').srcObject = remoteStream;
  // };
}

helloJVB();