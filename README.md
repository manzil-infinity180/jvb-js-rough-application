Edit : `Status: Not working`

> I tried to send the all configuration details what described in the test, to post enpoint `colibri/v2/conferences` and then i get the response i take that response convert into the `SDP` using the `sdp-transform` and then i done the `setRemoteDescription` , created answer from client side set it into the `setLocalDescription` and also sending this at some other endpoints to colibri2


Update: `12 April` 
> Pull Request https://github.com/manzil-infinity180/jvb-js-rough-application/pull/1

> Changed some of logic, so i can see the ice candidate state from frontend, again i have problem with ice candidate how i can make it happy i guess i am sending the request body to wrong
  endpoint that could be the reason

> I see the old colibri1 which send the sdp answer for the patch but what i am doing ??

> making request to create conference and it return the ice information i converted into sdp offer and set into the setRemotedescription and then i created answer and converted into the colibri compatible request body sending to same post but on the same meetind and endpoint 
and then opening one for tab with new endpoint and doing the same

Edit : `8 April` - `Still not working`

https://github.com/user-attachments/assets/2406dd04-18b6-48f6-b422-b1d5d4abdd8d

Edit : `12 April` - `WIP`

https://github.com/user-attachments/assets/4112301d-dac6-456e-b1be-516a6e24a42c

<img width="1582" alt="Screenshot 2025-04-07 at 12 41 41 AM" src="https://github.com/user-attachments/assets/21886640-7d66-4782-80fe-410e8195dece" />

```js
Problem:

ICE connection state: new => checking => disconnected
Connection state: new => connecting => failed
Signaling state: new => stable
ICE Candidate pair: (not connected)
• ICE candidate grid

> need to take of this , because without this we can not set the stream back or it is also not gathering the ice too
> we also getting some 400 response (Not this case, we have some other)
```
<img width="1582" alt="Screenshot 2025-04-07 at 12 41 47 AM" src="https://github.com/user-attachments/assets/3b1fb640-f439-4a89-93c8-bc18ac827fee" />
<img width="1582" alt="Screenshot 2025-04-07 at 12 44 48 AM" src="https://github.com/user-attachments/assets/f9962ded-1c56-4215-9510-11a2fe728c6d" />






> This is the rough flow-diagram for the jvb-js 

```mermaid
sequenceDiagram
    participant JitsiClient
    participant Conference
    participant WebRTC
    participant Jitsi Videobridge

    JitsiClient->>Conference: new Conference(with all details)
    Conference->>Conference: initializeConference()
    Conference->>Jitsi Videobridge: POST /colibri/v2/conferences
    Jitsi Videobridge-->>Conference: Response with endpoints, sources
    Conference->>Conference: createSDPFromColibri2Response()
    Conference->>WebRTC: setRemoteDescription(offer)
    WebRTC->>WebRTC: createAnswer()
    WebRTC-->>Conference: SDP Answer
    Conference->>WebRTC: setLocalDescription(answer)
    Conference->>Jitsi Videobridge: PATCH /conference/v2/conferences/{meeting-id}

    Conference->>WebRTC: addTrack()
    WebRTC->>Conference: onicecandidate (ICE candidates)
    Conference->>Jitsi Videobridge: Send ICE candidates (PATCH)
    Jitsi Videobridge-->>Conference: Remote ICE candidates
    Conference->>WebRTC: addIceCandidate()
    
    Conference->>Conference: handleParticipantJoined()
    Conference->>JitsiClient: triggerEvent('participantJoined')

    Jitsi Videobridge-->>Conference: Remote tracks
    WebRTC-->>Conference: ontrack event
    Conference->>Conference: handleRemoteTrack()
    Conference->>JitsiClient: triggerEvent('trackAdded')

    Conference->>Conference: setAudioMuted(true)

    Conference->>Conference: Handle leaveConfernce() & handleDisconnect()
    Conference->>WebRTC: close connection
    Conference->>Jitsi Videobridge: Close Connection (Expire)
    Conference->>JitsiClient: triggerEvent('disconnected')
```
