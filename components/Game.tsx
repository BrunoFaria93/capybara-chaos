import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Button,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
  ScrollView,
  Alert,
  Modal,
} from "react-native";
import {
  PanGestureHandler,
  TapGestureHandler,
  State,
} from "react-native-gesture-handler";
import { Socket } from "socket.io-client";

interface Obstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  ownerId: string;
  type:
    | "spike"
    | "platform"
    | "spring"
    | "hammer"
    | "saw"
    | "cannon"
    | "wall"
    | "crossbow";
}

interface Projectile {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  dir: 1 | -1;
  type: "arrow";
}

interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  character: string;
  points?: number;
}

interface GameProps {
  roomId: string;
  playerName: string;
  socket: Socket;
  onExit: () => void;
}

interface Scenario {
  id: string;
  name: string;
  background: string;
  groundY: number;
}

const scenarios: Scenario[] = [
  {
    id: "volcano",
    name: "Vulcão Ardente",
    background: "#ff4444",
    groundY: 150,
  },
  { id: "farm", name: "Fazenda Maluca", background: "#44aa44", groundY: 180 },
  { id: "city", name: "Cidade Caótica", background: "#4444aa", groundY: 200 },
  {
    id: "space",
    name: "Estação Espacial",
    background: "#220033",
    groundY: 120,
  },
  { id: "jungle", name: "Selva Selvagem", background: "#228844", groundY: 160 },
];

const { width, height } = Dimensions.get("window");
const levelWidth = 2000;

