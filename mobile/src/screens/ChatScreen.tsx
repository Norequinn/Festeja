import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api, resolveMediaUrl } from '../api';
import { ImageLightboxModal, ImagePickerField } from '../components/Pickers';
import { Avatar, EmptyState } from '../components/UI';
import { FONTS, ThemeColors, useTheme } from '../theme';
import type { ChatMessage, MemberSummary, Space } from '../types';

interface Props {
  space: Space;
  me: MemberSummary;
  onOpenMember: (memberId: string) => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatScreen({ space, me, onOpenMember }: Props) {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [pendingImage, setPendingImage] = useState('');
  const [sending, setSending] = useState(false);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.getChatMessages();
      setMessages(res.messages);
    } catch {
      // ignore transient polling error
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [load]);

  async function handleSend() {
    if ((!text.trim() && !pendingImage) || sending) return;
    setSending(true);
    try {
      const { message } = await api.sendChatMessage({
        text: text.trim(),
        imageUrl: pendingImage,
      });
      setMessages((prev) => [...prev, message]);
      setText('');
      setPendingImage('');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>💬 Chat de {space.name}</Text>
          <Text style={styles.headerSub}>Conversa con todo el equipo y comparte fotos</Text>
        </View>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>En vivo</Text>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={(el) => {
          scrollRef.current = el;
        }}
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 ? (
          <EmptyState
            emoji="💬"
            title="Inicia la conversación"
            description="Saluda al equipo, coordina salidas o comparte fotos de celebraciones."
          />
        ) : (
          messages.map((msg) => {
            const isMine = msg.author.id === me.id;
            const imgUri = resolveMediaUrl(msg.imageUrl);
            return (
              <View
                key={msg.id}
                style={[styles.msgRow, isMine ? styles.msgRowMine : styles.msgRowOther]}
              >
                {!isMine && (
                  <TouchableOpacity onPress={() => onOpenMember(msg.author.id)}>
                    <Avatar
                      emoji={msg.author.avatarEmoji}
                      color={msg.author.avatarColor}
                      imageUrl={msg.author.avatarImageUrl}
                      size={34}
                    />
                  </TouchableOpacity>
                )}

                <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
                  {!isMine && (
                    <Text style={styles.authorName}>
                      {msg.author.name}
                      {msg.author.role === 'ADMIN' ? ' 👑' : ''}
                    </Text>
                  )}

                  {imgUri ? (
                    <TouchableOpacity onPress={() => setLightboxUri(imgUri)}>
                      <Image source={{ uri: imgUri }} style={styles.msgImage} resizeMode="cover" />
                    </TouchableOpacity>
                  ) : null}

                  {msg.text ? (
                    <Text style={[styles.msgText, isMine && { color: '#FFFFFF' }]}>{msg.text}</Text>
                  ) : null}

                  <Text
                    style={[
                      styles.timeText,
                      isMine && { color: 'rgba(255,255,255,0.75)', textAlign: 'right' },
                    ]}
                  >
                    {formatTime(msg.createdAt)}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Pending image preview */}
      {pendingImage ? (
        <View style={styles.previewBar}>
          <Image
            source={{ uri: resolveMediaUrl(pendingImage) || undefined }}
            style={styles.previewThumb}
          />
          <Text style={styles.previewLabel}>Foto lista para enviar</Text>
          <TouchableOpacity onPress={() => setPendingImage('')}>
            <Text style={{ color: COLORS.danger, fontWeight: '800', fontSize: 13 }}>Quitar</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Composer */}
      <View style={styles.composer}>
        <ImagePickerField value={pendingImage} onChange={setPendingImage} compact />
        <TextInput
          style={styles.input}
          placeholder="Escribe un mensaje..."
          placeholderTextColor={COLORS.textLight}
          value={text}
          onChangeText={setText}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={sending || (!text.trim() && !pendingImage)}
          onPress={handleSend}
          style={[
            styles.sendBtn,
            (!text.trim() && !pendingImage) && { opacity: 0.45 },
          ]}
        >
          <Text style={styles.sendText}>➤</Text>
        </TouchableOpacity>
      </View>

      <ImageLightboxModal
        uri={lightboxUri}
        title="Foto del chat"
        onClose={() => setLightboxUri(null)}
      />
    </KeyboardAvoidingView>
  );
}

const createStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 17, fontFamily: FONTS.title, letterSpacing: 1, color: COLORS.secondary },
  headerSub: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textMuted, marginTop: 2 },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.tealLight,
    borderWidth: 1,
    borderColor: COLORS.teal,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.primary },
  liveText: { fontSize: 11, fontFamily: FONTS.bold, color: COLORS.secondary },
  listContent: { padding: 14, gap: 10, paddingBottom: 20 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowMine: { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  bubbleMine: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 4,
  },
  authorName: {
    fontSize: 11.5,
    fontFamily: FONTS.bold,
    color: COLORS.secondary,
    marginBottom: 3,
  },
  msgImage: {
    width: 210,
    height: 155,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: COLORS.surfaceMuted,
  },
  msgText: { fontSize: 14.5, fontFamily: FONTS.regular, color: COLORS.text, lineHeight: 20 },
  timeText: { fontSize: 10, color: COLORS.textLight, marginTop: 4 },
  previewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: COLORS.secondaryLight,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  previewThumb: { width: 42, height: 42, borderRadius: 8 },
  previewLabel: { flex: 1, fontSize: 12.5, fontWeight: '700', color: COLORS.secondary },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 22,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    color: COLORS.text,
    minHeight: 44,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
});
