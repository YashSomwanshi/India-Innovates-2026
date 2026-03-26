import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { createCustomAvatar } from '../../shared/services/api';

/**
 * CreateAvatarScreen — Posts new avatar to backend API (single source of truth).
 * No more AsyncStorage.
 */
export default function CreateAvatarScreen({ navigation }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [gender, setGender] = useState('male');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const trimmedName = name.trim();
    const trimmedDesc = description.trim();

    // ─── Validation ───
    if (!trimmedName) {
      Alert.alert('Missing Name', 'Please enter an avatar name.');
      return;
    }
    if (!trimmedDesc) {
      Alert.alert('Missing Description', 'Please enter a description or context for your avatar.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: trimmedName,
        title: 'Custom Avatar',
        description: trimmedDesc,
        gender,
        avatarGender: gender,
        voice: gender,
        emoji: '🤖',
      };
      console.log('[Mobile] Creating avatar:', JSON.stringify(payload));
      const res = await createCustomAvatar(payload);
      console.log('[Mobile] Create response:', JSON.stringify(res).substring(0, 200));

      if (res.success) {
        Alert.alert('✅ Avatar Created', `"${trimmedName}" has been saved.`, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        console.warn('[Mobile] Create avatar error:', res.error);
        Alert.alert('Error', res.error || 'Failed to create avatar. Please try again.');
      }
    } catch (e) {
      console.error('[Mobile] Save avatar error:', e);
      Alert.alert('Error', 'Failed to save avatar. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerEmoji}>🤖</Text>
          <Text style={styles.headerTitle}>Create New Avatar</Text>
          <Text style={styles.headerSub}>Design your own AI assistant</Text>
        </View>

        {/* Avatar Name */}
        <View style={styles.field}>
          <Text style={styles.label}>Avatar Name <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. My Teacher, Health Advisor…"
            placeholderTextColor="#6B7280"
            maxLength={40}
          />
          <Text style={styles.charCount}>{name.length}/40</Text>
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>Description / Context <Text style={styles.required}>*</Text></Text>
          <Text style={styles.hint}>This will shape your avatar's personality and knowledge.</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. You are a friendly math teacher who explains concepts with real-world examples…"
            placeholderTextColor="#6B7280"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={styles.charCount}>{description.length}/500</Text>
        </View>

        {/* Gender */}
        <View style={styles.field}>
          <Text style={styles.label}>Voice Gender</Text>
          <View style={styles.genderRow}>
            <TouchableOpacity
              style={[styles.genderBtn, gender === 'male' && styles.genderBtnActive]}
              onPress={() => setGender('male')}
            >
              <Text style={styles.genderEmoji}>👨</Text>
              <Text style={[styles.genderText, gender === 'male' && styles.genderTextActive]}>Male</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.genderBtn, gender === 'female' && styles.genderBtnActive]}
              onPress={() => setGender('female')}
            >
              <Text style={styles.genderEmoji}>👩</Text>
              <Text style={[styles.genderText, gender === 'female' && styles.genderTextActive]}>Female</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : '💾  Save Avatar'}</Text>
        </TouchableOpacity>

        {/* Cancel */}
        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  scrollContent: { padding: 20, paddingBottom: 50 },

  header: { alignItems: 'center', marginBottom: 28, marginTop: 8 },
  headerEmoji: { fontSize: 48, marginBottom: 8 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },

  field: { marginBottom: 22 },
  label: { fontSize: 14, fontWeight: '600', color: '#E5E7EB', marginBottom: 8 },
  required: { color: '#FF7A00' },
  hint: { fontSize: 11, color: '#6B7280', marginBottom: 8, lineHeight: 16 },

  input: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#fff',
    fontSize: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 14,
  },
  charCount: { fontSize: 10, color: '#4B5563', textAlign: 'right', marginTop: 4 },

  genderRow: { flexDirection: 'row', gap: 12 },
  genderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#1a1a2e',
  },
  genderBtnActive: {
    borderColor: '#FF7A00',
    backgroundColor: 'rgba(255,122,0,0.12)',
  },
  genderEmoji: { fontSize: 20 },
  genderText: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  genderTextActive: { color: '#FF7A00' },

  saveBtn: {
    backgroundColor: '#FF7A00',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    elevation: 4,
    shadowColor: '#FF7A00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  cancelBtn: { alignItems: 'center', marginTop: 16, paddingVertical: 10 },
  cancelBtnText: { fontSize: 14, color: '#6B7280' },
});
