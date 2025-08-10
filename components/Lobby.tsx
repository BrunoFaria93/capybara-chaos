// components/Lobby.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";

// Personagens disponíveis
const characters = ["🐹", "🐰", "🦔", "🐿️", "🦝", "🐨", "🐼", "🦊"];

export default function Lobby({
  onCreate,
  onJoin,
}: {
  onCreate: (roomId: string, name: string, character: string) => void;
  onJoin: (roomId: string, name: string, character: string) => void;
}) {
  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState("Player" + Math.floor(Math.random() * 1000));
  const [selectedCharacter, setSelectedCharacter] = useState("🐹");
  const [showCharacterSelector, setShowCharacterSelector] = useState(false);

  const validateInput = () => {
    if (!roomId.trim()) {
      Alert.alert("Erro", "Digite um ID para a sala");
      return false;
    }
    if (!name.trim()) {
      Alert.alert("Erro", "Digite seu nome");
      return false;
    }
    if (name.length > 15) {
      Alert.alert("Erro", "Nome muito longo (máximo 15 caracteres)");
      return false;
    }
    return true;
  };

  const handleCreate = () => {
    if (!validateInput()) return;
    onCreate(roomId.trim(), name.trim(), selectedCharacter);
  };

  const handleJoin = () => {
    if (!validateInput()) return;
    onJoin(roomId.trim(), name.trim(), selectedCharacter);
  };

  const generateRandomRoomId = () => {
    const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(randomId);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>🐹 Capybara Chaos</Text>
      <Text style={styles.subtitle}>Multiplayer Obstacle Mayhem</Text>

      {/* Seletor de Personagem */}
      <View style={styles.section}>
        <Text style={styles.label}>Escolha seu personagem:</Text>
        <TouchableOpacity
          style={styles.characterButton}
          onPress={() => setShowCharacterSelector(!showCharacterSelector)}
        >
          <Text style={styles.selectedCharacter}>{selectedCharacter}</Text>
          <Text style={styles.characterButtonText}>Trocar</Text>
        </TouchableOpacity>

        {showCharacterSelector && (
          <View style={styles.characterGrid}>
            {characters.map((char) => (
              <TouchableOpacity
                key={char}
                style={[
                  styles.characterOption,
                  selectedCharacter === char && styles.characterSelected,
                ]}
                onPress={() => {
                  setSelectedCharacter(char);
                  setShowCharacterSelector(false);
                }}
              >
                <Text style={styles.characterEmoji}>{char}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Nome do Jogador */}
      <View style={styles.section}>
        <Text style={styles.label}>Seu nome:</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          style={styles.textInput}
          placeholder="Digite seu nome"
          maxLength={15}
        />
      </View>

      {/* ID da Sala */}
      <View style={styles.section}>
        <Text style={styles.label}>ID da sala:</Text>
        <View style={styles.roomIdContainer}>
          <TextInput
            value={roomId}
            onChangeText={setRoomId}
            style={[styles.textInput, styles.roomIdInput]}
            placeholder="Digite o ID da sala"
            maxLength={10}
            autoCapitalize="characters"
          />
          <TouchableOpacity
            style={styles.randomButton}
            onPress={generateRandomRoomId}
          >
            <Text style={styles.randomButtonText}>🎲</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Botões de Ação */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.createButton} onPress={handleCreate}>
          <Text style={styles.buttonText}>🚀 Criar Nova Sala</Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <Text style={styles.dividerText}>ou</Text>
        </View>

        <TouchableOpacity style={styles.joinButton} onPress={handleJoin}>
          <Text style={styles.buttonText}>🏠 Entrar na Sala</Text>
        </TouchableOpacity>
      </View>

      {/* Dicas */}
      <View style={styles.tips}>
        <Text style={styles.tipsTitle}>💡 Como jogar:</Text>
        <Text style={styles.tipsText}>1. Escolha um cenário único</Text>
        <Text style={styles.tipsText}>
          2. Coloque obstáculos para dificultar outros jogadores
        </Text>
        <Text style={styles.tipsText}>3. Tente chegar ao final da fase!</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#f0f8ff",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 5,
    color: "#2c5530",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 30,
    color: "#666",
    fontStyle: "italic",
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: "#2c5530",
  },
  textInput: {
    borderWidth: 2,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "white",
  },
  characterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderWidth: 2,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
  },
  selectedCharacter: {
    fontSize: 32,
    marginRight: 12,
  },
  characterButtonText: {
    fontSize: 16,
    color: "#2c5530",
    fontWeight: "600",
  },
  characterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
    backgroundColor: "white",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  characterOption: {
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    margin: 5,
    borderRadius: 25,
    backgroundColor: "#f0f0f0",
  },
  characterSelected: {
    backgroundColor: "#4CAF50",
  },
  characterEmoji: {
    fontSize: 24,
  },
  roomIdContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  roomIdInput: {
    flex: 1,
    marginRight: 10,
  },
  randomButton: {
    backgroundColor: "#2196F3",
    padding: 12,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  randomButtonText: {
    fontSize: 20,
  },
  buttonContainer: {
    marginTop: 20,
  },
  createButton: {
    backgroundColor: "#4CAF50",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  joinButton: {
    backgroundColor: "#2196F3",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  divider: {
    alignItems: "center",
    marginVertical: 10,
  },
  dividerText: {
    fontSize: 14,
    color: "#666",
    backgroundColor: "#f0f8ff",
    paddingHorizontal: 10,
  },
  tips: {
    marginTop: 30,
    backgroundColor: "rgba(76, 175, 80, 0.1)",
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#4CAF50",
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#2c5530",
  },
  tipsText: {
    fontSize: 14,
    marginBottom: 4,
    color: "#2c5530",
  },
});
