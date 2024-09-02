// Declare variables for use in multiple functions
let localConnection;
let localStream;
let remoteStream;
let socket;

// Get the roomId in the query string or redirect to the lobby if not provided
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get("room");
if (!roomId) {
  window.location.href = "lobby.html";
}

// Define the configure for the RTCPeerConnection
const config = {
  iceServers: [
    {
      // Here we use the STUN servers owned by Google
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
};

const init = async () => {
  // Get user media and display it in the local video element(#user1)
  // and create a local RTCPeerConnection
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
  document.getElementById("user1").srcObject = localStream;

  // Create a WebSocket connection to the server (API Gateway WebSocket)
  socket = new WebSocket(import.meta.env.VITE_WEBSOCKET_URI);

  // Make a request to the joinRoom route after the connection opened
  socket.onopen = () => {
    socket.send(
      JSON.stringify({
        action: "joinRoom",
        roomId,
      })
    );
  };

  socket.onmessage = async (event) => {
    const message = JSON.parse(event.data);

    // Create a new Offer and send it to the other participant when he/she newly joins
    if (message.type === "newParticipant") {
      await createOffer();
    }

    // Create a new answer upon receiving offer
    if (message.type === "offer") {
      await createAnswer(message.offer);
    }

    // Accept the answer upon receiving it
    if (message.type === "answer") {
      await acceptAnswer(message.answer);
    }

    // The participant receives new ICE Candidate and adds to the candidate list
    if (message.type === "candidate") {
      await localConnection.addIceCandidate(message.candidate);
    }
  };
};

const acceptAnswer = async (answer) => {
  await localConnection.setRemoteDescription(answer);
};

const createAnswer = async (offer) => {
  await createConnection();

  await localConnection.setRemoteDescription(offer);

  const answer = await localConnection.createAnswer();
  await localConnection.setLocalDescription(answer);

  // Send the answer to the user who created the offer.
  socket.send(
    JSON.stringify({
      action: "sendMsgToRoom",
      message: JSON.stringify({
        type: "answer",
        answer,
      }),
      roomId,
    })
  );
};

const createOffer = async () => {
  await createConnection();

  const offer = await localConnection.createOffer();
  await localConnection.setLocalDescription(offer);

  // Send the offer to the other user in the room and wait for the answer
  socket.send(
    JSON.stringify({
      action: "sendMsgToRoom",
      message: JSON.stringify({
        type: "offer",
        offer,
      }),
      roomId,
    })
  );
};

const createConnection = async () => {
  localConnection = new RTCPeerConnection(config);

  // Add the local stream to the connection and send the tracks to the other user
  for (let track of localStream.getTracks()) {
    localConnection.addTrack(track, localStream);
  }

  // Initialize remote stream to display the other user's video
  remoteStream = new MediaStream();
  document.getElementById("user2").srcObject = remoteStream;

  // Receive tracks from the other user, add it to the remote stream
  localConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  // If a user has new ICE Candidate, send it to the other user
  localConnection.onicecandidate = (event) => {
    if (event.candidate) {
      setTimeout(() => {
        socket.send(
          JSON.stringify({
            action: "sendMsgToRoom",
            message: JSON.stringify({
              type: "candidate",
              candidate: event.candidate,
            }),
            roomId,
          })
        );
      }, 100);
    }
  };
};

init();

const toggleMic = () => {
  const audioTrack = localStream.getAudioTracks()[0];
  if (audioTrack.enabled) {
    audioTrack.enabled = false;
    document.getElementById("mic").classList.add("bg-red");
  } else {
    audioTrack.enabled = true;
    document.getElementById("mic").classList.remove("bg-red");
  }
};

const toggleCam = () => {
  const videoTrack = localStream.getVideoTracks()[0];
  if (videoTrack.enabled) {
    videoTrack.enabled = false;
    document.getElementById("cam").classList.add("bg-red");
  } else {
    videoTrack.enabled = true;
    document.getElementById("cam").classList.remove("bg-red");
  }
};

document.getElementById("mic").onclick = toggleMic;
document.getElementById("cam").onclick = toggleCam;
