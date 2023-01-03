import React, { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import Peer from "simple-peer";
import styled from "styled-components";
import { useParams } from "react-router-dom";

const Container = styled.div`
  height: 100vh;
  width: 20%;
`;

const StyledVideo = styled.video`
  width: 100%;
  position: static;
  border-radius: 10px;
  overflow: hidden;
  margin: 1px;
  border: 5px solid gray;
`;

const Video = (props) => {
  const ref = useRef();
  useEffect(() => {
    props.peer.on("stream", async (stream) => {
      ref.current.srcObject = await stream;
    });
    ref.current.addEventListener("loadedmetadata", () => {
      ref.current.play();
      console.log("loaded");
    });
  }, [props.peer]);

  return <StyledVideo playsInline controls ref={ref} />;
};

const Room = (props) => {
  const { id } = useParams();
  const [peers, setPeers] = useState([]);
  const [audioFlag, setAudioFlag] = useState(true);
  const [videoFlag, setVideoFlag] = useState(true);
  const [userUpdate, setUserUpdate] = useState([]);
  const socket = useMemo(
    () =>
      io("https://socket-sever.glitch.me", {
        transports: ["websocket", "polling"],
      }),
    []
  );
  const userVideo = useRef();
  const vidTest = useRef();
  const peersRef = useRef([]);
  const roomID = id;
  const [showVideo, setShowVideo] = useState(true);
  const videoConstraints = {
    minAspectRatio: 1.333,
    minFrameRate: 60,
    height: window.innerHeight / 1.8,
    width: window.innerWidth / 2,
  };
  const [disabled, setDisabled] = useState(false);

  function createStream() {
    setDisabled(true);
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        userVideo.current.srcObject = stream;
        socket.emit("join room", roomID);
        socket.on("all users", (users) => {
          const peers = [];
          users.forEach((userID) => {
            const peer = createPeer(userID, socket.id, stream);
            peersRef.current.push({
              peerID: userID,
              peer,
            });
            peers.push({
              peerID: userID,
              peer,
            });
          });
          setPeers(peers);
        });
        socket.on("user joined", (payload) => {
          console.log("==", payload);
          console.log(peers);
          const peer = addPeer(payload.signal, payload.callerID, stream);
          peersRef.current.push({
            peerID: payload.callerID,
            peer,
          });
          const peerObj = {
            peer,
            peerID: payload.callerID,
          };
          setPeers((users) => [...users, peerObj]);
        });

        socket.on("user left", (id) => {
          const peerObj = peersRef.current.find((p) => p.peerID === id);
          if (peerObj) {
            peerObj.peer.destroy();
          }
          const peers = peersRef.current.filter((p) => p.peerID !== id);
          peersRef.current = peers;
          setPeers(peers);
        });

        socket.on("receiving returned signal", (payload) => {
          const item = peersRef.current.find((p) => p.peerID === payload.id);
          item.peer.signal(payload.signal);
        });

        socket.on("change", (payload) => {
          setUserUpdate(payload);
        });
      });
  }

  function createPeer(userToSignal, callerID, stream) {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
    });

    peer.on("signal", (signal) => {
      socket.emit("sending signal", {
        userToSignal,
        callerID,
        signal,
      });
    });

    return peer;
  }

  function addPeer(incomingSignal, callerID, stream) {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
    });

    peer.on("signal", (signal) => {
      socket.emit("returning signal", { signal, callerID });
    });

    peer.signal(incomingSignal);

    return peer;
  }

  return (
    <Container>
      <StyledVideo muted ref={userVideo} autoPlay playsInline />
      <button
        onClick={() => {
          if (userVideo.current.srcObject) {
            userVideo.current.srcObject.getTracks().forEach(function (track) {
              if (track.kind === "video") {
                if (track.enabled) {
                  socket.emit("change", [
                    ...userUpdate,
                    {
                      id: socket.id,
                      videoFlag: false,
                      audioFlag,
                    },
                  ]);
                  track.enabled = false;
                  setVideoFlag(false);
                } else {
                  socket.emit("change", [
                    ...userUpdate,
                    {
                      id: socket.id,
                      videoFlag: true,
                      audioFlag,
                    },
                  ]);
                  track.enabled = true;
                  setVideoFlag(true);
                }
              }
            });
          }
        }}
      >
        {showVideo ? "off" : "on"} video
      </button>
      <button
        disabled={disabled}
        onClick={() => {
          createStream();
          console.log(userUpdate);
        }}
      >
        Create Stream
      </button>

      {peers.map((peer, index) => {
        console.log(peer.peer);
        return (
          <div key={peer.peerID}>
            <Video peer={peer.peer} />

            <p>{peer.peerID}</p>
          </div>
        );
      })}
    </Container>
  );
};

export default Room;
