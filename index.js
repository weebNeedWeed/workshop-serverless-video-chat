let localConnection;
let localStream;
let remoteStream;
let socket;

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get("room");

if (!roomId) {
  window.location.href = "lobby.html";
}

const config = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
};

const init = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
  document.getElementById("user1").srcObject = localStream;

  socket = new WebSocket(import.meta.env.VITE_WEBSOCKET_URL);

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

    if (message.type === "newParticipant") {
      await createOffer();
    }

    if (message.type === "offer") {
      await createAnswer(message.offer);
    }

    if (message.type === "answer") {
      await acceptAnswer(message.answer);
    }

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

  for (let track of localStream.getTracks()) {
    localConnection.addTrack(track, localStream);
  }

  remoteStream = new MediaStream();
  document.getElementById("user2").srcObject = remoteStream;

  localConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

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