export default function Game({
  roomId,
  playerName,
  socket,
  onExit,
}: GameProps) {
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [gamePhase, setGamePhase] = useState<
    | "waiting"
    | "selecting"
    | "building"
    | "itemSelection"
    | "placing"
    | "waitingForOthers"
    | "playing"
  >("waiting");
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(
    null
  );
  const [showObstacleMenu, setShowObstacleMenu] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [availableObstacles] = useState<Obstacle["type"][]>([
    "spike",
    "platform",
    "spring",
    "hammer",
    "saw",
    "cannon",
    "wall",
    "crossbow",
  ]);
  const [buildingMode, setBuildingMode] = useState(false);
  const [selectedObstacleType, setSelectedObstacleType] = useState<
    Obstacle["type"] | null
  >(null);
  const [disabledItems, setDisabledItems] = useState<Set<string>>(new Set());
  const [remainingTime, setRemainingTime] = useState(15);
  const [draggingObstacle, setDraggingObstacle] = useState<{
    type: Obstacle["type"];
    x: number;
    y: number;
  } | null>(null);
  const [roundCountdown, setRoundCountdown] = useState(120);
  const [roundNumber, setRoundNumber] = useState(1);
  const [gameWinner, setGameWinner] = useState<string | null>(null);
  const [isDead, setIsDead] = useState(false);
  const [reachedFlag, setReachedFlag] = useState(false);
  const [isHost, setIsHost] = useState(false);

  const posRef = useRef({ x: width / 2, y: height - 100 });
  const [joystickPosition, setJoystickPosition] = useState({ x: 0, y: 0 });
  const joystickRef = useRef({ x: 0, y: 0 });
  const [isJoystickActive, setIsJoystickActive] = useState(false);
  const [isGrounded, setIsGrounded] = useState(false);
  const [jumpCount, setJumpCount] = useState(0);
  const velocityRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef<number | null>(null);
  const jumpTapRef = useRef(null);
  const panGestureRef = useRef(null);
  const initialDragPos = useRef({ x: 0, y: 0 });
  const [cameraOffset, setCameraOffset] = useState(0);
  const lastUpdateRef = useRef<number>(0);

  const GRAVITY = 0.8;
  const JUMP_FORCE = -15;
  const MOVE_SPEED = 5;
  const MAX_FALL_SPEED = 12;
  const FRICTION = 0.8;
  const WALL_JUMP_FORCE = 12;

  // PRINCIPAIS CORREÇÕES: Listeners de socket mais robustos e com logs detalhados
  useEffect(() => {
    console.log(
      "🎮 [CLIENTE] Configurando listeners do socket, ID:",
      socket.id
    );
    console.log("🎮 [CLIENTE] Sala atual:", roomId);

    socket.on("roomUpdate", (roomData: any) => {
      console.log("🏠 [CLIENTE] roomUpdate recebido:", {
        fase: roomData.phase,
        jogadores: Object.keys(roomData.players || {}).length,
        cenario: roomData.scenario?.name || "nenhum",
        host: roomData.host,
        isHost: roomData.host === socket.id,
        players: roomData.players,
      });

      // Atualizar jogadores
      if (roomData.players) {
        console.log("👥 [CLIENTE] Atualizando jogadores:", roomData.players);
        setPlayers(roomData.players);
      }

      // Atualizar fase
      if (roomData.phase) {
        console.log(
          `🔄 [CLIENTE] Mudando fase: ${gamePhase} → ${roomData.phase}`
        );
        setGamePhase(roomData.phase);
      }

      // Atualizar cenário
      if (roomData.scenario) {
        console.log(
          `🌍 [CLIENTE] Cenário atualizado: ${roomData.scenario.name}`
        );
        setSelectedScenario(roomData.scenario);
      }

      // Atualizar status de host
      if (roomData.host) {
        const isPlayerHost = roomData.host === socket.id;
        console.log(
          `👑 [CLIENTE] Status de host: ${isPlayerHost ? "SIM" : "NÃO"}`
        );
        setIsHost(isPlayerHost);
      }

      // Atualizar obstáculos
      if (roomData.obstacles) {
        setObstacles(roomData.obstacles);
      }
    });

    socket.on("playerMoved", (playerUpdate: Player) => {
      console.log("🚶 [CLIENTE] playerMoved recebido:", playerUpdate);
      setPlayers((prev) => {
        const updated = { ...prev, [playerUpdate.id]: playerUpdate };
        console.log("👥 [CLIENTE] Estado players atualizado:", updated);
        return updated;
      });
    });

    socket.on(
      "roundStarted",
      (data: {
        obstacles: Obstacle[];
        scenario?: Scenario;
        players: Record<string, Player>;
      }) => {
        console.log("🚀 [CLIENTE] roundStarted recebido:", {
          obstaculos: data.obstacles?.length || 0,
          jogadores: Object.keys(data.players || {}).length,
          cenario: data.scenario?.name || "nenhum",
        });

        setObstacles(data.obstacles || []);
        if (data.scenario) setSelectedScenario(data.scenario);
        if (data.players) setPlayers(data.players);
        setGamePhase("itemSelection");
        setDisabledItems(new Set());
        console.log("🔄 [CLIENTE] Forçando transição para itemSelection");
      }
    );

    socket.on("scenarioSelection", () => {
      console.log("📋 [CLIENTE] Evento scenarioSelection recebido");
      setGamePhase("selecting");
    });

    socket.on("buildingPhase", (data: { scenario: Scenario }) => {
      console.log("🔧 [CLIENTE] buildingPhase recebido:", data.scenario.name);
      setGamePhase("building");
      setSelectedScenario(data.scenario);
      setBuildingMode(true);
    });

    socket.on("obstacleAdded", (obstacle: Obstacle) => {
      console.log("🔧 [CLIENTE] obstacleAdded:", obstacle.type);
      setObstacles((prev) => [...prev, obstacle]);
    });

    socket.on("itemTaken", ({ itemType }: { itemType: string }) => {
      console.log("🎯 [CLIENTE] Item tomado:", itemType);
      setDisabledItems((prev) => new Set([...prev, itemType]));
    });

    socket.on("startPlaying", () => {
      console.log("🎮 [CLIENTE] startPlaying recebido");
      setGamePhase("playing");
    });

    socket.on("projectilesUpdate", (projs: Projectile[]) => {
      setProjectiles(projs);
    });

    socket.on("roundEnd", (data: { newPoints: Record<string, number> }) => {
      console.log("🏁 [CLIENTE] roundEnd recebido");
      setPlayers((prev) => {
        const updated = { ...prev };
        for (const id in data.newPoints) {
          if (updated[id]) {
            updated[id].points = (updated[id].points || 0) + data.newPoints[id];
          }
        }
        return updated;
      });
      setIsDead(false);
      setReachedFlag(false);
      setGamePhase("itemSelection");
      setRoundNumber((prev) => prev + 1);
      // Reset positions
      posRef.current = {
        x: width / 2,
        y: height - (selectedScenario?.groundY || 150),
      };
    });

    socket.on("gameWinner", ({ winnerId }: { winnerId: string }) => {
      const winnerName = players[winnerId]?.name || "Desconhecido";
      console.log("🏆 [CLIENTE] Vencedor:", winnerName);
      setGameWinner(winnerName);
    });

    return () => {
      console.log("🧹 [CLIENTE] Removendo listeners do socket");
      socket.off("roomUpdate");
      socket.off("roundStarted");
      socket.off("scenarioSelection");
      socket.off("buildingPhase");
      socket.off("playerMoved");
      socket.off("obstacleAdded");
      socket.off("itemTaken");
      socket.off("startPlaying");
      socket.off("projectilesUpdate");
      socket.off("roundEnd");
      socket.off("gameWinner");
    };
  }, [socket, roomId]); // Dependências mínimas essenciais

  // Timer para seleção de itens
  useEffect(() => {
    if (gamePhase === "itemSelection") {
      console.log("⏰ [CLIENTE] Iniciando timer de seleção de itens");
      setShowItemModal(true);
      setRemainingTime(15);

      const intervalId = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev <= 1) {
            setShowItemModal(false);
            socket.emit("skipItemSelection", { roomId });
            setGamePhase("waitingForOthers");
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(intervalId);
    }
  }, [gamePhase, socket, roomId]);

  // Timer do round
  useEffect(() => {
    if (gamePhase === "playing") {
      const intervalId = setInterval(() => {
        setRoundCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(intervalId);
    }
  }, [gamePhase]);

  // Physics loop
  useEffect(() => {
    if (gamePhase !== "playing") return;

    const updatePhysics = () => {
      const groundY = selectedScenario?.groundY || 150;
      const floorY = height - groundY;
      const currentJoystick = joystickRef.current;
      const horizontalInput = currentJoystick.x / 40;

      if (isDead || reachedFlag) {
        velocityRef.current.x = 0;
      } else if (Math.abs(horizontalInput) > 0.1) {
        velocityRef.current.x = horizontalInput * MOVE_SPEED;
      } else {
        velocityRef.current.x *= FRICTION;
      }

      velocityRef.current.y += GRAVITY;
      if (velocityRef.current.y > MAX_FALL_SPEED)
        velocityRef.current.y = MAX_FALL_SPEED;

      posRef.current.x += velocityRef.current.x;
      posRef.current.y += velocityRef.current.y;

      if (posRef.current.y >= floorY - 30) {
        posRef.current.y = floorY - 30;
        velocityRef.current.y = 0;
        setIsGrounded(true);
        setJumpCount(0);
      } else {
        setIsGrounded(false);
      }

      if (posRef.current.x <= 0) {
        posRef.current.x = 0;
        velocityRef.current.x = Math.abs(velocityRef.current.x) * 0.7;
      } else if (posRef.current.x >= levelWidth - 30) {
        posRef.current.x = levelWidth - 30;
        velocityRef.current.x = -Math.abs(velocityRef.current.x) * 0.7;
      }

      // Obstacle collisions
      obstacles.forEach((obstacle) => {
        if (
          posRef.current.x < obstacle.x + obstacle.width &&
          posRef.current.x + 30 > obstacle.x &&
          posRef.current.y < obstacle.y + obstacle.height &&
          posRef.current.y + 30 > obstacle.y
        ) {
          switch (obstacle.type) {
            case "spring":
              velocityRef.current.y = JUMP_FORCE * 1.5;
              setJumpCount(0);
              break;
            case "spike":
              if (!isDead) {
                setIsDead(true);
                socket.emit("playerDied", { roomId });
              }
              velocityRef.current.x = posRef.current.x < obstacle.x ? -8 : 8;
              break;
            case "saw":
              if (!isDead) {
                setIsDead(true);
                socket.emit("playerDied", { roomId });
              }
              break;
            case "platform":
            case "wall":
              const playerCenterX = posRef.current.x + 15;
              const playerCenterY = posRef.current.y + 15;
              const obstacleCenterX = obstacle.x + obstacle.width / 2;
              const obstacleCenterY = obstacle.y + obstacle.height / 2;

              const dx = playerCenterX - obstacleCenterX;
              const dy = playerCenterY - obstacleCenterY;

              if (Math.abs(dx) > Math.abs(dy)) {
                if (dx > 0) {
                  posRef.current.x = obstacle.x + obstacle.width;
                  velocityRef.current.x = WALL_JUMP_FORCE;
                } else {
                  posRef.current.x = obstacle.x - 30;
                  velocityRef.current.x = -WALL_JUMP_FORCE;
                }
              } else {
                if (dy > 0) {
                  posRef.current.y = obstacle.y + obstacle.height;
                  velocityRef.current.y = 0;
                } else {
                  posRef.current.y = obstacle.y - 30;
                  velocityRef.current.y = 0;
                  setIsGrounded(true);
                  setJumpCount(0);
                }
              }
              break;
          }
        }
      });

      // Projectile collisions
      projectiles.forEach((proj) => {
        if (
          posRef.current.x < proj.x + proj.width &&
          posRef.current.x + 30 > proj.x &&
          posRef.current.y < proj.y + proj.height &&
          posRef.current.y + 30 > proj.y
        ) {
          if (!isDead) {
            setIsDead(true);
            socket.emit("playerDied", { roomId });
          }
        }
      });

      // Flag collision
      const flag = {
        x: levelWidth - 60,
        y: floorY - 50,
        width: 30,
        height: 50,
      };
      if (
        !reachedFlag &&
        posRef.current.x < flag.x + flag.width &&
        posRef.current.x + 30 > flag.x &&
        posRef.current.y < flag.y + flag.height &&
        posRef.current.y + 30 > flag.y
      ) {
        setReachedFlag(true);
        socket.emit("reachedFlag", { roomId });
      }

      // Camera follow
      const newOffset = Math.max(
        0,
        Math.min(posRef.current.x - width / 2, levelWidth - width)
      );
      setCameraOffset(newOffset);

      // Update player position
      const now = Date.now();
      const socketId = socket.id;
      if (socketId && now - lastUpdateRef.current > 100) {
        setPlayers((prev) => ({
          ...prev,
          [socketId]: {
            ...prev[socketId],
            x: posRef.current.x,
            y: posRef.current.y,
          },
        }));

        socket.emit("playerUpdate", {
          roomId,
          x: posRef.current.x,
          y: posRef.current.y,
        });
        lastUpdateRef.current = now;
        console.log("📡 [CLIENTE] Enviando playerUpdate:", {
          socketId,
          x: posRef.current.x,
          y: posRef.current.y,
        });
      }

      animationRef.current = requestAnimationFrame(updatePhysics);
    };

    animationRef.current = requestAnimationFrame(updatePhysics);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [
    gamePhase,
    selectedScenario,
    obstacles,
    projectiles,
    isDead,
    reachedFlag,
    socket,
    roomId,
  ]);

  useEffect(() => {
    if (!socket.connected) {
      console.log("⚠️ [CLIENTE] Socket desconectado, tentando reconectar...");
      socket.connect();
    }

    // Solicitar atualização inicial do estado da sala
    socket.emit("requestRoomUpdate", { roomId }, (response: any) => {
      console.log("🏠 [CLIENTE] Resposta requestRoomUpdate:", response);
      if (response.ok && response.room) {
        setPlayers(response.room.players);
        setGamePhase(response.room.phase);
        setSelectedScenario(response.room.scenario);
        setIsHost(response.room.host === socket.id);
        setObstacles(response.room.obstacles || []);
      }
    });

    socket.on("connect", () => {
      console.log("🔌 [CLIENTE] Socket reconectado:", socket.id);
      socket.emit("requestRoomUpdate", { roomId });
    });

    return () => {
      socket.off("connect");
    };
  }, [socket, roomId]);

  const jump = () => {
    if (isDead || reachedFlag) return;
    if (isGrounded || jumpCount < 2) {
      velocityRef.current.y = JUMP_FORCE;
      setJumpCount((prev) => prev + 1);
      if (isGrounded) setIsGrounded(false);
      console.log("🦘 [CLIENTE] Jump triggered!");
    }
  };

  // RENDERIZAÇÃO: Fase de espera
  const renderWaitingPhase = () => {
    console.log("🎯 [CLIENTE] Renderizando waiting phase");
    console.log("🎯 [CLIENTE] Players:", Object.keys(players).length, players);
    console.log("🎯 [CLIENTE] Is Host:", isHost);

    return (
      <View style={styles.waitingContainer}>
        <Text style={styles.title}>Sala: {roomId}</Text>
        <Text style={styles.subtitle}>
          Jogadores na sala ({Object.keys(players).length}):
        </Text>
        {Object.values(players).length === 0 ? (
          <Text style={styles.waitingLabel}>Nenhum jogador encontrado...</Text>
        ) : (
          Object.values(players).map((player) => (
            <View key={player.id} style={styles.playerRow}>
              <Text style={styles.playerName}>
                {player.character} {player.name}
                {player.id === socket.id && " (Você)"}
                {isHost && player.id === socket.id && " 👑"}
              </Text>
            </View>
          ))
        )}

        <Text style={styles.statusText}>Fase atual: {gamePhase}</Text>

        {isHost ? (
          <View style={styles.hostControls}>
            <Text style={styles.hostLabel}>Você é o host da sala</Text>
            <Button
              title="🎯 Iniciar Seleção de Cenário"
              onPress={() => {
                console.log("🚀 [CLIENTE] Host iniciando seleção de cenário");
                socket.emit("startScenarioSelection", { roomId });
              }}
            />
          </View>
        ) : (
          <Text style={styles.waitingLabel}>
            Aguardando o host iniciar a seleção de cenário...
          </Text>
        )}

        <Button title="🚪 Sair" onPress={onExit} />
      </View>
    );
  };

  // Seleção de cenário
  const selectScenario = (scenario: Scenario) => {
    console.log("🌍 [CLIENTE] Selecionando cenário:", scenario.name);
    socket.emit("selectScenario", { roomId, scenario });
    setSelectedScenario(scenario);
  };

  // Seleção de item
  const handleSelectItem = (type: Obstacle["type"]) => {
    if (disabledItems.has(type)) {
      Alert.alert(
        "Item Indisponível",
        "Este item já foi escolhido por outro jogador."
      );
      return;
    }

    console.log("🎯 [CLIENTE] Selecionando item:", type);
    socket.emit(
      "selectItem",
      { roomId, itemType: type },
      (res: { ok: boolean }) => {
        if (res.ok) {
          setSelectedObstacleType(type);
          setDraggingObstacle({ type, x: width / 2, y: height / 2 });
          setShowItemModal(false);
          setGamePhase("placing");
        } else {
          Alert.alert(
            "Item Indisponível",
            "Este item já foi escolhido por outro jogador."
          );
        }
      }
    );
  };

  // Colocar obstáculo
  const placeObstacle = () => {
    if (!selectedObstacleType || !draggingObstacle) return;

    console.log("📍 [CLIENTE] Colocando obstáculo:", selectedObstacleType);
    const size = getObstacleSize(selectedObstacleType);
    const obstacle: Obstacle = {
      id: `${socket.id}-${Date.now()}`,
      x: draggingObstacle.x,
      y: draggingObstacle.y,
      width: size.width,
      height: size.height,
      ownerId: socket.id,
      type: selectedObstacleType,
    };

    socket.emit("placeObstacle", { roomId, obstacle });
    socket.emit("itemPlaced", { roomId });
    setSelectedObstacleType(null);
    setDraggingObstacle(null);
    setGamePhase("waitingForOthers");
  };

  const getObstacleSize = (type: Obstacle["type"]) => {
    switch (type) {
      case "platform":
        return { width: 60, height: 15 };
      case "spike":
        return { width: 30, height: 40 };
      case "spring":
        return { width: 25, height: 20 };
      case "hammer":
        return { width: 35, height: 35 };
      case "saw":
        return { width: 40, height: 40 };
      case "cannon":
        return { width: 45, height: 30 };
      case "wall":
        return { width: 20, height: 100 };
      case "crossbow":
        return { width: 40, height: 30 };
      default:
        return { width: 30, height: 30 };
    }
  };

  const getObstacleEmoji = (type: Obstacle["type"]) => {
    switch (type) {
      case "platform":
        return "🟫";
      case "spike":
        return "🔺";
      case "spring":
        return "🌀";
      case "hammer":
        return "🔨";
      case "saw":
        return "⚙️";
      case "cannon":
        return "💥";
      case "wall":
        return "🧱";
      case "crossbow":
        return "🏹";
      default:
        return "⬜";
    }
  };

  const renderScenarioSelection = () => (
    <View style={styles.selectionContainer}>
      <Text style={styles.title}>Escolha o Cenário</Text>
      <ScrollView contentContainerStyle={styles.scenarioGrid}>
        {scenarios.map((scenario) => (
          <TouchableWithoutFeedback
            key={scenario.id}
            onPress={() => selectScenario(scenario)}
          >
            <View
              style={[
                styles.scenarioCard,
                { backgroundColor: scenario.background },
              ]}
            >
              <Text style={styles.scenarioText}>{scenario.name}</Text>
            </View>
          </TouchableWithoutFeedback>
        ))}
      </ScrollView>
    </View>
  );

  const renderItemSelectionModal = () => (
    <Modal visible={showItemModal} transparent animationType="slide">
      <View style={styles.modalContainer}>
        <View style={styles.obstacleMenu}>
          <Text style={styles.menuTitle}>
            Escolha um Item ({remainingTime}s)
          </Text>
          <ScrollView contentContainerStyle={styles.obstacleGrid}>
            {availableObstacles.map((type) => (
              <TouchableWithoutFeedback
                key={type}
                onPress={() => handleSelectItem(type)}
              >
                <View
                  style={[
                    styles.obstacleOption,
                    disabledItems.has(type) && { opacity: 0.3 },
                  ]}
                >
                  <Text style={styles.obstacleEmoji}>
                    {getObstacleEmoji(type)}
                  </Text>
                  <Text style={styles.obstacleLabel}>{type}</Text>
                  {disabledItems.has(type) && (
                    <Text style={styles.takenLabel}>Ocupado</Text>
                  )}
                </View>
              </TouchableWithoutFeedback>
            ))}
          </ScrollView>
          <Button
            title="⏭️ Pular Seleção"
            onPress={() => {
              setShowItemModal(false);
              socket.emit("skipItemSelection", { roomId });
              setGamePhase("waitingForOthers");
            }}
          />
        </View>
      </View>
    </Modal>
  );

  const renderBuildingPhase = () => (
    <TouchableWithoutFeedback onPress={() => {}}>
      <View
        style={[
          styles.container,
          { backgroundColor: selectedScenario?.background || "#def" },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>
            Fase de Construção - {selectedScenario?.name}
          </Text>
          {isHost && (
            <>
              <Button
                title="📋 Obstáculos"
                onPress={() => setShowObstacleMenu(true)}
              />
              <Button
                title="🚀 Começar Jogo"
                onPress={() => {
                  console.log("🚀 [CLIENTE] Host iniciando round");
                  socket.emit("startRound", { roomId });
                }}
              />
            </>
          )}
          <Button title="🚪 Sair" onPress={onExit} />
        </View>

        {!isHost && (
          <Text style={styles.instruction}>
            Aguardando o host iniciar o jogo...
          </Text>
        )}

        {selectedObstacleType && (
          <Text style={styles.instruction}>
            Toque na tela para colocar: {getObstacleEmoji(selectedObstacleType)}
          </Text>
        )}

        {obstacles.map((obs) => (
          <View
            key={obs.id}
            style={[
              styles.obstacle,
              {
                left: obs.x,
                top: obs.y,
                width: obs.width,
                height: obs.height,
              },
            ]}
          >
            <Text style={styles.obstacleEmoji}>
              {getObstacleEmoji(obs.type)}
            </Text>
          </View>
        ))}

        <View
          style={[
            styles.ground,
            {
              top: height - (selectedScenario?.groundY || 150),
              backgroundColor:
                selectedScenario?.background === "#220033" ? "#444" : "#8B4513",
              width: levelWidth,
            },
          ]}
        />

        <Modal visible={showObstacleMenu} transparent animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.obstacleMenu}>
              <Text style={styles.menuTitle}>Escolha um Obstáculo</Text>
              <ScrollView contentContainerStyle={styles.obstacleGrid}>
                {availableObstacles.map((type) => (
                  <TouchableWithoutFeedback
                    key={type}
                    onPress={() => {
                      setSelectedObstacleType(type);
                      setShowObstacleMenu(false);
                    }}
                  >
                    <View style={styles.obstacleOption}>
                      <Text style={styles.obstacleEmoji}>
                        {getObstacleEmoji(type)}
                      </Text>
                      <Text style={styles.obstacleLabel}>{type}</Text>
                    </View>
                  </TouchableWithoutFeedback>
                ))}
              </ScrollView>
              <Button
                title="Fechar"
                onPress={() => setShowObstacleMenu(false)}
              />
            </View>
          </View>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );

  const renderPlacingPhase = () => {
    if (!selectedObstacleType || !draggingObstacle) return null;

    const size = getObstacleSize(selectedObstacleType);

    return (
      <View
        style={[
          styles.container,
          { backgroundColor: selectedScenario?.background || "#def" },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>
            Posicione seu Item - {selectedScenario?.name}
          </Text>
          <Button title="🚪 Sair" onPress={onExit} />
        </View>

        <Text style={styles.instruction}>
          Arraste o item para posicioná-lo. Solte para confirmar.
        </Text>

        {obstacles.map((obs) => (
          <View
            key={obs.id}
            style={[
              styles.obstacle,
              {
                left: obs.x,
                top: obs.y,
                width: obs.width,
                height: obs.height,
              },
            ]}
          >
            <Text style={styles.obstacleEmoji}>
              {getObstacleEmoji(obs.type)}
            </Text>
          </View>
        ))}

        <PanGestureHandler
          onGestureEvent={(evt) => {
            const { translationX, translationY } = evt.nativeEvent;
            setDraggingObstacle({
              ...draggingObstacle,
              x: initialDragPos.current.x + translationX,
              y: initialDragPos.current.y + translationY,
            });
          }}
          onHandlerStateChange={(evt) => {
            if (evt.nativeEvent.state === State.BEGAN) {
              initialDragPos.current = {
                x: draggingObstacle.x,
                y: draggingObstacle.y,
              };
            }
            if (evt.nativeEvent.state === State.END) {
              placeObstacle();
            }
          }}
        >
          <View
            style={[
              styles.obstacle,
              {
                left: draggingObstacle.x,
                top: draggingObstacle.y,
                width: size.width,
                height: size.height,
                opacity: 0.8,
              },
            ]}
          >
            <Text style={styles.obstacleEmoji}>
              {getObstacleEmoji(selectedObstacleType)}
            </Text>
          </View>
        </PanGestureHandler>

        <View
          style={[
            styles.ground,
            {
              top: height - (selectedScenario?.groundY || 150),
              backgroundColor:
                selectedScenario?.background === "#220033" ? "#444" : "#8B4513",
              width: levelWidth,
            },
          ]}
        />
      </View>
    );
  };

  const renderWaitingForOthers = () => (
    <View
      style={[
        styles.container,
        { backgroundColor: selectedScenario?.background || "#def" },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>
          Aguardando outros jogadores - {selectedScenario?.name}
        </Text>
        <Button title="🚪 Sair" onPress={onExit} />
      </View>

      <Text style={styles.instruction}>
        Aguardando outros jogadores colocarem seus itens...
      </Text>

      {obstacles.map((obs) => (
        <View
          key={obs.id}
          style={[
            styles.obstacle,
            {
              left: obs.x,
              top: obs.y,
              width: obs.width,
              height: obs.height,
            },
          ]}
        >
          <Text style={styles.obstacleEmoji}>{getObstacleEmoji(obs.type)}</Text>
        </View>
      ))}

      <View
        style={[
          styles.ground,
          {
            top: height - (selectedScenario?.groundY || 150),
            backgroundColor:
              selectedScenario?.background === "#220033" ? "#444" : "#8B4513",
            width: levelWidth,
          },
        ]}
      />
    </View>
  );

  const renderGameplay = () => {
    console.log("🎮 [CLIENTE] Renderizando gameplay, players:", players);

    return (
      <View
        style={[
          styles.container,
          { backgroundColor: selectedScenario?.background || "#def" },
        ]}
      >
        <View
          style={[
            styles.gameArea,
            { transform: [{ translateX: -cameraOffset }] },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>
              Capybara Chaos - {selectedScenario?.name} | Tempo:{" "}
              {roundCountdown}s | Rodada: {roundNumber}
            </Text>
            {Object.values(players).map((p) => (
              <Text key={p.id} style={styles.playerScore}>
                {p.name}: {p.points || 0}
              </Text>
            ))}
            <Button title="🚪 Sair" onPress={onExit} />
          </View>

          {Object.values(players).length === 0 ? (
            <Text style={styles.statusText}>Nenhum jogador visível...</Text>
          ) : (
            Object.values(players).map((p) => (
              <View
                key={p.id}
                style={[
                  styles.player,
                  {
                    left: p.x - 15,
                    top: p.y - 30,
                  },
                ]}
              >
                <Text style={styles.playerCharacter}>{p.character}</Text>
                <Text style={styles.playerName}>{p.name}</Text>
              </View>
            ))
          )}

          {obstacles.map((obs) => (
            <View
              key={obs.id}
              style={[
                styles.obstacle,
                {
                  left: obs.x,
                  top: obs.y,
                  width: obs.width,
                  height: obs.height,
                },
              ]}
            >
              <Text style={styles.obstacleEmoji}>
                {getObstacleEmoji(obs.type)}
              </Text>
            </View>
          ))}

          {projectiles.map((proj) => (
            <View
              key={proj.id}
              style={[
                styles.obstacle,
                {
                  left: proj.x,
                  top: proj.y,
                  width: proj.width,
                  height: proj.height,
                },
              ]}
            >
              <Text style={styles.obstacleEmoji}>
                {proj.dir > 0 ? "→" : "←"}
              </Text>
            </View>
          ))}

          <View
            style={[
              styles.ground,
              {
                top: height - (selectedScenario?.groundY || 150),
                backgroundColor:
                  selectedScenario?.background === "#220033"
                    ? "#444"
                    : "#8B4513",
                width: levelWidth,
              },
            ]}
          />

          <View
            style={{
              position: "absolute",
              left: levelWidth - 60,
              top: height - (selectedScenario?.groundY || 150) - 50,
            }}
          >
            <Text style={styles.flagEmoji}>🚩</Text>
          </View>

          {gamePhase === "playing" && (
            <View style={styles.statusIndicators}>
              <Text style={styles.statusText}>
                Vel X: {velocityRef.current.x.toFixed(1)}
              </Text>
              <Text style={styles.statusText}>
                Vel Y: {velocityRef.current.y.toFixed(1)}
              </Text>
              <Text style={styles.statusText}>
                {isGrounded ? "🟢 No Chão" : `🔴 No Ar (${jumpCount}/2)`}
              </Text>
              {isDead && <Text style={styles.statusText}>💀 Morto</Text>}
              {reachedFlag && <Text style={styles.statusText}>🏆 Chegou!</Text>}
            </View>
          )}
        </View>

        {gamePhase === "playing" && (
          <View style={styles.gameControls}>
            <View style={styles.analogStick}>
              <PanGestureHandler
                ref={panGestureRef}
                simultaneousHandlers={[jumpTapRef]}
                onGestureEvent={(evt) => {
                  const { translationX: dx, translationY: dy } =
                    evt.nativeEvent;
                  const maxDistance = 40;
                  const distance = Math.sqrt(dx * dx + dy * dy);
                  let newPosition = { x: dx, y: dy };
                  if (distance > maxDistance) {
                    const angle = Math.atan2(dy, dx);
                    newPosition = {
                      x: Math.cos(angle) * maxDistance,
                      y: Math.sin(angle) * maxDistance,
                    };
                  }
                  setJoystickPosition(newPosition);
                  joystickRef.current = newPosition;
                }}
                onHandlerStateChange={(evt) => {
                  if (evt.nativeEvent.state === State.BEGAN)
                    setIsJoystickActive(true);
                  if (
                    evt.nativeEvent.state === State.END ||
                    evt.nativeEvent.state === State.CANCELLED
                  ) {
                    setIsJoystickActive(false);
                    setJoystickPosition({ x: 0, y: 0 });
                    joystickRef.current = { x: 0, y: 0 };
                  }
                }}
              >
                <View style={styles.analogBase}>
                  <View
                    style={[
                      styles.analogKnob,
                      {
                        transform: [
                          { translateX: joystickPosition.x },
                          { translateY: joystickPosition.y },
                        ],
                        backgroundColor: isJoystickActive ? "#4CAF50" : "#999",
                      },
                    ]}
                  />
                </View>
              </PanGestureHandler>
            </View>

            <TapGestureHandler
              ref={jumpTapRef}
              simultaneousHandlers={[panGestureRef]}
              onHandlerStateChange={(evt) => {
                if (evt.nativeEvent.state === State.ACTIVE) {
                  jump();
                }
              }}
            >
              <View
                style={[
                  styles.jumpButton,
                  { opacity: isGrounded || jumpCount < 2 ? 1 : 0.5 },
                ]}
              >
                <Text style={styles.jumpText}>
                  {jumpCount === 0 ? "🦘" : jumpCount === 1 ? "🚀" : "❌"}
                </Text>
                <Text style={styles.jumpLabel}>
                  {isGrounded ? "PULO" : jumpCount < 2 ? "DUPLO" : "MAX"}
                </Text>
              </View>
            </TapGestureHandler>
          </View>
        )}

        {gameWinner && (
          <Modal visible={!!gameWinner} transparent animationType="fade">
            <View style={styles.modalContainer}>
              <View style={styles.obstacleMenu}>
                <Text style={styles.title}>🏆 Vencedor: {gameWinner}</Text>
                <Button title="🚪 Sair" onPress={onExit} />
              </View>
            </View>
          </Modal>
        )}
        {gamePhase === "itemSelection" && renderItemSelectionModal()}
      </View>
    );
  };

  // SWITCH PRINCIPAL: Determina qual fase renderizar
  const renderCurrentPhase = () => {
    console.log(`🎨 [CLIENTE] Renderizando fase: ${gamePhase}`);

    switch (gamePhase) {
      case "waiting":
        return renderWaitingPhase();
      case "selecting":
        return renderScenarioSelection();
      case "building":
        return renderBuildingPhase();
      case "placing":
        return renderPlacingPhase();
      case "waitingForOthers":
        return renderWaitingForOthers();
      case "itemSelection":
      case "playing":
        return renderGameplay();
      default:
        console.warn(`⚠️ [CLIENTE] Fase desconhecida: ${gamePhase}`);
        return renderWaitingPhase();
    }
  };

  return renderCurrentPhase();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  gameArea: {
    flex: 1,
    position: "relative",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    flexWrap: "wrap",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    color: "#fff",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginVertical: 10,
    color: "#333",
  },
  playerScore: {
    color: "#fff",
    fontSize: 14,
    marginLeft: 10,
  },
  waitingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#def",
    padding: 20,
  },
  playerRow: {
    padding: 8,
    marginVertical: 2,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: 5,
    minWidth: 200,
  },
  playerName: {
    fontSize: 16,
    textAlign: "center",
    color: "#333",
  },
  statusText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginVertical: 5,
  },
  hostControls: {
    marginVertical: 20,
    padding: 15,
    backgroundColor: "rgba(76, 175, 80, 0.1)",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#4CAF50",
  },
  hostLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#4CAF50",
    textAlign: "center",
    marginBottom: 10,
  },
  waitingLabel: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    fontStyle: "italic",
    marginVertical: 20,
  },
  selectionContainer: {
    flex: 1,
    backgroundColor: "#def",
    padding: 20,
  },
  scenarioGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
  },
  scenarioCard: {
    width: width * 0.4,
    height: 100,
    margin: 10,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  scenarioText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  instruction: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.3)",
    padding: 8,
    borderRadius: 5,
  },
  player: {
    position: "absolute",
    alignItems: "center",
  },
  playerCharacter: {
    fontSize: 24,
  },
  obstacle: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(139, 69, 19, 0.8)",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#654321",
  },
  obstacleEmoji: {
    fontSize: 20,
  },
  obstacleLabel: {
    fontSize: 10,
    textAlign: "center",
    marginTop: 2,
  },
  takenLabel: {
    fontSize: 8,
    color: "red",
    fontWeight: "bold",
  },
  ground: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 150,
    borderTopWidth: 3,
    borderTopColor: "#654321",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  obstacleMenu: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    width: width * 0.8,
    maxHeight: height * 0.6,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
  },
  obstacleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
  },
  obstacleOption: {
    width: 80,
    height: 80,
    margin: 5,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#ddd",
  },
  gameControls: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 30,
    alignItems: "flex-end",
  },
  analogStick: {
    alignItems: "center",
  },
  analogBase: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.5)",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  analogKnob: {
    width: 40,
    height: 40,
    borderRadius: 20,
    position: "absolute",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  jumpButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 193, 7, 0.9)",
    borderWidth: 4,
    borderColor: "#FFC107",
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  jumpText: {
    fontSize: 24,
    marginBottom: 2,
  },
  jumpLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#8B4513",
  },
  statusIndicators: {
    position: "absolute",
    top: 60,
    left: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 8,
    borderRadius: 5,
  },
  flagEmoji: {
    fontSize: 32,
  },
});
