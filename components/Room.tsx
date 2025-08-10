// components/Room.tsx
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Button,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import io, { Socket } from "socket.io-client";

const SERVER = "http://192.168.18.187:3000"; // <-- troque para seu servidor

interface Player {
  id: string;
  name: string;
  x?: number;
  y?: number;
  ready?: boolean;
  character: string;
}

interface Scenario {
  id: string;
  name: string;
  background: string;
  groundY: number;
}

interface RoomData {
  players: Record<string, Player>;
  obstacles: any[];
  phase: "waiting" | "selecting" | "building" | "playing";
  scenario: Scenario | null;
  host: string;
}

export default function Room({
  roomId,
  playerName,
  playerCharacter,
  onStart,
  onBack,
}: {
  roomId: string;
  playerName: string;
  playerCharacter: string;
  onStart: (socket: Socket) => void;
  onBack: () => void;
}) {
  const [room, setRoom] = useState<RoomData | null>(null);
  const [connected, setConnected] = useState(false);
  const [scenarios] = useState<Scenario[]>([
    {
      id: "volcano",
      name: "🌋 Vulcão Ardente",
      background: "#ff4444",
      groundY: 150,
    },
    {
      id: "farm",
      name: "🚜 Fazenda Maluca",
      background: "#44aa44",
      groundY: 180,
    },
    {
      id: "city",
      name: "🏙️ Cidade Caótica",
      background: "#4444aa",
      groundY: 200,
    },
    {
      id: "space",
      name: "🚀 Estação Espacial",
      background: "#220033",
      groundY: 120,
    },
    {
      id: "jungle",
      name: "🌿 Selva Selvagem",
      background: "#228844",
      groundY: 160,
    },
  ]);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const s = io(SERVER);
    socketRef.current = s;

    s.on("connect", () => {
      setConnected(true);
      // Primeiro tenta entrar, se não conseguir, cria a sala
      s.emit("joinRoom", { roomId, name: playerName }, (res: any) => {
        if (!res.ok) {
          if (res.error === "no_room") {
            s.emit("createRoom", { roomId, name: playerName }, (cres: any) => {
              if (!cres.ok) {
                Alert.alert("Erro", "Não foi possível criar a sala");
                onBack();
              }
            });
          } else {
            Alert.alert("Erro", "Não foi possível entrar na sala");
            onBack();
          }
        }
      });

      // Atualizar personagem após conectar
      setTimeout(() => {
        s.emit("changeCharacter", { roomId, character: playerCharacter });
      }, 500);
    });

    s.on("disconnect", () => {
      setConnected(false);
    });

    s.on("roomUpdate", (r: RoomData) => {
      console.log("Room update:", r);
      setRoom(r);
    });

    s.on("obstaclesUpdate", (obs: any[]) =>
      setRoom((prev) => (prev ? { ...prev, obstacles: obs } : prev))
    );

    s.on("scenarioSelection", () => {
      setRoom((prev) => (prev ? { ...prev, phase: "selecting" } : prev));
    });

    s.on("buildingPhase", ({ scenario }: { scenario: Scenario }) => {
      setRoom((prev) =>
        prev ? { ...prev, phase: "building", scenario } : prev
      );
    });

    s.on("roundStarted", () => {
      // Iniciar o jogo
      onStart(s);
    });

    s.on("roomReset", () => {
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              phase: "waiting",
              scenario: null,
              obstacles: [],
            }
          : prev
      );
    });

    s.on("newHost", ({ hostId }: { hostId: string }) => {
      setRoom((prev) => (prev ? { ...prev, host: hostId } : prev));
    });

    return () => {
      //   s.emit("leaveRoom", { roomId });
      //   s.disconnect();
    };
  }, [roomId, playerName]);

  const isHost = () => {
    return room?.host === socketRef.current?.id;
  };

  const getPlayerCount = () => {
    return room ? Object.keys(room.players).length : 0;
  };

  const startScenarioSelection = () => {
    if (!isHost()) {
      Alert.alert("Aviso", "Apenas o host pode iniciar a seleção de cenário");
      return;
    }

    // if (getPlayerCount() < 2) {
    //   Alert.alert("Aviso", "Precisa de pelo menos 2 jogadores para começar");
    //   return;
    // }

    socketRef.current?.emit("startScenarioSelection", { roomId });
  };

  const selectScenario = (scenario: Scenario) => {
    socketRef.current?.emit("selectScenario", { roomId, scenario });
  };

  const startRound = () => {
    if (!isHost()) {
      Alert.alert("Aviso", "Apenas o host pode iniciar o round");
      return;
    }

    console.log(
      "🚀 Room enviando startRound, socket conectado:",
      socketRef.current?.connected
    );
    console.log("🚀 Socket ID:", socketRef.current?.id);

    socketRef.current?.emit("startRound", { roomId });
    onStart(socketRef.current!);
  };

  const resetRoom = () => {
    if (!isHost()) {
      Alert.alert("Aviso", "Apenas o host pode resetar a sala");
      return;
    }

    Alert.alert(
      "Resetar Sala",
      "Tem certeza que deseja resetar a sala? Todos os obstáculos serão removidos.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Resetar",
          onPress: () => socketRef.current?.emit("resetRoom", { roomId }),
        },
      ]
    );
  };

  const renderWaitingPhase = () => (
    <View style={styles.phaseContainer}>
      <Text style={styles.phaseTitle}>⏳ Aguardando Jogadores</Text>
      <Text style={styles.instruction}>
        {isHost() ? "Você é o host! " : ""}
        Aguardando mais jogadores para começar...
      </Text>

      {/* {isHost() && getPlayerCount() >= 2 && (
        <TouchableOpacity
          style={styles.hostButton}
          onPress={startScenarioSelection}
        >
          <Text style={styles.hostButtonText}>🎮 Começar Jogo</Text>
        </TouchableOpacity>
      )} */}
      {isHost() && (
        <TouchableOpacity
          style={styles.hostButton}
          onPress={startScenarioSelection}
        >
          <Text style={styles.hostButtonText}>🎮 Começar Jogo</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderSelectingPhase = () => (
    <View style={styles.phaseContainer}>
      <Text style={styles.phaseTitle}>🗺️ Escolha o Cenário</Text>
      <Text style={styles.instruction}>
        {isHost()
          ? "Escolha o cenário para esta partida:"
          : "O host está escolhendo o cenário..."}
      </Text>

      {isHost() && (
        <ScrollView style={styles.scenarioList}>
          {scenarios.map((scenario) => (
            <TouchableOpacity
              key={scenario.id}
              style={[
                styles.scenarioOption,
                { backgroundColor: scenario.background },
              ]}
              onPress={() => selectScenario(scenario)}
            >
              <Text style={styles.scenarioText}>{scenario.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );

  const renderBuildingPhase = () => (
    <View style={styles.phaseContainer}>
      <Text style={styles.phaseTitle}>🔨 Fase de Construção</Text>
      <Text style={styles.scenarioName}>Cenário: {room?.scenario?.name}</Text>
      <Text style={styles.instruction}>
        Coloquem obstáculos para dificultar os outros jogadores!
      </Text>
      <Text style={styles.obstacleCount}>
        Obstáculos colocados: {room?.obstacles.length || 0}
      </Text>

      {isHost() && (
        <TouchableOpacity style={styles.hostButton} onPress={startRound}>
          <Text style={styles.hostButtonText}>▶️ Iniciar Round</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const getPhaseDisplay = () => {
    switch (room?.phase) {
      case "selecting":
        return renderSelectingPhase();
      case "building":
        return renderBuildingPhase();
      case "playing":
        return (
          <View style={styles.phaseContainer}>
            <Text style={styles.phaseTitle}>🎮 Jogo em Andamento</Text>
          </View>
        );
      default:
        return renderWaitingPhase();
    }
  };

  if (!connected) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>🔄 Conectando ao servidor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.roomTitle}>🏠 Sala: {roomId}</Text>
          <Text style={styles.playerInfo}>
            {playerCharacter} {playerName} {isHost() && "👑"}
          </Text>
        </View>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Voltar</Text>
        </TouchableOpacity>
      </View>

      {/* Status da conexão */}
      <View
        style={[
          styles.statusBar,
          { backgroundColor: connected ? "#4CAF50" : "#f44336" },
        ]}
      >
        <Text style={styles.statusText}>
          {connected ? "🟢 Conectado" : "🔴 Desconectado"}
        </Text>
      </View>

      {/* Lista de jogadores */}
      <View style={styles.playersSection}>
        <Text style={styles.sectionTitle}>
          👥 Jogadores ({getPlayerCount()})
        </Text>
        <FlatList
          data={room ? Object.values(room.players) : []}
          keyExtractor={(item: Player) => item.id}
          renderItem={({ item }: { item: Player }) => (
            <View style={styles.playerItem}>
              <Text style={styles.playerCharacter}>{item.character}</Text>
              <Text style={styles.playerName}>
                {item.name}
                {item.id === room?.host && " 👑"}
                {item.id === socketRef.current?.id && " (você)"}
              </Text>
              {item.ready && <Text style={styles.readyIndicator}>✅</Text>}
            </View>
          )}
          horizontal
          showsHorizontalScrollIndicator={false}
        />
      </View>

      {/* Fase atual do jogo */}
      {getPhaseDisplay()}

      {/* Botões do host */}
      {isHost() && room?.phase === "waiting" && (
        <View style={styles.hostControls}>
          <TouchableOpacity style={styles.resetButton} onPress={resetRoom}>
            <Text style={styles.resetButtonText}>🔄 Resetar Sala</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f8ff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f8ff",
  },
  loadingText: {
    fontSize: 18,
    color: "#666",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  roomTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2c5530",
  },
  playerInfo: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  backButton: {
    backgroundColor: "#f44336",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  backButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  statusBar: {
    padding: 8,
    alignItems: "center",
  },
  statusText: {
    color: "white",
    fontWeight: "bold",
  },
  playersSection: {
    padding: 20,
    backgroundColor: "white",
    marginTop: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#2c5530",
  },
  playerItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    padding: 12,
    borderRadius: 8,
    marginRight: 10,
    minWidth: 120,
  },
  playerCharacter: {
    fontSize: 20,
    marginRight: 8,
  },
  playerName: {
    fontSize: 14,
    flex: 1,
  },
  readyIndicator: {
    marginLeft: 8,
  },
  phaseContainer: {
    flex: 1,
    padding: 20,
  },
  phaseTitle: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
    color: "#2c5530",
  },
  scenarioName: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 10,
    color: "#666",
  },
  instruction: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    color: "#666",
    lineHeight: 22,
  },
  obstacleCount: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    color: "#666",
  },
  hostButton: {
    backgroundColor: "#4CAF50",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  hostButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  scenarioList: {
    maxHeight: 300,
  },
  scenarioOption: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: "center",
  },
  scenarioText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  hostControls: {
    padding: 20,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },
  resetButton: {
    backgroundColor: "#FF9800",
    padding: 12,
    borderRadius: 6,
    alignItems: "center",
  },
  resetButtonText: {
    color: "white",
    fontWeight: "bold",
  },
});
