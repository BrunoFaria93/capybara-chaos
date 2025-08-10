import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler"; // Add this import
import { Socket } from "socket.io-client";

import Lobby from "./components/Lobby";
import Room from "./components/Room";
import Game from "./components/Game";

type Screen = "lobby" | "room" | "game";

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("lobby");
  const [roomId, setRoomId] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("");
  const [playerCharacter, setPlayerCharacter] = useState<string>("🐹");
  const [gameSocket, setGameSocket] = useState<Socket | null>(null);

  const handleCreateRoom = (id: string, name: string, character: string) => {
    setRoomId(id);
    setPlayerName(name);
    setPlayerCharacter(character);
    setCurrentScreen("room");
  };

  const handleJoinRoom = (id: string, name: string, character: string) => {
    setRoomId(id);
    setPlayerName(name);
    setPlayerCharacter(character);
    setCurrentScreen("room");
  };

  const handleStartGame = (socket: Socket) => {
    setGameSocket(socket);
    setCurrentScreen("game");
  };

  const handleBackToLobby = () => {
    setCurrentScreen("lobby");
    setRoomId("");
    setPlayerName("");
    setPlayerCharacter("🐹");
    setGameSocket(null);
  };

  const handleBackToRoom = () => {
    setCurrentScreen("room");
    setGameSocket(null);
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case "lobby":
        return <Lobby onCreate={handleCreateRoom} onJoin={handleJoinRoom} />;

      case "room":
        return (
          <Room
            roomId={roomId}
            playerName={playerName}
            playerCharacter={playerCharacter}
            onStart={handleStartGame}
            onBack={handleBackToLobby}
          />
        );

      case "game":
        return gameSocket ? (
          <Game
            roomId={roomId}
            playerName={playerName}
            socket={gameSocket}
            onExit={handleBackToRoom}
          />
        ) : null;

      default:
        return null;
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>{renderScreen()}</View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f8ff",
  },
});
